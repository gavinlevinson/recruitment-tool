import { useState, useEffect, useCallback, useRef, Component } from 'react'
import { useLocation } from 'react-router-dom'
import {
  RefreshCw, Search, ExternalLink, Check, ChevronDown, ChevronUp,
  Info, X, ChevronLeft, ChevronRight, SlidersHorizontal,
  Settings, Save, MapPin, AlertCircle, Loader2, Sparkles,
  User, Briefcase, Calendar, Mic, ArrowRight, Upload, Mail, FileText,
  Globe, TrendingUp,
} from 'lucide-react'
import { discoveredApi, preferencesApi, profileApi } from '../api'
import { formatDate, formatDateTime } from '../utils/dates'
import { useAuth } from '../context/AuthContext'
import OrionMark from '../components/OrionMark'

// ── Source badge metadata ─────────────────────────────────────────────────────
const SOURCE_META = [
  { match: 'greenhouse',       label: 'Greenhouse',      classes: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  { match: 'hn who',           label: "HN Who's Hiring", classes: 'bg-orange-100 text-orange-700 border border-orange-200' },
  { match: 'who is hiring',    label: "HN Who's Hiring", classes: 'bg-orange-100 text-orange-700 border border-orange-200' },
  { match: 'ali rohde',        label: 'Ali Rohde',       classes: 'bg-violet-100 text-violet-700 border border-violet-200' },
  { match: 'remote ok',        label: 'Remote OK',       classes: 'bg-cyan-100 text-cyan-700 border border-cyan-200' },
  { match: 'lever',            label: 'Lever',           classes: 'bg-teal-100 text-teal-700 border border-teal-200' },
  { match: 'linkedin',         label: 'LinkedIn',        classes: 'bg-sky-100 text-sky-700 border border-sky-200' },
  { match: 'wellfound',        label: 'Wellfound',       classes: 'bg-rose-100 text-rose-700 border border-rose-200' },
  { match: 'indeed',           label: 'Indeed',          classes: 'bg-blue-100 text-blue-700 border border-blue-200' },
  { match: 'ashby',            label: 'Ashby',           classes: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
  { match: 'remotive',         label: 'Remotive',        classes: 'bg-slate-100 text-slate-700 border border-slate-200' },
  { match: 'jobicy',           label: 'Jobicy',          classes: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200' },
  { match: 'yc',               label: 'YC Jobs',         classes: 'bg-orange-100 text-orange-700 border border-orange-200' },
  { match: 'handshake',        label: 'Handshake',       classes: 'bg-pink-100 text-pink-700 border border-pink-200' },
  { match: 'arbeitnow',        label: 'Arbeitnow',       classes: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  { match: 'we work remotely', label: 'We Work Remotely',classes: 'bg-green-100 text-green-700 border border-green-200' },
  { match: 'vc portfolio',     label: 'VC Portfolio',    classes: 'bg-lime-100 text-lime-700 border border-lime-200' },
  { match: 'topstartups',     label: 'TopStartups',     classes: 'bg-purple-100 text-purple-700 border border-purple-200' },
  { match: 'bessemer',        label: 'Bessemer',        classes: 'bg-blue-100 text-blue-700 border border-blue-200' },
  { match: 'index ventures',  label: 'Index Ventures',  classes: 'bg-amber-100 text-amber-700 border border-amber-200' },
  { match: 'general catalyst',label: 'General Catalyst',classes: 'bg-red-100 text-red-700 border border-red-200' },
  { match: 'techstars',       label: 'Techstars',       classes: 'bg-cyan-100 text-cyan-800 border border-cyan-200' },
  { match: 'simplify',        label: 'Simplify',        classes: 'bg-sky-100 text-sky-700 border border-sky-200' },
  { match: 'recently funded', label: 'Recently Funded', classes: 'bg-green-100 text-green-700 border border-green-200' },
  { match: 'ai operators',    label: 'AI Operators',    classes: 'bg-violet-100 text-violet-700 border border-violet-200' },
]

const ALL_SOURCES = [
  { id: 'hackernews', label: "HN Who's Hiring",     description: "Monthly thread from founders" },
  { id: 'ali_rohde',  label: 'Ali Rohde Newsletter', description: 'Chief of Staff, BizOps, VC' },
  { id: 'greenhouse', label: 'Greenhouse',           description: '50+ AI startup boards' },
  { id: 'lever',      label: 'Lever',                description: '10+ AI startup boards' },
  { id: 'ashby',      label: 'Ashby',                description: '35+ modern startup boards' },
  { id: 'remotive',   label: 'Remotive',             description: 'Remote jobs (free public API)' },
  { id: 'jobicy',     label: 'Jobicy',               description: 'Remote startup jobs (replaced Wellfound)' },
  { id: 'remoteok',   label: 'Remote OK',            description: 'Remote-first listings' },
  { id: 'wellfound',  label: 'Wellfound',            description: 'Startup jobs (AngelList)' },
  { id: 'yc_jobs',    label: 'YC Jobs',              description: 'Work at a Startup (YC)' },
  { id: 'arbeitnow',  label: 'Arbeitnow',            description: 'Global job board (free public API)' },
  { id: 'wwr',        label: 'We Work Remotely',     description: 'Business & product remote roles' },
  { id: 'vc_boards',      label: 'VC Portfolio',    description: 'a16z, Sequoia, Greylock & more' },
  { id: 'topstartups',   label: 'TopStartups',     description: 'Funded AI startups (topstartups.io)' },
]

const ALL_SOURCE_BADGES = [
  { id: 'hackernews', label: "HN Who's Hiring", classes: 'bg-orange-100 text-orange-700 border border-orange-200' },
  { id: 'ali_rohde',  label: 'Ali Rohde',       classes: 'bg-violet-100 text-violet-700 border border-violet-200' },
  { id: 'greenhouse', label: 'Greenhouse',      classes: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  { id: 'remoteok',   label: 'Remote OK',       classes: 'bg-cyan-100 text-cyan-700 border border-cyan-200' },
  { id: 'lever',      label: 'Lever',           classes: 'bg-teal-100 text-teal-700 border border-teal-200' },
  { id: 'wellfound',  label: 'Wellfound',       classes: 'bg-rose-100 text-rose-700 border border-rose-200' },
  { id: 'linkedin',   label: 'LinkedIn',        classes: 'bg-sky-100 text-sky-700 border border-sky-200' },
  { id: 'indeed',     label: 'Indeed',          classes: 'bg-blue-100 text-blue-700 border border-blue-200' },
  { id: 'ashby',      label: 'Ashby',           classes: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
  { id: 'remotive',   label: 'Remotive',        classes: 'bg-slate-100 text-slate-700 border border-slate-200' },
  { id: 'jobicy',     label: 'Jobicy',          classes: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200' },
  { id: 'yc_jobs',    label: 'YC Jobs',         classes: 'bg-orange-100 text-orange-700 border border-orange-200' },
  { id: 'arbeitnow',  label: 'Arbeitnow',       classes: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  { id: 'wwr',        label: 'We Work Remotely',classes: 'bg-green-100 text-green-700 border border-green-200' },
  { id: 'vc_boards',  label: 'VC Portfolio',    classes: 'bg-lime-100 text-lime-700 border border-lime-200' },
  { id: 'topstartups', label: 'TopStartups',   classes: 'bg-purple-100 text-purple-700 border border-purple-200' },
]

const PAGE_SIZE = 30

// Role chip labels → expanded keyword sets for backend matching
const ROLE_CHIP_KEYWORDS = {
  'Engineering': ['engineer', 'developer', 'software', 'devops', 'swe', 'ml', 'technical', 'infrastructure', 'data engineer', 'backend', 'frontend', 'fullstack', 'full stack'],
  'Revenue':     ['sales', 'account executive', 'revenue', 'business development', 'partnerships', 'customer success', 'account manager', 'bd', 'closing'],
  'Operations':  ['operations', 'ops', 'bizops', 'biz ops', 'revops', 'special projects', 'chief of staff', 'program manager', 'implementation', 'process', 'logistics'],
  'Strategy':    ['strategy', 'strategic', 'chief of staff', 'special projects', 'consulting', 'corporate development', 'corp dev'],
  'Research':    ['research', 'analyst', 'data analyst', 'market research', 'policy', 'insights', 'intelligence', 'scientist'],
  'Growth':      ['growth', 'marketing', 'go-to-market', 'gtm', 'product marketing', 'demand gen', 'content', 'acquisition', 'seo', 'performance marketing'],
  'Undefined':   ['__undefined__'],  // sentinel — backend handles specially
}

function getSourceMeta(source) {
  if (!source) return { label: 'Unknown', classes: 'bg-slate-100 text-slate-600 border border-slate-200' }
  const src = source.toLowerCase()

  // VC Portfolio sources are stored as "VC Portfolio (FirmName)" — extract the firm name
  const vcMatch = source.match(/^VC Portfolio \((.+?)\)$/i)
  if (vcMatch) {
    return { label: vcMatch[1], classes: 'bg-lime-100 text-lime-700 border border-lime-200' }
  }

  return (
    SOURCE_META.find(m => src.includes(m.match)) ||
    { label: source, classes: 'bg-slate-100 text-slate-600 border border-slate-200' }
  )
}

// ── Module-level caches ───────────────────────────────────────────────────────
const _companySummaryCache = {}  // company name → summary string

// Detect generic career page URLs (not a specific job posting)
function isGenericCareerUrl(url) {
  if (!url) return false
  try {
    const path = new URL(url).pathname.replace(/\/$/, '')
    return /\/(careers?|jobs?|openings|positions|apply|join|work-with-us|work|join-us)$/.test(path)
  } catch { return false }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function MatchBar({ score }) {
  const pct = Math.max(0, Math.min(100, score || 0))
  const barColor = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-slate-300'
  const pillClass = pct >= 70 ? 'match-high' : pct >= 40 ? 'match-medium' : 'match-low'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-navy-400 font-medium">Match Score</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${pillClass}`}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full bg-navy-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Toggle({ value, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
          value ? 'bg-violet-DEFAULT' : 'bg-navy-200'
        }`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform duration-200 ${
          value ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </button>
      <span className="text-sm text-navy-600">{label}</span>
    </label>
  )
}

// ── Work type detection ───────────────────────────────────────────────────────
function getWorkType(job) {
  const text = ((job.location || '') + ' ' + (job.description || '')).toLowerCase()
  if (text.includes('hybrid')) return 'Hybrid'
  if (text.includes('remote')) return 'Remote'
  if (
    text.includes('in-office') || text.includes('in office') ||
    text.includes('onsite') || text.includes('on-site') || text.includes('on site')
  ) return 'In-Office'
  return null
}

const WORK_TYPE_CLASSES = {
  Remote:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  Hybrid:     'bg-sky-50 text-sky-700 border-sky-200',
  'In-Office': 'bg-amber-50 text-amber-700 border-amber-200',
}

// ── Experience requirement extractor ─────────────────────────────────────────
function getExpRequired(description) {
  if (!description) return null
  const m = description.match(/(\d+)\+?\s*(?:to\s*\d+\s*)?years?\s+(?:of\s+)?(?:relevant\s+)?(?:work\s+)?experience/i)
  if (m) return `${m[1]}+ yrs exp required`
  if (/entry.?level|no experience required|0.?year/i.test(description)) return 'Entry-level'
  return null
}

// ── Company Jobs Popup Modal ───────────────────────────────────────────────────
// ── Multi-job prompt modal ────────────────────────────────────────────────────
function MultiJobPrompt({ type, company, otherCount, onConfirm, onCancel }) {
  // type: 'add' | 'dismiss'
  const isAdd = type === 'add'
  return (
    <>
      <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-[60]" onClick={onCancel} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-navy-900">
              {isAdd ? `${otherCount} other role${otherCount !== 1 ? 's' : ''} at ${company}` : `Multiple jobs at ${company}`}
            </h3>
            <p className="text-sm text-navy-500 mt-1">
              {isAdd
                ? `Keep the remaining ${otherCount} role${otherCount !== 1 ? 's' : ''} in your Discovery feed?`
                : 'Do you want to remove just this posting, or all jobs at this company?'}
            </p>
          </div>
          <div className="flex gap-2">
            {isAdd ? (
              <>
                <button onClick={() => onConfirm('keep')} className="flex-1 btn-primary justify-center text-sm">Keep them</button>
                <button onClick={() => onConfirm('remove_all')} className="flex-1 btn-secondary justify-center text-sm text-red-600 border-red-200 hover:bg-red-50">Remove all</button>
              </>
            ) : (
              <>
                <button onClick={() => onConfirm('just_this')} className="flex-1 btn-secondary justify-center text-sm">Just this one</button>
                <button onClick={() => onConfirm('remove_all')} className="flex-1 btn-secondary justify-center text-sm text-red-600 border-red-200 hover:bg-red-50">All at {company}</button>
              </>
            )}
          </div>
          <button onClick={onCancel} className="w-full text-xs text-navy-400 hover:text-navy-600 text-center">Cancel</button>
        </div>
      </div>
    </>
  )
}

function CompanyJobsModal({ company, filterParams, onClose, onAddToTracker, onDismiss }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    discoveredApi.getAll({
      ...filterParams,
      company_filter: company,
      is_active: true,
      limit: 50,
      offset: 0,
    }).then(res => {
      const data = res.data
      const list = Array.isArray(data) ? data : (data?.jobs || [])
      setJobs(list)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [company]) // eslint-disable-line

  const handleLocalAdd = async (job) => {
    setJobs(prev => prev.filter(j => j.id !== job.id))
    await onAddToTracker(job, { skipPrompt: true })
  }

  const handleLocalDismiss = async (job) => {
    setJobs(prev => prev.filter(j => j.id !== job.id))
    await onDismiss(job, { skipPrompt: true })
  }

  return (
    <>
      <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-navy-100">
            <div>
              <h2 className="text-lg font-bold text-navy-900">All jobs at {company}</h2>
              {!loading && (
                <p className="text-xs text-navy-400 mt-0.5">
                  {jobs.length} {jobs.length === 1 ? 'role' : 'roles'} matching your preferences
                </p>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-100 transition-colors">
              <X size={18} />
            </button>
          </div>
          {/* Body */}
          <div className="overflow-y-auto flex-1 p-4">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-navy-400 gap-2">
                <RefreshCw size={18} className="animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-navy-400">
                <Search size={32} className="text-navy-200" />
                <p className="text-sm font-medium text-navy-600">No other jobs found at {company}</p>
                <p className="text-xs">matching your current filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {jobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onAddToTracker={handleLocalAdd}
                    onDismiss={handleLocalDismiss}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Company logo helper ──────────────────────────────────────────────────────
const ATS_HOSTS = ['lever.co', 'greenhouse.io', 'ashbyhq.com', 'ashby.io', 'workable.com', 'boards.greenhouse.io', 'job-boards.greenhouse.io', 'job-boards.eu.greenhouse.io']

function companyDomainFromUrl(jobUrl, companyName) {
  // Try to extract the real company domain from the job URL
  if (jobUrl) {
    try {
      const url = new URL(jobUrl)
      const host = url.hostname.toLowerCase().replace(/^www\./, '')
      const parts = url.pathname.split('/').filter(Boolean)

      // Lever API URLs: api.lever.co/v0/postings/{company}/...
      if (host === 'api.lever.co' && parts.length >= 3 && parts[0] === 'v0' && parts[1] === 'postings') {
        return parts[2] + '.com'
      }
      // Lever hosted URLs: jobs.lever.co/{company}/...
      if (host.endsWith('lever.co')) {
        if (parts[0] && parts[0].length > 1) return parts[0] + '.com'
      }
      // Other ATS URLs: extract company slug from first path segment
      for (const ats of ATS_HOSTS) {
        if (host.endsWith(ats) || host === ats) {
          if (parts[0] && parts[0].length > 1) return parts[0] + '.com'
          break
        }
      }
      // Non-ATS, non-social: use the hostname directly
      if (!host.includes('linkedin.com') && !host.includes('indeed.com') && !host.includes('simplify.jobs')) {
        return host
      }
    } catch {}
  }
  // Fallback: guess from company name
  return (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'
}

function companyLogoUrl(jobUrl, companyName) {
  return `https://logo.clearbit.com/${companyDomainFromUrl(jobUrl, companyName)}`
}
function companyFaviconUrl(jobUrl, companyName) {
  return `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${companyDomainFromUrl(jobUrl, companyName)}&size=64`
}

// Extract a company blurb from job description
function extractCompanyBlurb(description) {
  if (!description) return null
  // Strip residual HTML
  let text = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return null
  // Skip HN-style "Company | Role | Location" prefix before the actual description
  // e.g. "Anthropic | Engineer | NYC We build AI safety..."
  const pipeIdx = text.indexOf(' | ')
  if (pipeIdx !== -1 && pipeIdx < 80) {
    // Skip past "Company | Role | Location " prefix by finding a capital letter after a pipe-delimited section
    const afterPipes = text.replace(/^[^|]+(\|[^|]+){1,3}\s*\|\s*/, '')
    if (afterPipes.length > 50) text = afterPipes
  }
  // Take up to 2 sentences (~220 chars)
  const excerpt = text.substring(0, 240)
  const secondPeriod = (() => {
    const first = excerpt.indexOf('. ')
    if (first === -1) return -1
    return excerpt.indexOf('. ', first + 2)
  })()
  if (secondPeriod > 40) return excerpt.substring(0, secondPeriod + 1)
  const firstPeriod = excerpt.indexOf('. ')
  if (firstPeriod > 40) return excerpt.substring(0, firstPeriod + 1)
  return excerpt + (text.length > 240 ? '…' : '')
}

// ── Job Card ──────────────────────────────────────────────────────────────────
function JobCard({ job, onAddToTracker, onDismiss, onShowCompanyJobs }) {
  const isAdded = job.added_to_tracker
  const sourceMeta = getSourceMeta(job.source)

  // Logo: Clearbit → Google favicon → colored initial
  const [logoLevel, setLogoLevel] = useState(0) // 0=clearbit, 1=google, 2=initial
  const logoSrc = logoLevel === 0 ? companyLogoUrl(job.job_url, job.company) : companyFaviconUrl(job.job_url, job.company)
  const logoFailed = logoLevel >= 2

  // Company description popup — AI-generated, lazily fetched, cached per company
  const [showDesc, setShowDesc] = useState(false)
  const [companyBlurb, setCompanyBlurb] = useState(() => {
    // Seed from module-level cache immediately if already fetched
    return _companySummaryCache[job.company?.toLowerCase()] || null
  })
  const [blurbLoading, setBlurbLoading] = useState(false)
  const [blurbError, setBlurbError] = useState(null)

  const handleDescClick = async (e) => {
    e.stopPropagation()
    const next = !showDesc
    setShowDesc(next)
    if (!next) return // closing — no need to fetch

    const cacheKey = (job.company || '').toLowerCase()
    // Already have it
    if (_companySummaryCache[cacheKey]) {
      setCompanyBlurb(_companySummaryCache[cacheKey])
      return
    }
    // Fetch from AI
    setBlurbLoading(true)
    setBlurbError(null)
    try {
      const res = await discoveredApi.companySummary(job.company, job.description)
      const summary = res.data?.summary || ''
      _companySummaryCache[cacheKey] = summary
      setCompanyBlurb(summary)
    } catch {
      setBlurbError('Could not load company info.')
    } finally {
      setBlurbLoading(false)
    }
  }

  const postedDate = (job.posted_date || job.date_found)
    ? formatDate(job.posted_date || job.date_found, { month: 'short', day: 'numeric', year: undefined })
    : null

  const workType = getWorkType(job)
  const expRequired = getExpRequired(job.description)
  const genericUrl = isGenericCareerUrl(job.job_url)

  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-matte-md transition-shadow duration-200">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {!logoFailed ? (
            <img
              src={logoSrc}
              alt={job.company}
              onError={() => setLogoLevel(prev => prev + 1)}
              className="w-8 h-8 rounded-lg object-contain shrink-0 border border-navy-100 bg-white p-0.5"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center shrink-0 text-xs font-bold text-navy-400">
              {(job.company || '?')[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-bold text-navy-900 truncate">{job.company || 'Unknown Company'}</h3>
              <button
                onClick={handleDescClick}
                title="About this company"
                className="shrink-0 text-navy-300 hover:text-violet-500 transition-colors"
              >
                <Info size={13} />
              </button>
            </div>
            <p className="text-sm text-navy-600 mt-0.5 leading-snug line-clamp-2">{job.role || 'Role TBD'}</p>
          </div>
        </div>
        <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sourceMeta.classes}`}>
          {sourceMeta.label}
        </span>
      </div>

      {/* Company description popup */}
      {showDesc && (
        <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-xs text-navy-600 leading-relaxed">
          {blurbLoading ? (
            <span className="flex items-center gap-1.5 text-navy-400">
              <Loader2 size={11} className="animate-spin" />
              Generating company summary…
            </span>
          ) : blurbError ? (
            <span className="text-red-400">{blurbError}</span>
          ) : (
            companyBlurb || 'No description available.'
          )}
        </div>
      )}

      {/* Location + work type */}
      <div className="flex flex-wrap items-center gap-2">
        {job.location && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-navy-200 text-navy-600 bg-white max-w-[220px] truncate">
            {job.location}
          </span>
        )}
        {workType && !(job.location || '').toLowerCase().includes(workType.toLowerCase()) && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${WORK_TYPE_CLASSES[workType]}`}>
            {workType}
          </span>
        )}
        {postedDate && (
          <span className="text-xs text-navy-400">{postedDate}</span>
        )}
      </div>

      {/* Company metadata */}
      <div className="flex flex-wrap items-center gap-2">
        {job.salary_range && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            {job.salary_range}
          </span>
        )}
        {job.funding_stage && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            {job.funding_stage}
          </span>
        )}
        {job.recently_funded && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            {job.funding_amount ? `Raised ${job.funding_amount}` : 'Recently Funded'}
          </span>
        )}
        {job.employee_count && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            {job.employee_count} employees
          </span>
        )}
        {expRequired && (
          <span className="text-xs text-navy-400 font-medium">{expRequired}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 mt-auto border-t border-navy-50">
        {job.job_url && (
          <div className="flex flex-col gap-0.5">
            <a
              href={job.job_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary py-1.5 text-xs"
            >
              <ExternalLink size={13} />
              View Job
            </a>
            {genericUrl && (
              <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                <AlertCircle size={9} /> General careers page
              </span>
            )}
          </div>
        )}

        <button
          onClick={() => onDismiss(job)}
          className="p-1.5 rounded-lg text-navy-300 hover:text-red-400 hover:bg-red-50 transition-colors"
          title="Not interested"
        >
          <X size={14} />
        </button>

        {isAdded ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 ml-auto">
            <Check size={13} />
            Added
          </span>
        ) : (
          <button onClick={() => onAddToTracker(job)} className="btn-accent py-1.5 text-xs ml-auto">
            <Check size={13} /> Add to Tracker
          </button>
        )}
      </div>

      {/* Deadline warning */}
      {job.deadline && (() => {
        const [y,m,d] = job.deadline.split('-').map(Number)
        const dt = new Date(y, m-1, d)
        const today = new Date(); today.setHours(0,0,0,0)
        const delta = Math.round((dt - today) / 86400000)
        if (delta > 7 || delta < 0) return null
        return (
          <p className="text-xs font-semibold text-red-600 flex items-center gap-1 pt-1 border-t border-navy-50">
            <span>⚠</span>
            {delta === 0 ? 'Deadline today!' : `Deadline in ${delta} day${delta === 1 ? '' : 's'}`}
          </p>
        )
      })()}

      {/* Other jobs at this company */}
      {job.other_jobs_count > 0 && onShowCompanyJobs && (
        <button
          onClick={() => onShowCompanyJobs(job.company, job.other_jobs_count)}
          className="w-full text-left text-xs text-violet-600 hover:text-violet-800 font-medium pt-1 border-t border-navy-50 hover:underline transition-colors"
        >
          See {job.other_jobs_count} other {job.other_jobs_count === 1 ? 'job' : 'jobs'} at {job.company} →
        </button>
      )}
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null
  const pages = []
  const start = Math.max(1, page - 2)
  const end = Math.min(totalPages, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        className="p-1.5 rounded-lg hover:bg-navy-100 disabled:opacity-30 disabled:cursor-not-allowed text-navy-600 transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      {start > 1 && (
        <>
          <button onClick={() => onPage(1)} className="w-8 h-8 rounded-lg text-xs font-medium text-navy-600 hover:bg-navy-100 transition-colors">1</button>
          {start > 2 && <span className="text-navy-400 text-xs px-1">…</span>}
        </>
      )}
      {pages.map(p => (
        <button
          key={p}
          onClick={() => onPage(p)}
          className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
            p === page
              ? 'bg-violet-DEFAULT text-white'
              : 'text-navy-600 hover:bg-navy-100'
          }`}
        >
          {p}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-navy-400 text-xs px-1">…</span>}
          <button onClick={() => onPage(totalPages)} className="w-8 h-8 rounded-lg text-xs font-medium text-navy-600 hover:bg-navy-100 transition-colors">{totalPages}</button>
        </>
      )}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        className="p-1.5 rounded-lg hover:bg-navy-100 disabled:opacity-30 disabled:cursor-not-allowed text-navy-600 transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

// ── Add Job from URL ──────────────────────────────────────────────────────────
function AddFromUrlCard({ onAdded }) {
  const [url, setUrl]           = useState('')
  const [company, setCompany]   = useState('')
  const [role, setRole]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(null)
  const [expanded, setExpanded] = useState(false)

  const handleSubmit = async () => {
    const trimmed = url.trim()
    if (!trimmed) { setError('Paste a job URL first.'); return }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await discoveredApi.addFromUrl({ url: trimmed, company: company.trim(), role: role.trim() })
      const { job, folder } = res.data
      setSuccess(`Added "${job.role}" at ${job.company} → ${folder}`)
      setUrl(''); setCompany(''); setRole('')
      onAdded?.()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not parse that URL. Try adding company/role manually below.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-navy-700 hover:bg-navy-50/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <ExternalLink size={15} className="text-violet-DEFAULT" />
          Add a job from any URL
        </span>
        {expanded ? <ChevronUp size={15} className="text-navy-400" /> : <ChevronDown size={15} className="text-navy-400" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-navy-50 space-y-3">
          <p className="text-xs text-navy-400 leading-relaxed">
            Paste any job posting link — we'll extract the details and add it straight to your tracker.
          </p>
          <input
            className="input text-sm w-full"
            placeholder="https://jobs.company.com/posting/12345"
            value={url}
            onChange={e => { setUrl(e.target.value); setError(null) }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input text-sm"
              placeholder="Company (optional)"
              value={company}
              onChange={e => setCompany(e.target.value)}
            />
            <input
              className="input text-sm"
              placeholder="Role (optional)"
              value={role}
              onChange={e => setRole(e.target.value)}
            />
          </div>
          <p className="text-[10px] text-navy-400">Fill in company/role if auto-detection misses them.</p>
          <button
            onClick={handleSubmit}
            disabled={loading || !url.trim()}
            className="btn-primary w-full justify-center"
          >
            {loading ? <><Loader2 size={13} className="animate-spin" /> Fetching…</> : <><Check size={13} /> Add to Tracker</>}
          </button>
          {error   && <p className="text-xs text-red-500 leading-relaxed">{error}</p>}
          {success && <p className="text-xs text-emerald-600 font-medium">{success}</p>}
        </div>
      )}
    </div>
  )
}

// ── Dismissed Jobs Panel ──────────────────────────────────────────────────────
function DismissedJobsPanel({ onRestore }) {
  const [open, setOpen]           = useState(false)
  const [jobs, setJobs]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [restoring, setRestoring] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await discoveredApi.getDismissed()
      setJobs(res.data?.jobs || [])
    } catch (e) { console.error('[loadDismissed]', e) }
    finally { setLoading(false) }
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && jobs.length === 0) load()
  }

  const restore = async (job) => {
    setRestoring(job.id)
    try {
      await discoveredApi.update(job.id, { is_active: true })
      setJobs(prev => prev.filter(j => j.id !== job.id))
      onRestore?.()
    } catch (e) { console.error('[restoreDismissed]', e) }
    finally { setRestoring(null) }
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-navy-600 hover:bg-navy-50/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <X size={15} className="text-red-400" />
          Recently dismissed jobs
          {jobs.length > 0 && !loading && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-semibold">{jobs.length}</span>
          )}
        </span>
        {open ? <ChevronUp size={15} className="text-navy-400" /> : <ChevronDown size={15} className="text-navy-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-navy-50 space-y-3">
          <p className="text-xs text-navy-400">Jobs you dismissed in the last 30 days. Restore any you'd like to revisit.</p>
          {loading ? (
            <div className="flex items-center gap-2 text-navy-400 text-sm py-4 justify-center">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-xs text-navy-300 italic py-4 text-center">No dismissed jobs in the last 30 days.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {jobs.map(job => (
                <div key={job.id} className="flex items-center justify-between gap-3 bg-navy-50 rounded-lg px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-navy-800 truncate">{job.company}</p>
                    <p className="text-xs text-navy-500 truncate">{job.role}</p>
                  </div>
                  <button
                    onClick={() => restore(job)}
                    disabled={restoring === job.id}
                    className="shrink-0 text-xs font-medium text-violet-600 hover:text-violet-800 border border-violet-200 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {restoring === job.id ? '…' : 'Restore'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── How It Works ──────────────────────────────────────────────────────────────
function HowItWorks() {
  const [open, setOpen] = useState(false)
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-navy-600 hover:bg-navy-50/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Info size={15} className="text-violet-DEFAULT" />
          How the agent works
        </span>
        {open ? <ChevronUp size={15} className="text-navy-400" /> : <ChevronDown size={15} className="text-navy-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-navy-50">
          <p className="text-sm text-navy-500 leading-relaxed">
            The agent scrapes <strong className="text-navy-700">16+ sources</strong>: HN Who&apos;s Hiring, Ali Rohde&apos;s newsletter, Greenhouse, Lever, Ashby, Workable, Remote OK, Wellfound, the full <strong className="text-navy-700">YC company directory (~4,000+ companies)</strong>, Himalayas, We Work Remotely, VC job boards, VC portfolio pages (a16z, Sequoia, Founders Fund, GV, Greylock, Lightspeed), TopStartups.io, Forbes Best Startup Employers, and LinkedIn Top 50 Startups. LinkedIn &amp; Indeed available via Apify. Jobs are scored 0&ndash;100 based on <strong className="text-navy-700">your target roles, location preferences, and skill overlap</strong> from your resume. Upload your resume in Profile to enable personalized scoring.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Preferences Panel ─────────────────────────────────────────────────────────
const ALL_LOCATIONS = ['NYC', 'SF', 'Boston', 'Chicago', 'LA', 'DC', 'Seattle', 'Austin', 'Remote']

function PreferencesPanel({ open, onClose, preferences, onSave }) {
  const [local, setLocal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [rescoring, setRescoring] = useState(false)
  const [saved, setSaved] = useState(false)
  const [customLocInput, setCustomLocInput] = useState('')

  useEffect(() => {
    if (open && preferences) {
      setLocal({
        locations: [...(preferences.locations || [])],
        funding_stages: [...(preferences.funding_stages || [])],
        employee_ranges: [...(preferences.employee_ranges || [])],
        enabled_sources: preferences.enabled_sources !== undefined ? preferences.enabled_sources : null,
        preferred_roles: preferences.preferred_roles !== undefined ? preferences.preferred_roles : null,
        preferred_work_types: preferences.preferred_work_types !== undefined ? preferences.preferred_work_types : null,
        years_experience: preferences.years_experience || null,
        min_salary: preferences.min_salary || null,
        preferred_industries: preferences.preferred_industries !== undefined ? preferences.preferred_industries : null,
      })
      setSaved(false)
      setCustomLocInput('')
    }
  }, [open, preferences])

  const addCustomLocation = () => {
    const trimmed = customLocInput.trim()
    if (!trimmed || local.locations.includes(trimmed)) { setCustomLocInput(''); return }
    setLocal(prev => ({ ...prev, locations: [...prev.locations, trimmed] }))
    setCustomLocInput('')
  }

  if (!open || !local) return null

  const toggle = (key, val) => {
    setLocal(prev => {
      const arr = prev[key]
      return {
        ...prev,
        [key]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val],
      }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await preferencesApi.update(local)
      await onSave(local)
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleRescore = async () => {
    setRescoring(true)
    try {
      await preferencesApi.rescore()
      setTimeout(() => setRescoring(false), 3000)
    } catch (e) {
      console.error(e)
      setRescoring(false)
    }
  }


  const CheckOption = ({ label, checked, onChange }) => (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <button
        type="button"
        onClick={onChange}
        className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-colors ${
          checked ? 'bg-violet-600 border-violet-600' : 'border-navy-300 group-hover:border-violet-400'
        }`}
        style={{ width: 18, height: 18, minWidth: 18 }}
      >
        {checked && <Check size={11} className="text-white" />}
      </button>
      <span className="text-sm text-navy-700">{label}</span>
    </label>
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-navy-900/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy-100 bg-navy-50/50">
          <h2 className="text-base font-semibold text-navy-900 flex items-center gap-2">
            <Settings size={16} className="text-violet-600" />
            Preferences
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Location */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide">Location</p>
              {local.locations.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setLocal(prev => ({ ...prev, locations: [] }))}
                  className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
                >
                  Show All
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  <Check size={10} /> All locations
                </span>
              )}
            </div>
            <p className="text-xs text-navy-400 mb-3">Select your preferred cities, or show all</p>
            <div className="space-y-2">
              {ALL_LOCATIONS.map(loc => (
                <CheckOption
                  key={loc}
                  label={loc}
                  checked={local.locations.includes(loc)}
                  onChange={() => toggle('locations', loc)}
                />
              ))}
            </div>

            {/* Custom location input */}
            <div className="mt-3">
              <p className="text-xs text-navy-400 mb-2">Add a city or country not listed above:</p>
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-sm py-1.5"
                  placeholder="e.g. Paris, London, Austin TX…"
                  value={customLocInput}
                  onChange={e => setCustomLocInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomLocation() } }}
                />
                <button
                  type="button"
                  onClick={addCustomLocation}
                  disabled={!customLocInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium disabled:opacity-40 hover:bg-violet-700 transition-colors"
                >
                  Add
                </button>
              </div>
              {/* Show custom locations (not in the preset list) */}
              {local.locations.filter(l => !ALL_LOCATIONS.includes(l)).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {local.locations.filter(l => !ALL_LOCATIONS.includes(l)).map(loc => (
                    <span key={loc} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-50 text-violet-700 border border-violet-200">
                      {loc}
                      <button
                        onClick={() => setLocal(prev => ({ ...prev, locations: prev.locations.filter(l => l !== loc) }))}
                        className="hover:text-violet-900"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Funding Stage */}
          <div>
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-1">Funding Stage</p>
            <p className="text-xs text-navy-400 mb-3">Target company stages</p>
            <div className="space-y-2">
              {['Seed', 'Series A', 'Series B', 'Series C+'].map(stage => (
                <CheckOption
                  key={stage}
                  label={stage}
                  checked={local.funding_stages.includes(stage)}
                  onChange={() => toggle('funding_stages', stage)}
                />
              ))}
            </div>
          </div>

          {/* Company Size */}
          <div>
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-1">Company Size</p>
            <p className="text-xs text-navy-400 mb-3">Target company size (employees)</p>
            <div className="space-y-2">
              {['1-50', '50-200', '200-500', '500+'].map(range => (
                <CheckOption
                  key={range}
                  label={`${range} employees`}
                  checked={local.employee_ranges.includes(range)}
                  onChange={() => toggle('employee_ranges', range)}
                />
              ))}
            </div>
          </div>

          {/* Years of Experience */}
          <div>
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-1">Your Experience Level</p>
            <p className="text-xs text-navy-400 mb-3">Hide jobs that require more experience than you have</p>
            <div className="flex rounded-lg border border-navy-200 overflow-hidden">
              {['0+', '1-2', '3-5', '5-10', '10+'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setLocal(prev => ({ ...prev, years_experience: prev.years_experience === opt ? null : opt }))}
                  className={`flex-1 px-1 py-2 text-xs font-semibold transition-colors ${
                    local.years_experience === opt
                      ? 'bg-violet-600 text-white'
                      : 'bg-white text-navy-600 hover:bg-navy-50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {local.years_experience && (
              <p className="text-xs text-navy-400 mt-2">
                Showing jobs requiring ≤ {local.years_experience === '10+' ? 'any' : local.years_experience} yrs exp
              </p>
            )}
          </div>

          {/* Minimum Salary */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide">Minimum Salary</p>
              {local.min_salary && (
                <button
                  type="button"
                  onClick={() => setLocal(prev => ({ ...prev, min_salary: null }))}
                  className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs text-navy-400 mb-3">Jobs without salary info are always shown</p>
            <input
              type="range"
              min={0} max={200} step={10}
              value={local.min_salary || 0}
              onChange={e => {
                const v = parseInt(e.target.value)
                setLocal(prev => ({ ...prev, min_salary: v === 0 ? null : v }))
              }}
              className="w-full accent-violet-600"
            />
            <p className="text-sm font-semibold text-navy-700 mt-1">
              {local.min_salary ? `$${local.min_salary}k+` : 'No minimum'}
            </p>
          </div>

          {/* Industry */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide">Industry</p>
              {(() => {
                const ALL_INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Education', 'Retail & E-Commerce', 'Media & Entertainment', 'Manufacturing', 'Government & Nonprofit', 'Other']
                const indArr = local.preferred_industries === null
                  ? ALL_INDUSTRIES
                  : (local.preferred_industries || [])
                const allOn = indArr.length === ALL_INDUSTRIES.length
                return (
                  <button
                    type="button"
                    onClick={() => setLocal(prev => ({
                      ...prev,
                      preferred_industries: allOn ? [] : null,
                    }))}
                    className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
                  >
                    {allOn ? 'Deselect All' : 'Select All'}
                  </button>
                )
              })()}
            </div>
            <p className="text-xs text-navy-400 mb-3">Filter by industry (deselect all = show all)</p>
            <div className="space-y-2">
              {['Technology', 'Finance', 'Healthcare', 'Education', 'Retail & E-Commerce', 'Media & Entertainment', 'Manufacturing', 'Government & Nonprofit', 'Other'].map(ind => {
                const ALL_INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Education', 'Retail & E-Commerce', 'Media & Entertainment', 'Manufacturing', 'Government & Nonprofit', 'Other']
                const indArr = local.preferred_industries === null
                  ? ALL_INDUSTRIES
                  : (local.preferred_industries || [])
                const toggleInd = () => {
                  const next = indArr.includes(ind) ? indArr.filter(i => i !== ind) : [...indArr, ind]
                  setLocal(prev => ({ ...prev, preferred_industries: next.length === ALL_INDUSTRIES.length ? null : next }))
                }
                return (
                  <CheckOption
                    key={ind}
                    label={ind}
                    checked={indArr.includes(ind)}
                    onChange={toggleInd}
                  />
                )
              })}
            </div>
          </div>

          {/* Role Type */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide">Role Type</p>
              {(() => {
                const ALL_ROLE_TYPES = ['Engineering', 'Revenue', 'Operations', 'Strategy', 'Research', 'Growth', 'Undefined']
                const roleArr = local.preferred_roles === null
                  ? ALL_ROLE_TYPES
                  : (local.preferred_roles || [])
                const allOn = roleArr.length === ALL_ROLE_TYPES.length
                return (
                  <button
                    type="button"
                    onClick={() => setLocal(prev => ({
                      ...prev,
                      preferred_roles: allOn ? [] : null,
                    }))}
                    className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
                  >
                    {allOn ? 'Deselect All' : 'Select All'}
                  </button>
                )
              })()}
            </div>
            <p className="text-xs text-navy-400 mb-3">Filter by role category (deselect all = show all)</p>
            <div className="space-y-2">
              {['Engineering', 'Revenue', 'Operations', 'Strategy', 'Research', 'Growth', 'Undefined'].map(role => {
                const ALL_ROLE_TYPES = ['Engineering', 'Revenue', 'Operations', 'Strategy', 'Research', 'Growth', 'Undefined']
                const roleArr = local.preferred_roles === null
                  ? ALL_ROLE_TYPES
                  : (local.preferred_roles || [])
                const toggleRole = () => {
                  const next = roleArr.includes(role) ? roleArr.filter(r => r !== role) : [...roleArr, role]
                  setLocal(prev => ({ ...prev, preferred_roles: next.length === ALL_ROLE_TYPES.length ? null : next }))
                }
                return (
                  <CheckOption
                    key={role}
                    label={role === 'Undefined' ? 'Undefined (other roles)' : role}
                    checked={roleArr.includes(role)}
                    onChange={toggleRole}
                  />
                )
              })}
            </div>
          </div>

          {/* Work Type */}
          <div>
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-1">Work Type</p>
            <p className="text-xs text-navy-400 mb-3">Remote, hybrid, or in-office</p>
            <div className="space-y-2">
              {['Remote', 'Hybrid', 'In-Office'].map(wt => {
                const wtArr = local.preferred_work_types === null
                  ? ['Remote', 'Hybrid', 'In-Office']
                  : (local.preferred_work_types || [])
                const toggleWT = () => {
                  const next = wtArr.includes(wt) ? wtArr.filter(w => w !== wt) : [...wtArr, wt]
                  setLocal(prev => ({ ...prev, preferred_work_types: next.length === 3 ? null : next }))
                }
                return (
                  <CheckOption key={wt} label={wt} checked={wtArr.includes(wt)} onChange={toggleWT} />
                )
              })}
            </div>
          </div>

          {/* Sources */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide">Sources</p>
              {(() => {
                const enabledArr = local.enabled_sources === null
                  ? ALL_SOURCES.map(s => s.id)
                  : (local.enabled_sources || ALL_SOURCES.map(s => s.id))
                const allOn = enabledArr.length === ALL_SOURCES.length
                return (
                  <button
                    type="button"
                    onClick={() => setLocal(prev => ({
                      ...prev,
                      enabled_sources: allOn ? [] : null,
                    }))}
                    className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
                  >
                    {allOn ? 'Deselect All' : 'Select All'}
                  </button>
                )
              })()}
            </div>
            <p className="text-xs text-navy-400 mb-3">Toggle which job boards are included</p>
            <div className="space-y-1">
              {ALL_SOURCES.map(source => {
                const enabledArr = local.enabled_sources === null
                  ? ALL_SOURCES.map(s => s.id)
                  : (local.enabled_sources || ALL_SOURCES.map(s => s.id))
                const isOn = enabledArr.includes(source.id)
                const toggleSource = () => {
                  const next = isOn
                    ? enabledArr.filter(id => id !== source.id)
                    : [...enabledArr, source.id]
                  setLocal(prev => ({
                    ...prev,
                    enabled_sources: next.length === ALL_SOURCES.length ? null : next,
                  }))
                }
                return (
                  <div key={source.id} className="flex items-center justify-between py-2 border-b border-navy-50 last:border-0">
                    <div className="min-w-0 mr-3">
                      <p className="text-sm font-medium text-navy-800">{source.label}</p>
                      <p className="text-xs text-navy-400 truncate">{source.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleSource}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
                        isOn ? 'bg-violet-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                        isOn ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-navy-100 p-4 space-y-2 bg-white">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full btn-primary justify-center"
          >
            {saving ? (
              <><RefreshCw size={14} className="animate-spin" /> Saving...</>
            ) : saved ? (
              <><Check size={14} /> Saved!</>
            ) : (
              <><Save size={14} /> Save Preferences</>
            )}
          </button>
          <button
            onClick={handleRescore}
            disabled={rescoring}
            className="w-full btn-secondary justify-center"
          >
            {rescoring ? (
              <><RefreshCw size={14} className="animate-spin" /> Re-scoring Jobs...</>
            ) : (
              <><OrionMark className="w-3.5 h-3.5 inline-block" /> Re-score All Jobs</>
            )}
          </button>
          {rescoring && (
            <p className="text-xs text-navy-400 text-center">Running in background — refresh page in ~10s</p>
          )}
        </div>
      </div>
    </>
  )
}

// ── New Today Row ─────────────────────────────────────────────────────────────
function NewTodayRow({ job, onAdd }) {
  const [expanded, setExpanded] = useState(false)
  const [logoLevel2, setLogoLevel2] = useState(0)
  const isAdded = job.added_to_tracker

  const sourceMeta = getSourceMeta(job.source)
  const blurb = extractCompanyBlurb(job.description)
  const genericUrl = isGenericCareerUrl(job.job_url)
  const logoSrc2 = logoLevel2 === 0 ? companyLogoUrl(job.job_url, job.company) : companyFaviconUrl(job.job_url, job.company)
  const logoFailed2 = logoLevel2 >= 2

  return (
    <div className="transition-colors hover:bg-sky-50/70">
      {/* Compact top row — always visible */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Logo */}
        {!logoFailed2 ? (
          <img
            src={logoSrc2}
            alt={job.company}
            onError={() => setLogoLevel2(prev => prev + 1)}
            className="w-7 h-7 rounded-md object-contain shrink-0 border border-sky-100 bg-white p-0.5"
          />
        ) : (
          <div className="w-7 h-7 rounded-md bg-sky-100 flex items-center justify-center shrink-0 text-xs font-bold text-sky-500">
            {(job.company || '?')[0].toUpperCase()}
          </div>
        )}

        {/* Company + role */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-navy-900 truncate leading-tight">{job.company}</p>
          <p className="text-xs text-navy-500 truncate leading-tight">{job.role}</p>
        </div>

        {/* Source badge — hidden on small screens */}
        <span className={`shrink-0 hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${sourceMeta.classes}`}>
          {sourceMeta.label}
        </span>

        {/* Learn More toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-sky-300 text-sky-700 text-xs font-medium hover:bg-sky-100 transition-colors"
        >
          {expanded ? 'Less' : 'Learn More'}
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>

        {/* Add / Added */}
        {isAdded ? (
          <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">
            <Check size={11} /> Added
          </span>
        ) : (
          <button
            onClick={() => onAdd(job)}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition-colors"
          >
            + Add
          </button>
        )}
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="mx-4 mb-3 rounded-lg border border-sky-200 bg-white px-3 py-2.5 space-y-2">
          {/* Location + work type */}
          {job.location && (
            <div className="flex items-center gap-1.5 text-xs text-navy-500">
              <MapPin size={11} className="text-navy-400 shrink-0" />
              <span>{job.location}</span>
            </div>
          )}

          {/* Company blurb from job description */}
          {blurb ? (
            <p className="text-xs text-navy-600 leading-relaxed">{blurb}</p>
          ) : (
            <p className="text-xs text-navy-400 italic">No description available for this role.</p>
          )}

          {/* Funding / employees / salary if available */}
          {(job.funding_stage || job.employee_count || job.salary_range || job.recently_funded) && (
            <div className="flex flex-wrap gap-1.5">
              {job.salary_range && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {job.salary_range}
                </span>
              )}
              {job.funding_stage && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                  {job.funding_stage}
                </span>
              )}
              {job.recently_funded && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                  {job.funding_amount ? `Raised ${job.funding_amount}` : 'Recently Funded'}
                </span>
              )}
              {job.employee_count && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  {job.employee_count} employees
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 border-t border-sky-100">
            {job.job_url ? (
              <div className="flex flex-col gap-0.5">
                <a
                  href={job.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-navy-200 text-navy-700 text-xs font-medium hover:bg-navy-50 transition-colors"
                >
                  <ExternalLink size={11} /> View Job Posting
                </a>
                {genericUrl && (
                  <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                    <AlertCircle size={9} /> General careers page
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-navy-400 italic">No direct link available</span>
            )}
            {!isAdded && (
              <button
                onClick={() => onAdd(job)}
                className="ml-auto flex items-center gap-1 px-3 py-1 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition-colors"
              >
                <Check size={11} /> Add to Tracker
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
// ── Onboarding Error Boundary ────────────────────────────────────────────────
class OnboardingErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err) { console.error('[Onboarding] Render error:', err) }
  render() { return this.state.hasError ? null : this.props.children }
}

// ── Onboarding Slideshow ─────────────────────────────────────────────────────
function OnboardingSlide({ icon: Icon, iconColor, badge, title, points, children }) {
  return (
    <div className="min-h-screen snap-start flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background: iconColor + '22' }}>
          <Icon size={30} style={{ color: iconColor }} />
        </div>
        {badge && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest" style={{ background: iconColor + '22', color: iconColor }}>
            {badge}
          </div>
        )}
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {points && (
          <ul className="text-left space-y-3 mx-auto max-w-md">
            {points.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/80">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: iconColor + '33' }}>
                  <Check size={11} style={{ color: iconColor }} />
                </div>
                {p}
              </li>
            ))}
          </ul>
        )}
        {children}
        {/* Scroll hint arrow pointing down */}
        <div className="pt-4">
          <ChevronRight size={18} className="text-white/30 mx-auto rotate-90 animate-bounce" />
        </div>
      </div>
    </div>
  )
}

function OnboardingSlideshow({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-navy-900/95 backdrop-blur-md">
      <button onClick={onClose} className="fixed top-6 right-6 z-[60] p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
        <X size={20} />
      </button>
      <div className="h-full overflow-y-auto snap-y snap-mandatory">

        {/* Slide 1 — Welcome */}
        <div className="min-h-screen snap-start flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-8">
            <div className="w-20 h-20 rounded-2xl bg-violet-500/20 mx-auto flex items-center justify-center">
              <OrionMark className="w-10 h-10" light />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white">Welcome to Orion</h1>
              <p className="text-lg text-violet-300 mt-3">Your AI-powered recruitment platform.</p>
              <p className="text-sm text-white/50 mt-1">Let's show you around.</p>
            </div>
            <div className="pt-4">
              <p className="text-violet-400 text-sm mb-2">Scroll down</p>
              <ChevronRight size={20} className="text-violet-400 mx-auto rotate-90 animate-bounce" />
            </div>
          </div>
        </div>

        {/* Slide 2 — Profile Setup */}
        <OnboardingSlide
          icon={User}
          iconColor="#8b5cf6"
          badge="Step 1"
          title="Get the most out of Orion"
          points={[
            "Upload your resume so Orion can score and match jobs to your background",
            "Add career context — target roles, preferred locations, and what you're looking for",
            "Connect your Gmail to send outreach emails directly from the platform",
            "Sync Google Drive to organize notes and documents for each contact",
            "Link Google Calendar so interviews, deadlines, and networking calls stay in sync",
          ]}
        >
          <p className="text-violet-400 text-sm pt-2">Head to your <span className="font-bold text-violet-300">Profile</span> page after this tour to connect your accounts</p>
        </OnboardingSlide>

        {/* Slide 3 — Job Discovery */}
        <OnboardingSlide
          icon={Search}
          iconColor="#06b6d4"
          badge="Discover"
          title="Discover jobs tailored to you"
          points={[
            "Orion scrapes VC portfolios, job boards, ATS systems, and curated newsletters to surface roles matched to your background",
            "New jobs are discovered every day — the Discovery Agent runs automatically at 9am ET",
            "Set your preferences (location, industry, salary, experience) to filter what matters to you",
            "See all open roles at a company with 'See X other jobs at [Company]'",
            "Click 'Add to Tracker' to move a job into your pipeline",
          ]}
        />

        {/* Slide 4 — Job Tracker & Networking */}
        <OnboardingSlide
          icon={Briefcase}
          iconColor="#f59e0b"
          badge="Track & Network"
          title="Track your pipeline and build your network"
          points={[
            "Drag jobs between columns: Not Applied → Under Review → Interviewing → Accepted",
            "Click any job to see details, add contacts, and manage your network",
            "Search for people at any company with Apollo — find the right person to reach out to",
            "Write and send personalized emails directly from the platform using your saved templates",
            "Schedule networking calls and sync them to your calendar",
            "Create Google Docs linked to each contact for meeting notes and follow-up tracking",
          ]}
        />

        {/* Slide 5 — Coach */}
        <OnboardingSlide
          icon={Sparkles}
          iconColor="#ec4899"
          badge="Coach"
          title="Get AI-powered feedback"
          points={[
            "Scan your resume against specific job descriptions for targeted improvements",
            "Polish cover letters with line-by-line feedback",
            "Review application question answers before submitting",
            "Practice behavioral interviews with voice — scored on structure, specificity, and relevance",
          ]}
        />

        {/* Slide 6 — Calendar */}
        <OnboardingSlide
          icon={Calendar}
          iconColor="#10b981"
          badge="Organize"
          title="Stay organized"
          points={[
            "Deadlines, interviews, networking calls, and career events — all in one place",
            "Syncs with your Google Calendar so nothing falls through the cracks",
            "Get overlap warnings when scheduling conflicts arise",
          ]}
        />

        {/* Slide 7 — Get Started */}
        <div className="min-h-screen snap-start flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 mx-auto flex items-center justify-center">
              <TrendingUp size={30} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white">You're all set.</h2>
              <p className="text-lg text-emerald-300 mt-3">Start by running the Discovery Agent to find jobs matched to your profile.</p>
            </div>
            <button onClick={onClose}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-lg transition-colors">
              Start Discovering <ArrowRight size={20} />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function JobDiscovery() {
  const location = useLocation()
  const [showOnboarding, setShowOnboarding] = useState(() => {
    // Show on first registration OR when ?tour=1 query param is present
    const params = new URLSearchParams(window.location.search)
    if (params.get('tour') === '1') return true
    return location.state?.firstTime && !localStorage.getItem('orion_onboarding_done')
  })
  const closeOnboarding = () => {
    setShowOnboarding(false)
    localStorage.setItem('orion_onboarding_done', '1')
  }

  const [jobs, setJobs]       = useState([])
  const [total, setTotal]     = useState(0)
  const [status, setStatus]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [running, setRunning] = useState(false)
  const [runElapsed, setRunElapsed] = useState(0)
  const [runResult, setRunResult] = useState(null)

  // Preferences — null until loaded from API (prevents double-fetch with wrong filters)
  const [preferences, setPreferences] = useState(null)
  const [prefsPanelOpen, setPrefsPanelOpen] = useState(false)

  // Company jobs popup
  const [companyPopup, setCompanyPopup] = useState(null) // { company, otherCount }
  const lastFilterParams = useRef({})

  // Multi-job prompt
  const [multiPrompt, setMultiPrompt] = useState(null) // { type, job } or null

  // Toast notification after adding to tracker
  const [toast, setToast] = useState(null) // { folder } or null

  // Filters — persisted to sessionStorage so they survive navigation
  const _ss = (key, fallback) => { try { const v = sessionStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback } catch { return fallback } }
  const [search, _setSearch]                   = useState(() => _ss('discovery_search', ''))
  const [debouncedSearch, setDebouncedSearch] = useState(() => _ss('discovery_search', ''))
  const [roleFilter, _setRoleFilter]           = useState(() => _ss('discovery_roles', []))
  const [hideAdded, _setHideAdded]             = useState(() => _ss('discovery_hideAdded', false))
  const [sortBy, _setSortBy]                   = useState(() => _ss('discovery_sort', 'score'))
  const [page, _setPage]                       = useState(() => _ss('discovery_page', 1))

  const setSearch     = (v) => { _setSearch(v);     sessionStorage.setItem('discovery_search', JSON.stringify(v)) }
  const setRoleFilter = (v) => {
    if (typeof v === 'function') {
      _setRoleFilter(prev => { const next = v(prev); sessionStorage.setItem('discovery_roles', JSON.stringify(next)); return next })
    } else {
      _setRoleFilter(v); sessionStorage.setItem('discovery_roles', JSON.stringify(v))
    }
  }
  const setHideAdded  = (v) => { _setHideAdded(v);  sessionStorage.setItem('discovery_hideAdded', JSON.stringify(v)) }
  const setSortBy     = (v) => { _setSortBy(v);     sessionStorage.setItem('discovery_sort', JSON.stringify(v)) }
  const setPage       = (p) => { _setPage(p);       sessionStorage.setItem('discovery_page', JSON.stringify(p)) }

  // New Today banner
  const [newTodayJobs, setNewTodayJobs]       = useState([])
  const [newTodayExpanded, setNewTodayExpanded] = useState(false)

  const debounceRef = useRef(null)
  const runTimerRef = useRef(null)

  // Debounce search — skip page reset on initial mount
  const searchMountedRef = useRef(false)
  useEffect(() => {
    if (!searchMountedRef.current) {
      searchMountedRef.current = true
      setDebouncedSearch(search)
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [search])

  // Load preferences on mount — jobs don't fetch until this resolves
  useEffect(() => {
    preferencesApi.get()
      .then(res => setPreferences(res.data))
      .catch(() => setPreferences({ locations: [], funding_stages: [], employee_ranges: [], preferred_roles: null, preferred_work_types: null, years_experience: null }))
  }, [])

  const [hasResume, setHasResume] = useState(true)   // assume true until checked
  const [resumeBannerDismissed, setResumeBannerDismissed] = useState(
    () => sessionStorage.getItem('riq_resume_banner_dismissed') === '1'
  )

  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    profileApi.get()
      .then(res => setHasResume(!!res.data.profile?.resume_filename))
      .catch(() => {})
  }, [user])


  const fetchJobs = useCallback(async (opts = {}) => {
    const curPage   = opts.page   !== undefined ? opts.page   : page
    const curSort   = opts.sort   !== undefined ? opts.sort   : sortBy
    const curSearch = opts.search !== undefined ? opts.search : debouncedSearch
    const curRole   = opts.role   !== undefined ? opts.role   : roleFilter
    const curHide   = opts.hide   !== undefined ? opts.hide   : hideAdded
    const curPrefs  = (opts.prefs !== undefined ? opts.prefs : preferences) || {
      locations: [], funding_stages: [], employee_ranges: [],
      preferred_roles: null, preferred_work_types: null, years_experience: null,
    }
    if (preferences === null && opts.prefs === undefined) return // wait for prefs to load

    setLoading(true)
    setError(null)
    try {
      const params = {
        limit: PAGE_SIZE,
        offset: (curPage - 1) * PAGE_SIZE,
        sort: curSort,
        is_active: true,
        deduplicate_by_company: true,
      }
      if (curSearch) params.search = curSearch
      if (curRole && curRole.length > 0) {
        // Chip selection overrides saved preference
        const hasUndefined = curRole.includes('Undefined')
        const definedRoles = curRole.filter(r => r !== 'Undefined')
        const expandedKeywords = definedRoles.flatMap(r => ROLE_CHIP_KEYWORDS[r] || [r])
        if (expandedKeywords.length > 0) params.role_filter = expandedKeywords.join(',')
        if (hasUndefined) params.include_undefined_roles = true
      } else if (curPrefs.preferred_roles && curPrefs.preferred_roles.length > 0) {
        // Fall back to saved preferred_roles when no chips selected
        const hasUndefined = curPrefs.preferred_roles.includes('Undefined')
        const definedRoles = curPrefs.preferred_roles.filter(r => r !== 'Undefined')
        const expandedKeywords = definedRoles.flatMap(r => ROLE_CHIP_KEYWORDS[r] || [r])
        if (expandedKeywords.length > 0) params.role_filter = expandedKeywords.join(',')
        if (hasUndefined) params.include_undefined_roles = true
      }
      if (curPrefs.preferred_work_types && curPrefs.preferred_work_types !== null) {
        params.work_type = curPrefs.preferred_work_types.join(',')
      }
      if (curHide) params.added = false
      // Location filter — always strict when locations are set
      if (curPrefs.locations && curPrefs.locations.length > 0) {
        params.location_filter = curPrefs.locations.join(',')
      }
      // Funding stage — strict (only send when not all selected)
      const ALL_STAGES = ['Seed', 'Series A', 'Series B', 'Series C+']
      if (curPrefs.funding_stages && curPrefs.funding_stages.length > 0 && curPrefs.funding_stages.length < ALL_STAGES.length) {
        params.funding_stage = curPrefs.funding_stages.join(',')
      }
      // Employee range — strict (only send when not all selected)
      const ALL_RANGES = ['1-50', '50-200', '200-500', '500+']
      if (curPrefs.employee_ranges && curPrefs.employee_ranges.length > 0 && curPrefs.employee_ranges.length < ALL_RANGES.length) {
        params.employee_range = curPrefs.employee_ranges.join(',')
      }
      // Years of experience filter
      if (curPrefs.years_experience) {
        params.years_experience = curPrefs.years_experience
      }

      // Save filter params (without pagination) for popup reuse
      const { limit: _l, offset: _o, deduplicate_by_company: _d, ...filterParams } = params
      lastFilterParams.current = filterParams

      const [jobsRes, statusRes] = await Promise.all([
        discoveredApi.getAll(params),
        discoveredApi.getStatus().catch(() => null),
      ])
      const data = jobsRes.data
      const statusData = statusRes?.data

      const jobList = Array.isArray(data) ? data : (data?.jobs || [])
      const jobTotal = data?.total ?? (Array.isArray(data) ? data.length : 0)

      setJobs(jobList)
      setTotal(jobTotal)
      if (statusData) setStatus(statusData)

      // If page is beyond available results, reset to page 1
      const totalPages = Math.ceil(jobTotal / PAGE_SIZE)
      if (curPage > 1 && totalPages > 0 && curPage > totalPages) {
        setPage(1)
      }

    } catch (err) {
      setError('Failed to load discovered jobs. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [page, sortBy, debouncedSearch, roleFilter, hideAdded, preferences])

  // Fetch on any param change
  useEffect(() => {
    fetchJobs()
  }, [page, sortBy, debouncedSearch, roleFilter, hideAdded, preferences]) // eslint-disable-line

  // Fetch new-today jobs once on mount
  useEffect(() => {
    discoveredApi.getNewToday()
      .then(res => setNewTodayJobs(res.data?.jobs || []))
      .catch(() => {})
  }, []) // eslint-disable-line

  const handleRunAgent = async () => {
    setRunning(true)
    setRunElapsed(0)
    setRunResult(null)
    // Start elapsed timer
    runTimerRef.current = setInterval(() => {
      setRunElapsed(prev => prev + 1)
    }, 1000)
    try {
      await discoveredApi.triggerScrape()
      // Poll status every 8s; stop as soon as is_running flips to false
      for (let i = 0; i < 75; i++) {          // max ~10 min
        await new Promise(r => setTimeout(r, 8000))
        const statusRes = await discoveredApi.getStatus().catch(() => null)
        const status = statusRes?.data
        if (status && !status.is_running) {
          // Short delay to ensure backend has fully written completed_at before re-fetching
          await new Promise(r => setTimeout(r, 1500))
          const freshStatus = await discoveredApi.getStatus().catch(() => null)
          if (freshStatus?.data) setStatus(freshStatus.data)
          fetchJobs()
          const saved = status.last_saved ?? 0
          setRunResult(saved > 0
            ? `${saved} new job${saved === 1 ? '' : 's'} added`
            : 'Up to date — no new jobs found'
          )
          break
        }
      }
    } catch (err) {
      console.error('Scrape failed:', err)
    } finally {
      clearInterval(runTimerRef.current)
      runTimerRef.current = null
      setRunning(false)
      setRunElapsed(0)
    }
  }

  // Add to tracker — folder auto-assigned by backend, toast shows result
  const handleAddToTracker = async (job, opts = {}) => {
    const otherCount = job.other_jobs_count || 0
    // Show prompt FIRST — don't call API until user confirms
    if (!opts.skipPrompt && otherCount > 0) {
      setMultiPrompt({ type: 'add', job })
      return
    }
    try {
      const res = await discoveredApi.addToTracker(job.id, {})
      const folder = res.data?.folder || 'Unfiled'
      setToast({ folder, role: job.role })
      setTimeout(() => setToast(null), 3500)

      if (opts.skipPrompt) {
        // From popup — decrement count on main list entry for this company
        setJobs(prev => prev.map(j =>
          j.company === job.company && j.id !== job.id
            ? { ...j, other_jobs_count: Math.max(0, (j.other_jobs_count || 1) - 1) }
            : j
        ))
      } else {
        // No other jobs — remove widget entirely
        setJobs(prev => prev.filter(j => j.id !== job.id))
        setTotal(prev => prev - 1)
      }
    } catch (err) {
      console.error('Failed to add to tracker:', err)
    }
  }

  const handleMultiPromptConfirm = async (action) => {
    const { type, job } = multiPrompt
    setMultiPrompt(null)
    if (type === 'add') {
      if (action === 'keep') {
        // Call API now that user confirmed
        try {
          const res = await discoveredApi.addToTracker(job.id, {})
          const folder = res.data?.folder || 'Unfiled'
          setToast({ folder, role: job.role })
          setTimeout(() => setToast(null), 3500)
        } catch { return }
        // Replace widget with next best job at company
        try {
          const res = await discoveredApi.getNextAtCompany(job.company, job.id, lastFilterParams.current)
          const list = res.data?.jobs || []
          const next = list.find(j => j.id !== job.id)
          if (next) {
            setJobs(prev => prev.map(j => j.id === job.id
              ? { ...next, other_jobs_count: Math.max(0, (job.other_jobs_count || 1) - 1) }
              : j
            ))
          } else {
            setJobs(prev => prev.filter(j => j.id !== job.id))
            setTotal(prev => prev - 1)
          }
        } catch {
          setJobs(prev => prev.filter(j => j.id !== job.id))
          setTotal(prev => prev - 1)
        }
      } else {
        // remove_all — call API then dismiss all at company
        try {
          const res = await discoveredApi.addToTracker(job.id, {})
          const folder = res.data?.folder || 'Unfiled'
          setToast({ folder, role: job.role })
          setTimeout(() => setToast(null), 3500)
        } catch {}
        const removedCount = (job.other_jobs_count || 0) + 1
        setJobs(prev => prev.filter(j => j.company !== job.company))
        setTotal(prev => Math.max(0, prev - removedCount))
        discoveredApi.dismissCompany(job.company).catch(() => {})
      }
    } else {
      // dismiss type — call API now that user confirmed
      discoveredApi.update(job.id, { is_active: false }).catch(() => {})
      if (action === 'just_this') {
        // Fetch next job at company, replace widget
        try {
          const res = await discoveredApi.getNextAtCompany(job.company, job.id, lastFilterParams.current)
          const list = res.data?.jobs || []
          const next = list.find(j => j.id !== job.id)
          if (next) {
            setJobs(prev => prev.map(j => j.id === job.id ? { ...next, other_jobs_count: (job.other_jobs_count || 1) - 1 } : j))
          } else {
            setJobs(prev => prev.filter(j => j.id !== job.id))
            setTotal(prev => prev - 1)
          }
        } catch {
          setJobs(prev => prev.filter(j => j.id !== job.id))
          setTotal(prev => prev - 1)
        }
      } else {
        // Remove all at company — decrement total by all jobs at company
        const removedCount = (job.other_jobs_count || 0) + 1
        setJobs(prev => prev.filter(j => j.company !== job.company))
        setTotal(prev => Math.max(0, prev - removedCount))
        discoveredApi.dismissCompany(job.company).catch(() => {})
      }
    }
  }

  const handleDismiss = async (job, opts = {}) => {
    const otherCount = job.other_jobs_count || 0
    if (!opts.skipPrompt && otherCount > 0) {
      // Show prompt FIRST — API call happens in confirm handler (same pattern as add)
      setMultiPrompt({ type: 'dismiss', job })
      return
    }
    if (opts.skipPrompt) {
      // From popup — decrement count on main list entry for this company
      setJobs(prev => prev.map(j =>
        j.company === job.company && j.id !== job.id
          ? { ...j, other_jobs_count: Math.max(0, (j.other_jobs_count || 1) - 1) }
          : j
      ))
    } else {
      // No other jobs at company — remove widget entirely
      setJobs(prev => prev.filter(j => j.id !== job.id))
      setTotal(prev => prev - 1)
    }
    try {
      await discoveredApi.update(job.id, { is_active: false })
    } catch (err) {
      console.error('Failed to dismiss job:', err)
    }
  }

  const handleSavePreferences = async (newPrefs) => {
    setPreferences(newPrefs)
    setPage(1)
  }

  const handleSort = (s) => { setSortBy(s); setPage(1) }
  const handleRoleFilter = (role) => {
    setRoleFilter(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
    setPage(1)
  }
  const handlePage = (p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const lastScraped = status?.last_scraped || status?.last_run

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Onboarding slideshow — first time only */}
      <OnboardingErrorBoundary>
        {showOnboarding && <OnboardingSlideshow onClose={closeOnboarding} />}
      </OnboardingErrorBoundary>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <OrionMark className="w-6 h-6" />
            Job Discovery Agent
          </h1>
          <p className="text-sm text-navy-400 mt-0.5">Intelligent daily job discovery tailored to your profile</p>
        </div>
        <button
          onClick={() => setPrefsPanelOpen(true)}
          className="btn-secondary self-start sm:self-auto"
          title="Preferences"
        >
          <Settings size={15} />
          Preferences
        </button>
      </div>

      {/* Status bar */}
      <div className="card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs text-navy-400 uppercase tracking-wide font-semibold mb-0.5">Last Scraped</p>
              <p className="text-sm font-medium text-navy-800">
                {lastScraped ? formatDateTime(lastScraped) : 'Never'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-navy-400 mr-1">Sources:</span>
              {(preferences?.enabled_sources == null
                ? ALL_SOURCE_BADGES
                : ALL_SOURCE_BADGES.filter(b => (preferences.enabled_sources || []).includes(b.id))
              ).map(s => (
                <span key={s.label} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.classes}`}>{s.label}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-start lg:items-end gap-1 shrink-0">
            <button onClick={handleRunAgent} disabled={running || loading} className="btn-primary">
              <RefreshCw size={15} className={running ? 'animate-spin' : ''} />
              {running ? `Scanning… ${runElapsed}s` : 'Run Discovery Agent'}
            </button>
            {running ? (
              <p className="text-xs text-navy-400">Scanning your sources… A full scan typically takes 2–4 minutes.</p>
            ) : runResult ? (
              <p className={`text-xs font-medium ${runResult.startsWith('Up to date') ? 'text-navy-400' : 'text-emerald-600'}`}>
                {runResult.startsWith('Up to date') ? '✓' : '✦'} {runResult}
              </p>
            ) : (
              <p className="text-xs text-navy-400">Scans your sources to find roles matched to your resume &amp; preferences</p>
            )}
          </div>
        </div>
      </div>

      {/* ── New Today Banner ─────────────────────────────────────────────── */}
      {newTodayJobs.length > 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 overflow-hidden">
          {/* Header row */}
          <div className="flex items-center px-4 py-3">
            <button
              onClick={() => setNewTodayExpanded(v => !v)}
              className="flex items-center gap-2 text-left"
            >
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-500 text-white text-xs font-bold shrink-0">
                {newTodayJobs.length}
              </span>
              <span className="text-sm font-semibold text-sky-800">
                New jobs found today
              </span>
              {newTodayExpanded
                ? <ChevronUp size={15} className="text-sky-500" />
                : <ChevronDown size={15} className="text-sky-500" />}
            </button>
          </div>

          {/* Expanded job list */}
          {newTodayExpanded && (
            <div className="border-t border-sky-200 divide-y divide-sky-100 max-h-96 overflow-y-auto">
              {newTodayJobs.map(job => (
                <NewTodayRow
                  key={job.id}
                  job={job}
                  onAdd={handleAddToTracker}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* No-resume banner */}
      {!hasResume && !resumeBannerDismissed && (
        <div className="mx-4 mt-4 flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
          <Sparkles size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Get personalized job matches</p>
            <p className="text-sm text-amber-700 mt-0.5">
              You're seeing all available jobs. Upload your resume in{' '}
              <a href="/profile" className="underline font-medium hover:text-amber-900">Profile</a>{' '}
              to get AI-scored recommendations tailored to your background, skills, and goals.
            </p>
          </div>
          <button
            onClick={() => { setResumeBannerDismissed(true); sessionStorage.setItem('riq_resume_banner_dismissed', '1') }}
            className="text-amber-400 hover:text-amber-700 shrink-0 p-0.5"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Add job from any URL */}
      <AddFromUrlCard onAdded={() => fetchJobs()} />

      {/* Filter bar */}
      <div className="card p-4 space-y-3">
          {/* Row 1: search + sort */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
              <input
                className="input pl-9"
                placeholder="Search company, role, location, source…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 shrink-0">
              <SlidersHorizontal size={14} className="text-navy-400" />
              <span className="text-sm text-navy-500">Sort:</span>
              <div className="flex rounded-lg border border-navy-200 overflow-hidden">
                {[{ v: 'score', l: 'Best Match' }, { v: 'date', l: 'Posted Date' }].map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => handleSort(v)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      sortBy === v ? 'bg-navy-800 text-white' : 'bg-white text-navy-600 hover:bg-navy-50'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: role filter chips (multi-select) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-navy-400 mr-1">Role:</span>
            {Object.keys(ROLE_CHIP_KEYWORDS).map(role => (
              <button
                key={role}
                onClick={() => handleRoleFilter(role)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  roleFilter.includes(role)
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-navy-600 border-navy-200 hover:border-violet-300 hover:text-violet-700'
                }`}
              >
                {role}
              </button>
            ))}
            {roleFilter.length > 0 && (
              <button onClick={() => { setRoleFilter([]); setPage(1) }} className="px-2 py-1 rounded-full text-xs text-navy-400 hover:text-navy-700 flex items-center gap-0.5">
                <X size={10} /> Clear
              </button>
            )}
          </div>

          {/* Row 3: active filters display */}
          <div className="flex flex-wrap items-center gap-2">
            {preferences?.locations && preferences.locations.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-xs">
                <MapPin size={10} />
                {preferences.locations.join(', ')}
              </span>
            )}
            {preferences?.funding_stages && preferences.funding_stages.length < 4 && (
              <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs">
                {preferences.funding_stages.join(', ')}
              </span>
            )}
            {preferences?.employee_ranges && preferences.employee_ranges.length < 4 && (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs">
                {preferences.employee_ranges.join(', ')} emp
              </span>
            )}
            {preferences?.years_experience && (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs">
                {preferences.years_experience} yrs exp
              </span>
            )}
            <button
              onClick={() => setPrefsPanelOpen(true)}
              className="text-xs text-violet-600 hover:text-violet-800 underline"
            >
              Edit filters
            </button>
          </div>
        </div>

      {/* Results */}
      {loading ? (
        <div className="card flex items-center justify-center py-20 gap-3 text-navy-400">
          <RefreshCw size={20} className="animate-spin" />
          <span className="text-sm">Loading discovered jobs…</span>
        </div>
      ) : error ? (
        <div className="card flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-red-500 text-sm font-medium">{error}</p>
          <button onClick={() => fetchJobs()} className="btn-secondary"><RefreshCw size={14} /> Retry</button>
        </div>
      ) : total === 0 && !debouncedSearch ? (
        /* Empty state — no jobs at all */
        <div className="card flex flex-col items-center justify-center py-20 px-8 text-center gap-5">
          <div className="w-20 h-20 rounded-full bg-violet-50 flex items-center justify-center">
            <Search size={36} className="text-violet-DEFAULT opacity-60" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-navy-800">No jobs discovered yet</h3>
            <p className="text-sm text-navy-400 max-w-sm leading-relaxed">
              Click "Run Discovery Agent" to find opportunities tailored to your profile across 16+ sources.
            </p>
          </div>
          <button onClick={handleRunAgent} disabled={running} className="btn-primary">
            {running ? <><RefreshCw size={15} className="animate-spin" /> Running Agent…</> : <><OrionMark className="w-4 h-4 inline-block" /> Run Discovery Agent</>}
          </button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 gap-3 text-navy-400">
          <Search size={36} className="text-navy-200" />
          <div className="text-center">
            <p className="font-semibold text-navy-600">No jobs match your filters</p>
            <p className="text-sm mt-1">Try adjusting your preferences or clearing filters.</p>
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={() => { setSearch(''); setHideAdded(false); setPage(1) }} className="btn-secondary">
              <X size={14} /> Clear Filters
            </button>
            <button onClick={() => setPrefsPanelOpen(true)} className="btn-secondary">
              <Settings size={14} /> Adjust Preferences
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-navy-400">
            Showing <span className="font-medium text-navy-600">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</span> of <span className="font-medium text-navy-600">{total.toLocaleString()}</span> companies
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {jobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onAddToTracker={handleAddToTracker}
                onDismiss={handleDismiss}
                onShowCompanyJobs={(company, count) => setCompanyPopup({ company, otherCount: count })}
              />
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPage={handlePage} />
        </>
      )}

      <DismissedJobsPanel onRestore={() => fetchJobs()} />
      <HowItWorks />

      {/* Preferences Panel */}
      <PreferencesPanel
        open={prefsPanelOpen}
        onClose={() => setPrefsPanelOpen(false)}
        preferences={preferences}
        onSave={handleSavePreferences}
      />

      {/* Company Jobs Popup */}
      {companyPopup && (
        <CompanyJobsModal
          company={companyPopup.company}
          filterParams={lastFilterParams.current}
          onClose={() => setCompanyPopup(null)}
          onAddToTracker={handleAddToTracker}
          onDismiss={handleDismiss}
        />
      )}

      {multiPrompt && (
        <MultiJobPrompt
          type={multiPrompt.type}
          company={multiPrompt.job.company}
          otherCount={multiPrompt.job.other_jobs_count || 0}
          onConfirm={handleMultiPromptConfirm}
          onCancel={() => setMultiPrompt(null)}
        />
      )}

      {/* Toast — folder auto-assignment notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-navy-900 text-white rounded-xl shadow-2xl text-sm font-medium pointer-events-none">
          <Check size={15} className="text-emerald-400 shrink-0" />
          {toast.role ? <span className="max-w-[200px] truncate">{toast.role}</span> : 'Added to Tracker'}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-500 text-white">
            {toast.folder}
          </span>
        </div>
      )}
    </div>
  )
}
