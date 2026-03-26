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
]

# AI startups known to use Lever
LEVER_COMPANIES = [
    ("atlas", "Atlas"), ("adept", "Adept"), ("inflectionai", "Inflection AI"),
    ("covariant", "Covariant"), ("typeface", "Typeface"),
    ("together", "Together AI"), ("fireworks-ai", "Fireworks AI"),
    ("cognition-labs", "Cognition"), ("imbue", "Imbue"),
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

    text = f"{role} {description}".lower()
    loc_text = (location + " " + description).lower()
    co = company.lower()

    # 1. Role match (0-35 pts)
    matched = [r for r in TARGET_ROLES if r in text]
    if not matched:
        return 0, []  # Zero matching keywords = reject

    if len(matched) >= 3:
        role_pts = 35
    elif len(matched) == 2:
        role_pts = 28
    else:
        role_pts = 20
    reasons.append(f"Role: {', '.join(matched[:3])}")

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
        loc_pts = 8
        reasons.append("Remote/Hybrid")
    else:
        loc_pts = 0

    # 3. Entry-level signals (0-30 pts)
    # Check description for experience requirements FIRST — these override positive signals.
    desc_lower = description.lower()

    # ── Experience gate — check full description for any 5+ year requirement ──────
    # Multiple patterns to catch "7+ years", "7-10 years", "minimum 7 years", "7 or more years"
    hard_exp_patterns = [
        r'\b([5-9]|\d{2})\+?\s*years?\s+(?:of\s+)?(?:professional\s+|relevant\s+|work\s+)?experience',
        r'(?:minimum|at\s+least|minimum\s+of|at\s+minimum)\s+([5-9]|\d{2})\+?\s*years?',
        r'\b([5-9]|\d{2})\s*[-–]\s*\d+\s*\+?\s*years?\s+(?:of\s+)?(?:professional\s+|relevant\s+|work\s+)?experience',
        r'\b([5-9]|\d{2})\s+or\s+more\s+years?\s+(?:of\s+)?experience',
    ]
    hard_exp_in_desc = any(re.search(p, desc_lower) for p in hard_exp_patterns)

    mid_exp_in_desc = re.search(
        r'\b([3-4])\+?\s*years?\s+(?:of\s+)?(?:professional\s+)?(?:relevant\s+)?(?:work\s+)?experience',
        desc_lower
    )
    one_two_exp_in_desc = re.search(
        r'\b([1-2])\+?\s*years?\s+(?:of\s+)?(?:professional\s+)?(?:relevant\s+)?(?:work\s+)?experience',
        desc_lower
    )

    if hard_exp_in_desc:
        return 0, []
    elif mid_exp_in_desc:
        entry_pts = 5
        reasons.append(f"3-4 yrs exp (reach)")
    elif one_two_exp_in_desc:
        entry_pts = 12
        reasons.append(f"1-2 yrs exp (stretch)")
    else:
        clear_entry = [
            "new grad", "entry level", "entry-level", "0-2 years", "recent graduate",
            "no experience required", "0 years", "new graduate", "early career",
        ]
        if any(s in text for s in clear_entry):
            entry_pts = 30
            reasons.append("Entry-level friendly")
        else:
            entry_pts = 15

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


def extract_min_years(text: str):
    """Return the minimum years of experience required from a description, or None."""
    if not text:
        return None
    t = text.lower()

    # Ordered from most specific to least specific
    patterns = [
        r'(?:minimum|at\s+least|minimum\s+of)\s+(\d+)\s*\+?\s*years?',
        r'\b(\d+)\s*[-–]\s*\d+\s*\+?\s*years?\s+(?:of\s+)?(?:relevant\s+|professional\s+|work\s+)?experience',
        # "minimum of 3 years" / "at least 3 years of experience"
        r'(?:minimum\s+(?:of\s+)?|at\s+least\s+)(\d+)\s*\+?\s*years?',
        # "3+ years of professional/relevant/work experience"
        r'\b(\d+)\s*\+\s*years?\s+(?:of\s+)?(?:relevant\s+|professional\s+|work\s+)?experience',
        # "3 to 5 years of experience" / "3-5 years experience"
        r'\b(\d+)\s*(?:to|-)\s*\d+\s*years?\s+(?:of\s+)?(?:relevant\s+|professional\s+|work\s+)?experience',
        # "3 years of experience" (no +)
        r'\b(\d+)\s*years?\s+of\s+(?:relevant\s+|professional\s+|work\s+)?experience',
        # "3 years experience" (no "of")
        r'\b(\d+)\s*years?\s+experience',
        # "3 or more years"
        r'\b(\d+)\s+or\s+more\s+years?',
        # fallback: "X years" near the word "experience" within 40 chars
        r'\b(\d+)\s*\+?\s*years?\b(?=.{0,40}experience)',
    ]

    for pat in patterns:
        m = re.search(pat, t)
        if m:
            return int(m.group(1))

    if re.search(r'\bentry.?level\b|no experience required|\b0.?year|\bnew\s+grad|\brecent\s+graduate', t):
        return 0
    return None


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
    """Ashby public job board GraphQL API — no auth required."""
    jobs = []
    ASHBY_QUERY = (
        "query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {"
        "  jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {"
        "    jobPostings { id title locationName employmentType descriptionHtml }"
        "  }"
        "}"
    )
    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
        async def fetch_company(slug, name):
            try:
                resp = await client.post(
                    "https://jobs.ashbyhq.com/api/non-user-graphql",
                    json={
                        "operationName": "ApiJobBoardWithTeams",
                        "variables": {"organizationHostedJobsPageName": slug},
                        "query": ASHBY_QUERY,
                    },
                    timeout=10.0,
                )
                if resp.status_code != 200:
                    return []
                postings = resp.json().get("data", {}).get("jobBoard", {}).get("jobPostings", [])
                results = []
                for job in (postings or []):
                    role = job.get("title", "")
                    location = job.get("locationName", "")
                    url = f"https://jobs.ashbyhq.com/{slug}/{job.get('id', '')}"
                    desc = re.sub(r"<[^>]+>", " ", job.get("descriptionHtml", "") or "")
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
    """Workable public REST API — no auth required for public listings."""
    jobs = []
    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
        async def fetch_company(slug, name):
            try:
                resp = await client.get(
                    f"https://apply.workable.com/api/v3/accounts/{slug}/jobs",
                    timeout=10.0,
                )
                if resp.status_code != 200:
                    return []
                results = []
                for job in resp.json().get("results", []):
                    role = job.get("title", "")
                    city = job.get("city", "") or ""
                    country = job.get("country", "") or ""
                    location = city if city else country
                    shortcode = job.get("shortcode", "")
                    url = f"https://apply.workable.com/{slug}/j/{shortcode}" if shortcode else ""
                    desc = job.get("description", "") or ""
                    score, _ = score_job(name, role, location, desc)
                    if score >= 0:
                        results.append(make_job(name, role, location, url, "Workable", desc))
                return results
            except Exception:
                return []

        tasks = [fetch_company(slug, name) for slug, name in WORKABLE_COMPANIES]
        results = await asyncio.gather(*tasks)
        for r in results:
            jobs.extend(r)

    print(f"[Workable] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE 8: Wellfound (AngelList)
# ─────────────────────────────────────────────
async def scrape_wellfound() -> List[Dict]:
    """Wellfound startup jobs — scrape search result pages."""
    jobs = []
    search_urls = [
        "https://wellfound.com/role/l/new-york-city/operations",
        "https://wellfound.com/role/l/new-york-city/product-manager",
        "https://wellfound.com/role/l/san-francisco/operations",
        "https://wellfound.com/role/l/san-francisco/product-manager",
        "https://wellfound.com/role/l/new-york-city/business-development",
        "https://wellfound.com/role/l/san-francisco/strategy",
    ]
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers=HEADERS) as client:
            for url in search_urls:
                try:
                    resp = await client.get(url)
                    html = resp.text
                    # Extract JSON-LD job postings
                    for ld_str in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL):
                        try:
                            data = json.loads(ld_str)
                            items = data if isinstance(data, list) else [data]
                            for item in items:
                                if item.get("@type") == "JobPosting":
                                    role = item.get("title", "")
                                    company = item.get("hiringOrganization", {}).get("name", "")
                                    loc = item.get("jobLocation", {})
                                    location = loc.get("address", {}).get("addressLocality", "") if isinstance(loc, dict) else str(loc)
                                    desc = re.sub(r"<[^>]+>", " ", item.get("description", "") or "")
                                    job_url = item.get("url", url)
                                    if company and role:
                                        jobs.append(make_job(company, role, location, job_url, "Wellfound", desc[:500]))
                        except Exception:
                            pass
                    # Also look for next-data JSON
                    nd_match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
                    if nd_match:
                        try:
                            nd = json.loads(nd_match.group(1))
                            roles = nd.get("props", {}).get("pageProps", {}).get("roles", [])
                            for r in roles:
                                role = r.get("title", "")
                                company = r.get("startup", {}).get("name", "") if isinstance(r.get("startup"), dict) else ""
                                location = r.get("locationNames", [""])[0] if r.get("locationNames") else ""
                                job_url = "https://wellfound.com" + r.get("slug", "")
                                if company and role:
                                    jobs.append(make_job(company, role, location, job_url, "Wellfound"))
                        except Exception:
                            pass
                except Exception:
                    pass
    except Exception as e:
        print(f"[Wellfound] Error: {e}")
    print(f"[Wellfound] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE: YC Work at a Startup
# ─────────────────────────────────────────────
async def scrape_yc_startup_jobs() -> List[Dict]:
    """
    YC Work at a Startup public API — all YC-backed companies posting jobs.
    Filters by ops/BD/management/marketing role types.
    """
    jobs = []
    role_codes = "OP%2CBD%2CMG%2CMK%2CSA"  # Operations, BD, Management, Marketing, Sales
    urls = [
        f"https://www.workatastartup.com/companies/fetch?q=&batch=&industry=&subindustry=&regions=&company_size=&roles={role_codes}&remote=false&order_by=relevance&nonprofit=false",
        f"https://www.workatastartup.com/companies/fetch?q=&batch=&industry=&subindustry=&regions=&company_size=&roles={role_codes}&remote=true&order_by=relevance&nonprofit=false",
    ]
    try:
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True, headers={
            **HEADERS,
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://www.workatastartup.com/jobs",
        }) as client:
            for url in urls:
                try:
                    resp = await client.get(url)
                    if resp.status_code != 200:
                        continue
                    data = resp.json()
                    for co in data.get("companies", []):
                        name = co.get("name", "")
                        for job in co.get("jobs", []):
                            role = job.get("title", "")
                            location = job.get("location", "") or ""
                            desc = (job.get("description", "") or "")
                            desc = re.sub(r"<[^>]+>", " ", desc)
                            job_id = job.get("id", "")
                            job_url = f"https://www.workatastartup.com/jobs/{job_id}" if job_id else ""
                            if name and role:
                                score, _ = score_job(name, role, location, desc)
                                if score >= 0:
                                    jobs.append(make_job(name, role, location, job_url, "YC Work at a Startup", desc))
                except Exception as e:
                    print(f"[YC Jobs] URL error: {e}")
    except Exception as e:
        print(f"[YC Jobs] Error: {e}")
    print(f"[YC Jobs] {len(jobs)} jobs found")
    return jobs


# ─────────────────────────────────────────────
# SOURCE: Himalayas (remote startup jobs)
# ─────────────────────────────────────────────
async def scrape_himalayas() -> List[Dict]:
    """
    Himalayas — startup & remote job board with a public REST API.
    Searches ops, strategy, growth, and business roles. No auth required.
    """
    jobs = []
    queries = [
        "operations", "strategy", "chief of staff", "business development",
        "growth", "product operations", "go to market",
    ]
    seen = set()
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers=HEADERS) as client:
            for q in queries:
                try:
                    resp = await client.get(
                        "https://himalayas.app/api/jobs",
                        params={"search": q, "limit": 50},
                        timeout=12.0,
                    )
                    if resp.status_code != 200:
                        continue
                    data = resp.json()
                    for job in data.get("jobs", []):
                        role    = job.get("title", "")
                        company = (job.get("company") or {}).get("name", "") or job.get("companyName", "")
                        locs    = job.get("locationRestrictions") or []
                        location = locs[0] if locs else "Remote"
                        url     = job.get("url", "") or job.get("applicationUrl", "")
                        desc    = re.sub(r"<[^>]+>", " ", job.get("description", "") or "")
                        if company and role:
                            key = f"{company.lower()}|{role.lower()}"
                            if key not in seen:
                                seen.add(key)
                                score, _ = score_job(company, role, location, desc)
                                if score >= 0:
                                    jobs.append(make_job(company, role, location, url, "Himalayas", desc))
                except Exception:
                    pass
    except Exception as e:
        print(f"[Himalayas] Error: {e}")
    print(f"[Himalayas] {len(jobs)} jobs found")
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
        "https://weworkremotely.com/categories/remote-business-management-jobs.rss",
        "https://weworkremotely.com/categories/remote-product-jobs.rss",
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
# (a16z, Sequoia, First Round, Greylock,
#  General Catalyst, Insight Partners)
# ─────────────────────────────────────────────

# Companies from top VC portfolios known to use Greenhouse
GREENHOUSE_COMPANIES_EXTRA = [
    # a16z portfolio
    ("coinbase", "Coinbase"), ("stripe", "Stripe"), ("robinhood", "Robinhood"),
    ("lyft", "Lyft"), ("airbnb", "Airbnb"), ("okta", "Okta"),
    ("databricks", "Databricks"), ("navan", "Navan"), ("amplitude", "Amplitude"),
    ("klaviyo", "Klaviyo"), ("checkr", "Checkr"), ("gem", "Gem"),
    ("mixpanel", "Mixpanel"), ("launchdarkly", "LaunchDarkly"),
    ("pagerduty", "PagerDuty"), ("front", "Front"),
    ("ironclad", "Ironclad"), ("benchling", "Benchling"),
    ("cedar", "Cedar"), ("devoted", "Devoted Health"),
    ("opentrons", "Opentrons"), ("hadrian", "Hadrian"),
    ("standard-ai", "Standard AI"), ("genesis-therapeutics", "Genesis Therapeutics"),
    # Sequoia portfolio
    ("zapier", "Zapier"), ("whoop", "WHOOP"), ("relativity-space", "Relativity Space"),
    ("nubank", "Nubank"), ("klarna", "Klarna"), ("faire", "Faire"),
    ("dutchie", "Dutchie"), ("openphone", "OpenPhone"), ("zepz", "Zepz"),
    ("coda", "Coda"), ("airtable", "Airtable"),
    # First Round portfolio
    ("square", "Square"), ("uber", "Uber"), ("warby-parker", "Warby Parker"),
    ("flatiron-health", "Flatiron Health"), ("classpass", "ClassPass"),
    # Greylock portfolio
    ("discord", "Discord"), ("figma", "Figma"), ("roblox", "Roblox"),
    ("nextdoor", "Nextdoor"), ("pagerduty", "PagerDuty"),
    # Insight Partners portfolio
    ("typeform", "Typeform"), ("miro", "Miro"), ("backblaze", "Backblaze"),
    ("invision", "InVision"), ("pendo", "Pendo"),
    # General Catalyst portfolio
    ("hubspot", "HubSpot"), ("snap", "Snap"), ("stripe", "Stripe"),
    ("liveperson", "LivePerson"), ("gusto", "Gusto"),
    # Other high-signal startups
    ("anduril", "Anduril"), ("palantir", "Palantir"), ("scale", "Scale AI"),
    ("openai", "OpenAI"), ("anthropic", "Anthropic"),
    ("notion", "Notion"), ("airtable", "Airtable"),
]

# Companies from VC portfolios known to use Ashby
ASHBY_COMPANIES_EXTRA = [
    # a16z portfolio
    ("alchemy", "Alchemy"), ("mux", "Mux"), ("coda", "Coda"),
    ("substack", "Substack"), ("oxide", "Oxide Computer"),
    ("iterative", "Iterative"), ("syndicate", "Syndicate"),
    ("parabol", "Parabol"), ("vanta", "Vanta"),
    # Sequoia portfolio
    ("incident-io", "Incident.io"), ("dbt-labs", "dbt Labs"),
    ("airbyte", "Airbyte"), ("fivetran", "Fivetran"),
    ("roboflow", "Roboflow"), ("phlex", "Phlex AI"),
    # First Round portfolio
    ("notion", "Notion"), ("lattice", "Lattice"),
    # Greylock portfolio
    ("coreweave", "CoreWeave"), ("abnormal-security", "Abnormal Security"),
    ("orca-security", "Orca Security"),
    # Insight Partners portfolio
    ("wiz", "Wiz"), ("postman", "Postman"), ("grafana", "Grafana Labs"),
    ("snyk", "Snyk"), ("harness", "Harness"),
    # General Catalyst portfolio
    ("samsara", "Samsara"), ("stripe-climate", "Stripe Climate"),
    ("hugging-face", "Hugging Face"),
]


async def scrape_vc_boards() -> List[Dict]:
    """
    Scrape job boards from top VC firms using their portfolio companies'
    expanded Greenhouse + Ashby boards, plus direct VC board pages.
    """
    jobs = []

    # ── Expand Greenhouse with VC portfolio companies ────────────────────────
    extra_gh_companies = [(s, n) for s, n in GREENHOUSE_COMPANIES_EXTRA
                          if (s, n) not in GREENHOUSE_COMPANIES]

    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
        async def fetch_gh(slug, name):
            try:
                resp = await client.get(
                    f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true",
                    timeout=10.0,
                )
                if resp.status_code != 200:
                    return []
                results = []
                for job in resp.json().get("jobs", []):
                    role = job.get("title", "")
                    location = job.get("location", {}).get("name", "")
                    url = job.get("absolute_url", "")
                    content = re.sub(r"<[^>]+>", " ", job.get("content", "") or "")
                    score, _ = score_job(name, role, location, content)
                    if score >= 0:
                        results.append(make_job(name, role, location, url, "VC Portfolio (Greenhouse)", content))
                return results
            except Exception:
                return []

        tasks = [fetch_gh(slug, name) for slug, name in extra_gh_companies]
        results = await asyncio.gather(*tasks)
        for r in results:
            jobs.extend(r)

    # ── Expand Ashby with VC portfolio companies ─────────────────────────────
    ASHBY_QUERY = (
        "query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {"
        "  jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {"
        "    jobPostings { id title locationName employmentType descriptionHtml }"
        "  }"
        "}"
    )
    extra_ashby = [(s, n) for s, n in ASHBY_COMPANIES_EXTRA
                   if (s, n) not in ASHBY_COMPANIES]

    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
        async def fetch_ashby(slug, name):
            try:
                resp = await client.post(
                    "https://jobs.ashbyhq.com/api/non-user-graphql",
                    json={
                        "operationName": "ApiJobBoardWithTeams",
                        "variables": {"organizationHostedJobsPageName": slug},
                        "query": ASHBY_QUERY,
                    },
                    timeout=10.0,
                )
                if resp.status_code != 200:
                    return []
                postings = resp.json().get("data", {}).get("jobBoard", {}).get("jobPostings", [])
                results = []
                for job in (postings or []):
                    role = job.get("title", "")
                    location = job.get("locationName", "")
                    url = f"https://jobs.ashbyhq.com/{slug}/{job.get('id', '')}"
                    desc = re.sub(r"<[^>]+>", " ", job.get("descriptionHtml", "") or "")
                    score, _ = score_job(name, role, location, desc)
                    if score >= 0:
                        results.append(make_job(name, role, location, url, "VC Portfolio (Ashby)", desc))
                return results
            except Exception:
                return []

        tasks = [fetch_ashby(slug, name) for slug, name in extra_ashby]
        results = await asyncio.gather(*tasks)
        for r in results:
            jobs.extend(r)

    print(f"[VC Boards] {len(jobs)} jobs found")
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
        scrape_wellfound(),
        scrape_yc_startup_jobs(),
        scrape_himalayas(),
        scrape_weworkremotely(),
        scrape_vc_boards(),
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
