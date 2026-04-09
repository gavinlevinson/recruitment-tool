import { useState, useEffect } from 'react'
import { X, Building2, Globe, Linkedin, Loader2 } from 'lucide-react'
import { newsApi } from '../api'

// Shared ATS domain extraction — mirrors JobTracker/Discovery logic
const ATS_HOSTS = ['lever.co', 'greenhouse.io', 'ashbyhq.com', 'ashby.io', 'workable.com', 'boards.greenhouse.io', 'job-boards.greenhouse.io', 'job-boards.eu.greenhouse.io']

function companyDomainFromUrl(jobUrl, companyName) {
  if (jobUrl) {
    try {
      const url = new URL(jobUrl)
      const host = url.hostname.toLowerCase().replace(/^www\./, '')
      const parts = url.pathname.split('/').filter(Boolean)
      if (host === 'api.lever.co' && parts.length >= 3 && parts[0] === 'v0' && parts[1] === 'postings') return parts[2] + '.com'
      if (host.endsWith('lever.co') && parts[0]?.length > 1) return parts[0] + '.com'
      for (const ats of ATS_HOSTS) { if (host.endsWith(ats) || host === ats) { if (parts[0]?.length > 1) return parts[0] + '.com'; break } }
      if (!host.includes('linkedin.com') && !host.includes('indeed.com') && !host.includes('simplify.jobs')) return host
    } catch {}
  }
  return (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'
}

// Data row helper
function DataRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-xs font-semibold text-navy-500 w-28 shrink-0">{label}</span>
      <span className="text-xs text-navy-800 flex-1">{value}</span>
    </div>
  )
}

export default function CompanyIntelPopup({ company, jobUrl, description, onClose }) {
  const [intel, setIntel] = useState(null)
  const [articles, setArticles] = useState([])
  const [loadingIntel, setLoadingIntel] = useState(true)
  const [loadingNews, setLoadingNews] = useState(true)

  const companyDomain = companyDomainFromUrl(jobUrl, company)
  const linkedinUrl = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(company || '')}`

  useEffect(() => {
    if (!company) return

    // Fetch structured intel
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
      .then(data => setIntel(data.intel || data.summary || null))
      .catch(() => {})
      .finally(() => setLoadingIntel(false))

    // Fetch news
    newsApi.companyNews(company, jobUrl || '')
      .then(res => setArticles(res.data?.articles || []))
      .catch(() => {})
      .finally(() => setLoadingNews(false))
  }, [company])

  // Handle legacy string summaries (from cache) vs new structured intel
  const isStructured = intel && typeof intel === 'object'

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

            {/* Quick Links — always visible */}
            <div className="flex items-center gap-4">
              {companyDomain && (
                <a href={`https://${companyDomain}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1 font-medium">
                  <Globe size={12} /> Website
                </a>
              )}
              <a href={linkedinUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-sky-600 hover:text-sky-800 flex items-center gap-1 font-medium">
                <Linkedin size={12} /> LinkedIn
              </a>
            </div>

            {/* Structured Intel */}
            {loadingIntel ? (
              <div className="flex items-center gap-2 py-4 text-navy-400">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">Loading company intel...</span>
              </div>
            ) : isStructured ? (
              <div className="divide-y divide-navy-50">
                {/* One-liner */}
                {intel.one_liner && (
                  <p className="text-sm text-navy-700 leading-relaxed pb-3">{intel.one_liner}</p>
                )}

                {/* Key facts */}
                <div className="py-2">
                  <DataRow label="Industry" value={intel.industry} />
                  <DataRow label="Employee Count" value={intel.employee_count} />
                  <DataRow label="Founded" value={intel.founded} />
                  <DataRow label="HQ" value={intel.hq_location} />
                  <DataRow label="CEO / Founder" value={intel.ceo} />
                  <DataRow label="Total Raised" value={intel.total_raised} />
                </div>

                {/* Funding rounds */}
                {intel.funding_rounds && intel.funding_rounds.length > 0 && (
                  <div className="py-2">
                    <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1.5">Fundraising</p>
                    <ul className="space-y-1.5">
                      {intel.funding_rounds.map((r, i) => (
                        <li key={i} className="text-xs text-navy-700 leading-snug">
                          <span className="font-semibold">{r.round}</span>
                          {r.amount && <span>: {r.amount}</span>}
                          {r.investors && <span className="text-navy-500"> from {r.investors}</span>}
                          {r.date && <span className="text-navy-400"> ({r.date})</span>}
                          {r.valuation && <span className="text-navy-500"> &rarr; {r.valuation} valuation</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Notable facts */}
                {intel.notable_facts && intel.notable_facts.length > 0 && (
                  <div className="py-2">
                    <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1.5">Notable</p>
                    <ul className="space-y-1">
                      {intel.notable_facts.map((fact, i) => (
                        <li key={i} className="text-xs text-navy-600 leading-snug flex items-start gap-1.5">
                          <span className="text-navy-300 mt-0.5 shrink-0">•</span>
                          {fact}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : intel && typeof intel === 'string' ? (
              // Legacy fallback: plain text summary
              <div className="text-sm text-navy-700 leading-relaxed whitespace-pre-line">{intel}</div>
            ) : (
              <p className="text-xs text-navy-300 italic">No company data available</p>
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
