from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import httpx
import json
import os
import shutil
import pathlib
import asyncio
from database import (
    get_db, init_db, Job, Contact, DiscoveredJob, Recruiter,
    UserPreferences, JobCollection, JobCollectionItem,
    User, UserProfile, CoverLetterTemplate, EmailTemplate,
)
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_optional_user,
)
from resume_parser import compute_personal_score, build_user_profile_for_scoring, LOCATION_MAP

# ── Load .env manually (python-dotenv not installed) ──────────────────────────
def _load_dotenv():
    env_path = pathlib.Path(__file__).parent / ".env"
    if not env_path.exists():
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip()
            if key and (key not in os.environ or not os.environ[key]):
                os.environ[key] = val

_load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Use UPLOADS_DIR env var in production (Railway volume), fall back to local
UPLOADS_DIR = pathlib.Path(os.environ.get("UPLOADS_DIR", str(pathlib.Path(__file__).parent / "uploads")))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="RecruitIQ API")

# Track when the last scrape was triggered (in-memory; resets on restart)
_last_scrape_triggered: Optional[str] = None

# In-memory cache for company summaries: company_name (lowercase) → summary string
_company_summary_cache: dict = {}

# CORS — allow localhost for dev + any Vercel deployment + custom FRONTEND_URL
_frontend_url = os.environ.get("FRONTEND_URL", "")
_allow_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://recruitment-tool-orcin.vercel.app",
    "https://recruitiq.vercel.app",
]
if _frontend_url and _frontend_url not in _allow_origins:
    _allow_origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    init_db()
    asyncio.ensure_future(_daily_job_check_loop())


async def _daily_job_check_loop():
    """Background loop: check all active job URLs once per day and deactivate 404s."""
    await asyncio.sleep(60)  # Wait 1 min after startup before first run
    while True:
        try:
            await _check_active_jobs_background()
        except Exception as e:
            print(f"[DailyCheck] Error: {e}")
        await asyncio.sleep(24 * 3600)  # Run every 24 hours


# ─────────────────────────────────────────────
# AUTH  (register / login / me / profile)
# ─────────────────────────────────────────────

CAREER_STAGE_LABELS = {
    "college_senior":    "College Senior — Entry-Level Full-Time",
    "college_junior":    "College Junior — Summer Internship (Coming Soon)",
    "college_sophomore": "College Sophomore — Summer Internship (Coming Soon)",
    "early_career":      "1–3 Years Experience (Coming Soon)",
    "mid_career":        "3–6 Years Experience (Coming Soon)",
    "senior":            "6+ Years Experience (Coming Soon)",
}

@app.post("/api/auth/register")
def register(payload: dict, db: Session = Depends(get_db)):
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    name = (payload.get("name") or "").strip()
    if not email or not password or not name:
        raise HTTPException(status_code=400, detail="email, password, and name are required")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=email,
        name=name,
        password_hash=hash_password(password),
        university=payload.get("university"),
        graduation_year=payload.get("graduation_year"),
        major=payload.get("major"),
        minor=payload.get("minor"),
        high_school=payload.get("high_school"),
        grad_school=payload.get("grad_school"),
        career_stage=payload.get("career_stage", "college_senior"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    # Seed default preferences for this user
    prefs = UserPreferences(user_id=user.id)
    db.add(prefs)
    db.commit()
    token = create_access_token(user.id, user.email)
    return {"token": token, "user": _user_to_dict(user)}

@app.post("/api/auth/login")
def login(payload: dict, db: Session = Depends(get_db)):
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user.id, user.email)
    return {"token": token, "user": _user_to_dict(user)}

@app.get("/api/auth/me")
def me(current_user: User = Depends(get_current_user)):
    return _user_to_dict(current_user)

@app.put("/api/auth/me")
def update_me(payload: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    allowed = ["name", "university", "graduation_year", "major", "minor", "high_school", "grad_school", "career_stage"]
    for field in allowed:
        if field in payload:
            setattr(current_user, field, payload[field])
    db.commit()
    db.refresh(current_user)
    return _user_to_dict(current_user)

def _user_to_dict(u: User) -> dict:
    return {
        "id": u.id, "email": u.email, "name": u.name,
        "university": u.university, "graduation_year": u.graduation_year,
        "major": u.major, "minor": u.minor,
        "high_school": u.high_school, "grad_school": u.grad_school,
        "career_stage": u.career_stage,
        "career_stage_label": CAREER_STAGE_LABELS.get(u.career_stage, u.career_stage),
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }

# ── Profile / file upload ──────────────────────────────────────────────────

@app.get("/api/profile")
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prof = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not prof:
        return {"user": _user_to_dict(current_user), "profile": None}
    return {"user": _user_to_dict(current_user), "profile": _profile_to_dict(prof)}

@app.post("/api/profile/upload")
async def upload_file(
    file_type: str = Form(...),   # "resume" | "cover_letter" | "transcript"
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file_type not in ("resume", "cover_letter", "transcript"):
        raise HTTPException(status_code=400, detail="file_type must be resume, cover_letter, or transcript")
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported currently")

    user_dir = UPLOADS_DIR / str(current_user.id)
    user_dir.mkdir(exist_ok=True)
    dest = user_dir / f"{file_type}.pdf"

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Extract text
    from resume_parser import extract_pdf_text, parse_resume, parse_transcript
    text = extract_pdf_text(str(dest))

    # Parse and store
    prof = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not prof:
        prof = UserProfile(user_id=current_user.id)
        db.add(prof)

    setattr(prof, f"{file_type}_filename", file.filename)
    setattr(prof, f"{file_type}_text", text[:10000])   # cap at 10k chars

    if file_type == "resume" and text:
        parsed = parse_resume(text)
        prof.parsed_roles = json.dumps(parsed["suggested_roles"])
        prof.parsed_locations = json.dumps(parsed["suggested_locations"])
        prof.parsed_skills = json.dumps(parsed["skills"])
        prof.parsed_school = parsed["school"]
        prof.parsed_gpa = parsed["gpa"]
        # Auto-update preferences from resume
        prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
        if not prefs:
            prefs = UserPreferences(user_id=current_user.id)
            db.add(prefs)
        if parsed["suggested_locations"]:
            loc_list = [l for l in parsed["suggested_locations"] if l in ("NYC", "SF", "Remote")]
            if loc_list:
                prefs.locations = json.dumps(loc_list)
        # Update user's grad year if found
        if parsed.get("grad_year") and not current_user.graduation_year:
            current_user.graduation_year = parsed["grad_year"]
        if parsed.get("school") and not current_user.university:
            current_user.university = parsed["school"]
        if parsed.get("major") and not current_user.major:
            current_user.major = parsed["major"]
    elif file_type == "transcript" and text:
        parsed = parse_transcript(text)
        if parsed.get("school"): prof.parsed_school = parsed["school"]
        if parsed.get("gpa"): prof.parsed_gpa = parsed["gpa"]
        if parsed.get("grad_year") and not current_user.graduation_year:
            current_user.graduation_year = parsed["grad_year"]

    db.commit()
    db.refresh(prof)
    return {"ok": True, "profile": _profile_to_dict(prof), "user": _user_to_dict(current_user)}

def _profile_to_dict(p: UserProfile) -> dict:
    def _loads(v):
        try: return json.loads(v) if v else []
        except: return []
    return {
        "resume_filename": p.resume_filename,
        "cover_letter_filename": p.cover_letter_filename,
        "transcript_filename": p.transcript_filename,
        "skills": _loads(p.parsed_skills),
        "suggested_roles": _loads(p.parsed_roles),
        "suggested_locations": _loads(p.parsed_locations),
        "gpa": p.parsed_gpa,
        "school": p.parsed_school,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


from fastapi import Query as _Query
from auth import decode_token as _decode_token

def _get_user_from_token_param(token: str, db: Session) -> User:
    """Auth helper for download endpoints that need to work from browser links (no header)."""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = _decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def _file_response_for_type(file_type: str, user, db, inline: bool = False):
    """Shared helper: stream a user's uploaded PDF."""
    from fastapi.responses import FileResponse
    prof = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    attr = f"{file_type}_filename"
    original_filename = getattr(prof, attr, None) if prof else None
    if not original_filename:
        raise HTTPException(status_code=404, detail=f"No {file_type.replace('_', ' ')} uploaded")
    # Files are always saved on disk as {file_type}.pdf regardless of the original upload name
    path = UPLOADS_DIR / str(user.id) / f"{file_type}.pdf"
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    if inline:
        return FileResponse(str(path), media_type="application/pdf",
                            headers={"Content-Disposition": "inline"})
    return FileResponse(str(path), media_type="application/pdf", filename=original_filename)

@app.get("/api/profile/resume/download")
async def download_resume(token: str = _Query(""), inline: bool = _Query(False), db: Session = Depends(get_db)):
    return _file_response_for_type("resume", _get_user_from_token_param(token, db), db, inline=inline)

@app.get("/api/profile/cover-letter/download")
async def download_cover_letter(token: str = _Query(""), inline: bool = _Query(False), db: Session = Depends(get_db)):
    return _file_response_for_type("cover_letter", _get_user_from_token_param(token, db), db, inline=inline)

@app.get("/api/profile/transcript/download")
async def download_transcript(token: str = _Query(""), inline: bool = _Query(False), db: Session = Depends(get_db)):
    return _file_response_for_type("transcript", _get_user_from_token_param(token, db), db, inline=inline)


@app.put("/api/profile/parsed")
def update_parsed_profile(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update editable parsed/detected fields on the user's profile."""
    prof = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not prof:
        prof = UserProfile(user_id=current_user.id)
        db.add(prof)
    if "suggested_roles" in payload:
        prof.parsed_roles = json.dumps(payload["suggested_roles"])
    if "suggested_locations" in payload:
        prof.parsed_locations = json.dumps(payload["suggested_locations"])
    if "skills" in payload:
        prof.parsed_skills = json.dumps(payload["skills"])
    prof.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(prof)
    return _profile_to_dict(prof)


# ─────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────

class JobCreate(BaseModel):
    company: str
    role: str = ""
    status: str = "Not Applied"
    date_applied: Optional[str] = None
    salary_range: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    job_url: Optional[str] = None
    referral: bool = False
    referral_name: Optional[str] = None
    source: Optional[str] = None
    folder: Optional[str] = None
    deadline: Optional[str] = None
    interview_date: Optional[str] = None
    reminder_date: Optional[str] = None

class JobUpdate(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    date_applied: Optional[str] = None
    salary_range: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    job_url: Optional[str] = None
    referral: Optional[bool] = None
    referral_name: Optional[str] = None
    source: Optional[str] = None
    folder: Optional[str] = None
    starred: Optional[bool] = None
    deadline: Optional[str] = None
    interview_date: Optional[str] = None
    reminder_date: Optional[str] = None

class ContactCreate(BaseModel):
    job_id: Optional[int] = None
    company: str
    name: str
    title: Optional[str] = None
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    connection_type: Optional[str] = None
    outreach_status: str = "Not Contacted"
    follow_up_1: bool = False
    follow_up_2: bool = False
    meeting_notes: Optional[str] = None
    school: Optional[str] = None
    graduation_year: Optional[str] = None
    tags: Optional[str] = None

class ContactUpdate(BaseModel):
    job_id: Optional[int] = None
    company: Optional[str] = None
    name: Optional[str] = None
    title: Optional[str] = None
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    connection_type: Optional[str] = None
    outreach_status: Optional[str] = None
    follow_up_1: Optional[bool] = None
    follow_up_2: Optional[bool] = None
    meeting_notes: Optional[str] = None
    school: Optional[str] = None
    graduation_year: Optional[str] = None
    tags: Optional[str] = None

class RecruiterCreate(BaseModel):
    name: str
    agency: Optional[str] = None
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    phone: Optional[str] = None
    specialty: Optional[str] = None
    agency_url: Optional[str] = None
    notes: Optional[str] = None
    outreach_status: str = "Not Contacted"
    last_contact: Optional[str] = None
    is_agency: bool = True

class RecruiterUpdate(BaseModel):
    name: Optional[str] = None
    agency: Optional[str] = None
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    phone: Optional[str] = None
    specialty: Optional[str] = None
    agency_url: Optional[str] = None
    notes: Optional[str] = None
    outreach_status: Optional[str] = None
    last_contact: Optional[str] = None
    is_agency: Optional[bool] = None

class DiscoveredJobUpdate(BaseModel):
    added_to_tracker: Optional[bool] = None
    is_active: Optional[bool] = None
    match_score: Optional[float] = None


# ─────────────────────────────────────────────
# JOBS (Page 1 - Tracker)
# ─────────────────────────────────────────────

@app.get("/api/jobs")
def get_jobs(
    status: Optional[str] = None, search: Optional[str] = None,
    current_user: Optional[User] = Depends(get_optional_user), db: Session = Depends(get_db),
):
    q = db.query(Job)
    if current_user:
        q = q.filter(or_(Job.user_id == current_user.id, Job.user_id == None))
    if status and status != "All":
        q = q.filter(Job.status == status)
    if search:
        q = q.filter(or_(Job.company.ilike(f"%{search}%"), Job.role.ilike(f"%{search}%")))
    return [job_to_dict(j) for j in q.order_by(Job.created_at.desc()).all()]

@app.post("/api/jobs")
def create_job(
    job: JobCreate,
    current_user: Optional[User] = Depends(get_optional_user), db: Session = Depends(get_db),
):
    data = job.dict()
    if current_user:
        data["user_id"] = current_user.id
    db_job = Job(**data)
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    return job_to_dict(db_job)

@app.put("/api/jobs/{job_id}")
def update_job(
    job_id: int, job: JobUpdate,
    current_user: Optional[User] = Depends(get_optional_user), db: Session = Depends(get_db),
):
    q = db.query(Job).filter(Job.id == job_id)
    if current_user:
        q = q.filter(or_(Job.user_id == current_user.id, Job.user_id == None))
    db_job = q.first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    for k, v in job.dict(exclude_none=True).items():
        setattr(db_job, k, v)
    db_job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_job)
    return job_to_dict(db_job)

@app.delete("/api/jobs/{job_id}")
def delete_job(
    job_id: int,
    current_user: Optional[User] = Depends(get_optional_user), db: Session = Depends(get_db),
):
    q = db.query(Job).filter(Job.id == job_id)
    if current_user:
        q = q.filter(or_(Job.user_id == current_user.id, Job.user_id == None))
    db_job = q.first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    if db_job.discovered_job_id:
        disc = db.query(DiscoveredJob).filter(DiscoveredJob.id == db_job.discovered_job_id).first()
        if disc:
            disc.added_to_tracker = False
            disc.is_active = True
    db.delete(db_job)
    db.commit()
    return {"ok": True}

@app.get("/api/jobs/stats")
def get_job_stats(
    current_user: Optional[User] = Depends(get_optional_user), db: Session = Depends(get_db),
):
    q = db.query(Job)
    if current_user:
        q = q.filter(or_(Job.user_id == current_user.id, Job.user_id == None))
    jobs = q.all()
    stats = {"total": len(jobs), "Not Applied": 0, "Applied": 0, "Pending": 0, "Accepted": 0, "Rejected": 0}
    for j in jobs:
        if j.status in stats:
            stats[j.status] += 1
    return stats

@app.get("/api/jobs/folders")
def get_job_folders(
    current_user: Optional[User] = Depends(get_optional_user), db: Session = Depends(get_db),
):
    q = db.query(Job.folder).filter(Job.folder != None, Job.folder != "")
    if current_user:
        q = q.filter(or_(Job.user_id == current_user.id, Job.user_id == None))
    return sorted(set(row[0] for row in q.all()))


def job_to_dict(j):
    return {
        "id": j.id, "company": j.company, "role": j.role, "status": j.status,
        "date_applied": j.date_applied, "salary_range": j.salary_range,
        "location": j.location, "notes": j.notes, "job_url": j.job_url,
        "referral": j.referral, "referral_name": j.referral_name, "source": j.source,
        "discovered_job_id": j.discovered_job_id, "folder": j.folder,
        "starred": bool(j.starred) if hasattr(j, 'starred') and j.starred is not None else False,
        "deadline": j.deadline if hasattr(j, 'deadline') else None,
        "interview_date": j.interview_date if hasattr(j, 'interview_date') else None,
        "reminder_date": j.reminder_date if hasattr(j, 'reminder_date') else None,
        "created_at": j.created_at.isoformat() if j.created_at else None,
        "updated_at": j.updated_at.isoformat() if j.updated_at else None,
    }


# ─────────────────────────────────────────────
# CALENDAR EVENTS
# ─────────────────────────────────────────────

@app.get("/api/calendar/events")
def get_calendar_events(
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Return all calendar events derived from job deadlines, interview dates, and reminders."""
    q = db.query(Job)
    if current_user:
        q = q.filter(or_(Job.user_id == current_user.id, Job.user_id == None))
    jobs = q.all()

    events = []
    for j in jobs:
        base = {"job_id": j.id, "company": j.company, "role": j.role or "", "status": j.status}
        if getattr(j, 'interview_date', None):
            events.append({**base, "id": f"interview-{j.id}", "type": "interview",
                           "title": j.company, "date": j.interview_date})
        if getattr(j, 'deadline', None):
            events.append({**base, "id": f"deadline-{j.id}", "type": "deadline",
                           "title": j.company, "date": j.deadline})
        if getattr(j, 'reminder_date', None):
            events.append({**base, "id": f"reminder-{j.id}", "type": "reminder",
                           "title": j.company, "date": j.reminder_date})

    # Sort by date ascending
    events.sort(key=lambda e: e["date"])
    return events


# ─────────────────────────────────────────────
# CONTACTS / NETWORKING (Page 2)
# ─────────────────────────────────────────────

@app.get("/api/contacts")
def get_contacts(job_id: Optional[int] = None, company: Optional[str] = None,
                 search: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Contact)
    if job_id:
        q = q.filter(Contact.job_id == job_id)
    if company:
        q = q.filter(Contact.company.ilike(f"%{company}%"))
    if search:
        q = q.filter(or_(Contact.name.ilike(f"%{search}%"), Contact.company.ilike(f"%{search}%"),
                         Contact.email.ilike(f"%{search}%"), Contact.title.ilike(f"%{search}%")))
    contacts = q.order_by(Contact.created_at.desc()).all()
    return [contact_to_dict(c) for c in contacts]

@app.post("/api/contacts")
def create_contact(contact: ContactCreate, db: Session = Depends(get_db)):
    db_contact = Contact(**contact.dict())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return contact_to_dict(db_contact)

@app.put("/api/contacts/{contact_id}")
def update_contact(contact_id: int, contact: ContactUpdate, db: Session = Depends(get_db)):
    db_contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for k, v in contact.dict(exclude_none=True).items():
        setattr(db_contact, k, v)
    db_contact.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_contact)
    return contact_to_dict(db_contact)

@app.delete("/api/contacts/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    db_contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(db_contact)
    db.commit()
    return {"ok": True}

@app.post("/api/contacts/hunter-domain")
async def hunter_domain_search(payload: dict):
    """
    Hunter.io domain search — finds all known emails at a company domain.
    Requires HUNTER_API_KEY in .env. Free tier: 25 searches/month.
    """
    hunter_key = os.getenv("HUNTER_API_KEY", "")
    if not hunter_key:
        return {"error": "no_key", "message": "Add your Hunter.io API key to backend/.env as HUNTER_API_KEY"}
    domain = payload.get("domain", "").strip()
    company = payload.get("company", "").strip()
    if not domain:
        return {"error": "no_domain", "message": "Provide a domain (e.g. openai.com)"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://api.hunter.io/v2/domain-search",
                params={"domain": domain, "api_key": hunter_key, "limit": 25, "type": "personal"},
            )
            data = resp.json()
            if resp.status_code != 200:
                return {"error": "api_error", "message": data.get("errors", [{}])[0].get("details", "Hunter.io error")}
            emails = data.get("data", {}).get("emails", [])
            org = data.get("data", {}).get("organization", company)
            return {
                "ok": True,
                "domain": domain,
                "organization": org,
                "total": len(emails),
                "emails": [
                    {
                        "email": e.get("value", ""),
                        "first_name": e.get("first_name", ""),
                        "last_name": e.get("last_name", ""),
                        "full_name": f"{e.get('first_name','')} {e.get('last_name','')}".strip(),
                        "position": e.get("position", ""),
                        "confidence": e.get("confidence", 0),
                        "linkedin": e.get("linkedin", ""),
                        "twitter": e.get("twitter", ""),
                    }
                    for e in emails
                ],
            }
    except Exception as e:
        return {"error": "exception", "message": str(e)}

@app.post("/api/contacts/hunter-find")
async def hunter_find_email(payload: dict):
    """
    Hunter.io email finder — find a specific person's email given name + domain.
    """
    hunter_key = os.getenv("HUNTER_API_KEY", "")
    if not hunter_key:
        return {"error": "no_key", "message": "Add HUNTER_API_KEY to backend/.env"}
    domain = payload.get("domain", "").strip()
    first_name = payload.get("first_name", "").strip()
    last_name = payload.get("last_name", "").strip()
    if not domain or not first_name or not last_name:
        return {"error": "missing_fields", "message": "Provide domain, first_name, and last_name"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://api.hunter.io/v2/email-finder",
                params={"domain": domain, "first_name": first_name, "last_name": last_name, "api_key": hunter_key},
            )
            data = resp.json()
            if resp.status_code != 200:
                return {"error": "api_error", "message": data.get("errors", [{}])[0].get("details", "Hunter.io error")}
            email_data = data.get("data", {})
            return {
                "ok": True,
                "email": email_data.get("email", ""),
                "score": email_data.get("score", 0),
                "first_name": email_data.get("first_name", first_name),
                "last_name": email_data.get("last_name", last_name),
            }
    except Exception as e:
        return {"error": "exception", "message": str(e)}

@app.post("/api/contacts/search-apollo")
async def search_apollo(payload: dict):
    """
    Step 1: search Apollo for people at a company.
    Returns preview rows (first_name + obfuscated last name + title).
    Use /contacts/enrich-apollo to get full details before saving.
    """
    apollo_key = os.getenv("APOLLO_API_KEY", "")
    if not apollo_key:
        return {"error": "no_key", "people": []}

    company        = payload.get("company", "")
    title_keywords = payload.get("title_keywords", [])
    seniority      = payload.get("seniority", [])
    page           = payload.get("page", 1)
    per_page       = min(payload.get("per_page", 25), 50)

    body: dict = {"q_organization_name": company, "page": page, "per_page": per_page}
    if title_keywords:
        body["person_titles"] = title_keywords
    if seniority:
        body["person_seniority"] = seniority

    headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apollo_key,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.apollo.io/api/v1/mixed_people/api_search",
                headers=headers, json=body,
            )
        raw = resp.json()
        people = []
        for p in raw.get("people", []):
            first  = p.get("first_name", "") or ""
            last_o = p.get("last_name_obfuscated", "") or ""   # e.g. "Si***h"
            display_name = f"{first} {last_o}".strip()
            org = (p.get("organization") or {}).get("name", "") or company
            people.append({
                "apollo_id":   p.get("id", ""),
                "name":        display_name,
                "first_name":  first,
                "title":       p.get("title", "") or "",
                "company":     org,
                "obfuscated":  True,   # flag: last name is hidden until enrich
            })
        total = raw.get("total_entries", len(people))
        per   = per_page if per_page else 25
        return {
            "people":      people,
            "total":       total,
            "page":        page,
            "total_pages": max(1, -(-total // per)),  # ceiling division
        }
    except Exception as e:
        return {"error": str(e), "people": []}


@app.post("/api/contacts/enrich-apollo")
async def enrich_apollo(payload: dict):
    """
    Step 2: given an Apollo person ID, call people/match to get the full profile.
    Consumes one Apollo export credit.
    """
    apollo_key = os.getenv("APOLLO_API_KEY", "")
    if not apollo_key:
        return {"error": "no_key"}

    apollo_id = payload.get("apollo_id", "")
    if not apollo_id:
        return {"error": "apollo_id required"}

    headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apollo_key,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.apollo.io/api/v1/people/match",
                headers=headers,
                json={"id": apollo_id, "reveal_personal_emails": False},
            )
        p = resp.json().get("person") or {}
        if not p:
            return {"error": "not_found"}
        email = p.get("email", "") or ""
        email_visible = bool(email) and "***" not in email
        return {
            "apollo_id":     p.get("id", apollo_id),
            "name":          p.get("name", ""),
            "first_name":    p.get("first_name", ""),
            "last_name":     p.get("last_name", ""),
            "title":         p.get("title", "") or "",
            "email":         email if email_visible else "",
            "email_visible": email_visible,
            "linkedin_url":  p.get("linkedin_url", "") or "",
            "photo_url":     p.get("photo_url", "") or "",
            "headline":      p.get("headline", "") or "",
            "city":          p.get("city", "") or "",
            "state":         p.get("state", "") or "",
            "seniority":     p.get("seniority", "") or "",
        }
    except Exception as e:
        return {"error": str(e)}

def contact_to_dict(c):
    return {
        "id": c.id, "job_id": c.job_id, "company": c.company, "name": c.name,
        "title": c.title, "email": c.email, "linkedin_url": c.linkedin_url,
        "connection_type": c.connection_type, "outreach_status": c.outreach_status,
        "follow_up_1": c.follow_up_1, "follow_up_2": c.follow_up_2,
        "meeting_notes": c.meeting_notes, "school": c.school,
        "graduation_year": c.graduation_year, "tags": c.tags,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


# ─────────────────────────────────────────────
# JOB DISCOVERY (Page 3)
# ─────────────────────────────────────────────

def _deduplicate_jobs(jobs: list, offset: int, limit: int):
    """Group jobs by company, keep best-scoring per company, attach other_jobs_count."""
    company_groups: dict = {}
    for job in jobs:
        co = job.get("company") or ""
        if co not in company_groups:
            company_groups[co] = []
        company_groups[co].append(job)
    # Best job per company (already sorted by score desc, so first = best)
    deduped = []
    for co, group in company_groups.items():
        best = group[0]
        best["other_jobs_count"] = len(group) - 1
        deduped.append(best)
    total = len(deduped)
    return deduped[offset:offset + limit], total


@app.get("/api/discovered-jobs")
def get_discovered_jobs(
    is_active: Optional[bool] = None,
    added: Optional[bool] = None,
    search: Optional[str] = None,
    min_score: Optional[int] = None,
    sort: Optional[str] = "score",
    limit: int = 30,
    offset: int = 0,
    funding_stage: Optional[str] = None,   # comma-separated e.g. "Seed,Series A"
    employee_range: Optional[str] = None,  # comma-separated e.g. "1-50,50-200"
    location_filter: Optional[str] = None,
    role_filter: Optional[str] = None,     # filter by role type keyword
    work_type: Optional[str] = None,       # comma-separated: "Remote,Hybrid,In-Office"
    years_experience: Optional[str] = None,  # "0+","1-2","3-5","5-10","10+"
    company_filter: Optional[str] = None,    # exact company name for popup
    deduplicate_by_company: bool = False,    # show one job per company with count
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    q = db.query(DiscoveredJob)
    if is_active is not None:
        q = q.filter(DiscoveredJob.is_active == is_active)
    if added is not None:
        q = q.filter(DiscoveredJob.added_to_tracker == added)
    if search:
        q = q.filter(or_(
            DiscoveredJob.company.ilike(f"%{search}%"),
            DiscoveredJob.role.ilike(f"%{search}%"),
            DiscoveredJob.location.ilike(f"%{search}%"),
            DiscoveredJob.source.ilike(f"%{search}%"),
        ))
    if company_filter:
        q = q.filter(DiscoveredJob.company == company_filter)
    # Note: min_score is applied per-path below (personalized vs stored) — not here
    if funding_stage:
        stages = [s.strip() for s in funding_stage.split(",")]
        # Strict: only show jobs with a known matching funding stage
        q = q.filter(DiscoveredJob.funding_stage.in_(stages))
    if employee_range:
        ranges = [r.strip() for r in employee_range.split(",")]
        # Strict: only show jobs with a known matching employee count
        q = q.filter(DiscoveredJob.employee_count.in_(ranges))
    if role_filter:
        # role_filter is comma-separated keywords; OR-match any keyword in the role title
        keywords = [kw.strip() for kw in role_filter.split(",") if kw.strip()]
        if keywords:
            q = q.filter(or_(*[DiscoveredJob.role.ilike(f"%{kw}%") for kw in keywords]))
    if work_type:
        types = [t.strip().lower() for t in work_type.split(",") if t.strip()]
        wt_conditions = []
        for wt in types:
            if wt == "remote":
                wt_conditions += [
                    DiscoveredJob.location.ilike("%remote%"),
                    DiscoveredJob.location.ilike("%anywhere%"),
                    DiscoveredJob.description.ilike("%fully remote%"),
                ]
            elif wt == "hybrid":
                wt_conditions += [
                    DiscoveredJob.location.ilike("%hybrid%"),
                    DiscoveredJob.description.ilike("%hybrid%"),
                ]
            elif wt == "in-office":
                wt_conditions += [
                    DiscoveredJob.location.ilike("%in-office%"),
                    DiscoveredJob.location.ilike("%onsite%"),
                    DiscoveredJob.location.ilike("%on-site%"),
                    DiscoveredJob.location.ilike("%in office%"),
                ]
        if wt_conditions:
            q = q.filter(or_(*wt_conditions))
    if location_filter:
        loc_names = [l.strip() for l in location_filter.split(",")]
        loc_conditions = []
        for loc_name in loc_names:
            patterns = LOCATION_MAP.get(loc_name, [loc_name.lower()])
            for pattern in patterns:
                loc_conditions.append(DiscoveredJob.location.ilike(f"%{pattern}%"))
        if loc_conditions:
            q = q.filter(or_(*loc_conditions))

    # Years of experience filter
    if years_experience and years_experience != "10+":
        max_years_map = {"0+": 0, "1-2": 2, "3-5": 5, "5-10": 10}
        user_max = max_years_map.get(years_experience)
        if user_max is not None:
            # Show jobs where experience requirement is unknown (null) OR within user's range
            q = q.filter(or_(
                DiscoveredJob.min_years_required == None,
                DiscoveredJob.min_years_required <= user_max,
            ))

    # Source filtering — based on user's enabled_sources preference
    SOURCE_ID_PATTERNS = {
        'hackernews': ['hn', 'who is hiring', 'hacker news'],
        'ali_rohde':  ['ali rohde'],
        'greenhouse': ['greenhouse'],
        'lever':      ['lever'],
        'ashby':      ['ashby'],
        'workable':   ['workable'],
        'remoteok':   ['remote ok', 'remoteok'],
        'wellfound':  ['wellfound', 'angellist'],
        'linkedin':   ['linkedin'],
        'indeed':     ['indeed'],
        'handshake':  ['handshake'],
        'yc_jobs':    ['yc work', 'workatastartup', 'yc startup'],
        'himalayas':  ['himalayas'],
        'wwr':        ['we work remotely', 'weworkremotely'],
        'vc_boards':  ['vc portfolio'],
    }
    if current_user:
        user_prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
        if user_prefs and user_prefs.enabled_sources:
            enabled = json.loads(user_prefs.enabled_sources)
            if enabled:
                source_conditions = []
                for sid in enabled:
                    for pattern in SOURCE_ID_PATTERNS.get(sid, [sid]):
                        source_conditions.append(DiscoveredJob.source.ilike(f"%{pattern}%"))
                if source_conditions:
                    q = q.filter(or_(*source_conditions))

    # Personalized scoring — only when user is authenticated and has a profile with parsed_roles
    user_profile_dict = None
    if current_user:
        user_profile_obj = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
        if user_profile_obj and user_profile_obj.parsed_roles:
            user_profile_dict = build_user_profile_for_scoring(current_user, user_profile_obj)

    if user_profile_dict:
        # Personalized path: fetch ALL matching jobs, score in Python, then filter/sort/paginate
        all_jobs = q.all()
        scored = []
        for j in all_jobs:
            d = discovered_to_dict(j)
            p_score, p_reasons = compute_personal_score(
                j.role or "", j.location or "", j.description or "", user_profile_dict
            )
            d["match_score"] = p_score
            d["match_reasons"] = "; ".join(p_reasons) if p_reasons else ""
            scored.append(d)
        if min_score is not None:
            scored = [d for d in scored if (d["match_score"] or 0) >= min_score]
        if sort == "score":
            scored.sort(key=lambda d: d["match_score"] or 0, reverse=True)
        else:
            scored.sort(
                key=lambda d: (d.get("posted_date") or "0000", d.get("scraped_at") or ""),
                reverse=True,
            )
        total = len(scored)
        page_jobs = scored[offset:offset + limit]
        if deduplicate_by_company:
            page_jobs, total = _deduplicate_jobs(scored, offset, limit)
        return {"total": total, "jobs": page_jobs}
    else:
        # Non-personalized: DB handles filtering and pagination
        if min_score is not None:
            q = q.filter(DiscoveredJob.match_score >= min_score)
        if sort == "score":
            q = q.order_by(DiscoveredJob.match_score.desc())
        else:
            q = q.order_by(
                DiscoveredJob.posted_date.desc().nullslast(),
                DiscoveredJob.scraped_at.desc(),
            )
        if deduplicate_by_company:
            all_jobs = [discovered_to_dict(j) for j in q.all()]
            page_jobs, total = _deduplicate_jobs(all_jobs, offset, limit)
        else:
            total = q.count()
            jobs = q.offset(offset).limit(limit).all()
            page_jobs = [discovered_to_dict(j) for j in jobs]
        return {"total": total, "jobs": page_jobs}

@app.put("/api/discovered-jobs/{job_id}")
def update_discovered_job(job_id: int, update: DiscoveredJobUpdate, db: Session = Depends(get_db)):
    job = db.query(DiscoveredJob).filter(DiscoveredJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in update.dict(exclude_none=True).items():
        setattr(job, k, v)
    db.commit()
    db.refresh(job)
    return discovered_to_dict(job)

# ── Role classification ────────────────────────────────────────────────────────
ROLE_CATEGORIES = {
    'Engineering': ['engineer', 'developer', 'software', 'devops', 'swe', 'machine learning', 'technical', 'infrastructure', 'data engineer', 'backend', 'frontend', 'fullstack', 'full stack', 'qa ', 'quality assurance'],
    'Revenue':     ['sales', 'account executive', 'revenue', 'business development', 'partnerships', 'customer success', 'account manager', ' bd ', 'closing', ' ae ', 'csm', 'alliances'],
    'Operations':  ['operations', ' ops', 'bizops', 'biz ops', 'revops', 'special projects', 'chief of staff', 'program manager', 'implementation', 'logistics', 'project manager', 'process', 'launch'],
    'Strategy':    ['strategy', 'strategic', 'corporate development', 'corp dev', 'consulting', 'investment', 'due diligence', 'finance', 'associate'],
    'Research':    ['research', 'analyst', 'data analyst', 'market research', 'policy', 'insights', 'intelligence', 'scientist', 'data science'],
    'Growth':      ['growth', 'marketing', 'go-to-market', 'gtm', 'product marketing', 'demand gen', 'content', 'acquisition', 'seo', 'performance marketing', 'brand'],
}

def classify_role(role: str, description: str = "") -> str:
    """Return the best-matching folder category for a job, or 'Unfiled'."""
    title = (role or "").lower()
    desc = (description or "").lower()[:800]
    best_cat = None
    best_score = 0
    for category, keywords in ROLE_CATEGORIES.items():
        score = 0
        for kw in keywords:
            if kw in title:
                score += 5  # title match = 5× weight
            elif kw in desc:
                score += 1
        if score > best_score:
            best_score = score
            best_cat = category
    return best_cat if best_score > 0 else "Unfiled"


@app.post("/api/discovered-jobs/{job_id}/add-to-tracker")
def add_discovered_to_tracker(job_id: int, payload: dict = Body(default={}), db: Session = Depends(get_db)):
    discovered = db.query(DiscoveredJob).filter(DiscoveredJob.id == job_id).first()
    if not discovered:
        raise HTTPException(status_code=404, detail="Not found")
    folder = classify_role(discovered.role or "", discovered.description or "")
    new_job = Job(
        company=discovered.company, role=discovered.role,
        status="Not Applied", location=discovered.location,
        job_url=discovered.job_url, source=discovered.source,
        salary_range=discovered.salary_range,
        discovered_job_id=discovered.id,
        folder=folder,
        deadline=getattr(discovered, 'deadline', None),
    )
    db.add(new_job)
    discovered.added_to_tracker = True
    db.commit()
    db.refresh(new_job)
    return {"ok": True, "job_id": new_job.id, "folder": folder}

@app.post("/api/tracker/add-from-url")
async def add_job_from_url(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch a job posting URL and add it directly to the tracker."""
    url = (payload.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    # Try to fetch the page
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        }) as client:
            resp = await client.get(url)
            html = resp.text
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch URL: {str(e)[:120]}")

    # Parse JSON-LD structured data first
    company, role, location, description = "", "", "", ""
    import re as _re
    for ld_str in _re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, _re.DOTALL):
        try:
            data = json.loads(ld_str)
            items = data if isinstance(data, list) else [data]
            for item in items:
                if item.get("@type") == "JobPosting":
                    role = role or item.get("title", "")
                    org = item.get("hiringOrganization", {})
                    company = company or (org.get("name", "") if isinstance(org, dict) else "")
                    loc = item.get("jobLocation", {})
                    if isinstance(loc, dict):
                        addr = loc.get("address", {})
                        location = location or (addr.get("addressLocality", "") if isinstance(addr, dict) else "")
                    description = description or _re.sub(r"<[^>]+>", " ", item.get("description", "") or "")
        except Exception:
            pass

    # Fall back to OpenGraph / meta tags
    if not role:
        m = _re.search(r'<meta[^>]+(?:property="og:title"|name="title")[^>]+content="([^"]+)"', html, _re.IGNORECASE)
        if m: role = m.group(1).strip()[:120]
    if not role:
        m = _re.search(r'<title[^>]*>([^<|–-]+)', html, _re.IGNORECASE)
        if m: role = m.group(1).strip()[:120]
    if not company:
        m = _re.search(r'<meta[^>]+(?:property="og:site_name"|name="application-name")[^>]+content="([^"]+)"', html, _re.IGNORECASE)
        if m: company = m.group(1).strip()[:100]

    # Respect manual overrides from payload
    company  = (payload.get("company")  or "").strip() or company
    role     = (payload.get("role")     or "").strip() or role
    location = (payload.get("location") or "").strip() or location

    if not company and not role:
        raise HTTPException(
            status_code=422,
            detail="Could not extract job details from this URL. Try pasting the company and role manually."
        )

    folder = classify_role(role, description)
    new_job = Job(
        company=company or "Unknown Company",
        role=role or "Unknown Role",
        status="Not Applied",
        location=location or "",
        job_url=url,
        source="Manual",
        user_id=current_user.id,
        folder=folder,
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return {"ok": True, "job": job_to_dict(new_job), "folder": folder}


@app.post("/api/discovered-jobs/check-active")
async def check_active_jobs(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Background-check all active job URLs; mark 404s as inactive."""
    background_tasks.add_task(_check_active_jobs_background)
    return {"status": "started", "message": "Checking job URLs in background. May take a few minutes."}

@app.get("/api/discovered-jobs/dismissed")
def get_dismissed_jobs(
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Return jobs that were dismissed (is_active=False) within the last 30 days."""
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(days=30)
    jobs = db.query(DiscoveredJob).filter(
        DiscoveredJob.is_active == False,
        DiscoveredJob.scraped_at >= cutoff,
    ).order_by(DiscoveredJob.scraped_at.desc()).limit(200).all()
    return {"jobs": [discovered_to_dict(j) for j in jobs]}


async def _check_active_jobs_background():
    from database import SessionLocal
    _db = SessionLocal()
    try:
        jobs = _db.query(DiscoveredJob).filter(
            DiscoveredJob.is_active == True,
            DiscoveredJob.job_url != None,
            DiscoveredJob.job_url != "",
        ).all()
        deactivated = 0
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            for job in jobs:
                try:
                    r = await client.head(job.job_url)
                    if r.status_code in (404, 410):
                        job.is_active = False
                        deactivated += 1
                    elif r.status_code == 200:
                        # For GET-only check of ambiguous responses, do a quick GET
                        # to detect soft-404 "job no longer available" pages
                        try:
                            gr = await client.get(job.job_url, headers={"User-Agent": "Mozilla/5.0"})
                            body_lower = gr.text[:3000].lower()
                            soft_404_signals = [
                                "this job is no longer available",
                                "this position has been filled",
                                "job listing has expired",
                                "no longer accepting applications",
                                "this posting has been closed",
                                "position is no longer open",
                                "this job has been removed",
                                "job has expired",
                            ]
                            if any(sig in body_lower for sig in soft_404_signals):
                                job.is_active = False
                                deactivated += 1
                        except Exception:
                            pass
                except Exception:
                    pass  # Network error / timeout — leave active
        _db.commit()
        print(f"[CheckActive] Verified {len(jobs)} jobs, deactivated {deactivated}")
    except Exception as e:
        print(f"[CheckActive] Error: {e}")
        _db.rollback()
    finally:
        _db.close()

@app.post("/api/scrape")
async def trigger_scrape(background_tasks: BackgroundTasks):
    """Trigger a background job scrape. Uses its own DB session internally."""
    global _last_scrape_triggered
    _last_scrape_triggered = datetime.utcnow().isoformat()
    background_tasks.add_task(run_scraper)
    return {"status": "Scraping started", "message": "Job discovery agent is running. Results appear in ~30 seconds."}

@app.get("/api/scrape/status")
def get_scrape_status(db: Session = Depends(get_db)):
    # Use the time the scrape was triggered if available; otherwise fall back to latest job's scraped_at
    last_scraped = _last_scrape_triggered
    if not last_scraped:
        latest = db.query(DiscoveredJob).order_by(DiscoveredJob.scraped_at.desc()).first()
        last_scraped = latest.scraped_at.isoformat() if latest else None
    return {"last_scraped": last_scraped}


@app.get("/api/company-summary")
async def get_company_summary(company: str, description: str = ""):
    """Use Claude to generate a 1-2 sentence company summary from a job description. Cached per company."""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Anthropic API key not configured")

    cache_key = company.strip().lower()
    if cache_key in _company_summary_cache:
        return {"summary": _company_summary_cache[cache_key], "cached": True}

    context = description[:1500] if description else ""
    prompt = (
        f"Based on the following job posting, write exactly 1-2 sentences describing what {company} does "
        f"as a company — focus on their product or service and what industry they're in. "
        f"Be concrete and specific (e.g. 'Ramp is a corporate card and spend management platform that helps businesses control costs.' "
        f"or 'Anthropic is an AI safety company building large language models and AI assistants.'). "
        f"Do NOT mention the job title, role, or any hiring details.\n\n"
        f"Job posting context:\n{context}\n\n"
        f"Company description (1-2 sentences, company-focused only):"
    )

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 120,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
    if resp.status_code != 200:
        body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
        msg = body.get("error", {}).get("message", "")
        if "credit" in msg.lower() or "balance" in msg.lower():
            raise HTTPException(status_code=402, detail="Insufficient API credits")
        raise HTTPException(status_code=502, detail="Claude API error")
    summary = resp.json()["content"][0]["text"].strip()
    _company_summary_cache[cache_key] = summary
    return {"summary": summary, "cached": False}

def discovered_to_dict(j):
    return {
        "id": j.id, "company": j.company, "role": j.role, "location": j.location,
        "job_url": j.job_url, "source": j.source, "description": j.description,
        "salary_range": j.salary_range, "posted_date": j.posted_date,
        "match_score": j.match_score, "match_reasons": j.match_reasons,
        "is_active": j.is_active, "added_to_tracker": j.added_to_tracker,
        "funding_stage": j.funding_stage if hasattr(j, "funding_stage") else None,
        "employee_count": j.employee_count if hasattr(j, "employee_count") else None,
        "min_years_required": j.min_years_required if hasattr(j, "min_years_required") else None,
        "deadline": j.deadline if hasattr(j, "deadline") else None,
        "scraped_at": j.scraped_at.isoformat() if j.scraped_at else None,
    }

async def run_scraper(db: Session = None):
    """
    Core scraping logic. Creates its own DB session so it works safely
    as a FastAPI BackgroundTask (request session is closed by then).
    """
    from scraper import scrape_all_sources
    from database import SessionLocal
    results = await scrape_all_sources()
    # Always use a fresh session — never the request-scoped one
    _db = SessionLocal()
    try:
        saved = 0
        for job_data in results:
            existing = _db.query(DiscoveredJob).filter(
                DiscoveredJob.company == job_data.get("company"),
                DiscoveredJob.role == job_data.get("role"),
            ).first()
            if not existing:
                _db.add(DiscoveredJob(**job_data))
                saved += 1
            else:
                # Update job_url for existing jobs if it has changed (e.g., Ali Rohde now extracts direct links)
                new_url = job_data.get("job_url")
                if new_url and new_url != existing.job_url:
                    existing.job_url = new_url
        _db.commit()
        print(f"[Scraper] Saved {saved} new jobs to database")
    except Exception as e:
        print(f"[Scraper] DB error: {e}")
        _db.rollback()
    finally:
        _db.close()


# ─────────────────────────────────────────────
# PREFERENCES
# ─────────────────────────────────────────────

@app.get("/api/preferences")
def get_preferences(
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    if current_user:
        prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
        if not prefs:
            prefs = UserPreferences(user_id=current_user.id)
            db.add(prefs)
            db.commit()
            db.refresh(prefs)
    else:
        prefs = db.query(UserPreferences).filter(UserPreferences.user_id == None).first()
        if not prefs:
            prefs = UserPreferences()
            db.add(prefs)
            db.commit()
            db.refresh(prefs)
    return {
        "locations": json.loads(prefs.locations),
        "funding_stages": json.loads(prefs.funding_stages),
        "employee_ranges": json.loads(prefs.employee_ranges),
        "min_score": prefs.min_score,
        "enabled_sources": json.loads(prefs.enabled_sources) if prefs.enabled_sources else None,
        "preferred_roles": json.loads(prefs.preferred_roles) if prefs.preferred_roles else None,
        "preferred_work_types": json.loads(prefs.preferred_work_types) if prefs.preferred_work_types else None,
        "years_experience": prefs.years_experience,
    }

@app.put("/api/preferences")
def update_preferences(
    payload: dict,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    if current_user:
        prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
        if not prefs:
            prefs = UserPreferences(user_id=current_user.id)
            db.add(prefs)
    else:
        prefs = db.query(UserPreferences).filter(UserPreferences.user_id == None).first()
        if not prefs:
            prefs = UserPreferences()
            db.add(prefs)
    if "locations" in payload:
        prefs.locations = json.dumps(payload["locations"])
    if "funding_stages" in payload:
        prefs.funding_stages = json.dumps(payload["funding_stages"])
    if "employee_ranges" in payload:
        prefs.employee_ranges = json.dumps(payload["employee_ranges"])
    if "min_score" in payload:
        prefs.min_score = payload["min_score"]
    if "enabled_sources" in payload:
        prefs.enabled_sources = json.dumps(payload["enabled_sources"]) if payload["enabled_sources"] is not None else None
    if "preferred_roles" in payload:
        prefs.preferred_roles = json.dumps(payload["preferred_roles"]) if payload["preferred_roles"] else None
    if "preferred_work_types" in payload:
        prefs.preferred_work_types = json.dumps(payload["preferred_work_types"]) if payload["preferred_work_types"] else None
    if "years_experience" in payload:
        prefs.years_experience = payload["years_experience"] if payload["years_experience"] else None
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────
# COLLECTIONS
# ─────────────────────────────────────────────

@app.get("/api/collections")
def get_collections(db: Session = Depends(get_db)):
    colls = db.query(JobCollection).order_by(JobCollection.created_at.asc()).all()
    result = []
    for c in colls:
        count = db.query(JobCollectionItem).filter(JobCollectionItem.collection_id == c.id).count()
        result.append({
            "id": c.id, "name": c.name, "description": c.description,
            "color": c.color, "count": count,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return result

@app.post("/api/collections")
def create_collection(payload: dict, db: Session = Depends(get_db)):
    coll = JobCollection(
        name=payload.get("name", "New Folder"),
        description=payload.get("description"),
        color=payload.get("color", "#8b6bbf"),
    )
    db.add(coll)
    db.commit()
    db.refresh(coll)
    return {"id": coll.id, "name": coll.name, "description": coll.description, "color": coll.color, "count": 0}

@app.put("/api/collections/{coll_id}")
def update_collection(coll_id: int, payload: dict, db: Session = Depends(get_db)):
    coll = db.query(JobCollection).filter(JobCollection.id == coll_id).first()
    if not coll:
        raise HTTPException(status_code=404, detail="Not found")
    if "name" in payload:
        coll.name = payload["name"]
    if "description" in payload:
        coll.description = payload["description"]
    if "color" in payload:
        coll.color = payload["color"]
    db.commit()
    return {"ok": True}

@app.delete("/api/collections/{coll_id}")
def delete_collection(coll_id: int, db: Session = Depends(get_db)):
    coll = db.query(JobCollection).filter(JobCollection.id == coll_id).first()
    if not coll:
        raise HTTPException(status_code=404, detail="Not found")
    db.query(JobCollectionItem).filter(JobCollectionItem.collection_id == coll_id).delete()
    db.delete(coll)
    db.commit()
    return {"ok": True}

@app.get("/api/collections/{coll_id}/items")
def get_collection_items(coll_id: int, db: Session = Depends(get_db)):
    items = db.query(JobCollectionItem).filter(JobCollectionItem.collection_id == coll_id).all()
    job_ids = [i.discovered_job_id for i in items]
    if not job_ids:
        return {"total": 0, "jobs": []}
    jobs = db.query(DiscoveredJob).filter(DiscoveredJob.id.in_(job_ids)).all()
    return {"total": len(jobs), "jobs": [discovered_to_dict(j) for j in jobs]}

@app.post("/api/collections/{coll_id}/items")
def add_to_collection(coll_id: int, payload: dict, db: Session = Depends(get_db)):
    discovered_job_id = payload.get("discovered_job_id")
    existing = db.query(JobCollectionItem).filter(
        JobCollectionItem.collection_id == coll_id,
        JobCollectionItem.discovered_job_id == discovered_job_id,
    ).first()
    if not existing:
        db.add(JobCollectionItem(collection_id=coll_id, discovered_job_id=discovered_job_id))
        db.commit()
    return {"ok": True}

@app.delete("/api/collections/{coll_id}/items/{job_id}")
def remove_from_collection(coll_id: int, job_id: int, db: Session = Depends(get_db)):
    db.query(JobCollectionItem).filter(
        JobCollectionItem.collection_id == coll_id,
        JobCollectionItem.discovered_job_id == job_id,
    ).delete()
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────────
# RE-SCORE
# ─────────────────────────────────────────────

@app.post("/api/rescore")
async def rescore_jobs(background_tasks: BackgroundTasks):
    background_tasks.add_task(_rescore_all_jobs)
    return {"status": "Re-scoring started"}

async def _rescore_all_jobs():
    from scraper import score_job, extract_company_metadata, extract_min_years, _clean_description
    from database import SessionLocal
    _db = SessionLocal()
    try:
        jobs = _db.query(DiscoveredJob).all()
        for job in jobs:
            # Re-clean description to strip HTML entities from previously stored data
            clean_desc = _clean_description(job.description or "")
            if clean_desc and clean_desc != job.description:
                job.description = clean_desc
            score, reasons = score_job(job.company or "", job.role or "", job.location or "", clean_desc)
            job.match_score = score
            job.match_reasons = "; ".join(reasons) if reasons else ""
            if clean_desc:
                meta = extract_company_metadata(clean_desc)
                job.funding_stage = meta.get("funding_stage")
                job.employee_count = meta.get("employee_count")
                job.min_years_required = extract_min_years(clean_desc)
        _db.commit()
        print(f"[Rescore] Done — {len(jobs)} jobs rescored")
    except Exception as e:
        print(f"[Rescore] Error: {e}")
        _db.rollback()
    finally:
        _db.close()


# ─────────────────────────────────────────────
# RECRUITERS (Page 4)
# ─────────────────────────────────────────────

@app.get("/api/recruiters")
def get_recruiters(search: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Recruiter)
    if search:
        q = q.filter(or_(Recruiter.name.ilike(f"%{search}%"), Recruiter.agency.ilike(f"%{search}%"),
                         Recruiter.specialty.ilike(f"%{search}%")))
    return [recruiter_to_dict(r) for r in q.order_by(Recruiter.created_at.desc()).all()]

@app.post("/api/recruiters")
def create_recruiter(rec: RecruiterCreate, db: Session = Depends(get_db)):
    db_rec = Recruiter(**rec.dict())
    db.add(db_rec)
    db.commit()
    db.refresh(db_rec)
    return recruiter_to_dict(db_rec)

@app.put("/api/recruiters/{rec_id}")
def update_recruiter(rec_id: int, rec: RecruiterUpdate, db: Session = Depends(get_db)):
    db_rec = db.query(Recruiter).filter(Recruiter.id == rec_id).first()
    if not db_rec:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in rec.dict(exclude_none=True).items():
        setattr(db_rec, k, v)
    db_rec.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_rec)
    return recruiter_to_dict(db_rec)

@app.delete("/api/recruiters/{rec_id}")
def delete_recruiter(rec_id: int, db: Session = Depends(get_db)):
    db_rec = db.query(Recruiter).filter(Recruiter.id == rec_id).first()
    if not db_rec:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(db_rec)
    db.commit()
    return {"ok": True}

def recruiter_to_dict(r):
    return {
        "id": r.id, "name": r.name, "agency": r.agency, "email": r.email,
        "linkedin_url": r.linkedin_url, "phone": r.phone, "specialty": r.specialty,
        "agency_url": r.agency_url, "notes": r.notes, "outreach_status": r.outreach_status,
        "last_contact": r.last_contact, "is_agency": r.is_agency,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


# ─────────────────────────────────────────────
# COVER LETTER TEMPLATES
# ─────────────────────────────────────────────

@app.get("/api/cover-letter/templates")
def get_cover_letter_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    templates = db.query(CoverLetterTemplate).filter(
        CoverLetterTemplate.user_id == current_user.id
    ).order_by(CoverLetterTemplate.created_at.desc()).all()
    return [_template_to_dict(t) for t in templates]


@app.post("/api/cover-letter/templates")
def create_cover_letter_template(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = CoverLetterTemplate(
        user_id=current_user.id,
        name=payload.get("name", "My Template"),
        content=payload.get("content", ""),
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _template_to_dict(t)


@app.put("/api/cover-letter/templates/{template_id}")
def update_cover_letter_template(
    template_id: int,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.query(CoverLetterTemplate).filter(
        CoverLetterTemplate.id == template_id,
        CoverLetterTemplate.user_id == current_user.id,
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    if "name" in payload:
        t.name = payload["name"]
    if "content" in payload:
        t.content = payload["content"]
    t.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(t)
    return _template_to_dict(t)


@app.delete("/api/cover-letter/templates/{template_id}")
def delete_cover_letter_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.query(CoverLetterTemplate).filter(
        CoverLetterTemplate.id == template_id,
        CoverLetterTemplate.user_id == current_user.id,
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(t)
    db.commit()
    return {"ok": True}


@app.post("/api/cover-letter/suggest")
async def suggest_cover_letter(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="API key not configured")

    template_id = payload.get("template_id")
    job_id = payload.get("job_id")

    template = db.query(CoverLetterTemplate).filter(
        CoverLetterTemplate.id == template_id,
        CoverLetterTemplate.user_id == current_user.id,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    job = db.query(DiscoveredJob).filter(DiscoveredJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    prof = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()

    def _loads(v):
        try: return json.loads(v) if v else []
        except: return []

    skills = _loads(prof.parsed_skills) if prof else []
    roles = _loads(prof.parsed_roles) if prof else []
    school = (prof.parsed_school if prof else None) or current_user.university or ""
    gpa = (prof.parsed_gpa if prof else None) or ""

    user_msg = (
        f"Job Title: {job.role or 'N/A'}\n"
        f"Company: {job.company or 'N/A'}\n"
        f"Job Description (first 1500 chars):\n{(job.description or '')[:1500]}\n\n"
        f"Applicant's Cover Letter Template:\n{template.content}\n\n"
        f"Applicant Profile:\n"
        f"- Target roles: {', '.join(roles) if roles else 'N/A'}\n"
        f"- Skills: {', '.join(skills) if skills else 'N/A'}\n"
        f"- School: {school}\n"
        f"- GPA: {gpa}\n\n"
        "Please give me 5 specific bullet-point suggestions to tailor this cover letter template "
        "for THIS specific job. Focus on what to add, change, or emphasize. "
        "Return your response as a JSON array of strings (just the array, no other text)."
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5",
                    "max_tokens": 1024,
                    "system": "You are a career coach helping a job applicant tailor their cover letter. Be specific, concise, and actionable.",
                    "messages": [{"role": "user", "content": user_msg}],
                },
            )
            if resp.status_code != 200:
                data = resp.json()
                raise HTTPException(status_code=502, detail=f"Anthropic API error: {data.get('error', {}).get('message', 'Unknown')}")
            data = resp.json()
            text = data["content"][0]["text"].strip()
            # Try to parse JSON array from response
            try:
                suggestions = json.loads(text)
                if not isinstance(suggestions, list):
                    suggestions = [text]
            except Exception:
                # Fallback: extract array portion
                start = text.find("[")
                end = text.rfind("]") + 1
                if start >= 0 and end > start:
                    try:
                        suggestions = json.loads(text[start:end])
                    except Exception:
                        suggestions = [text]
                else:
                    suggestions = [text]
            return {"suggestions": suggestions}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error calling Anthropic API: {str(e)}")


def _template_to_dict(t: CoverLetterTemplate) -> dict:
    return {
        "id": t.id,
        "user_id": t.user_id,
        "name": t.name,
        "content": t.content,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


# ─────────────────────────────────────────────
# EMAIL TEMPLATES
# ─────────────────────────────────────────────

@app.get("/api/email-templates")
def get_email_templates(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    templates = db.query(EmailTemplate).filter(
        EmailTemplate.user_id == current_user.id
    ).order_by(EmailTemplate.created_at.desc()).all()
    return [_email_template_to_dict(t) for t in templates]

@app.post("/api/email-templates")
def create_email_template(payload: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = EmailTemplate(
        user_id=current_user.id,
        name=payload.get("name", "New Template"),
        subject=payload.get("subject"),
        body=payload.get("body", ""),
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _email_template_to_dict(t)

@app.put("/api/email-templates/{template_id}")
def update_email_template(template_id: int, payload: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(EmailTemplate).filter(
        EmailTemplate.id == template_id,
        EmailTemplate.user_id == current_user.id,
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    if "name" in payload:
        t.name = payload["name"]
    if "subject" in payload:
        t.subject = payload["subject"]
    if "body" in payload:
        t.body = payload["body"]
    t.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(t)
    return _email_template_to_dict(t)

@app.delete("/api/email-templates/{template_id}")
def delete_email_template(template_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(EmailTemplate).filter(
        EmailTemplate.id == template_id,
        EmailTemplate.user_id == current_user.id,
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(t)
    db.commit()
    return {"ok": True}

def _email_template_to_dict(t: EmailTemplate) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "subject": t.subject,
        "body": t.body,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


# ─────────────────────────────────────────────
# NETWORKING DISCOVER + EMAIL GENERATION
# ─────────────────────────────────────────────

import re as _re

@app.post("/api/networking/discover")
async def networking_discover(
    payload: dict,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    company_name = payload.get("company_name", "").strip()
    domain = payload.get("domain", "").strip()

    if not company_name:
        raise HTTPException(status_code=400, detail="company_name is required")

    # Guess domain if not provided
    if not domain:
        domain = _re.sub(r"[^a-z0-9]", "", company_name.lower()) + ".com"

    # Fetch user schools for relevance scoring
    user_schools = []
    if current_user:
        if current_user.university:
            user_schools.append(current_user.university.lower())
        if getattr(current_user, "high_school", None):
            user_schools.append(current_user.high_school.lower())
        if getattr(current_user, "grad_school", None):
            user_schools.append(current_user.grad_school.lower())

    people = []

    # 1. Hunter.io domain search
    hunter_key = os.getenv("HUNTER_API_KEY", "")
    if hunter_key:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    "https://api.hunter.io/v2/domain-search",
                    params={"domain": domain, "api_key": hunter_key, "limit": 25, "type": "personal"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for e in data.get("data", {}).get("emails", []):
                        full_name = f"{e.get('first_name','')} {e.get('last_name','')}".strip()
                        if full_name or e.get("value"):
                            people.append({
                                "name": full_name or e.get("value", ""),
                                "title": e.get("position", ""),
                                "email": e.get("value", ""),
                                "linkedin_url": e.get("linkedin", ""),
                                "company": company_name,
                                "source": "Hunter.io",
                                "description": "",
                            })
        except Exception:
            pass

    # 2. Apollo search
    apollo_key = os.getenv("APOLLO_API_KEY", "")
    if apollo_key:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://api.apollo.io/api/v1/mixed_people/api_search",
                    headers={"Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": apollo_key},
                    json={
                        "q_organization_name": company_name,
                        "person_seniority": ["manager", "director", "vp", "c_suite", "founder", "partner"],
                        "page": 1,
                        "per_page": 25,
                    },
                    timeout=15.0,
                )
                if resp.status_code == 200:
                    rdata = resp.json()
                    for p in rdata.get("people", []):
                        title = p.get("title", "") or ""
                        email = p.get("email", "") or ""
                        people.append({
                            "name": p.get("name", ""),
                            "title": title,
                            "email": email,
                            "linkedin_url": p.get("linkedin_url", ""),
                            "company": company_name,
                            "source": "Apollo",
                            "description": p.get("headline", ""),
                        })
        except Exception:
            pass

    # Deduplicate by email then name
    seen_emails = set()
    seen_names = set()
    deduped = []
    for p in people:
        key_email = (p.get("email") or "").lower().strip()
        key_name = (p.get("name") or "").lower().strip()
        if key_email and key_email in seen_emails:
            continue
        if not key_email and key_name and key_name in seen_names:
            continue
        if key_email:
            seen_emails.add(key_email)
        if key_name:
            seen_names.add(key_name)
        deduped.append(p)

    # Compute relevance scores
    RECRUITER_TERMS = ["recruit", "talent", "hr", "human resources", "hiring"]
    TARGET_ROLE_TERMS = ["strategy", "operations", "biz ops", "chief of staff", "growth",
                         "business development", "product", "analyst", "partnerships"]
    SENIOR_TERMS = ["vp", "director", "head of", "chief", "c-suite", "partner", "managing director"]

    result = []
    for p in deduped:
        score = 0
        reasons = []
        title_lower = (p.get("title") or "").lower()
        desc_lower = (p.get("description") or "").lower()
        combined = title_lower + " " + desc_lower

        # Alumni signal
        if user_schools:
            for school in user_schools:
                if school and school in combined:
                    score += 35
                    reasons.append("Alumni match")
                    break

        # Recruiter signal
        if any(t in title_lower for t in RECRUITER_TERMS):
            score += 25
            reasons.append("Recruiter at this company")

        # Target role signal
        if any(t in title_lower for t in TARGET_ROLE_TERMS):
            score += 20
            reasons.append("Works in your target function")

        # Mid-level signal
        if not any(t in title_lower for t in SENIOR_TERMS):
            score += 10
            reasons.append("Approachable seniority level")

        # Has email signal
        if p.get("email"):
            score += 10
            reasons.append("Email available")

        result.append({
            "name": p["name"],
            "title": p["title"],
            "email": p["email"],
            "linkedin_url": p["linkedin_url"],
            "company": p["company"],
            "source": p["source"],
            "relevance_score": min(score, 100),
            "relevance_reasons": reasons,
        })

    result.sort(key=lambda x: x["relevance_score"], reverse=True)
    return result


@app.post("/api/networking/generate-email")
async def generate_networking_email(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "") or ANTHROPIC_API_KEY
    if not anthropic_key:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={"error": "API key not configured"})

    contact_name = payload.get("contact_name", "")
    contact_title = payload.get("contact_title", "")
    contact_company = payload.get("contact_company", "")
    template_id = payload.get("template_id")
    job_context = payload.get("job_context", "")
    user_notes = payload.get("user_notes", "")
    tone = payload.get("tone", "warm")           # warm | direct | formal
    alumni_context = payload.get("alumni_context", "")  # e.g. "Both attended Duke"
    contact_job_url = payload.get("contact_job_url", "")

    # Fetch template if provided
    template_body = ""
    if template_id:
        tmpl = db.query(EmailTemplate).filter(
            EmailTemplate.id == template_id,
            EmailTemplate.user_id == current_user.id,
        ).first()
        if tmpl:
            template_body = tmpl.body

    # Fetch company website context
    company_context = ""
    if contact_company:
        company_context = await _fetch_company_context(contact_company, contact_job_url)

    # Get sender's resume snippets
    prof = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    resume_snippet = ""
    if prof and prof.resume_text:
        resume_snippet = prof.resume_text[:1200]

    # Build rich prompt
    sender_parts = [current_user.name]
    if current_user.university:
        sender_parts.append(current_user.university)
    if current_user.major:
        sender_parts.append(current_user.major)
    if current_user.graduation_year:
        sender_parts.append(f"Class of {current_user.graduation_year}")

    context_lines = [
        f"Sender: {', '.join(sender_parts)}",
        f"Recipient: {contact_name}, {contact_title} at {contact_company}",
    ]
    if alumni_context:
        context_lines.append(f"Shared connection: {alumni_context}")
    if job_context:
        context_lines.append(f"Role of interest: {job_context}")
    if user_notes:
        context_lines.append(f"Specific talking points: {user_notes}")
    if company_context:
        context_lines.append(f"About {contact_company} (from their site):\n{company_context[:900]}")
    if resume_snippet:
        context_lines.append(f"Sender's background:\n{resume_snippet}")
    if template_body:
        context_lines.append(f"Base template to adapt:\n{template_body}")

    tone_instructions = {
        "warm":   "conversational and genuine — like a message to someone you'd like to know",
        "direct": "efficient and to the point — no pleasantries, lead with value",
        "formal": "professional and respectful — suitable for senior executives",
    }

    system_prompt = (
        "You are a career coach writing a personalized networking email on behalf of the sender. "
        f"Tone: {tone_instructions.get(tone, tone_instructions['warm'])}. "

        "ABSOLUTE RULE — NO HALLUCINATION: Only use facts, experiences, and background details explicitly provided in the context below. "
        "Never invent achievements, projects, relationships, or shared history not stated. Omit rather than fabricate. "

        "FORMATTING RULES: Never use em dashes (—) or en dashes anywhere in the email — they read as AI-generated. "
        "Use short sentences. No bullet points. No formal salutations like 'I hope this message finds you well'. "
        "Write the way a real, sharp person actually emails someone cold. "

        "WHAT MAKES A GREAT COLD EMAIL: "
        "(1) Open with a specific, genuine observation about the recipient's work, company, or a recent thing they did — not a compliment, a connection. "
        "E.g. 'Saw the [Company] Series B announcement — the focus on [specific thing] caught my attention.' or "
        "'Your team's work on [specific product/initiative] is exactly the kind of problem I've been thinking about.' "
        "(2) One crisp sentence on who the sender is and why it's relevant — not their life story. "
        "(3) One concrete, specific ask. Not 'pick your brain' — something like 'Would you be open to a 15-minute call?' or 'Happy to share what I've been working on if useful.' "
        "(4) Under 100 words total. Shorter is almost always better. "
        "(5) Subject line: specific, not salesy. E.g. 'Quick question re: [Company] ops role' or 'Intro from a [shared school] alum'. "

        "Return JSON only: {\"subject\": \"...\", \"body\": \"...\"}"
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": anthropic_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5",
                    "max_tokens": 700,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": "\n".join(context_lines)}],
                },
            )
        if resp.status_code != 200:
            try:
                err_body = resp.json()
                err_msg = err_body.get("error", {}).get("message", f"HTTP {resp.status_code}")
            except Exception:
                err_msg = f"HTTP {resp.status_code}"
            raise HTTPException(status_code=502, detail=f"AI error: {err_msg}")
        data = resp.json()
        text = data.get("content", [{}])[0].get("text", "")
        # Strip em dashes and en dashes — they're AI tells
        text = text.replace("\u2014", " - ").replace("\u2013", " - ")
        import json as _json
        try:
            json_match = _re.search(r'\{.*\}', text, _re.DOTALL)
            if json_match:
                parsed = _json.loads(json_match.group())
                return {"subject": parsed.get("subject", ""), "body": parsed.get("body", "")}
        except Exception:
            pass
        return {"subject": "", "body": text}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# SIMILAR JOBS
# ─────────────────────────────────────────────

STOPWORDS = {"and", "of", "the", "a", "an", "for", "in", "at"}

@app.get("/api/discovered-jobs/{job_id}/similar")
def get_similar_jobs(job_id: int, db: Session = Depends(get_db)):
    target = db.query(DiscoveredJob).filter(DiscoveredJob.id == job_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Job not found")

    # Extract role keywords from the target job
    role_words = [
        w.lower() for w in (target.role or "").split()
        if w.lower() not in STOPWORDS and len(w) > 1
    ]

    # Fetch candidate jobs: active, not the same job, score > 30
    candidates = db.query(DiscoveredJob).filter(
        DiscoveredJob.is_active == True,
        DiscoveredJob.id != job_id,
        DiscoveredJob.match_score > 30,
    ).all()

    # Rank by keyword overlap in role field
    def _overlap_score(j):
        j_role_lower = (j.role or "").lower()
        j_desc_lower = (j.description or "").lower()
        hits = sum(1 for w in role_words if w in j_role_lower or w in j_desc_lower)
        return hits

    ranked = sorted(candidates, key=lambda j: (_overlap_score(j), j.match_score or 0), reverse=True)
    top4 = ranked[:4]
    return [discovered_to_dict(j) for j in top4]


# ─────────────────────────────────────────────
# DASHBOARD STATS
# ─────────────────────────────────────────────

@app.get("/api/stats")
def get_all_stats(
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    from datetime import timedelta

    # User-scoped tracker jobs
    job_q = db.query(Job)
    if current_user:
        job_q = job_q.filter(or_(Job.user_id == current_user.id, Job.user_id == None))

    jobs = job_q.all()

    # Status counts — new canonical statuses
    status_counts = {}
    for j in jobs:
        s = j.status or "Not Applied"
        status_counts[s] = status_counts.get(s, 0) + 1

    not_applied  = status_counts.get("Not Applied", 0)
    under_review = status_counts.get("Under Review", 0)
    interviewing = status_counts.get("Interviewing", 0)
    accepted     = status_counts.get("Accepted", 0)
    rejected     = status_counts.get("Rejected", 0)

    # New jobs discovered in last 24 hours
    cutoff_24h = datetime.utcnow() - timedelta(hours=24)
    new_today = db.query(DiscoveredJob).filter(
        DiscoveredJob.is_active == True,
        DiscoveredJob.scraped_at >= cutoff_24h,
    ).count()

    # Total undiscovered (not yet added)
    total_undiscovered = db.query(DiscoveredJob).filter(
        DiscoveredJob.is_active == True,
        DiscoveredJob.added_to_tracker == False,
    ).count()

    return {
        "not_applied":       not_applied,
        "under_review":      under_review,
        "interviewing":      interviewing,
        "accepted":          accepted,
        "rejected":          rejected,
        "new_jobs_today":    new_today,
        "total_undiscovered": total_undiscovered,
        # legacy fields kept for backward compat
        "total_jobs":        len(jobs),
        "status_counts":     status_counts,
    }


# ─────────────────────────────────────────────
# RECRUITMENT COACH
# ─────────────────────────────────────────────

import re as _re2

ATS_DOMAINS = {
    "greenhouse.io", "lever.co", "ashby.io", "ashbyhq.com", "workable.com",
    "linkedin.com", "indeed.com", "wellfound.com", "ycombinator.com",
    "news.ycombinator.com", "jobs.lever.co", "boards.greenhouse.io",
}

async def _fetch_company_context(company_name: str, job_url: str = "") -> str:
    """Fetch company homepage text for AI context. Returns up to 2500 chars of cleaned text."""
    domain = ""
    if job_url:
        try:
            from urllib.parse import urlparse
            parsed_url = urlparse(job_url)
            host = parsed_url.netloc.lower().lstrip("www.")
            if not any(ats in host for ats in ATS_DOMAINS):
                domain = f"https://www.{host}"
        except Exception:
            pass

    # Fallback: guess from company name
    if not domain:
        slug = _re2.sub(r'[^a-z0-9]', '', company_name.lower())
        domain = f"https://www.{slug}.com"

    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(domain, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200:
                html = resp.text
                # Strip scripts, styles, tags
                html = _re2.sub(r'<script[^>]*>.*?</script>', ' ', html, flags=_re2.DOTALL | _re2.IGNORECASE)
                html = _re2.sub(r'<style[^>]*>.*?</style>', ' ', html, flags=_re2.DOTALL | _re2.IGNORECASE)
                html = _re2.sub(r'<[^>]+>', ' ', html)
                html = _re2.sub(r'\s+', ' ', html).strip()
                return html[:2500]
    except Exception:
        pass
    return ""


def _call_claude_json(prompt: str, system: str, max_tokens: int = 2000) -> dict:
    """Synchronous helper — use only in async endpoints via await asyncio.to_thread."""
    raise NotImplementedError("Use async version")


async def _call_claude_json_async(prompt: str, system: str = "Return only valid JSON. Never use em dashes (—) or en dashes in any text values.", max_tokens: int = 2000) -> dict:
    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5",
                "max_tokens": max_tokens,
                "system": system,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
    if resp.status_code != 200:
        try:
            err_body = resp.json()
            err_msg = err_body.get("error", {}).get("message", f"HTTP {resp.status_code}")
        except Exception:
            err_msg = f"HTTP {resp.status_code}"
        raise HTTPException(status_code=502, detail=f"AI error: {err_msg}")
    text = resp.json()["content"][0]["text"].strip()
    # Strip em dashes and en dashes before parsing — they're AI tells and must never appear in output
    text = text.replace("\u2014", " - ").replace("\u2013", " - ")
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start == -1 or end <= start:
            raise ValueError("No JSON object found in response")
        return json.loads(text[start:end])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not parse AI response: {str(e)[:120]}")


@app.post("/api/coach/scan-resume")
async def coach_scan_resume(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyze a resume with annotated, severity-coded suggestions."""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="API key not configured")

    prof = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    resume_text = (prof.resume_text if prof else "") or payload.get("resume_text", "")
    if not resume_text:
        raise HTTPException(status_code=400, detail="No resume found. Please upload your resume in Profile first.")

    job_description = payload.get("job_description", "")
    company_name = payload.get("company", "")
    job_url = payload.get("job_url", "")

    company_context = ""
    if job_url or company_name:
        company_context = await _fetch_company_context(company_name, job_url)

    context_section = ""
    if company_context:
        context_section += f"\nCompany website ({company_name}):\n{company_context[:1800]}\n"
    if job_description:
        context_section += f"\nTarget job description:\n{job_description[:1200]}\n"

    prompt = f"""You are a senior career coach doing a deep resume review. Read the full resume before writing any feedback — understand the career story being told, then give section-by-section coaching.

ABSOLUTE RULE — NO HALLUCINATION: Never invent, assume, or fabricate any fact, metric, company, project, skill, or achievement. Every rewrite must use only words and facts present in the provided resume text. Where a metric is missing, use [add: the specific number/% you achieved] as a placeholder the applicant fills in — do NOT invent one.

TONE RULE: Detect the writing register of the resume (e.g. "formal and passive", "active and punchy", "conversational first-person") and preserve it in every rewrite suggestion.
{context_section}
Resume:
{resume_text[:3500]}

Return ONLY this JSON — no commentary outside it:
{{
  "overall_score": <integer 0-100>,
  "tone_detected": "<brief description of the resume's current writing style>",
  "narrative_summary": "<3-4 sentences: what career story does this resume tell, is the trajectory clear, what is the single most important thing to fix, and what is genuinely strong>",
  "role_context": {{
    "company_overview": "<2-3 sentences about what this company does, their stage, and what they are known for — sourced from the company website context above. Write 'No company selected' if none was provided.>",
    "role_overview": "<2-3 sentences on what this type of role typically involves day-to-day and what skills/traits companies hiring for it prioritize — sourced from the job description if provided, otherwise from general knowledge of the role type>",
    "what_they_evaluate": ["<key thing evaluators look for in a strong resume for this role>", "<key thing 2>", "<key thing 3>"]
  }},
  "jd_alignment": {{
    "strong": ["<requirement or keyword from the JD that the resume clearly addresses>"],
    "partial": ["<requirement that is touched on but could be made more explicit or stronger>"],
    "gaps": ["<requirement in the JD that is not addressed in the resume — state it neutrally, do not suggest fabricating experience>"]
  }},
  "sections": [
    {{
      "name": "<section name, e.g. 'Work Experience – Acme Corp' or 'Education' or 'Skills'>",
      "section_note": "<1 sentence on the overall quality of this section>",
      "suggestions": [
        {{
          "severity": "rewrite" | "strengthen" | "good",
          "excerpt": "<exact quote from the resume, max 15 words>",
          "rewrite": "<restructured version using ONLY the existing facts, preserving the detected tone — use [add: X] for any missing data>",
          "explanation": "<what structural issue was fixed; if a placeholder was used, tell the applicant exactly what data to gather>",
          "category": "impact" | "specificity" | "relevance" | "keyword" | "format" | "tone"
        }}
      ]
    }}
  ]
}}

Severity rules:
- "rewrite": passive voice, vague verb, no result stated, or actively hurts the application
- "strengthen": solid but could be sharper, more specific, or better quantified
- "good": genuinely strong — include to show what is working and why

Omit "jd_alignment" entirely if no job description was provided.
Cover every meaningful section. Return 2-3 suggestions per section, mix of severity levels."""

    result = await _call_claude_json_async(prompt, max_tokens=4000)
    return result


@app.post("/api/coach/cover-letter")
async def coach_cover_letter(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyze a cover letter with company-informed suggestions and idea prompts."""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="API key not configured")

    cover_letter = payload.get("cover_letter", "").strip()
    if not cover_letter:
        raise HTTPException(status_code=400, detail="No cover letter text provided")

    job_id = payload.get("job_id")
    job_description = payload.get("job_description", "")
    company_name = payload.get("company", "")
    job_url = payload.get("job_url", "")

    # Pull job details from tracker if id provided
    if job_id:
        job = db.query(Job).filter(Job.id == int(job_id), Job.user_id == current_user.id).first()
        if job:
            company_name = company_name or (job.company or "")
            job_url = job_url or (job.job_url or "")

    company_context = ""
    if company_name or job_url:
        company_context = await _fetch_company_context(company_name, job_url)

    prof = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()

    def _loads(v):
        try: return json.loads(v) if v else []
        except: return []

    resume_text = (prof.resume_text if prof else "") or ""
    skills = _loads(prof.parsed_skills if prof else None)
    roles  = _loads(prof.parsed_roles  if prof else None)

    context_parts = []
    if company_context:
        context_parts.append(f"Company website ({company_name}):\n{company_context[:2000]}")
    if job_description:
        context_parts.append(f"Job description:\n{job_description[:1200]}")
    if resume_text:
        context_parts.append(f"Applicant resume:\n{resume_text[:1800]}")
    if skills:
        context_parts.append(f"Key skills: {', '.join(skills[:20])}")
    if roles:
        context_parts.append(f"Target roles: {', '.join(roles[:8])}")

    prompt = f"""You are a senior career coach reviewing a cover letter for {company_name or 'this company'}. Read the entire letter first to understand the argument and narrative arc before giving feedback. A cover letter is a story, not a list — your feedback must reflect that.

ABSOLUTE RULE — NO HALLUCINATION: Never invent, fabricate, or assume any experience, skill, achievement, metric, or fact about the applicant. Any rewrite must restructure only the applicant's own words. Where a specific fact is needed but missing, use [add: X] as a placeholder they must fill in themselves.

TONE RULE: Identify the register of this letter (e.g. "formal and measured", "conversational and direct", "enthusiastic and personal") and preserve it exactly in every suggested rewrite. Do not make a casual writer sound formal or vice versa.

{chr(10).join(context_parts) if context_parts else ''}

Cover letter:
{cover_letter[:3500]}

Return ONLY this JSON — no commentary outside it:
{{
  "company_insight": "<2 sentences grounded in the company website context above — what they do and what they value; if no website context was provided write 'No company context available'>",
  "overall_score": <integer 0-100>,
  "tone_detected": "<description of the letter's writing register, e.g. 'conversational, first-person, warm and direct'>",
  "overall_arc": "<3-4 sentences: does the letter make a coherent argument? does it answer 'why this company, why this role, why me'? what is the strongest moment and where does it lose momentum — based only on what is written>",
  "role_context": {{
    "company_overview": "<2-3 sentences about what this company does, their stage, and what they are known for — sourced from the company website context. Write 'No company selected' if none was provided.>",
    "role_overview": "<2-3 sentences on what this type of role typically involves and what hiring managers prioritize when reviewing cover letters for it — sourced from the job description if provided, otherwise from general knowledge>",
    "what_they_evaluate": ["<key thing hiring managers look for in a cover letter for this role>", "<key thing 2>", "<key thing 3>"]
  }},
  "jd_alignment": {{
    "strong": ["<aspect of the cover letter that directly addresses a key requirement or theme in the JD>"],
    "partial": ["<aspect that partially aligns but could be made more explicit or compelling>"],
    "gaps": ["<requirement or theme in the JD that is not addressed anywhere in the cover letter>"]
  }},
  "paragraphs": [
    {{
      "label": "<Opening | Body – [theme] | Closing>",
      "preview": "<first 8-10 words of this paragraph verbatim>",
      "rating": "strong" | "developing" | "weak",
      "assessment": "<2-3 sentences on what this paragraph does and doesn't accomplish in the overall argument>",
      "suggestion": "<specific structural coaching: what to do differently and why — do NOT rewrite for them unless rewrite field is used>",
      "rewrite": "<only if the paragraph needs structural restructuring: a revised version using ONLY the applicant's own facts and words, in their detected tone — use [add: X] for anything they must supply. Omit this field if the paragraph is strong.>"
    }}
  ],
  "idea_prompts": [
    "<a specific question to help the applicant discover a real connection between their background and this company — phrased as a question, e.g. 'Does your experience with X at [their employer] connect to {company_name}'s work on Y? If so, name it explicitly.'>"
  ]
}}

Rules:
- Analyze every paragraph — opening, each body paragraph, closing
- Rewrites preserve the applicant's detected tone and use only their existing facts
- idea_prompts are questions that prompt self-reflection, not assertions about what they did
- Omit jd_alignment entirely if no job description was provided
- Return ONLY the JSON"""

    result = await _call_claude_json_async(prompt, max_tokens=4000)
    return result


@app.post("/api/coach/application-question")
async def coach_application_question(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Guide a user on answering an application question using their resume."""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="API key not configured")

    question = payload.get("question", "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="No question provided")

    company_name = payload.get("company", "")
    job_description = payload.get("job_description", "")
    job_id = payload.get("job_id")
    job_url = payload.get("job_url", "")

    # Pull job details from tracker if id provided
    if job_id:
        job = db.query(Job).filter(Job.id == int(job_id), Job.user_id == current_user.id).first()
        if job:
            company_name = company_name or (job.company or "")
            job_url = job_url or (job.job_url or "")

    # Fetch company website context
    company_context = ""
    if company_name or job_url:
        company_context = await _fetch_company_context(company_name, job_url)

    prof = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()

    def _loads(v):
        try: return json.loads(v) if v else []
        except: return []

    resume_text = (prof.resume_text if prof else "") or ""
    skills = _loads(prof.parsed_skills if prof else None)

    context_parts = []
    if company_context:
        context_parts.append(f"Company website ({company_name}):\n{company_context[:2000]}")
    if job_description:
        context_parts.append(f"Job description:\n{job_description[:1000]}")
    if resume_text:
        context_parts.append(f"Applicant resume:\n{resume_text[:2500]}")
    if skills:
        context_parts.append(f"Key skills: {', '.join(skills[:20])}")

    context = "\n\n".join(context_parts)

    prompt = f"""You are a career coach helping an applicant craft a strong answer to an application question. First, identify what the question is really testing — then coach them on how to answer it using their actual background.

ABSOLUTE RULE — NO HALLUCINATION: You are a coach, not a ghostwriter. Never fabricate experiences, achievements, projects, metrics, or facts. Every resume hook must directly quote or paraphrase something explicitly present in the provided resume text. If the resume lacks a directly relevant example, be honest about that gap and describe the type of experience needed — do not invent one.

{context}

Application question: "{question}"

Return ONLY this JSON — no commentary outside it:
{{
  "question_intent": "<2 sentences: what is this question actually testing? what does the evaluator want to learn about the candidate?>",
  "role_context": {{
    "company_overview": "<2-3 sentences about what this company does and what they value — sourced from the company website context above. Write 'No company selected' if none was provided.>",
    "role_overview": "<2-3 sentences on what this type of role involves and what this company likely values in candidates — sourced from the job description if provided, otherwise from general knowledge of the role>"
  }},
  "answer_strategy": "<2-3 sentences: the best structural approach for this specific question — what to lead with, what to build toward, what tone to use>",
  "outline": {{
    "opening": "<coaching advice for the opening — what moment or framing to start with, referencing a real role/experience from their resume if one fits, or describing the type of story needed if not>",
    "body_points": [
      "<specific coaching point — if a real resume item fits, name it and explain how to frame it; if not, describe the type of evidence the answer needs>",
      "<coaching point 2>",
      "<coaching point 3>"
    ],
    "closing": "<what the answer should land on to leave the strongest impression>"
  }},
  "resume_hooks": [
    "<identify a specific item from the resume — quote or closely paraphrase it — and explain exactly how to connect it to this question. Only include items that actually appear in the provided resume text.>"
  ],
  "watch_out": "<the single most common way candidates undermine themselves on this type of question>"
}}

Return ONLY the JSON."""

    result = await _call_claude_json_async(prompt, max_tokens=1800)
    return result


# ─────────────────────────────────────────────
# EVENTS
# ─────────────────────────────────────────────

# In-memory cache for events — keyed by location string so each city is cached separately
_events_cache: dict = {}   # { location_key: {"data": [], "fetched_at": float} }

@app.get("/api/events")
async def get_events(location: str = "all", event_type: str = "all"):
    import time as _time

    loc_key = (location or "all").strip().lower()

    # Return cached data for this location if fresh (2 hours)
    entry = _events_cache.get(loc_key)
    cache_age = (_time.time() - entry["fetched_at"]) if entry and entry.get("fetched_at") else 999
    if cache_age < 7200 and entry and entry.get("data") is not None:
        data = entry["data"]
    else:
        data = await _fetch_events(location)
        _events_cache[loc_key] = {"data": data, "fetched_at": _time.time()}

    # Apply event type filter
    results = data
    if event_type != "all":
        results = [e for e in results if event_type.lower() in (e.get("event_type") or "").lower()]

    if not data and not results:
        # Return 503 only when no location was given and there are truly no results
        # (i.e. scraping is broken) — for now just return empty gracefully
        pass

    return {"events": results, "total": len(results)}


# ── Eventbrite location slug helper ───────────────────────────────────────────
# Maps common city names to Eventbrite URL slugs  (city--state / city--country)
_EB_SLUG_MAP = {
    "new york":       "ny--new-york",
    "new york, ny":   "ny--new-york",
    "nyc":            "ny--new-york",
    "san francisco":  "ca--san-francisco",
    "san francisco, ca": "ca--san-francisco",
    "sf":             "ca--san-francisco",
    "los angeles":    "ca--los-angeles",
    "los angeles, ca":"ca--los-angeles",
    "la":             "ca--los-angeles",
    "chicago":        "il--chicago",
    "chicago, il":    "il--chicago",
    "boston":         "ma--boston",
    "boston, ma":     "ma--boston",
    "austin":         "tx--austin",
    "austin, tx":     "tx--austin",
    "seattle":        "wa--seattle",
    "seattle, wa":    "wa--seattle",
    "miami":          "fl--miami",
    "miami, fl":      "fl--miami",
    "washington dc":  "dc--washington",
    "dc":             "dc--washington",
    "atlanta":        "ga--atlanta",
    "denver":         "co--denver",
    "dallas":         "tx--dallas",
    "houston":        "tx--houston",
    "philadelphia":   "pa--philadelphia",
    "london":         "uk--london",
    "toronto":        "on--toronto",
    "virtual":        "online",
    "online":         "online",
    "remote":         "online",
}

def _location_to_eb_slug(location: str) -> str:
    """Convert a city name to Eventbrite URL slug."""
    loc = location.strip().lower()
    if loc in _EB_SLUG_MAP:
        return _EB_SLUG_MAP[loc]
    # Generic fallback: lowercase, replace spaces/commas with hyphens
    parts = [p.strip() for p in loc.replace(",", " ").split() if p.strip()]
    return "--".join(parts) if parts else "online"


async def _fetch_events(location: str = "all") -> list:
    """Scrape recruitment events from Eventbrite's public search pages. No API key needed."""
    import re as _re, json as _json

    loc = (location or "all").strip().lower()
    is_virtual = loc in ("virtual", "online", "remote", "all", "")

    # Build search URLs: tech networking + career fair + recruiting
    eb_slug = _location_to_eb_slug(loc) if not is_virtual else "online"

    search_combos = [
        (eb_slug, "tech-networking"),
        (eb_slug, "career-fair"),
        (eb_slug, "recruiting"),
        (eb_slug, "startup-networking"),
    ]
    if not is_virtual:
        # Also pull virtual events alongside in-person
        search_combos.append(("online", "tech-networking"))

    events = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    async with httpx.AsyncClient(timeout=20.0, headers=headers, follow_redirects=True) as client:
        for eb_loc, keyword in search_combos:
            url = f"https://www.eventbrite.com/d/{eb_loc}/{keyword}/"
            try:
                resp = await client.get(url, timeout=12.0)
                if resp.status_code != 200:
                    continue

                # Extract embedded JSON
                match = _re.search(r'window\.__SERVER_DATA__\s*=\s*(\{.+)', resp.text, _re.DOTALL)
                if not match:
                    continue
                raw = match.group(1)
                depth = 0
                end = 0
                for i, c in enumerate(raw):
                    if c == "{": depth += 1
                    elif c == "}":
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break
                try:
                    data = _json.loads(raw[:end])
                except _json.JSONDecodeError:
                    continue

                results = (data.get("search_data") or {}).get("events", {}).get("results", [])
                for ev in results:
                    name = ev.get("name", "").strip()
                    ev_url = ev.get("url") or ev.get("parent_url", "")
                    start_date = ev.get("start_date", "")
                    start_time = ev.get("start_time", "")
                    end_date = ev.get("end_date", "")
                    end_time = ev.get("end_time", "")
                    summary = (ev.get("summary") or "")[:400]
                    is_online = ev.get("is_online_event", False)
                    is_cancelled = ev.get("is_cancelled") or False

                    venue_obj = ev.get("primary_venue") or {}
                    addr_obj = venue_obj.get("address") or {}
                    venue_name = venue_obj.get("name", "")
                    city = addr_obj.get("city", "") or ("Virtual" if is_online else "")
                    state = addr_obj.get("region", "")
                    display_addr = f"{venue_name}, {city}" if venue_name and city else (venue_name or city or ("Online" if is_online else ""))

                    # Tickets / price — check tickets_by
                    tickets_url = ev.get("tickets_url") or ev_url
                    is_free = False  # We can't know for sure from this data, default paid

                    start_iso = f"{start_date}T{start_time}" if start_date and start_time else start_date
                    end_iso = f"{end_date}T{end_time}" if end_date and end_time else end_date

                    if not name or not start_date or is_cancelled:
                        continue

                    # Skip past events
                    try:
                        from datetime import datetime as _dt
                        if _dt.strptime(start_date, "%Y-%m-%d") < _dt.now():
                            continue
                    except Exception:
                        pass

                    # Classify event type
                    text_lower = name.lower() + " " + summary.lower()
                    if any(w in text_lower for w in ["career fair", "job fair", "hiring fair", "recruiting fair"]):
                        etype = "Career Fair"
                    elif any(w in text_lower for w in ["workshop", "bootcamp", "training", "seminar", "webinar"]):
                        etype = "Workshop"
                    elif any(w in text_lower for w in ["conference", "summit", "forum", "expo", "symposium"]):
                        etype = "Conference"
                    elif any(w in text_lower for w in ["info session", "information session", "office hour", "open house"]):
                        etype = "Info Session"
                    else:
                        etype = "Networking"

                    image = ""
                    img_obj = ev.get("image") or {}
                    image = (img_obj.get("image_sizes") or {}).get("medium", "") or img_obj.get("url", "")

                    events.append({
                        "id": ev.get("id") or ev.get("eid", ""),
                        "title": name,
                        "description": summary,
                        "start_date": start_iso,
                        "end_date": end_iso,
                        "url": ev_url or tickets_url,
                        "is_free": is_free,
                        "capacity": None,
                        "venue": display_addr,
                        "city": city or (f"{city}, {state}".strip(", ")),
                        "organizer": "",
                        "event_type": etype,
                        "source": "Eventbrite",
                        "is_online": is_online,
                        "image": image,
                    })
            except Exception as e:
                print(f"[Events] Scrape error {url}: {e}")

    # Deduplicate by title+date
    seen = set()
    unique = []
    for e in events:
        key = f"{e['title'].lower().strip()[:60]}|{(e['start_date'] or '')[:10]}"
        if key not in seen:
            seen.add(key)
            unique.append(e)

    unique.sort(key=lambda x: x.get("start_date", ""))
    print(f"[Events] {len(unique)} events scraped for location='{location}'")
    return unique


# ── News endpoints ─────────────────────────────────────────────────────────────

# In-memory cache for news
_news_cache: dict = {"data": [], "fetched_at": None}

@app.get("/api/news")
async def get_news(topic: str = "all"):
    import time as _time

    cache_age = (_time.time() - _news_cache["fetched_at"]) if _news_cache["fetched_at"] else 999
    if cache_age < 7200 and _news_cache["data"]:
        articles = _news_cache["data"]
    else:
        articles = await _fetch_news()
        _news_cache["data"] = articles
        _news_cache["fetched_at"] = _time.time()

    if topic != "all":
        articles = [a for a in articles if topic.lower() in (a.get("topics") or [])]

    return {"articles": articles, "total": len(articles)}


@app.post("/api/news/refresh")
async def refresh_news():
    _news_cache["fetched_at"] = None
    articles = await _fetch_news()
    _news_cache["data"] = articles
    import time as _time
    _news_cache["fetched_at"] = _time.time()
    return {"articles": articles, "total": len(articles)}


async def _fetch_news() -> list:
    """Fetch AI and startup news from public RSS feeds. No API keys required."""
    import xml.etree.ElementTree as ET
    import email.utils as _eutils
    from datetime import datetime as _dt

    feeds = [
        # AI & ML focused
        {"url": "https://techcrunch.com/category/artificial-intelligence/feed/", "source": "TechCrunch AI", "color": "bg-green-100 text-green-700"},
        {"url": "https://venturebeat.com/ai/feed/",                               "source": "VentureBeat",   "color": "bg-blue-100 text-blue-700"},
        {"url": "https://www.technologyreview.com/feed/",                         "source": "MIT Tech Review","color": "bg-slate-100 text-slate-700"},
        {"url": "https://www.wired.com/feed/tag/ai/latest/rss",                   "source": "Wired AI",      "color": "bg-red-100 text-red-700"},
        {"url": "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml", "source": "The Verge",  "color": "bg-purple-100 text-purple-700"},
        # Startups & VC
        {"url": "https://techcrunch.com/category/startups/feed/",                 "source": "TechCrunch",    "color": "bg-green-100 text-green-700"},
        {"url": "https://a16z.com/feed/",                                         "source": "a16z",          "color": "bg-indigo-100 text-indigo-700"},
        {"url": "https://review.firstround.com/rss",                              "source": "First Round",   "color": "bg-orange-100 text-orange-700"},
        {"url": "https://www.ycombinator.com/blog/rss.xml",                       "source": "Y Combinator",  "color": "bg-amber-100 text-amber-700"},
        # Business & markets
        {"url": "https://feeds.reuters.com/reuters/technologyNews",               "source": "Reuters Tech",  "color": "bg-sky-100 text-sky-700"},
        {"url": "https://feeds.arstechnica.com/arstechnica/technology-lab",       "source": "Ars Technica",  "color": "bg-rose-100 text-rose-700"},
        {"url": "https://www.businessinsider.com/tech/rss",                       "source": "Business Insider","color": "bg-teal-100 text-teal-700"},
    ]

    # Keywords that indicate an article is relevant to AI/startups/careers
    RELEVANT_KEYWORDS = {
        "ai", "artificial intelligence", "machine learning", "startup", "venture", "funding",
        "series a", "series b", "seed round", "ipo", "acquisition", "llm", "openai", "anthropic",
        "google", "microsoft", "meta", "amazon", "nvidia", "hiring", "layoff", "tech job",
        "saas", "foundation model", "generative", "gpt", "claude", "gemini", "agent",
        "robotics", "automation", "fintech", "biotech", "climate tech", "founder", "ceo",
        "valuation", "unicorn", "product launch", "enterprise", "regulation", "policy",
    }
    # Keywords that indicate an article is NOT relevant (gaming, sports, entertainment, etc.)
    IRRELEVANT_KEYWORDS = {
        "nintendo", "playstation", "xbox", "gaming", "fortnite", "minecraft", "pokemon",
        "nba", "nfl", "mlb", "nhl", "soccer", "football", "basketball", "sports",
        "movie", "film", "netflix", "hulu", "disney", "streaming show", "celebrity",
        "recipe", "fashion", "beauty", "makeup", "skincare",
    }

    articles = []

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, headers={
        "User-Agent": "Mozilla/5.0 (compatible; RecruitIQ/1.0; +https://recruitiq.app)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
    }) as client:
        for feed in feeds:
            try:
                resp = await client.get(feed["url"], timeout=10.0)
                if resp.status_code != 200:
                    continue

                try:
                    root = ET.fromstring(resp.text)
                except ET.ParseError:
                    continue

                # Handle both RSS and Atom
                ns = {"atom": "http://www.w3.org/2005/Atom"}

                # RSS items
                items = root.findall(".//item")
                if not items:
                    items = root.findall(".//atom:entry", ns)

                for item in items[:15]:
                    def get_text(tag, fallback="", _item=item):
                        el = _item.find(tag)
                        if el is None:
                            el = _item.find(f"atom:{tag}", ns)
                        if el is None:
                            return fallback
                        return (el.text or "").strip()

                    title = get_text("title")
                    link  = get_text("link")
                    if not link:
                        link_el = item.find("atom:link", ns)
                        if link_el is not None:
                            link = link_el.get("href", "")
                    pub_date = get_text("pubDate") or get_text("published") or get_text("updated")
                    desc = get_text("description") or get_text("summary") or get_text("content")
                    desc = __import__('re').sub(r'<[^>]+>', ' ', desc)[:300].strip()

                    # Try to get image
                    image = ""
                    media_content = item.find("{http://search.yahoo.com/mrss/}content")
                    if media_content is not None:
                        image = media_content.get("url", "")
                    if not image:
                        enclosure = item.find("enclosure")
                        if enclosure is not None and "image" in (enclosure.get("type", "")):
                            image = enclosure.get("url", "")

                    # Parse date
                    parsed_date = ""
                    if pub_date:
                        try:
                            parsed_date = str(_eutils.parsedate_to_datetime(pub_date).isoformat())
                        except Exception:
                            try:
                                for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
                                    try:
                                        parsed_date = _dt.strptime(pub_date[:19], fmt[:len(pub_date[:19])]).isoformat()
                                        break
                                    except ValueError:
                                        pass
                            except Exception:
                                pass

                    if not title or not link:
                        continue

                    # Filter irrelevant / off-topic articles
                    text = (title + " " + desc).lower()
                    if any(w in text for w in IRRELEVANT_KEYWORDS):
                        continue

                    # Auto-tag topics
                    topics = []
                    if any(w in text for w in ["fund", "raise", "series", "valuation", "ipo", "acquisition", "acquire", "unicorn"]):
                        topics.append("funding")
                    if any(w in text for w in [
                        "hire", "hiring", "rehire", "layoff", "laid off", "lay off", "job cut",
                        "job market", "talent", "workforce", "headcount", "staff", "employee",
                        "workers", "recruit", "recruiting", "recruitment", "downsiz", "fired",
                        "rif ", "reduction in force", "attrition", "remote work", "return to office",
                        "rto", "new ceo", "new cto", "new hire", "appoint", "joins as",
                        "named as", "promoted to", "general partner", "partner at", "head of",
                        "vp of", "chief ", "going public", "ipo",
                    ]):
                        topics.append("hiring")
                    if any(w in text for w in ["gpt", "llm", "model", "openai", "anthropic", "gemini", "claude", "research", "paper", "benchmark"]):
                        topics.append("ai_research")
                    if any(w in text for w in ["regulation", "law", "congress", "policy", "ban", "rule", "compliance", "legal", "eu ai act"]):
                        topics.append("policy")
                    if any(w in text for w in ["product", "launch", "release", "feature", "update", "announce", "ship"]):
                        topics.append("products")
                    if not topics:
                        topics.append("ai_research")

                    articles.append({
                        "title": title,
                        "url": link,
                        "source": feed["source"],
                        "source_color": feed["color"],
                        "description": desc,
                        "image": image,
                        "published_at": parsed_date,
                        "topics": topics,
                    })
            except Exception as e:
                print(f"[News] Feed error {feed['source']}: {e}")

    # Sort by date descending, deduplicate by title
    seen_titles = set()
    unique = []
    for a in sorted(articles, key=lambda x: x.get("published_at", ""), reverse=True):
        key = a["title"].lower().strip()[:80]
        if key not in seen_titles:
            seen_titles.add(key)
            unique.append(a)

    print(f"[News] {len(unique)} articles fetched")
    return unique[:80]


# ── Nylas Gmail Integration ────────────────────────────────────────────────────
#
# Flow:
#   1. GET  /api/nylas/auth-url  → returns a URL the user visits to grant Gmail access
#   2. GET  /api/nylas/callback  → Nylas redirects here; we exchange code → grant_id
#   3. GET  /api/nylas/status    → returns { connected: bool, email: str|null }
#   4. POST /api/nylas/send      → send an email via Nylas (requires connected)
#   5. GET  /api/nylas/threads   → recent email threads (for reply detection)
#   6. DELETE /api/nylas/disconnect → revoke and clear grant_id
#
# Required .env vars:
#   NYLAS_CLIENT_ID=...
#   NYLAS_API_KEY=...       (your Nylas v3 API key / secret)
#   NYLAS_REDIRECT_URI=http://localhost:8000/api/nylas/callback
#   FRONTEND_URL=http://localhost:5173

NYLAS_CLIENT_ID    = os.getenv("NYLAS_CLIENT_ID", "")
NYLAS_API_KEY      = os.getenv("NYLAS_API_KEY", "")
NYLAS_REDIRECT_URI = os.getenv("NYLAS_REDIRECT_URI", "http://localhost:8000/api/nylas/callback")
FRONTEND_URL       = os.getenv("FRONTEND_URL", "http://localhost:5173")
NYLAS_API_BASE     = "https://api.us.nylas.com"


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _nylas_get(path: str, grant_id: str) -> dict:
    """Make a Nylas v3 GET request authenticated with the user's grant."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{NYLAS_API_BASE}/v3/grants/{grant_id}{path}",
            headers={"Authorization": f"Bearer {NYLAS_API_KEY}"},
        )
        resp.raise_for_status()
        return resp.json()


async def _nylas_post(path: str, grant_id: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{NYLAS_API_BASE}/v3/grants/{grant_id}{path}",
            headers={
                "Authorization": f"Bearer {NYLAS_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/nylas/auth-url")
async def nylas_auth_url(current_user: User = Depends(get_current_user)):
    """Return the Nylas-hosted auth URL for the user to visit."""
    if not NYLAS_CLIENT_ID or not NYLAS_API_KEY:
        raise HTTPException(status_code=503, detail="Nylas not configured (add NYLAS_CLIENT_ID and NYLAS_API_KEY to .env)")

    import urllib.parse
    params = {
        "client_id":     NYLAS_CLIENT_ID,
        "redirect_uri":  NYLAS_REDIRECT_URI,
        "response_type": "code",
        "access_type":   "online",
        "state":         str(current_user.id),
        "provider":      "google",
    }
    url = f"{NYLAS_API_BASE}/v3/connect/auth?" + urllib.parse.urlencode(params)
    return {"url": url}


@app.get("/api/nylas/callback")
async def nylas_callback(code: str, state: str = "", db: Session = Depends(get_db)):
    """Nylas redirects here after the user grants access. Exchange code → grant_id."""
    from fastapi.responses import RedirectResponse

    if not NYLAS_API_KEY:
        return RedirectResponse(url=f"{FRONTEND_URL}/profile?nylas=error&reason=not_configured")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{NYLAS_API_BASE}/v3/connect/token",
                headers={"Content-Type": "application/json"},
                json={
                    "client_id":     NYLAS_CLIENT_ID,
                    "client_secret": NYLAS_API_KEY,
                    "redirect_uri":  NYLAS_REDIRECT_URI,
                    "code":          code,
                    "grant_type":    "authorization_code",
                },
            )
            if resp.status_code != 200:
                print(f"[Nylas] Token exchange failed: {resp.status_code} {resp.text}")
                return RedirectResponse(url=f"{FRONTEND_URL}/profile?nylas=error&reason=token_exchange")

            data = resp.json()
            grant_id = data.get("grant_id") or data.get("id", "")
    except Exception as e:
        print(f"[Nylas] Callback error: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/profile?nylas=error&reason=exception")

    # Store grant_id on the user
    user_id = int(state) if state.isdigit() else None
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.nylas_grant_id = grant_id
            db.commit()

    return RedirectResponse(url=f"{FRONTEND_URL}/profile?nylas=connected")


@app.get("/api/nylas/status")
async def nylas_status(current_user: User = Depends(get_current_user)):
    """Return whether the user has Gmail connected."""
    if not current_user.nylas_grant_id:
        return {"connected": False, "email": None}

    # Grant exists — try to get email but don't fail if Nylas is slow
    email = None
    try:
        data = await _nylas_get("/profile", current_user.nylas_grant_id)
        email = (data.get("data") or data).get("email", "")
    except Exception:
        pass  # Still connected even if profile fetch fails

    return {"connected": True, "email": email}


class NylasAttachment(BaseModel):
    filename: str
    content_type: str
    data: str  # base64-encoded file content


class NylasSendPayload(BaseModel):
    to: str           # recipient email
    subject: str
    body: str         # plain text body (converted to HTML on send)
    reply_to_thread: Optional[str] = None  # thread_id if replying
    attachments: Optional[List[NylasAttachment]] = None


@app.post("/api/nylas/send")
async def nylas_send(
    payload: NylasSendPayload,
    current_user: User = Depends(get_current_user),
):
    """Send an email via Nylas on behalf of the authenticated user."""
    if not current_user.nylas_grant_id:
        raise HTTPException(status_code=400, detail="Gmail not connected. Connect via Profile → Integrations.")

    # Use <pre> to preserve all whitespace and line breaks unconditionally.
    # <pre> is one of the only HTML elements Gmail cannot collapse — line breaks
    # are preserved at the semantic level even if all inline styles are stripped.
    # font-family overrides the default monospace so it reads like a normal email.
    escaped = (
        payload.body
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
    )
    html_body = (
        '<pre style="font-family:Arial,Helvetica,sans-serif;font-size:14px;'
        'line-height:1.6;color:#222;white-space:pre-wrap;word-wrap:break-word;'
        'margin:0;padding:0;border:none;background:transparent;">'
        + escaped
        + '</pre>'
    )

    msg = {
        "to":      [{"email": payload.to}],
        "subject": payload.subject,
        "body":    html_body,
    }
    if payload.reply_to_thread:
        msg["thread_id"] = payload.reply_to_thread

    if payload.attachments:
        import base64
        att_list = []
        for a in payload.attachments:
            try:
                raw = base64.b64decode(a.data)
                size = len(raw)
            except Exception:
                size = 0
            att_list.append({
                "filename":     a.filename,
                "content_type": a.content_type or "application/octet-stream",
                "content":      a.data,
                "size":         size,
            })
        msg["attachments"] = att_list

    try:
        result = await _nylas_post("/messages/send", current_user.nylas_grant_id, msg)
        return {"ok": True, "message_id": (result.get("data") or result).get("id", "")}
    except httpx.HTTPStatusError as e:
        print(f"[Nylas send error] status={e.response.status_code} body={e.response.text[:500]}")
        raise HTTPException(status_code=502, detail=f"Nylas send failed: {e.response.text[:300]}")


@app.get("/api/nylas/threads")
async def nylas_threads(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
):
    """Fetch recent email threads (for reply detection)."""
    if not current_user.nylas_grant_id:
        raise HTTPException(status_code=400, detail="Gmail not connected")

    try:
        data = await _nylas_get(f"/threads?limit={limit}", current_user.nylas_grant_id)
        threads = data.get("data", data) if isinstance(data, dict) else data
        return {"threads": threads}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Nylas error: {e.response.text[:200]}")


@app.delete("/api/nylas/disconnect")
async def nylas_disconnect(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke Nylas grant and disconnect Gmail from this account."""
    grant_id = current_user.nylas_grant_id
    if grant_id:
        # Best-effort revocation
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.delete(
                    f"{NYLAS_API_BASE}/v3/grants/{grant_id}",
                    headers={"Authorization": f"Bearer {NYLAS_API_KEY}"},
                )
        except Exception:
            pass
        current_user.nylas_grant_id = None
        db.commit()

    return {"ok": True}
