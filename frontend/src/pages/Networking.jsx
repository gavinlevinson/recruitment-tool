import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, ExternalLink, Search, X,
  ChevronDown, Mail, Check, RefreshCw, Users, Building2, Linkedin,
  Copy, Sparkles, ArrowLeft, FileText, MapPin, PlusCircle, Link2,
} from 'lucide-react'
import { contactsApi, jobsApi, emailTemplatesApi, networkingApi, coachApi, nylasApi, googleDocsApi } from '../api'
import { parseUTCDateTime } from '../utils/dates'
import { useAuth } from '../context/AuthContext'

const CONNECTION_TYPES = [
  'Alumni',
  'Similar Background',
  'Direct Outreach',
  'Recruiter',
  'Warm Intro',
  'Conference/Event',
]

const OUTREACH_STATUSES = [
  'Not Contacted',
  'Emailed',
  'Called',
  'Meeting Scheduled',
  'Met',
]

const OUTREACH_CLASS = {
  'Not Contacted':     'bg-slate-100 text-slate-600 border border-slate-200',
  'Emailed':           'bg-sky-100 text-sky-700 border border-sky-200',
  'Called':            'bg-amber-100 text-amber-700 border border-amber-200',
  'Meeting Scheduled': 'bg-violet-100 text-violet-700 border border-violet-200',
  'Met':               'bg-emerald-100 text-emerald-700 border border-emerald-200',
}

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
]

const STATUS_DOT = {
  'Not Applied':  'bg-slate-400',
  'Under Review': 'bg-sky-500',
  'Interviewing': 'bg-amber-500',
  'Accepted':     'bg-emerald-500',
  'Rejected':     'bg-red-400',
}

function avatarColor(name) {
  return AVATAR_COLORS[(name || '').length % 4]
}

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function OutreachBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${OUTREACH_CLASS[status] || OUTREACH_CLASS['Not Contacted']}`}>
      {status}
    </span>
  )
}

function ConnectionBadge({ type }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
      {type}
    </span>
  )
}

// ── Company Logo ──────────────────────────────────────────────────────────────
function CompanyLogo({ company, size = 40 }) {
  const domain = (company || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'
  const src = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=64`
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className="rounded-lg bg-navy-100 flex items-center justify-center text-navy-500 font-bold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        {(company?.[0] || '?').toUpperCase()}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={company}
      className="rounded-lg object-contain bg-white border border-navy-100 shrink-0"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  )
}

// ── Contact Modal ─────────────────────────────────────────────────────────────
function ContactModal({ isOpen, onClose, onSave, initialData, jobCompanies, connectionTypes }) {
  const EMPTY = {
    name: '', title: '', company: '', email: '', linkedin_url: '',
    connection_type: 'Direct Outreach', school: '', graduation_year: '',
    outreach_status: 'Not Contacted', follow_up_1: false, follow_up_2: false,
    meeting_notes: '', tags: '',
  }
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [companyInputMode, setCompanyInputMode] = useState('select')

  useEffect(() => {
    if (isOpen) {
      const data = initialData ? { ...EMPTY, ...initialData } : { ...EMPTY }
      setForm(data)
      setErrors({})
      setCompanyInputMode(
        initialData?.company && !jobCompanies.includes(initialData.company) ? 'text' : 'select'
      )
    }
  }, [isOpen, initialData, jobCompanies])

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setErrors({ name: 'Name is required' }); return }
    setSaving(true)
    try { await onSave(form); onClose() }
    catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-100">
          <h2 className="text-lg font-semibold text-navy-900">{initialData ? 'Edit Contact' : 'Add Contact'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-50 transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Name <span className="text-red-400">*</span></label>
              <input className={`input ${errors.name ? 'border-red-400' : ''}`} placeholder="Full name" value={form.name} onChange={e => set('name', e.target.value)} />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Title</label>
              <input className="input" placeholder="e.g. Strategy Analyst" value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-navy-500 uppercase tracking-wide">Company</label>
                <button type="button" onClick={() => setCompanyInputMode(m => m === 'select' ? 'text' : 'select')} className="text-xs text-violet-600 hover:text-violet-800">
                  {companyInputMode === 'select' ? 'Type custom' : 'Pick from jobs'}
                </button>
              </div>
              {companyInputMode === 'select' && jobCompanies.length > 0 ? (
                <div className="relative">
                  <select className="input appearance-none pr-8" value={form.company} onChange={e => set('company', e.target.value)}>
                    <option value="">Select a company...</option>
                    {jobCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
                </div>
              ) : (
                <input className="input" placeholder="Company name" value={form.company} onChange={e => set('company', e.target.value)} />
              )}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Email</label>
              <input type="email" className="input" placeholder="email@company.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">LinkedIn URL</label>
              <input className="input" placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Connection Type</label>
              <div className="relative">
                <select className="input appearance-none pr-8" value={form.connection_type} onChange={e => set('connection_type', e.target.value)}>
                  {connectionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Outreach Status</label>
              <div className="relative">
                <select className="input appearance-none pr-8" value={form.outreach_status} onChange={e => set('outreach_status', e.target.value)}>
                  {OUTREACH_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">School</label>
              <input className="input" placeholder="University of Michigan" value={form.school} onChange={e => set('school', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Graduation Year</label>
              <input className="input" placeholder="2024" value={form.graduation_year} onChange={e => set('graduation_year', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-navy-500 mb-2 uppercase tracking-wide">Follow-ups</label>
              <div className="flex gap-4">
                {[1, 2].map(n => (
                  <label key={n} className="flex items-center gap-2 cursor-pointer">
                    <button type="button" onClick={() => set(`follow_up_${n}`, !form[`follow_up_${n}`])}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${form[`follow_up_${n}`] ? 'bg-violet-600 border-violet-600' : 'border-navy-200 bg-white'}`}>
                      {form[`follow_up_${n}`] && <Check size={11} className="text-white" />}
                    </button>
                    <span className="text-sm text-navy-700">Follow-up {n}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Meeting Notes</label>
              <textarea className="input resize-none" rows={3} placeholder="Notes from your conversations..." value={form.meeting_notes} onChange={e => set('meeting_notes', e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-navy-50">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <><RefreshCw size={14} className="animate-spin" /> Saving...</> : <><Check size={14} /> {initialData ? 'Save Changes' : 'Add Contact'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────
function DetailPanel({ contact, onClose, onUpdate, connectionTypes }) {
  const [status, setStatus] = useState(contact.outreach_status || 'Not Contacted')
  const [followUp1, setFollowUp1] = useState(!!contact.follow_up_1)
  const [followUp2, setFollowUp2] = useState(!!contact.follow_up_2)
  const [notes, setNotes] = useState(contact.meeting_notes || '')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const [docLinks, setDocLinks]           = useState(contact.doc_links || [])
  const [googleConnected, setGoogleConnected] = useState(false)
  const [docCreating, setDocCreating]     = useState(false)
  const [linkUrl, setLinkUrl]             = useState('')
  const [linkTitle, setLinkTitle]         = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [docError, setDocError]           = useState(null)

  useEffect(() => {
    googleDocsApi.getStatus()
      .then(res => setGoogleConnected(res.data?.connected || false))
      .catch(() => setGoogleConnected(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(contact.id, { outreach_status: status, follow_up_1: followUp1, follow_up_2: followUp2, meeting_notes: notes })
      onClose()
    } finally { setSaving(false) }
  }

  const handleCreateDoc = async () => {
    setDocCreating(true)
    setDocError(null)
    try {
      const res = await googleDocsApi.createDoc(contact.id, {})
      setDocLinks(res.data.doc_links)
      window.open(res.data.doc.url, '_blank')
    } catch (err) {
      setDocError(err?.response?.data?.detail || 'Could not create doc. Make sure Google Docs is connected in Profile.')
    } finally { setDocCreating(false) }
  }

  const handleLinkDoc = async () => {
    if (!linkUrl.trim()) return
    setDocError(null)
    try {
      const res = await googleDocsApi.linkDoc(contact.id, { url: linkUrl.trim(), title: linkTitle.trim() || linkUrl.trim() })
      setDocLinks(res.data.doc_links)
      setLinkUrl('')
      setLinkTitle('')
      setShowLinkInput(false)
    } catch (err) {
      setDocError(err?.response?.data?.detail || 'Could not link doc.')
    }
  }

  const handleUnlinkDoc = async (idx) => {
    try {
      const res = await googleDocsApi.unlinkDoc(contact.id, idx)
      setDocLinks(res.data.doc_links)
    } catch (err) {
      setDocError('Could not remove doc.')
    }
  }

  const copyEmail = () => {
    navigator.clipboard.writeText(contact.email)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-navy-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-100 shrink-0">
          <h2 className="text-base font-semibold text-navy-900 truncate pr-4">{contact.name}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-50 transition-colors shrink-0"><X size={18} /></button>
        </div>
        <div className="flex-1 p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${avatarColor(contact.name)}`}>
              {initials(contact.name)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-navy-900 text-base">{contact.name}</p>
              {contact.title && <p className="text-sm text-navy-500 truncate">{contact.title}</p>}
              {contact.company && <p className="text-xs text-navy-400 flex items-center gap-1 mt-0.5"><Building2 size={11} /> {contact.company}</p>}
            </div>
          </div>
          <div className="space-y-2">
            {contact.email && (
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-navy-400 shrink-0" />
                <span className="text-sm text-navy-700 truncate flex-1">{contact.email}</span>
                <button onClick={copyEmail} className="p-1 rounded text-navy-300 hover:text-navy-700 transition-colors shrink-0">
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
              </div>
            )}
            {contact.linkedin_url && (
              <div className="flex items-center gap-2">
                <Linkedin size={14} className="text-navy-400 shrink-0" />
                <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-600 hover:text-sky-800 truncate flex-1 flex items-center gap-1">
                  LinkedIn Profile <ExternalLink size={11} />
                </a>
              </div>
            )}
          </div>
          {contact.connection_type && (
            <div>
              <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-1.5">Connection Type</p>
              <ConnectionBadge type={contact.connection_type} />
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-1.5">Outreach Status</p>
            <div className="relative">
              <select className="input appearance-none pr-8 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
                {OUTREACH_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-2">Follow-ups</p>
            <div className="flex gap-4">
              {[{ label: 'Follow-up 1', val: followUp1, set: setFollowUp1 }, { label: 'Follow-up 2', val: followUp2, set: setFollowUp2 }].map(({ label, val, set: setVal }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer">
                  <button type="button" onClick={() => setVal(!val)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${val ? 'bg-violet-600 border-violet-600' : 'border-navy-200 bg-white'}`}>
                    {val && <Check size={11} className="text-white" />}
                  </button>
                  <span className="text-sm text-navy-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-1.5">Meeting Notes</p>
            <textarea className="input resize-none text-sm" rows={4} placeholder="Notes from your conversations..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* ── Conversation Notes (Google Docs) ────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-2">Conversation Notes</p>

            {docError && (
              <p className="text-xs text-red-500 mb-2">{docError}</p>
            )}

            {/* Linked docs list */}
            {docLinks.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {docLinks.map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-50 border border-sky-100">
                    <FileText size={13} className="text-sky-500 shrink-0" />
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-xs text-sky-700 hover:text-sky-900 truncate font-medium"
                    >
                      {doc.title || 'Untitled Doc'}
                    </a>
                    <button
                      onClick={() => handleUnlinkDoc(idx)}
                      className="p-0.5 rounded text-navy-300 hover:text-red-500 transition-colors shrink-0"
                      title="Remove link"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              {googleConnected ? (
                <button
                  onClick={handleCreateDoc}
                  disabled={docCreating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition-colors disabled:opacity-50"
                >
                  {docCreating
                    ? <RefreshCw size={12} className="animate-spin" />
                    : <PlusCircle size={12} />}
                  New note
                </button>
              ) : (
                <p className="text-xs text-navy-400 italic">
                  Connect Google Docs in{' '}
                  <a href="/profile" className="text-violet-500 hover:underline">Profile</a>
                  {' '}to create notes.
                </p>
              )}
              <button
                onClick={() => setShowLinkInput(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-navy-200 text-navy-600 text-xs font-semibold hover:bg-navy-50 transition-colors"
              >
                <Link2 size={12} />
                Link existing
              </button>
            </div>

            {/* Link existing doc input */}
            {showLinkInput && (
              <div className="mt-2 space-y-1.5">
                <input
                  className="input text-xs"
                  placeholder="Google Docs URL (https://docs.google.com/...)"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                />
                <input
                  className="input text-xs"
                  placeholder="Label (optional)"
                  value={linkTitle}
                  onChange={e => setLinkTitle(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleLinkDoc}
                    disabled={!linkUrl.trim()}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors"
                  >
                    Attach
                  </button>
                  <button
                    onClick={() => { setShowLinkInput(false); setLinkUrl(''); setLinkTitle('') }}
                    className="px-3 py-1.5 rounded-lg border border-navy-200 text-navy-500 text-xs hover:bg-navy-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-navy-100 shrink-0">
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center">
            {saving ? <><RefreshCw size={14} className="animate-spin" /> Saving...</> : <><Check size={14} /> Save Changes</>}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Contact Card ──────────────────────────────────────────────────────────────
function ContactCard({ contact, onEdit, onDelete, deleteConfirm, setDeleteConfirm, onClick, onEmail }) {
  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onClick(contact)}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(contact.name)}`}>
          {initials(contact.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-navy-900 truncate">{contact.name}</h3>
              {contact.title && <p className="text-xs text-navy-500 truncate">{contact.title}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
              <button onClick={() => onEdit(contact)} className="p-1.5 rounded-lg text-navy-300 hover:text-navy-700 hover:bg-navy-50 transition-colors"><Pencil size={13} /></button>
              {deleteConfirm === contact.id ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => onDelete(contact.id)} className="px-2 py-0.5 rounded text-xs font-medium bg-red-500 text-white hover:bg-red-600">Del</button>
                  <button onClick={() => setDeleteConfirm(null)} className="px-2 py-0.5 rounded text-xs font-medium text-navy-500 hover:bg-navy-50">No</button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(contact.id)} className="p-1.5 rounded-lg text-navy-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {contact.connection_type && <ConnectionBadge type={contact.connection_type} />}
        <OutreachBadge status={contact.outreach_status || 'Not Contacted'} />
      </div>
      <div className="flex items-center gap-3 text-navy-400">
        {contact.email && (
          <a href={`mailto:${contact.email}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-xs hover:text-navy-700 transition-colors" title={contact.email}>
            <Mail size={13} /><span className="truncate max-w-[120px]">{contact.email}</span>
          </a>
        )}
        {contact.linkedin_url && (
          <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-xs hover:text-sky-600 transition-colors">
            <Linkedin size={13} /><span>LinkedIn</span>
          </a>
        )}
      </div>
      {onEmail && (
        <button
          onClick={e => { e.stopPropagation(); onEmail(contact) }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-violet-200 text-violet-700 text-xs font-semibold hover:bg-violet-50 transition-colors"
        >
          <Sparkles size={12} /> Generate Email
        </button>
      )}
    </div>
  )
}

// ── Email Composer Modal ──────────────────────────────────────────────────────
const TONE_OPTIONS = [
  { value: 'warm',   label: 'Warm',   desc: 'Genuine & conversational' },
  { value: 'direct', label: 'Direct', desc: 'Efficient & to the point' },
  { value: 'formal', label: 'Formal', desc: 'Professional & respectful' },
]

function EmailComposerModal({ isOpen, onClose, contact, templates, userUniversity }) {
  const [templateId, setTemplateId] = useState('')
  const [jobContext, setJobContext] = useState('')
  const [userNotes, setUserNotes] = useState('')
  const [tone, setTone] = useState('warm')
  const [generating, setGenerating] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [copied, setCopied] = useState(false)
  const [savedAsTemplate, setSavedAsTemplate] = useState(false)
  const [error, setError] = useState(null)
  const [showTemplateSave, setShowTemplateSave] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [gmailConnected, setGmailConnected] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)  // { ok, text }

  // Check Gmail connection status once
  useEffect(() => {
    nylasApi.getStatus()
      .then(res => setGmailConnected(res.data?.connected || false))
      .catch(() => setGmailConnected(false))
  }, [])

  const handleSendViaGmail = async () => {
    if (!contact.email) { setError('This contact has no email address saved.'); return }
    if (!subject || !body) { setError('Generate or write the email first.'); return }
    setSending(true)
    setSendResult(null)
    setError(null)
    try {
      await nylasApi.send({ to: contact.email, subject, body })
      setSendResult({ ok: true, text: `Sent to ${contact.email}` })
      // Auto-update outreach status to Emailed
      if (contact.id) {
        contactsApi.update(contact.id, { outreach_status: 'Emailed' }).catch(() => {})
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Send failed. Check your Gmail connection in Profile.'
      setError(msg)
    } finally {
      setSending(false)
    }
  }

  // Auto-detect alumni context
  const alumniContext = (userUniversity && contact?.school && contact.school.toLowerCase().includes(userUniversity.toLowerCase()))
    ? `Both attended ${userUniversity}`
    : (contact?.school && userUniversity ? '' : '')

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await networkingApi.generateEmail({
        contact_name: contact.name,
        contact_title: contact.title,
        contact_company: contact.company,
        template_id: templateId ? parseInt(templateId) : undefined,
        job_context: jobContext,
        user_notes: userNotes,
        tone,
        alumni_context: alumniContext,
      })
      if (res.data.error) setError(res.data.error)
      else { setSubject(res.data.subject || ''); setBody(res.data.body || '') }
    } catch (err) {
      if (err?.response?.status === 503) setError('AI email generation requires an Anthropic API key. Add ANTHROPIC_API_KEY to backend/.env')
      else setError(err?.response?.data?.detail || 'Generation failed.')
    } finally { setGenerating(false) }
  }

  const copyAll = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const saveAsTemplate = async () => {
    if (!newTemplateName.trim() || !body) return
    try {
      await emailTemplatesApi.create({ name: newTemplateName.trim(), subject, body })
      setSavedAsTemplate(true)
      setShowTemplateSave(false)
      setTimeout(() => setSavedAsTemplate(false), 2500)
    } catch (e) { console.error('[saveAsTemplate]', e) }
  }

  if (!isOpen) return null

  const resumeUrl = coachApi.resumeDownloadUrl()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-100">
          <div>
            <h2 className="text-base font-semibold text-navy-900">Outreach Email</h2>
            <p className="text-xs text-navy-400 mt-0.5">
              {contact.name} · {contact.title} at {contact.company}
              {alumniContext && <span className="ml-2 text-sky-500 font-medium">· {alumniContext}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-50 transition-colors"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Tone selector */}
          <div>
            <label className="block text-xs font-semibold text-navy-500 mb-2 uppercase tracking-wide">Tone</label>
            <div className="flex gap-2">
              {TONE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTone(opt.value)}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
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
          <div>
            <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
              Base Template <span className="text-navy-300 font-normal normal-case">(optional)</span>
            </label>
            <div className="relative">
              <select className="input appearance-none pr-8 text-sm" value={templateId} onChange={e => setTemplateId(e.target.value)}>
                <option value="">Generate from scratch</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
            </div>
          </div>

          {/* Role context */}
          <div>
            <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
              Role you're interested in <span className="text-navy-300 font-normal normal-case">(optional)</span>
            </label>
            <input className="input text-sm" placeholder="e.g. Strategy & Ops Manager" value={jobContext} onChange={e => setJobContext(e.target.value)} />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
              Anything specific to mention <span className="text-navy-300 font-normal normal-case">(optional)</span>
            </label>
            <textarea className="input resize-none text-sm" rows={2} placeholder="e.g. Met at X event, mutual connection via Y, saw their recent post on LinkedIn…" value={userNotes} onChange={e => setUserNotes(e.target.value)} />
          </div>

          <button onClick={handleGenerate} disabled={generating} className="btn-primary w-full justify-center">
            {generating ? <><RefreshCw size={14} className="animate-spin" /> Generating…</> : <><Sparkles size={14} /> Generate Email</>}
          </button>

          {error && <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">{error}</div>}

          {(subject || body) && (
            <div className="space-y-3 border-t border-navy-100 pt-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide">Generated Email</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTemplateSave(p => !p)}
                    className="flex items-center gap-1.5 text-xs text-navy-500 hover:text-navy-800 border border-navy-200 px-2.5 py-1 rounded-lg transition-colors"
                    title="Save as template"
                  >
                    {savedAsTemplate ? <><Check size={12} className="text-emerald-500" /> Saved</> : <><FileText size={12} /> Save as template</>}
                  </button>
                  <button onClick={copyAll} className="flex items-center gap-1.5 text-xs text-navy-500 hover:text-navy-800 border border-navy-200 px-2.5 py-1 rounded-lg transition-colors">
                    {copied ? <><Check size={12} className="text-emerald-500" /> Copied</> : <><Copy size={12} /> Copy all</>}
                  </button>
                </div>
              </div>

              {showTemplateSave && (
                <div className="flex items-center gap-2 p-3 bg-navy-50 rounded-xl border border-navy-100">
                  <input
                    className="input text-sm flex-1 py-1.5"
                    placeholder="Template name…"
                    value={newTemplateName}
                    onChange={e => setNewTemplateName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveAsTemplate()}
                  />
                  <button onClick={saveAsTemplate} className="btn-primary py-1.5 text-xs">Save</button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-navy-400 mb-1 uppercase tracking-wide">Subject</label>
                <input className="input text-sm font-medium" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy-400 mb-1 uppercase tracking-wide">Body</label>
                <textarea className="input resize-none text-sm leading-relaxed" rows={9} value={body} onChange={e => setBody(e.target.value)} />
              </div>

              {/* Resume attach note */}
              <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                <div className="flex items-start gap-2">
                  <FileText size={14} className="text-violet-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-violet-800">Attach your resume</p>
                    <p className="text-[10px] text-violet-600 mt-0.5">Download your PDF and attach it when you send from your email client</p>
                  </div>
                </div>
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-semibold text-violet-700 hover:text-violet-900 border border-violet-300 bg-white px-3 py-1.5 rounded-lg transition-colors hover:bg-violet-50"
                >
                  Download PDF
                </a>
              </div>

              {/* Send via Gmail */}
              {sendResult?.ok ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-medium">
                  <Check size={15} /> {sendResult.text}
                </div>
              ) : gmailConnected ? (
                <button
                  onClick={handleSendViaGmail}
                  disabled={sending}
                  className="w-full btn-primary flex items-center justify-center gap-2 text-sm py-2.5"
                >
                  {sending ? <><RefreshCw size={14} className="animate-spin" /> Sending…</> : <><Mail size={14} /> Send via Gmail</>}
                </button>
              ) : gmailConnected === false ? (
                <p className="text-xs text-center text-navy-400">
                  <a href="/profile" className="text-violet-DEFAULT hover:underline font-medium">Connect Gmail in Profile</a>{' '}
                  to send directly from Orion
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Relevance Badge ───────────────────────────────────────────────────────────
function RelevanceBadge({ score }) {
  const cls = score >= 70 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    : score >= 50 ? 'bg-amber-100 text-amber-700 border border-amber-200'
    : 'bg-slate-100 text-slate-600 border border-slate-200'
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{score}</span>
}

// ── My Network (per-company) ──────────────────────────────────────────────────
function MyNetworkSection({ company, contacts, jobCompanies, connectionTypes, onSaveContact, onUpdateContact, onDeleteContact, templates, userUniversity }) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editContact, setEditContact] = useState(null)
  const [selectedContact, setSelectedContact] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailTarget, setEmailTarget] = useState(null)

  const companyContacts = contacts.filter(c => c.company === company)
  const filtered = companyContacts.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || (c.name || '').toLowerCase().includes(q) || (c.title || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
    return matchSearch && (filterStatus === 'All' || c.outreach_status === filterStatus)
  })

  const handleSave = async (form) => {
    await onSaveContact(editContact, { ...form, company })
    setModalOpen(false)
    setEditContact(null)
  }

  const handleUpdate = async (id, patch) => {
    await onUpdateContact(id, patch)
    setSelectedContact(prev => prev ? { ...prev, ...patch } : prev)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
          <input className="input pl-9" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-600"><X size={13} /></button>}
        </div>
        <button onClick={() => { setEditContact(null); setModalOpen(true) }} className="btn-primary shrink-0">
          <Plus size={14} /> Add Contact
        </button>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {['All', ...OUTREACH_STATUSES].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterStatus === s ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-navy-600 border-navy-200 hover:border-navy-400'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Contact cards */}
      {filtered.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <Users size={36} className="text-navy-200 mx-auto" />
          <p className="font-semibold text-navy-600">
            {companyContacts.length === 0 ? `No contacts at ${company} yet` : 'No contacts match your filters'}
          </p>
          <p className="text-sm text-navy-400">
            {companyContacts.length === 0 ? 'Add a contact or use Discover to find people here.' : 'Try broadening your search.'}
          </p>
          {companyContacts.length === 0 && (
            <button onClick={() => { setEditContact(null); setModalOpen(true) }} className="btn-primary mt-2">
              <Plus size={14} /> Add Contact
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(contact => (
              <ContactCard key={contact.id} contact={contact} onEdit={c => { setEditContact(c); setModalOpen(true) }}
                onDelete={onDeleteContact} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm}
                onClick={setSelectedContact} onEmail={c => { setEmailTarget(c); setEmailModalOpen(true) }} />
            ))}
          </div>
          <p className="text-xs text-navy-400 text-right">
            {filtered.length} of {companyContacts.length} contact{companyContacts.length !== 1 ? 's' : ''}
          </p>
        </>
      )}

      {selectedContact && (
        <DetailPanel contact={selectedContact} onClose={() => setSelectedContact(null)} onUpdate={handleUpdate} connectionTypes={connectionTypes} />
      )}

      <ContactModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditContact(null) }}
        onSave={handleSave} initialData={editContact} jobCompanies={jobCompanies} connectionTypes={connectionTypes} />

      {emailModalOpen && emailTarget && (
        <EmailComposerModal isOpen={emailModalOpen} onClose={() => { setEmailModalOpen(false); setEmailTarget(null) }}
          contact={emailTarget} templates={templates || []} userUniversity={userUniversity} />
      )}
    </div>
  )
}

// ── Discover (per-company) ────────────────────────────────────────────────────
function DiscoverSection({ company, contacts, jobCompanies, connectionTypes, onSaveContact, templates, userUniversity }) {
  const [results, setResults] = useState([])
  const [discovering, setDiscovering] = useState(false)
  const [error, setError] = useState(null)
  const [addedNames, setAddedNames] = useState(new Set())
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailTarget, setEmailTarget] = useState(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addTarget, setAddTarget] = useState(null)

  // Auto-discover on mount
  useEffect(() => {
    const run = async () => {
      setDiscovering(true)
      setError(null)
      try {
        const res = await networkingApi.discover({ company_name: company })
        setResults(res.data || [])
      } catch {
        setError('Could not load results. Make sure Hunter.io or Apollo API keys are configured.')
      } finally {
        setDiscovering(false)
      }
    }
    run()
  }, [company])

  const handleAddSave = async (form) => {
    await onSaveContact(null, form)
    setAddedNames(prev => new Set([...prev, addTarget?.name || '']))
    setAddModalOpen(false)
    setAddTarget(null)
  }

  if (discovering) {
    return (
      <div className="flex items-center gap-3 text-navy-400 py-16 justify-center">
        <RefreshCw size={18} className="animate-spin" />
        <span className="text-sm">Searching for people at {company}…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6 text-center space-y-2">
        <p className="text-sm text-amber-700">{error}</p>
        <p className="text-xs text-navy-400">Add HUNTER_API_KEY or APOLLO_API_KEY to backend/.env</p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="card p-10 text-center space-y-2">
        <Users size={36} className="text-navy-200 mx-auto" />
        <p className="font-semibold text-navy-600">No people found for {company}</p>
        <p className="text-xs text-navy-400">Try configuring Hunter.io or Apollo API keys, or add contacts manually from My Network.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-navy-400">{results.length} people found — sorted by relevance</p>
      {results.map((person, i) => (
        <div key={i} className="card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(person.name)}`}>
                {initials(person.name)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-navy-900 text-sm">{person.name}</p>
                  <RelevanceBadge score={person.relevance_score} />
                </div>
                {person.title && <p className="text-xs text-navy-500 truncate">{person.title}</p>}
                {person.email && <p className="text-xs text-violet-600 font-mono mt-0.5 truncate">{person.email}</p>}
              </div>
            </div>
            <span className="text-xs text-navy-300 shrink-0">{person.source}</span>
          </div>

          {person.relevance_reasons?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {person.relevance_reasons.map((r, ri) => (
                <span key={ri} className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">{r}</span>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setAddTarget({ name: person.name, title: person.title, email: person.email, linkedin_url: person.linkedin_url, company: person.company, connection_type: 'Direct Outreach', outreach_status: 'Not Contacted' }); setAddModalOpen(true) }}
              disabled={addedNames.has(person.name)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${addedNames.has(person.name) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-navy-700 border-navy-200 hover:border-navy-400'}`}
            >
              {addedNames.has(person.name) ? <><Check size={12} /> Added</> : <><Plus size={12} /> Add to Network</>}
            </button>
            <button
              onClick={() => { setEmailTarget(person); setEmailModalOpen(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              <Sparkles size={12} /> Generate Email
            </button>
          </div>
        </div>
      ))}

      {emailModalOpen && emailTarget && (
        <EmailComposerModal isOpen={emailModalOpen} onClose={() => { setEmailModalOpen(false); setEmailTarget(null) }} contact={emailTarget} templates={templates} userUniversity={userUniversity} />
      )}
      <ContactModal isOpen={addModalOpen} onClose={() => { setAddModalOpen(false); setAddTarget(null) }}
        onSave={handleAddSave} initialData={addTarget} jobCompanies={jobCompanies} connectionTypes={connectionTypes} />
    </div>
  )
}

// ── Company Detail View ───────────────────────────────────────────────────────
function CompanyDetailView({ company, companyJobs, contacts, jobCompanies, connectionTypes, templates, onBack, onSaveContact, onUpdateContact, onDeleteContact, userUniversity }) {
  const [tab, setTab] = useState('network')
  const contactCount = contacts.filter(c => c.company === company).length

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl text-navy-400 hover:text-navy-700 hover:bg-navy-100 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <CompanyLogo company={company} size={44} />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-navy-900">{company}</h1>
          <p className="text-sm text-navy-400">
            {companyJobs.length} job{companyJobs.length !== 1 ? 's' : ''} tracked
            {contactCount > 0 ? ` · ${contactCount} contact${contactCount !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
      </div>

      {/* Jobs at this company */}
      {companyJobs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {companyJobs.map(job => (
            <span key={job.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white border border-navy-200 text-navy-700">
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[job.status] || 'bg-slate-300'}`} />
              {job.role || 'Role TBD'}
              <span className="text-navy-400">· {job.status}</span>
            </span>
          ))}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex items-center rounded-xl border border-navy-200 p-1 gap-1 bg-navy-50 self-start w-fit">
        {[
          { key: 'network', label: 'My Network', count: contactCount },
          { key: 'discover', label: 'Discover' },
        ].map(({ key, label, count }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === key ? 'bg-navy-800 text-white shadow-sm' : 'text-navy-600 hover:text-navy-900'}`}>
            {label}
            {count !== undefined && count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === key ? 'bg-white/20 text-white' : 'bg-navy-200 text-navy-600'}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'network' ? (
        <MyNetworkSection company={company} contacts={contacts} jobCompanies={jobCompanies} connectionTypes={connectionTypes}
          onSaveContact={onSaveContact} onUpdateContact={onUpdateContact} onDeleteContact={onDeleteContact}
          templates={templates} userUniversity={userUniversity} />
      ) : (
        <DiscoverSection company={company} contacts={contacts} jobCompanies={jobCompanies} connectionTypes={connectionTypes}
          onSaveContact={onSaveContact} templates={templates} userUniversity={userUniversity} />
      )}
    </div>
  )
}

// ── Company List (main view) ──────────────────────────────────────────────────
const ROLE_CATEGORIES = ['Engineering', 'Revenue', 'Operations', 'Strategy', 'Research', 'Growth']
const OUTREACH_STATUS_ORDER = ['Not Contacted', 'Emailed', 'Called', 'Meeting Scheduled', 'Met']

function CompanyListView({ jobs, contacts, loading, onSelectCompany }) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState([])

  // Jobs grouped by company
  const jobsByCompany = {}
  jobs.forEach(j => { if (j.company) { if (!jobsByCompany[j.company]) jobsByCompany[j.company] = []; jobsByCompany[j.company].push(j) } })

  // Contact count + best outreach status per company
  const contactsByCompany = {}
  const bestOutreachByCompany = {}
  contacts.forEach(c => {
    if (!c.company) return
    contactsByCompany[c.company] = (contactsByCompany[c.company] || 0) + 1
    const curIdx = OUTREACH_STATUS_ORDER.indexOf(c.outreach_status || 'Not Contacted')
    const prevIdx = OUTREACH_STATUS_ORDER.indexOf(bestOutreachByCompany[c.company] || 'Not Contacted')
    if (curIdx > prevIdx) bestOutreachByCompany[c.company] = c.outreach_status
  })

  // Unique companies sorted by most recently added job
  const companies = [...new Set(jobs.map(j => j.company).filter(Boolean))]
  const sortedCompanies = [...companies].sort((a, b) => {
    const aTime = Math.max(...(jobsByCompany[a] || []).map(j => (parseUTCDateTime(j.created_at) || new Date(0)).getTime()), 0)
    const bTime = Math.max(...(jobsByCompany[b] || []).map(j => (parseUTCDateTime(j.created_at) || new Date(0)).getTime()), 0)
    return bTime - aTime
  })

  // Role filter — match by job folder
  const filteredByRole = roleFilter.length === 0
    ? sortedCompanies
    : sortedCompanies.filter(c => (jobsByCompany[c] || []).some(j => roleFilter.includes(j.folder)))

  // Search filter
  const filtered = filteredByRole.filter(c => !search || c.toLowerCase().includes(search.toLowerCase()))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-3 text-navy-400">
        <RefreshCw size={20} className="animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  if (companies.length === 0) {
    return (
      <div className="card p-16 text-center space-y-3">
        <Building2 size={44} className="text-navy-200 mx-auto" />
        <p className="font-semibold text-navy-600">No companies in your tracker yet</p>
        <p className="text-sm text-navy-400">Add jobs to your tracker first — companies will appear here so you can manage your network for each one.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search + role chips */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
          <input className="input pl-9" placeholder="Filter companies…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-600"><X size={13} /></button>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-navy-400 mr-1">Role:</span>
          {ROLE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setRoleFilter(prev => prev.includes(cat) ? prev.filter(r => r !== cat) : [...prev, cat])}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                roleFilter.includes(cat)
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-navy-600 border-navy-200 hover:border-violet-300 hover:text-violet-700'
              }`}
            >
              {cat}
            </button>
          ))}
          {roleFilter.length > 0 && (
            <button onClick={() => setRoleFilter([])} className="px-2 py-1 rounded-full text-xs text-navy-400 hover:text-navy-700 flex items-center gap-0.5">
              <X size={10} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Company list */}
      {filtered.length === 0 ? (
        <p className="text-sm text-navy-400 py-8 text-center">No companies match your filters</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(company => {
            const compJobs = jobsByCompany[company] || []
            const contactCount = contactsByCompany[company] || 0
            const bestOutreach = bestOutreachByCompany[company] || 'Not Contacted'

            return (
              <button
                key={company}
                onClick={() => onSelectCompany(company)}
                className="w-full card px-4 py-3 flex items-center gap-4 text-left hover:shadow-matte-md hover:border-violet-200 transition-all group cursor-pointer"
              >
                <CompanyLogo company={company} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy-800 truncate group-hover:text-violet-700 transition-colors">{company}</p>
                  <p className="text-xs text-navy-400">{compJobs.length} job{compJobs.length !== 1 ? 's' : ''}</p>
                </div>
                {contactCount > 0 && (
                  <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Users size={10} />
                    {contactCount}
                  </span>
                )}
                {(contactCount > 0 || bestOutreach !== 'Not Contacted') && (
                  <OutreachBadge status={bestOutreach} />
                )}
              </button>
            )
          })}
        </div>
      )}

      <p className="text-xs text-navy-400">
        {filtered.length} compan{filtered.length !== 1 ? 'ies' : 'y'} · Click any to manage your network and discover people
      </p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Networking() {
  const { user } = useAuth()
  const [selectedCompany, setSelectedCompany] = useState(null)

  const [contacts, setContacts] = useState([])
  const [jobs, setJobs] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  const alumniLabel = user?.university ? `${user.university} Alum` : 'Alumni'
  const connectionTypes = [alumniLabel, 'Similar Background', 'Direct Outreach', 'Recruiter', 'Warm Intro', 'Conference/Event']

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [contactsRes, jobsRes] = await Promise.all([contactsApi.getAll(), jobsApi.getAll()])
      setContacts(contactsRes.data || [])
      setJobs(jobsRes.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    emailTemplatesApi.getAll().then(res => setTemplates(res.data || [])).catch(() => {})
  }, [fetchAll])

  const handleSaveContact = async (editContact, form) => {
    if (editContact) await contactsApi.update(editContact.id, form)
    else await contactsApi.create(form)
    await fetchAll()
  }

  const handleUpdateContact = async (id, patch) => {
    await contactsApi.update(id, patch)
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  const handleDeleteContact = async (id) => {
    await contactsApi.delete(id)
    await fetchAll()
  }

  const jobCompanies = [...new Set(jobs.map(j => j.company).filter(Boolean))].sort()

  // Company detail view
  if (selectedCompany) {
    const companyJobs = jobs.filter(j => j.company === selectedCompany)
    return (
      <CompanyDetailView
        company={selectedCompany}
        companyJobs={companyJobs}
        contacts={contacts}
        jobCompanies={jobCompanies}
        connectionTypes={connectionTypes}
        templates={templates}
        onBack={() => setSelectedCompany(null)}
        onSaveContact={handleSaveContact}
        onUpdateContact={handleUpdateContact}
        onDeleteContact={handleDeleteContact}
        userUniversity={user?.university || ''}
      />
    )
  }

  // Main company list
  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
          <Users size={24} className="text-violet-600" />
          Networking
        </h1>
        <p className="text-sm text-navy-400 mt-0.5">Select a company to manage your connections and discover new people</p>
      </div>

      <CompanyListView
        jobs={jobs}
        contacts={contacts}
        loading={loading}
        onSelectCompany={setSelectedCompany}
      />
    </div>
  )
}
