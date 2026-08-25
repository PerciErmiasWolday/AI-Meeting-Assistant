from huggingface_hub import InferenceClient
import os
import re
import json
from dotenv import load_dotenv
from typing import Dict, List

load_dotenv()

# Mistral-7B-Instruct has a large context window, but we stay well under it so
# there's headroom for the prompt and response and output stays reliable.
CHUNK_CHARS = 12000
QA_CHUNK_CHARS = 3000
QA_CONTEXT_BUDGET = 12000

_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "and", "or", "to", "of",
    "in", "on", "at", "for", "with", "what", "who", "when", "where", "why",
    "how", "did", "do", "does", "it", "this", "that", "be", "will",
}


class SummarizationService:
    def __init__(self):
        """Initialize Hugging Face Inference Client"""
        self.token = os.getenv("HF_TOKEN")
        self.model_id = os.getenv("HF_MODEL_ID", "mistralai/Mistral-7B-Instruct-v0.2")

        if not self.token:
            raise ValueError(
                "HF_TOKEN not found in environment variables. Get a free token at "
                "https://huggingface.co/settings/tokens and set it in .env"
            )

        self.client = InferenceClient(token=self.token)
        print(f"Hugging Face Client initialized with model: {self.model_id}")

    def _chat(self, messages: List[dict], max_tokens: int, temperature: float) -> str:
        try:
            response = self.client.chat_completion(
                messages=messages,
                model=self.model_id,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content
        except Exception as e:
            raise RuntimeError(f"Hugging Face request failed: {e}") from e

    @staticmethod
    def _chunk_text(text: str, max_chars: int) -> List[str]:
        """Split text into pieces near max_chars, breaking on line/word boundaries."""
        if len(text) <= max_chars:
            return [text]

        chunks = []
        start = 0
        while start < len(text):
            end = min(start + max_chars, len(text))
            if end < len(text):
                split_at = text.rfind("\n", start, end)
                if split_at <= start:
                    split_at = text.rfind(" ", start, end)
                if split_at > start:
                    end = split_at
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            start = end
        return chunks

    @staticmethod
    def _parse_json_response(text: str) -> Dict:
        """Extract and validate the {summary, action_items} JSON object from a model reply."""
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise ValueError("Model response did not contain a JSON object")

        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError as e:
            raise ValueError(f"Model response was not valid JSON: {e}") from e

        summary = data.get("summary")
        action_items = data.get("action_items", [])

        if not isinstance(summary, list) or not all(isinstance(s, str) for s in summary):
            raise ValueError("'summary' must be a list of strings")
        if not isinstance(action_items, list) or not all(isinstance(a, str) for a in action_items):
            raise ValueError("'action_items' must be a list of strings")

        return {"summary": summary, "action_items": action_items}

    def _summarize_chunk(self, text: str) -> Dict:
        """Ask the model for a structured summary of one chunk, retrying once on bad output."""
        prompt = (
            "Analyze this meeting transcript excerpt and respond with ONLY a JSON object "
            "in this exact shape, no other text:\n"
            '{"summary": ["key point 1", "key point 2"], "action_items": ["action 1"]}\n\n'
            f"Transcript excerpt:\n{text}"
        )
        messages = [
            {"role": "system", "content": "You are an AI assistant that analyzes meeting transcripts and replies with strict JSON only."},
            {"role": "user", "content": prompt},
        ]

        raw = self._chat(messages, max_tokens=600, temperature=0.5)
        try:
            return self._parse_json_response(raw)
        except ValueError:
            messages.append({"role": "assistant", "content": raw})
            messages.append({"role": "user", "content": "That was not valid JSON. Reply again with ONLY the JSON object, nothing else."})
            raw_retry = self._chat(messages, max_tokens=600, temperature=0.3)
            return self._parse_json_response(raw_retry)

    def summarize_transcript(self, transcript: str) -> Dict[str, str]:
        """
        Summarize a meeting transcript and extract action items.
        Long transcripts are chunked and summarized hierarchically (summarize each
        chunk, then condense the combined chunk summaries) to stay within context limits.
        """
        if not transcript or not transcript.strip():
            raise ValueError("Transcript is empty")

        chunks = self._chunk_text(transcript.strip(), CHUNK_CHARS)

        if len(chunks) == 1:
            result = self._summarize_chunk(chunks[0])
        else:
            chunk_results = [self._summarize_chunk(c) for c in chunks]
            combined_points = "\n".join(f"- {p}" for r in chunk_results for p in r["summary"])
            combined_actions = "\n".join(f"- {a}" for r in chunk_results for a in r["action_items"])
            synthesis_input = (
                f"Key points from different segments of a long meeting:\n{combined_points}\n\n"
                f"Action items noted across segments:\n{combined_actions or 'None noted.'}"
            )
            result = self._summarize_chunk(synthesis_input)

        summary_text = "\n".join(f"- {s}" for s in result["summary"]) or "No summary available."
        action_text = "\n".join(f"- {a}" for a in result["action_items"]) or "No specific action items identified."

        return {"summary": summary_text, "action_items": action_text}

    def _select_context(self, transcript: str, question: str) -> str:
        """For long transcripts, keep only the chunks most relevant to the question
        (simple keyword overlap scoring) instead of sending the whole thing."""
        if len(transcript) <= QA_CONTEXT_BUDGET:
            return transcript

        chunks = self._chunk_text(transcript, QA_CHUNK_CHARS)
        q_words = set(re.findall(r"[a-z0-9']+", question.lower())) - _STOPWORDS

        scored = []
        for i, chunk in enumerate(chunks):
            chunk_words = re.findall(r"[a-z0-9']+", chunk.lower())
            score = sum(chunk_words.count(w) for w in q_words)
            scored.append((score, i, chunk))
        scored.sort(key=lambda x: x[0], reverse=True)

        selected = []
        budget = QA_CONTEXT_BUDGET
        for score, i, chunk in scored:
            if budget <= 0:
                break
            selected.append((i, chunk))
            budget -= len(chunk)

        selected.sort(key=lambda x: x[0])  # restore chronological order
        return "\n\n".join(c for _, c in selected)

    def answer_question(self, transcript: str, question: str) -> str:
        """
        Answer a question about the meeting transcript using Hugging Face

        Args:
            transcript: Full meeting transcript
            question: User's question

        Returns:
            Answer string
        """
        if not transcript or not transcript.strip():
            raise ValueError("Transcript is empty")

        context = self._select_context(transcript.strip(), question)

        messages = [
            {"role": "system", "content": "You are a helpful assistant that answers questions about meeting transcripts. If the answer is not in the provided transcript, say so clearly instead of guessing."},
            {"role": "user", "content": f"Based on the following meeting transcript, answer this question:\n\nQuestion: {question}\n\nMeeting Transcript:\n{context}\n\nAnswer using only information from the transcript above."},
        ]

        return self._chat(messages, max_tokens=300, temperature=0.5)
