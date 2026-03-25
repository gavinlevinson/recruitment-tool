# RecruitIQ — Gavin Levinson's Job Search Command Center

A fully local, AI-powered recruitment tool built for your job search at AI startups in NYC and San Francisco.

---

## 🚀 How to Start the App

**Every time you want to use RecruitIQ, just run:**

```bash
bash "/Users/gavinlevinson/Desktop/Recruitment Tool/start.sh"
```

Then open → **http://localhost:5173**

That's it. Both the backend (API) and frontend (UI) start automatically.

---

## 🔑 API Keys — What You Need & How to Get Them

The app works fully out of the box for Pages 1, 3 (basic), and 4. To unlock full functionality, add these two keys:

### 1. Apollo.io API Key *(Networking Page — Contact Discovery)*
- Go to: https://app.apollo.io/#/settings/integrations/api
- Click **"Create API Key"** → copy it
- Paste it in `backend/.env`:
  ```
  APOLLO_API_KEY=your_key_here
  ```
- **What it unlocks:** The "Search Apollo" button on the Networking page will find real people at companies you're targeting, filtered by role keywords relevant to what you're applying for.
- **Cost:** Apollo has a free tier (50 credits/month). Basic paid plans start at ~$49/month.

### 2. Apify API Key *(Job Discovery — LinkedIn Scraping)*
- Go to: https://apify.com/ → Sign up → Settings → Integrations → API tokens
- Copy your **Personal API token**
- Paste it in `backend/.env`:
  ```
  APIFY_API_KEY=your_key_here
  ```
- **What it unlocks:** The Job Discovery agent will scrape LinkedIn for entry-level AI startup roles in NYC and SF matching your profile.
- **Cost:** Apify free tier includes $5/month of compute. LinkedIn scraping uses the `curious_coder~linkedin-jobs-scraper` actor — a typical daily run costs ~$0.05–0.20.

**After adding keys, restart the app** (Ctrl+C → re-run start.sh).

---

## 📄 The 4 Pages

### 1. Job Tracker (`/tracker`)
Track every company you're interested in with full details: status, date applied, salary, location, referral, job URL, and notes. All 74 companies from your Excel sheet have been imported. Click any row to expand notes. Use the status pills at the top to filter by pipeline stage.

**Status flow:** Not Applied → Applied → Pending → Accepted / Rejected

### 2. Networking (`/networking`)
Your contact CRM. 274 contacts from your Excel sheet are imported. Use the **Company Quick Jump** sidebar to click any target company and instantly filter to your contacts there. Michigan alumni are highlighted. When Apollo is configured, the "Search Apollo" button pulls real contact suggestions at any company.

**Outreach tracking:** Not Contacted → Emailed → Called → Meeting Scheduled → Met

### 3. Job Discovery (`/discovery`)
Click **"Run Discovery Agent"** to scrape YC Jobs, Ali Rohde's newsletter, and LinkedIn (if Apify key is set) for entry-level strategy/ops/product roles at AI startups in NYC and SF. Jobs are scored 0-100 based on fit with your profile. Click **"Add to Tracker"** on any job to instantly send it to your Job Tracker.

**Auto-runs daily at 9:00 AM** once the backend is running.

### 4. Recruiters (`/recruiters`)
Directory of agency recruiters — StaffGreat, VibeScaling, Betts Recruiting, Riviera Partners, and Leap Consulting Group are pre-loaded. Add new ones as you find them. Track your outreach status with each.

---

## 📁 File Structure

```
Recruitment Tool/
├── start.sh                  ← Run this to start everything
├── backend/
│   ├── main.py               ← FastAPI API server
│   ├── database.py           ← SQLite schema (jobs, contacts, discovered, recruiters)
│   ├── scraper.py            ← Job discovery agent logic
│   ├── migrate.py            ← One-time Excel import (already run)
│   ├── recruitment.db        ← Your local database (all your data lives here)
│   └── .env                  ← Your API keys (edit this)
└── frontend/
    └── src/
        ├── App.jsx           ← Navigation shell
        ├── api.js            ← Backend API client
        └── pages/
            ├── Dashboard.jsx
            ├── JobTracker.jsx
            ├── Networking.jsx
            ├── JobDiscovery.jsx
            └── Recruiters.jsx
```

---

## 💾 Your Data

All data is stored locally in **`backend/recruitment.db`** (SQLite). Nothing is sent to the cloud. Back this file up periodically — it's the only copy of your data.

---

## 🔧 Troubleshooting

**"Backend won't start"**
```bash
cd "/Users/gavinlevinson/Desktop/Recruitment Tool/backend"
python3 -m uvicorn main:app --port 8000
```

**"Frontend won't start"**
```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd "/Users/gavinlevinson/Desktop/Recruitment Tool/frontend"
npm run dev
```

**"I want to re-import my Excel data"**
- Delete `backend/recruitment.db`
- Run: `python3 backend/migrate.py`

---

*Built March 2026 — Gavin Levinson, University of Michigan '26*
