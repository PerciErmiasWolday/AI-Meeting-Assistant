from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
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

# Factual/identifying fields - if extraction found none of these, there's
# nothing worth turning into a CRM contact (e.g. silence, noise, unclear
# audio). The synthesized fields (call_summary, call_outcome, sentiment)
# don't count on their own since the model can generate those from almost
# any input.
CRM_FACTUAL_FIELDS = ["first_name", "last_name", "phone_number", "company", "reason_for_call"]


def _has_meaningful_crm_data(data: dict) -> bool:
    if any((data.get(f) or "").strip() for f in CRM_FACTUAL_FIELDS):
        return True
    return bool(data.get("important_details"))


def ensure_call_record(db: Session, meeting_id: int, data: Optional[dict] = None) -> Optional[CallRecord]:
    """
    Idempotently ensure a CallRecord exists for a meeting. Single shared path
    used by the upload auto-save, the manual save-crm endpoint, and backfill -
    so there is exactly one place that decides what "create a CallRecord"
    means, instead of that logic drifting across call sites.

    - If a CallRecord already exists for this meeting, return it as-is. This
      is create-if-missing, never an upsert/overwrite.
    - `data` lets a caller pass fields explicitly (e.g. a user-edited
      submission from the CRM Extraction tab); if omitted, falls back to the
      meeting's own stored crm_extraction.
    - Returns None (creates nothing) if there's no data to work with, or the
      data has no meaningful identifying content - see _has_meaningful_crm_data.
    - Safe under a race (e.g. two requests for the same meeting_id arriving
      concurrently): the DB-level unique constraint on meeting_id means at
      most one insert can win; the loser's IntegrityError is caught here and
      it re-fetches and returns the winner's row instead of erroring.
    """
    existing = db.query(CallRecord).filter(CallRecord.meeting_id == meeting_id).first()
    if existing:
        return existing

    if data is None:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting or not meeting.crm_extraction:
            return None
        data = json.loads(meeting.crm_extraction)

    if not _has_meaningful_crm_data(data):
        return None

    call_record = CallRecord(
        meeting_id=meeting_id,
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        phone_number=data.get("phone_number"),
        company=data.get("company"),
        reason_for_call=data.get("reason_for_call"),
        call_summary=data.get("call_summary"),
        next_action=data.get("next_action"),
        call_outcome=data.get("call_outcome"),
        sentiment=data.get("sentiment"),
        important_details=json.dumps(data.get("important_details") or []),
        created_at=datetime.utcnow(),
    )

    try:
        db.add(call_record)
        db.commit()
        db.refresh(call_record)
        return call_record
    except IntegrityError:
        # Lost a race to a concurrent insert for the same meeting_id - not a
        # real failure, just recover the winner's row.
        db.rollback()
        return db.query(CallRecord).filter(CallRecord.meeting_id == meeting_id).first()

# Initialize FastAPI app
app = FastAPI(
    title="AI Meeting Summarizer API",
    description="Upload meeting audio and get AI-powered summaries and action items",
    version="1.0.0"
)

# CORS middleware - restrict to the frontend origin(s), configurable via env.
# Defaults to the local Vite dev server since that's how this app is normally run.
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
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

        # Auto-extract CRM data as part of the same pipeline. If it fails, that
        # must not block the upload from completing; the call just falls back
        # to needing extraction retried manually.
        print("Starting CRM extraction...")
        crm_extraction_data = None
        crm_extraction_status = None
        try:
            crm_extraction_data = extraction_service.extract_crm_data(transcript)
            crm_extraction_status = "ready"
            print("CRM extraction complete!")
        except Exception as e:
            crm_extraction_status = "failed"
            print(f"CRM auto-extraction failed (can be retried manually): {e}")

        # Save to database
        meeting = Meeting(
            title=title or f"Meeting {timestamp}",
            filename=filename,
            transcript=transcript,
            summary=summary_result["summary"],
            action_items=summary_result["action_items"],
            duration=duration,
            created_at=datetime.utcnow(),
            crm_extraction=json.dumps(crm_extraction_data) if crm_extraction_data else None,
            crm_extraction_status=crm_extraction_status,
        )

        db.add(meeting)
        db.commit()
        db.refresh(meeting)

        # Auto-save the extraction straight to the CRM via the same idempotent
        # helper used everywhere else a CallRecord gets created - no manual
        # "Save to CRM" click required. The meeting (and its transcript) was
        # already committed above, so if this specific step fails, nothing
        # uploaded is lost: the draft stays on the meeting and this can be
        # retried later (manually, or via backfill) without redoing
        # transcription/summarization.
        if crm_extraction_status == "ready":
            try:
                ensure_call_record(db, meeting.id)
                print("Auto-saved extraction to CRM!")
            except Exception as e:
                db.rollback()
                print(f"Auto-save to CRM failed (can be retried manually or via backfill): {e}")

        return {
            "id": meeting.id,
            "title": meeting.title,
            "transcript": transcript,
            "summary": summary_result["summary"],
            "action_items": summary_result["action_items"],
            "duration": meeting.duration,
            "created_at": meeting.created_at.isoformat(),
            "crm_extraction": crm_extraction_data,
            "crm_extraction_status": crm_extraction_status,
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
            "has_summary": bool(m.summary),
            "crm_extraction": json.loads(m.crm_extraction) if m.crm_extraction else None,
            "crm_extraction_status": m.crm_extraction_status
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
        "created_at": meeting.created_at.isoformat(),
        "crm_extraction": json.loads(meeting.crm_extraction) if meeting.crm_extraction else None,
        "crm_extraction_status": meeting.crm_extraction_status
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

def serialize_call_record(record: CallRecord) -> dict:
    return {
        "id": record.id,
        "meeting_id": record.meeting_id,
        "first_name": record.first_name,
        "last_name": record.last_name,
        "phone_number": record.phone_number,
        "company": record.company,
        "reason_for_call": record.reason_for_call,
        "call_summary": record.call_summary,
        "next_action": record.next_action,
        "call_outcome": record.call_outcome,
        "sentiment": record.sentiment,
        "important_details": json.loads(record.important_details) if record.important_details else [],
        "created_at": record.created_at.isoformat()
    }

def search_call_records(db: Session, question: str, limit: int = 5) -> List[CallRecord]:
    """Keyword search over reason_for_call, call_summary, important_details,
    caller name, and company, using SQL LIKE - no vector DB. Results are ranked
    by keyword match count, with a large boost for a full "first last" name
    match so person lookups ("what did Jane Doe say?") reliably surface the
    right contact instead of just whichever record happens to contain any one
    of the words in the question somewhere in its text."""
    q_lower = question.lower()
    words = re.findall(r"[a-z0-9']+", q_lower)
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
        filters.append(CallRecord.first_name.ilike(pattern))
        filters.append(CallRecord.last_name.ilike(pattern))
        filters.append(CallRecord.company.ilike(pattern))

    matches = set(db.query(CallRecord).filter(or_(*filters)).all())

    # Full-name match: a name is two tokens that both need to match the same
    # record, which the per-keyword OR above can't express - "Jane" and "Doe"
    # matching two different unrelated records is not the same as one record
    # matching "Jane Doe". Scanning every named record for a literal
    # "first last" substring in the question catches that reliably, and is
    # cheap at this app's scale (dozens of contacts, not millions).
    named_records = db.query(CallRecord).filter(
        CallRecord.first_name.isnot(None), CallRecord.last_name.isnot(None)
    ).all()
    full_name_matches = set()
    for record in named_records:
        full_name = f"{record.first_name} {record.last_name}".lower()
        if full_name in q_lower:
            full_name_matches.add(record)

    if full_name_matches:
        # The question names a specific person - answer from their record(s)
        # only. Otherwise a record that only matched on a generic word (e.g.
        # "company", "from") gets pulled into the same context and creates
        # false ambiguity about whose data is actually being asked about.
        matches = full_name_matches
    else:
        matches |= full_name_matches

    def match_score(record: CallRecord) -> int:
        haystack = " ".join(filter(None, [
            record.reason_for_call, record.call_summary, record.important_details,
            record.first_name, record.last_name, record.company,
        ])).lower()
        score = sum(haystack.count(word) for word in keywords)
        if record in full_name_matches:
            score += 10
        return score

    ranked = sorted(matches, key=match_score, reverse=True)
    return ranked[:limit]

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

def search_meetings_without_call_record(db: Session, question: str, limit: int = 5) -> List[Meeting]:
    """Fallback search over Meetings that have no CallRecord yet - so a call
    isn't completely invisible to Ask AI just because it hasn't been reviewed
    and saved to the CRM. Only called when search_call_records finds nothing,
    never mixed into the same result set.

    Searches title, summary, and transcript. Title matters specifically
    because a Whisper mis-transcription inside the transcript (e.g. a name
    heard wrong) doesn't affect a title the uploader typed themselves - so a
    meeting titled "Perci Wolday" is still findable by that name even if the
    transcript says something else."""
    q_lower = question.lower()
    words = re.findall(r"[a-z0-9']+", q_lower)
    keywords = {w for w in words if len(w) >= 3} - _CRM_STOPWORDS
    if not keywords:
        return []

    filters = []
    for word in keywords:
        pattern = f"%{word}%"
        filters.append(Meeting.title.ilike(pattern))
        filters.append(Meeting.summary.ilike(pattern))
        filters.append(Meeting.transcript.ilike(pattern))

    has_no_call_record = ~Meeting.id.in_(db.query(CallRecord.meeting_id))
    matches = db.query(Meeting).filter(has_no_call_record, or_(*filters)).all()

    def match_score(meeting: Meeting) -> int:
        haystack = " ".join(filter(None, [meeting.title, meeting.summary, meeting.transcript])).lower()
        score = sum(haystack.count(word) for word in keywords)
        # Title matches count extra - a title is something the uploader
        # actually typed, so it's a more reliable identity signal than
        # anything Whisper may have mis-heard inside the transcript.
        if meeting.title and any(word in meeting.title.lower() for word in keywords):
            score += 5
        return score

    matches.sort(key=match_score, reverse=True)
    return matches[:limit]

def build_meeting_fallback_context(meetings: List[Meeting]) -> str:
    """Build context from raw, unreviewed Meetings - explicitly labeled as
    such so the model (and, via the caller, the user) doesn't treat this the
    same as confirmed CRM data."""
    blocks = []
    budget = CRM_CONTEXT_BUDGET

    for meeting in meetings:
        lines = [
            "=== UNREVIEWED CALL (no confirmed CRM record - raw transcript, not yet reviewed) ===",
            f"Meeting #{meeting.id}: {meeting.title}",
            f"Date: {meeting.created_at.isoformat()}",
            f"Summary: {meeting.summary or 'not available'}",
            f"Transcript excerpt: {(meeting.transcript or '')[:2000]}",
            "=== END UNREVIEWED CALL ===",
        ]
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
    """Save a (possibly user-edited) CRM extraction as a CallRecord linked to the
    meeting. Goes through the same ensure_call_record() used by upload
    auto-save and backfill - if a CallRecord already exists for this meeting
    (e.g. auto-save already created one), this returns that existing record
    instead of creating a duplicate."""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    try:
        call_record = ensure_call_record(db, meeting_id, data=request.model_dump())
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save CRM data: {e}")

    if call_record is None:
        raise HTTPException(
            status_code=400,
            detail="Nothing meaningful to save - fill in at least one field (name, phone, company, or reason for call)"
        )

    return serialize_call_record(call_record)

@app.get("/api/crm/records")
async def get_crm_records(db: Session = Depends(get_db)):
    """List all saved CallRecords, most recent first."""
    records = db.query(CallRecord).order_by(CallRecord.created_at.desc()).all()
    return [serialize_call_record(r) for r in records]

@app.get("/api/crm/records/{record_id}")
async def get_crm_record(record_id: int, db: Session = Depends(get_db)):
    """Get a single CallRecord, including duration/date of its linked meeting."""
    record = db.query(CallRecord).filter(CallRecord.id == record_id).first()

    if not record:
        raise HTTPException(status_code=404, detail="CRM record not found")

    data = serialize_call_record(record)

    meeting = db.query(Meeting).filter(Meeting.id == record.meeting_id).first()
    data["meeting_created_at"] = meeting.created_at.isoformat() if meeting else None
    data["meeting_duration"] = meeting.duration if meeting else None

    return data

@app.delete("/api/crm/records/{record_id}")
async def delete_crm_record(record_id: int, db: Session = Depends(get_db)):
    """Delete a saved CallRecord. Does not touch the linked meeting."""
    record = db.query(CallRecord).filter(CallRecord.id == record_id).first()

    if not record:
        raise HTTPException(status_code=404, detail="CRM record not found")

    db.delete(record)
    db.commit()

    return {"message": "CRM record deleted successfully"}

def _backfill_skip_reason(meeting: Meeting) -> Optional[str]:
    """Why ensure_call_record() would create nothing for this meeting, or
    None if it would actually create a record. Shared by the backfill
    preview and the real run so the two can't drift out of sync with each
    other over time."""
    if meeting.crm_extraction_status == "ready" and meeting.crm_extraction:
        data = json.loads(meeting.crm_extraction)
        return None if _has_meaningful_crm_data(data) else "no_meaningful_data"
    if meeting.crm_extraction_status == "failed":
        return "extraction_failed"
    return "never_extracted"

@app.get("/api/crm/backfill/candidates")
async def get_backfill_candidates(db: Session = Depends(get_db)):
    """List Meetings with no CallRecord yet, without changing anything - so
    what backfill would do can be reviewed before running it. One-shot/
    on-demand by design (no scheduler): call this, look at the list, then
    call POST /api/crm/backfill if it looks right."""
    orphans = db.query(Meeting).filter(
        ~Meeting.id.in_(db.query(CallRecord.meeting_id))
    ).order_by(Meeting.id).all()

    candidates = []
    for m in orphans:
        skip_reason = _backfill_skip_reason(m)
        outcome = "will_create" if skip_reason is None else f"will_skip_{skip_reason}"
        candidates.append({
            "meeting_id": m.id,
            "title": m.title,
            "crm_extraction_status": m.crm_extraction_status,
            "predicted_outcome": outcome,
        })

    return {"count": len(candidates), "candidates": candidates}

@app.post("/api/crm/backfill")
async def run_backfill(db: Session = Depends(get_db)):
    """Run ensure_call_record() over every Meeting that has no CallRecord yet.
    Same function as upload auto-save and manual save - never overwrites an
    existing CallRecord (ensure_call_record is create-if-missing), never
    creates a duplicate (unique constraint + idempotent check), and never
    creates a record from a meeting with no usable extracted data."""
    orphans = db.query(Meeting).filter(
        ~Meeting.id.in_(db.query(CallRecord.meeting_id))
    ).order_by(Meeting.id).all()

    created, skipped = [], []
    for m in orphans:
        record = ensure_call_record(db, m.id)
        if record:
            created.append({"meeting_id": m.id, "call_record_id": record.id})
        else:
            skipped.append({"meeting_id": m.id, "reason": _backfill_skip_reason(m)})

    return {"created": created, "skipped": skipped}

@app.post("/api/crm/ask")
async def ask_crm(request: CrmAskRequest, db: Session = Depends(get_db)):
    """Answer a natural-language question. Tries reviewed CallRecords first,
    exactly as before. Only when that finds nothing does it fall back to
    unreviewed Meeting transcripts, so an uploaded call is never completely
    invisible just because it hasn't been saved to the CRM yet - but the two
    kinds of results are never blended into one response."""
    matches = search_call_records(db, request.question)

    if matches:
        context = build_crm_context(db, matches)
        try:
            answer = summarization_service.answer_crm_question(context, request.question)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to get an answer: {e}")

        return {
            "question": request.question,
            "answer": answer,
            "matched_call_ids": [record.id for record in matches],
            "matched_meeting_ids": [],
            "source": "crm",
        }

    meeting_matches = search_meetings_without_call_record(db, request.question)

    if not meeting_matches:
        return {
            "question": request.question,
            "answer": "No matching call records found.",
            "matched_call_ids": [],
            "matched_meeting_ids": [],
            "source": "none",
        }

    context = build_meeting_fallback_context(meeting_matches)
    try:
        answer = summarization_service.answer_crm_question(context, request.question)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to get an answer: {e}")

    return {
        "question": request.question,
        "answer": f"[From an unreviewed call, not yet confirmed in the CRM] {answer}",
        "matched_call_ids": [],
        "matched_meeting_ids": [m.id for m in meeting_matches],
        "source": "meeting_fallback",
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
