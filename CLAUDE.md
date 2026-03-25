# RecruitIQ — Claude Instructions

## At the End of Every Session

**Always remind the user to push changes to GitHub.**

At the end of every conversation, before closing out, provide:

1. A bullet list of every file that was changed and a one-line description of what changed
2. A ready-made commit summary they can paste directly into GitHub Desktop

Format it like this:

---

### 📦 Ready to Push to GitHub

**Files changed:**
- `backend/main.py` — [what changed]
- `frontend/src/pages/JobDiscovery.jsx` — [what changed]

**Commit summary (paste into GitHub Desktop):**
```
[Short descriptive summary of all changes made this session]
```

---

## Project Overview

**RecruitIQ** — An AI-powered recruitment tool for early-career job seekers.

- **Frontend:** React + Vite + Tailwind CSS (port 5173)
- **Backend:** FastAPI + SQLAlchemy + SQLite (port 8000)
- **AI:** Anthropic Claude (claude-haiku-4-5)
- **Project path:** `/Users/gavinlevinson/Desktop/Recruitment Tool`

## Key Files
- `backend/main.py` — FastAPI routes and business logic
- `backend/scraper.py` — Job scraping from all sources
- `backend/database.py` — SQLAlchemy models
- `backend/auth.py` — JWT authentication
- `frontend/src/pages/` — All React page components
- `frontend/src/api.js` — Frontend API calls
