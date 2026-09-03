from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()

class Meeting(Base):
    __tablename__ = "meetings"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    action_items = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    duration = Column(Integer, nullable=True)  # in seconds
    crm_extraction = Column(Text, nullable=True)  # JSON-encoded auto-extracted CRM fields, pending review
    crm_extraction_status = Column(String(20), nullable=True)  # "ready" | "failed" | None (not attempted)

    def __repr__(self):
        return f"<Meeting(id={self.id}, title='{self.title}', created_at='{self.created_at}')>"


class CallRecord(Base):
    __tablename__ = "call_records"

    id = Column(Integer, primary_key=True, index=True)
    # unique=True: one Meeting can have at most one CallRecord - enforced at
    # the DB level so a retried/concurrent save can never create a duplicate,
    # not just discouraged client-side.
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False, unique=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    phone_number = Column(String(50), nullable=True)
    company = Column(String(255), nullable=True)
    reason_for_call = Column(Text, nullable=True)
    call_summary = Column(Text, nullable=True)
    next_action = Column(Text, nullable=True)
    call_outcome = Column(String(255), nullable=True)
    sentiment = Column(String(50), nullable=True)
    important_details = Column(Text, nullable=True)  # JSON-encoded
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<CallRecord(id={self.id}, meeting_id={self.meeting_id}, created_at='{self.created_at}')>"


# Database setup - ensure path is relative to project root
# Get the project root directory (parent of backend directory)
try:
    # Get the absolute path of this file, then go up one level to project root
    current_file = Path(__file__).resolve()
    project_root = current_file.parent.parent
except NameError:
    # Fallback if __file__ is not available
    project_root = Path.cwd().parent if Path.cwd().name == "backend" else Path.cwd()

data_dir = project_root / "data"
data_dir.mkdir(exist_ok=True)  # Create data directory if it doesn't exist

# Database file path - convert to string with forward slashes for SQLite
db_path = data_dir / "meetings.db"
# Use forward slashes for SQLite URL (works on both Windows and Unix)
db_path_str = str(db_path.absolute()).replace("\\", "/")

# Always use absolute path - ignore environment variable to force absolute path
# This ensures the database path is always absolute regardless of where the script is run from
DATABASE_URL = f"sqlite:///{db_path_str}"

# Debug: print database path (can be removed in production)
print(f"Database path: {db_path_str}")
print(f"Database URL: {DATABASE_URL}")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initialize the database"""
    _enable_wal_mode()
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()
    _add_missing_constraints()

def _enable_wal_mode():
    """WAL mode lets readers and writers work concurrently instead of the
    default rollback-journal mode, which locks the whole file on any write.
    Safe here because the db is a local file (not network-mounted) accessed
    from a single process. A no-op if already enabled - safe to run every
    startup."""
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        conn.commit()

def _add_missing_columns():
    """Lightweight ad hoc migration: create_all only creates missing tables, not
    missing columns on tables that already exist. Add any new Meeting columns
    to an existing meetings.db so older databases pick them up."""
    with engine.connect() as conn:
        existing_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(meetings)"))}
        if "crm_extraction" not in existing_columns:
            conn.execute(text("ALTER TABLE meetings ADD COLUMN crm_extraction TEXT"))
        if "crm_extraction_status" not in existing_columns:
            conn.execute(text("ALTER TABLE meetings ADD COLUMN crm_extraction_status VARCHAR(20)"))
        conn.commit()

def _add_missing_constraints():
    """Same idea as _add_missing_columns, for constraints: create_all() only
    applies unique=True to tables it creates fresh, not existing ones. A
    unique index enforces the same guarantee as a unique constraint in
    SQLite. Skipped (with a loud warning, not a crash) if the existing data
    already has duplicate meeting_ids - that data issue needs a human to
    look at it, not a startup failure that takes down the whole app."""
    with engine.connect() as conn:
        existing_indexes = {row[1] for row in conn.execute(text("PRAGMA index_list(call_records)"))}
        if "ux_call_records_meeting_id" in existing_indexes:
            return
        try:
            conn.execute(text(
                "CREATE UNIQUE INDEX ux_call_records_meeting_id ON call_records(meeting_id)"
            ))
            conn.commit()
        except Exception as e:
            print(
                f"WARNING: could not add unique index on call_records.meeting_id "
                f"(likely existing duplicate meeting_ids need manual cleanup first): {e}"
            )

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
