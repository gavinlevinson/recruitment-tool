from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, Float, LargeBinary
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from datetime import datetime
import os

# Use DATABASE_URL env var in production (PostgreSQL), fall back to SQLite locally
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./recruitment.db")

# Railway PostgreSQL URLs start with postgres:// — SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs check_same_thread=False; PostgreSQL does not
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Users & Auth ──────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    university = Column(String, nullable=True)
    graduation_year = Column(String, nullable=True)
    major = Column(String, nullable=True)
    minor = Column(String, nullable=True)
    high_school = Column(String, nullable=True)
    grad_school = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    # career_stage: college_senior | college_junior | college_sophomore | early_career | mid_career | senior
    career_stage = Column(String, default="college_senior")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Nylas Gmail integration
    nylas_grant_id = Column(String, nullable=True)   # set after OAuth callback


class UserProfile(Base):
    """Stores uploaded file paths and parsed resume data for each user."""
    __tablename__ = "user_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    # Uploaded file paths (relative to /uploads/{user_id}/)
    resume_filename = Column(String, nullable=True)
    resume_text = Column(Text, nullable=True)
    resume_data = Column(LargeBinary, nullable=True)        # file bytes stored in DB
    cover_letter_filename = Column(String, nullable=True)
    cover_letter_text = Column(Text, nullable=True)
    cover_letter_data = Column(LargeBinary, nullable=True)
    transcript_filename = Column(String, nullable=True)
    transcript_text = Column(Text, nullable=True)
    transcript_data = Column(LargeBinary, nullable=True)
    # Parsed / suggested data (JSON arrays stored as strings)
    parsed_skills = Column(Text, nullable=True)       # JSON list
    parsed_roles = Column(Text, nullable=True)        # JSON list
    parsed_locations = Column(Text, nullable=True)    # JSON list
    parsed_gpa = Column(String, nullable=True)
    parsed_school = Column(String, nullable=True)
    custom_context = Column(Text, nullable=True)    # user-typed career context / preferences
    context_roles = Column(Text, nullable=True)     # JSON — Claude-parsed from custom_context
    context_locations = Column(Text, nullable=True) # JSON — Claude-parsed from custom_context
    context_skills = Column(Text, nullable=True)    # JSON — Claude-parsed from custom_context
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CoverLetterTemplate(Base):
    __tablename__ = "cover_letter_templates"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    name = Column(String, nullable=False, default="My Template")
    content = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmailTemplate(Base):
    __tablename__ = "email_templates"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    name = Column(String, nullable=False, default="New Template")
    subject = Column(String, nullable=True)
    body = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Core data models ──────────────────────────────────────────────────────────

class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)   # NULL = legacy (Gavin)
    company = Column(String, index=True)
    role = Column(String)
    status = Column(String, default="Not Applied")
    date_applied = Column(String, nullable=True)
    salary_range = Column(String, nullable=True)
    location = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    job_url = Column(String, nullable=True)
    referral = Column(Boolean, default=False)
    referral_name = Column(String, nullable=True)
    source = Column(String, nullable=True)
    discovered_job_id = Column(Integer, nullable=True)
    folder = Column(String, nullable=True)
    starred = Column(Boolean, default=False)
    deadline = Column(String, nullable=True)       # application deadline date (YYYY-MM-DD)
    interview_date = Column(String, nullable=True) # scheduled interview date (YYYY-MM-DD)
    reminder_date = Column(String, nullable=True)  # user-set reminder date (YYYY-MM-DD)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Contact(Base):
    __tablename__ = "contacts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)   # NULL = legacy (Gavin)
    job_id = Column(Integer, nullable=True)
    company = Column(String, index=True)
    name = Column(String)
    title = Column(String, nullable=True)
    email = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    connection_type = Column(String, nullable=True)
    outreach_status = Column(String, default="Not Contacted")
    follow_up_1 = Column(Boolean, default=False)
    follow_up_2 = Column(Boolean, default=False)
    meeting_notes = Column(Text, nullable=True)
    school = Column(String, nullable=True)
    graduation_year = Column(String, nullable=True)
    tags = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DiscoveredJob(Base):
    """Global job pool — shared across all users, scored per-user dynamically."""
    __tablename__ = "discovered_jobs"
    id = Column(Integer, primary_key=True, index=True)
    company = Column(String)
    role = Column(String)
    location = Column(String, nullable=True)
    job_url = Column(String, nullable=True)
    source = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    salary_range = Column(String, nullable=True)
    posted_date = Column(String, nullable=True)
    match_score = Column(Float, nullable=True)
    match_reasons = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    added_to_tracker = Column(Boolean, default=False)
    funding_stage = Column(String, nullable=True)
    employee_count = Column(String, nullable=True)
    min_years_required = Column(Integer, nullable=True)   # parsed from description at scrape time
    deadline = Column(String, nullable=True)              # auto-extracted application deadline (YYYY-MM-DD)
    scraped_at = Column(DateTime, default=datetime.utcnow)
    verified_at = Column(DateTime, nullable=True)


class Recruiter(Base):
    __tablename__ = "recruiters"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)
    name = Column(String)
    agency = Column(String, nullable=True)
    email = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    specialty = Column(String, nullable=True)
    agency_url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    outreach_status = Column(String, default="Not Contacted")
    last_contact = Column(String, nullable=True)
    is_agency = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserPreferences(Base):
    __tablename__ = "user_preferences"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)   # NULL = legacy global prefs
    locations = Column(String, default='[]')        # empty = no location filter (show all)
    funding_stages = Column(String, default='[]')   # empty = no funding filter (show all)
    employee_ranges = Column(String, default='[]')  # empty = no size filter (show all)
    min_score = Column(Integer, default=0)
    enabled_sources = Column(String, nullable=True)  # JSON list of enabled source IDs; NULL = all enabled
    preferred_roles = Column(String, nullable=True)       # JSON list of role categories; NULL = all
    preferred_work_types = Column(String, nullable=True)  # JSON list of "Remote"/"Hybrid"/"In-Office"; NULL = all
    years_experience = Column(String, nullable=True)      # "0+", "1-2", "3-5", "5-10", "10+"; NULL = no filter
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class JobCollection(Base):
    __tablename__ = "job_collections"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String, default="#8b6bbf")
    created_at = Column(DateTime, default=datetime.utcnow)


class JobCollectionItem(Base):
    __tablename__ = "job_collection_items"
    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, nullable=False, index=True)
    discovered_job_id = Column(Integer, nullable=False, index=True)
    added_at = Column(DateTime, default=datetime.utcnow)


class InterviewRound(Base):
    """Tracks individual interview rounds for a job application."""
    __tablename__ = "interview_rounds"
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, index=True, nullable=False)
    user_id = Column(Integer, index=True, nullable=True)
    round_number = Column(Integer, default=1)
    interview_type = Column(String, nullable=True)     # Screening, Technical, Behavioral, Case Study, Final Round
    scheduled_date = Column(String, nullable=True)     # YYYY-MM-DD
    interviewer_name = Column(String, nullable=True)
    interviewer_linkedin = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String, default="Scheduled")       # Scheduled, Completed, Cancelled
    thank_you_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class EventRsvp(Base):
    """Stores events a user has RSVPed to — surfaces them on the calendar."""
    __tablename__ = "event_rsvps"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    event_id = Column(String, index=True)
    title = Column(String)
    start_date = Column(String)   # YYYY-MM-DD
    url = Column(String, nullable=True)
    venue = Column(String, nullable=True)
    city = Column(String, nullable=True)
    event_type = Column(String, nullable=True)
    organizer = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── DB helpers ────────────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations():
    """Safely add new columns to existing tables — idempotent."""
    migrations = [
        "ALTER TABLE discovered_jobs ADD COLUMN funding_stage TEXT",
        "ALTER TABLE discovered_jobs ADD COLUMN employee_count TEXT",
        "ALTER TABLE jobs ADD COLUMN discovered_job_id INTEGER",
        "ALTER TABLE jobs ADD COLUMN user_id INTEGER",
        "ALTER TABLE contacts ADD COLUMN user_id INTEGER",
        "ALTER TABLE recruiters ADD COLUMN user_id INTEGER",
        "ALTER TABLE user_preferences ADD COLUMN user_id INTEGER",
        "ALTER TABLE job_collections ADD COLUMN user_id INTEGER",
        "ALTER TABLE users ADD COLUMN minor TEXT",
        "ALTER TABLE users ADD COLUMN high_school TEXT",
        "ALTER TABLE users ADD COLUMN grad_school TEXT",
        "ALTER TABLE jobs ADD COLUMN folder TEXT",
        "ALTER TABLE jobs ADD COLUMN starred INTEGER DEFAULT 0",
        "ALTER TABLE user_preferences ADD COLUMN enabled_sources TEXT",
        "ALTER TABLE user_preferences ADD COLUMN preferred_roles TEXT",
        "ALTER TABLE user_preferences ADD COLUMN preferred_work_types TEXT",
        "ALTER TABLE user_preferences ADD COLUMN years_experience TEXT",
        "ALTER TABLE discovered_jobs ADD COLUMN min_years_required INTEGER",
        "ALTER TABLE jobs ADD COLUMN deadline TEXT",
        "ALTER TABLE jobs ADD COLUMN interview_date TEXT",
        "ALTER TABLE jobs ADD COLUMN reminder_date TEXT",
        "ALTER TABLE discovered_jobs ADD COLUMN deadline TEXT",
        "ALTER TABLE users ADD COLUMN nylas_grant_id TEXT",
        "ALTER TABLE users ADD COLUMN linkedin_url TEXT",
        "ALTER TABLE user_profiles ADD COLUMN custom_context TEXT",
        "ALTER TABLE user_profiles ADD COLUMN resume_data BLOB",
        "ALTER TABLE user_profiles ADD COLUMN cover_letter_data BLOB",
        "ALTER TABLE user_profiles ADD COLUMN transcript_data BLOB",
        "ALTER TABLE user_profiles ADD COLUMN context_roles TEXT",
        "ALTER TABLE user_profiles ADD COLUMN context_locations TEXT",
        "ALTER TABLE user_profiles ADD COLUMN context_skills TEXT",
        "ALTER TABLE interview_rounds ADD COLUMN thank_you_sent INTEGER DEFAULT 0",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                conn.rollback()  # Reset transaction so next migration can run


def _run_pg_migrations():
    """PostgreSQL-safe migrations using IF NOT EXISTS."""
    pg_migrations = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_url TEXT",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS custom_context TEXT",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS resume_data BYTEA",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cover_letter_data BYTEA",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS transcript_data BYTEA",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS context_roles TEXT",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS context_locations TEXT",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS context_skills TEXT",
    ]
    with engine.connect() as conn:
        for sql in pg_migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                conn.rollback()


def init_db():
    Base.metadata.create_all(bind=engine)
    if DATABASE_URL.startswith("sqlite"):
        run_migrations()
    else:
        _run_pg_migrations()
