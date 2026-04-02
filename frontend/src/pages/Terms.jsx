export default function Terms() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-navy-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-navy-400 mb-8">Last updated: April 2, 2026</p>

        <div className="prose prose-navy prose-sm max-w-none space-y-6 text-navy-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">1. Acceptance of Terms</h2>
            <p>By creating an account or using Orion Recruit ("the Service"), you agree to these Terms of Service. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">2. Description of Service</h2>
            <p>Orion Recruit is a job search and recruitment management platform that helps users discover job opportunities, track applications, manage networking contacts, and receive AI-powered coaching. The Service is provided "as is" and may be updated or modified at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">3. User Accounts</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You must provide accurate information when creating an account</li>
              <li>You are responsible for maintaining the security of your account credentials</li>
              <li>You may not share your account with others</li>
              <li>You may delete your account at any time from your Profile page</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Use the Service for any illegal purpose</li>
              <li>Attempt to access other users' data</li>
              <li>Send spam or unsolicited messages through the platform's email features</li>
              <li>Scrape, copy, or redistribute job data from the Service</li>
              <li>Attempt to reverse engineer or interfere with the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">5. AI-Generated Content</h2>
            <p>The coaching features (resume scan, cover letter feedback, interview practice) use AI to generate suggestions and feedback. This content is provided for informational purposes only. You are responsible for reviewing and editing any AI-generated content before using it in job applications.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">6. Job Data</h2>
            <p>Job listings displayed on the Service are aggregated from public sources. We do not guarantee the accuracy, availability, or completeness of any job listing. Job postings may be removed or modified by employers at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">7. Limitation of Liability</h2>
            <p>The Service is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the Service, including but not limited to missed job opportunities, data loss, or reliance on AI-generated content.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">8. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use of the Service after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy-900 mt-8 mb-3">9. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:gavinlev@umich.edu" className="text-violet-600 underline">gavinlev@umich.edu</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
