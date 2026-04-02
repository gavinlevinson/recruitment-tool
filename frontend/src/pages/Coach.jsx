import { useState, useEffect, useRef, useCallback } from 'react'
import {
  FileText, Sparkles, ChevronDown, ChevronUp, Copy, Check,
  Loader2, AlertTriangle, BookOpen, Lightbulb, RotateCcw,
  Star, Target, Building2, MessageSquare, Mic, MicOff,
  Square, Play, Clock, Volume2, X,
} from 'lucide-react'
import { coachApi, jobsApi, profileApi, coverLetterApi } from '../api'
import INTERVIEW_QUESTIONS, { ROLE_QUESTION_WEIGHTS, CATEGORY_LABELS } from '../data/interviewQuestions'

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

  // Cover letter templates
  const [templates, setTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [showCreateTpl, setShowCreateTpl] = useState(false)
  const [newTplName, setNewTplName] = useState('')
  const [savingTpl, setSavingTpl] = useState(false)
  const [savedTpl, setSavedTpl] = useState(false)

  useEffect(() => {
    coverLetterApi.getTemplates()
      .then(res => setTemplates(res.data || []))
      .catch(() => {})
  }, [])

  const handleSelectTemplate = (id) => {
    setSelectedTemplateId(id)
    if (id) {
      const tpl = templates.find(t => String(t.id) === String(id))
      if (tpl) setCoverLetter(tpl.content)
    }
    setResult(null)
  }

  const saveAsTemplate = async () => {
    if (!newTplName.trim() || !coverLetter.trim()) return
    setSavingTpl(true)
    try {
      await coverLetterApi.createTemplate({ name: newTplName.trim(), content: coverLetter.trim() })
      const res = await coverLetterApi.getTemplates()
      setTemplates(res.data || [])
      setShowCreateTpl(false)
      setNewTplName('')
      setSavedTpl(true)
      setTimeout(() => setSavedTpl(false), 2500)
    } catch (e) { console.error('Save template failed:', e) }
    finally { setSavingTpl(false) }
  }

  const deleteTemplate = async (id) => {
    try {
      await coverLetterApi.deleteTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
      if (String(selectedTemplateId) === String(id)) {
        setSelectedTemplateId('')
      }
    } catch (e) { console.error('Delete template failed:', e) }
  }

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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-navy-900">Your Cover Letter</h3>
              <p className="text-xs text-navy-400 mt-0.5">Paste, edit, or load from a saved template</p>
            </div>
            <button onClick={() => setShowCreateTpl(p => !p)}
              className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors">
              {showCreateTpl ? 'Cancel' : savedTpl ? '✓ Saved' : '+ Save as Template'}
            </button>
          </div>

          {/* Template selector */}
          <div className="flex items-center gap-2">
            <select
              className="input text-xs flex-1 appearance-none"
              value={selectedTemplateId}
              onChange={e => handleSelectTemplate(e.target.value)}
            >
              <option value="">Write from scratch</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {selectedTemplateId && (
              <button onClick={() => deleteTemplate(Number(selectedTemplateId))}
                className="text-xs text-red-400 hover:text-red-600 px-1" title="Delete template">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Save as template form */}
          {showCreateTpl && (
            <div className="flex items-center gap-2 p-2 bg-navy-50 rounded-lg border border-navy-100">
              <input className="input text-xs flex-1 py-1.5" placeholder="Template name (e.g. Consulting, Product, Banking)"
                value={newTplName} onChange={e => setNewTplName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveAsTemplate()} />
              <button onClick={saveAsTemplate} disabled={savingTpl || !newTplName.trim() || !coverLetter.trim()}
                className="btn-primary text-xs py-1.5 disabled:opacity-40">
                {savingTpl ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}

          <textarea
            className="input resize-none text-sm flex-1 leading-relaxed"
            rows={12}
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
  { id: 'interview', label: 'Interview Practice',     icon: Mic },
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
      {activeTab === 'interview' && (
        <InterviewPractice trackerJobs={trackerJobs} />
      )}
    </div>
  )
}


// ── Interview Practice ───────────────────────────────────────────────────────
const INTERVIEW_LENGTHS = [
  { minutes: 5,  label: '5 min',  questions: 3 },
  { minutes: 10, label: '10 min', questions: 5 },
  { minutes: 15, label: '15 min', questions: 7 },
  { minutes: 30, label: '30 min', questions: 12 },
]

const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null

function InterviewPractice({ trackerJobs }) {
  // Setup state
  const [selectedJob, setSelectedJob] = useState(null)
  const [lengthIdx, setLengthIdx] = useState(1) // default 10 min
  const [phase, setPhase] = useState('setup') // setup | active | scoring | results

  // Active interview state
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [currentCategory, setCurrentCategory] = useState('')
  const [questionsAsked, setQuestionsAsked] = useState(0)
  const [conversation, setConversation] = useState([])
  const [qaHistory, setQaHistory] = useState([])
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [voiceState, setVoiceState] = useState('idle') // idle | speaking | listening | processing
  const [timeLeft, setTimeLeft] = useState(0)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Results state
  const [results, setResults] = useState(null)

  // Refs
  const recognitionRef = useRef(null)
  const timerRef = useRef(null)
  const endTimeRef = useRef(null)
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null)
  const voiceRef = useRef(null)

  // Select the best available voice (prefer natural/enhanced voices)
  useEffect(() => {
    const pickVoice = () => {
      if (!synthRef.current) return
      const voices = synthRef.current.getVoices()
      if (!voices.length) return
      // Prefer: Google UK English > any "Natural" or "Enhanced" voice > first English voice
      const preferred = [
        v => /google.*uk/i.test(v.name),
        v => /natural|enhanced|premium/i.test(v.name) && /en/i.test(v.lang),
        v => v.name.includes('Samantha'),
        v => v.name.includes('Daniel'),
        v => v.lang.startsWith('en') && !v.localService,
        v => v.lang.startsWith('en'),
      ]
      for (const test of preferred) {
        const match = voices.find(test)
        if (match) { voiceRef.current = match; return }
      }
    }
    pickVoice()
    if (synthRef.current) synthRef.current.onvoiceschanged = pickVoice
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} }
      if (timerRef.current) clearInterval(timerRef.current)
      if (synthRef.current) synthRef.current.cancel()
    }
  }, [])

  // Browser support check
  if (!SpeechRecognition) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle size={32} className="text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-navy-900 mb-2">Browser Not Supported</h3>
        <p className="text-sm text-navy-500">
          Interview Practice requires speech recognition, which is only available in Chrome and Edge.
          Please open Orion in Google Chrome to use this feature.
        </p>
      </div>
    )
  }

  const companies = [...new Set(trackerJobs.map(j => j.company).filter(Boolean))]

  const startInterview = async () => {
    const length = INTERVIEW_LENGTHS[lengthIdx]
    endTimeRef.current = Date.now() + length.minutes * 60 * 1000
    setTimeLeft(length.minutes * 60)
    setPhase('active')
    setQaHistory([])
    setConversation([])
    setQuestionsAsked(0)
    setError(null)

    // Start timer
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(timerRef.current)
        endInterview()
      }
    }, 1000)

    // Get first question
    await fetchNextQuestion([], 0, '')
  }

  const fetchNextQuestion = async (conv, asked, questionText) => {
    setVoiceState('processing')
    setLoading(true)
    try {
      const res = await coachApi.interview({
        company: selectedJob?.company || '',
        role: selectedJob?.role || '',
        folder: selectedJob?.folder || '',
        job_description: selectedJob?.description || '',
        job_url: selectedJob?.job_url || '',
        conversation: conv,
        questions_asked: asked,
        question_text: questionText,
      })
      const data = res.data
      setCurrentQuestion(data.question)
      setCurrentCategory(data.category || '')
      if (!data.is_follow_up) setQuestionsAsked(prev => prev + 1)
      speakQuestion(data.question)
    } catch (e) {
      setError('Failed to get next question. Please try again.')
      setVoiceState('idle')
    } finally {
      setLoading(false)
    }
  }

  const speakQuestion = (text) => {
    setVoiceState('speaking')
    if (synthRef.current) synthRef.current.cancel()

    // Chrome has a bug where SpeechSynthesis cuts off after ~15s.
    // Fix: split into sentence chunks and chain them, plus use a
    // periodic resume() call to keep the audio stream alive.
    const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text]
    const chunks = []
    let current = ''
    for (const s of sentences) {
      if ((current + s).length > 120) {
        if (current) chunks.push(current.trim())
        current = s
      } else {
        current += s
      }
    }
    if (current.trim()) chunks.push(current.trim())

    // Chrome workaround: periodically call resume() to prevent audio cutoff
    const keepAlive = setInterval(() => {
      if (synthRef.current && synthRef.current.speaking) synthRef.current.resume()
    }, 5000)

    const speakChunk = (i) => {
      if (i >= chunks.length) {
        clearInterval(keepAlive)
        startListening()
        return
      }
      const utterance = new SpeechSynthesisUtterance(chunks[i])
      if (voiceRef.current) utterance.voice = voiceRef.current
      utterance.rate = 0.92
      utterance.pitch = 1.0
      utterance.onend = () => speakChunk(i + 1)
      utterance.onerror = () => { clearInterval(keepAlive); startListening() }
      synthRef.current.speak(utterance)
    }
    speakChunk(0)
  }

  const startListening = () => {
    setVoiceState('listening')
    setTranscript('')
    setInterimText('')

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' '
        } else {
          interim = event.results[i][0].transcript
        }
      }
      setTranscript(final.trim())
      setInterimText(interim)
    }

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.error('Speech recognition error:', e.error)
      }
    }

    recognition.onend = () => {
      // Only restart if still in listening state
      if (recognitionRef.current === recognition) {
        try { recognition.start() } catch {}
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current
      recognitionRef.current = null
      try { ref.stop() } catch {}
    }
  }

  const submitAnswer = async () => {
    stopListening()
    const answer = transcript.trim()
    if (!answer) { startListening(); return }

    const newConv = [
      ...conversation,
      { role: 'interviewer', content: currentQuestion },
      { role: 'candidate', content: answer },
    ]
    const newQa = [...qaHistory, { question: currentQuestion, answer, category: currentCategory }]
    setConversation(newConv)
    setQaHistory(newQa)
    setTranscript('')
    setInterimText('')

    // Check if we should end
    const maxQ = INTERVIEW_LENGTHS[lengthIdx].questions
    if (questionsAsked >= maxQ || timeLeft <= 10) {
      endInterview(newQa)
      return
    }

    await fetchNextQuestion(newConv, questionsAsked, currentQuestion)
  }

  const endInterview = async (finalQa) => {
    clearInterval(timerRef.current)
    stopListening()
    if (synthRef.current) synthRef.current.cancel()
    setVoiceState('idle')

    let qa = finalQa || qaHistory
    // If user ends mid-question, include their in-progress answer
    if (!finalQa && transcript.trim() && currentQuestion) {
      qa = [...qa, { question: currentQuestion, answer: transcript.trim(), category: currentCategory }]
    }
    if (qa.length === 0) {
      setPhase('setup')
      return
    }

    setPhase('scoring')
    try {
      const res = await coachApi.interviewScore({
        company: selectedJob?.company || '',
        role: selectedJob?.role || '',
        folder: selectedJob?.folder || '',
        qa_pairs: qa,
      })
      setResults(res.data)
      setPhase('results')
    } catch {
      setError('Failed to score interview. Please try again.')
      setPhase('setup')
    }
  }

  const resetInterview = () => {
    setPhase('setup')
    setResults(null)
    setQaHistory([])
    setConversation([])
    setCurrentQuestion('')
    setQuestionsAsked(0)
    setTranscript('')
    setInterimText('')
    setError(null)
    setVoiceState('idle')
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // ── SETUP PHASE ──
  if (phase === 'setup') {
    return (
      <div className="space-y-6">
        <div className="card p-6 space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
              <Mic size={18} className="text-violet-600" />
              Behavioral Interview Practice
            </h3>
            <p className="text-sm text-navy-500 mt-1">
              Practice answering behavioral questions with an AI interviewer. Uses your microphone for a realistic experience.
              Works best in Google Chrome.
            </p>
          </div>

          {/* Job selection */}
          <div>
            <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
              Practice for a specific role <span className="text-navy-300 font-normal normal-case">(optional)</span>
            </label>
            <select
              className="input"
              value={selectedJob ? trackerJobs.indexOf(selectedJob) : ''}
              onChange={e => setSelectedJob(e.target.value !== '' ? trackerJobs[e.target.value] : null)}
            >
              <option value="">General behavioral interview</option>
              {trackerJobs.map((j, i) => (
                <option key={i} value={i}>{j.company} — {j.role}</option>
              ))}
            </select>
          </div>

          {/* Interview length */}
          <div>
            <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
              Interview Length
            </label>
            <div className="flex rounded-lg border border-navy-200 overflow-hidden">
              {INTERVIEW_LENGTHS.map((len, i) => (
                <button
                  key={i}
                  onClick={() => setLengthIdx(i)}
                  className={`flex-1 px-3 py-2.5 text-sm font-semibold transition-colors ${
                    lengthIdx === i
                      ? 'bg-violet-600 text-white'
                      : 'bg-white text-navy-600 hover:bg-navy-50'
                  }`}
                >
                  {len.label}
                  <span className="block text-[10px] font-normal opacity-70">~{len.questions} questions</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startInterview}
            className="w-full btn-primary py-3 text-base font-semibold flex items-center justify-center gap-2"
          >
            <Play size={18} /> Start Interview
          </button>
        </div>

        {error && (
          <div className="card p-4 border-l-4 border-red-400 flex items-start gap-2">
            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    )
  }

  // ── SCORING PHASE ──
  if (phase === 'scoring') {
    return (
      <div className="card p-12 flex flex-col items-center text-center gap-4">
        <Loader2 size={32} className="text-violet-600 animate-spin" />
        <h3 className="text-lg font-semibold text-navy-900">Scoring your interview...</h3>
        <p className="text-sm text-navy-500">Evaluating {qaHistory.length} answer{qaHistory.length !== 1 ? 's' : ''}</p>
      </div>
    )
  }

  // ── RESULTS PHASE ──
  if (phase === 'results' && results) {
    const scoreColor = results.overall_score >= 70 ? 'text-emerald-600' :
                       results.overall_score >= 45 ? 'text-amber-600' : 'text-red-600'
    const scoreBg = results.overall_score >= 70 ? 'bg-emerald-50 border-emerald-200' :
                    results.overall_score >= 45 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

    return (
      <div className="space-y-6">
        {/* Overall score */}
        <div className={`card p-6 border ${scoreBg} text-center`}>
          <p className={`text-5xl font-black ${scoreColor}`}>{results.overall_score}</p>
          <p className="text-sm font-semibold text-navy-700 mt-1">Overall Score</p>
          <p className="text-sm text-navy-500 mt-3 max-w-lg mx-auto">{results.narrative_summary}</p>
        </div>

        {/* Per-question scores */}
        <div className="space-y-4">
          {(results.questions || []).map((q, i) => {
            const avg = ((q.structure + q.specificity + q.relevance) / 3).toFixed(1)
            const sevClass = q.severity === 'strong' ? 'bg-emerald-50 border-emerald-200' :
                             q.severity === 'developing' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
            const sevDot = q.severity === 'strong' ? 'bg-emerald-400' :
                           q.severity === 'developing' ? 'bg-amber-400' : 'bg-red-400'
            return (
              <div key={i} className={`card p-5 border ${sevClass}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${sevDot}`} />
                      <span className="text-xs font-semibold text-navy-500 uppercase">Question {i + 1}</span>
                    </div>
                    <p className="text-sm font-medium text-navy-800">{q.question}</p>
                  </div>
                  <span className="text-lg font-bold text-navy-700">{avg}</span>
                </div>
                {q.answer_summary && (
                  <p className="text-xs text-navy-400 italic mb-3">Your answer: {q.answer_summary}</p>
                )}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    { label: 'Structure', val: q.structure },
                    { label: 'Specificity', val: q.specificity },
                    { label: 'Relevance', val: q.relevance },
                  ].map(d => (
                    <div key={d.label} className="text-center">
                      <p className="text-lg font-bold text-navy-800">{d.val}</p>
                      <p className="text-[10px] text-navy-400 uppercase">{d.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-navy-600">{q.feedback}</p>
              </div>
            )
          })}
        </div>

        <button onClick={resetInterview} className="btn-secondary w-full py-3 flex items-center justify-center gap-2">
          <RotateCcw size={16} /> Try Another Interview
        </button>
      </div>
    )
  }

  // ── ACTIVE INTERVIEW PHASE ──
  return (
    <div className="space-y-4">
      {/* Timer + controls bar */}
      <div className="card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
            timeLeft <= 60 ? 'bg-red-100 text-red-700' : 'bg-navy-100 text-navy-700'
          }`}>
            <Clock size={14} />
            {formatTime(timeLeft)}
          </div>
          <span className="text-xs text-navy-400">
            Question {questionsAsked} of ~{INTERVIEW_LENGTHS[lengthIdx].questions}
          </span>
        </div>
        <button
          onClick={() => endInterview()}
          className="px-4 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 transition-colors flex items-center gap-1.5"
        >
          <Square size={12} /> End Interview
        </button>
      </div>

      {/* Current question */}
      <div className="card p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
            <Volume2 size={16} className="text-violet-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-navy-400 uppercase tracking-wide mb-1">
              {currentCategory ? CATEGORY_LABELS[currentCategory] || currentCategory : 'Question'}
            </p>
            <p className="text-base text-navy-900 font-medium leading-relaxed">
              {currentQuestion || 'Preparing your question...'}
            </p>
          </div>
        </div>

        {/* Voice state indicator */}
        <div className="flex items-center justify-center py-4">
          {voiceState === 'speaking' && (
            <div className="flex items-center gap-2 text-violet-600">
              <Volume2 size={20} className="animate-pulse" />
              <span className="text-sm font-medium">Interviewer is speaking...</span>
            </div>
          )}
          {voiceState === 'listening' && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
                <Mic size={28} className="text-red-600" />
              </div>
              <span className="text-sm font-medium text-red-600">Listening... speak your answer</span>
            </div>
          )}
          {voiceState === 'processing' && (
            <div className="flex items-center gap-2 text-navy-500">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm font-medium">Thinking...</span>
            </div>
          )}
        </div>

        {/* Live transcript */}
        {(transcript || interimText) && (
          <div className="bg-navy-50 rounded-xl p-4 mt-2">
            <p className="text-xs text-navy-400 uppercase tracking-wide mb-1">Your answer</p>
            <p className="text-sm text-navy-700 leading-relaxed">
              {transcript}
              {interimText && <span className="text-navy-400">{interimText}</span>}
            </p>
          </div>
        )}

        {/* Action buttons */}
        {voiceState === 'listening' && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={submitAnswer}
              disabled={!transcript.trim()}
              className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              Next Question
            </button>
          </div>
        )}
      </div>

      {/* Q&A history */}
      {qaHistory.length > 0 && (
        <div className="card p-4">
          <p className="text-xs text-navy-400 uppercase tracking-wide mb-3">Previous answers</p>
          <div className="space-y-3">
            {qaHistory.map((qa, i) => (
              <div key={i} className="bg-navy-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-navy-600 mb-1">Q{i + 1}: {qa.question}</p>
                <p className="text-xs text-navy-500 line-clamp-2">{qa.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="card p-4 border-l-4 border-red-400 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}
