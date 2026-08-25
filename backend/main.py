from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
import os
import json
import re
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Optional
import uvicorn
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pydantic import BaseModel

from database import init_db, get_db, Meeting, CallRecord
from transcription import TranscriptionService
from summarization import SummarizationService
from extraction import ExtractionService

# Keyword search over CallRecord text fields - same stopword/budget approach as
# SummarizationService._select_context, just applied to CRM records instead of
# transcript chunks.
CRM_CONTEXT_BUDGET = 12000
_CRM_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "and", "or", "to", "of",
    "in", "on", "at", "for", "with", "what", "who", "when", "where", "why",
    "how", "did", "do", "does", "it", "this", "that", "be", "will",
}

# Initialize FastAPI app
app = FastAPI(
    title="AI Meeting Summarizer API",
    description="Upload meeting audio and get AI-powered summaries and action items",
    version="1.0.0"
)

# CORS middleware - restrict to the frontend origin(s), configurable via env.
# Defaults to the local Streamlit dev server since that's how this app is normally run.
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:8501,http://127.0.0.1:8501").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
transcription_service = TranscriptionService(model_name="base")
summarization_service = SummarizationService()
extraction_service = ExtractionService()

# Ensure upload directory exists - relative to project root
project_root = Path(__file__).parent.parent
UPLOAD_DIR = project_root / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    init_db()
    print("Database initialized!")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "AI Meeting Summarizer API is running!", "status": "healthy"}

@app.post("/api/upload")
async def upload_audio(
    file: UploadFile = File(...),
    title: str = None,
    db: Session = Depends(get_db)
):
    """
    Upload audio file, transcribe, and summarize
    """
    try:
        # Validate file type
        allowed_extensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.mp4']
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{file.filename}"
        file_path = UPLOAD_DIR / filename
        
        # Save uploaded file
        with open(str(file_path), "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"File saved: {file_path}")
        
        # Transcribe audio
        print("Starting transcription...")
        transcription_result = transcription_service.transcribe_audio(str(file_path))
        transcript = transcription_result["text"]

        if not transcript.strip():
            raise HTTPException(status_code=400, detail="No speech detected in the uploaded file")

        print("Transcription complete!")

        duration = transcription_service.get_duration(str(file_path))

        # Summarize transcript
        print("Starting summarization...")
        summary_result = summarization_service.summarize_transcript(transcript)

        print("Summarization complete!")

        # Save to database
        meeting = Meeting(
            title=title or f"Meeting {timestamp}",
            filename=filename,
            transcript=transcript,
            summary=summary_result["summary"],
            action_items=summary_result["action_items"],
            duration=duration,
            created_at=datetime.utcnow()
        )

        db.add(meeting)
        db.commit()
        db.refresh(meeting)

        return {
            "id": meeting.id,
            "title": meeting.title,
            "transcript": transcript,
            "summary": summary_result["summary"],
            "action_items": summary_result["action_items"],
            "duration": meeting.duration,
            "created_at": meeting.created_at.isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/meetings")
async def get_meetings(db: Session = Depends(get_db)):
    """Get all meetings"""
    meetings = db.query(Meeting).order_by(Meeting.created_at.desc()).all()
    
    return [
        {
            "id": m.id,
            "title": m.title,
            "created_at": m.created_at.isoformat(),
            "has_summary": bool(m.summary)
        }
        for m in meetings
    ]

@app.get("/api/meetings/{meeting_id}")
async def get_meeting(meeting_id: int, db: Session = Depends(get_db)):
    """Get specific meeting details"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    return {
        "id": meeting.id,
        "title": meeting.title,
        "filename": meeting.filename,
        "transcript": meeting.transcript,
        "summary": meeting.summary,
        "action_items": meeting.action_items,
        "duration": meeting.duration,
        "created_at": meeting.created_at.isoformat()
    }

@app.delete("/api/meetings/{meeting_id}")
async def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    """Delete a meeting"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Delete audio file
    file_path = UPLOAD_DIR / meeting.filename
    if file_path.exists():
        file_path.unlink()
    
    db.delete(meeting)
    db.commit()
    
    return {"message": "Meeting deleted successfully"}

class EmailRequest(BaseModel):
    meeting_id: int
    recipient_email: str

class AskQuestionRequest(BaseModel):
    meeting_id: int
    question: str

class CrmSaveRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    company: Optional[str] = None
    reason_for_call: Optional[str] = None
    call_summary: Optional[str] = None
    next_action: Optional[str] = None
    call_outcome: Optional[str] = None
    sentiment: Optional[str] = None
    important_details: Optional[List[str]] = None

class CrmAskRequest(BaseModel):
    question: str

def search_call_records(db: Session, question: str, limit: int = 5) -> List[CallRecord]:
    """Keyword search over reason_for_call, call_summary, and important_details
    using SQL LIKE - no vector DB. Results are ranked by keyword match count."""
    words = re.findall(r"[a-z0-9']+", question.lower())
    # Require 3+ characters - short words cause noisy false-positive substring
    # matches under LIKE (e.g. "me" matching inside "appointments", "volume").
    keywords = {w for w in words if len(w) >= 3} - _CRM_STOPWORDS
    if not keywords:
        return []

    filters = []
    for word in keywords:
        pattern = f"%{word}%"
        filters.append(CallRecord.reason_for_call.ilike(pattern))
        filters.append(CallRecord.call_summary.ilike(pattern))
        filters.append(CallRecord.important_details.ilike(pattern))

    matches = db.query(CallRecord).filter(or_(*filters)).all()

    def match_score(record: CallRecord) -> int:
        haystack = " ".join(filter(None, [
            record.reason_for_call, record.call_summary, record.important_details
        ])).lower()
        return sum(haystack.count(word) for word in keywords)

    matches.sort(key=match_score, reverse=True)
    return matches[:limit]

def build_crm_context(db: Session, records: List[CallRecord]) -> str:
    """Build a compact context string from matched CallRecords. Only pulls in a
    record's linked meeting transcript when the record has no call_summary of
    its own to answer from."""
    blocks = []
    budget = CRM_CONTEXT_BUDGET

    for record in records:
        details = ", ".join(json.loads(record.important_details)) if record.important_details else "none"
        caller = " ".join(filter(None, [record.first_name, record.last_name])) or "unknown"
        lines = [
            f"Call record #{record.id} (meeting {record.meeting_id}):",
            f"Caller: {caller}",
            f"Company: {record.company or 'unknown'}",
            f"Reason for call: {record.reason_for_call or 'not recorded'}",
            f"Summary: {record.call_summary or 'not recorded'}",
            f"Next action: {record.next_action or 'not recorded'}",
            f"Outcome: {record.call_outcome or 'not recorded'}",
            f"Sentiment: {record.sentiment or 'not recorded'}",
            f"Important details: {details}",
        ]

        if not record.call_summary:
            meeting = db.query(Meeting).filter(Meeting.id == record.meeting_id).first()
            if meeting and meeting.transcript:
                lines.append(f"Linked transcript (no summary recorded): {meeting.transcript[:2000]}")

        block = "\n".join(lines)
        if len(block) > budget:
            break
        blocks.append(block)
        budget -= len(block)

    return "\n\n".join(blocks)

@app.post("/api/ask")
async def ask_question(
    request: AskQuestionRequest,
    db: Session = Depends(get_db)
):
    """Ask a question about a specific meeting"""
    meeting = db.query(Meeting).filter(Meeting.id == request.meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    if not meeting.transcript:
        raise HTTPException(status_code=400, detail="No transcript available")

    try:
        answer = summarization_service.answer_question(meeting.transcript, request.question)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to get an answer: {e}")

    return {"question": request.question, "answer": answer}

@app.post("/api/meetings/{meeting_id}/extract-crm")
async def extract_crm(meeting_id: int, db: Session = Depends(get_db)):
    """Extract structured CRM data from a meeting's transcript. Does not save it."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if not meeting.transcript:
        raise HTTPException(status_code=400, detail="No transcript available")

    try:
        return extraction_service.extract_crm_data(meeting.transcript)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to extract CRM data: {e}")

@app.post("/api/meetings/{meeting_id}/save-crm")
async def save_crm(
    meeting_id: int,
    request: CrmSaveRequest,
    db: Session = Depends(get_db)
):
    """Save a (possibly user-edited) CRM extraction as a CallRecord linked to the meeting."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    call_record = CallRecord(
        meeting_id=meeting.id,
        first_name=request.first_name,
        last_name=request.last_name,
        phone_number=request.phone_number,
        company=request.company,
        reason_for_call=request.reason_for_call,
        call_summary=request.call_summary,
        next_action=request.next_action,
        call_outcome=request.call_outcome,
        sentiment=request.sentiment,
        important_details=json.dumps(request.important_details or []),
        created_at=datetime.utcnow()
    )

    try:
        db.add(call_record)
        db.commit()
        db.refresh(call_record)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save CRM data: {e}")

    return {
        "id": call_record.id,
        "meeting_id": call_record.meeting_id,
        "first_name": call_record.first_name,
        "last_name": call_record.last_name,
        "phone_number": call_record.phone_number,
        "company": call_record.company,
        "reason_for_call": call_record.reason_for_call,
        "call_summary": call_record.call_summary,
        "next_action": call_record.next_action,
        "call_outcome": call_record.call_outcome,
        "sentiment": call_record.sentiment,
        "important_details": json.loads(call_record.important_details),
        "created_at": call_record.created_at.isoformat()
    }

@app.post("/api/crm/ask")
async def ask_crm(request: CrmAskRequest, db: Session = Depends(get_db)):
    """Answer a natural-language question by keyword-searching CallRecords and
    sending only the matched records (plus transcripts where needed) to the model."""
    matches = search_call_records(db, request.question)

    if not matches:
        return {"question": request.question, "answer": "No matching call records found.", "matched_call_ids": []}

    context = build_crm_context(db, matches)

    try:
        answer = summarization_service.answer_question(context, request.question)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to get an answer: {e}")

    return {
        "question": request.question,
        "answer": answer,
        "matched_call_ids": [record.id for record in matches]
    }

@app.post("/api/email")
async def send_email_summary(
    request: EmailRequest,
    db: Session = Depends(get_db)
):
    """Send meeting summary via email"""
    meeting = db.query(Meeting).filter(Meeting.id == request.meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    # Get SMTP settings from environment
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT", "587")
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    sender_email = os.getenv("SENDER_EMAIL", smtp_user)
    
    if not all([smtp_server, smtp_user, smtp_password]):
        raise HTTPException(
            status_code=500, 
            detail="SMTP configuration is missing. Please set SMTP_SERVER, SMTP_USER, and SMTP_PASSWORD in .env"
        )
        
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = request.recipient_email
        msg['Subject'] = f"Meeting Summary: {meeting.title}"
        
        body = f"""
Meeting: {meeting.title}
Date: {meeting.created_at.strftime('%Y-%m-%d %H:%M')}

SUMMARY:
{meeting.summary}

ACTION ITEMS:
{meeting.action_items}

---
Sent via AI Meeting Summarizer
"""
        msg.attach(MIMEText(body, 'plain'))
        
        # Connect and send
        with smtplib.SMTP(smtp_server, int(smtp_port)) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
            
        return {"message": f"Email sent successfully to {request.recipient_email}"}
        
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=True,
    )
