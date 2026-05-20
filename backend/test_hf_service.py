import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.summarization import SummarizationService

def test_summarization():
    print("Testing Summarization...")
    service = SummarizationService()
    
    transcript = """
    John: Let's discuss the new budget.
    Sarah: Yes, we need to allocate $5000 for marketing.
    John: I'll talk to the finance team about that.
    Sarah: Great, and I'll start the campaign research.
    """
    
    try:
        result = service.summarize_transcript(transcript)
        print("\nSUMMARY:")
        print(result['summary'])
        print("\nACTION ITEMS:")
        print(result['action_items'])
    except Exception as e:
        print(f"Error: {e}")

def test_qa():
    print("\nTesting Q&A...")
    service = SummarizationService()
    
    transcript = """
    John: Let's discuss the new budget.
    Sarah: Yes, we need to allocate $5000 for marketing.
    John: I'll talk to the finance team about that.
    Sarah: Great, and I'll start the campaign research.
    """
    
    question = "How much money is allocated for marketing?"
    
    try:
        answer = service.answer_question(transcript, question)
        print(f"\nQuestion: {question}")
        print(f"Answer: {answer}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if not os.getenv("HF_TOKEN"):
        print("Please set HF_TOKEN in your environment variables or .env file.")
        sys.exit(1)
    
    test_summarization()
    test_qa()
