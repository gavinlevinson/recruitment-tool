export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-navy-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-navy-400 mb-8">Last updated: April 2, 2026</p>

        <div className="prose prose-navy prose-sm max-w-none space-y-6 text-navy-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">1. Information We Collect</h2>
            <p>Orion Recruit ("we", "our", "us") collects the following information when you use our platform:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Account information:</strong> Name, email address, university, graduation year, and career preferences you provide during registration.</li>
              <li><strong>Resume data:</strong> Resume files you upload are parsed to extract skills, roles, and experience for job matching. Resume files are stored securely and only accessible by you.</li>
              <li><strong>Job tracking data:</strong> Jobs you save, contacts you add, interview notes, and application status updates.</li>
              <li><strong>Google services data:</strong> If you connect Gmail, Google Calendar, or Google Drive, we access only the specific permissions you grant (sending emails, creating calendar events, creating/linking documents). We do not read your existing emails, calendar events, or files.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Match and score job opportunities based on your resume and preferences</li>
              <li>Track your job applications and networking contacts</li>
              <li>Provide AI-powered coaching on resumes, cover letters, and interviews</li>
              <li>Send networking emails on your behalf (only when you explicitly click send)</li>
              <li>Sync interview dates and deadlines to your Google Calendar (only when you explicitly request it)</li>
              <li>Create Google Docs for contact notes (only when you explicitly request it)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">3. Google API Services</h2>
            <p>Orion Recruit's use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-violet-600 underline" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
            <p className="mt-2">Specifically:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>We only request access to the Google services you choose to connect</li>
              <li>We do not use Google data for advertising or sell it to third parties</li>
              <li>We do not use Google data to train AI models</li>
              <li>Gmail access is used solely to send emails you compose within the platform</li>
              <li>Calendar access is used solely to create events for interviews, deadlines, and networking meetings you schedule</li>
              <li>Drive access is used solely to create and link documents you request for contact notes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">4. Data Storage and Security</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your data is stored on secure servers hosted by Railway (backend) and Vercel (frontend)</li>
              <li>Database is PostgreSQL with encrypted connections</li>
              <li>Authentication uses JWT tokens with password hashing (bcrypt)</li>
              <li>Google OAuth tokens are stored securely and refreshed automatically</li>
              <li>We do not share your personal data with third parties except as described in this policy</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">5. Data Deletion</h2>
            <p>You can permanently delete your account and all associated data at any time from your Profile page. This removes all your jobs, contacts, templates, calendar events, resume data, and preferences. This action is irreversible.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">6. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Anthropic (Claude AI):</strong> For resume coaching, cover letter feedback, and interview practice. Your resume and cover letter text are sent to Claude for analysis but are not stored by Anthropic.</li>
              <li><strong>Apollo.io:</strong> For contact discovery at companies you're applying to. Searches are initiated by you.</li>
              <li><strong>PostHog:</strong> For anonymous product analytics (page views, feature usage). No personal data is shared.</li>
              <li><strong>Google APIs:</strong> Gmail, Calendar, and Drive as described above.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">7. Contact</h2>
            <p>For questions about this privacy policy or your data, contact us at <a href="mailto:gavinlev@umich.edu" className="text-violet-600 underline">gavinlev@umich.edu</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
