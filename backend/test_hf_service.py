import sys
import os
import json

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.summarization import SummarizationService
from backend.extraction import ExtractionService

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

def test_extraction():
    print("\nTesting CRM Extraction...")
    service = ExtractionService()

    # Real transcript from an existing test meeting (id=7 in data/meetings.db) -
    # a staff meeting, not a sales call, so it's a good check that fields with
    # no real value (phone_number, company) come back null instead of invented.
    transcript = """
    Hello everyone, thank you guys for coming to our weekly student success meeting.
    And let's just get started. So I have our list of chronically absent students
    here and I've been noticing a troubling trend. A lot of students are skipping
    on Fridays. Does anyone have any idea what's going on? I've heard some of my
    mentees talking about how it's really hard to get out of bed on Fridays. It
    might be good if we did something like a pancake breakfast to encourage them
    to come. I think that's a great idea. Let's try that next week. It might also
    be because a lot of students have been getting sick now that it's getting
    colder outside. I've had a number of students come by my office with symptoms
    like sniffling and coughing. We should put up posters with tips for not
    getting sick since it's almost flu season. Like, you know, wash your hands
    after the bathroom. Stuff like that. I think that's a good idea and it'll be
    a good reminder for the teachers as well. One other thing I wanted to talk
    about, there's a student I've noticed here, John Smith. He's missed seven days
    already and it's only November. Does anyone have an idea what's going on with
    him? I might be able to fill in the gaps there. I talked to John today and
    he's really stressed out. He's been dealing with helping his parents take
    care of his younger siblings during the day. It might actually be a good idea
    if he spoke to the guidance counselor a little bit. I can talk to John today
    if you want to send him to my office after you meet with him. It's a lot to
    deal with for middle schooler. Great thanks and I can help out with the
    family's childcare needs. I'll look for some free or low-cost resources in
    the community to share with John and he can share them with his family.
    Great, awesome, really good ideas here today. Thanks for coming and if no one
    has anything else I think we can wrap up.
    """

    try:
        result = service.extract_crm_data(transcript)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if not os.getenv("HF_TOKEN"):
        print("Please set HF_TOKEN in your environment variables or .env file.")
        sys.exit(1)

    test_summarization()
    test_qa()
    test_extraction()
