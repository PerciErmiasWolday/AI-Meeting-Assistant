from huggingface_hub import InferenceClient
import os
from dotenv import load_dotenv
from typing import Dict, List

load_dotenv()

class SummarizationService:
    def __init__(self):
        """Initialize Hugging Face Inference Client"""
        self.token = os.getenv("HF_TOKEN")
        self.model_id = os.getenv("HF_MODEL_ID", "mistralai/Mistral-7B-Instruct-v0.2")
        
        if not self.token:
            raise ValueError("HF_TOKEN not found in environment variables")
        
        self.client = InferenceClient(token=self.token)
        print(f"Hugging Face Client initialized with model: {self.model_id}")
    
    def summarize_transcript(self, transcript: str) -> Dict[str, str]:
        """
        Summarize meeting transcript and extract action items using Hugging Face
        
        Args:
            transcript: Full meeting transcript text
            
        Returns:
            dict with 'summary' and 'action_items'
        """
        messages = [
            {"role": "system", "content": "You are an AI assistant specialized in analyzing meeting transcripts."},
            {"role": "user", "content": f"Please analyze the following meeting transcript and provide:\n\n1. A concise summary of the key discussion points (3-5 bullet points)\n2. A list of action items with responsible parties if mentioned (bullet points)\n\nMeeting Transcript:\n{transcript}\n\nPlease format your response EXACTLY as follows:\n\nSUMMARY:\n- [Key point 1]\n- [Key point 2]\n- [Key point 3]\n\nACTION ITEMS:\n- [Action item 1]\n- [Action item 2]\n- [Action item 3]"}
        ]

        
        try:
            # Using chat_completion for 'conversational' task support
            response = self.client.chat_completion(
                messages=messages,
                model=self.model_id,
                max_tokens=500,
                temperature=0.7
            )
            
            result_text = response.choices[0].message.content

            
            # Parse the response
            summary = ""
            action_items = ""
            
            if "SUMMARY:" in result_text and "ACTION ITEMS:" in result_text:
                parts = result_text.split("ACTION ITEMS:")
                summary = parts[0].split("SUMMARY:")[1].strip()
                action_items = parts[1].strip()
            else:
                summary = result_text
                action_items = "No specific action items identified."
            
            return {
                "summary": summary,
                "action_items": action_items
            }
        
        except Exception as e:
            print(f"Error during summarization: {e}")
            return {
                "summary": "Error generating summary",
                "action_items": "Error extracting action items"
            }
    
    def answer_question(self, transcript: str, question: str) -> str:
        """
        Answer a question about the meeting transcript using Hugging Face
        
        Args:
            transcript: Full meeting transcript
            question: User's question
            
        Returns:
            Answer string
        """
        messages = [
            {"role": "system", "content": "You are a helpful assistant that answers questions about meeting transcripts."},
            {"role": "user", "content": f"Based on the following meeting transcript, please answer this question:\n\nQuestion: {question}\n\nMeeting Transcript:\n{transcript}\n\nPlease provide a clear and concise answer based only on the information in the transcript."}
        ]

        
        try:
            response = self.client.chat_completion(
                messages=messages,
                model=self.model_id,
                max_tokens=300,
                temperature=0.5
            )
            return response.choices[0].message.content

        except Exception as e:
            return f"Error answering question: {str(e)}"
