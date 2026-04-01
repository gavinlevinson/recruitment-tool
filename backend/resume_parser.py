"""
Resume / transcript / cover-letter text extraction and parsing.

Extracts:
- Target roles (matched against our job-scoring keywords)
- Preferred locations
- School and GPA
- Skills
- Graduation year
- Career stage suggestion
"""
import re
import json
from typing import Optional

try:
    import pdfplumber
    HAS_PDF = True
except ImportError:
    HAS_PDF = False


# ── Keyword banks ─────────────────────────────────────────────────────────────

ROLE_KEYWORDS = [
    "strategy", "operations", "ops", "product manager", "product management",
    "analyst", "business analyst", "data analyst", "associate", "business development",
    "bd", "growth", "go-to-market", "gtm", "solutions", "consulting", "consultant",
    "chief of staff", "biz ops", "bizops", "revenue operations", "revops",
    "partnerships", "program manager", "implementation", "launch manager",
    "account management", "customer success", "sales", "account executive",
    "marketing", "brand", "content", "communications", "finance", "investment",
    "venture capital", "private equity", "investment banking",
]

SKILL_KEYWORDS = [
    # Technical
    "python", "sql", "excel", "tableau", "powerpoint", "google sheets",
    "salesforce", "hubspot", "jira", "notion", "figma", "airtable",
    "javascript", "typescript", "react", "r", "stata", "matlab",
    "looker", "dbt", "snowflake", "databricks", "zapier", "linear",
    # Business
    "financial modeling", "financial analysis", "data analysis", "market research",
    "project management", "product management", "agile", "scrum",
    "a/b testing", "user research", "ux research", "competitive analysis",
    "business development", "partnership management", "account management",
    "presentations", "public speaking", "writing", "research",
]

LOCATION_MAP = {
    "NYC": ["new york", "nyc", "manhattan", "brooklyn", "queens", "bronx"],
    "SF": ["san francisco", "sf", "bay area", "palo alto", "menlo park",
           "mountain view", "sunnyvale", "cupertino", "redwood city", "south bay"],
    "Boston": ["boston", "cambridge", "ma", "massachusetts"],
    "Chicago": ["chicago", "il", "illinois"],
    "LA": ["los angeles", "la,", " la ", "santa monica", "culver city"],
    "DC": ["washington dc", "washington, dc", "d.c.", "arlington", "bethesda"],
    "Seattle": ["seattle", "bellevue", "redmond"],
    "Austin": ["austin", "tx", "texas"],
    "Remote": ["remote", "anywhere", "distributed", "fully remote"],
}

SCHOOL_NAMES = [
    "michigan", "umich", "university of michigan",
    "harvard", "yale", "princeton", "stanford", "mit", "caltech",
    "columbia", "nyu", "penn", "upenn", "wharton", "dartmouth",
    "brown", "cornell", "duke", "vanderbilt", "northwestern",
    "georgetown", "notre dame", "carnegie mellon", "cmu",
    "uc berkeley", "berkeley", "ucla", "usc", "uchicago",
    "boston university", "bu", "northeastern", "tufts", "emory",
    "rice", "tulane", "case western", "purdue", "ohio state",
    "michigan state", "university of virginia", "uva",
    "william and mary", "wake forest", "lehigh", "villanova",
    "babson", "bentley", "georgia tech", "gatech",
    "university of texas", "ut austin", "texas a&m",
]

MAJOR_FINANCE = ["finance", "economics", "accounting", "business administration", "commerce"]
MAJOR_STEM = ["computer science", "cs", "engineering", "mathematics", "statistics", "data science"]
MAJOR_LIBERAL = ["political science", "polisci", "sociology", "psychology", "philosophy",
                 "history", "communications", "journalism", "english", "liberal arts"]
MAJOR_HEALTHCARE = ["biology", "chemistry", "neuroscience", "pre-med", "public health",
                    "healthcare", "bcn", "biopsychology", "neuroscience"]


# ── PDF extraction ────────────────────────────────────────────────────────────

def extract_pdf_text(file_path: str) -> str:
    """Extract all text from a PDF file."""
    if not HAS_PDF:
        return ""
    try:
        text_parts = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text_parts.append(t)
        return "\n".join(text_parts)
    except Exception as e:
        print(f"[PDF Parser] Error reading {file_path}: {e}")
        return ""


# ── Text parsers ──────────────────────────────────────────────────────────────

def parse_resume(text: str) -> dict:
    """
    Parse resume text into structured profile data.
    Returns suggestions that can pre-fill the user's preferences.
    """
    t = text.lower()

    # ── Roles ──────────────────────────────────────────────────────────────
    detected_roles = []
    for kw in ROLE_KEYWORDS:
        if kw in t and kw not in detected_roles:
            detected_roles.append(kw)

    # ── Locations ──────────────────────────────────────────────────────────
    detected_locations = []
    for loc, patterns in LOCATION_MAP.items():
        if any(p in t for p in patterns):
            detected_locations.append(loc)
    if not detected_locations:
        detected_locations = ["NYC"]   # default for college seniors

    # ── School ─────────────────────────────────────────────────────────────
    parsed_school = None
    for school in SCHOOL_NAMES:
        if school in t:
            parsed_school = school.title()
            break

    # ── GPA ────────────────────────────────────────────────────────────────
    gpa_match = re.search(r'\bgpa[:\s]+(\d\.\d{1,2})\b', t)
    if not gpa_match:
        gpa_match = re.search(r'\b([3-4]\.\d{1,2})\s*/\s*4\.0\b', t)
    parsed_gpa = gpa_match.group(1) if gpa_match else None

    # ── Graduation year ─────────────────────────────────────────────────────
    year_matches = re.findall(r'\b(202[4-9]|203[0-2])\b', t)
    grad_year = max(year_matches) if year_matches else None

    # ── Career stage heuristic ─────────────────────────────────────────────
    # If resume mentions internships, class year, expected graduation → college
    career_stage = "college_senior"
    if re.search(r'\b(sophomore|junior|senior|class of 20[2-3]\d)\b', t):
        career_stage = "college_senior"
    elif re.search(r'\b[3-9]\+?\s*years?\s+of\s+experience\b', t):
        career_stage = "mid_career"
    elif re.search(r'\b[1-2]\s*years?\s+of\s+experience\b', t):
        career_stage = "early_career"

    # ── Skills ─────────────────────────────────────────────────────────────
    detected_skills = [s for s in SKILL_KEYWORDS if s in t]

    # ── Major hint ─────────────────────────────────────────────────────────
    major = None
    for m in MAJOR_FINANCE + MAJOR_STEM + MAJOR_LIBERAL + MAJOR_HEALTHCARE:
        if m in t:
            major = m.title()
            break

    return {
        "suggested_roles": detected_roles[:8],
        "suggested_locations": detected_locations[:3],
        "skills": detected_skills[:15],
        "school": parsed_school,
        "gpa": parsed_gpa,
        "grad_year": grad_year,
        "career_stage": career_stage,
        "major": major,
    }


def parse_transcript(text: str) -> dict:
    """Extract school and GPA from transcript text."""
    t = text.lower()
    school = None
    for s in SCHOOL_NAMES:
        if s in t:
            school = s.title()
            break
    gpa_match = re.search(r'\b(?:gpa|cumulative)[:\s]+(\d\.\d{1,2})\b', t)
    if not gpa_match:
        gpa_match = re.search(r'\b([3-4]\.\d{1,2})\s*/\s*4\.0\b', t)
    gpa = gpa_match.group(1) if gpa_match else None
    year_matches = re.findall(r'\b(202[4-9]|203[0-2])\b', t)
    grad_year = max(year_matches) if year_matches else None
    return {"school": school, "gpa": gpa, "grad_year": grad_year}


def compute_personal_score(
    job_role: str,
    job_location: str,
    job_description: str,
    user_profile: dict,
) -> tuple:
    """
    Score a discovered job against a specific user's profile.
    Returns (score: int, reasons: list[str]).

    user_profile keys: roles (list), locations (list), skills (list),
                       gpa (str or None), career_stage (str)
    """
    score = 0
    reasons = []

    job_role_lower = (job_role or "").lower()
    job_desc_lower = (job_description or "").lower()
    combined = f"{job_role_lower} {job_desc_lower}"

    user_roles = user_profile.get("roles") or []
    user_locations = user_profile.get("locations") or []
    user_skills = user_profile.get("skills") or []
    user_gpa_str = user_profile.get("gpa")
    career_stage = user_profile.get("career_stage", "college_senior")

    # ── Role match (0-35 pts) ───────────────────────────────────────────────────
    # Title matches score full points; description-only matches are capped at 10.
    roles_to_check = user_roles if user_roles else ROLE_KEYWORDS
    title_matches = list(dict.fromkeys(
        kw for kw in roles_to_check if kw.lower() in job_role_lower
    ))
    desc_only_matches = list(dict.fromkeys(
        kw for kw in roles_to_check
        if kw.lower() in job_desc_lower and kw.lower() not in job_role_lower
    ))

    title_count = len(title_matches)
    if title_count >= 3:
        role_score = 35
        reasons.append(f"Strong role match ({title_count} title keywords)")
    elif title_count == 2:
        role_score = 28
        reasons.append(f"Good role match ({title_count} title keywords)")
    elif title_count == 1:
        role_score = 20
        reasons.append(f"Partial role match: {title_matches[0]}")
    elif desc_only_matches:
        role_score = min(10, len(desc_only_matches) * 4)
        reasons.append(f"Weak role signal ({len(desc_only_matches)} desc-only)")
    else:
        role_score = 0
    score += role_score

    # ── Location match (0-20 pts) ───────────────────────────────────────────────
    loc_lower = (job_location or "").lower()
    is_remote = any(kw in loc_lower for kw in ["remote", "anywhere", "distributed", "fully remote"])
    is_hybrid = "hybrid" in loc_lower

    loc_score = 0
    matched_loc = None
    for user_loc in user_locations:
        patterns = LOCATION_MAP.get(user_loc, [user_loc.lower()])
        if any(p in loc_lower for p in patterns):
            loc_score = 20
            matched_loc = user_loc
            break

    if loc_score == 0:
        user_prefers_remote = "Remote" in user_locations
        if is_remote:
            loc_score = 20 if user_prefers_remote else 10
            reasons.append("Remote role")
        elif is_hybrid:
            loc_score = 10
            reasons.append("Hybrid role")
    else:
        reasons.append(f"Location match: {matched_loc}")
    score += loc_score

    # ── Skills overlap (0-25 pts) ────────────────────────────────────────────────
    if not user_skills:
        score += 12
        reasons.append("Skills: neutral (no profile)")
    else:
        job_required_skills = [s for s in SKILL_KEYWORDS if s in job_desc_lower]
        if not job_required_skills:
            score += 12
            reasons.append("Skills: neutral (none detected in job)")
        else:
            user_has = [s for s in job_required_skills if s in [sk.lower() for sk in user_skills]]
            skill_score = round((len(user_has) / len(job_required_skills)) * 25)
            score += skill_score
            if user_has:
                reasons.append(f"Skills match: {len(user_has)}/{len(job_required_skills)} required")
            else:
                reasons.append("No skill overlap detected")

    # ── GPA fit (0-10 pts) ──────────────────────────────────────────────────────
    req_gpa = None
    gpa_patterns = [
        r'(\d\.\d)\+?\s*(?:gpa|grade point average)',
        r'gpa[:\s]+(\d\.\d)',
        r'minimum[:\s]+(\d\.\d)',
    ]
    for pat in gpa_patterns:
        m = re.search(pat, job_desc_lower)
        if m:
            try:
                req_gpa = float(m.group(1))
            except ValueError:
                pass
            break

    if req_gpa is None:
        score += 5  # neutral
    elif not user_gpa_str:
        score += 5  # neutral
    else:
        try:
            user_gpa = float(user_gpa_str)
            if user_gpa >= req_gpa:
                score += 10
                reasons.append(f"GPA meets requirement ({req_gpa}+)")
            elif user_gpa >= req_gpa - 0.2:
                score += 5
                reasons.append(f"GPA close to requirement ({req_gpa}+)")
            else:
                reasons.append(f"GPA below requirement ({req_gpa}+)")
        except ValueError:
            score += 5  # neutral

    # ── Experience fit ───────────────────────────────────────────────────────────
    # Caps score when the job requires more experience than the user has.
    # Even 1 year of required experience is a real barrier for a 0-year candidate.
    stage_years = {
        "college_senior": 0,
        "college_junior": 0,
        "college_sophomore": 0,
        "early_career": 2,
        "mid_career": 4,
        "senior": 7,
    }
    user_years = stage_years.get(career_stage, 0)

    # Comprehensive experience extraction — matches all common phrasings
    _exp_patterns = [
        r'(?:minimum\s+(?:of\s+)?|at\s+least\s+)(\d+)\s*\+?\s*years?',
        r'\b(\d+)\s*\+\s*years?\s+(?:of\s+)?(?:relevant\s+|professional\s+|work\s+|hands.on\s+)?experience',
        r'\b(\d+)\s*(?:[-–]|to)\s*\d+\s*years?\s+(?:of\s+)?(?:relevant\s+|professional\s+|work\s+)?experience',
        r'\b(\d+)\s*years?\s+of\s+(?:relevant\s+|professional\s+|work\s+)?experience',
        r'experience[:\s(]+(\d+)\s*\+?\s*years?',
        r'requires?\s+(?:at\s+least\s+)?(\d+)\s*\+?\s*years?',
        r'\b(\d+)\s+or\s+more\s+years?',
        r'\b(\d+)\s*years?\s+experience',
        r'\b(\d+)\s*\+?\s*years?\s+(?:in|working\s+(?:in|with|on)|building|managing|leading)\b',
        r'\b(\d+)\s*\+?\s*years?\b(?=.{0,50}experience)',
    ]
    req_years = None
    for _pat in _exp_patterns:
        _m = re.search(_pat, job_desc_lower)
        if _m:
            try:
                req_years = int(_m.group(1))
                if 0 <= req_years <= 30:
                    break
            except ValueError:
                pass
    # Override with 0 if explicit entry-level signal
    if re.search(r'\bentry.?level\b|no experience required|\b0.?year|\bnew\s+grad|\brecent\s+graduate', job_desc_lower):
        req_years = 0

    if req_years is not None:
        if user_years == 0:  # college senior / no experience
            if req_years == 0:
                score += 15
                reasons.append("Entry-level (0 yrs required)")
            elif req_years == 1:
                score = min(score, 60)
                reasons.append("Requires 1 yr exp (stretch)")
            elif req_years == 2:
                score = min(score, 45)
                reasons.append("Requires 2 yrs exp (unlikely)")
            elif req_years <= 4:
                score = min(score, 30)
                reasons.append("Requires 3-4 yrs exp (reach)")
            elif req_years <= 6:
                score = min(score, 18)
                reasons.append("Requires 5-6 yrs exp")
            else:
                score = min(score, 10)
                reasons.append("Requires 7+ yrs exp")
        elif user_years == 2:  # early career
            if req_years <= 3:
                pass  # good fit
            elif req_years <= 5:
                score = min(score, 55)
                reasons.append("Requires 4-5 yrs exp (stretch)")
            else:
                score = min(score, 35)
                reasons.append("Requires 6+ yrs exp")
        elif user_years == 4:  # mid career
            if req_years <= 5:
                pass
            elif req_years <= 7:
                score = min(score, 60)
            else:
                score = min(score, 40)
    else:
        # No experience requirement mentioned — small bonus for college seniors
        if user_years == 0:
            score += 5

    # ── Title seniority penalty ────────────────────────────────────────────────────
    # If the user is entry-level (0 yrs) and the job title contains senior
    # keywords, penalize the score regardless of stated experience requirements.
    if user_years == 0:
        senior_title_patterns = [
            r'\bsenior\b', r'\bsr\.?\b', r'\blead\b', r'\bmanager\b',
            r'\bdirector\b', r'\bhead\b', r'\bprincipal\b', r'\bvp\b',
            r'\bvice\s+president\b', r'\bstaff\b',
        ]
        for _sp in senior_title_patterns:
            if re.search(_sp, job_role_lower):
                penalty = 15
                score = max(0, score - penalty)
                reasons.append(f"Senior-level title for entry-level candidate (-{penalty})")
                break

    # ── Custom context boost (0-10 pts) ──────────────────────────────────────────
    custom_context = user_profile.get("custom_context", "")
    if custom_context:
        ctx_words = [w.lower().strip(",.") for w in custom_context.split() if len(w) > 3]
        ctx_hits = [w for w in ctx_words if w in combined]
        if len(ctx_hits) >= 3:
            score += 10
            reasons.append("Strong context match")
        elif len(ctx_hits) >= 1:
            score += 5
            reasons.append(f"Context match ({len(ctx_hits)} keywords)")
    score = min(score, 100)

    # Clamp score to 0-100
    score = max(0, min(100, score))
    return int(score), reasons


def build_user_profile_for_scoring(user, profile) -> dict:
    """
    Build user_profile dict for compute_personal_score from SQLAlchemy
    User and UserProfile objects.
    """
    def _loads(v):
        try:
            return json.loads(v) if v else []
        except Exception:
            return []

    resume_roles     = _loads(profile.parsed_roles)     if profile else []
    resume_locations = _loads(profile.parsed_locations) if profile else []
    resume_skills    = _loads(profile.parsed_skills)    if profile else []
    ctx_roles        = _loads(profile.context_roles)    if profile else []
    ctx_locations    = _loads(profile.context_locations) if profile else []
    ctx_skills       = _loads(profile.context_skills)   if profile else []

    # Merge: resume data takes priority; context fills gaps
    merged_roles     = resume_roles     or ctx_roles
    merged_locations = resume_locations or ctx_locations
    merged_skills    = list(set(resume_skills + ctx_skills))

    return {
        "roles": merged_roles,
        "locations": merged_locations,
        "skills": merged_skills,
        "gpa": profile.parsed_gpa if profile else None,
        "career_stage": user.career_stage if user else "college_senior",
        "custom_context": (profile.custom_context or "") if profile else "",
    }
