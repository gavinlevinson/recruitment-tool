import { useState, useEffect } from 'react'
import { X, Building2, Globe, Linkedin, ExternalLink } from 'lucide-react'
import { newsApi } from '../api'

export default function CompanyIntelPopup({ company, jobUrl, description, onClose }) {
  const [summary, setSummary] = useState(null)
  const [articles, setArticles] = useState([])
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingNews, setLoadingNews] = useState(true)

  // Derive domain
  const companyDomain = (() => {
    if (jobUrl) {
      try {
        const url = new URL(jobUrl)
        const host = url.hostname.toLowerCase().replace(/^www\./, '')
        const ats = ['lever.co', 'greenhouse.io', 'ashbyhq.com', 'workable.com']
        for (const a of ats) {
          if (host.includes(a)) {
            const slug = url.pathname.split('/').filter(Boolean)[0]
            return slug ? slug + '.com' : null
          }
        }
        if (!host.includes('linkedin.com') && !host.includes('indeed.com')) return host
      } catch {}
    }
    return (company || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'
  })()

  const linkedinUrl = `https://www.linkedin.com/company/${(company || '').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`

  useEffect(() => {
    if (!company) return

    // Fetch summary
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000')
    const token = localStorage.getItem('orion_token') || ''
    const params = new URLSearchParams({
      company,
      description: (description || '').substring(0, 500),
      job_url: jobUrl || '',
    })
    fetch(`${baseUrl}/api/company-summary?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setSummary(data.summary || null))
      .catch(() => {})
      .finally(() => setLoadingSummary(false))

    // Fetch news
    newsApi.companyNews(company, jobUrl || '')
      .then(res => setArticles(res.data?.articles || []))
      .catch(() => {})
      .finally(() => setLoadingNews(false))
  }, [company])

  // Extract tech stack from description
  const techStack = (() => {
    const desc = (description || '').toLowerCase()
    const techs = [
      'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'AWS', 'GCP', 'Azure',
      'Kubernetes', 'Docker', 'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL',
      'Go', 'Rust', 'Java', 'SQL', 'Tableau', 'Salesforce', 'Figma',
    ]
    return techs.filter(t => desc.includes(t.toLowerCase())).slice(0, 6)
  })()

  return (
    <>
      <div className="fixed inset-0 bg-navy-900/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl border border-navy-100 w-full max-w-md max-h-[85vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-navy-100">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-violet-600" />
              <h2 className="text-base font-bold text-navy-900">{company}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-50 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-4 space-y-4">

            {/* About */}
            {loadingSummary ? (
              <p className="text-xs text-navy-400 italic">Loading...</p>
            ) : summary ? (
              <div>
                <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1">About</p>
                <p className="text-sm text-navy-700 leading-relaxed">{summary}</p>
              </div>
            ) : null}

            {/* Quick Links */}
            <div className="flex items-center gap-4">
              {companyDomain && (
                <a href={`https://${companyDomain}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1">
                  <Globe size={11} /> Website
                </a>
              )}
              <a href={linkedinUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1">
                <Linkedin size={11} /> LinkedIn
              </a>
              {jobUrl && (
                <a href={jobUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1">
                  <ExternalLink size={11} /> Job Posting
                </a>
              )}
            </div>

            {/* Tech Stack */}
            {techStack.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1">Tech Stack</p>
                <div className="flex flex-wrap gap-1">
                  {techStack.map(t => (
                    <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-navy-50 text-navy-600 border border-navy-100">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* News */}
            <div>
              <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1.5">Recent News</p>
              {loadingNews ? (
                <p className="text-xs text-navy-400 italic">Searching...</p>
              ) : articles.length > 0 ? (
                <ul className="space-y-2">
                  {articles.slice(0, 5).map((a, i) => (
                    <li key={i}>
                      <a href={a.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-navy-800 hover:text-violet-700 leading-snug block">
                        • {a.title}
                        <span className="text-[9px] text-navy-400 ml-1">
                          — {a.source}{a.published ? `, ${new Date(a.published).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-navy-300 italic">No recent news found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
