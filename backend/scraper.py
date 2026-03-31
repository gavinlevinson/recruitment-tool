"""
Job discovery scraper — pulls from:
  1. Hacker News "Who Is Hiring?" (March 2026 — 363 live posts, free API)
  2. Ali Rohde Jobs (Substack newsletter — Chief of Staff, BizOps, VC roles)
  3. Remote OK (free public JSON API)
  4. Greenhouse job boards (AI startup-specific companies)
  5. Lever job boards (AI startup-specific companies)
  6. Wellfound / AngelList (HTML scrape)
  7. LinkedIn via Apify (paid, requires APIFY_API_KEY)
  8. Indeed via Apify  (paid, requires APIFY_API_KEY)

Scoring: 0–100 against Gavin Levinson's profile.
"""

import httpx
import re
import json
import asyncio
from typing import List, Dict
from datetime import date as _date
import os

# ─────────────────────────────────────────────
# PROFILE
# ─────────────────────────────────────────────
TARGET_ROLES = [
    "strategy", "operations", "ops", "product manager", "pm", "analyst",
    "associate", "business development", "bd", "growth", "go-to-market", "gtm",
    "solutions", "consultant", "deployment", "special projects", "chief of staff",
    "biz ops", "bizops", "revenue operations", "revops", "partnerships",
    "program manager", "implementation", "launch", "account management",
    "customer success", "sales", "account executive",
    "marketing",  # catch product marketing, growth marketing, marketing manager, etc.
]
ENTRY_SIGNALS = [
    "entry level", "entry-level", "new grad", "new graduate", "0-1 year",
    "0+ year", "1-2 year", "associate", "junior", "early career",
    "recent graduate", "no experience required", "0 years",
]
EXCLUDE_ROLES = [
    "software engineer", "swe", "ml engineer", "data scientist", "devops",
    "backend engineer", "frontend engineer", "fullstack", "site reliability",
    "security engineer", "mobile engineer", "ios developer", "android",
    "infrastructure engineer", "data engineer",
]
AI_SIGNALS = [
    "ai", "artificial intelligence", "llm", "machine learning", "saas",
    "startup", "series a", "series b", "seed stage", "generative", "foundation model",
    "series c", "venture", "early-stage",
]
LOC_TARGETS = ["new york", "nyc", "manhattan", "brooklyn", "san francisco",
               "sf", "bay area", "soma", "remote", "hybrid"]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# AI startups known to use Greenhouse
GREENHOUSE_COMPANIES = [
    ("openai", "OpenAI"), ("anthropic", "Anthropic"), ("cohere", "Cohere"),
    ("scale", "Scale AI"), ("notion", "Notion"), ("figma", "Figma"),
    ("airtable", "Airtable"), ("rippling", "Rippling"), ("brex", "Brex"),
    ("ramp", "Ramp"), ("retool", "Retool"), ("runway", "Runway"),
    ("huggingface", "Hugging Face"), ("perplexity-ai", "Perplexity"),
    ("glean", "Glean"), ("cognitiv", "Cognitiv"), ("replit", "Replit"),
    ("cursor", "Cursor"), ("harvey", "Harvey"), ("klarna", "Klarna"),
    ("tome", "Tome"), ("hebbia", "Hebbia"), ("vercel", "Vercel"),
    ("linear", "Linear"), ("loom", "Loom"), ("lattice", "Lattice"),
    ("benchling", "Benchling"), ("hightouch", "Hightouch"),
    ("watershed", "Watershed"), ("sourcegraph", "Sourcegraph"), ("weaviate", "Weaviate"),
    ("modal-labs", "Modal"), ("anyscale", "Anyscale"), ("together-ai", "Together AI"),
    ("mistral", "Mistral AI"), ("character", "Character.AI"), ("midjourney", "Midjourney"),
    ("langchain", "LangChain"), ("llamaindex", "LlamaIndex"), ("weights-biases", "Weights & Biases"),
    ("pinecone", "Pinecone"), ("chroma", "Chroma"), ("qdrant", "Qdrant"),
    ("elevenlabs", "ElevenLabs"), ("synthesia", "Synthesia"), ("runway", "Runway ML"),
    ("krea", "Krea AI"), ("pika", "Pika Labs"), ("suno-ai", "Suno"),
    ("cohere", "Cohere"), ("ai21", "AI21 Labs"), ("adept", "Adept AI"),
    ("inflection", "Inflection AI"), ("xai", "xAI"),
    ("cognition", "Cognition AI"), ("magic", "Magic Dev"), ("augment", "Augment Code"),
    ("devin-ai", "Devin AI"), ("factory-ai", "Factory AI"), ("sweep-ai", "Sweep"),
    ("codeium", "Codeium"), ("tabnine", "Tabnine"),
    # Added from topstartups.io AI listings
    ("doppel", "Doppel"), ("vivodyne", "Vivodyne"), ("cresta", "Cresta"),
    ("heygen", "HeyGen"), ("instawork", "Instawork"), ("assemblyai", "AssemblyAI"),
    ("memorahealth", "Memora Health"), ("tavus", "Tavus"), ("mindsdb", "MindsDB"),
    ("spotai", "Spot AI"), ("fathom", "Fathom"), ("AMPRobotics", "AMP Robotics"),
    ("optimaldynamics", "Optimal Dynamics"), ("Vizai", "Viz"), ("Veriff", "Veriff"),
    ("labelbox", "Labelbox"), ("ambiencehealthcare", "Ambience Healthcare"),
    ("pika", "Pika Labs"), ("xbow", "XBOW"),
]

# AI startups and tech companies known to use Ashby
ASHBY_COMPANIES = [
    ("descript", "Descript"),
    ("posthog", "PostHog"),
    ("attio", "Attio"),
    ("raycast", "Raycast"),
    ("mercury", "Mercury"),
    ("superhuman", "Superhuman"),
    ("warp", "Warp Terminal"),
    ("groq", "Groq"),
    ("modal", "Modal Labs"),
    ("cal", "Cal.com"),
    ("clerk", "Clerk"),
    ("resend", "Resend"),
    ("knock", "Knock"),
    ("workos", "WorkOS"),
    ("coreweave", "CoreWeave"),
    ("stability", "Stability AI"),
    ("luma", "Luma AI"),
    ("perplexity", "Perplexity"),
    ("glean", "Glean"),
    ("vanta", "Vanta"),
    ("rippling", "Rippling"),
    ("brex", "Brex"),
    ("deel", "Deel"),
    ("watershed", "Watershed"),
    ("census", "Census"),
    ("retool", "Retool"),
    ("hex", "Hex"),
    ("linear", "Linear"),
    ("baseten", "Baseten"),
    ("fireworks-ai", "Fireworks AI"),
    ("cognition", "Cognition"),
    ("poolside", "Poolside AI"),
    ("sierra", "Sierra AI"),
    ("aisera", "Aisera"),
    ("cohere", "Cohere"),
    # Added from topstartups.io AI listings
    ("pylon-labs", "Pylon"), ("adaptivesecurity", "Adaptive Security"),
    ("traba", "Traba"), ("Harmonic", "Harmonic"), ("tennr", "Tennr"),
    ("xbowcareers", "XBOW"), ("openrouter", "OpenRouter"), ("harvey", "Harvey"),
    ("Abridge", "Abridge"), ("prepared911", "Prepared"), ("ataraxis-ai", "Ataraxis AI"),
    ("graphite", "Graphite"), ("claylabs", "Clay"), ("radai", "Rad AI"),
    ("basis-ai", "Basis AI"), ("speak", "Speak"), ("decagon", "Decagon"),
    ("worldlabs", "World Labs"), ("SlingshotAI", "Slingshot AI"), ("allium", "Allium"),
    ("ema", "Ema"), ("captions", "Captions"), ("fieldguide", "Fieldguide"),
    ("quilter", "Quilter"), ("rasa", "Rasa"), ("lilt", "Lilt"),
    ("Deepgram", "Deepgram"), ("Sahara", "Sahara AI"), ("openai", "OpenAI"),
    ("Blossom-Health", "Blossom Health"), ("omnea", "Omnea"),
    ("listenlabs", "Listen Labs"), ("ssi", "Safe Superintelligence"),
    ("nooks", "Nooks"), ("hebbia", "Hebbia"), ("cresta", "Cresta"),
    ("cognition", "Cognition AI"), ("descript", "Descript"),
]

# Companies known to use Workable ATS
WORKABLE_COMPANIES = [
    ("typeform", "Typeform"),
    ("hotjar", "Hotjar"),
    ("personio", "Personio"),
    ("remote", "Remote"),
    ("loom", "Loom"),
    ("miro", "Miro"),
    ("aircall", "Aircall"),
    ("productboard", "Productboard"),
    ("pitch", "Pitch"),
    ("maze", "Maze"),
    ("pricefx", "Pricefx"),
    ("brightflag", "Brightflag"),
    ("lokalise", "Lokalise"),
    ("bonsai", "Bonsai"),
    ("poly-ai", "PolyAI"),
]

# AI startups known to use Lever
LEVER_COMPANIES = [
    ("atlas", "Atlas"), ("adept", "Adept"), ("inflectionai", "Inflection AI"),
    ("covariant", "Covariant"), ("typeface", "Typeface"),
    ("together", "Together AI"), ("fireworks-ai", "Fireworks AI"),
    ("cognition-labs", "Cognition"), ("imbue", "Imbue"),
    # Added from topstartups.io AI listings
    ("shieldai", "Shield AI"), ("kumo", "Kumo"), ("tecton", "Tecton"),
    ("builtrobotics", "Built Robotics"), ("hyperscience", "HyperScience"),
    ("mistral", "Mistral AI"),
]


# ─────────────────────────────────────────────
# SCORING
# ─────────────────────────────────────────────

# Prefixes/words that hard-exclude a role title
HARD_EXCLUDE_PREFIXES = [
    "senior ", "sr. ", "sr ", "principal ", "staff ", "lead ",
]
HARD_EXCLUDE_LEAD_EXCEPTIONS = ["lead generation", "lead nurture"]
HARD_EXCLUDE_TITLE_WORDS = [
    "director", "vice president", "head of ", "managing director",
    "cto", "coo", "cpo", "cmo", "cfo", " vp ",
]
# "chief of staff" is allowed — exclude other C-suite
HARD_EXCLUDE_CSUITE = ["chief executive", "chief technology", "chief operating",
                        "chief product", "chief marketing", "chief financial",
                        "chief revenue", "chief data", "chief people"]
HARD_EXCLUDE_YEARS_RE = re.compile(r'\b([5-9]|\d{2})\+\s*year', re.IGNORECASE)


def _is_hard_excluded(role: str) -> bool:
    r = role.lower().strip()

    # Check seniority prefixes
    for prefix in HARD_EXCLUDE_PREFIXES:
        if r.startswith(prefix):
            # Allow "lead generation" and "lead nurture"
            if prefix == "lead ":
                if any(r.startswith(exc) for exc in HARD_EXCLUDE_LEAD_EXCEPTIONS):
                    continue
            return True

    # Check " vp " in middle or "vp " at start
    if r.startswith("vp ") or " vp " in r:
        return True

    # Check title words
    for word in HARD_EXCLUDE_TITLE_WORDS:
        if word in r:
            return True

    # Check C-suite (but not chief of staff)
    if "chief" in r and "chief of staff" not in r:
        for csuite in HARD_EXCLUDE_CSUITE:
            if csuite in r:
                return True
        # Generic "chief X officer" pattern
        if re.search(r'chief\s+\w+\s+officer', r):
            return True

    # Check years requirements like "5+ years", "7+ years" etc.
    if HARD_EXCLUDE_YEARS_RE.search(role):
        return True

    return False


# Tech/engineering role keywords that are NOT relevant for Gavin (used in VC scraper filter)
_VC_TECH_EXCLUSIONS = [
    "software engineer", "swe", "ml engineer", "machine learning engineer",
    "data scientist", "devops", "backend engineer", "frontend engineer",
    "fullstack engineer", "full-stack engineer", "full stack engineer",
    "site reliability", "security engineer", "mobile engineer",
    "ios developer", "android developer", "infrastructure engineer",
    "data engineer", "platform engineer", "cloud engineer",
    "firmware engineer", "embedded engineer", "research scientist",
    "applied scientist", "systems engineer", "network engineer",
    "hardware engineer", "electrical engineer", "mechanical engineer",
]


def _make_vc_job(company: str, role: str, location: str, url: str,
                 source: str, description: str = ""):
    """
    Build a job dict for VC portfolio sources.
    Returns None if the role should be excluded (hard-seniority or explicit tech role).
    For all other roles, ensures match_score >= 1 so the endpoint's `match_score > 0`
    hard floor never hides legitimate business/ops/marketing/etc. roles that don't
    happen to contain an exact TARGET_ROLES keyword.
    """
    if _is_hard_excluded(role):
        return None
    role_lower = role.lower()
    if any(exc in role_lower for exc in _VC_TECH_EXCLUSIONS):
        return None
    job = make_job(company, role, location, url, source, description)
    # Guarantee the job survives the endpoint's hard floor even when score_job
    # returns 0 (no TARGET_ROLES keyword match, e.g. "Marketing Manager")
    if not job.get("match_score"):
        job["match_score"] = 1
    return job


def extract_min_years(text: str):
    """Return the minimum years of experience required from a description, or None.
    Catches all common phrasings: '3+ years', '3-5 years', 'minimum 3 years',
    '3 years of experience', 'requires 3 years', 'you have 3+ years', etc.
    """
    if not text:
        return None
    t = text.lower()

    # Explicit entry-level signal overrides everything
    if re.search(r'\bentry.?level\b|no experience required|\b0.?year|\bnew\s+grad|\brecent\s+graduate', t):
        return 0

    # Ordered most→least specific. All patterns capture the MINIMUM years.
    patterns = [
        # "minimum of 3 years" / "minimum 3 years" / "at least 3 years"
        r'(?:minimum\s+(?:of\s+)?|at\s+least\s+)(\d+)\s*\+?\s*years?',
        # "3+ years of professional/relevant/work/hands-on experience"
        r'\b(\d+)\s*\+\s*years?\s+(?:of\s+)?(?:relevant\s+|professional\s+|work\s+|hands.on\s+|industry\s+)?experience',
        # "3-5 years of experience" / "3 to 5 years of experience"
        r'\b(\d+)\s*(?:[-–]|to)\s*\d+\s*years?\s+(?:of\s+)?(?:relevant\s+|professional\s+|work\s+)?experience',
        # "3 years of experience" (no +/range)
        r'\b(\d+)\s*years?\s+of\s+(?:relevant\s+|professional\s+|work\s+|hands.on\s+|industry\s+)?experience',
        # "experience: 3+ years" / "experience (3+ years)"
        r'experience[:\s(]+(\d+)\s*\+?\s*years?',
        # "requires 3+ years" / "requires at least 3 years"
        r'requires?\s+(?:at\s+least\s+)?(\d+)\s*\+?\s*years?',
        # "you have 3+ years" / "you've built X over 3+ years"
        r"you\s+(?:have|'ve|have\s+built)\s+(?:[a-z\s]{0,20})?(\d+)\s*\+?\s*years?",
        # "3 or more years"
        r'\b(\d+)\s+or\s+more\s+years?',
        # "3 years experience" (no "of")
        r'\b(\d+)\s*years?\s+experience',
        # "3 years in [field]" — only if near "experience" or job-context words within 60 chars
        r'\b(\d+)\s*\+?\s*years?\s+(?:in|working\s+(?:in|with|on)|building|managing|leading)\b',
        # "5-7 year background" / "X year track record"
        r'\b(\d+)\s*[-–]\s*\d+\s*year(?:s)?\s+(?:background|track\s+record)',
        # fallback: "X years" anywhere near "experience" within 50 chars
        r'\b(\d+)\s*\+?\s*years?\b(?=.{0,50}experience)',
    ]

    for pat in patterns:
        m = re.search(pat, t)
        if m:
            try:
                val = int(m.group(1))
                if 0 <= val <= 30:  # sanity check
                    return val
            except (ValueError, IndexError):
                pass

    return None


def score_job(company: str, role: str, location: str = "", description: str = ""):
    """
    New scoring breakdown (0-100):
    1. Role match (0-35): TARGET_ROLE keyword in title or description
    2. Location (0-25): NYC/SF/Remote
    3. Entry-level signals (0-30)
    4. AI/startup signals (0-10)
    Min threshold to store: 35
    Returns (score, reasons)
    """
    reasons = []

    # Hard exclude check
    if _is_hard_excluded(role):
        return 0, []

    role_lower = role.lower()
    desc_lower_full = description.lower()
    text = f"{role_lower} {desc_lower_full}"
    loc_text = (location + " " + description).lower()
    co = company.lower()

    # 1. Role match (0-35 pts) — title matches count fully; desc-only matches count partially
    title_matched = [r for r in TARGET_ROLES if r in role_lower]
    desc_only_matched = [r for r in TARGET_ROLES if r not in role_lower and r in desc_lower_full]

    if not title_matched and not desc_only_matched:
        return 0, []  # No keyword match at all — reject

    # Weight: title matches = 2pts each, desc-only = 0.5pts each (capped at equivalent of 2 title hits)
    effective_matches = len(title_matched) + min(len(desc_only_matched) * 0.5, 1)

    if title_matched:
        if effective_matches >= 3:
            role_pts = 35
        elif effective_matches >= 2:
            role_pts = 28
        else:
            role_pts = 20
    else:
        # Only description matches — weak signal
        role_pts = 10
    reasons.append(f"Role: {', '.join((title_matched + desc_only_matched)[:3])}")

    # 2. Location (0-25 pts)
    loc_lower = loc_text
    nyc_hits = ["new york", "nyc", "manhattan", "brooklyn"]
    sf_hits = ["san francisco", "sf", "bay area", "soma"]
    remote_hits = ["remote", "hybrid"]

    if any(h in loc_lower for h in nyc_hits):
        loc_pts = 25
        reasons.append("Location: NYC")
    elif any(h in loc_lower for h in sf_hits):
        loc_pts = 25
        reasons.append("Location: SF")
    elif any(h in loc_lower for h in remote_hits):
        loc_pts = 15   # raised: remote/hybrid roles are competitive targets
        reasons.append("Remote/Hybrid")
    else:
        loc_pts = 5    # small credit for unknown location — don't hard-penalise good matches

    # 3. Entry-level signals (0-30 pts)
    # Check description for experience requirements FIRST — these override positive signals.
    desc_lower = desc_lower_full

    # ── Experience gate — hard filter for 5+ year requirements ──────────────────
    # Use extract_min_years for consistent parsing across all code paths
    desc_min_years = extract_min_years(desc_lower)

    if desc_min_years is not None and desc_min_years >= 5:
        return 0, []
    elif desc_min_years is not None and desc_min_years in (3, 4):
        entry_pts = 5
        reasons.append(f"{desc_min_years}+ yrs exp required (reach)")
    elif desc_min_years is not None and desc_min_years in (1, 2):
        entry_pts = 12
        reasons.append(f"{desc_min_years} yr exp required (stretch)")
    elif desc_min_years == 0:
        entry_pts = 30
        reasons.append("Entry-level friendly")
    else:
        clear_entry = [
            "new grad", "entry level", "entry-level", "0-2 years", "recent graduate",
            "no experience required", "0 years", "new graduate", "early career",
        ]
        if any(s in text for s in clear_entry):
            entry_pts = 30
            reasons.append("Entry-level friendly")
        else:
            entry_pts = 20  # no explicit signals — many startups simply don't state requirements

    # 4. AI/startup signals (0-10 pts)
    ai_hit = [k for k in AI_SIGNALS if k in text or k in co]
    if len(ai_hit) >= 2:
        ai_pts = 10
        reasons.append(f"AI/startup: {', '.join(ai_hit[:2])}")
    elif len(ai_hit) == 1:
        ai_pts = 5
        reasons.append(f"AI/startup: {ai_hit[0]}")
    else:
        ai_pts = 0

    total = role_pts + loc_pts + entry_pts + ai_pts
    return max(0, min(100, total)), reasons


def extract_company_metadata(description: str) -> dict:
    """
    Extract funding_stage and employee_count from job description text.
    Returns dict with keys 'funding_stage' and 'employee_count' (may be None).
    """
    if not description:
        return {"funding_stage": None, "employee_count": None}

    text = description.lower()

    # Funding stage
    funding_stage = None
    if "pre-seed" in text or "pre seed" in text:
        funding_stage = "Seed"
    elif "series d" in text or "series e" in text or "series f" in text:
        funding_stage = "Series C+"
    elif "series c" in text:
        funding_stage = "Series C+"
    elif "series b" in text:
        funding_stage = "Series B"
    elif "series a" in text:
        funding_stage = "Series A"
    elif "seed" in text:
        funding_stage = "Seed"

    # Employee count — look for patterns like "50-person", "200 employees", "team of 50", "~100 people"
    employee_count = None
    patterns = [
        r'(\d+)\s*[-–]\s*(\d+)\s*(?:person|people|employee|member)',
        r'team\s+of\s+[~\s]*(\d+)',
        r'[~≈]?\s*(\d+)\s*(?:person|people|employee|member)',
        r'(\d+)\s*\+\s*(?:person|people|employee|member)',
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            # Use the first captured number as the count
            try:
                num = int(m.group(1))
                if num <= 50:
                    employee_count = "1-50"
                elif num <= 200:
                    employee_count = "50-200"
                elif num <= 500:
                    employee_count = "200-500"
                else:
                    employee_count = "500+"
                break
            except (ValueError, IndexError):
                pass

    return {"funding_stage": funding_stage, "employee_count": employee_count}


def _clean_description(text: str) -> str:
    """Strip HTML tags and decode HTML entities from a description."""
    if not text:
        return ""
    # Strip HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Decode common HTML entities
    text = (text
        .replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
        .replace("&quot;", '"').replace("&#x27;", "'").replace("&nbsp;", " ")
        .replace("&#39;", "'").replace("&hellip;", "…")
    )
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


_MONTH_MAP = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
}
_MP = r'(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'


def extract_deadline(text: str):
    """
    Scan a job description for an explicit application deadline.
    Returns 'YYYY-MM-DD' string or None.
    Only extracts deadlines that are stated verbatim in the text (not inferred).
    """
    if not text:
        return None
    t = text.lower()

    # Skip postings that explicitly say no fixed deadline
    if re.search(r'rolling\s+basis|open\s+until\s+filled|until\s+position\s+is\s+filled', t):
        return None

    def _parse_date(groups, ptype):
        """Attempt to build a date.date from regex groups based on pattern type."""
        try:
            if ptype == 'mdy':   # Month DD YYYY
                mo = _MONTH_MAP.get(groups[0][:3])
                d, y = int(groups[1]), int(groups[2])
            elif ptype == 'dmy':  # DD Month YYYY
                d = int(groups[0])
                mo = _MONTH_MAP.get(groups[1][:3])
                y = int(groups[2])
            elif ptype == 'iso':  # YYYY-MM-DD
                y, mo, d = int(groups[0]), int(groups[1]), int(groups[2])
            elif ptype == 'us':   # MM/DD/YYYY
                mo, d, y = int(groups[0]), int(groups[1]), int(groups[2])
            elif ptype == 'md':   # Month DD  (no year — assume current/next)
                mo = _MONTH_MAP.get(groups[0][:3])
                d = int(groups[1])
                today = _date.today()
                y = today.year
                candidate = _date(y, mo, d)
                if candidate < today:
                    y += 1
            else:
                return None
            return _date(y, mo, d)
        except (ValueError, TypeError, KeyError):
            return None

    # Ordered from most specific to broadest
    PATS = [
        (rf'{_MP}\s+(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(\d{{4}})',       'mdy'),
        (rf'(\d{{1,2}})(?:st|nd|rd|th)?\s+{_MP}\s+(\d{{4}})',          'dmy'),
        (r'(\d{4})-(\d{2})-(\d{2})',                                    'iso'),
        (r'(\d{1,2})/(\d{1,2})/(\d{4})',                               'us'),
        (rf'{_MP}\s+(\d{{1,2}})(?:st|nd|rd|th)?(?!\s*,?\s*\d{{4}})',   'md'),
    ]

    TRIGGERS = [
        r'(?:application(?:s)?\s+)?deadline[:\s]+(?:is\s+|by\s+)?',
        r'apply\s+by[:\s]+',
        r'apply\s+no\s+later\s+than[:\s]+',
        r'applications?\s+due[:\s]+(?:by\s+)?',
        r'applications?\s+must\s+be\s+(?:submitted|received)\s+by[:\s]+',
        r'application(?:s)?\s+(?:closes?|closing)\s*(?:on\s+|by\s+)?',
        r'position\s+(?:closes?|closing)\s*(?:on\s+|by\s+)?',
        r'no\s+later\s+than[:\s]+',
        r'last\s+day\s+to\s+apply[:\s]+(?:is\s+)?',
        r'applications?\s+accepted\s+through[:\s]+',
        r'submit\s+(?:your\s+)?applications?\s+by[:\s]+',
    ]

    today = _date.today()
    for trigger in TRIGGERS:
        m = re.search(trigger + r'(.{0,80})', t)
        if not m:
            continue
        segment = m.group(1)
        for pat, ptype in PATS:
            dm = re.search(pat, segment)
            if not dm:
                continue
            d = _parse_date(dm.groups(), ptype)
            if d and (d - today).days >= -30:   # accept up to 30 days past (recently scraped)
                return d.strftime('%Y-%m-%d')

    return None


def make_job(company, role, location, url, source, description="", posted=""):
    clean_desc = _clean_description(description)
    score, reasons = score_job(company, role, location, clean_desc)
    meta = extract_company_metadata(clean_desc)
    return {
        "company": company.strip(),
        "role": role.strip(),
        "location": location.strip() if location else "",
        "job_url": url,
        "source": source,
        "description": clean_desc[:3000],
        "posted_date": posted,
        "match_score": score,
        "match_reasons": "; ".join(reasons),
        "is_active": True,
        "added_to_tracker": False,
        "funding_stage": meta.get("funding_stage"),
        "employee_count": meta.get("employee_count"),
        "min_years_required": extract_min_years(clean_desc),
        "deadline": extract_deadline(clean_desc),
    }


# ─────────────────────────────────────────────
# SOURCE 1: Hacker News "Who Is Hiring?"
# ─────────────────────────────────────────────
async def scrape_hn_who_is_hiring() -> List[Dict]:
    """
    HN posts a monthly 'Who Is Hiring?' thread. This is extremely high signal
    — real companies, real roles, posted by founders/hiring managers directly.
    Uses the free HN Firebase API.
    """
    jobs = []
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            # Get most recent thread from whoishiring account
            user_resp = await client.get("https://hacker-news.firebaseio.com/v0/user/whoishiring.json")
            submitted = user_resp.json().get("submitted", [])
            if not submitted:
                return jobs

            # Find the most recent "Who is hiring?" thread
            thread_id = None
            for item_id in submitted[:10]:
                r = await client.get(f"https://hacker-news.firebaseio.com/v0/item/{item_id}.json")
                item = r.json()
                if "hiring" in (item.get("title") or "").lower():
                    thread_id = item_id
                    kids = item.get("kids", [])
                    break

            if not thread_id:
                return jobs

            # Fetch all job posts concurrently (up to 300)
            async def fetch_item(kid_id):
                try:
                    r = await client.get(f"https://hacker-news.firebaseio.com/v0/item/{kid_id}.json", timeout=10.0)
                    return r.json()
                except Exception:
                    return None

            tasks = [fetch_item(k) for k in kids[:300]]
            items = await asyncio.gather(*tasks)

            for item in items:
                if not item or item.get("type") != "comment":
                    continue
                text = item.get("text", "") or ""
                # Decode HTML entities
                text = text.replace("&#x27;", "'").replace("&amp;", "&").replace("&quot;", '"').replace("&#x2F;", "/")
                plain = re.sub(r"<[^>]+>", " ", text).strip()
                if not plain or len(plain) < 30:
                    continue

                # HN format: "Company | Role | Location | Type\n\nDescription"
                # or "Company | Role | Location"
                first_line = plain.split("\n")[0].strip()
                rest = " ".join(plain.split("\n")[1:]).strip()

                parts = [p.strip() for p in re.split(r"\s*\|\s*", first_line)]
                if len(parts) < 2:
                    continue

                company = parts[0]
                role = parts[1] if len(parts) > 1 else ""
                location = parts[2] if len(parts) > 2 else ""
                job_type = parts[3] if len(parts) > 3 else ""
                description = f"{first_line} {rest}"

                # Skip pure meta posts
                if not company or not role:
                    continue

                score, reasons = score_job(company, role, location, description)
                if score >= 0:
                    url = f"https://news.ycombinator.com/item?id={item.get('id', thread_id)}"
                    jobs.append(make_job(company, role, location, url, "HN Who's Hiring", description))

    except Exception as e:
        print(f"[HN Hiring] Error: {e}")
    print(f"[HN Hiring] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE 2: Ali Rohde Jobs (Substack)
# ─────────────────────────────────────────────
async def scrape_ali_rohde() -> List[Dict]:
    """
    Ali Rohde's weekly newsletter: Chief of Staff, BizOps, VC roles.
    HTML format: <p><a href="DIRECT_JOB_URL">Role Title</a>, Company (details), Location</p>
    Extracts the actual job application URL from each anchor tag.
    """
    jobs = []
    # URLs to skip — these are newsletter meta-links, not job postings
    SKIP_URL_FRAGMENTS = [
        "substack.com", "airtable.com/shr", "linkedin.com/company",
        "twitter.com", "x.com", "outsetcapital.com", "instagram.com",
    ]

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get("https://alirohdejobs.substack.com/api/v1/posts?limit=10")
            posts = resp.json()
            if not isinstance(posts, list):
                posts = posts.get("posts", [])

            for post in posts:
                html = post.get("body_html", "") or ""
                post_url = post.get("canonical_url", "https://alirohdejobs.substack.com")
                posted = post.get("post_date", "")

                # Each job is a <p> tag: <p><a href="JOB_URL">Role</a>, Company (details), Location</p>
                p_tags = re.findall(r"<p>(.*?)</p>", html, re.DOTALL)

                for p in p_tags:
                    # Must contain a link to be a job entry
                    link_match = re.search(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', p, re.DOTALL)
                    if not link_match:
                        continue

                    job_url = link_match.group(1).strip()
                    role_raw = link_match.group(2)
                    role = re.sub(r"<[^>]+>", "", role_raw).strip()
                    role = role.replace("&amp;", "&").replace("&#x27;", "'").replace("&quot;", '"')

                    # Skip meta links (subscribe buttons, form links, etc.)
                    if any(frag in job_url for frag in SKIP_URL_FRAGMENTS):
                        continue
                    if not role or len(role) < 4:
                        continue

                    # Text after the link: ", Company (details), Location"
                    after_raw = p[link_match.end():]
                    after_text = re.sub(r"<[^>]+>", "", after_raw).strip().lstrip(",").strip()
                    after_text = after_text.replace("&amp;", "&").replace("&#x27;", "'").replace("&quot;", '"')

                    # Company name: text before first parenthesis or comma
                    co_match = re.match(r"^([^,(]+)", after_text)
                    company = co_match.group(1).strip() if co_match else ""
                    if not company:
                        continue

                    # Location: last segment outside parentheses, after last comma
                    loc_match = re.search(r"\),\s*([^,()]+)\s*$", after_text)
                    if not loc_match:
                        loc_match = re.search(r",\s*([^,()]+)\s*$", after_text)
                    location = loc_match.group(1).strip() if loc_match else "NYC / Various"

                    description = f"{role} — {after_text}"
                    score, reasons = score_job(company, role, location, description)
                    if score >= 0:
                        jobs.append(make_job(company, role, location, job_url, "Ali Rohde Jobs", description, posted))

    except Exception as e:
        print(f"[Ali Rohde] Error: {e}")
    print(f"[Ali Rohde] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE 3: Remote OK (free public JSON API)
# ─────────────────────────────────────────────
async def scrape_remoteok() -> List[Dict]:
    jobs = []
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://remoteok.com/api",
                headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
            )
            listings = resp.json()
            if not isinstance(listings, list):
                return jobs
            for job in listings[1:]:  # first item is metadata
                role = job.get("position", "")
                company = job.get("company", "")
                tags = " ".join(job.get("tags", []))
                description = job.get("description", "")
                url = job.get("url", "https://remoteok.com")
                posted = job.get("date", "")
                combined = f"{role} {tags} {description}"
                score, reasons = score_job(company, role, "Remote", combined)
                if score >= 0:
                    jobs.append(make_job(company, role, "Remote", url, "Remote OK", description, posted))
    except Exception as e:
        print(f"[Remote OK] Error: {e}")
    print(f"[Remote OK] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE 4: Greenhouse job boards (AI startups)
# ─────────────────────────────────────────────
async def scrape_greenhouse() -> List[Dict]:
    """
    Many AI startups post on Greenhouse. Each company has a public JSON API:
    https://boards-api.greenhouse.io/v1/boards/{company}/jobs
    """
    jobs = []
    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
        async def fetch_company(slug, name):
            try:
                resp = await client.get(
                    f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true",
                    timeout=10.0,
                )
                if resp.status_code != 200:
                    return []
                data = resp.json()
                results = []
                for job in data.get("jobs", []):
                    role = job.get("title", "")
                    location = job.get("location", {}).get("name", "")
                    url = job.get("absolute_url", "")
                    content = re.sub(r"<[^>]+>", " ", job.get("content", "") or "")
                    score, reasons = score_job(name, role, location, content)
                    if score >= 0:
                        results.append(make_job(name, role, location, url, "Greenhouse", content))
                return results
            except Exception:
                return []  # Silently ignore failures

        tasks = [fetch_company(slug, name) for slug, name in GREENHOUSE_COMPANIES]
        results = await asyncio.gather(*tasks)
        for r in results:
            jobs.extend(r)

    print(f"[Greenhouse] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE 5: Lever job boards (AI startups)
# ─────────────────────────────────────────────
async def scrape_lever() -> List[Dict]:
    """Lever public API: https://api.lever.co/v0/postings/{company}?mode=json"""
    jobs = []
    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
        async def fetch_company(slug, name):
            try:
                resp = await client.get(
                    f"https://api.lever.co/v0/postings/{slug}?mode=json",
                    timeout=10.0,
                )
                if resp.status_code != 200:
                    return []
                results = []
                for job in resp.json():
                    role = job.get("text", "")
                    location = job.get("categories", {}).get("location", "")
                    url = job.get("hostedUrl", "")
                    description = re.sub(r"<[^>]+>", " ", job.get("descriptionPlain", "") or "")
                    score, reasons = score_job(name, role, location, description)
                    if score >= 0:
                        results.append(make_job(name, role, location, url, "Lever", description))
                return results
            except Exception:
                return []  # Silently ignore failures

        tasks = [fetch_company(slug, name) for slug, name in LEVER_COMPANIES]
        results = await asyncio.gather(*tasks)
        for r in results:
            jobs.extend(r)

    print(f"[Lever] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE 6: Ashby job boards (AI startups)
# ─────────────────────────────────────────────
async def scrape_ashby() -> List[Dict]:
    """
    Ashby public REST API (replaces broken GraphQL endpoint).
    GET https://api.ashbyhq.com/posting-api/job-board/{slug}
    Returns JSON: { jobs: [{id, title, location, jobUrl, descriptionHtml, descriptionPlain, ...}] }
    """
    jobs = []
    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
        async def fetch_company(slug, name):
            try:
                resp = await client.get(
                    f"https://api.ashbyhq.com/posting-api/job-board/{slug}",
                    timeout=10.0,
                )
                if resp.status_code != 200:
                    return []
                results = []
                for job in resp.json().get("jobs", []):
                    role     = job.get("title", "")
                    location = job.get("location", "") or ""
                    url      = job.get("jobUrl", "") or f"https://jobs.ashbyhq.com/{slug}"
                    desc     = job.get("descriptionPlain", "") or re.sub(
                        r"<[^>]+>", " ", job.get("descriptionHtml", "") or ""
                    )
                    score, _ = score_job(name, role, location, desc)
                    if score >= 0:
                        results.append(make_job(name, role, location, url, "Ashby", desc))
                return results
            except Exception:
                return []

        tasks = [fetch_company(slug, name) for slug, name in ASHBY_COMPANIES]
        results = await asyncio.gather(*tasks)
        for r in results:
            jobs.extend(r)

    print(f"[Ashby] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE 7: Workable job boards
# ─────────────────────────────────────────────
async def scrape_workable() -> List[Dict]:
    """
    Remotive public API — replaces Workable (Workable's per-company API is gone).
    Free, no auth required. Returns remote jobs across business/sales/marketing/ops categories.
    https://remotive.com/api/remote-jobs?category={cat}
    """
    jobs = []
    # Categories that map to our target roles
    categories = [
        "management-finance",
        "customer-support",
        "sales",
        "marketing",
        "business",
        "hr",
    ]
    seen = set()
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers=HEADERS) as client:
            for cat in categories:
                try:
                    resp = await client.get(
                        f"https://remotive.com/api/remote-jobs?category={cat}",
                        timeout=12.0,
                    )
                    if resp.status_code != 200:
                        continue
                    for job in resp.json().get("jobs", []):
                        company  = job.get("company_name", "")
                        role     = job.get("title", "")
                        location = job.get("candidate_required_location", "Remote") or "Remote"
                        url      = job.get("url", "")
                        desc     = re.sub(r"<[^>]+>", " ", job.get("description", "") or "")
                        posted   = (job.get("publication_date") or "")[:10]
                        if company and role:
                            key = f"{company.lower()}|{role.lower()}"
                            if key not in seen:
                                seen.add(key)
                                score, _ = score_job(company, role, location, desc)
                                if score >= 0:
                                    jobs.append(make_job(company, role, location, url, "Remotive", desc, posted))
                except Exception:
                    pass
    except Exception as e:
        print(f"[Remotive] Error: {e}")
    print(f"[Remotive] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE 8: Wellfound (AngelList)
# ─────────────────────────────────────────────
async def scrape_wellfound() -> List[Dict]:
    """
    Wellfound is now blocked (403 Cloudflare). Replaced with Jobicy — a remote
    job board with a free public JSON API. Targets ops/strategy/business/growth roles.
    Valid industry slugs: business, sales, marketing, hr (no hyphens, no 'customer-success')
    """
    jobs = []
    industries = ["business", "sales", "marketing", "hr"]
    seen = set()
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers=HEADERS) as client:
            for industry in industries:
                try:
                    resp = await client.get(
                        f"https://jobicy.com/api/v2/remote-jobs?count=50&industry={industry}",
                        timeout=12.0,
                    )
                    if resp.status_code != 200:
                        continue
                    data = resp.json()
                    for job in data.get("jobs", []):
                        company  = job.get("companyName", "")
                        role     = job.get("jobTitle", "")
                        location = job.get("jobGeo", "Remote") or "Remote"
                        url      = job.get("url", "")
                        desc     = re.sub(r"<[^>]+>", " ", job.get("jobDescription", "") or "")
                        posted   = (job.get("pubDate") or "")[:10]
                        if company and role:
                            key = f"{company.lower()}|{role.lower()}"
                            if key not in seen:
                                seen.add(key)
                                score, _ = score_job(company, role, location, desc)
                                if score >= 0:
                                    jobs.append(make_job(company, role, location, url, "Jobicy", desc, posted))
                except Exception:
                    pass
    except Exception as e:
        print(f"[Jobicy] Error: {e}")
    print(f"[Jobicy] {len(jobs)} jobs found")
    return jobs


# Wellfound is blocked (403 Cloudflare) — removed, replaced by scrape_wellfound() above


# ─────────────────────────────────────────────
# SOURCE: YC Work at a Startup
# ─────────────────────────────────────────────
async def scrape_yc_startup_jobs() -> List[Dict]:
    """
    YC company ATS discovery — two parallel strategies:
    1. Career-page crawl for recent 8 batches (W24–W25 + S23–S24) — finds exact ATS links
    2. Fast slug-based ATS discovery for ALL ~4000+ YC companies — derives slug from domain

    The YC API (api.ycombinator.com/v0.1/companies) is public and paginated.
    We hit it with no batch filter to get all companies, then try
    Greenhouse / Lever / Ashby using the domain-derived slug.
    """
    jobs = []

    GH_RE    = re.compile(r'boards?\.greenhouse\.io/(?:embed/job_board\?for=)?([A-Za-z0-9_\-]+)', re.IGNORECASE)
    ASHBY_RE = re.compile(r'jobs\.ashbyhq\.com/([A-Za-z0-9_.\-]+)', re.IGNORECASE)
    LEVER_RE = re.compile(r'jobs\.lever\.co/([A-Za-z0-9_\-]+)', re.IGNORECASE)

    known_gh    = {s.lower() for s, _ in GREENHOUSE_COMPANIES + GREENHOUSE_COMPANIES_EXTRA}
    known_ashby = {s.lower() for s, _ in ASHBY_COMPANIES + ASHBY_COMPANIES_EXTRA}
    known_lever = {s.lower() for s, _ in LEVER_COMPANIES + LEVER_COMPANIES_EXTRA}

    try:
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True, headers=HEADERS) as client:

            # ── Step 1: Fetch ALL YC companies (paginated, no batch filter) ─────
            all_companies = []
            seen_ids = set()
            page = 1
            while True:
                try:
                    resp = await client.get(
                        f"https://api.ycombinator.com/v0.1/companies?page={page}&per_page=25",
                        timeout=15.0,
                    )
                    if resp.status_code != 200:
                        break
                    data = resp.json()
                    batch = data.get("companies", [])
                    if not batch:
                        break
                    for co in batch:
                        cid = co.get("id") or co.get("slug") or co.get("name")
                        if cid and cid not in seen_ids:
                            seen_ids.add(cid)
                            all_companies.append(co)
                    total_pages = data.get("totalPages", 999)
                    # Cap at 2000 companies to stay within Railway 512MB RAM limit
                    if len(all_companies) >= 2000 or page >= total_pages:
                        break
                    page += 1
                except Exception:
                    break

            print(f"[YC Jobs] {len(all_companies)} YC companies fetched")

            # ── Step 2: Fast slug-based ATS discovery for all companies ──────────
            sem = asyncio.Semaphore(15)  # Reduced from 25 to ease memory pressure
            MAX_PER_CO = 15

            async def discover_yc_ats(co: dict):
                name    = (co.get("name") or "").strip()
                website = (co.get("website") or "").strip()
                if not name or not website:
                    return []

                # Derive ATS slug from domain
                domain = re.sub(r'^https?://', '', website).split('/')[0].strip()
                slugs  = _domain_to_ats_slugs(domain)
                found  = []

                async with sem:
                    for slug in slugs:
                        if len(found) >= MAX_PER_CO:
                            break
                        # Greenhouse
                        if slug.lower() not in known_gh:
                            try:
                                r = await client.get(
                                    f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true",
                                    timeout=6.0,
                                )
                                if r.status_code == 200:
                                    for j in r.json().get("jobs", []):
                                        if len(found) >= MAX_PER_CO:
                                            break
                                        role = j.get("title", "")
                                        loc  = j.get("location", {}).get("name", "")
                                        url  = j.get("absolute_url", "")
                                        desc = re.sub(r"<[^>]+>", " ", j.get("content", "") or "")
                                        jb = _make_vc_job(name, role, loc, url, "YC Company (Greenhouse)", desc)
                                        if jb:
                                            found.append(jb)
                                    if found:
                                        return found
                            except Exception:
                                pass

                        # Lever
                        if slug.lower() not in known_lever:
                            try:
                                r = await client.get(
                                    f"https://api.lever.co/v0/postings/{slug}?mode=json",
                                    timeout=6.0,
                                )
                                if r.status_code == 200 and isinstance(r.json(), list) and r.json():
                                    for p in r.json():
                                        if len(found) >= MAX_PER_CO:
                                            break
                                        role = p.get("text", "")
                                        loc  = p.get("categories", {}).get("location", "") or ""
                                        url  = p.get("hostedUrl", "")
                                        desc = p.get("descriptionPlain", "") or ""
                                        jb = _make_vc_job(name, role, loc, url, "YC Company (Lever)", desc)
                                        if jb:
                                            found.append(jb)
                                    if found:
                                        return found
                            except Exception:
                                pass

                        # Ashby
                        if slug.lower() not in known_ashby:
                            try:
                                r = await client.get(
                                    f"https://api.ashbyhq.com/posting-api/job-board/{slug}",
                                    timeout=6.0,
                                )
                                if r.status_code == 200:
                                    for j in r.json().get("jobs", []):
                                        if len(found) >= MAX_PER_CO:
                                            break
                                        role = j.get("title", "")
                                        loc  = j.get("location", "") or ""
                                        url  = j.get("jobUrl", "") or f"https://jobs.ashbyhq.com/{slug}"
                                        desc = j.get("descriptionPlain", "") or ""
                                        jb = _make_vc_job(name, role, loc, url, "YC Company (Ashby)", desc)
                                        if jb:
                                            found.append(jb)
                                    if found:
                                        return found
                            except Exception:
                                pass
                return found

            # Process in chunks of 150 to keep memory usage low on Railway (512MB)
            CHUNK = 150
            for i in range(0, len(all_companies), CHUNK):
                chunk = all_companies[i:i + CHUNK]
                chunk_results = await asyncio.gather(
                    *[discover_yc_ats(co) for co in chunk],
                    return_exceptions=True,
                )
                for r in chunk_results:
                    if isinstance(r, list):
                        jobs.extend(r)
                print(f"[YC Jobs] Processed {min(i + CHUNK, len(all_companies))}/{len(all_companies)} companies, {len(jobs)} jobs so far")

    except Exception as e:
        print(f"[YC Jobs] Error: {e}")

    print(f"[YC Jobs] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE: Arbeitnow (replaces Himalayas — fully client-side rendered)
# ─────────────────────────────────────────────
async def scrape_himalayas() -> List[Dict]:
    """
    Arbeitnow — free public job board API (no auth required).
    Returns up to 100 jobs per page across all categories.
    Himalayas switched to fully client-side rendering (no server-side job data
    in HTML), so we replaced it with Arbeitnow which has a proper public API.
    https://www.arbeitnow.com/api/job-board-api?page=1
    """
    jobs = []
    seen = set()
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers=HEADERS) as client:
            for page in range(1, 4):  # pages 1–3 → up to 300 jobs
                try:
                    resp = await client.get(
                        "https://www.arbeitnow.com/api/job-board-api",
                        params={"page": page},
                        timeout=12.0,
                    )
                    if resp.status_code != 200:
                        break
                    data = resp.json()
                    batch = data.get("data", [])
                    if not batch:
                        break
                    for job in batch:
                        company  = job.get("company_name", "")
                        role     = job.get("title", "")
                        location = job.get("location", "Remote") or "Remote"
                        url      = job.get("url", "")
                        desc     = re.sub(r"<[^>]+>", " ", job.get("description", "") or "")
                        posted   = str(job.get("created_at", ""))[:10]
                        if company and role:
                            key = f"{company.lower()}|{role.lower()}"
                            if key not in seen:
                                seen.add(key)
                                score, _ = score_job(company, role, location, desc)
                                if score >= 0:
                                    jobs.append(make_job(company, role, location, url, "Arbeitnow", desc, posted))
                except Exception:
                    pass
    except Exception as e:
        print(f"[Arbeitnow] Error: {e}")
    print(f"[Arbeitnow] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE: We Work Remotely (RSS)
# ─────────────────────────────────────────────
async def scrape_weworkremotely() -> List[Dict]:
    """
    We Work Remotely — RSS feeds for business/management and product roles.
    Completely public, no auth required.
    """
    jobs = []
    feeds = [
        # Updated slugs — old ones (remote-business-management-jobs, remote-product-jobs)
        # now return 301 with empty bodies. Current valid slugs from WWR's own homepage:
        "https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss",
        "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss",
        "https://weworkremotely.com/categories/remote-product-jobs.rss",
        "https://weworkremotely.com/categories/remote-customer-support-jobs.rss",
    ]
    seen = set()
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, headers=HEADERS) as client:
            for feed_url in feeds:
                try:
                    resp = await client.get(feed_url)
                    if resp.status_code != 200:
                        continue
                    xml = resp.text
                    for item_xml in re.findall(r'<item>(.*?)</item>', xml, re.DOTALL):
                        title_m = re.search(r'<title><!\[CDATA\[(.*?)\]\]></title>', item_xml)
                        link_m  = re.search(r'<link>(https?://[^\s<]+)', item_xml)
                        desc_m  = re.search(r'<description><!\[CDATA\[(.*?)\]\]></description>', item_xml, re.DOTALL)
                        if not title_m:
                            continue
                        full_title = title_m.group(1).strip()
                        # Format: "Company: Role Title"
                        if ': ' in full_title:
                            company, role = full_title.split(': ', 1)
                        else:
                            company, role = "", full_title
                        url  = link_m.group(1).strip() if link_m else ""
                        desc = re.sub(r'<[^>]+>', ' ', desc_m.group(1) if desc_m else "")
                        if company and role:
                            key = f"{company.lower()}|{role.lower()}"
                            if key not in seen:
                                seen.add(key)
                                score, _ = score_job(company, role, "Remote", desc)
                                if score >= 0:
                                    jobs.append(make_job(company, role, "Remote", url, "We Work Remotely", desc))
                except Exception:
                    pass
    except Exception as e:
        print(f"[WWR] Error: {e}")
    print(f"[We Work Remotely] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE: VC Firm Job Boards
# Covers top 50 VC firms via:
#  1. Getro-powered boards (dynamic ATS discovery)
#  2. Hardcoded portfolio company lists (300+ companies)
# ─────────────────────────────────────────────

# ── Getro-powered VC job boards ───────────────────────────────────────────────
# These VC firms use Getro.com to power their portfolio job boards.
# We scrape __NEXT_DATA__ from each board to discover portfolio company domains,
# then hit each company's ATS (Greenhouse / Lever / Ashby) directly.
GETRO_VC_BOARDS = [
    # ── Tier 1: Confirmed Getro boards ──────────────────────────────────────
    ("General Catalyst",         "https://jobs.generalcatalyst.com"),
    ("Accel",                    "https://jobs.accel.com"),
    ("Khosla Ventures",          "https://jobs.khoslaventures.com"),
    ("Insight Partners",         "https://jobs.insightpartners.com"),
    ("True Ventures",            "https://jobs.trueventures.com"),
    ("Lux Capital",              "https://jobs.luxcapital.com"),
    ("Thrive Capital",           "https://jobs.thrivecap.com"),
    ("Redpoint Ventures",        "https://careers.redpoint.com"),
    ("Coatue",                   "https://jobs.coatue.com"),
    ("Madrona",                  "https://jobs.madrona.com"),
    ("Menlo Ventures",           "https://jobs.menlovc.com"),
    ("Craft Ventures",           "https://jobs.craftventures.com"),
    # ── Tier 2: High-confidence Getro boards ─────────────────────────────────
    ("Lightspeed",               "https://jobs.lsvp.com"),
    ("IVP",                      "https://jobs.ivp.com"),
    ("Spark Capital",            "https://jobs.sparkcap.com"),
    ("Founders Fund",            "https://jobs.foundersfund.com"),
    ("Forerunner Ventures",      "https://jobs.forerunnerventures.com"),
    ("Lerer Hippeau",            "https://jobs.lererhippeau.com"),
    ("Primary Venture Partners", "https://jobs.primary.vc"),
    ("RRE Ventures",             "https://jobs.rre.com"),
    ("Firstmark Capital",        "https://jobs.firstmarkcap.com"),
    ("Matrix Partners",          "https://jobs.matrixpartners.com"),
    ("Pear VC",                  "https://jobs.pear.vc"),
    ("Slow Ventures",            "https://jobs.slow.co"),
    ("Cowboy Ventures",          "https://jobs.cowboyvc.com"),
    ("Sapphire Ventures",        "https://jobs.sapphireventures.com"),
    ("Bowery Capital",           "https://jobs.bowerycap.com"),
    ("Village Global",           "https://jobs.villageglobal.vc"),
    ("Sound Ventures",           "https://jobs.soundventures.com"),
    ("WndrCo",                   "https://jobs.wndrco.com"),
    ("High Alpha",               "https://jobs.highalpha.com"),
    ("Wing VC",                  "https://jobs.wing.vc"),
    ("Freestyle Capital",        "https://jobs.freestyle.vc"),
    ("Innovation Endeavors",     "https://jobs.innovationendeavors.com"),
    ("M13",                      "https://jobs.m13.co"),
    ("Obvious Ventures",         "https://jobs.obvious.com"),
    ("Costanoa Ventures",        "https://jobs.costanoa.vc"),
    ("Headline VC",              "https://jobs.headline.com"),
    ("Initialized Capital",      "https://jobs.initialized.com"),
    ("Better Tomorrow Ventures", "https://jobs.btv.vc"),
    ("Bonfire Ventures",         "https://jobs.bonfirevc.com"),
    ("Shasta Ventures",          "https://jobs.shastaventures.com"),
    ("Crosscut Ventures",        "https://jobs.crosscut.vc"),
    ("Data Collective (DCVC)",   "https://jobs.dcvc.com"),
    ("500 Global",               "https://jobs.500.co"),
    ("Techstars",                "https://jobs.techstars.com"),
    ("SoftBank Vision Fund",     "https://jobs.sbvisionfund.com"),
    ("Two Sigma Ventures",       "https://jobs.twosigmaventures.com"),
    ("Global Founders Capital",  "https://jobs.globalfounderscapital.com"),
    ("Union Square Ventures",    "https://jobs.usv.com"),
    ("SV Angel",                 "https://jobs.svangel.com"),
    ("Upfront Ventures",         "https://jobs.upfront.com"),
    ("Canaan Partners",          "https://jobs.canaanpartners.com"),
    ("General Atlantic",         "https://jobs.generalatlantic.com"),
    ("Kapor Capital",            "https://jobs.kaporcapital.com"),
    ("Precursor Ventures",       "https://jobs.precursorvc.com"),
    ("ff Venture Capital",       "https://jobs.ffvc.com"),
    ("Cherry Ventures",          "https://jobs.cherry.vc"),
    ("Balderton Capital",        "https://jobs.balderton.com"),
    ("Alumni Ventures",          "https://jobs.alumniventures.com"),
    ("Operator Collective",      "https://jobs.operatorcollective.com"),
    ("Backstage Capital",        "https://jobs.backstagecapital.com"),
    ("Rough Draft Ventures",     "https://jobs.roughdraft.vc"),
    ("XYZ Venture Capital",      "https://jobs.xyz.vc"),
    ("Storm Ventures",           "https://jobs.stormventures.com"),
    ("Elevation Capital",        "https://jobs.elevationcapital.com"),
    ("Interplay Ventures",       "https://jobs.interplayvc.com"),
    ("Clocktower Ventures",      "https://jobs.clocktowerventures.com"),
    ("Obvious Ventures",         "https://jobs.obvious.vc"),
    ("Congruent Ventures",       "https://jobs.congruentvc.com"),
    ("Bee Partners",             "https://jobs.beepartners.com"),
]


def _domain_to_ats_slugs(domain: str) -> list:
    """
    Derive candidate ATS board slugs from a company domain.
    'rippling.com' → ['rippling']
    'abnormal-security.com' → ['abnormal-security', 'abnormalsecurity']
    'co-pilot.ai' → ['co-pilot', 'copilot']
    """
    base = re.sub(r"^www\.", "", domain.lower())
    base = re.sub(r"\.[a-z]{2,6}$", "", base)   # strip .com / .io / .ai / .app
    base = re.sub(r"\.[a-z]{2,6}$", "", base)   # strip second TLD (.co.uk)
    slugs = [base]
    if "-" in base:
        slugs.append(base.replace("-", ""))
    return slugs


# ── Hardcoded portfolio company lists (300+ companies across top 50 VC firms) ──
# Organized by ATS so we can hit each company's job board directly.

# Companies from top VC portfolios known to use Greenhouse
GREENHOUSE_COMPANIES_EXTRA = [
    # ── a16z ──
    ("coinbase", "Coinbase"), ("robinhood", "Robinhood"), ("lyft", "Lyft"),
    ("airbnb", "Airbnb"), ("okta", "Okta"), ("databricks", "Databricks"),
    ("tripactions", "Navan"), ("amplitude", "Amplitude"), ("klaviyo", "Klaviyo"),
    ("checkr", "Checkr"), ("gem", "Gem"), ("mixpanel", "Mixpanel"),
    ("launchdarkly", "LaunchDarkly"), ("pagerduty", "PagerDuty"), ("front", "Front"),
    ("ironclad", "Ironclad"), ("benchling", "Benchling"), ("cedar", "Cedar"),
    ("devoted", "Devoted Health"), ("opentrons", "Opentrons"), ("hadrian", "Hadrian"),
    ("standard-ai", "Standard AI"), ("openphone", "OpenPhone"), ("anduril", "Anduril"),
    ("dbtlabs", "dbt Labs"), ("stripe", "Stripe"),
    # ── Sequoia ──
    ("zapier", "Zapier"), ("whoop", "WHOOP"), ("relativity-space", "Relativity Space"),
    ("nubank", "Nubank"), ("klarna", "Klarna"), ("faire", "Faire"),
    ("dutchie", "Dutchie"), ("zepz", "Zepz"), ("airtable", "Airtable"),
    ("quora", "Quora"), ("weave", "Weave"), ("tempo", "Tempo"),
    ("toast", "Toast"), ("carta", "Carta"), ("figma", "Figma"),
    # ── Greylock ──
    ("discord", "Discord"), ("roblox", "Roblox"), ("nextdoor", "Nextdoor"),
    ("abnormal-security", "Abnormal Security"), ("coreweave", "CoreWeave"),
    ("orca-security", "Orca Security"), ("strongdm", "StrongDM"),
    ("eightfold", "Eightfold AI"), ("rubrik", "Rubrik"),
    # ── First Round Capital ──
    ("square", "Square"), ("uber", "Uber"), ("warby-parker", "Warby Parker"),
    ("flatiron-health", "Flatiron Health"), ("classpass", "ClassPass"),
    ("frameio", "Frame.io"), ("coda", "Coda"),
    # ── Bessemer Venture Partners ──
    ("shopify", "Shopify"), ("twilio", "Twilio"), ("sendbird", "SendBird"),
    ("toast", "Toast"), ("fivetran", "Fivetran"), ("wiz", "Wiz"),
    ("postman", "Postman"), ("grafana", "Grafana Labs"), ("snyk", "Snyk"),
    ("harness", "Harness"), ("pendo", "Pendo"), ("intercom", "Intercom"),
    # ── General Catalyst ──
    ("hubspot", "HubSpot"), ("snap", "Snap"), ("gusto", "Gusto"),
    ("liveperson", "LivePerson"), ("samsara", "Samsara"), ("brainware", "Brainware"),
    ("capsule", "Capsule"), ("commure", "Commure"), ("city-storage-systems", "City Storage"),
    # ── Insight Partners ──
    ("miro", "Miro"), ("typeform", "Typeform"), ("invision", "InVision"),
    ("backblaze", "Backblaze"), ("acronis", "Acronis"), ("veeam", "Veeam"),
    ("cyberark", "CyberArk"), ("wixcom", "Wix"),
    # ── Accel ──
    ("braintree", "Braintree"), ("samsara", "Samsara"),
    ("rubrik", "Rubrik"), ("kayak", "KAYAK"),
    # ── Lightspeed ──
    ("affirm", "Affirm"), ("taskus", "TaskUs"), ("appian", "Appian"),
    # ── CRV (Charles River Ventures) ──
    ("podium", "Podium"), ("rally-health", "Rally Health"), ("bill", "BILL"),
    # ── NEA ──
    ("datarobot", "DataRobot"), ("workiva", "Workiva"), ("freshworks", "Freshworks"),
    # ── Battery Ventures ──
    ("snaplogic", "SnapLogic"), ("sprinklr", "Sprinklr"), ("automox", "Automox"),
    # ── Index Ventures ──
    ("robinhood", "Robinhood"), ("deliveroo", "Deliveroo"),
    # ── Khosla Ventures ──
    ("opendoor", "Opendoor"), ("poshmark", "Poshmark"),
    ("tempus", "Tempus"),
    # ── Kleiner Perkins ──
    ("docusign", "DocuSign"), ("coursera", "Coursera"),
    ("headspace", "Headspace"), ("desktop-metal", "Desktop Metal"),
    # ── GV (Google Ventures) ──
    ("gitlab", "GitLab"), ("one-medical", "One Medical"),
    # ── Spark Capital ──
    ("warby-parker", "Warby Parker"), ("plaid", "Plaid"),
    # ── Felicis Ventures ──
    ("canva", "Canva"), ("adyen", "Adyen"), ("netlify", "Netlify"),
    # ── Additional high-signal growth-stage startups ──
    ("plaid", "Plaid"), ("brex", "Brex"), ("chime", "Chime"),
    ("duolingo", "Duolingo"), ("gitlab", "GitLab"),
    ("contentful", "Contentful"), ("segment", "Segment"),
    ("hashicorp", "HashiCorp"), ("calendly", "Calendly"),
    ("fastly", "Fastly"), ("confluent", "Confluent"),
    ("airbyte", "Airbyte"), ("matterport", "Matterport"),
    ("squarespace", "Squarespace"), ("via-transportation", "Via"),
    ("asana", "Asana"), ("webflow", "Webflow"),
    ("affinity", "Affinity"), ("leandata", "LeanData"),
    ("watershed", "Watershed"), ("sourcegraph", "Sourcegraph"),
    ("hightouch", "Hightouch"), ("census", "Census"),
    # ── NYC-headquartered startups (more likely to have NYC roles) ──
    ("betterment", "Betterment"), ("oscar-health", "Oscar Health"),
    ("noom", "Noom"), ("cityblock", "Cityblock Health"),
    ("clover-health", "Clover Health"), ("kensho", "Kensho"),
    ("nerdwallet", "NerdWallet"), ("peloton", "Peloton"),
    ("compass", "Compass"), ("wework", "WeWork"), ("justworks", "Justworks"),
    ("gilt", "Gilt"), ("knewton", "Knewton"), ("buzzfeed", "BuzzFeed"),
    ("etsy", "Etsy"), ("kickstarter", "Kickstarter"), ("foursquare", "Foursquare"),
    ("shutterstock", "Shutterstock"), ("mediamath", "MediaMath"),
    ("tumblr", "Tumblr"), ("genius", "Genius"), ("seatgeek", "SeatGeek"),
    ("squarespace", "Squarespace"), ("paperless-post", "Paperless Post"),
    ("brooklyn-data", "Brooklyn Data Co"), ("ro-health", "Ro Health"),
    # ── SF / Bay Area startups ──
    ("notion", "Notion"), ("figma", "Figma"), ("asana", "Asana"),
    ("mixpanel", "Mixpanel"), ("gusto", "Gusto"), ("lever", "Lever"),
    ("zenefits", "Zenefits"), ("algolia", "Algolia"), ("sentry", "Sentry"),
    ("vercel", "Vercel"), ("replit", "Replit"), ("linear", "Linear"),
]

# Companies from VC portfolios known to use Ashby
ASHBY_COMPANIES_EXTRA = [
    # ── a16z ──
    ("alchemy", "Alchemy"), ("mux", "Mux"), ("substack", "Substack"),
    ("oxide", "Oxide Computer"), ("vanta", "Vanta"),
    ("iterative", "Iterative"), ("syndicate", "Syndicate"),
    ("parabol", "Parabol"), ("incident-io", "Incident.io"),
    # ── Sequoia ──
    ("airbyte", "Airbyte"), ("roboflow", "Roboflow"),
    ("dbtlabs", "dbt Labs"), ("plane", "Plane"),
    ("supabase", "Supabase"), ("linear", "Linear"),
    # ── Greylock ──
    ("coreweave", "CoreWeave"), ("abnormal-security", "Abnormal Security"),
    ("orca-security", "Orca Security"),
    # ── Insight Partners ──
    ("wiz", "Wiz"), ("postman", "Postman"), ("grafana", "Grafana Labs"),
    ("snyk", "Snyk"), ("harness", "Harness"),
    # ── General Catalyst ──
    ("samsara", "Samsara"), ("hugging-face", "Hugging Face"),
    # ── Bessemer ──
    ("fivetran", "Fivetran"), ("toast", "Toast"),
    # ── Additional Ashby users ──
    ("browserbase", "Browserbase"), ("exa", "Exa"),
    ("temporal", "Temporal"), ("neon", "Neon"),
    ("arc", "Arc Browser"), ("zed-industries", "Zed"),
    ("dagster-labs", "Dagster"), ("prefect", "Prefect"),
    ("dagger", "Dagger"), ("turso", "Turso"),
    ("val-town", "Val Town"), ("infisical", "Infisical"),
    ("trigger", "Trigger.dev"), ("cal", "Cal.com"),
    ("livekit", "LiveKit"), ("daily", "Daily.co"),
    ("inngest", "Inngest"), ("apify", "Apify"),
    ("braintrust-data", "Braintrust"), ("humanloop", "Humanloop"),
    ("langfuse", "Langfuse"), ("smith-ai", "Smith.ai"),
    ("elevenlabs", "ElevenLabs"), ("hume", "Hume AI"),
    ("cartesia", "Cartesia"), ("kyutai", "Kyutai"),
    ("rime-ai", "Rime AI"), ("lmnt", "LMNT"),
    # ── NYC Ashby startups ──
    ("ramp", "Ramp"), ("brex", "Brex"), ("arkwright", "Arkwright"),
    ("persona", "Persona"), ("plain", "Plain"),
    ("teal", "Teal"), ("workstream", "Workstream"),
    # ── General fast-growing startups on Ashby ──
    ("fly-io", "Fly.io"), ("render", "Render"),
    ("railway", "Railway"), ("coolify", "Coolify"),
    ("clerk", "Clerk"), ("stytch", "Stytch"),
    ("workos", "WorkOS"), ("propelauth", "PropelAuth"),
    ("kinde", "Kinde"), ("auth0", "Auth0"),
]

# Companies from VC portfolios known to use Lever
LEVER_COMPANIES_EXTRA = [
    # ── a16z ──
    ("coinbase", "Coinbase"), ("lyft", "Lyft"),
    # ── Sequoia ──
    ("stripe", "Stripe"), ("doordash", "DoorDash"),
    ("instacart", "Instacart"), ("zoom", "Zoom"), ("servicenow", "ServiceNow"),
    # ── Greylock ──
    ("pagerduty", "PagerDuty"), ("okta", "Okta"),
    # ── General Catalyst ──
    ("airbnb", "Airbnb"), ("hubspot", "HubSpot"),
    # ── Additional Lever users ──
    ("gong", "Gong"), ("impact", "Impact.com"),
    ("jumpcloud", "JumpCloud"), ("patreon", "Patreon"),
    ("riskified", "Riskified"), ("yotpo", "Yotpo"),
    ("wrike", "Wrike"), ("walkme", "WalkMe"),
    ("netlify", "Netlify"), ("uipath", "UiPath"),
    ("amplitude", "Amplitude"), ("jasper", "Jasper AI"),
    ("copy-ai", "Copy.ai"), ("writesonic", "Writesonic"),
    ("anyword", "Anyword"), ("wordtune", "Wordtune"),
    ("covariant", "Covariant"), ("machina-labs", "Machina Labs"),
    ("robust-intelligence", "Robust Intelligence"),
    ("primer", "Primer AI"), ("veritone", "Veritone"),
    # ── NYC Lever startups ──
    ("andela", "Andela"), ("cityblock", "Cityblock"),
    ("zocdoc", "ZocDoc"), ("codecademy", "Codecademy"),
    ("fubo-tv", "FuboTV"), ("newsela", "Newsela"),
    ("bravely", "Bravely"), ("movable-ink", "Movable Ink"),
    ("yext", "Yext"), ("spotify", "Spotify"),
]


async def scrape_vc_boards() -> List[Dict]:
    """
    Scrape job boards from 300+ portfolio companies across the top 50 VC firms.
    Hits Greenhouse, Lever, and Ashby ATSs for each company.
    """
    jobs = []
    sem = asyncio.Semaphore(20)

    # Deduplicate against the base lists
    gh_set   = set(GREENHOUSE_COMPANIES)
    ashby_set = set(ASHBY_COMPANIES)
    lever_set = set(LEVER_COMPANIES)

    extra_gh    = [(s, n) for s, n in GREENHOUSE_COMPANIES_EXTRA if (s, n) not in gh_set]
    extra_ashby = [(s, n) for s, n in ASHBY_COMPANIES_EXTRA     if (s, n) not in ashby_set]
    extra_lever = [(s, n) for s, n in LEVER_COMPANIES_EXTRA     if (s, n) not in lever_set]

    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:

        async def fetch_gh(slug, name):
            async with sem:
                try:
                    resp = await client.get(
                        f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true",
                        timeout=10.0,
                    )
                    if resp.status_code != 200:
                        return []
                    results = []
                    for job in resp.json().get("jobs", []):
                        role     = job.get("title", "")
                        location = job.get("location", {}).get("name", "")
                        url      = job.get("absolute_url", "")
                        content  = re.sub(r"<[^>]+>", " ", job.get("content", "") or "")
                        j = _make_vc_job(name, role, location, url, "VC Portfolio (Greenhouse)", content)
                        if j:
                            results.append(j)
                    return results
                except Exception:
                    return []

        async def fetch_ashby(slug, name):
            async with sem:
                try:
                    resp = await client.get(
                        f"https://api.ashbyhq.com/posting-api/job-board/{slug}",
                        timeout=10.0,
                    )
                    if resp.status_code != 200:
                        return []
                    results = []
                    for job in resp.json().get("jobs", []):
                        role     = job.get("title", "")
                        location = job.get("location", "") or ""
                        url      = job.get("jobUrl", "") or f"https://jobs.ashbyhq.com/{slug}"
                        desc     = job.get("descriptionPlain", "") or re.sub(
                            r"<[^>]+>", " ", job.get("descriptionHtml", "") or ""
                        )
                        j = _make_vc_job(name, role, location, url, "VC Portfolio (Ashby)", desc)
                        if j:
                            results.append(j)
                    return results
                except Exception:
                    return []

        async def fetch_lever(slug, name):
            async with sem:
                try:
                    resp = await client.get(
                        f"https://api.lever.co/v0/postings/{slug}?mode=json",
                        timeout=10.0,
                    )
                    if resp.status_code != 200:
                        return []
                    results = []
                    for job in resp.json():
                        role     = job.get("text", "")
                        cats     = job.get("categories", {})
                        location = cats.get("location", "") or (
                            cats.get("allLocations", [""])[0] if cats.get("allLocations") else ""
                        )
                        url      = job.get("hostedUrl", "")
                        desc     = job.get("descriptionPlain", "") or re.sub(
                            r"<[^>]+>", " ", job.get("description", "") or ""
                        )
                        j = _make_vc_job(name, role, location, url, "VC Portfolio (Lever)", desc)
                        if j:
                            results.append(j)
                    return results
                except Exception:
                    return []

        all_tasks = (
            [fetch_gh(s, n)    for s, n in extra_gh]
            + [fetch_ashby(s, n) for s, n in extra_ashby]
            + [fetch_lever(s, n) for s, n in extra_lever]
        )
        results = await asyncio.gather(*all_tasks)
        for r in results:
            if isinstance(r, list):
                jobs.extend(r)

    print(f"[VC Boards] {len(jobs)} jobs found across {len(extra_gh)} GH + {len(extra_ashby)} Ashby + {len(extra_lever)} Lever companies")
    return jobs


async def scrape_vc_portfolio_pages() -> List[Dict]:
    """
    Scrapes VC firm portfolio pages directly to extract company lists,
    then runs ATS discovery (Greenhouse / Lever / Ashby) on each company.

    Confirmed accessible sources:
      - a16z (andreessen horowitz): 800+ companies via window.a16z_portfolio_companies
      - Founders Fund: 61 companies via window.__data
      - Sequoia: WordPress REST API for company posts
      - GV (Google Ventures): 637 companies via open Sanity CDN
      - True Ventures: 222 companies via api.trueventures.com WP REST API
      - Greylock: 155 companies via greylock.com WP REST API
      - Lightspeed: 639 companies via window.companiesAutocomplete JS variable

    NOTE: Getro boards (jobs.generalcatalyst.com etc.) now return 403 and
    direct users to api@getro.com — they have blocked all web scraping.
    """
    jobs = []
    seen_domains: set = set()
    sem = asyncio.Semaphore(25)
    MAX_PER_CO = 15

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers=HEADERS) as client:

        # ── Helper: run ATS discovery for a (name, website_url) pair ─────────
        async def discover_company(name: str, website: str, firm_label: str):
            if not name or not website:
                return []
            domain = re.sub(r'^https?://(www\.)?', '', website.rstrip('/').split('?')[0])
            domain = domain.split('/')[0].lower()
            if not domain or domain in seen_domains:
                return []
            seen_domains.add(domain)
            slugs = _domain_to_ats_slugs(domain)
            found = []
            async with sem:
                for slug in slugs:
                    if len(found) >= MAX_PER_CO:
                        break
                    # Greenhouse
                    try:
                        r = await client.get(
                            f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true",
                            timeout=7.0,
                        )
                        if r.status_code == 200:
                            for j in r.json().get("jobs", []):
                                if len(found) >= MAX_PER_CO: break
                                role = j.get("title", "")
                                loc  = j.get("location", {}).get("name", "")
                                url  = j.get("absolute_url", "")
                                desc = re.sub(r"<[^>]+>", " ", j.get("content", "") or "")
                                jb = _make_vc_job(name, role, loc, url, f"VC Portfolio ({firm_label})", desc)
                                if jb: found.append(jb)
                            if found: return found
                    except Exception:
                        pass
                    # Lever
                    try:
                        r = await client.get(
                            f"https://api.lever.co/v0/postings/{slug}?mode=json",
                            timeout=7.0,
                        )
                        if r.status_code == 200 and isinstance(r.json(), list) and r.json():
                            for p in r.json():
                                if len(found) >= MAX_PER_CO: break
                                role = p.get("text", "")
                                loc  = p.get("categories", {}).get("location", "") or ""
                                url  = p.get("hostedUrl", "")
                                desc = p.get("descriptionPlain", "") or ""
                                jb = _make_vc_job(name, role, loc, url, f"VC Portfolio ({firm_label})", desc)
                                if jb: found.append(jb)
                            if found: return found
                    except Exception:
                        pass
                    # Ashby
                    try:
                        r = await client.get(
                            f"https://api.ashbyhq.com/posting-api/job-board/{slug}",
                            timeout=7.0,
                        )
                        if r.status_code == 200:
                            for j in r.json().get("jobs", []):
                                if len(found) >= MAX_PER_CO: break
                                role = j.get("title", "")
                                loc  = j.get("location", "") or ""
                                url  = j.get("jobUrl", "") or f"https://jobs.ashbyhq.com/{slug}"
                                desc = j.get("descriptionPlain", "") or ""
                                jb = _make_vc_job(name, role, loc, url, f"VC Portfolio ({firm_label})", desc)
                                if jb: found.append(jb)
                            if found: return found
                    except Exception:
                        pass
            return found

        # ── Source 1: a16z — 800+ companies in window.a16z_portfolio_companies ─
        try:
            r = await client.get("https://a16z.com/portfolio/", timeout=20.0)
            idx = r.text.find("window.a16z_portfolio_companies = [")
            if idx >= 0:
                start = idx + len("window.a16z_portfolio_companies = ")
                depth, end = 0, start
                for i, ch in enumerate(r.text[start:], start):
                    if ch == "[": depth += 1
                    elif ch == "]":
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break
                a16z_cos = json.loads(r.text[start:end])
                pairs = [(co.get("title",""), co.get("web","")) for co in a16z_cos if co.get("web")]
                print(f"[a16z] {len(pairs)} companies found")
                tasks = [discover_company(n, w, "a16z") for n, w in pairs]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for res in results:
                    if isinstance(res, list):
                        jobs.extend(res)
                print(f"[a16z] {len(jobs)} jobs after ATS discovery")
        except Exception as e:
            print(f"[a16z] Error: {e}")

        # ── Source 2: Founders Fund — companies via window.__data ─────────────
        try:
            r = await client.get("https://foundersfund.com/portfolio/", timeout=15.0)
            idx = r.text.find("window.__data = {")
            if idx >= 0:
                start = idx + len("window.__data = ")
                depth, end = 0, start
                for i, ch in enumerate(r.text[start:], start):
                    if ch == "{": depth += 1
                    elif ch == "}":
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break
                ff_data = json.loads(r.text[start:end])
                ff_cos = ff_data.get("companies", [])
                # Use company slug as ATS slug candidate
                pairs_ff = []
                for co in ff_cos:
                    name = (co.get("title") or {}).get("rendered", "") or co.get("slug","")
                    slug = co.get("slug","")
                    if name and slug:
                        pairs_ff.append((name, f"https://{slug}.com"))
                print(f"[Founders Fund] {len(pairs_ff)} companies found")
                tasks_ff = [discover_company(n, w, "Founders Fund") for n, w in pairs_ff]
                results_ff = await asyncio.gather(*tasks_ff, return_exceptions=True)
                for res in results_ff:
                    if isinstance(res, list):
                        jobs.extend(res)
        except Exception as e:
            print(f"[Founders Fund] Error: {e}")

        # ── Source 3: Sequoia — WordPress REST API for company posts ───────────
        try:
            page, seq_companies = 1, []
            while page <= 10:
                r = await client.get(
                    f"https://www.sequoiacap.com/wp-json/wp/v2/company?per_page=100&page={page}",
                    timeout=12.0,
                )
                if r.status_code != 200:
                    break
                batch = r.json()
                if not batch:
                    break
                seq_companies.extend(batch)
                if len(batch) < 100:
                    break
                page += 1
            print(f"[Sequoia] {len(seq_companies)} companies via WP REST API")
            pairs_seq = []
            for co in seq_companies:
                name = (co.get("title") or {}).get("rendered", "") or co.get("slug","")
                # Try to extract website from content HTML
                content_html = (co.get("content") or {}).get("rendered", "")
                website_m = re.search(r'href="(https?://(?!sequoiacap)[^"]+)"', content_html)
                website = website_m.group(1) if website_m else f"https://{co.get('slug','')}.com"
                if name:
                    pairs_seq.append((name, website))
            tasks_seq = [discover_company(n, w, "Sequoia") for n, w in pairs_seq]
            results_seq = await asyncio.gather(*tasks_seq, return_exceptions=True)
            for res in results_seq:
                if isinstance(res, list):
                    jobs.extend(res)
        except Exception as e:
            print(f"[Sequoia] Error: {e}")

        # ── Source 4: GV (Google Ventures) — 637 companies via Sanity CDN ────
        try:
            gv_cos: list = []
            gv_batch = 200
            gv_offset = 0
            while True:
                query = (
                    f'*[_type=="company"]|order(name asc)'
                    f'[{gv_offset}...{gv_offset + gv_batch}]{{name,website}}'
                )
                r = await client.get(
                    "https://v5ygm6ip.apicdn.sanity.io/v2021-10-21/data/query/production",
                    params={"query": query},
                    timeout=15.0,
                )
                if r.status_code != 200:
                    break
                result = r.json().get("result", [])
                if not result:
                    break
                gv_cos.extend(result)
                if len(result) < gv_batch:
                    break
                gv_offset += gv_batch
            print(f"[GV] {len(gv_cos)} companies found")
            tasks_gv = [
                discover_company(c["name"], c["website"], "GV")
                for c in gv_cos if c.get("name") and c.get("website")
            ]
            results_gv = await asyncio.gather(*tasks_gv, return_exceptions=True)
            for res in results_gv:
                if isinstance(res, list):
                    jobs.extend(res)
            print(f"[GV] done")
        except Exception as e:
            print(f"[GV] Error: {e}")

        # ── Source 5: True Ventures — 222 companies via WP REST API ──────────
        try:
            tv_page = 1
            tv_cos: list = []
            while tv_page <= 10:
                r = await client.get(
                    f"https://api.trueventures.com/wp-json/wp/v2/company"
                    f"?per_page=100&page={tv_page}&_fields=slug,title,acf",
                    timeout=12.0,
                )
                if r.status_code != 200:
                    break
                batch = r.json()
                if not batch:
                    break
                tv_cos.extend(batch)
                if len(batch) < 100:
                    break
                tv_page += 1
            print(f"[True Ventures] {len(tv_cos)} companies found")
            tasks_tv = []
            for co in tv_cos:
                name = (co.get("title") or {}).get("rendered", "") or co.get("slug", "")
                site_url = (co.get("acf") or {}).get("site_url", "") or f"https://{co.get('slug','')}.com"
                tasks_tv.append(discover_company(name, site_url, "True Ventures"))
            results_tv = await asyncio.gather(*tasks_tv, return_exceptions=True)
            for res in results_tv:
                if isinstance(res, list):
                    jobs.extend(res)
            print(f"[True Ventures] done")
        except Exception as e:
            print(f"[True Ventures] Error: {e}")

        # ── Source 6: Greylock — 155 companies via WP REST API ───────────────
        try:
            gl_page = 1
            gl_cos: list = []
            while gl_page <= 5:
                r = await client.get(
                    f"https://greylock.com/wp-json/wp/v2/portfolio"
                    f"?per_page=100&page={gl_page}&_fields=slug,title",
                    timeout=12.0,
                )
                if r.status_code != 200:
                    break
                batch = r.json()
                if not batch:
                    break
                gl_cos.extend(batch)
                if len(batch) < 100:
                    break
                gl_page += 1
            print(f"[Greylock] {len(gl_cos)} companies found")
            tasks_gl = []
            for co in gl_cos:
                name = (co.get("title") or {}).get("rendered", "") or co.get("slug", "")
                slug = co.get("slug", "")
                # Use slug directly as domain guess — e.g. "anthropic" → anthropic.com
                tasks_gl.append(discover_company(name, f"https://{slug}.com", "Greylock"))
            results_gl = await asyncio.gather(*tasks_gl, return_exceptions=True)
            for res in results_gl:
                if isinstance(res, list):
                    jobs.extend(res)
            print(f"[Greylock] done")
        except Exception as e:
            print(f"[Greylock] Error: {e}")

        # ── Source 7: Lightspeed — 639 companies via window.companiesAutocomplete ─
        try:
            r = await client.get("https://lsvp.com/companies/", timeout=15.0)
            m = re.search(r'window\.companiesAutocomplete\s*=\s*(\[.*?\]);', r.text, re.DOTALL)
            if m:
                ls_names = json.loads(m.group(1))
                print(f"[Lightspeed] {len(ls_names)} companies found")
                tasks_ls = []
                for co_name in ls_names:
                    if not co_name or not isinstance(co_name, str):
                        continue
                    # Convert company name to domain guess:
                    # "1Password" → "1password.com", "Affirm" → "affirm.com"
                    slug = re.sub(r'[^a-z0-9]', '', co_name.lower())
                    if not slug:
                        continue
                    tasks_ls.append(discover_company(co_name, f"https://{slug}.com", "Lightspeed"))
                results_ls = await asyncio.gather(*tasks_ls, return_exceptions=True)
                for res in results_ls:
                    if isinstance(res, list):
                        jobs.extend(res)
                print(f"[Lightspeed] done")
        except Exception as e:
            print(f"[Lightspeed] Error: {e}")

    print(f"[VC Portfolio Pages] {len(jobs)} total jobs found")
    return jobs


async def scrape_getro_vc_boards() -> List[Dict]:
    """
    NOTE: Getro now blocks all scraping (returns 403 with message to use their paid API).
    This function is kept as a stub returning empty to avoid breaking scrape_all_sources.
    Replaced by scrape_vc_portfolio_pages() which scrapes VC firm websites directly.
    """
    jobs = []
    company_domains_seen: set = set()
    all_companies: list = []   # [(company_name, domain, firm_name)]

    sem = asyncio.Semaphore(8)

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers=HEADERS) as client:

        # ── Step 1: collect company domains from every Getro board ──────────
        for firm_name, board_url in GETRO_VC_BOARDS:
            try:
                r = await client.get(board_url, timeout=12.0)
                m = re.search(
                    r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', r.text, re.DOTALL
                )
                if not m:
                    continue
                data  = json.loads(m.group(1))
                state = data.get("props", {}).get("pageProps", {}).get("initialState", {})

                # Primary: companies.found from homepage
                companies_state = state.get("companies", {})
                found = list(companies_state.get("found", []))

                # Secondary: network.allCompanies (sometimes has more)
                all_c = state.get("network", {}).get("allCompanies", [])
                if all_c:
                    existing_ids = {c.get("id") for c in found}
                    for c in all_c:
                        if c.get("id") not in existing_ids:
                            found.append(c)

                # Tertiary: try the /companies Next.js data route for extra items
                build_id = data.get("buildId", "")
                if build_id:
                    try:
                        r2 = await client.get(
                            f"{board_url}/_next/data/{build_id}/companies.json",
                            timeout=10.0,
                        )
                        if r2.status_code == 200:
                            companies2 = (
                                r2.json()
                                .get("pageProps", {})
                                .get("initialState", {})
                                .get("companies", {})
                            )
                            existing_ids = {c.get("id") for c in found}
                            for c in companies2.get("found", []):
                                if c.get("id") not in existing_ids:
                                    found.append(c)
                    except Exception:
                        pass

                added = 0
                for company in found:
                    domain = (company.get("domain") or "").strip().lower()
                    name   = (company.get("name")   or "").strip()
                    if domain and name and domain not in company_domains_seen:
                        company_domains_seen.add(domain)
                        all_companies.append((name, domain, firm_name))
                        added += 1

                print(f"[Getro/{firm_name}] {added} new companies")

            except Exception as e:
                print(f"[Getro/{firm_name}] Error: {e}")

        print(f"[Getro] {len(all_companies)} total unique companies — starting ATS discovery")

        # ── Step 2: for each company, try GH / Lever / Ashby ────────────────
        # Cap: max 25 relevant jobs per company so large companies don't flood results
        MAX_PER_COMPANY = 25

        async def discover_ats(company_name: str, domain: str, firm_name: str):
            slugs = _domain_to_ats_slugs(domain)
            found_jobs = []

            async with sem:
                for slug in slugs:
                    # Greenhouse
                    try:
                        resp = await client.get(
                            f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true",
                            timeout=8.0,
                        )
                        if resp.status_code == 200:
                            for job in resp.json().get("jobs", []):
                                if len(found_jobs) >= MAX_PER_COMPANY:
                                    break
                                role     = job.get("title", "")
                                location = job.get("location", {}).get("name", "")
                                url      = job.get("absolute_url", "")
                                content  = re.sub(r"<[^>]+>", " ", job.get("content", "") or "")
                                j = _make_vc_job(company_name, role, location, url,
                                                 f"VC Portfolio ({firm_name})", content)
                                if j:
                                    found_jobs.append(j)
                            if found_jobs:
                                return found_jobs
                    except Exception:
                        pass

                    # Lever
                    try:
                        resp = await client.get(
                            f"https://api.lever.co/v0/postings/{slug}?mode=json",
                            timeout=8.0,
                        )
                        if resp.status_code == 200 and isinstance(resp.json(), list):
                            for job in resp.json():
                                if len(found_jobs) >= MAX_PER_COMPANY:
                                    break
                                role     = job.get("text", "")
                                cats     = job.get("categories", {})
                                location = cats.get("location", "") or (
                                    cats.get("allLocations", [""])[0]
                                    if cats.get("allLocations") else ""
                                )
                                url  = job.get("hostedUrl", "")
                                desc = job.get("descriptionPlain", "") or re.sub(
                                    r"<[^>]+>", " ", job.get("description", "") or ""
                                )
                                j = _make_vc_job(company_name, role, location, url,
                                                 f"VC Portfolio ({firm_name})", desc)
                                if j:
                                    found_jobs.append(j)
                            if found_jobs:
                                return found_jobs
                    except Exception:
                        pass

                    # Ashby
                    try:
                        resp = await client.get(
                            f"https://api.ashbyhq.com/posting-api/job-board/{slug}",
                            timeout=8.0,
                        )
                        if resp.status_code == 200:
                            for job in resp.json().get("jobs", []):
                                if len(found_jobs) >= MAX_PER_COMPANY:
                                    break
                                role     = job.get("title", "")
                                location = job.get("location", "") or ""
                                url      = job.get("jobUrl", "") or f"https://jobs.ashbyhq.com/{slug}"
                                desc     = job.get("descriptionPlain", "") or re.sub(
                                    r"<[^>]+>", " ", job.get("descriptionHtml", "") or ""
                                )
                                j = _make_vc_job(company_name, role, location, url,
                                                 f"VC Portfolio ({firm_name})", desc)
                                if j:
                                    found_jobs.append(j)
                            if found_jobs:
                                return found_jobs
                    except Exception:
                        pass

            return found_jobs

        tasks   = [discover_ats(name, domain, firm) for name, domain, firm in all_companies]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, list):
                jobs.extend(r)

    print(f"[Getro VC Boards] {len(jobs)} jobs found (NOTE: Getro now blocks scraping — returns 0)")
    return jobs


# ─────────────────────────────────────────────
# SOURCE 7 & 8: LinkedIn + Indeed via Apify
# ─────────────────────────────────────────────
async def scrape_apify_linkedin(api_key: str) -> List[Dict]:
    jobs = []
    queries = [
        {"searchKeywords": "AI strategy associate entry level", "location": "New York City, NY"},
        {"searchKeywords": "operations associate AI startup", "location": "New York City, NY"},
        {"searchKeywords": "product operations new grad AI", "location": "San Francisco, CA"},
        {"searchKeywords": "business development AI startup entry level", "location": "New York City, NY"},
        {"searchKeywords": "chief of staff entry level AI startup", "location": "New York City, NY"},
        {"searchKeywords": "go to market associate AI startup", "location": "San Francisco, CA"},
    ]
    async with httpx.AsyncClient(timeout=120.0) as client:
        for q in queries:
            try:
                resp = await client.post(
                    f"https://api.apify.com/v2/acts/curious_coder~linkedin-jobs-scraper/run-sync-get-dataset-items?token={api_key}",
                    json={**q, "maxItems": 15, "experienceLevel": "entry_level"},
                    timeout=120.0,
                )
                if resp.status_code == 200:
                    for job in resp.json():
                        company = job.get("companyName", "")
                        role = job.get("title", "")
                        location = job.get("location", "")
                        url = job.get("jobUrl", "")
                        description = job.get("description", "")
                        posted = job.get("postedAt", "")
                        score, _ = score_job(company, role, location, description)
                        if score >= 0:
                            jobs.append(make_job(company, role, location, url, "LinkedIn (Apify)", description, posted))
            except Exception as e:
                print(f"[LinkedIn Apify] query error: {e}")
    print(f"[LinkedIn Apify] {len(jobs)} jobs found")
    return jobs


async def scrape_apify_indeed(api_key: str) -> List[Dict]:
    jobs = []
    queries = [
        {"position": "AI strategy associate", "location": "New York, NY"},
        {"position": "operations associate AI startup", "location": "New York, NY"},
        {"position": "product operations entry level", "location": "San Francisco, CA"},
        {"position": "business development AI", "location": "New York, NY"},
    ]
    async with httpx.AsyncClient(timeout=120.0) as client:
        for q in queries:
            try:
                resp = await client.post(
                    f"https://api.apify.com/v2/acts/hMvNSpz3JnHgl5jkh/run-sync-get-dataset-items?token={api_key}",
                    json={**q, "maxItems": 10, "experienceLevels": ["Entry Level"]},
                    timeout=120.0,
                )
                if resp.status_code == 200:
                    for job in resp.json():
                        company = job.get("company", "")
                        role = job.get("positionName", "") or job.get("title", "")
                        location = job.get("location", q["location"])
                        url = job.get("url", "https://indeed.com")
                        description = job.get("description", "")
                        score, _ = score_job(company, role, location, description)
                        if score >= 0:
                            jobs.append(make_job(company, role, location, url, "Indeed (Apify)", description))
            except Exception as e:
                print(f"[Indeed Apify] error: {e}")
    print(f"[Indeed Apify] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE: topstartups.io (dynamic discovery)
# Scrapes the AI company list and hits each
# company's Greenhouse / Ashby / Lever board.
# ─────────────────────────────────────────────

def _slug_to_name(slug: str) -> str:
    """Convert an ATS URL slug to a readable company name."""
    slug = slug.split('?')[0].rstrip('/').split('/')[0]
    return ' '.join(w.capitalize() for w in re.split(r'[-_.]', slug) if w)


async def scrape_topstartups() -> List[Dict]:
    """
    Two-pass scraper for topstartups.io AI company listings:

    Pass 1 — scan topstartups.io HTML for direct ATS board links (Greenhouse /
              Ashby / Lever) AND collect each company's external career-page URL.

    Pass 2 — follow every career-page URL that wasn't already a direct ATS link,
              fetch that page, and scan it for ATS board links one level deeper.
              This catches companies that host their own /careers page but use a
              known ATS behind the scenes (very common for smaller funded startups).

    Only processes companies NOT already in our hardcoded lists — no duplicates.
    """
    jobs = []

    # ── ATS detection patterns ────────────────────────────────────────────────
    GH_RE    = re.compile(
        r'(?:boards|job-boards)\.greenhouse\.io/(?:embed/job_board\?for=)?([A-Za-z0-9_\-]+)',
        re.IGNORECASE,
    )
    ASHBY_RE = re.compile(r'jobs\.ashbyhq\.com/([A-Za-z0-9_.\-]+)', re.IGNORECASE)
    LEVER_RE = re.compile(r'jobs\.lever\.co/([A-Za-z0-9_\-]+)',      re.IGNORECASE)
    WORKABLE_RE = re.compile(r'apply\.workable\.com/([A-Za-z0-9_\-]+)', re.IGNORECASE)

    # Domains we should NOT follow as career pages
    SKIP_DOMAINS = {
        "topstartups.io", "linkedin.com", "twitter.com", "x.com",
        "instagram.com", "facebook.com", "youtube.com", "glassdoor.com",
        "trustpilot.com", "crunchbase.com", "substack.com", "github.com",
        "techcrunch.com", "bloomberg.com", "producthunt.com",
    }

    ASHBY_Q = (
        "query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {"
        "  jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {"
        "    organization { name }"
        "    jobPostings { id title locationName descriptionHtml }"
        "  }"
        "}"
    )

    # Build sets of already-known slugs to avoid duplication
    existing_gh      = {s.lower() for s, _ in GREENHOUSE_COMPANIES + GREENHOUSE_COMPANIES_EXTRA}
    existing_ashby   = {s.lower() for s, _ in ASHBY_COMPANIES + ASHBY_COMPANIES_EXTRA}
    existing_lever   = {s.lower() for s, _ in LEVER_COMPANIES}
    existing_workable = {s.lower() for s, _ in WORKABLE_COMPANIES}

    gh_slugs      = {}   # slug → display name
    ashby_slugs   = {}
    lever_slugs   = {}
    workable_slugs = {}
    career_pages  = {}   # company_name → career page URL (for Pass 2)

    def _extract_company_name(html: str, href: str) -> str:
        """Try to pull a company name from the surrounding HTML context of a link."""
        # Look for the link in context and grab nearby text
        idx = html.find(href)
        if idx == -1:
            return _slug_to_name(href.split('//')[-1].split('/')[0].split('.')[0])
        snippet = html[max(0, idx - 300):idx]
        # Look for common name patterns: <h2>, <h3>, data-name, alt= attributes
        for pat in [
            r'<h[123][^>]*>([^<]{2,60})</h[123]>',
            r'data-name=["\']([^"\']{2,60})["\']',
            r'alt=["\']([^"\']{2,60})\s*logo["\']',
            r'<strong[^>]*>([^<]{2,40})</strong>',
        ]:
            m = re.search(pat, snippet, re.IGNORECASE)
            if m:
                name = m.group(1).strip()
                if 2 < len(name) < 60:
                    return name
        return ""

    def _scan_for_ats(html: str, company_name: str, source_label: str):
        """
        Scan a page for ATS board links. Searches both href attributes AND the
        full HTML text — some pages embed ATS URLs in script tags or data attrs.
        """
        # Search full HTML text for ATS URL patterns (catches JS/data embeds)
        for m in GH_RE.finditer(html):
            slug = m.group(1).rstrip('/')
            if slug and slug.lower() not in existing_gh and slug not in gh_slugs:
                gh_slugs[slug] = company_name or _slug_to_name(slug)

        for m in ASHBY_RE.finditer(html):
            slug = m.group(1).rstrip('/').split('?')[0]
            if slug and slug.lower() not in existing_ashby and slug not in ashby_slugs:
                ashby_slugs[slug] = company_name or _slug_to_name(slug)

        for m in LEVER_RE.finditer(html):
            slug = m.group(1).rstrip('/')
            if slug and slug.lower() not in existing_lever and slug not in lever_slugs:
                lever_slugs[slug] = company_name or _slug_to_name(slug)

        for m in WORKABLE_RE.finditer(html):
            slug = m.group(1).rstrip('/')
            if slug and slug.lower() not in existing_workable and slug not in workable_slugs:
                workable_slugs[slug] = company_name or _slug_to_name(slug)

    # ── PASS 1: Scrape topstartups.io listing pages ───────────────────────────
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers=HEADERS) as client:
            for page in range(1, 9):  # 8 pages ≈ 144 AI companies
                try:
                    resp = await client.get(
                        f"https://topstartups.io/?industries=Artificial%20Intelligence&page={page}",
                        timeout=15.0,
                    )
                    if resp.status_code != 200:
                        break
                    html = resp.text

                    # Scan for direct ATS links on the topstartups.io page itself
                    _scan_for_ats(html, "", "TopStartups")

                    # Collect external company URLs for Pass 2.
                    # topstartups.io links to company homepages with ?utm_source=topstartups.io
                    # We collect those homepages and also any direct /careers or /jobs paths.
                    for href in re.findall(r'href=["\']([^"\']{15,})["\']', html):
                        if not href.startswith("http"):
                            continue

                        # Extract the destination domain (ignoring UTM params)
                        try:
                            dest_domain = href.split('//')[-1].split('/')[0].lower()
                        except Exception:
                            continue

                        # Company homepage with UTM param — queue for Pass 2 FIRST,
                        # before any skip checks (UTM hrefs contain topstartups.io
                        # in the query string which would otherwise skip them)
                        if "utm_source=topstartups" in href.lower():
                            base = re.sub(r'\?.*', '', href).rstrip('/')
                            company_name = _extract_company_name(html, href)
                            for path in [
                                "",               # homepage — often has ATS link directly
                                "/careers",
                                "/jobs",
                                "/company/careers",
                                "/about/careers",
                                "/team/join",
                                "/join-us",
                            ]:
                                url_to_try = base + path
                                if url_to_try not in career_pages:
                                    career_pages[url_to_try] = company_name
                            continue

                        # Skip ATS URLs (already handled by _scan_for_ats above)
                        if any(x in dest_domain for x in [
                            "greenhouse.io", "ashbyhq.com", "lever.co",
                            "workable.com", "topstartups.io",
                        ]):
                            continue

                        # Skip social/news domains
                        if any(d in dest_domain for d in SKIP_DOMAINS):
                            continue

                        href_lower = href.lower().split('?')[0]
                        company_name = _extract_company_name(html, href)

                        # Direct career/jobs page — follow as-is
                        if any(kw in href_lower for kw in [
                            "/careers", "/jobs", "/work-with-us", "/join",
                            "/join-us", "/open-positions", "/opportunities",
                        ]):
                            if href not in career_pages:
                                career_pages[href] = company_name

                    await asyncio.sleep(0.3)
                except Exception as e:
                    print(f"[TopStartups] Page {page} error: {e}")
    except Exception as e:
        print(f"[TopStartups] Scrape error: {e}")

    print(f"[TopStartups] Pass 1: {len(gh_slugs)} GH | {len(ashby_slugs)} Ashby | "
          f"{len(lever_slugs)} Lever | {len(workable_slugs)} Workable | "
          f"{len(career_pages)} career pages to follow")

    # ── PASS 2: Follow career page URLs and scan for ATS links ────────────────
    if career_pages:
        sem = asyncio.Semaphore(8)  # max 8 concurrent requests

        async def follow_career_page(url: str, company_name: str):
            async with sem:
                try:
                    async with httpx.AsyncClient(
                        timeout=12.0, follow_redirects=True, headers=HEADERS
                    ) as c:
                        r = await c.get(url, timeout=10.0)
                        if r.status_code != 200:
                            return
                        html = r.text
                        _scan_for_ats(html, company_name, "TopStartups→Career")

                        # If this is a homepage (no path keywords), also follow
                        # any career/jobs links found within it (e.g. doppel.com
                        # has /company/careers linked from its homepage)
                        url_lower = url.lower().split('?')[0]
                        is_homepage = not any(kw in url_lower for kw in [
                            "/careers", "/jobs", "/join", "/team", "/about"
                        ])
                        if is_homepage:
                            base_domain = url.split('//')[-1].split('/')[0]
                            for href in re.findall(r'href=["\']([^"\']{5,})["\']', html):
                                href_lower = href.lower().split('?')[0]
                                if any(kw in href_lower for kw in [
                                    "/careers", "/jobs", "/company/careers",
                                    "/about/careers", "/join", "/work-with-us",
                                    "/open-positions",
                                ]):
                                    # Resolve relative links
                                    if href.startswith('/'):
                                        full = f"https://{base_domain}{href.split('?')[0]}"
                                    elif href.startswith('http'):
                                        full = href.split('?')[0]
                                    else:
                                        continue
                                    if full not in career_pages:
                                        career_pages[full] = company_name
                                        # Fetch immediately since we're in Pass 2
                                        try:
                                            r2 = await c.get(full, timeout=10.0)
                                            if r2.status_code == 200:
                                                _scan_for_ats(r2.text, company_name, "TopStartups→Career2")
                                        except Exception:
                                            pass
                except Exception:
                    pass

        await asyncio.gather(
            *[follow_career_page(url, name) for url, name in career_pages.items()],
            return_exceptions=True,
        )

    print(f"[TopStartups] After Pass 2: {len(gh_slugs)} GH | {len(ashby_slugs)} Ashby | "
          f"{len(lever_slugs)} Lever | {len(workable_slugs)} Workable")

    # ── Fetch jobs from all discovered ATS boards ─────────────────────────────
    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:

        async def fetch_gh(slug, name):
            try:
                r = await client.get(
                    f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true",
                    timeout=10.0,
                )
                if r.status_code != 200:
                    return []
                return [
                    make_job(
                        name, j.get("title", ""),
                        j.get("location", {}).get("name", ""),
                        j.get("absolute_url", ""),
                        "TopStartups (Greenhouse)",
                        re.sub(r"<[^>]+>", " ", j.get("content", "") or ""),
                    )
                    for j in r.json().get("jobs", [])
                ]
            except Exception:
                return []

        async def fetch_ashby(slug, name_hint):
            try:
                slug = slug.split("?")[0].rstrip("/")
                r = await client.get(
                    f"https://api.ashbyhq.com/posting-api/job-board/{slug}",
                    timeout=10.0,
                )
                if r.status_code != 200:
                    return []
                return [
                    make_job(
                        name_hint, j.get("title", ""), j.get("location", "") or "",
                        j.get("jobUrl", "") or f"https://jobs.ashbyhq.com/{slug}",
                        "TopStartups (Ashby)",
                        j.get("descriptionPlain", "") or re.sub(r"<[^>]+>", " ", j.get("descriptionHtml", "") or ""),
                    )
                    for j in r.json().get("jobs", [])
                ]
            except Exception:
                return []

        async def fetch_lever(slug, name):
            try:
                r = await client.get(
                    f"https://api.lever.co/v0/postings/{slug}?mode=json",
                    timeout=10.0,
                )
                if r.status_code != 200:
                    return []
                return [
                    make_job(
                        name, p.get("text", ""),
                        p.get("categories", {}).get("location", "") or p.get("workplaceType", ""),
                        p.get("hostedUrl", ""),
                        "TopStartups (Lever)",
                        p.get("description", "") or "",
                    )
                    for p in r.json()
                ]
            except Exception:
                return []

        async def fetch_workable(slug, name):
            try:
                r = await client.get(
                    f"https://apply.workable.com/api/v3/accounts/{slug}/jobs",
                    timeout=10.0,
                )
                if r.status_code != 200:
                    return []
                results = []
                for job in r.json().get("results", []):
                    role = job.get("title", "")
                    city = job.get("city", "") or ""
                    country = job.get("country", "") or ""
                    location = city if city else country
                    shortcode = job.get("shortcode", "")
                    url = f"https://apply.workable.com/{slug}/j/{shortcode}" if shortcode else ""
                    desc = job.get("description", "") or ""
                    results.append(make_job(name, role, location, url, "TopStartups (Workable)", desc))
                return results
            except Exception:
                return []

        tasks = (
            [fetch_gh(s, n)       for s, n in gh_slugs.items()] +
            [fetch_ashby(s, n)    for s, n in ashby_slugs.items()] +
            [fetch_lever(s, n)    for s, n in lever_slugs.items()] +
            [fetch_workable(s, n) for s, n in workable_slugs.items()]
        )
        for r in await asyncio.gather(*tasks, return_exceptions=True):
            if isinstance(r, list):
                jobs.extend(r)

    print(f"[TopStartups] {len(jobs)} jobs found from dynamic boards")
    return jobs


# ─────────────────────────────────────────────
# SHARED: ATS discovery helper for list-based scrapers
# ─────────────────────────────────────────────
async def _ats_discover_jobs(name: str, website: str, source_label: str,
                              client, sem, max_per_co: int = 10) -> list:
    """
    Given a company name and website URL, derive ATS slug candidates
    and try Greenhouse → Lever → Ashby in order. Returns a list of job dicts.
    Used by Forbes, LinkedIn, and similar list-based scrapers.
    """
    if not name or not website:
        return []
    domain = re.sub(r'^https?://(www\.)?', '', website.rstrip('/').split('?')[0])
    domain = domain.split('/')[0].lower()
    if not domain:
        return []
    slugs = _domain_to_ats_slugs(domain)
    found = []
    async with sem:
        for slug in slugs:
            if len(found) >= max_per_co:
                break
            # Greenhouse
            try:
                r = await client.get(
                    f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true",
                    timeout=7.0,
                )
                if r.status_code == 200:
                    for j in r.json().get("jobs", []):
                        if len(found) >= max_per_co: break
                        jb = _make_vc_job(
                            name, j.get("title", ""),
                            j.get("location", {}).get("name", ""),
                            j.get("absolute_url", ""), source_label,
                            re.sub(r"<[^>]+>", " ", j.get("content", "") or ""),
                        )
                        if jb: found.append(jb)
                    if found: return found
            except Exception:
                pass
            # Lever
            try:
                r = await client.get(
                    f"https://api.lever.co/v0/postings/{slug}?mode=json",
                    timeout=7.0,
                )
                if r.status_code == 200 and isinstance(r.json(), list) and r.json():
                    for p in r.json():
                        if len(found) >= max_per_co: break
                        jb = _make_vc_job(
                            name, p.get("text", ""),
                            p.get("categories", {}).get("location", "") or "",
                            p.get("hostedUrl", ""), source_label,
                            p.get("descriptionPlain", "") or "",
                        )
                        if jb: found.append(jb)
                    if found: return found
            except Exception:
                pass
            # Ashby
            try:
                r = await client.get(
                    f"https://api.ashbyhq.com/posting-api/job-board/{slug}",
                    timeout=7.0,
                )
                if r.status_code == 200:
                    for j in r.json().get("jobPostings", []):
                        if len(found) >= max_per_co: break
                        jb = _make_vc_job(
                            name, j.get("title", ""),
                            j.get("location", "") or "",
                            (j.get("jobPostingUrls") or {}).get("externalUrl", "")
                            or f"https://jobs.ashbyhq.com/{slug}/{j.get('id', '')}",
                            source_label,
                            re.sub(r"<[^>]+>", " ", j.get("descriptionHtml", "") or ""),
                        )
                        if jb: found.append(jb)
                    if found: return found
            except Exception:
                pass
    return found


# ─────────────────────────────────────────────
# SOURCE: Forbes Best Startup Employers + Similar Lists
# ─────────────────────────────────────────────
async def scrape_forbes_startup_lists() -> List[Dict]:
    """
    Scrapes Forbes Best Startup Employers list via their public JSON API,
    then does live ATS discovery (Greenhouse / Lever / Ashby) on each company.
    API endpoint confirmed: forbesapi/org/americas-best-startup-employers/{year}/position/true.json
    Returns ~40 top startup employers + jobs from their open boards.
    """
    companies: list[tuple[str, str]] = []  # (name, website_hint)
    jobs = []

    FORBES_API_URLS = [
        "https://www.forbes.com/forbesapi/org/americas-best-startup-employers/2024/position/true.json",
        "https://www.forbes.com/forbesapi/org/americas-best-startup-employers/2023/position/true.json",
    ]

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers=HEADERS) as client:

        for api_url in FORBES_API_URLS:
            try:
                resp = await client.get(api_url, timeout=15.0)
                if resp.status_code != 200:
                    continue
                orgs = resp.json().get("organizationList", {}).get("organizationsLists", [])
                if not orgs:
                    continue
                for org in orgs:
                    name    = org.get("organizationName") or org.get("name", "")
                    website = org.get("webSite", "") or ""
                    uri     = org.get("uri", "")  # slug like "coalition"
                    if not website and uri:
                        website = f"https://{uri}.com"
                    if name:
                        companies.append((name, website))
                print(f"[Forbes] {len(companies)} companies from {api_url}")
                break
            except Exception as e:
                print(f"[Forbes] API error {api_url}: {e}")

        if not companies:
            print("[Forbes] Could not fetch company list")
            return []

        sem = asyncio.Semaphore(20)
        seen_domains: set = set()
        tasks = []
        for name, website in companies:
            if not website:
                slug_guess = re.sub(r'[^a-z0-9]', '', name.lower())
                website = f"https://{slug_guess}.com"
            domain = re.sub(r'^https?://(www\.)?', '', website.rstrip('/'))
            domain = domain.split('/')[0].lower()
            if domain and domain not in seen_domains:
                seen_domains.add(domain)
                tasks.append(_ats_discover_jobs(name, website, "Forbes Best Startups", client, sem))

        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, list):
                jobs.extend(r)

    print(f"[Forbes] {len(jobs)} jobs found via ATS discovery")
    return jobs


# Builtin omitted: uses Alpine.js client-side rendering; job data not in static HTML
# Wellfound omitted: Cloudflare blocks all scraping (403)

async def scrape_builtin_jobs() -> List[Dict]:
    """
    Scrapes Builtin's job board. Targets business, ops, sales, marketing,
    product, and strategy roles at startups and tech companies.
    Builtin organizes jobs by role category and city/remote.
    """
    jobs = []
    seen = set()

    # Builtin role categories relevant to early-career business/ops candidates
    ROLE_SLUGS = [
        "business-development", "sales", "marketing", "operations",
        "product-management", "customer-success", "account-management",
        "finance", "strategy", "project-management",
    ]

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers={
        **HEADERS,
        "Referer": "https://builtin.com/",
        "Accept": "application/json, text/plain, */*",
    }) as client:

        for role_slug in ROLE_SLUGS:
            for page_num in range(1, 4):  # up to 3 pages per role
                try:
                    # Builtin's internal search API
                    resp = await client.get(
                        "https://builtin.com/api/search-jobs",
                        params={
                            "search[role][]": role_slug,
                            "search[country][]": "United States",
                            "search[job_type][]": "full-time",
                            "page": page_num,
                        },
                        timeout=12.0,
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        job_list = data.get("jobs") or data.get("data") or []
                        if not job_list:
                            break
                        for job in job_list:
                            company = (job.get("company") or {}).get("name") or job.get("companyName", "")
                            role    = job.get("title") or job.get("role", "")
                            loc     = job.get("builtinLocation") or job.get("location") or ""
                            url     = job.get("url") or job.get("applyUrl") or ""
                            desc    = re.sub(r"<[^>]+>", " ", job.get("description", "") or "")
                            if company and role:
                                key = f"{company.lower()}|{role.lower()}"
                                if key not in seen:
                                    seen.add(key)
                                    jobs.append(make_job(company, role, loc, url, "Builtin", desc))
                    else:
                        # API path not found — try HTML scrape fallback
                        if page_num == 1:
                            html_resp = await client.get(
                                f"https://builtin.com/jobs/dev--engineer/remote/{role_slug}",
                                timeout=12.0,
                            )
                            if html_resp.status_code == 200:
                                from bs4 import BeautifulSoup
                                soup = BeautifulSoup(html_resp.text, "html.parser")
                                for card in soup.find_all(attrs={"data-id": True}):
                                    role_el    = card.find(class_=re.compile(r'job-title|role|title', re.I))
                                    company_el = card.find(class_=re.compile(r'company-name|company', re.I))
                                    loc_el     = card.find(class_=re.compile(r'location', re.I))
                                    link_el    = card.find("a", href=True)
                                    r_txt  = role_el.get_text(strip=True)    if role_el    else ""
                                    co_txt = company_el.get_text(strip=True) if company_el else ""
                                    l_txt  = loc_el.get_text(strip=True)     if loc_el     else ""
                                    href   = ("https://builtin.com" + link_el["href"]) if link_el else ""
                                    if co_txt and r_txt:
                                        key = f"{co_txt.lower()}|{r_txt.lower()}"
                                        if key not in seen:
                                            seen.add(key)
                                            jobs.append(make_job(co_txt, r_txt, l_txt, href, "Builtin", ""))
                        break
                except Exception as e:
                    print(f"[Builtin] Error ({role_slug} p{page_num}): {e}")
                    break

    print(f"[Builtin] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE: Wellfound (real attempt)
# ─────────────────────────────────────────────
async def scrape_wellfound_actual() -> List[Dict]:
    """
    Attempts to scrape Wellfound (wellfound.com) directly for startup jobs.
    Wellfound runs Cloudflare — if we get a 403, we log it and return empty
    so the caller can rely on the existing Jobicy fallback in scrape_wellfound().
    """
    jobs = []
    seen = set()

    ROLE_PATHS = [
        "/jobs/role/business-development",
        "/jobs/role/operations",
        "/jobs/role/sales",
        "/jobs/role/marketing",
        "/jobs/role/product-manager",
        "/jobs/role/strategy",
    ]

    cf_bypass_headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-CH-UA": '"Chromium";v="124", "Google Chrome";v="124"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"macOS"',
    }

    try:
        async with httpx.AsyncClient(
            timeout=20.0, follow_redirects=True, headers=cf_bypass_headers
        ) as client:
            for path in ROLE_PATHS:
                try:
                    resp = await client.get(f"https://wellfound.com{path}", timeout=12.0)
                    if resp.status_code in (403, 429, 503):
                        print(f"[Wellfound] Blocked ({resp.status_code}) on {path} — Cloudflare active")
                        return []  # blocked — bail out entirely
                    if resp.status_code != 200:
                        continue

                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup(resp.text, "html.parser")

                    # Wellfound embeds job data in <script type="application/json"> or SSR HTML
                    # Try JSON extraction first
                    for script in soup.find_all("script", type="application/json"):
                        try:
                            data = json.loads(script.string or "")
                            # Walk the JSON to find job-like objects
                            def _walk(obj):
                                if isinstance(obj, list):
                                    for item in obj: _walk(item)
                                elif isinstance(obj, dict):
                                    title   = obj.get("title") or obj.get("role", "")
                                    company = (obj.get("company") or {}).get("name", "") if isinstance(obj.get("company"), dict) else obj.get("companyName", "")
                                    if title and company and len(title) < 100:
                                        loc  = obj.get("locationNames", [""])[0] if obj.get("locationNames") else ""
                                        url  = obj.get("jobUrl") or obj.get("url", "")
                                        desc = obj.get("description", "")
                                        key  = f"{company.lower()}|{title.lower()}"
                                        if key not in seen:
                                            seen.add(key)
                                            jobs.append(make_job(company, title, loc, url, "Wellfound", desc))
                                    for v in obj.values():
                                        _walk(v)
                            _walk(data)
                        except Exception:
                            pass

                    # HTML fallback
                    if not jobs:
                        for card in soup.find_all(class_=re.compile(r'job-listing|startup-job|role', re.I)):
                            role_el    = card.find(class_=re.compile(r'role|title|position', re.I))
                            company_el = card.find(class_=re.compile(r'company|startup', re.I))
                            if role_el and company_el:
                                r_txt  = role_el.get_text(strip=True)
                                co_txt = company_el.get_text(strip=True)
                                key = f"{co_txt.lower()}|{r_txt.lower()}"
                                if key not in seen and co_txt and r_txt:
                                    seen.add(key)
                                    jobs.append(make_job(co_txt, r_txt, "", "", "Wellfound", ""))

                except Exception as e:
                    print(f"[Wellfound] Error on {path}: {e}")

    except Exception as e:
        print(f"[Wellfound] Fatal error: {e}")

    print(f"[Wellfound] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE: LinkedIn Top Startups 2024
# ─────────────────────────────────────────────

# LinkedIn Top 50 Startups 2024 (US) — publicly published list, live ATS discovery
LINKEDIN_TOP_STARTUPS_2024 = [
    ("OpenAI",                "openai.com"),
    ("Anthropic",             "anthropic.com"),
    ("Perplexity AI",         "perplexity.ai"),
    ("Figure AI",             "figure.ai"),
    ("ElevenLabs",            "elevenlabs.io"),
    ("Mistral AI",            "mistral.ai"),
    ("Ramp",                  "ramp.com"),
    ("Shield AI",             "shield.ai"),
    ("Writer",                "writer.com"),
    ("CoreWeave",             "coreweave.com"),
    ("Anduril Industries",    "anduril.com"),
    ("Coalition",             "coalitioninc.com"),
    ("Wiz",                   "wiz.io"),
    ("Brex",                  "brex.com"),
    ("Cohere",                "cohere.com"),
    ("Glean",                 "glean.com"),
    ("Cognition",             "cognition.ai"),
    ("Runway",                "runwayml.com"),
    ("Navan",                 "navan.com"),
    ("Weights & Biases",      "wandb.ai"),
    ("Rubrik",                "rubrik.com"),
    ("Abridge",               "abridge.com"),
    ("Samsara",               "samsara.com"),
    ("Vanta",                 "vanta.com"),
    ("Moveworks",             "moveworks.com"),
    ("Intercom",              "intercom.com"),
    ("Vercel",                "vercel.com"),
    ("Figma",                 "figma.com"),
    ("Harness",               "harness.io"),
    ("Temporal",              "temporal.io"),
    ("Anyscale",              "anyscale.com"),
    ("Descript",              "descript.com"),
    ("Abnormal Security",     "abnormalsecurity.com"),
    ("Monte Carlo",           "montecarlodata.com"),
    ("Snorkel AI",            "snorkel.ai"),
    ("HeyGen",                "heygen.com"),
    ("Tome",                  "tome.app"),
    ("Gecko Robotics",        "geckorobotics.com"),
    ("Rippling",              "rippling.com"),
    ("Lattice",               "lattice.com"),
    ("Contentful",            "contentful.com"),
    ("Asana",                 "asana.com"),
    ("Amplitude",             "amplitude.com"),
    ("Retool",                "retool.com"),
    ("Notion",                "notion.so"),
    ("Linear",                "linear.app"),
    ("Loom",                  "loom.com"),
    ("Replit",                "replit.com"),
    ("Deel",                  "deel.com"),
    ("Gusto",                 "gusto.com"),
]


async def scrape_linkedin_top_startups() -> List[Dict]:
    """
    Uses the LinkedIn Top 50 Startups 2024 list (hardcoded — LinkedIn blocks
    live scraping) to do live ATS discovery. Each company's Greenhouse / Lever /
    Ashby board is checked for open roles matching the target profile.
    """
    jobs = []
    sem = asyncio.Semaphore(20)

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers=HEADERS) as client:
        tasks = [
            _ats_discover_jobs(name, f"https://{domain}", "LinkedIn Top Startups", client, sem)
            for name, domain in LINKEDIN_TOP_STARTUPS_2024
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, list):
                jobs.extend(r)

    print(f"[LinkedIn Top Startups] {len(jobs)} jobs found via ATS discovery")
    return jobs


# ─────────────────────────────────────────────
# AGGREGATE + DEDUPLICATE
# ─────────────────────────────────────────────
async def scrape_all_sources() -> List[Dict]:
    apify_key = os.getenv("APIFY_API_KEY", "")

    # Run all free sources concurrently
    results = await asyncio.gather(
        scrape_hn_who_is_hiring(),
        scrape_ali_rohde(),
        scrape_remoteok(),
        scrape_greenhouse(),
        scrape_lever(),
        scrape_ashby(),
        scrape_workable(),
        scrape_wellfound(),           # Jobicy fallback (Wellfound is Cloudflare-blocked)
        scrape_yc_startup_jobs(),     # YC company directory (all ~4000 YC companies via ATS)
        scrape_himalayas(),
        scrape_weworkremotely(),
        scrape_vc_boards(),
        scrape_vc_portfolio_pages(),  # a16z, Sequoia, Founders Fund, GV, True Ventures, Greylock, Lightspeed
        scrape_topstartups(),         # topstartups.io AI list
        scrape_forbes_startup_lists(), # Forbes Best Startup Employers → ATS discovery
        scrape_linkedin_top_startups(), # LinkedIn Top 50 Startups 2024 → ATS discovery
        return_exceptions=True,
    )

    all_jobs = []
    for r in results:
        if isinstance(r, list):
            all_jobs.extend(r)
        elif isinstance(r, Exception):
            print(f"[Scraper] Source error: {r}")

    # Apify sources (paid)
    if apify_key:
        try:
            linkedin_jobs = await scrape_apify_linkedin(apify_key)
            all_jobs.extend(linkedin_jobs)
        except Exception as e:
            print(f"[LinkedIn] Error: {e}")
        try:
            indeed_jobs = await scrape_apify_indeed(apify_key)
            all_jobs.extend(indeed_jobs)
        except Exception as e:
            print(f"[Indeed] Error: {e}")

    # Deduplicate only — no score filter, save all scraped jobs
    seen = set()
    unique = []
    for j in all_jobs:
        key = f"{j['company'].lower().strip()}|{j['role'].lower().strip()}"
        if key not in seen and j["company"] and j["role"]:
            seen.add(key)
            unique.append(j)

    unique.sort(key=lambda x: x.get("match_score", 0), reverse=True)
    print(f"\n✅ Total unique jobs: {len(unique)}")
    return unique


# ─────────────────────────────────────────────
# KNOWN AGENCIES
# ─────────────────────────────────────────────
KNOWN_AGENCIES = [
    {"name": "StaffGreat Team", "agency": "StaffGreat", "agency_url": "https://www.staffgreat.com",
     "specialty": "Tech Startups, AI", "is_agency": True},
    {"name": "VibeScaling Recruiting", "agency": "VibeScaling", "agency_url": "https://www.vibescaling.ai/recruiting",
     "specialty": "AI Startups, Venture-backed", "is_agency": True},
    {"name": "Riviera Partners", "agency": "Riviera Partners", "agency_url": "https://rivierapartners.com",
     "specialty": "Engineering & Product, Tech", "is_agency": True},
    {"name": "Betts Recruiting", "agency": "Betts Recruiting", "agency_url": "https://betts.com",
     "specialty": "Go-to-Market, Sales, Operations", "is_agency": True},
    {"name": "Leap Consulting Group", "agency": "Leap Consulting Group", "agency_url": "https://leapcg.com",
     "specialty": "Startup Strategy & Operations", "is_agency": True},
]
