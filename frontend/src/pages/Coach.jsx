import { useState, useEffect, useRef } from 'react'
import {
  FileText, Sparkles, ChevronDown, ChevronUp, Copy, Check,
  Loader2, AlertTriangle, BookOpen, Lightbulb, RotateCcw,
  Star, Target, Building2, MessageSquare,
} from 'lucide-react'
import { coachApi, jobsApi, profileApi } from '../api'

// ── Analysis progress bar ─────────────────────────────────────────────────────
function useAnalysisProgress(loading) {
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef(null)
  const resetRef    = useRef(null)
  const activeRef   = useRef(false)

  useEffect(() => {
    if (loading) {
      activeRef.current = true
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (resetRef.current)    clearTimeout(resetRef.current)
      let val = 0
      setProgress(0)
      intervalRef.current = setInterval(() => {
        val += (97 - val) * 0.07  // asymptotic approach to 97 — slows near the end
        setProgress(Math.min(val, 96))
      }, 300)
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      if (activeRef.current) {
        activeRef.current = false
        setProgress(100)
        resetRef.current = setTimeout(() => setProgress(0), 1400)
      }
    }
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    }
  }, [loading])

  return progress
}

const PROGRESS_STAGES = [
  { at: 0,  label: 'Reading your document...' },
  { at: 25, label: 'Analyzing structure and content...' },
  { at: 55, label: 'Generating suggestions...' },
  { at: 80, label: 'Finalizing feedback...' },
  { at: 100, label: 'Done' },
]

function AnalysisProgressBar({ loading, progress }) {
  if (!loading && progress === 0) return null
  const stage = [...PROGRESS_STAGES].reverse().find(s => progress >= s.at)?.label ?? ''
  const done  = progress >= 100

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between text-xs">
        <span className={`transition-colors duration-300 ${done ? 'text-emerald-500 font-medium' : 'text-navy-400'}`}>
          {stage}
        </span>
        <span className="text-navy-400 tabular-nums">{Math.round(progress)}%</span>
      </div>
      <div className="h-1 bg-navy-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${done ? 'bg-emerald-500' : 'bg-violet-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

// ── Error helper ──────────────────────────────────────────────────────────────
function ErrorBox({ msg }) {
  const isCreditError = msg && (msg.toLowerCase().includes('credit balance') || msg.toLowerCase().includes('billing'))
  return (
    <div className="flex items-start gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
      <span>
        {msg}
        {isCreditError && (
          <>{' '}<a
            href="https://console.anthropic.com/settings/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold hover:text-red-900"
          >Add credits →</a></>
        )}
      </span>
    </div>
  )
}

// ── Severity config ───────────────────────────────────────────────────────────
const SEVERITY = {
  rewrite: {
    label: 'Rewrite',
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 border-red-200',
    border: 'border-l-red-400',
  },
  strengthen: {
    label: 'Strengthen',
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    border: 'border-l-amber-400',
  },
  good: {
    label: 'Strong',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    border: 'border-l-emerald-400',
  },
}

const CATEGORY_ICONS = {
  impact:      <Target size={11} />,
  specificity: <Star size={11} />,
  relevance:   <Star size={11} />,
  keyword:     <BookOpen size={11} />,
  format:      <FileText size={11} />,
  tone:        <MessageSquare size={11} />,
  opening:     <Target size={11} />,
  connection:  <Star size={11} />,
  closing:     <Target size={11} />,
}

// ── Shared: Job Selector (company → role cascade) ─────────────────────────────
function JobSelector({ trackerJobs, onChange }) {
  const [selectedCompany, setSelectedCompany] = useState('')
  const [selectedRoleId, setSelectedRoleId]   = useState('')

  // Deduplicated, sorted company list — case-insensitive dedup
  const companies = [...new Map(
    trackerJobs
      .map(j => (j.company || '').trim())
      .filter(Boolean)
      .map(c => [c.toLowerCase(), c])
  ).values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

  // Roles for the selected company — case-insensitive match
  const rolesForCompany = selectedCompany
    ? trackerJobs.filter(j => (j.company || '').trim().toLowerCase() === selectedCompany.toLowerCase())
    : []

  const handleCompany = (company) => {
    setSelectedCompany(company)
    setSelectedRoleId('')   // reset role whenever company changes
    onChange(null)
  }

  const handleRole = (jobId) => {
    setSelectedRoleId(jobId)
    onChange(jobId ? (trackerJobs.find(j => String(j.id) === String(jobId)) || null) : null)
  }

  return (
    <div className="space-y-3">
      {/* Company dropdown */}
      <div>
        <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Company</label>
        <div className="relative">
          <select
            className="input appearance-none pr-8 text-sm"
            value={selectedCompany}
            onChange={e => handleCompany(e.target.value)}
          >
            <option value="">— select company —</option>
            {companies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
        </div>
      </div>

      {/* Role dropdown — only shown once a company is picked */}
      {selectedCompany && (
        <div>
          <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Role</label>
          <div className="relative">
            <select
              className="input appearance-none pr-8 text-sm"
              value={selectedRoleId}
              onChange={e => handleRole(e.target.value || '')}
            >
              <option value="">— select role —</option>
              {rolesForCompany.map(j => (
                <option key={j.id} value={String(j.id)}>{j.role || 'Unknown Role'}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Suggestion Card ───────────────────────────────────────────────────────────
function SuggestionCard({ s }) {
  const [expanded, setExpanded] = useState(true)
  const [copied, setCopied] = useState(false)
  const cfg = SEVERITY[s.severity] || SEVERITY.strengthen

  const copy = () => {
    navigator.clipboard.writeText(s.rewrite || s.excerpt || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className={`rounded-xl border border-navy-100 border-l-4 ${cfg.border} bg-white shadow-sm overflow-hidden`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left gap-3"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
            {cfg.label}
          </span>
          {s.category && (
            <span className="inline-flex items-center gap-1 text-xs text-navy-400 bg-navy-50 px-2 py-0.5 rounded-full border border-navy-100 capitalize">
              {CATEGORY_ICONS[s.category]}
              {s.category}
            </span>
          )}
          {s.section && (
            <span className="text-xs text-navy-400 truncate hidden sm:block">{s.section}</span>
          )}
        </div>
        {expanded
          ? <ChevronUp size={14} className="text-navy-400 shrink-0" />
          : <ChevronDown size={14} className="text-navy-400 shrink-0" />
        }
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-navy-50">
          {s.excerpt && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1">Original</p>
              <p className="text-sm text-navy-600 bg-navy-50 rounded-lg px-3 py-2 italic leading-relaxed">
                "{s.excerpt}"
              </p>
            </div>
          )}
          {s.rewrite && (
            <div>
              <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1">Suggested</p>
              <div className="flex items-start gap-2">
                <p className="text-sm text-navy-900 font-medium leading-relaxed flex-1 bg-violet-50 rounded-lg px-3 py-2">
                  {s.rewrite}
                </p>
                <button
                  onClick={copy}
                  className="shrink-0 mt-1 p-1.5 rounded-lg text-navy-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                  title="Copy suggestion"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}
          {s.explanation && (
            <p className="text-xs text-navy-500 leading-relaxed border-t border-navy-50 pt-2">
              {s.explanation}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Score header ──────────────────────────────────────────────────────────────
function ResultsHeader({ result, allSuggestions, onReset }) {
  const counts = { rewrite: 0, strengthen: 0, good: 0 }
  ;(allSuggestions || []).forEach(s => { if (counts[s.severity] !== undefined) counts[s.severity]++ })
  const pct = Math.max(0, Math.min(100, result.overall_score || 0))
  const color = pct >= 70 ? 'text-emerald-500' : pct >= 45 ? 'text-amber-500' : 'text-red-400'
  const ring  = pct >= 70 ? 'border-emerald-400' : pct >= 45 ? 'border-amber-400' : 'border-red-400'
  const label = pct >= 70 ? 'Strong' : pct >= 45 ? 'Developing' : 'Needs Work'

  return (
    <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className={`w-16 h-16 rounded-full border-4 ${ring} flex flex-col items-center justify-center shrink-0`}>
        <div className={`text-xl font-bold tabular-nums leading-none ${color}`}>{pct}</div>
        <div className="text-[9px] text-navy-400 font-medium">{label}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-navy-700 leading-relaxed">{result.narrative_summary || result.overall_arc || result.summary}</p>
        {result.tone_detected && (
          <p className="text-xs text-navy-400 mt-1.5 flex items-center gap-1.5">
            <MessageSquare size={10} className="text-violet-400" />
            <span className="font-medium text-navy-500">Tone detected:</span> {result.tone_detected}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs font-semibold shrink-0 flex-wrap">
        {counts.rewrite > 0 && <span className="flex items-center gap-1 text-red-600"><span className="w-2 h-2 rounded-full bg-red-500" />{counts.rewrite} rewrite</span>}
        {counts.strengthen > 0 && <span className="flex items-center gap-1 text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-400" />{counts.strengthen} strengthen</span>}
        {counts.good > 0 && <span className="flex items-center gap-1 text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500" />{counts.good} strong</span>}
        <button onClick={onReset} className="ml-1 flex items-center gap-1 text-navy-400 hover:text-navy-700 border border-navy-200 px-2.5 py-1 rounded-lg transition-colors">
          <RotateCcw size={11} /> Reset
        </button>
      </div>
    </div>
  )
}

// ── Section group (resume) ────────────────────────────────────────────────────
function SectionGroup({ section }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-navy-100" />
        <span className="text-[11px] font-semibold text-navy-400 uppercase tracking-wider whitespace-nowrap px-1">
          {section.name}
        </span>
        <div className="flex-1 h-px bg-navy-100" />
      </div>
      {section.section_note && (
        <p className="text-xs text-navy-500 italic px-1">{section.section_note}</p>
      )}
      <div className="space-y-2">
        {(section.suggestions || []).map((s, i) => <SuggestionCard key={i} s={s} />)}
      </div>
    </div>
  )
}

// ── Compact suggestion card (for three-column view) ───────────────────────────
function CompactSuggestionCard({ s }) {
  const [copied, setCopied] = useState(false)
  const cfg = SEVERITY[s.severity] || SEVERITY.strengthen
  const copy = () => {
    navigator.clipboard.writeText(s.rewrite || s.excerpt || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div className={`rounded-xl border border-navy-100 border-l-4 ${cfg.border} bg-white shadow-sm p-3 space-y-2`}>
      {s.section && (
        <p className="text-[10px] font-bold text-navy-400 uppercase tracking-wide">{s.section}</p>
      )}
      {s.category && (
        <span className="inline-flex items-center gap-1 text-[10px] text-navy-400 bg-navy-50 px-1.5 py-0.5 rounded-full border border-navy-100 capitalize">
          {CATEGORY_ICONS[s.category]}{s.category}
        </span>
      )}
      {s.excerpt && (
        <p className="text-xs text-navy-600 italic leading-relaxed line-clamp-2">"{s.excerpt}"</p>
      )}
      {s.explanation && (
        <p className="text-xs text-navy-500 leading-relaxed">{s.explanation}</p>
      )}
      {s.rewrite && (
        <div className="bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-2">
          <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide mb-1">Suggested</p>
          <div className="flex items-start gap-1.5">
            <p className="text-xs text-navy-900 leading-relaxed flex-1">{s.rewrite}</p>
            <button onClick={copy} className="shrink-0 p-1 rounded text-navy-400 hover:text-violet-600 transition-colors">
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Three-column results (resume suggestions) ─────────────────────────────────
function ThreeColumnResults({ allSuggestions }) {
  const rewrite   = allSuggestions.filter(s => s.severity === 'rewrite')
  const strengthen = allSuggestions.filter(s => s.severity === 'strengthen')
  const good      = allSuggestions.filter(s => s.severity === 'good')

  const col = (items, color, dot, label) => (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2 pb-1 border-b border-navy-100">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
        <h4 className={`text-xs font-bold uppercase tracking-wide ${color}`}>{label}</h4>
        <span className="ml-auto text-[10px] text-navy-400 font-medium">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.length === 0
          ? <p className="text-xs text-navy-300 italic px-1">None</p>
          : items.map((s, i) => <CompactSuggestionCard key={i} s={s} />)
        }
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      {col(rewrite,   'text-red-600',     'bg-red-500',     'Needs Rewrite')}
      {col(strengthen,'text-amber-600',   'bg-amber-400',   'Developing')}
      {col(good,      'text-emerald-600', 'bg-emerald-500', 'Strong')}
    </div>
  )
}

// ── Compact paragraph card (for cover letter three-column) ────────────────────
function CompactParagraphCard({ para }) {
  const [copied, setCopied] = useState(false)
  const cfg = PARA_RATING[para.rating] || PARA_RATING.developing
  return (
    <div className={`rounded-xl border border-navy-100 border-l-4 ${cfg.border} bg-white shadow-sm p-3 space-y-2`}>
      <p className="text-xs font-bold text-navy-700">{para.label}</p>
      {para.preview && (
        <p className="text-[11px] text-navy-400 italic line-clamp-1">"{para.preview}..."</p>
      )}
      {para.assessment && (
        <p className="text-xs text-navy-600 leading-relaxed">{para.assessment}</p>
      )}
      {para.suggestion && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
          <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">Coaching</p>
          <p className="text-xs text-navy-700 leading-relaxed">{para.suggestion}</p>
        </div>
      )}
      {para.rewrite && (
        <div className="bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-2">
          <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wide mb-1">Revised</p>
          <div className="flex items-start gap-1.5">
            <p className="text-xs text-navy-900 leading-relaxed flex-1 line-clamp-3">{para.rewrite}</p>
            <button
              onClick={() => { navigator.clipboard.writeText(para.rewrite); setCopied(true); setTimeout(() => setCopied(false), 1800) }}
              className="shrink-0 p-1 rounded text-navy-400 hover:text-violet-600 transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Three-column paragraphs (cover letter) ────────────────────────────────────
function ThreeColumnParagraphs({ paragraphs }) {
  const weak       = paragraphs.filter(p => p.rating === 'weak')
  const developing = paragraphs.filter(p => p.rating === 'developing')
  const strong     = paragraphs.filter(p => p.rating === 'strong')

  const col = (items, color, dot, label) => (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2 pb-1 border-b border-navy-100">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
        <h4 className={`text-xs font-bold uppercase tracking-wide ${color}`}>{label}</h4>
        <span className="ml-auto text-[10px] text-navy-400 font-medium">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.length === 0
          ? <p className="text-xs text-navy-300 italic px-1">None</p>
          : items.map((p, i) => <CompactParagraphCard key={i} para={p} />)
        }
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      {col(weak,       'text-red-600',     'bg-red-500',     'Weak')}
      {col(developing, 'text-amber-600',   'bg-amber-400',   'Developing')}
      {col(strong,     'text-emerald-600', 'bg-emerald-500', 'Strong')}
    </div>
  )
}

// ── Role context panel ────────────────────────────────────────────────────────
function RoleContextPanel({ roleContext }) {
  if (!roleContext) return null
  const { company_overview, role_overview, what_they_evaluate } = roleContext
  const noData = (!company_overview || company_overview === 'No company selected')
    && !role_overview
  if (noData) return null

  return (
    <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5 space-y-4">
      <h4 className="text-xs font-bold text-navy-500 uppercase tracking-wide flex items-center gap-1.5">
        <Building2 size={12} className="text-sky-500" /> Role and Company Context
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {company_overview && company_overview !== 'No company selected' && (
          <div>
            <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1.5">About the Company</p>
            <p className="text-sm text-navy-700 leading-relaxed">{company_overview}</p>
          </div>
        )}
        {role_overview && (
          <div>
            <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1.5">About the Role</p>
            <p className="text-sm text-navy-700 leading-relaxed">{role_overview}</p>
          </div>
        )}
      </div>
      {(what_they_evaluate || []).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-2">What They Evaluate</p>
          <div className="flex flex-wrap gap-2">
            {what_they_evaluate.map((item, i) => (
              <span key={i} className="text-xs bg-sky-50 border border-sky-200 text-sky-800 px-2.5 py-1 rounded-full leading-relaxed">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── JD alignment panel ────────────────────────────────────────────────────────
function JdAlignmentPanel({ jdAlignment }) {
  if (!jdAlignment) return null
  const { strong, partial, gaps } = jdAlignment
  const hasData = (strong?.length || 0) + (partial?.length || 0) + (gaps?.length || 0) > 0
  if (!hasData) return null

  const col = (items, color, dot, label, bg, border) => (
    <div className={`rounded-xl border ${border} ${bg} p-3 space-y-2`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <h5 className={`text-[10px] font-bold uppercase tracking-wide ${color}`}>{label}</h5>
        <span className="ml-auto text-[10px] text-navy-400">{(items || []).length}</span>
      </div>
      {(items || []).length === 0
        ? <p className="text-xs text-navy-300 italic">None identified</p>
        : (items || []).map((item, i) => (
            <p key={i} className="text-xs text-navy-700 leading-relaxed pl-1 border-l-2 border-navy-200">{item}</p>
          ))
      }
    </div>
  )

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-navy-500 uppercase tracking-wide flex items-center gap-1.5">
        <Target size={12} className="text-violet-500" /> JD Alignment
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {col(strong,  'text-emerald-700', 'bg-emerald-500', 'Covered',       'bg-emerald-50', 'border-emerald-200')}
        {col(partial, 'text-amber-700',   'bg-amber-400',   'Partially',     'bg-amber-50',   'border-amber-200')}
        {col(gaps,    'text-red-700',     'bg-red-500',     'Gaps',          'bg-red-50',     'border-red-200')}
      </div>
    </div>
  )
}

// ── Paragraph card (cover letter) ─────────────────────────────────────────────
const PARA_RATING = {
  strong:     { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', border: 'border-l-emerald-400' },
  developing: { dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',       border: 'border-l-amber-400'   },
  weak:       { dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 border-red-200',             border: 'border-l-red-400'     },
}

function ParagraphCard({ para }) {
  const [expanded, setExpanded] = useState(true)
  const [copied, setCopied] = useState(false)
  const cfg = PARA_RATING[para.rating] || PARA_RATING.developing

  return (
    <div className={`rounded-xl border border-navy-100 border-l-4 ${cfg.border} bg-white shadow-sm overflow-hidden`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left gap-3"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.badge} capitalize shrink-0`}>
            {para.rating || 'Review'}
          </span>
          <span className="text-xs font-medium text-navy-700 shrink-0">{para.label}</span>
          {para.preview && (
            <span className="text-xs text-navy-400 truncate hidden sm:block">"{para.preview}…"</span>
          )}
        </div>
        {expanded ? <ChevronUp size={14} className="text-navy-400 shrink-0" /> : <ChevronDown size={14} className="text-navy-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-navy-50">
          <div className="mt-3">
            <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1">Assessment</p>
            <p className="text-sm text-navy-700 leading-relaxed">{para.assessment}</p>
          </div>
          {para.suggestion && (
            <div>
              <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1">Coaching</p>
              <p className="text-sm text-navy-600 leading-relaxed bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{para.suggestion}</p>
            </div>
          )}
          {para.rewrite && (
            <div>
              <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1">Revised Version</p>
              <div className="flex items-start gap-2">
                <p className="text-sm text-navy-900 leading-relaxed flex-1 bg-violet-50 rounded-lg px-3 py-2">{para.rewrite}</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(para.rewrite); setCopied(true); setTimeout(() => setCopied(false), 1800) }}
                  className="shrink-0 mt-1 p-1.5 rounded-lg text-navy-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                  title="Copy revised version"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Shared job context panel ──────────────────────────────────────────────────
function JobContextPanel({ trackerJobs, onJobChange, onDescChange }) {
  const handleDesc = (v) => onDescChange?.(v)

  return (
    <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-navy-900">Target Job</h3>
        <p className="text-xs text-navy-400 mt-0.5">Select from your tracker for best results</p>
      </div>

      {/* Cascading company → role picker */}
      <JobSelector
        trackerJobs={trackerJobs}
        onChange={job => onJobChange?.(job)}
      />

      {/* Job description */}
      <div>
        <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
          Job Description <span className="text-navy-300 font-normal normal-case">(optional but recommended)</span>
        </label>
        <textarea
          className="input resize-none text-sm w-full"
          rows={4}
          placeholder="Paste the job description here for more targeted feedback…"
          onChange={e => handleDesc(e.target.value)}
        />
      </div>
    </div>
  )
}

// ── Tab 1: Resume Scanner ─────────────────────────────────────────────────────
function ResumeScanner({ hasResume, trackerJobs }) {
  const [selectedJob, setSelectedJob] = useState(null)
  const [jobDesc, setJobDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const progress = useAnalysisProgress(loading)

  const company = selectedJob?.company || ''
  const jobUrl  = selectedJob?.job_url || ''

  const analyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await coachApi.scanResume({
        job_description: jobDesc,
        company,
        job_url: jobUrl,
      })
      setResult(res.data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Analysis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!hasResume) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
          <FileText size={24} className="text-violet-500" />
        </div>
        <h3 className="text-base font-semibold text-navy-900">Upload your resume first</h3>
        <p className="text-sm text-navy-500 max-w-xs">
          Go to your <a href="/profile" className="text-violet-600 hover:underline">Profile</a> page and upload your resume PDF to unlock resume coaching.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <JobContextPanel
        trackerJobs={trackerJobs}
        onJobChange={setSelectedJob}
        onDescChange={setJobDesc}
      />

      <button onClick={analyze} disabled={loading} className="btn-primary w-full justify-center">
        {loading
          ? <><Loader2 size={14} className="animate-spin" /> Analyzing your resume…</>
          : <><Sparkles size={14} /> Analyze My Resume</>
        }
      </button>
      <AnalysisProgressBar loading={loading} progress={progress} />

      {error && <ErrorBox msg={error} />}

      {result && (() => {
        const sections = result.sections || (result.suggestions ? [{ name: 'Suggestions', suggestions: result.suggestions }] : [])
        const allSuggestions = sections.flatMap(s => s.suggestions || [])
        return (
          <div className="space-y-5">
            <ResultsHeader result={result} allSuggestions={allSuggestions} onReset={() => setResult(null)} />
            <RoleContextPanel roleContext={result.role_context} />
            {result.jd_alignment && <JdAlignmentPanel jdAlignment={result.jd_alignment} />}
            <ThreeColumnResults allSuggestions={allSuggestions} />
          </div>
        )
      })()}
    </div>
  )
}

// ── Tab 2: Cover Letter Coach ─────────────────────────────────────────────────
function CoverLetterCoach({ trackerJobs }) {
  const [selectedJob, setSelectedJob] = useState(null)
  const [jobDesc, setJobDesc] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [loading, setLoading] = useState(false)
  const progress = useAnalysisProgress(loading)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const company = selectedJob?.company || ''
  const jobUrl  = selectedJob?.job_url || ''

  const analyze = async () => {
    if (!coverLetter.trim()) { setError('Please paste your cover letter.'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await coachApi.coverLetter({
        cover_letter: coverLetter,
        job_id: selectedJob?.id,
        job_description: jobDesc,
        company,
        job_url: jobUrl,
      })
      setResult(res.data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: target job */}
        <JobContextPanel
          trackerJobs={trackerJobs}
          onJobChange={setSelectedJob}
          onDescChange={setJobDesc}
          />

        {/* Right: cover letter */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5 flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Your Cover Letter</h3>
            <p className="text-xs text-navy-400 mt-0.5">Paste or edit your current draft</p>
          </div>
          <textarea
            className="input resize-none text-sm flex-1 leading-relaxed"
            rows={14}
            placeholder="Paste your cover letter here…"
            value={coverLetter}
            onChange={e => { setCoverLetter(e.target.value); setResult(null) }}
          />
        </div>
      </div>

      <button onClick={analyze} disabled={loading} className="btn-primary w-full justify-center">
        {loading
          ? <><Loader2 size={14} className="animate-spin" /> Fetching company context &amp; analyzing…</>
          : <><Sparkles size={14} /> Coach My Cover Letter</>
        }
      </button>
      <AnalysisProgressBar loading={loading} progress={progress} />

      {error && <ErrorBox msg={error} />}

      {result && (
        <div className="space-y-5">
          {/* Score + narrative arc */}
          <ResultsHeader
            result={result}
            allSuggestions={[]}
            onReset={() => setResult(null)}
          />

          {/* Role + company context */}
          <RoleContextPanel roleContext={result.role_context} />

          {/* Company insight (brief, if role_context not present) */}
          {!result.role_context && result.company_insight && result.company_insight !== 'No company context available' && (
            <div className="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-xl p-4">
              <Building2 size={16} className="text-sky-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-sky-700 mb-1">Company Context</p>
                <p className="text-sm text-sky-800 leading-relaxed">{result.company_insight}</p>
              </div>
            </div>
          )}

          {/* JD alignment */}
          {result.jd_alignment && <JdAlignmentPanel jdAlignment={result.jd_alignment} />}

          {/* Three-column paragraph breakdown */}
          {(result.paragraphs || []).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-navy-500 uppercase tracking-wide">Paragraph Analysis</h4>
              <ThreeColumnParagraphs paragraphs={result.paragraphs} />
            </div>
          )}

          {/* Fallback: old flat suggestions format */}
          {!(result.paragraphs || []).length && (result.suggestions || []).length > 0 && (
            <div className="space-y-3">
              {result.suggestions.map((s, i) => <SuggestionCard key={i} s={s} />)}
            </div>
          )}

          {/* Questions to strengthen */}
          {(result.idea_prompts || []).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-navy-500 uppercase tracking-wide flex items-center gap-1.5">
                <Lightbulb size={12} className="text-amber-500" />
                Questions to Strengthen Your Letter
              </h4>
              {result.idea_prompts.map((p, i) => (
                <div key={i} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <Lightbulb size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-900 leading-relaxed">{p}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab 3: Application Questions ──────────────────────────────────────────────
function ApplicationQuestions({ trackerJobs }) {
  const [question, setQuestion] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
  const [jobDesc, setJobDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const progress = useAnalysisProgress(loading)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const company = selectedJob?.company || ''
  const jobUrl  = selectedJob?.job_url  || ''

  const analyze = async () => {
    if (!question.trim()) { setError('Please enter a question first.'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await coachApi.applicationQuestion({
        question,
        company,
        job_description: jobDesc,
        job_id: selectedJob?.id,
        job_url: jobUrl,
      })
      setResult(res.data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: target job */}
        <JobContextPanel
          trackerJobs={trackerJobs}
          onJobChange={setSelectedJob}
          onDescChange={setJobDesc}
          />

        {/* Right: question input */}
        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5 flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Application Question</h3>
            <p className="text-xs text-navy-400 mt-0.5">Paste any essay prompt, short answer, or written question</p>
          </div>
          <textarea
            className="input resize-none text-sm flex-1 leading-relaxed"
            rows={10}
            placeholder={`e.g. "Describe a time you had to influence a decision without formal authority."`}
            value={question}
            onChange={e => { setQuestion(e.target.value); setResult(null) }}
          />
        </div>
      </div>

      <button onClick={analyze} disabled={loading || !question.trim()} className="btn-primary w-full justify-center">
        {loading
          ? <><Loader2 size={14} className="animate-spin" /> Coaching…</>
          : <><Sparkles size={14} /> Get Coaching</>
        }
      </button>
      <AnalysisProgressBar loading={loading} progress={progress} />

      {error && <ErrorBox msg={error} />}

      {result && (
        <div className="space-y-4">
          {result.question_intent && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-sky-700 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                <BookOpen size={11} /> What This Question Is Testing
              </p>
              <p className="text-sm text-sky-900 leading-relaxed">{result.question_intent}</p>
            </div>
          )}
          {result.role_context && (
            <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5 space-y-3">
              <h4 className="text-xs font-bold text-navy-500 uppercase tracking-wide flex items-center gap-1.5">
                <Building2 size={12} className="text-sky-500" /> Company and Role Context
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {result.role_context.company_overview && result.role_context.company_overview !== 'No company selected' && (
                  <div>
                    <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1">About the Company</p>
                    <p className="text-sm text-navy-700 leading-relaxed">{result.role_context.company_overview}</p>
                  </div>
                )}
                {result.role_context.role_overview && (
                  <div>
                    <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1">About the Role</p>
                    <p className="text-sm text-navy-700 leading-relaxed">{result.role_context.role_overview}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {result.answer_strategy && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-violet-700 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                <Target size={11} /> Answer Strategy
              </p>
              <p className="text-sm text-violet-900 leading-relaxed">{result.answer_strategy}</p>
            </div>
          )}

          {result.outline && (
            <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5 space-y-3">
              <h4 className="text-xs font-semibold text-navy-500 uppercase tracking-wide">Suggested Outline</h4>
              {result.outline.opening && (
                <div>
                  <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1">Opening</p>
                  <p className="text-sm text-navy-800 leading-relaxed bg-navy-50 rounded-lg px-3 py-2">{result.outline.opening}</p>
                </div>
              )}
              {(result.outline.body_points || []).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1">Body</p>
                  <ul className="space-y-1.5">
                    {result.outline.body_points.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-navy-800 leading-relaxed">
                        <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-600 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.outline.closing && (
                <div>
                  <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-1">Closing</p>
                  <p className="text-sm text-navy-800 leading-relaxed bg-navy-50 rounded-lg px-3 py-2">{result.outline.closing}</p>
                </div>
              )}
            </div>
          )}

          {(result.resume_hooks || []).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-navy-500 uppercase tracking-wide flex items-center gap-1.5">
                <FileText size={11} /> From Your Resume
              </h4>
              {result.resume_hooks.map((h, i) => (
                <div key={i} className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <Check size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-900 leading-relaxed">{h}</p>
                </div>
              ))}
            </div>
          )}

          {result.watch_out && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-1">Watch Out</p>
                <p className="text-sm text-amber-900 leading-relaxed">{result.watch_out}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Coach Page ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'resume',    label: 'Resume Scanner',        icon: FileText },
  { id: 'cl',        label: 'Cover Letter Coach',     icon: BookOpen },
  { id: 'questions', label: 'Application Questions',  icon: MessageSquare },
]

export default function Coach() {
  const [activeTab, setActiveTab] = useState('resume')
  const [profile, setProfile] = useState(null)
  const [trackerJobs, setTrackerJobs] = useState([])

  useEffect(() => {
    profileApi.get()
      .then(res => setProfile(res.data.profile || null))
      .catch(() => {})
    // Load all tracker jobs for company/role selection
    jobsApi.getAll({ limit: 200 })
      .then(res => {
        const jobs = Array.isArray(res.data) ? res.data : (res.data?.jobs || [])
        setTrackerJobs(jobs)
      })
      .catch(() => {})
  }, [])

  const hasResume = !!(profile?.resume_filename)

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <Sparkles size={18} className="text-violet-600" />
          </div>
          <h1 className="text-2xl font-bold text-navy-900">Recruitment Coach</h1>
        </div>
        <p className="text-sm text-navy-500 ml-12">
          AI-powered coaching for your resume, cover letters, and application questions
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-navy-50 rounded-xl p-1 mb-8 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
              activeTab === id
                ? 'bg-white text-navy-900 shadow-sm'
                : 'text-navy-500 hover:text-navy-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'resume' && (
        <ResumeScanner hasResume={hasResume} trackerJobs={trackerJobs} />
      )}
      {activeTab === 'cl' && (
        <CoverLetterCoach trackerJobs={trackerJobs} />
      )}
      {activeTab === 'questions' && (
        <ApplicationQuestions trackerJobs={trackerJobs} />
      )}
    </div>
  )
}
