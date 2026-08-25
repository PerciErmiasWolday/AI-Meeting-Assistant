from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import os
import shutil
from pathlib import Path
from datetime import datetime
from typing import List
import uvicorn
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pydantic import BaseModel

from database import init_db, get_db, Meeting
from transcription import TranscriptionService
from summarization import SummarizationService

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
