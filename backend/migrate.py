"""
Migrate data from '2026 Recruitment Tracker.xlsx' into the SQLite database.
Run once: python3 migrate.py
"""
import pandas as pd
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from database import init_db, SessionLocal, Job, Contact, Recruiter
from scraper import KNOWN_AGENCIES
from datetime import datetime

XLSX_PATH = "/Users/gavinlevinson/Desktop/2026 Recruitment Tracker.xlsx"

def migrate():
    init_db()
    db = SessionLocal()

    df = pd.read_excel(XLSX_PATH, sheet_name="AI", header=None)

    # Parse the messy sheet: company is col 0, role col 1, status col 2,
    # stakeholder col 3, email col 4, follow_up1 col 5, follow_up2 col 6
    current_company = None
    current_job_id = None
    current_status = None

    jobs_added = 0
    contacts_added = 0

    for i, row in df.iterrows():
        company_val = str(row[0]).strip() if pd.notna(row[0]) else ""
        role_val = str(row[1]).strip() if pd.notna(row[1]) else ""
        status_val = str(row[2]).strip() if pd.notna(row[2]) else ""
        stakeholder_val = str(row[3]).strip() if pd.notna(row[3]) else ""
        email_val = str(row[4]).strip() if pd.notna(row[4]) else ""
        follow1_val = str(row[5]).strip() if pd.notna(row[5]) else ""
        follow2_val = str(row[6]).strip() if pd.notna(row[6]) else ""

        # Skip header row and empty rows
        if company_val in ("Company", "nan", ""):
            if company_val == "Company":
                continue

        # New company entry
        if company_val and company_val != "nan":
            current_company = company_val
            current_status = status_val if status_val and status_val != "nan" else "Not Applied"
            # Normalize status
            status_map = {
                "pending": "Pending",
                "not applied": "Not Applied",
                "rejected": "Rejected",
                "applied": "Applied",
                "accepted": "Accepted",
                "nan": "Not Applied",
                "": "Not Applied",
            }
            current_status = status_map.get(current_status.lower(), current_status)

            # Skip rows that are just a URL (role col has http)
            if role_val.startswith("http"):
                role_val = ""

            # Check if job already exists
            existing = db.query(Job).filter(Job.company == current_company).first()
            if not existing:
                new_job = Job(
                    company=current_company,
                    role=role_val if role_val != "nan" else "",
                    status=current_status,
                    source="Excel Import",
                )
                db.add(new_job)
                db.flush()
                current_job_id = new_job.id
                jobs_added += 1
            else:
                current_job_id = existing.id

        # Contact/stakeholder row
        if stakeholder_val and stakeholder_val != "nan" and current_company:
            email = email_val if email_val != "nan" else None
            f1 = bool(follow1_val and follow1_val not in ("nan", ""))
            f2 = bool(follow2_val and follow2_val not in ("nan", ""))

            existing_contact = db.query(Contact).filter(
                Contact.name == stakeholder_val,
                Contact.company == current_company
            ).first()
            if not existing_contact:
                contact = Contact(
                    job_id=current_job_id,
                    company=current_company,
                    name=stakeholder_val,
                    email=email,
                    follow_up_1=f1,
                    follow_up_2=f2,
                    outreach_status="Emailed" if f1 else "Not Contacted",
                )
                db.add(contact)
                contacts_added += 1

    db.commit()
    print(f"✅ Migration complete: {jobs_added} jobs, {contacts_added} contacts imported.")

    # Seed known agencies
    agencies_added = 0
    for agency_data in KNOWN_AGENCIES:
        existing = db.query(Recruiter).filter(Recruiter.agency == agency_data["agency"]).first()
        if not existing:
            rec = Recruiter(**agency_data)
            db.add(rec)
            agencies_added += 1
    db.commit()
    print(f"✅ Seeded {agencies_added} recruiting agencies.")
    db.close()

if __name__ == "__main__":
    migrate()
