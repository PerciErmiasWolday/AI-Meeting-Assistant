from sqlalchemy import Column, Integer, String, Text, DateTime, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os
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
    
    def __repr__(self):
        return f"<Meeting(id={self.id}, title='{self.title}', created_at='{self.created_at}')>"


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
    Base.metadata.create_all(bind=engine)

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
