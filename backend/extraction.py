from huggingface_hub import InferenceClient
import os
import re
import json
from dotenv import load_dotenv
from typing import Dict, List, Optional

load_dotenv()

CRM_FIELDS = [
    "first_name", "last_name", "phone_number", "company", "reason_for_call",
    "call_summary", "next_action", "call_outcome", "sentiment",
]


class ExtractionService:
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
    def _parse_crm_response(text: str) -> Dict[str, Optional[object]]:
        """Extract and validate the CRM JSON object from a model reply."""
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise ValueError("Model response did not contain a JSON object")

        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError as e:
            raise ValueError(f"Model response was not valid JSON: {e}") from e

        result = {}
        for field in CRM_FIELDS:
            value = data.get(field)
            if isinstance(value, str) and value.strip().lower() == "null":
                value = None  # some models emit the string "null" instead of JSON null
            if value is not None and not isinstance(value, str):
                raise ValueError(f"'{field}' must be a string or null")
            result[field] = value

        important_details = data.get("important_details", [])
        if not isinstance(important_details, list) or not all(isinstance(d, str) for d in important_details):
            raise ValueError("'important_details' must be a list of strings")
        result["important_details"] = important_details

        return result

    def extract_crm_data(self, transcript: str) -> Dict[str, Optional[object]]:
        """
        Extract structured CRM data (caller identity, call reason, outcome, etc.)
        from a call/meeting transcript. Any field not actually mentioned in the
        transcript comes back as null rather than a guess.
        """
        if not transcript or not transcript.strip():
            raise ValueError("Transcript is empty")

        prompt = (
            "Extract CRM call data from this transcript and respond with ONLY a JSON "
            "object in this exact shape, no other text:\n"
            '{"first_name": null, "last_name": null, "phone_number": null, '
            '"company": null, "reason_for_call": null, "call_summary": null, '
            '"next_action": null, "call_outcome": null, "sentiment": null, '
            '"important_details": []}\n\n'
            "Rules for factual fields (first_name, last_name, phone_number, company, "
            "reason_for_call, important_details):\n"
            "- Use null for any of these fields that is not explicitly stated in the "
            "transcript. Do not guess or invent names, phone numbers, companies, or "
            "any other detail.\n"
            "- If a name is spelled out letter-by-letter (e.g. \"P-E-R-C-I\"), treat "
            "those letters as confirming the name spoken nearby - read them as one "
            "name, not as separate words or unrelated letters.\n"
            "- important_details is a list of short strings for any other notable "
            "facts mentioned; leave it as an empty list if there are none.\n\n"
            "Rules for summary/assessment fields (call_summary, call_outcome, "
            "sentiment):\n"
            "- These are not quotes - generate them yourself from the conversation, "
            "the same way you would write a short summary of any call. Do not leave "
            "them null just because the transcript doesn't contain those exact words.\n"
            "- call_summary: one short sentence describing what the call was about.\n"
            "- call_outcome: your best short label for how the call concluded or what "
            "happens next (e.g. \"Follow-up needed\", \"Resolved\", \"No action "
            "needed\"). Phrases like \"get back to me\", \"let me know\", or \"call me "
            "back\" signal a follow-up is needed.\n"
            "- sentiment: the caller's overall tone (e.g. \"Positive\", \"Neutral\", "
            "\"Frustrated\").\n"
            "- Only leave a summary/assessment field null if the transcript is too "
            "short or unclear to make any reasonable assessment.\n\n"
            f"Transcript:\n{transcript.strip()}"
        )
        messages = [
            {"role": "system", "content": "You are an AI assistant that extracts CRM data from call transcripts and replies with strict JSON only. You never fabricate information that is not present in the transcript."},
            {"role": "user", "content": prompt},
        ]

        raw = self._chat(messages, max_tokens=500, temperature=0.2)
        try:
            return self._parse_crm_response(raw)
        except ValueError:
            messages.append({"role": "assistant", "content": raw})
            messages.append({"role": "user", "content": "That was not valid JSON. Reply again with ONLY the JSON object, nothing else."})
            raw_retry = self._chat(messages, max_tokens=500, temperature=0.1)
            return self._parse_crm_response(raw_retry)
