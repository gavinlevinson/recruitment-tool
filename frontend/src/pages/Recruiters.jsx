import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, ExternalLink, Search, X,
  ChevronDown, Check, RefreshCw, Users, Mail, Globe, Phone,
  Building2,
} from 'lucide-react'
import { recruitersApi } from '../api'
import { formatDate } from '../utils/dates'

const OUTREACH_OPTIONS = [
  'Not Contacted',
  'Emailed',
  'Responded',
  'Call Scheduled',
  'Working Together',
]

const OUTREACH_CLASSES = {
  'Not Contacted':    'bg-slate-100 text-slate-600 border border-slate-200',
  'Emailed':          'bg-sky-100 text-sky-700 border border-sky-200',
  'Responded':        'bg-amber-100 text-amber-700 border border-amber-200',
  'Call Scheduled':   'bg-violet-100 text-violet-700 border border-violet-200',
  'Working Together': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
}

const KNOWN_AGENCIES = [
  { name: 'StaffGreat', url: 'https://www.staffgreat.com', specialty: 'Tech Startup Recruiting' },
  { name: 'VibeScaling', url: 'https://www.vibescaling.ai/recruiting', specialty: 'AI Startup Specialists' },
  { name: 'Betts Recruiting', url: 'https://betts.com', specialty: 'Go-to-Market & Operations' },
  { name: 'Riviera Partners', url: 'https://rivierapartners.com', specialty: 'Product & Engineering' },
  { name: 'Leap Consulting Group', url: '', specialty: 'Strategy & Operations' },
]

const EMPTY_FORM = {
  name: '',
  agency: '',
  email: '',
  linkedin_url: '',
  phone: '',
  agency_website: '',
  specialty: '',
  notes: '',
  outreach_status: 'Not Contacted',
  last_contact: '',
  is_agency: false,
}

function OutreachBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${OUTREACH_CLASSES[status] || OUTREACH_CLASSES['Not Contacted']}`}>
      {status}
    </span>
  )
}

function RecruiterModal({ isOpen, onClose, onSave, initialData }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      setForm(initialData ? { ...EMPTY_FORM, ...initialData } : { ...EMPTY_FORM })
      setErrors({})
    }
  }, [isOpen, initialData])

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }))

  const validate = () => {
    const errs = {}
    if (!form.agency.trim() && !form.name.trim()) errs.name = 'Name or Agency is required'
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-100">
          <h2 className="text-lg font-semibold text-navy-900">
            {initialData ? 'Edit Recruiter' : 'Add Recruiter'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
                Recruiter Name {!form.agency && <span className="text-red-400">*</span>}
              </label>
              <input
                className={`input ${errors.name ? 'border-red-400 focus:ring-red-200' : ''}`}
                placeholder="e.g. Sarah Johnson"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>

            {/* Agency */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Agency</label>
              <input
                className="input"
                placeholder="e.g. Betts Recruiting"
                value={form.agency}
                onChange={e => set('agency', e.target.value)}
              />
            </div>

            {/* Email */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Email</label>
              <input
                type="email"
                className="input"
                placeholder="sarah@betts.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
            </div>

            {/* Phone */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Phone</label>
              <input
                type="tel"
                className="input"
                placeholder="+1 (555) 000-0000"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
            </div>

            {/* LinkedIn */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">LinkedIn URL</label>
              <input
                className="input"
                placeholder="https://linkedin.com/in/..."
                value={form.linkedin_url}
                onChange={e => set('linkedin_url', e.target.value)}
              />
            </div>

            {/* Agency Website */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Agency Website</label>
              <input
                className="input"
                placeholder="https://betts.com"
                value={form.agency_website}
                onChange={e => set('agency_website', e.target.value)}
              />
            </div>

            {/* Specialty */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Specialty</label>
              <input
                className="input"
                placeholder="e.g. AI Startups, Go-to-Market, Operations"
                value={form.specialty}
                onChange={e => set('specialty', e.target.value)}
              />
            </div>

            {/* Outreach Status */}
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Outreach Status</label>
              <div className="relative">
                <select
                  className="input appearance-none pr-8"
                  value={form.outreach_status}
                  onChange={e => set('outreach_status', e.target.value)}
                >
                  {OUTREACH_OPTIONS.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
              </div>
            </div>

            {/* Last Contact */}
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Last Contact</label>
              <input
                type="date"
                className="input"
                value={form.last_contact}
                onChange={e => set('last_contact', e.target.value)}
              />
            </div>

            {/* Is Agency toggle */}
            <div className="col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => set('is_agency', !form.is_agency)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    form.is_agency ? 'bg-violet-DEFAULT' : 'bg-navy-200'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${
                    form.is_agency ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
                <span className="text-sm font-medium text-navy-700">Is an Agency (not individual recruiter)</span>
              </label>
            </div>

            {/* Notes */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Notes</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Any notes about this recruiter or agency..."
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-navy-50">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? (
                <><RefreshCw size={14} className="animate-spin" /> Saving...</>
              ) : (
                <><Check size={14} /> {initialData ? 'Save Changes' : 'Add Recruiter'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RecruiterCard({ recruiter, onEdit, onDelete, onStatusChange }) {
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const specialties = recruiter.specialty
    ? recruiter.specialty.split(',').map(s => s.trim()).filter(Boolean)
    : []

  const lastContact = recruiter.last_contact
    ? formatDate(recruiter.last_contact)
    : null

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value
    setUpdatingStatus(true)
    try {
      await onStatusChange(recruiter.id, newStatus)
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-4 hover:shadow-matte-md transition-shadow duration-200">
      {/* Agency name + badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-navy-900 truncate">
              {recruiter.agency || recruiter.name || 'Unknown Agency'}
            </h3>
            {recruiter.is_agency && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-navy-100 text-navy-600 border border-navy-200 shrink-0">
                <Building2 size={10} className="mr-1" /> Agency
              </span>
            )}
          </div>
          {recruiter.name && recruiter.agency && (
            <p className="text-sm text-navy-500 mt-0.5">{recruiter.name}</p>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(recruiter)}
            className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-50 transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          {deleteConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDelete(recruiter.id)}
                className="px-2 py-1 rounded text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-2 py-1 rounded text-xs font-medium text-navy-500 hover:bg-navy-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="p-1.5 rounded-lg text-navy-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Specialty tags */}
      {specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {specialties.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Contact info */}
      <div className="space-y-1.5">
        {recruiter.email && (
          <a
            href={`mailto:${recruiter.email}`}
            className="flex items-center gap-2 text-sm text-navy-600 hover:text-violet-DEFAULT transition-colors group"
          >
            <Mail size={13} className="text-navy-400 group-hover:text-violet-DEFAULT" />
            <span className="truncate">{recruiter.email}</span>
          </a>
        )}
        {recruiter.phone && (
          <div className="flex items-center gap-2 text-sm text-navy-600">
            <Phone size={13} className="text-navy-400" />
            <span>{recruiter.phone}</span>
          </div>
        )}
        {recruiter.agency_website && (
          <a
            href={recruiter.agency_website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-navy-600 hover:text-violet-DEFAULT transition-colors group"
          >
            <Globe size={13} className="text-navy-400 group-hover:text-violet-DEFAULT" />
            <span className="truncate">{recruiter.agency_website.replace(/^https?:\/\//, '')}</span>
            <ExternalLink size={11} className="text-navy-300 group-hover:text-violet-DEFAULT shrink-0" />
          </a>
        )}
        {recruiter.linkedin_url && (
          <a
            href={recruiter.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-800 transition-colors"
          >
            <ExternalLink size={13} />
            <span>LinkedIn Profile</span>
          </a>
        )}
      </div>

      {/* Outreach status */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-navy-400 uppercase tracking-wide">Outreach Status</label>
          {lastContact && (
            <span className="text-xs text-navy-400">Last: {lastContact}</span>
          )}
        </div>
        <div className="relative">
          <select
            className={`input appearance-none pr-8 text-xs font-medium ${OUTREACH_CLASSES[recruiter.outreach_status] || ''}`}
            value={recruiter.outreach_status || 'Not Contacted'}
            onChange={handleStatusChange}
            disabled={updatingStatus}
          >
            {OUTREACH_OPTIONS.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          {updatingStatus ? (
            <RefreshCw size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 animate-spin pointer-events-none" />
          ) : (
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
          )}
        </div>
      </div>

      {/* Notes */}
      {recruiter.notes && (
        <p className="text-xs text-navy-400 italic leading-relaxed line-clamp-2 border-t border-navy-50 pt-3">
          {recruiter.notes}
        </p>
      )}
    </div>
  )
}

function KnownAgenciesSection({ onAddAgency }) {
  const [adding, setAdding] = useState(null)

  const handleAdd = async (agency) => {
    setAdding(agency.name)
    try {
      await onAddAgency({
        ...EMPTY_FORM,
        agency: agency.name,
        agency_website: agency.url,
        specialty: agency.specialty,
        is_agency: true,
      })
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-navy-100" />
        <span className="text-xs font-semibold text-navy-400 uppercase tracking-widest">Known Agencies</span>
        <div className="h-px flex-1 bg-navy-100" />
      </div>
      <p className="text-sm text-navy-400 text-center">Quickly add known recruiting agencies to your directory.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {KNOWN_AGENCIES.map(agency => (
          <div key={agency.name} className="card p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy-800 truncate">{agency.name}</p>
              <p className="text-xs text-navy-400 mt-0.5">{agency.specialty}</p>
              {agency.url && (
                <a
                  href={agency.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet-DEFAULT hover:underline flex items-center gap-1 mt-0.5"
                >
                  Website <ExternalLink size={10} />
                </a>
              )}
            </div>
            <button
              onClick={() => handleAdd(agency)}
              disabled={adding === agency.name}
              className="btn-secondary py-1.5 text-xs shrink-0"
            >
              {adding === agency.name ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <Plus size={12} />
              )}
              Add
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Recruiters() {
  const [recruiters, setRecruiters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecruiter, setEditRecruiter] = useState(null)

  const fetchRecruiters = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await recruitersApi.getAll()
      setRecruiters(res.data || [])
    } catch (err) {
      setError('Failed to load recruiter directory. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRecruiters() }, [fetchRecruiters])

  const handleSave = async (form) => {
    if (editRecruiter) {
      await recruitersApi.update(editRecruiter.id, form)
    } else {
      await recruitersApi.create(form)
    }
    await fetchRecruiters()
  }

  const handleDelete = async (id) => {
    try {
      await recruitersApi.delete(id)
      setRecruiters(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const handleStatusChange = async (id, newStatus) => {
    setRecruiters(prev => prev.map(r => r.id === id ? { ...r, outreach_status: newStatus } : r))
    try {
      await recruitersApi.update(id, { outreach_status: newStatus })
    } catch (err) {
      console.error(err)
      await fetchRecruiters()
    }
  }

  const openAdd = () => { setEditRecruiter(null); setModalOpen(true) }
  const openEdit = (recruiter) => { setEditRecruiter(recruiter); setModalOpen(true) }

  const filtered = recruiters.filter(r => {
    const q = search.toLowerCase()
    return !q || (
      (r.name || '').toLowerCase().includes(q) ||
      (r.agency || '').toLowerCase().includes(q) ||
      (r.specialty || '').toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q)
    )
  })

  const statusCounts = OUTREACH_OPTIONS.reduce((acc, o) => {
    acc[o] = recruiters.filter(r => (r.outreach_status || 'Not Contacted') === o).length
    return acc
  }, {})

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Users size={24} className="text-violet-DEFAULT" />
            Recruiter Network
          </h1>
          <p className="text-sm text-navy-400 mt-0.5">
            Agency recruiters and headhunters specializing in AI & tech startups
          </p>
        </div>
      </div>

      {/* Status summary chips */}
      {!loading && recruiters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {OUTREACH_OPTIONS.map(o => statusCounts[o] > 0 && (
            <span
              key={o}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${OUTREACH_CLASSES[o]}`}
            >
              {o}
              <span className="font-bold">{statusCounts[o]}</span>
            </span>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
            <input
              className="input pl-9"
              placeholder="Search name, agency, specialty..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={fetchRecruiters} className="btn-secondary" title="Refresh">
              <RefreshCw size={15} />
              Refresh
            </button>
            <button onClick={openAdd} className="btn-primary">
              <Plus size={15} /> Add Recruiter
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      {loading ? (
        <div className="card flex items-center justify-center py-20 gap-3 text-navy-400">
          <RefreshCw size={20} className="animate-spin" />
          <span className="text-sm">Loading recruiter directory...</span>
        </div>
      ) : error ? (
        <div className="card flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-red-500 text-sm font-medium">{error}</p>
          <button onClick={fetchRecruiters} className="btn-secondary">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : filtered.length === 0 && search ? (
        <div className="card flex flex-col items-center justify-center py-16 gap-3 text-navy-400">
          <Search size={36} className="text-navy-200" />
          <div className="text-center">
            <p className="font-semibold text-navy-600">No recruiters match your search</p>
            <p className="text-sm mt-1">Try a different name, agency, or specialty.</p>
          </div>
          <button onClick={() => setSearch('')} className="btn-secondary mt-1">
            <X size={14} /> Clear Search
          </button>
        </div>
      ) : recruiters.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 gap-3 text-navy-400">
          <Users size={40} className="text-navy-200" />
          <div className="text-center">
            <p className="font-semibold text-navy-600">No recruiters added yet</p>
            <p className="text-sm mt-1">Add recruiters manually or use the known agencies below.</p>
          </div>
          <button onClick={openAdd} className="btn-primary mt-1">
            <Plus size={14} /> Add Your First Recruiter
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-navy-400">
              Showing <span className="font-medium text-navy-600">{filtered.length}</span> of {recruiters.length} recruiter{recruiters.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(r => (
              <RecruiterCard
                key={r.id}
                recruiter={r}
                onEdit={openEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        </>
      )}

      {/* Known agencies section - shown when no recruiters exist */}
      {!loading && !error && recruiters.length === 0 && (
        <KnownAgenciesSection
          onAddAgency={async (form) => {
            await recruitersApi.create(form)
            await fetchRecruiters()
          }}
        />
      )}

      {/* Modal */}
      <RecruiterModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditRecruiter(null) }}
        onSave={handleSave}
        initialData={editRecruiter}
      />
    </div>
  )
}
