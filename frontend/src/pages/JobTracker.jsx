import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, ExternalLink, Search, X,
  ChevronDown, ChevronUp, Check, RefreshCw, Briefcase, MapPin,
  Calendar, DollarSign, User, FileText, Building2,
  Link2, AlertCircle, Folder, Star, Users, Mail,
  Linkedin, Copy, Sparkles, GraduationCap, Loader2, Send, Paperclip,
  ClipboardList, Save,
} from 'lucide-react'
import { jobsApi, contactsApi, networkingApi, emailTemplatesApi, nylasApi, interviewRoundsApi } from '../api'
import { useAuth } from '../context/AuthContext'

// ── Constants ─────────────────────────────────────────────────────────────────
const KANBAN_COLS    = ['Not Applied', 'Under Review', 'Interviewing']
const STATUS_OPTIONS = ['Not Applied', 'Under Review', 'Interviewing', 'Accepted', 'Rejected']
const SOURCE_OPTIONS = [
  'LinkedIn', 'YC / Work at a Startup', 'Handshake',
  'Ali Rohde Jobs', 'Company Website', 'Referral', 'Recruiter', 'Other',
]
const ROLE_FOLDERS = ['Engineering', 'Revenue', 'Operations', 'Strategy', 'Research', 'Growth']

const COL_CONFIG = {
  'Not Applied':  { dot: 'bg-slate-400',   label: 'text-slate-700',   colBg: 'bg-slate-50',   dropBg: 'bg-slate-100',   border: 'border-slate-200',   count: 'bg-slate-100 text-slate-600 border-slate-200' },
  'Under Review': { dot: 'bg-sky-400',     label: 'text-sky-700',     colBg: 'bg-sky-50',     dropBg: 'bg-sky-100',     border: 'border-sky-200',     count: 'bg-sky-100 text-sky-700 border-sky-200'       },
  'Interviewing': { dot: 'bg-amber-400',   label: 'text-amber-700',   colBg: 'bg-amber-50',   dropBg: 'bg-amber-100',   border: 'border-amber-200',   count: 'bg-amber-100 text-amber-700 border-amber-200' },
  'Accepted':     { dot: 'bg-emerald-400', label: 'text-emerald-700', colBg: 'bg-emerald-50', dropBg: 'bg-emerald-100', border: 'border-emerald-200', count: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  'Rejected':     { dot: 'bg-red-400',     label: 'text-red-600',     colBg: 'bg-red-50',     dropBg: 'bg-red-100',     border: 'border-red-200',     count: 'bg-red-100 text-red-600 border-red-200'       },
}

const STATUS_CLASS = {
  'Not Applied':  'status-not-applied',
  'Under Review': 'status-applied',
  'Interviewing': 'status-pending',
  'Accepted':     'status-accepted',
  'Rejected':     'status-rejected',
}

const EMPTY_FORM = {
  company: '', role: '', status: 'Under Review', date_applied: '',
  salary_range: '', location: '', notes: '', job_url: '',
  referral: false, referral_name: '', source: 'LinkedIn', folder: '', starred: false,
  deadline: '', interview_date: '', reminder_date: '',
}

// ── Company Logo ──────────────────────────────────────────────────────────────
function CompanyLogo({ company, size = 44 }) {
  const initials = (company || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const domain = (company || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'
  const src = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=64`
  const [failed, setFailed] = useState(false)

  if (!company || failed) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-violet-100 text-violet-700 font-bold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.33 }}
      >
        {initials}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={company}
      onError={() => setFailed(true)}
      className="rounded-xl object-contain bg-white border border-navy-100 shrink-0"
      style={{ width: size, height: size }}
    />
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[status] || 'status-not-applied'}`}>
      {status}
    </span>
  )
}

// ── Job Form Modal ────────────────────────────────────────────────────────────
function JobModal({ isOpen, onClose, onSave, initialData }) {
  const [form, setForm]     = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      setForm(initialData ? { ...EMPTY_FORM, ...initialData } : { ...EMPTY_FORM })
      setErrors({})
    }
  }, [isOpen, initialData])

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const validate = () => {
    const errs = {}
    if (!form.company.trim()) errs.company = 'Company is required'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-100">
          <h2 className="text-lg font-semibold text-navy-900">
            {initialData ? 'Edit Job' : 'Add New Job'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-50 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
                Company <span className="text-red-400">*</span>
              </label>
              <input
                className={`input ${errors.company ? 'border-red-400' : ''}`}
                placeholder="e.g. Acme Corp"
                value={form.company}
                onChange={e => set('company', e.target.value)}
              />
              {errors.company && <p className="mt-1 text-xs text-red-500">{errors.company}</p>}
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Role</label>
              <input className="input" placeholder="e.g. Strategy Associate" value={form.role} onChange={e => set('role', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Status</label>
              <div className="relative">
                <select className="input appearance-none pr-8" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Folder</label>
              <div className="relative">
                <select className="input appearance-none pr-8" value={form.folder || ''} onChange={e => set('folder', e.target.value)}>
                  <option value="">Unfiled</option>
                  {ROLE_FOLDERS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Date Applied</label>
              <input type="date" className="input" value={form.date_applied} onChange={e => set('date_applied', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Salary Range</label>
              <input className="input" placeholder="e.g. $100k–$130k" value={form.salary_range} onChange={e => set('salary_range', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Location</label>
              <input className="input" placeholder="e.g. New York, NY" value={form.location} onChange={e => set('location', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Source</label>
              <div className="relative">
                <select className="input appearance-none pr-8" value={form.source} onChange={e => set('source', e.target.value)}>
                  {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Job URL</label>
              <input className="input" placeholder="https://..." value={form.job_url} onChange={e => set('job_url', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Application Deadline</span>
              </label>
              <input type="date" className="input" value={form.deadline || ''} onChange={e => set('deadline', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />Interview Date</span>
              </label>
              <input type="date" className="input" value={form.interview_date || ''} onChange={e => set('interview_date', e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />Reminder Date</span>
              </label>
              <input type="date" className="input" value={form.reminder_date || ''} onChange={e => set('reminder_date', e.target.value)} />
            </div>

            <div className="col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => set('referral', !form.referral)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.referral ? 'bg-violet-600' : 'bg-navy-200'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${form.referral ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm font-medium text-navy-700">Referral</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => set('starred', !form.starred)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.starred ? 'bg-amber-400' : 'bg-navy-200'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${form.starred ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm font-medium text-navy-700">Priority</span>
              </label>
            </div>

            {form.referral && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Referral Name</label>
                <input className="input" placeholder="Who referred you?" value={form.referral_name} onChange={e => set('referral_name', e.target.value)} />
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Notes</label>
              <textarea className="input resize-none" rows={3} placeholder="Add any notes..." value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-navy-50">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <><RefreshCw size={14} className="animate-spin" /> Saving…</> : <><Check size={14} /> {initialData ? 'Save Changes' : 'Add Job'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Interview Date Prompt ──────────────────────────────────────────────────────
function InterviewDateModal({ isOpen, company, onConfirm, onSkip, onCancel }) {
  const [date, setDate] = useState('')
  useEffect(() => { if (isOpen) setDate('') }, [isOpen])
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10">
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-navy-100">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <Calendar size={18} className="text-violet-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-navy-900">Interview Scheduled?</h2>
            <p className="text-xs text-navy-400">{company} → Interviewing</p>
          </div>
          <button onClick={onCancel} className="ml-auto p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-50 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">
          <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Interview Date</label>
          <input type="date" autoFocus className="input w-full" value={date} onChange={e => setDate(e.target.value)} />
          <p className="mt-2 text-xs text-navy-400">This will appear on your Calendar automatically. You can always update it later.</p>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onSkip} className="flex-1 px-3 py-2 rounded-lg border border-navy-200 text-sm font-medium text-navy-500 hover:bg-navy-50 transition-colors">
            Skip for now
          </button>
          <button onClick={() => onConfirm(date || null)} className="flex-1 btn-primary justify-center">
            <Check size={13} /> {date ? 'Save Date' : 'Confirm Move'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Shown when LEAVING Interviewing — ask if interview is still happening
function ConfirmInterviewModal({ isOpen, company, newStatus, onKeep, onRemove }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10">
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-navy-100">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Calendar size={18} className="text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-navy-900">Interview date still set</h2>
            <p className="text-xs text-navy-400">{company} → {newStatus}</p>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-navy-600">
            This job has an interview date on your calendar. Is the interview still happening?
          </p>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onRemove} className="flex-1 px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
            Remove from Calendar
          </button>
          <button onClick={onKeep} className="flex-1 btn-primary justify-center">
            <Check size={13} /> Keep it
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Interview Rounds ──────────────────────────────────────────────────────────
const INTERVIEW_TYPES = ['Screening', 'Technical', 'Behavioral', 'Case Study', 'Final Round', 'Offer Discussion', 'Other']
const TYPE_COLORS = {
  'Screening':        'bg-sky-100 text-sky-700 border-sky-200',
  'Technical':        'bg-violet-100 text-violet-700 border-violet-200',
  'Behavioral':       'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Case Study':       'bg-amber-100 text-amber-700 border-amber-200',
  'Final Round':      'bg-red-100 text-red-700 border-red-200',
  'Offer Discussion': 'bg-teal-100 text-teal-700 border-teal-200',
  'Other':            'bg-slate-100 text-slate-600 border-slate-200',
}

function InterviewRoundsSection({ jobId }) {
  const [rounds, setRounds]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({
    round_number: 1, interview_type: 'Screening', scheduled_date: '',
    interviewer_name: '', interviewer_linkedin: '', notes: '', status: 'Scheduled',
  })

  const loadRounds = useCallback(async () => {
    try {
      const res = await interviewRoundsApi.getAll(jobId)
      setRounds(res.data || [])
    } catch {}
    finally { setLoading(false) }
  }, [jobId])

  useEffect(() => { loadRounds() }, [loadRounds])

  const openAdd = () => {
    setForm({ round_number: rounds.length + 1, interview_type: 'Screening', scheduled_date: '',
      interviewer_name: '', interviewer_linkedin: '', notes: '', status: 'Scheduled' })
    setEditId(null)
    setShowForm(true)
  }

  const openEdit = (r) => {
    setForm({
      round_number: r.round_number, interview_type: r.interview_type || 'Screening',
      scheduled_date: r.scheduled_date || '', interviewer_name: r.interviewer_name || '',
      interviewer_linkedin: r.interviewer_linkedin || '', notes: r.notes || '',
      status: r.status || 'Scheduled',
    })
    setEditId(r.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editId) {
        await interviewRoundsApi.update(editId, form)
      } else {
        await interviewRoundsApi.create(jobId, form)
      }
      setShowForm(false)
      setEditId(null)
      await loadRounds()
    } catch {}
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try {
      await interviewRoundsApi.delete(id)
      setRounds(prev => prev.filter(r => r.id !== id))
    } catch {}
  }

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const statusColors = { Scheduled: 'text-violet-600', Completed: 'text-emerald-600', Cancelled: 'text-red-500' }

  return (
    <div className="border-t border-navy-100 pt-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={14} className="text-navy-400" />
          <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide">Interview Rounds</p>
          {rounds.length > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">{rounds.length}</span>
          )}
        </div>
        {!showForm && (
          <button onClick={openAdd} className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors">
            <Plus size={13} /> Add Round
          </button>
        )}
      </div>

      {loading && <p className="text-xs text-navy-300 italic">Loading…</p>}

      {rounds.map(r => (
        <div key={r.id} className="rounded-xl border border-navy-100 bg-navy-50/50 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-navy-700">Round {r.round_number}</span>
              {r.interview_type && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLORS[r.interview_type] || TYPE_COLORS['Other']}`}>
                  {r.interview_type}
                </span>
              )}
              <span className={`text-[10px] font-medium ${statusColors[r.status] || 'text-navy-400'}`}>{r.status}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => openEdit(r)} className="p-1 rounded text-navy-400 hover:text-navy-700 hover:bg-white transition-colors">
                <Pencil size={11} />
              </button>
              <button onClick={() => handleDelete(r.id)} className="p-1 rounded text-navy-400 hover:text-red-500 hover:bg-white transition-colors">
                <Trash2 size={11} />
              </button>
            </div>
          </div>

          {r.scheduled_date && (
            <p className="text-xs text-navy-500 flex items-center gap-1">
              <Calendar size={11} className="text-navy-400" />
              {(() => {
                const [y,m,d] = r.scheduled_date.split('-').map(Number)
                return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
              })()}
            </p>
          )}

          {r.interviewer_name && (
            <div className="flex items-center gap-1.5">
              <User size={11} className="text-navy-400 shrink-0" />
              <span className="text-xs text-navy-600 font-medium">{r.interviewer_name}</span>
              {r.interviewer_linkedin && (
                <a href={r.interviewer_linkedin} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-sky-600 hover:text-sky-800 hover:underline flex items-center gap-0.5">
                  <Linkedin size={10} /> LinkedIn
                </a>
              )}
            </div>
          )}

          {r.notes && (
            <p className="text-xs text-navy-500 italic leading-relaxed border-t border-navy-100 pt-2 mt-1">{r.notes}</p>
          )}
        </div>
      ))}

      {rounds.length === 0 && !loading && !showForm && (
        <p className="text-xs text-navy-300 italic">No rounds tracked yet. Add one to see it on your calendar.</p>
      )}

      {showForm && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
          <p className="text-xs font-semibold text-navy-700">{editId ? 'Edit Round' : 'New Round'}</p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-navy-500 mb-1 uppercase tracking-wide">Round #</label>
              <select className="input text-xs appearance-none" value={form.round_number}
                onChange={e => setF('round_number', parseInt(e.target.value))}>
                {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-navy-500 mb-1 uppercase tracking-wide">Type</label>
              <select className="input text-xs appearance-none" value={form.interview_type}
                onChange={e => setF('interview_type', e.target.value)}>
                {INTERVIEW_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-navy-500 mb-1 uppercase tracking-wide">Date</label>
              <input type="date" className="input text-xs" value={form.scheduled_date}
                onChange={e => setF('scheduled_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-navy-500 mb-1 uppercase tracking-wide">Status</label>
              <select className="input text-xs appearance-none" value={form.status}
                onChange={e => setF('status', e.target.value)}>
                {['Scheduled','Completed','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-navy-500 mb-1 uppercase tracking-wide">Interviewer Name</label>
            <input className="input text-xs" placeholder="e.g. Sarah Chen" value={form.interviewer_name}
              onChange={e => setF('interviewer_name', e.target.value)} />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-navy-500 mb-1 uppercase tracking-wide">Interviewer LinkedIn</label>
            <input className="input text-xs" placeholder="https://linkedin.com/in/..." value={form.interviewer_linkedin}
              onChange={e => setF('interviewer_linkedin', e.target.value)} />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-navy-500 mb-1 uppercase tracking-wide">Notes</label>
            <textarea className="input text-xs resize-none" rows={2}
              placeholder="Prep notes, topics covered, impressions…"
              value={form.notes} onChange={e => setF('notes', e.target.value)} />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => { setShowForm(false); setEditId(null) }}
              className="flex-1 px-3 py-1.5 rounded-lg border border-navy-200 text-xs font-medium text-navy-500 hover:bg-white transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 btn-primary text-xs py-1.5 justify-center">
              {saving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
              {editId ? 'Save Changes' : 'Add Round'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────
function DetailPanel({ job, onClose, onEdit, onDelete, onViewNetwork }) {
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => { setDeleteConfirm(false) }, [job?.id])

  if (!job) return null

  const Detail = ({ icon: Icon, label, value }) => {
    if (!value) return null
    return (
      <div className="flex items-start gap-3">
        <Icon size={15} className="text-navy-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs text-navy-400 uppercase tracking-wide font-semibold">{label}</p>
          <p className="text-sm text-navy-700 mt-0.5">{value}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-navy-900/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-start gap-4 p-6 border-b border-navy-100">
          <CompanyLogo company={job.company} size={52} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-navy-900 truncate">{job.company || 'Unknown'}</h2>
              {job.starred && <Star size={16} className="text-amber-400 fill-amber-400 shrink-0" />}
            </div>
            <p className="text-sm text-navy-500 truncate mt-0.5">{job.role || 'No role specified'}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <StatusBadge status={job.status || 'Not Applied'} />
              {job.folder && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                  <Folder size={9} />{job.folder}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-50 transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {job.discovered_job_id && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200">
              <span className="text-xs font-medium text-violet-700">Added from Job Discovery</span>
            </div>
          )}

          <div className="space-y-4">
            <Detail icon={Calendar} label="Date Applied"
              value={job.date_applied
                ? new Date(job.date_applied).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : null}
            />
            {job.deadline && (() => {
              const [y,m,d] = job.deadline.split('-').map(Number)
              const dt = new Date(y, m-1, d)
              const today = new Date(); today.setHours(0,0,0,0)
              const delta = Math.round((dt - today) / 86400000)
              const label = delta < 0 ? `${Math.abs(delta)}d ago` : delta === 0 ? 'Today' : `in ${delta}d`
              const color = delta < 0 ? 'text-red-600' : delta <= 3 ? 'text-amber-600' : 'text-navy-500'
              return (
                <div className="flex items-start gap-3">
                  <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-navy-400 uppercase tracking-wide font-semibold">Deadline</p>
                    <p className="text-sm text-navy-700 mt-0.5">
                      {dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      <span className={`ml-2 text-xs font-semibold ${color}`}>({label})</span>
                    </p>
                  </div>
                </div>
              )
            })()}
            {job.interview_date && (() => {
              const [y,m,d] = job.interview_date.split('-').map(Number)
              const dt = new Date(y, m-1, d)
              const today = new Date(); today.setHours(0,0,0,0)
              const delta = Math.round((dt - today) / 86400000)
              const label = delta < 0 ? `${Math.abs(delta)}d ago` : delta === 0 ? 'Today' : `in ${delta}d`
              const color = delta < 0 ? 'text-navy-400' : delta <= 3 ? 'text-amber-600' : 'text-violet-600'
              return (
                <div className="flex items-start gap-3">
                  <Calendar size={15} className="text-violet-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-navy-400 uppercase tracking-wide font-semibold">Interview Date</p>
                    <p className="text-sm text-navy-700 mt-0.5">
                      {dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      <span className={`ml-2 text-xs font-semibold ${color}`}>({label})</span>
                    </p>
                  </div>
                </div>
              )
            })()}
            {job.reminder_date && (() => {
              const [y,m,d] = job.reminder_date.split('-').map(Number)
              const dt = new Date(y, m-1, d)
              return (
                <div className="flex items-start gap-3">
                  <AlertCircle size={15} className="text-sky-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-navy-400 uppercase tracking-wide font-semibold">Reminder</p>
                    <p className="text-sm text-navy-700 mt-0.5">
                      {dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )
            })()}
            <Detail icon={MapPin} label="Location" value={job.location} />
            <Detail icon={DollarSign} label="Salary Range" value={job.salary_range} />
            <Detail icon={Building2} label="Source" value={job.discovered_job_id ? 'Job Discovery' : job.source} />
            {job.referral && <Detail icon={User} label="Referral" value={job.referral_name || 'Yes'} />}
            <div className="flex items-start gap-3">
              <Link2 size={15} className="text-navy-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-navy-400 uppercase tracking-wide font-semibold">Job URL</p>
                {job.job_url ? (
                  <a href={job.job_url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-violet-600 hover:text-violet-800 flex items-center gap-1 mt-0.5">
                    Open posting <ExternalLink size={12} />
                  </a>
                ) : (
                  <p className="text-sm text-navy-300 italic mt-0.5">No URL saved</p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-navy-100 pt-5">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={14} className="text-navy-400" />
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide">Notes</p>
            </div>
            <p className="text-sm text-navy-700 whitespace-pre-wrap leading-relaxed">
              {job.notes || <span className="text-navy-300 italic">No notes added.</span>}
            </p>
          </div>

          <InterviewRoundsSection jobId={job.id} />
        </div>

        <div className="p-6 border-t border-navy-100 space-y-2">
          <button onClick={() => onViewNetwork(job)} className="btn-primary w-full justify-center">
            <Users size={14} /> View My Network
          </button>
          <div className="flex gap-3">
          <button onClick={() => onEdit(job)} className="btn-secondary flex-1 justify-center">
            <Pencil size={14} /> Edit
          </button>
          {deleteConfirm ? (
            <div className="flex gap-2 flex-1">
              <button
                onClick={() => { onDelete(job.id); onClose() }}
                className="flex-1 px-3 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} />{job.discovered_job_id ? 'Remove' : 'Delete'}
              </button>
              <button onClick={() => setDeleteConfirm(false)}
                className="px-3 py-2 rounded-lg text-navy-500 text-sm border border-navy-200 hover:bg-navy-50 transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setDeleteConfirm(true)}
              className="flex-1 justify-center px-3 py-2 rounded-lg text-red-500 text-sm font-medium border border-red-200 hover:bg-red-50 transition-colors flex items-center gap-1.5">
              <Trash2 size={14} />{job.discovered_job_id ? 'Remove' : 'Delete'}
            </button>
          )}
          </div>
        </div>
        {job.discovered_job_id && (
          <p className="px-6 pb-4 text-xs text-navy-400">
            Removing this job will return it to the Discovery page.
          </p>
        )}
      </div>
    </>
  )
}

// ── Kanban Card ───────────────────────────────────────────────────────────────
function KanbanCard({ job, highlighted, dimmed, onClick, onStar, onDragStart, onDragEnd, compact = false }) {
  const dateAdded = job.date_applied
    ? new Date(job.date_applied).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={[
        'bg-white rounded-xl border transition-all duration-150 group relative select-none',
        'cursor-grab active:cursor-grabbing hover:shadow-md',
        compact ? 'p-2.5' : 'p-3.5',
        highlighted ? 'ring-2 ring-yellow-400 border-yellow-300 shadow-sm' : 'border-navy-100 hover:border-violet-200',
        dimmed ? 'opacity-40' : 'opacity-100',
      ].join(' ')}
    >
      {/* Star button */}
      {!compact && (
        <button
          onClick={e => { e.stopPropagation(); onStar(job) }}
          title={job.starred ? 'Remove priority' : 'Mark priority'}
          className={`absolute top-2.5 right-2.5 p-0.5 rounded transition-colors ${
            job.starred ? 'text-amber-400' : 'text-navy-200 opacity-0 group-hover:opacity-100 hover:text-amber-400'
          }`}
        >
          <Star size={13} className={job.starred ? 'fill-amber-400' : ''} />
        </button>
      )}

      {/* Logo + company/role */}
      <div className={`flex items-center gap-2.5 ${!compact ? 'pr-5' : ''}`}>
        <CompanyLogo company={job.company} size={compact ? 26 : 34} />
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-navy-900 truncate group-hover:text-violet-700 transition-colors ${compact ? 'text-xs' : 'text-sm'}`}>
            {job.company || 'Unknown'}
          </p>
          <p className="text-xs text-navy-400 truncate mt-0.5">
            {job.role || 'No role'}
          </p>
        </div>
      </div>

      {/* Tags — only on full cards */}
      {!compact && (
        <div className="flex flex-wrap items-center gap-1 mt-2.5">
          {job.folder && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-200">
              <Folder size={8} />{job.folder}
            </span>
          )}
          {job.referral && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Referral
            </span>
          )}
          {job.starred && (
            <Star size={9} className="text-amber-400 fill-amber-400" />
          )}
          {job.deadline && (() => {
            const [y,m,d] = job.deadline.split('-').map(Number)
            const dt = new Date(y, m-1, d)
            const today = new Date(); today.setHours(0,0,0,0)
            const delta = Math.round((dt - today) / 86400000)
            const urgent = delta <= 3
            return (
              <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${urgent ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                <AlertCircle size={8} />
                {delta < 0 ? 'Expired' : delta === 0 ? 'Due today' : `Due ${delta}d`}
              </span>
            )
          })()}
          {job.interview_date && (() => {
            const [y,m,d] = job.interview_date.split('-').map(Number)
            const dt = new Date(y, m-1, d)
            const today = new Date(); today.setHours(0,0,0,0)
            const delta = Math.round((dt - today) / 86400000)
            if (delta < -1) return null
            return (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200">
                <Calendar size={8} />
                {delta < 0 ? 'Interview past' : delta === 0 ? 'Interview today' : `Interview ${delta}d`}
              </span>
            )
          })()}
          {(job.location || dateAdded) && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-navy-400">
              {job.location && <><MapPin size={8} />{job.location}</>}
              {job.location && dateAdded && <span className="mx-0.5">·</span>}
              {dateAdded && <><Calendar size={8} />{dateAdded}</>}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────────────────
function KanbanColumn({ status, cards, isHighlighted, anyFilterActive, isDragOver,
  onDragOver, onDragLeave, onDrop, onCardDragStart, onCardDragEnd, onCardClick, onStar }) {
  const cfg = COL_CONFIG[status]

  const sorted = anyFilterActive
    ? [...cards.filter(isHighlighted), ...cards.filter(j => !isHighlighted(j))]
    : cards

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0">
      {/* Column header */}
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-xl border-x border-t ${cfg.border} ${cfg.colBg} shrink-0`}>
        <div className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
        <span className={`text-xs font-bold uppercase tracking-wide ${cfg.label}`}>{status}</span>
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.count}`}>
          {cards.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          'flex-1 overflow-y-auto rounded-b-xl border p-2 space-y-2 min-h-0 transition-all duration-150',
          cfg.border,
          isDragOver ? `${cfg.dropBg} border-dashed border-2` : cfg.colBg,
        ].join(' ')}
      >
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-24 rounded-lg border-2 border-dashed border-navy-200">
            <span className="text-xs text-navy-300 italic">Drop jobs here</span>
          </div>
        ) : (
          sorted.map(job => (
            <KanbanCard
              key={job.id}
              job={job}
              highlighted={anyFilterActive && isHighlighted(job)}
              dimmed={anyFilterActive && !isHighlighted(job)}
              onClick={() => onCardClick(job)}
              onStar={onStar}
              onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(job.id)); onCardDragStart(job.id) }}
              onDragEnd={onCardDragEnd}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Accordion Drop Zone (Accepted / Rejected side panel) ─────────────────────
function AccordionDropZone({ status, cards, isOpen, onToggle, isDragOver,
  onDragOver, onDragLeave, onDrop, onCardDragStart, onCardDragEnd, onCardClick, onStar }) {
  const cfg = COL_CONFIG[status]

  return (
    <div className={[
      'rounded-xl border overflow-hidden transition-all duration-150',
      cfg.border,
      isDragOver ? 'ring-2 ring-offset-1 ring-violet-400 border-dashed' : '',
    ].join(' ')}>
      {/* Header — always droppable + clickable */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-2 px-3 py-3 ${cfg.colBg} hover:brightness-95 transition-all`}
        >
          <div className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
          <span className={`text-xs font-bold uppercase tracking-wide ${cfg.label}`}>{status}</span>
          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.count}`}>
            {cards.length}
          </span>
          <ChevronDown size={13} className={`${cfg.label} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Collapsible card list */}
      {isOpen && (
        <div className="bg-white p-2 space-y-1.5 max-h-72 overflow-y-auto">
          {cards.length === 0 ? (
            <p className="text-xs text-navy-300 italic text-center py-6">
              Drag cards here to mark as {status.toLowerCase()}
            </p>
          ) : (
            cards.map(job => (
              <KanbanCard
                key={job.id}
                job={job}
                compact
                highlighted={false}
                dimmed={false}
                onClick={() => onCardClick(job)}
                onStar={onStar}
                onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(job.id)); onCardDragStart(job.id) }}
                onDragEnd={onCardDragEnd}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Networking constants ──────────────────────────────────────────────────────
const CONNECTION_TYPES = ['Alumni','Similar Background','Direct Outreach','Recruiter','Warm Intro','Conference/Event']
const OUTREACH_STATUSES = ['Not Contacted','Emailed','Called','Meeting Scheduled','Met']
const OUTREACH_CLASS = {
  'Not Contacted':     'bg-slate-100 text-slate-600 border border-slate-200',
  'Emailed':           'bg-sky-100 text-sky-700 border border-sky-200',
  'Called':            'bg-amber-100 text-amber-700 border border-amber-200',
  'Meeting Scheduled': 'bg-violet-100 text-violet-700 border border-violet-200',
  'Met':               'bg-emerald-100 text-emerald-700 border border-emerald-200',
}
const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700','bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700','bg-amber-100 text-amber-700',
]
function avatarColor(name) { return AVATAR_COLORS[(name || '').length % 4] }
function nameInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Contact Form (inside Network Modal) ──────────────────────────────────────
function ContactForm({ initialData, lockedCompany, onSave, onCancel }) {
  const EMPTY = {
    name: '', title: '', company: lockedCompany || '', email: '', linkedin_url: '',
    connection_type: 'Direct Outreach', school: '', graduation_year: '',
    outreach_status: 'Not Contacted', follow_up_1: false, follow_up_2: false, meeting_notes: '',
  }
  const [form, setForm] = useState(initialData ? { ...EMPTY, ...initialData } : { ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try { await onSave(form) } catch { setError('Save failed') } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-semibold text-navy-500 mb-1 uppercase tracking-wide">Name *</label>
          <input className={`input text-sm ${error && !form.name.trim() ? 'border-red-400' : ''}`} placeholder="Full name" value={form.name} onChange={e => set('name', e.target.value)} />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-semibold text-navy-500 mb-1 uppercase tracking-wide">Title</label>
          <input className="input text-sm" placeholder="e.g. Strategy Analyst" value={form.title} onChange={e => set('title', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-navy-500 mb-1 uppercase tracking-wide">Email</label>
          <input type="email" className="input text-sm" placeholder="email@company.com" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-navy-500 mb-1 uppercase tracking-wide">LinkedIn URL</label>
          <input className="input text-sm" placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-navy-500 mb-1 uppercase tracking-wide">Connection Type</label>
          <div className="relative">
            <select className="input appearance-none pr-8 text-sm" value={form.connection_type} onChange={e => set('connection_type', e.target.value)}>
              {CONNECTION_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-navy-500 mb-1 uppercase tracking-wide">Outreach Status</label>
          <div className="relative">
            <select className="input appearance-none pr-8 text-sm" value={form.outreach_status} onChange={e => set('outreach_status', e.target.value)}>
              {OUTREACH_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
          </div>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-navy-500 mb-1 uppercase tracking-wide">Meeting Notes</label>
          <textarea className="input resize-none text-sm" rows={2} placeholder="Notes from conversations..." value={form.meeting_notes} onChange={e => set('meeting_notes', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary text-sm py-1.5">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary text-sm py-1.5">
          {saving ? <><RefreshCw size={13} className="animate-spin" /> Saving…</> : <><Check size={13} /> {initialData ? 'Save Changes' : 'Add Contact'}</>}
        </button>
      </div>
    </form>
  )
}

// ── Apollo Discover Tab ───────────────────────────────────────────────────────
const TITLE_CHIPS = [
  { label: 'Strategy / Ops',  keywords: ['Chief of Staff', 'Head of Strategy', 'Strategy', 'Operations', 'BizOps'] },
  { label: 'Product',         keywords: ['Product Manager', 'Head of Product', 'VP Product', 'Product Lead', 'Product Director'] },
  { label: 'Revenue / Sales', keywords: ['VP Sales', 'Head of Sales', 'Business Development', 'Account Executive', 'Revenue'] },
  { label: 'Engineering',     keywords: ['VP Engineering', 'Engineering Manager', 'Head of Engineering', 'CTO', 'Software Engineer'] },
  { label: 'Founders / Exec', keywords: ['Founder', 'CEO', 'COO', 'President', 'Chief Operating Officer'] },
  { label: 'Recruiting',      keywords: ['Recruiter', 'Head of Talent', 'Talent Acquisition', 'People Operations'] },
]
const SENIORITY_OPTS = [
  { label: 'Manager+',  values: ['manager', 'director', 'vp', 'c_suite', 'founder', 'partner'] },
  { label: 'Director+', values: ['director', 'vp', 'c_suite', 'founder', 'partner'] },
  { label: 'VP+',       values: ['vp', 'c_suite', 'founder', 'partner'] },
  { label: 'Any level', values: [] },
]

// Score a person's title against selected chips + user profile
function scoreRelevance(person, selectedChips, userUniversity, enriched) {
  const title = (person.title || '').toLowerCase()
  let score = 0

  // +10 per keyword match in selected chips
  for (const chipLabel of selectedChips) {
    const chip = TITLE_CHIPS.find(c => c.label === chipLabel)
    if (chip) {
      for (const kw of chip.keywords) {
        if (title.includes(kw.toLowerCase())) { score += 10; break }
      }
    }
  }

  // +20 if enriched data shows same university in headline / employment
  if (userUniversity && enriched) {
    const uni = userUniversity.toLowerCase()
    const haystack = [
      enriched.headline || '',
      ...(enriched.employment_history || []).map(e => `${e.organization_name || ''} ${e.description || ''}`),
    ].join(' ').toLowerCase()
    if (haystack.includes(uni)) score += 20
  }

  return score
}

function ApolloDiscoverTab({ job, existingContacts, onAdded }) {
  const { user } = useAuth()
  const [selectedChips, setSelectedChips] = useState([])
  const [seniority, setSeniority]         = useState(3) // default: Any level
  const [results, setResults]             = useState(null)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState(null)
  const [adding, setAdding]               = useState({})       // { [id]: 'loading'|'done'|'error' }
  const [enriched, setEnriched]           = useState({})       // { [id]: full profile object }
  const [enriching, setEnriching]         = useState({})       // { [id]: true }
  const [expanded, setExpanded]           = useState({})       // { [id]: true } — show profile panel
  const [page, setPage]                   = useState(1)
  const [totalPages, setTotalPages]       = useState(1)
  const [total, setTotal]                 = useState(0)

  const existingSet = new Set(existingContacts.map(c => (c.name || '').toLowerCase().trim()))

  const toggleChip = (label) =>
    setSelectedChips(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label])

  const doSearch = async (pg = 1) => {
    setLoading(true); setError(null); setPage(pg); setExpanded({})
    try {
      const keywords = selectedChips.flatMap(
        label => TITLE_CHIPS.find(c => c.label === label)?.keywords ?? []
      )
      const res  = await contactsApi.searchApollo({
        company:        job.company,
        title_keywords: keywords,          // empty = all titles
        seniority:      SENIORITY_OPTS[seniority].values,
        page: pg, per_page: 20,
      })
      const data = res.data
      if (data.error === 'no_key') { setError('Apollo API key not configured.'); setResults([]); return }
      if (data.error)              { setError(`Apollo error: ${data.error}`);    setResults([]); return }

      // Client-side relevance sort: already-enriched contacts scored higher
      const raw = data.people || []
      const scored = raw.map(p => ({
        ...p,
        _score: scoreRelevance(p, selectedChips, user?.university, enriched[p.apollo_id]),
      })).sort((a, b) => b._score - a._score)

      setResults(scored)
      setTotal(data.total || 0)
      setTotalPages(data.total_pages || 1)
    } catch {
      setError('Search failed — make sure the backend is running.')
      setResults([])
    } finally { setLoading(false) }
  }

  // Enrich a person (uses 1 Apollo credit) — caches result so Add doesn't re-enrich
  const handlePreview = async (person) => {
    const id = person.apollo_id
    // Toggle collapse if already enriched
    if (enriched[id]) {
      setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
      return
    }
    setEnriching(prev => ({ ...prev, [id]: true }))
    setExpanded(prev => ({ ...prev, [id]: true }))
    try {
      const res = await contactsApi.enrichApollo({ apollo_id: id })
      const data = res.data
      if (!data.error) {
        setEnriched(prev => ({ ...prev, [id]: data }))
        // Re-sort results with new enrichment score
        setResults(prev => prev
          ? prev.map(p => p.apollo_id === id
              ? { ...p, _score: scoreRelevance(p, selectedChips, user?.university, data) }
              : p
            ).sort((a, b) => b._score - a._score)
          : prev
        )
      }
    } finally {
      setEnriching(prev => ({ ...prev, [id]: false }))
    }
  }

  // Add to My Network — uses cached enrich data if available, otherwise enriches first
  const handleAdd = async (person) => {
    const id = person.apollo_id
    setAdding(prev => ({ ...prev, [id]: 'loading' }))
    try {
      let profile = enriched[id]
      if (!profile) {
        const res = await contactsApi.enrichApollo({ apollo_id: id })
        profile = res.data
        if (!profile.error) setEnriched(prev => ({ ...prev, [id]: profile }))
      }
      await contactsApi.create({
        name:         profile?.name        || person.name,
        title:        profile?.title       || person.title,
        email:        profile?.email       || '',
        linkedin_url: profile?.linkedin_url || '',
        company:      job.company,
        outreach_status: 'Not Contacted',
      })
      setAdding(prev => ({ ...prev, [id]: 'done' }))
      await onAdded()
    } catch {
      setAdding(prev => ({ ...prev, [id]: 'error' }))
    }
  }

  const addState     = (id) => adding[id]
  const isAdded      = (p) => addState(p.apollo_id) === 'done' || existingSet.has((enriched[p.apollo_id]?.name || p.name || '').toLowerCase().trim())
  const isPending    = (p) => addState(p.apollo_id) === 'loading'
  const uniMatches   = (id) => {
    if (!user?.university || !enriched[id]) return false
    const uni = user.university.toLowerCase()
    const hay = [
      enriched[id].headline || '',
      ...(enriched[id].employment_history || []).map(e => e.organization_name || ''),
    ].join(' ').toLowerCase()
    return hay.includes(uni)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="px-6 py-4 border-b border-navy-100 space-y-3">
        <div>
          <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-2">
            Role type <span className="normal-case font-normal text-navy-300">(leave blank for all)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TITLE_CHIPS.map(({ label }) => (
              <button key={label} onClick={() => toggleChip(label)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  selectedChips.includes(label)
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-slate-50 text-navy-600 border-navy-200 hover:border-violet-400'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-navy-100 rounded-lg p-0.5 shrink-0">
            {SENIORITY_OPTS.map(({ label }, i) => (
              <button key={label} onClick={() => setSeniority(i)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  seniority === i ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-500 hover:text-navy-700'
                }`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => doSearch(1)} disabled={loading}
            className="ml-auto btn-primary text-xs py-1.5 px-4">
            {loading
              ? <><RefreshCw size={12} className="animate-spin" /> Searching…</>
              : <><Sparkles size={12} /> Search Apollo</>}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Pre-search */}
        {results === null && !loading && (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-8">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center">
              <Sparkles size={22} className="text-violet-400" />
            </div>
            <div>
              <p className="font-semibold text-navy-700 text-sm">Find people at {job.company}</p>
              <p className="text-xs text-navy-400 mt-1">
                Pick a role type &amp; seniority, then Search.<br/>
                Click <strong>▼ View Profile</strong> to see LinkedIn before adding.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>
        )}

        {results !== null && results.length === 0 && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-14 gap-2 text-center px-8">
            <p className="text-sm font-medium text-navy-600">No results found</p>
            <p className="text-xs text-navy-400">Try broader role filters or "Any level" seniority.</p>
          </div>
        )}

        {results && results.length > 0 && (
          <>
            <div className="px-6 py-2 border-b border-navy-50 flex items-center justify-between">
              <p className="text-[10px] text-navy-400">{total} found · page {page} of {totalPages}</p>
              {selectedChips.length > 0 && (
                <p className="text-[10px] text-violet-500">Sorted by role match · best fit first</p>
              )}
            </div>

            <div className="divide-y divide-navy-50">
              {results.map(person => {
                const id       = person.apollo_id
                const added    = isAdded(person)
                const pending  = isPending(person)
                const failed   = addState(id) === 'error'
                const isOpen   = expanded[id]
                const profile  = enriched[id]
                const loading_ = enriching[id]
                const uniMatch = uniMatches(id)
                const displayName = profile?.name || person.name
                const initials = (person.first_name || displayName || '?')[0].toUpperCase()

                return (
                  <div key={id} className={`transition-colors ${added ? 'bg-emerald-50/40' : ''}`}>
                    {/* Main row */}
                    <div className="px-6 py-3 flex items-center gap-3">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(displayName)}`}>
                        {initials}
                      </div>

                      {/* Name + title */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`text-sm font-semibold truncate ${profile ? 'text-navy-900' : 'text-navy-500'}`}>
                            {displayName}
                          </p>
                          {uniMatch && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-sky-100 text-sky-700 border border-sky-200 shrink-0">
                              <GraduationCap size={8} /> Same school
                            </span>
                          )}
                          {person._score > 0 && !uniMatch && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 text-violet-700 border border-violet-200 shrink-0">
                              Role match
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-navy-400 truncate mt-0.5">{profile?.title || person.title}</p>
                      </div>

                      {/* View Profile toggle */}
                      <button
                        onClick={() => handlePreview(person)}
                        title={isOpen ? 'Hide profile' : 'View full profile + LinkedIn'}
                        className="shrink-0 flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-lg border border-navy-200 text-navy-500 hover:border-violet-400 hover:text-violet-700 transition-all"
                      >
                        {loading_ ? <RefreshCw size={10} className="animate-spin" /> : isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        {isOpen ? 'Hide' : 'Profile'}
                      </button>

                      {/* Add button */}
                      <button
                        onClick={() => !added && !pending && handleAdd(person)}
                        disabled={added || pending}
                        className={`shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                          added   ? 'bg-emerald-100 text-emerald-700 border-emerald-200 cursor-default' :
                          pending ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-wait' :
                          failed  ? 'bg-red-50 text-red-500 border-red-200' :
                                    'bg-violet-600 text-white border-violet-600 hover:bg-violet-700'
                        }`}
                      >
                        {added ? <><Check size={10} /> Added</> : pending ? 'Adding…' : failed ? 'Retry' : <><Plus size={10} /> Add</>}
                      </button>
                    </div>

                    {/* Expanded profile panel */}
                    {isOpen && (
                      <div className="mx-6 mb-3 px-4 py-3 bg-slate-50 rounded-xl border border-navy-100 space-y-2">
                        {loading_ && (
                          <div className="flex items-center gap-2 text-xs text-navy-400">
                            <RefreshCw size={12} className="animate-spin" /> Loading full profile…
                          </div>
                        )}
                        {profile && (
                          <>
                            <div className="flex items-start gap-3">
                              {profile.photo_url && (
                                <img src={profile.photo_url} alt={profile.name}
                                  className="w-10 h-10 rounded-full object-cover border border-navy-100 shrink-0"
                                  onError={e => { e.target.style.display = 'none' }}
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-navy-900">{profile.name}</p>
                                <p className="text-xs text-navy-500">{profile.title}</p>
                                {(profile.city || profile.state) && (
                                  <p className="text-[10px] text-navy-400 mt-0.5 flex items-center gap-1">
                                    <MapPin size={9} />{[profile.city, profile.state].filter(Boolean).join(', ')}
                                  </p>
                                )}
                              </div>
                            </div>

                            {profile.headline && (
                              <p className="text-[11px] text-navy-500 leading-relaxed">{profile.headline}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {profile.linkedin_url && (
                                <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 transition-colors">
                                  <Linkedin size={12} /> View LinkedIn
                                </a>
                              )}
                              {profile.email && (
                                <span className="flex items-center gap-1.5 text-xs text-navy-600 px-2.5 py-1.5 bg-white rounded-lg border border-navy-200">
                                  <Mail size={11} /> {profile.email}
                                </span>
                              )}
                              {profile.seniority && (
                                <span className="text-[10px] px-2 py-1 rounded-full bg-navy-100 text-navy-600 capitalize">{profile.seniority}</span>
                              )}
                            </div>
                          </>
                        )}
                        {!profile && !loading_ && (
                          <p className="text-xs text-red-500">Could not load profile. Try again.</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {results && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 py-4 border-t border-navy-100">
            <button onClick={() => doSearch(page - 1)} disabled={page <= 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-navy-200 text-xs text-navy-600 disabled:opacity-40 hover:bg-navy-50">
              ← Prev
            </button>
            <span className="text-xs text-navy-400">Page {page} of {totalPages}</span>
            <button onClick={() => doSearch(page + 1)} disabled={page >= totalPages || loading}
              className="px-3 py-1.5 rounded-lg border border-navy-200 text-xs text-navy-600 disabled:opacity-40 hover:bg-navy-50">
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Email Composer (inside Network Modal) ────────────────────────────────────
const TONE_OPTIONS = [
  { value: 'warm',   label: 'Warm',   desc: 'Genuine & conversational' },
  { value: 'direct', label: 'Direct', desc: 'Efficient & to the point' },
  { value: 'formal', label: 'Formal', desc: 'Professional & respectful' },
]

function EmailComposer({ contact, job, onClose, userUniversity }) {
  const [tone, setTone]             = useState('warm')
  const [jobContext, setJobContext]  = useState(job?.role || '')
  const [userNotes, setUserNotes]   = useState('')
  const [templateId, setTemplateId] = useState('')
  const [templates, setTemplates]   = useState([])
  const [generating, setGenerating] = useState(false)
  const [subject, setSubject]       = useState('')
  const [body, setBody]             = useState('')
  const [copied, setCopied]         = useState(false)
  const [error, setError]           = useState(null)
  const [showSave, setShowSave]     = useState(false)
  const [saveName, setSaveName]     = useState('')
  const [saved, setSaved]           = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [sending, setSending]       = useState(false)
  const [sendResult, setSendResult] = useState(null)
  const [attachments, setAttachments] = useState([])
  const [showPreview, setShowPreview] = useState(false)

  // Fetch email templates + Gmail status once
  useEffect(() => {
    emailTemplatesApi.getAll().then(r => setTemplates(r.data || [])).catch(() => {})
    nylasApi.getStatus()
      .then(res => setGmailConnected(res.data?.connected || false))
      .catch(() => setGmailConnected(false))
  }, [])

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = ev.target.result.split(',')[1]
        setAttachments(prev => [...prev, { name: file.name, size: file.size, type: file.type, data: base64 }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const handleSendViaGmail = async () => {
    if (!contact.email) { setError('This contact has no email address saved.'); return }
    if (!subject || !body) { setError('Generate the email first.'); return }
    setSending(true)
    setSendResult(null)
    setError(null)
    setShowPreview(false)
    try {
      await nylasApi.send({
        to: contact.email,
        subject,
        body,
        attachments: attachments.map(a => ({
          filename: a.name,
          content_type: a.type || 'application/octet-stream',
          data: a.data,
        })),
      })
      setSendResult({ ok: true, text: `Sent to ${contact.email}` })
      if (contact.id) {
        contactsApi.update(contact.id, { outreach_status: 'Emailed' }).catch(() => {})
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Send failed. Check your Gmail connection in Profile.')
    } finally {
      setSending(false)
    }
  }

  const alumniContext = (userUniversity && contact?.school &&
    contact.school.toLowerCase().includes(userUniversity.toLowerCase()))
    ? `Both attended ${userUniversity}` : ''

  const generate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await networkingApi.generateEmail({
        contact_name:    contact.name,
        contact_title:   contact.title,
        contact_company: contact.company,
        job_context:     jobContext,
        user_notes:      userNotes,
        tone,
        alumni_context:  alumniContext,
        template_id:     templateId ? parseInt(templateId) : undefined,
      })
      setSubject(res.data.subject || '')
      setBody(res.data.body || '')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Generation failed. Please try again.')
    } finally {
      setGenerating(false) }
  }

  const copyAll = () => {
    navigator.clipboard.writeText(body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const saveTemplate = async () => {
    if (!saveName.trim() || !body) return
    try {
      await emailTemplatesApi.create({ name: saveName.trim(), subject, body })
      setSaved(true)
      setShowSave(false)
      setTimeout(() => setSaved(false), 2500)
    } catch { /* silent */ }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-100">
          <div>
            <h3 className="text-base font-semibold text-navy-900 flex items-center gap-2">
              <Send size={15} className="text-violet-500" />
              Write Email
            </h3>
            <p className="text-xs text-navy-400 mt-0.5">
              To {contact.name}
              {contact.title ? ` · ${contact.title}` : ''}
              {alumniContext && <span className="ml-1.5 text-sky-500">· {alumniContext}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tone */}
          <div>
            <label className="block text-xs font-semibold text-navy-500 mb-2 uppercase tracking-wide">Tone</label>
            <div className="flex gap-2">
              {TONE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTone(opt.value)}
                  className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-medium transition-all text-left ${
                    tone === opt.value
                      ? 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-navy-200 text-navy-500 hover:border-navy-300 hover:bg-navy-50'
                  }`}
                >
                  <div className="font-semibold">{opt.label}</div>
                  <div className="font-normal text-[10px] mt-0.5 opacity-70">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Template */}
          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
                Base Template <span className="text-navy-300 font-normal normal-case">(optional)</span>
              </label>
              <div className="relative">
                <select className="input appearance-none pr-8 text-sm" value={templateId} onChange={e => setTemplateId(e.target.value)}>
                  <option value="">Generate from scratch</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Role context */}
          <div>
            <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
              Role you're referencing
            </label>
            <input
              className="input text-sm"
              value={jobContext}
              onChange={e => setJobContext(e.target.value)}
              placeholder="e.g. Strategy & Ops Associate"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
              Anything specific to mention <span className="text-navy-300 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              className="input resize-none text-sm"
              rows={2}
              placeholder="e.g. met at X event, mutual connection via Y, saw their recent post…"
              value={userNotes}
              onChange={e => setUserNotes(e.target.value)}
            />
          </div>

          <button onClick={generate} disabled={generating} className="btn-primary w-full justify-center">
            {generating
              ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
              : <><Sparkles size={14} /> Generate Email</>
            }
          </button>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
              {(error.toLowerCase().includes('credit balance') || error.toLowerCase().includes('billing')) && (
                <>{' '}<a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-red-900">Add credits →</a></>
              )}
            </div>
          )}

          {/* Generated result */}
          {(subject || body) && (
            <div className="space-y-3 border-t border-navy-100 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide">Generated Email</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSave(p => !p)}
                    className="flex items-center gap-1.5 text-xs text-navy-500 hover:text-navy-800 border border-navy-200 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    {saved
                      ? <><Check size={11} className="text-emerald-500" /> Saved</>
                      : <><FileText size={11} /> Save as template</>
                    }
                  </button>
                  <button onClick={copyAll} className="flex items-center gap-1.5 text-xs text-navy-500 hover:text-navy-800 border border-navy-200 px-2.5 py-1 rounded-lg transition-colors">
                    {copied ? <><Check size={11} className="text-emerald-500" /> Copied</> : <><Copy size={11} /> Copy body</>}
                  </button>
                </div>
              </div>

              {showSave && (
                <div className="flex items-center gap-2 p-3 bg-navy-50 rounded-xl border border-navy-100">
                  <input
                    className="input text-sm flex-1 py-1.5"
                    placeholder="Template name…"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveTemplate()}
                    autoFocus
                  />
                  <button onClick={saveTemplate} className="btn-primary py-1.5 text-xs">Save</button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-navy-400 mb-1 uppercase tracking-wide">Subject</label>
                <input className="input text-sm font-medium" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy-400 mb-1 uppercase tracking-wide">Body</label>
                <textarea className="input resize-none text-sm leading-relaxed" rows={8} value={body} onChange={e => setBody(e.target.value)} />
              </div>

              {/* Attach files */}
              <div className="border border-navy-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-navy-600 cursor-pointer hover:text-navy-800 transition-colors">
                    <Paperclip size={12} className="text-navy-400" />
                    Attach Files
                    <input type="file" multiple className="hidden" onChange={handleFileSelect} />
                  </label>
                  <span className="text-[10px] text-navy-300">Optional</span>
                </div>
                {attachments.length > 0 && (
                  <div className="space-y-1">
                    {attachments.map((a, i) => (
                      <div key={i} className="flex items-center justify-between bg-navy-50 rounded-lg px-2.5 py-1.5 text-xs">
                        <span className="text-navy-700 truncate">{a.name}</span>
                        <button onClick={() => removeAttachment(i)} className="text-navy-400 hover:text-red-500 ml-2 shrink-0 transition-colors">
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Send via Gmail */}
              {sendResult?.ok ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-medium">
                  <Check size={15} /> {sendResult.text}
                </div>
              ) : gmailConnected ? (
                <button
                  onClick={() => setShowPreview(true)}
                  disabled={sending}
                  className="w-full btn-primary flex items-center justify-center gap-2 text-sm py-2.5"
                >
                  <Mail size={14} /> Preview &amp; Send
                </button>
              ) : (
                <p className="text-xs text-center text-navy-400">
                  <a href="/profile" className="text-violet underline font-medium">Connect Gmail in Profile</a>{' '}
                  to send directly from RecruitIQ
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Email Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto z-10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy-100">
              <h3 className="text-base font-semibold text-navy-900 flex items-center gap-2">
                <Mail size={15} className="text-violet-500" />
                Email Preview
              </h3>
              <button onClick={() => setShowPreview(false)} className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-100 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-sm flex gap-2">
                <span className="text-navy-400 font-medium shrink-0">To:</span>
                <span className="text-navy-800">{contact.email || <span className="text-red-500">No email on record</span>}</span>
              </div>
              <div className="text-sm flex gap-2">
                <span className="text-navy-400 font-medium shrink-0">Subject:</span>
                <span className="text-navy-800 font-medium">{subject}</span>
              </div>
              <div className="border-t border-navy-100 pt-3">
                <pre className="text-sm text-navy-800 whitespace-pre-wrap font-sans leading-relaxed">{body}</pre>
              </div>
              {attachments.length > 0 && (
                <div className="border-t border-navy-100 pt-3 space-y-1.5">
                  <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide">Attachments</p>
                  {attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-navy-700">
                      <Paperclip size={11} className="text-navy-400 shrink-0" />
                      {a.name}
                    </div>
                  ))}
                </div>
              )}
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
              )}
              <div className="flex items-center gap-3 pt-2 border-t border-navy-100">
                <button onClick={() => setShowPreview(false)} className="flex-1 py-2.5 rounded-xl border border-navy-200 text-sm font-medium text-navy-600 hover:bg-navy-50 transition-colors">
                  Back to Edit
                </button>
                <button
                  onClick={handleSendViaGmail}
                  disabled={sending}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm py-2.5"
                >
                  {sending ? <><RefreshCw size={14} className="animate-spin" /> Sending…</> : <><Mail size={14} /> Confirm &amp; Send</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Network Modal ─────────────────────────────────────────────────────────────
function NetworkModal({ job, onClose }) {
  const { user } = useAuth()
  const [tab, setTab]               = useState('network') // 'network' | 'discover'
  const [contacts, setContacts]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editContact, setEditContact] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [copied, setCopied]         = useState(null)
  const [emailContact, setEmailContact] = useState(null)  // contact to email

  const loadContacts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await contactsApi.getAll()
      const all = res.data || []
      // Filter to contacts at this company (case-insensitive)
      const company = (job.company || '').toLowerCase()
      setContacts(all.filter(c => (c.company || '').toLowerCase() === company))
    } catch { setContacts([]) }
    finally { setLoading(false) }
  }, [job.company])

  useEffect(() => { loadContacts() }, [loadContacts])

  const handleSave = async (form) => {
    const data = { ...form, company: job.company }
    if (editContact) { await contactsApi.update(editContact.id, data) }
    else             { await contactsApi.create(data) }
    setShowForm(false)
    setEditContact(null)
    await loadContacts()
  }

  const handleDelete = async (id) => {
    await contactsApi.delete(id)
    setDeleteConfirm(null)
    await loadContacts()
  }

  const handleUpdate = async (id, data) => {
    await contactsApi.update(id, data)
    await loadContacts()
  }

  const copyEmail = (email) => {
    navigator.clipboard.writeText(email)
    setCopied(email)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col z-10">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-navy-100 shrink-0">
          <CompanyLogo company={job.company} size={36} />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-navy-900 truncate">{job.company}</h2>
            <p className="text-xs text-navy-400 truncate">{job.role}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-50 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-navy-100 shrink-0 px-6">
          {[
            { id: 'network',  label: 'My Network', icon: Users },
            { id: 'discover', label: 'Discover',   icon: Sparkles },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === id
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-navy-400 hover:text-navy-700'
              }`}
            >
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {tab === 'network' && (
            <div>
              {/* Add button row */}
              {!showForm && !editContact && (
                <div className="flex items-center justify-between px-6 py-3 border-b border-navy-50">
                  <p className="text-xs text-navy-400">
                    {loading ? 'Loading…' : `${contacts.length} contact${contacts.length !== 1 ? 's' : ''} at ${job.company}`}
                  </p>
                  <button
                    onClick={() => { setShowForm(true); setEditContact(null) }}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    <Plus size={13} /> Add Contact
                  </button>
                </div>
              )}

              {/* Inline add/edit form */}
              {(showForm || editContact) && (
                <div className="border-b border-navy-100 bg-slate-50">
                  <div className="px-6 pt-3 pb-1">
                    <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide">
                      {editContact ? 'Edit Contact' : `Add Contact at ${job.company}`}
                    </p>
                  </div>
                  <ContactForm
                    initialData={editContact}
                    lockedCompany={job.company}
                    onSave={handleSave}
                    onCancel={() => { setShowForm(false); setEditContact(null) }}
                  />
                </div>
              )}

              {/* Contact list */}
              {loading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-navy-400">
                  <RefreshCw size={16} className="animate-spin" />
                  <span className="text-sm">Loading contacts…</span>
                </div>
              ) : contacts.length === 0 && !showForm ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
                  <div className="w-12 h-12 rounded-full bg-navy-50 flex items-center justify-center">
                    <Users size={22} className="text-navy-200" />
                  </div>
                  <div>
                    <p className="font-medium text-navy-700 text-sm">No contacts yet</p>
                    <p className="text-xs text-navy-400 mt-1">Add someone you know at {job.company} to track your outreach.</p>
                  </div>
                  <button onClick={() => setShowForm(true)} className="btn-primary text-sm py-1.5">
                    <Plus size={13} /> Add First Contact
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-navy-50">
                  {contacts.map(contact => (
                    <div key={contact.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(contact.name)}`}>
                          {nameInitials(contact.name)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-navy-900 text-sm">{contact.name}</p>
                              {contact.title && <p className="text-xs text-navy-400 truncate">{contact.title}</p>}
                            </div>
                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => setEmailContact(contact)}
                                className="p-1.5 rounded-lg text-navy-300 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                                title="Write email"
                              >
                                <Mail size={12} />
                              </button>
                              <button onClick={() => { setEditContact(contact); setShowForm(false) }} className="p-1.5 rounded-lg text-navy-300 hover:text-navy-700 hover:bg-navy-100 transition-colors">
                                <Pencil size={12} />
                              </button>
                              {deleteConfirm === contact.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleDelete(contact.id)} className="px-2 py-0.5 rounded text-xs font-medium bg-red-500 text-white hover:bg-red-600">Delete</button>
                                  <button onClick={() => setDeleteConfirm(null)} className="px-2 py-0.5 rounded text-xs text-navy-500 hover:bg-navy-100">Cancel</button>
                                </div>
                              ) : (
                                <button onClick={() => setDeleteConfirm(contact.id)} className="p-1.5 rounded-lg text-navy-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Badges */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${OUTREACH_CLASS[contact.outreach_status] || OUTREACH_CLASS['Not Contacted']}`}>
                              {contact.outreach_status || 'Not Contacted'}
                            </span>
                            {contact.connection_type && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                {contact.connection_type}
                              </span>
                            )}
                          </div>

                          {/* Contact links */}
                          <div className="flex items-center gap-3 mt-2">
                            {contact.email && (
                              <button
                                onClick={() => copyEmail(contact.email)}
                                className="flex items-center gap-1 text-xs text-navy-400 hover:text-navy-700 transition-colors"
                              >
                                {copied === contact.email
                                  ? <><Check size={11} className="text-emerald-500" /> Copied!</>
                                  : <><Copy size={11} />{contact.email}</>
                                }
                              </button>
                            )}
                            {contact.linkedin_url && (
                              <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-700 transition-colors">
                                <Linkedin size={11} /> LinkedIn
                              </a>
                            )}
                            <button
                              onClick={() => setEmailContact(contact)}
                              className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-700 font-medium transition-colors"
                            >
                              <Sparkles size={11} /> Write Email
                            </button>
                          </div>

                          {/* Outreach status quick-update */}
                          <div className="mt-2">
                            <div className="relative inline-block">
                              <select
                                className="text-xs border border-navy-200 rounded-lg px-2 py-1 pr-6 text-navy-600 bg-white appearance-none cursor-pointer hover:border-navy-400 transition-colors"
                                value={contact.outreach_status || 'Not Contacted'}
                                onChange={e => handleUpdate(contact.id, { outreach_status: e.target.value })}
                              >
                                {OUTREACH_STATUSES.map(s => <option key={s}>{s}</option>)}
                              </select>
                              <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Meeting notes */}
                      {contact.meeting_notes && (
                        <div className="ml-12 mt-2 px-3 py-2 bg-navy-50 rounded-lg">
                          <p className="text-xs text-navy-500 leading-relaxed">{contact.meeting_notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'discover' && (
            <ApolloDiscoverTab job={job} existingContacts={contacts} onAdded={loadContacts} />
          )}
        </div>
      </div>

      {/* Email composer — renders on top of the network modal */}
      {emailContact && (
        <EmailComposer
          contact={emailContact}
          job={job}
          userUniversity={user?.university || ''}
          onClose={() => setEmailContact(null)}
        />
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function JobTracker() {
  const [jobs, setJobs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // Filters
  const [activeFolder, setActiveFolder]     = useState('all')
  const [priorityActive, setPriorityActive] = useState(false)
  const [search, setSearch]                 = useState('')

  // Drag & drop
  const [draggingId, setDraggingId]           = useState(null)
  const [dragOverColumn, setDragOverColumn]   = useState(null)

  // Side panel
  const [acceptedOpen, setAcceptedOpen] = useState(true)
  const [rejectedOpen, setRejectedOpen] = useState(false)

  // UI
  const [modalOpen, setModalOpen]     = useState(false)
  const [editJob, setEditJob]         = useState(null)
  const [selectedJob, setSelectedJob] = useState(null)
  const [networkJob, setNetworkJob]   = useState(null)
  const [interviewPrompt, setInterviewPrompt] = useState(null)       // entering Interviewing
  const [leaveInterviewPrompt, setLeaveInterviewPrompt] = useState(null) // leaving Interviewing with date set

  const fetchJobs = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await jobsApi.getAll()
      setJobs(res.data || [])
    } catch {
      setError('Failed to load jobs. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  useEffect(() => {
    if (selectedJob) {
      const updated = jobs.find(j => j.id === selectedJob.id)
      if (updated) setSelectedJob(updated)
    }
  }, [jobs]) // eslint-disable-line

  const handleSave = async (form) => {
    if (editJob) { await jobsApi.update(editJob.id, form) }
    else         { await jobsApi.create(form) }
    await fetchJobs()
  }

  const handleDelete = async (id) => {
    try { await jobsApi.delete(id); await fetchJobs() }
    catch (err) { console.error(err) }
  }

  const handleStar = async (job) => {
    try {
      await jobsApi.update(job.id, { starred: !job.starred })
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, starred: !job.starred } : j))
    } catch (err) { console.error(err) }
  }

  const openAdd  = () => { setEditJob(null); setModalOpen(true) }
  const openEdit = (job) => { setEditJob(job); setModalOpen(true) }

  // ── Filter / highlight helpers ─────────────────────────────────────────────
  const isHighlighted = useCallback((job) => {
    const folderMatch =
      activeFolder === 'all'      ? true :
      activeFolder === 'priority' ? job.starred :
      activeFolder === 'unfiled'  ? (!job.folder || !ROLE_FOLDERS.includes(job.folder)) :
      job.folder === activeFolder
    const priorityMatch = priorityActive ? job.starred : true
    return folderMatch && priorityMatch
  }, [activeFolder, priorityActive])

  const anyFilterActive = activeFolder !== 'all' || priorityActive

  // ── Search filter (hard-removes cards) ────────────────────────────────────
  const searchFiltered = jobs.filter(job => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (job.company  || '').toLowerCase().includes(q) ||
      (job.role     || '').toLowerCase().includes(q) ||
      (job.location || '').toLowerCase().includes(q)
    )
  })

  const byStatus = (status) => searchFiltered.filter(j => j.status === status)

  // ── Drag & drop handlers ──────────────────────────────────────────────────
  const handleCardDragStart = (id) => setDraggingId(id)
  const handleCardDragEnd   = () => { setDraggingId(null); setDragOverColumn(null) }

  const makeDragOver = (status) => (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(status)
  }

  const makeDragLeave = (status) => (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverColumn(prev => prev === status ? null : prev)
    }
  }

  const makeDrop = (newStatus) => (e) => {
    e.preventDefault()
    setDragOverColumn(null)
    const id = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (!id) return
    const currentJob = jobs.find(j => j.id === id)
    if (!currentJob || currentJob.status === newStatus) return

    // Optimistic status move immediately
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: newStatus } : j))

    if (newStatus === 'Interviewing') {
      // Prompt for interview date before committing
      setInterviewPrompt({ jobId: id, currentStatus: currentJob.status })
      return
    }

    // Moving AWAY from Interviewing with an existing date — ask before clearing
    if (currentJob.status === 'Interviewing' && currentJob.interview_date) {
      setLeaveInterviewPrompt({ jobId: id, newStatus, currentJob })
      return
    }

    // All other status moves — clear reminder on terminal statuses
    const dateUpdates = {}
    if (['Accepted', 'Rejected'].includes(newStatus) && currentJob.reminder_date) {
      dateUpdates.reminder_date = null
    }
    jobsApi.update(id, { status: newStatus, ...dateUpdates }).catch(() => {
      setJobs(prev => prev.map(j => j.id === id ? { ...j, status: currentJob.status } : j))
    })
  }

  const confirmInterviewDate = async (date) => {
    const { jobId, currentStatus } = interviewPrompt
    setInterviewPrompt(null)
    const payload = { status: 'Interviewing', ...(date && { interview_date: date }) }
    try {
      await jobsApi.update(jobId, payload)
      if (date) setJobs(prev => prev.map(j => j.id === jobId ? { ...j, interview_date: date } : j))
    } catch {
      // Rollback optimistic update
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: currentStatus } : j))
    }
  }

  const cancelInterviewPrompt = () => {
    if (!interviewPrompt) return
    const { jobId, currentStatus } = interviewPrompt
    setInterviewPrompt(null)
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: currentStatus } : j))
  }

  const handleLeaveInterviewKeep = () => {
    if (!leaveInterviewPrompt) return
    const { jobId, newStatus, currentJob } = leaveInterviewPrompt
    setLeaveInterviewPrompt(null)
    const dateUpdates = {}
    if (['Accepted', 'Rejected'].includes(newStatus) && currentJob.reminder_date) {
      dateUpdates.reminder_date = null
    }
    jobsApi.update(jobId, { status: newStatus, ...dateUpdates }).catch(() => {
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: currentJob.status } : j))
    })
  }

  const handleLeaveInterviewRemove = () => {
    if (!leaveInterviewPrompt) return
    const { jobId, newStatus, currentJob } = leaveInterviewPrompt
    setLeaveInterviewPrompt(null)
    const dateUpdates = { interview_date: null }
    if (['Accepted', 'Rejected'].includes(newStatus) && currentJob.reminder_date) {
      dateUpdates.reminder_date = null
    }
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...dateUpdates } : j))
    jobsApi.update(jobId, { status: newStatus, ...dateUpdates }).catch(() => {
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: currentJob.status } : j))
    })
  }

  // ── Folder counts (for chips) ──────────────────────────────────────────────
  const folderCounts   = ROLE_FOLDERS.reduce((acc, f) => { acc[f] = jobs.filter(j => j.folder === f).length; return acc }, {})
  const priorityCount  = jobs.filter(j => j.starred).length

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Header + filters */}
      <div className="px-6 pt-5 pb-3 space-y-3 shrink-0 border-b border-navy-100 bg-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
              <Briefcase size={22} className="text-violet-600" />
              Job Tracker
            </h1>
            <p className="text-sm text-navy-400 mt-0.5">
              {jobs.length} application{jobs.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
          <button onClick={openAdd} className="btn-primary self-start">
            <Plus size={16} /> Add Job
          </button>
        </div>

        {/* Filter chips + search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Priority chip */}
          <button
            onClick={() => setPriorityActive(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              priorityActive
                ? 'bg-amber-400 text-white border-amber-400'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400'
            }`}
          >
            <Star size={10} className={priorityActive ? 'fill-white' : 'fill-amber-400'} />
            Priority
            <span className="font-bold opacity-70">{priorityCount}</span>
          </button>

          <div className="w-px h-4 bg-navy-200 shrink-0" />

          {/* Folder chips */}
          {ROLE_FOLDERS.map(folder => (
            <button
              key={folder}
              onClick={() => setActiveFolder(prev => prev === folder ? 'all' : folder)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                activeFolder === folder
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-violet-50 text-violet-700 border-violet-200 hover:border-violet-400'
              }`}
            >
              <Folder size={9} />
              {folder}
              <span className="font-bold opacity-70">{folderCounts[folder]}</span>
            </button>
          ))}

          {/* Search — pushed to right */}
          <div className="ml-auto relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
            <input
              className="input pl-8 w-52 text-xs py-1.5 h-8"
              placeholder="Search company, role…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-600">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Board area */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center gap-3 text-navy-400">
          <RefreshCw size={20} className="animate-spin" />
          <span className="text-sm">Loading jobs…</span>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <AlertCircle size={24} className="text-red-400" />
          <p className="text-red-500 text-sm font-medium">{error}</p>
          <button onClick={fetchJobs} className="btn-secondary"><RefreshCw size={14} /> Retry</button>
        </div>
      ) : (
        <div className="flex flex-1 gap-3 p-4 overflow-hidden min-h-0">
          {/* 3 Kanban columns */}
          {KANBAN_COLS.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              cards={byStatus(status)}
              isHighlighted={isHighlighted}
              anyFilterActive={anyFilterActive}
              isDragOver={dragOverColumn === status}
              onDragOver={makeDragOver(status)}
              onDragLeave={makeDragLeave(status)}
              onDrop={makeDrop(status)}
              onCardDragStart={handleCardDragStart}
              onCardDragEnd={handleCardDragEnd}
              onCardClick={setSelectedJob}
              onStar={handleStar}
            />
          ))}

          {/* Right side panel — Accepted + Rejected */}
          <div className="w-52 shrink-0 flex flex-col gap-3 overflow-y-auto min-h-0">
            {['Accepted', 'Rejected'].map(status => (
              <AccordionDropZone
                key={status}
                status={status}
                cards={byStatus(status)}
                isOpen={status === 'Accepted' ? acceptedOpen : rejectedOpen}
                onToggle={() => status === 'Accepted' ? setAcceptedOpen(v => !v) : setRejectedOpen(v => !v)}
                isDragOver={dragOverColumn === status}
                onDragOver={makeDragOver(status)}
                onDragLeave={makeDragLeave(status)}
                onDrop={makeDrop(status)}
                onCardDragStart={handleCardDragStart}
                onCardDragEnd={handleCardDragEnd}
                onCardClick={setSelectedJob}
                onStar={handleStar}
              />
            ))}
          </div>
        </div>
      )}

      {/* Detail panel */}
      <DetailPanel
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onEdit={job => { openEdit(job); setSelectedJob(null) }}
        onDelete={handleDelete}
        onViewNetwork={job => { setNetworkJob(job); setSelectedJob(null) }}
      />

      {/* Network modal */}
      {networkJob && (
        <NetworkModal
          job={networkJob}
          onClose={() => setNetworkJob(null)}
        />
      )}

      {/* Add / Edit modal */}
      <JobModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditJob(null) }}
        onSave={handleSave}
        initialData={editJob}
      />

      {/* Interview date prompt — fires on drag to Interviewing */}
      <InterviewDateModal
        isOpen={!!interviewPrompt}
        company={interviewPrompt ? (jobs.find(j => j.id === interviewPrompt.jobId)?.company || '') : ''}
        onConfirm={confirmInterviewDate}
        onSkip={() => confirmInterviewDate(null)}
        onCancel={cancelInterviewPrompt}
      />

      <ConfirmInterviewModal
        isOpen={!!leaveInterviewPrompt}
        company={leaveInterviewPrompt?.currentJob?.company || ''}
        newStatus={leaveInterviewPrompt?.newStatus || ''}
        onKeep={handleLeaveInterviewKeep}
        onRemove={handleLeaveInterviewRemove}
      />
    </div>
  )
}
