import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Upload, FileText, Check, RefreshCw, User, GraduationCap, BookOpen,
  MapPin, Briefcase, Zap, AlertCircle, ChevronDown, Sparkles, X,
  Download, Eye, EyeOff, Mail, Link2, Link2Off, Save, MessageSquare,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { profileApi, authApi, nylasApi } from '../api'

const BASE_API = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api'
function fileDownloadUrl(fileType) {
  const token = localStorage.getItem('recruitiq_token') || ''
  const path = fileType === 'cover_letter' ? 'cover-letter' : fileType
  return `${BASE_API}/profile/${path}/download?token=${encodeURIComponent(token)}`
}

const FILE_TYPES = [
  { key: 'resume', label: 'Resume', hint: "PDF — we'll auto-extract your target roles, skills & location preferences", required: true },
]

const CAREER_STAGE_LABELS = {
  college_senior:    'College Senior — Entry-Level Full-Time',
  college_junior:    'College Junior — Summer Internship',
  college_sophomore: 'College Sophomore — Summer Internship',
  early_career:      '1–3 Years Experience',
  mid_career:        '3–6 Years Experience',
  senior:            '6+ Years Experience',
}

function UploadCard({ fileType, label, hint, required, currentFilename, onUploaded, uploading, setUploading }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const fileInputRef = useRef(null)
  const downloadUrl = fileDownloadUrl(fileType)

  const upload = async (file) => {
    if (!file) return
    if (!file.name.endsWith('.pdf')) { setError('Only PDF files are supported.'); return }
    setError(null)
    setUploading(fileType)
    try {
      const fd = new FormData()
      fd.append('file_type', fileType)
      fd.append('file', file)
      const res = await profileApi.uploadFile(fd)
      setSuccess(true)
      onUploaded(res.data)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed.')
    } finally {
      setUploading(null)
    }
  }

  const isLoading = uploading === fileType

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-navy-800 flex items-center gap-1.5">
            {label}
            {required && <span className="text-red-400 text-xs">*</span>}
            {currentFilename && !success && (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-600 ml-1">
                <Check size={11} /> Uploaded
              </span>
            )}
            {success && (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-600 ml-1">
                <Check size={11} /> Done!
              </span>
            )}
          </h3>
          <p className="text-xs text-navy-400 mt-0.5">{hint}</p>
        </div>
        {currentFilename && (
          <span className="shrink-0 text-xs text-navy-400 max-w-[140px] truncate">{currentFilename}</span>
        )}
      </div>

      {/* Drop zone */}
      <label
        htmlFor={`file-input-${fileType}`}
        onClick={e => { if (!isLoading) { e.preventDefault(); fileInputRef.current?.click() } }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files[0]) }}
        className={`relative flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          isLoading ? 'opacity-60 cursor-not-allowed' :
          dragging ? 'border-violet-DEFAULT bg-violet-50' :
          currentFilename ? 'border-emerald-300 bg-emerald-50/50 hover:border-violet-DEFAULT hover:bg-violet-50' :
          'border-navy-200 bg-navy-50/50 hover:border-violet-DEFAULT hover:bg-violet-50'
        }`}
      >
        {isLoading ? (
          <RefreshCw size={20} className="animate-spin text-violet-DEFAULT" />
        ) : currentFilename ? (
          <FileText size={20} className="text-emerald-500" />
        ) : (
          <Upload size={20} className="text-navy-300" />
        )}
        <p className="text-sm text-navy-500">
          {isLoading ? 'Uploading & parsing…' :
           currentFilename ? 'Click to replace' :
           'Click to upload or drag & drop'}
        </p>
        <p className="text-xs text-navy-400">PDF only</p>
        <input ref={fileInputRef} id={`file-input-${fileType}`} type="file" accept=".pdf" className="hidden"
          disabled={isLoading} onChange={e => upload(e.target.files[0])} />
      </label>

      {/* View / Download actions — shown when a file exists */}
      {currentFilename && (
        <div className="flex items-center gap-2 pt-1">
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-navy-500 hover:text-navy-800 border border-navy-200 bg-white hover:bg-navy-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Download size={12} /> Download PDF
          </a>
          <button
            onClick={() => setShowPreview(p => !p)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-800 border border-violet-200 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            {showPreview ? <><EyeOff size={12} /> Hide Preview</> : <><Eye size={12} /> View PDF</>}
          </button>
        </div>
      )}

      {/* Inline PDF preview */}
      {showPreview && currentFilename && (
        <div className="mt-2 rounded-xl overflow-hidden border border-navy-200 shadow-sm">
          <iframe
            src={`${downloadUrl}&inline=1`}
            title={`${label} Preview`}
            className="w-full"
            style={{ height: '520px' }}
          />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs">
          <AlertCircle size={13} /> {error}
        </div>
      )}
    </div>
  )
}

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const location = useLocation()
  const isFirstTime = location.state?.firstTime

  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(null)   // which file type is uploading

  // Career context
  const [customContext, setCustomContext] = useState('')
  const [contextSaving, setContextSaving] = useState(false)
  const [contextSaved, setContextSaved] = useState(false)

  // Edit account info
  const [editInfo, setEditInfo] = useState(false)
  const [infoForm, setInfoForm] = useState({})
  const [savingInfo, setSavingInfo] = useState(false)

  // Nylas Gmail state
  const [nylasStatus, setNylasStatus]       = useState({ connected: false, email: null })
  const [nylasConfig, setNylasConfig]       = useState(null)
  const [nylasLoading, setNylasLoading]     = useState(false)
  const [nylasMsg, setNylasMsg]             = useState(null)   // success/error banner
  const [showNylasDebug, setShowNylasDebug] = useState(false)

  useEffect(() => {
    profileApi.get()
      .then(res => {
        setProfile(res.data.profile)
        setCustomContext(res.data.profile?.custom_context || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Check Nylas status + config
    nylasApi.getStatus()
      .then(res => setNylasStatus(res.data))
      .catch(() => setNylasStatus({ connected: false, email: null }))
    nylasApi.getConfig()
      .then(res => setNylasConfig(res.data))
      .catch(() => {})

    // Handle redirect back from Nylas OAuth
    const params = new URLSearchParams(window.location.search)
    const nylasParam = params.get('nylas')
    if (nylasParam === 'connected') {
      setNylasMsg({ type: 'success', text: 'Gmail connected successfully!' })
      nylasApi.getStatus().then(res => setNylasStatus(res.data)).catch(() => {})
      window.history.replaceState({}, '', window.location.pathname)
    } else if (nylasParam === 'error') {
      const reason = params.get('reason') || 'unknown'
      const reasonText = {
        not_configured: 'Nylas keys not configured on the server.',
        token_exchange: 'OAuth token exchange failed — check NYLAS_CLIENT_ID, NYLAS_API_KEY, and NYLAS_REDIRECT_URI.',
        exception: 'An unexpected error occurred during the OAuth callback.',
      }[reason] || `Error: ${reason}`
      setNylasMsg({ type: 'error', text: reasonText })
      setShowNylasDebug(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleUploaded = (data) => {
    setProfile(data.profile)
    refreshUser()
  }

  const handleSaveInfo = async () => {
    setSavingInfo(true)
    try {
      await authApi.updateMe(infoForm)
      await refreshUser()
      setEditInfo(false)
    } catch {}
    finally { setSavingInfo(false) }
  }

  const handleNylasConnect = async () => {
    setNylasLoading(true)
    setNylasMsg(null)
    try {
      const res = await nylasApi.getAuthUrl()
      window.location.href = res.data.url
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Could not start Gmail connection.'
      setNylasMsg({ type: 'error', text: detail })
      setNylasLoading(false)
    }
  }

  const handleNylasDisconnect = async () => {
    setNylasLoading(true)
    setNylasMsg(null)
    try {
      await nylasApi.disconnect()
      setNylasStatus({ connected: false, email: null })
      setNylasMsg({ type: 'success', text: 'Gmail disconnected.' })
    } catch {
      setNylasMsg({ type: 'error', text: 'Disconnect failed. Please try again.' })
    } finally {
      setNylasLoading(false)
    }
  }

  const handleSaveContext = async () => {
    setContextSaving(true)
    try {
      await profileApi.updateParsed({ custom_context: customContext })
      setContextSaved(true)
      setTimeout(() => setContextSaved(false), 2500)
    } catch {}
    finally { setContextSaving(false) }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-32 gap-3 text-navy-400">
        <RefreshCw size={20} className="animate-spin" />
        <span className="text-sm">Loading profile…</span>
      </div>
    )
  }

  const currentYear = new Date().getFullYear()
  const gradYears   = Array.from({ length: 8 }, (_, i) => String(currentYear + i))

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <User size={22} className="text-violet-DEFAULT" />
            My Profile
          </h1>
          <p className="text-sm text-navy-400 mt-0.5">Manage your account and upload documents for personalized job matching</p>
        </div>
      </div>

      {isFirstTime && (
        <div className="card p-4 flex items-start gap-3" style={{ background: 'linear-gradient(135deg, #f5f0ff 0%, #e8f4ff 100%)', borderColor: '#c4b0e8' }}>
          <Sparkles size={18} className="text-violet-DEFAULT shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-navy-800">Welcome to RecruitIQ</p>
            <p className="text-sm text-navy-600 mt-0.5">
              Upload your resume below and we'll automatically discover jobs matching your background,
              skills, and location preferences.
            </p>
          </div>
        </div>
      )}

      {/* Account Info */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-navy-800 flex items-center gap-2">
            <GraduationCap size={17} className="text-violet-DEFAULT" />
            Account Information
          </h2>
          {!editInfo && (
            <button onClick={() => { setEditInfo(true); setInfoForm({ name: user?.name, university: user?.university, graduation_year: user?.graduation_year, major: user?.major, minor: user?.minor, high_school: user?.high_school, grad_school: user?.grad_school, career_stage: user?.career_stage, linkedin_url: user?.linkedin_url }) }}
              className="btn-secondary py-1.5 text-xs">
              Edit
            </button>
          )}
        </div>

        {editInfo ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1 uppercase tracking-wide">Name</label>
              <input className="input" value={infoForm.name || ''} onChange={e => setInfoForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1 uppercase tracking-wide">LinkedIn URL <span className="text-navy-300 font-normal normal-case">(optional)</span></label>
              <input className="input" placeholder="https://linkedin.com/in/yourname" value={infoForm.linkedin_url || ''}
                onChange={e => setInfoForm(f => ({ ...f, linkedin_url: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1 uppercase tracking-wide">University</label>
              <input className="input" placeholder="e.g. University of Michigan" value={infoForm.university || ''}
                onChange={e => setInfoForm(f => ({ ...f, university: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1 uppercase tracking-wide">Graduation Year</label>
              <select className="input appearance-none" value={infoForm.graduation_year || ''}
                onChange={e => setInfoForm(f => ({ ...f, graduation_year: e.target.value }))}>
                <option value="">Select</option>
                {gradYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1 uppercase tracking-wide">Major</label>
              <input className="input" placeholder="e.g. BCN, Finance" value={infoForm.major || ''}
                onChange={e => setInfoForm(f => ({ ...f, major: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1 uppercase tracking-wide">Minor <span className="text-navy-300 font-normal normal-case">(optional)</span></label>
              <input className="input" placeholder="e.g. Statistics, Philosophy" value={infoForm.minor || ''}
                onChange={e => setInfoForm(f => ({ ...f, minor: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1 uppercase tracking-wide">High School <span className="text-navy-300 font-normal normal-case">(optional)</span></label>
              <input className="input" placeholder="e.g. Cranbrook School" value={infoForm.high_school || ''}
                onChange={e => setInfoForm(f => ({ ...f, high_school: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy-500 mb-1 uppercase tracking-wide">Graduate School <span className="text-navy-300 font-normal normal-case">(optional)</span></label>
              <input className="input" placeholder="e.g. Harvard Business School" value={infoForm.grad_school || ''}
                onChange={e => setInfoForm(f => ({ ...f, grad_school: e.target.value }))} />
            </div>
            <div className="col-span-2 flex gap-2 pt-1">
              <button onClick={() => setEditInfo(false)} className="btn-secondary py-1.5 text-sm">Cancel</button>
              <button onClick={handleSaveInfo} disabled={savingInfo} className="btn-primary py-1.5 text-sm">
                {savingInfo ? <><RefreshCw size={13} className="animate-spin" /> Saving…</> : <><Check size={13} /> Save</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-y-3">
            {[
              { label: 'Name',            value: user?.name },
              { label: 'Email',           value: user?.email },
              { label: 'University',      value: user?.university },
              { label: 'Graduation Year', value: user?.graduation_year },
              { label: 'Major',           value: user?.major },
              { label: 'Minor',           value: user?.minor },
              { label: 'High School',     value: user?.high_school },
              { label: 'Grad School',     value: user?.grad_school },
              { label: 'Career Stage',    value: CAREER_STAGE_LABELS[user?.career_stage] || user?.career_stage },
              { label: 'LinkedIn',        value: user?.linkedin_url },
            ].filter(({ label, value }) => value || label === 'Name' || label === 'Email' || label === 'University').map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-navy-400 uppercase tracking-wide font-semibold">{label}</p>
                {label === 'LinkedIn' && value
                  ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 hover:underline mt-0.5 block truncate">{value}</a>
                  : <p className="text-sm text-navy-800 mt-0.5">{value || <span className="text-navy-300 italic">Not set</span>}</p>
                }
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Career Context */}
      <div className="card p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-navy-800 flex items-center gap-2">
            <MessageSquare size={17} className="text-violet-DEFAULT" />
            Career Context
          </h2>
          <span className="text-xs text-navy-400">Optional</span>
        </div>
        <p className="text-sm text-navy-500">
          Describe the type of roles you're targeting, industries you're interested in, or anything else that should guide your job recommendations. This supplements your resume for better matching.
        </p>
        <textarea
          className="input"
          rows={4}
          placeholder="e.g. I'm looking for strategy or operations roles at early-stage fintech or healthcare startups. Interested in companies focused on AI. Prefer roles with exposure to senior leadership."
          value={customContext}
          onChange={e => setCustomContext(e.target.value)}
        />
        <div className="flex items-center justify-end gap-2">
          {contextSaved && (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <Check size={12} /> Saved
            </span>
          )}
          <button
            onClick={handleSaveContext}
            disabled={contextSaving}
            className="btn-secondary py-1.5 text-sm flex items-center gap-1.5"
          >
            {contextSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            Save Context
          </button>
        </div>
      </div>

      {/* File uploads */}
      <div>
        <h2 className="text-base font-semibold text-navy-800 flex items-center gap-2 mb-3">
          <FileText size={17} className="text-violet-DEFAULT" />
          Documents
        </h2>
        <div className="space-y-4">
          {FILE_TYPES.map(ft => (
            <UploadCard
              key={ft.key}
              fileType={ft.key}
              label={ft.label}
              hint={ft.hint}
              required={ft.required}
              currentFilename={profile?.[`${ft.key}_filename`]}
              onUploaded={handleUploaded}
              uploading={uploading}
              setUploading={setUploading}
            />
          ))}
        </div>
      </div>

      {/* ── Gmail / Nylas Integration ─────────────────────────────────── */}
      <div className="card p-6 space-y-4">
        <h2 className="text-base font-semibold text-navy-800 flex items-center gap-2">
          <Mail size={17} className="text-violet-DEFAULT" />
          Integrations
        </h2>

        {/* Nylas banner */}
        {nylasMsg && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border ${
            nylasMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {nylasMsg.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
            {nylasMsg.text}
            <button className="ml-auto p-0.5 rounded" onClick={() => setNylasMsg(null)}><X size={13} /></button>
          </div>
        )}

        {/* Gmail row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Gmail icon */}
            <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
              <Mail size={16} className="text-red-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-800">Gmail</p>
              {nylasStatus?.connected ? (
                <p className="text-xs text-emerald-600 font-medium">
                  Connected{nylasStatus.email ? ` · ${nylasStatus.email}` : ''}
                </p>
              ) : (
                <p className="text-xs text-navy-400">Send networking emails directly from RecruitIQ</p>
              )}
            </div>
          </div>

          {nylasStatus?.connected ? (
            <button
              onClick={handleNylasDisconnect}
              disabled={nylasLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {nylasLoading
                ? <RefreshCw size={13} className="animate-spin" />
                : <Link2Off size={13} />}
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleNylasConnect}
              disabled={nylasLoading}
              className="btn-primary flex items-center gap-1.5 py-1.5 text-xs disabled:opacity-50"
            >
              {nylasLoading
                ? <RefreshCw size={13} className="animate-spin" />
                : <Link2 size={13} />}
              Connect Gmail
            </button>
          )}
        </div>

        {!nylasStatus?.connected && (
          <div className="border-t border-navy-100 pt-3 space-y-2">
            {nylasConfig && !nylasConfig.configured && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">Gmail integration needs setup</p>
                  <p>Add to Railway environment variables:</p>
                  <ul className="space-y-0.5 ml-2">
                    {!nylasConfig.has_client_id && <li><code className="bg-amber-100 px-1 rounded">NYLAS_CLIENT_ID</code> — from Nylas dashboard</li>}
                    {!nylasConfig.has_api_key && <li><code className="bg-amber-100 px-1 rounded">NYLAS_API_KEY</code> — from Nylas dashboard</li>}
                    <li><code className="bg-amber-100 px-1 rounded">NYLAS_REDIRECT_URI</code> — set to: <code className="bg-amber-100 px-1 rounded break-all">{(import.meta.env.VITE_API_URL || 'http://localhost:8000')}/api/nylas/callback</code></li>
                    <li><code className="bg-amber-100 px-1 rounded">FRONTEND_URL</code> — set to: <code className="bg-amber-100 px-1 rounded">{window.location.origin}</code></li>
                  </ul>
                </div>
              </div>
            )}
            {nylasConfig?.configured && showNylasDebug && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">Debug info</p>
                <p>Redirect URI: <code className="bg-slate-100 px-1 rounded break-all">{nylasConfig.redirect_uri}</code></p>
                <p>Make sure this exactly matches what's registered in your Nylas dashboard under "Redirect URIs".</p>
              </div>
            )}
            {nylasConfig?.configured && !showNylasDebug && (
              <p className="text-xs text-navy-400">
                Connect Gmail to send networking emails directly from RecruitIQ.{' '}
                <button onClick={() => setShowNylasDebug(true)} className="text-violet-500 hover:underline">Having trouble?</button>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Parsed profile preview */}
      {profile && (profile.suggested_roles?.length > 0 || profile.skills?.length > 0) && (
        <div className="card p-6 space-y-4" style={{ background: 'linear-gradient(135deg, #f5f0ff 0%, #e8f4ff 100%)', borderColor: '#c4b0e8' }}>
          <h2 className="text-base font-semibold text-navy-800 flex items-center gap-2">
            <Sparkles size={17} className="text-violet-DEFAULT" />
            Detected from your resume
          </h2>

          {profile.school && (
            <div className="flex items-center gap-2 text-sm text-navy-600">
              <GraduationCap size={15} className="text-violet-DEFAULT" />
              <span>{profile.school}</span>
              {profile.gpa && <span className="text-navy-400">· GPA {profile.gpa}</span>}
            </div>
          )}

          {profile.suggested_locations?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2">Target Locations</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.suggested_locations.map(loc => (
                  <span key={loc} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700 border border-sky-200">
                    <MapPin size={10} /> {loc}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.suggested_roles?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2">Target Roles Detected</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.suggested_roles.slice(0, 8).map(role => (
                  <span key={role} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 border border-violet-200">
                    <Briefcase size={10} /> {role}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.skills?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wide mb-2">Skills Detected</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.slice(0, 12).map(skill => (
                  <span key={skill} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white text-navy-700 border border-navy-200">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-navy-400 pt-1 border-t border-navy-100">
            These signals are used to personalize your job discovery scores and preferences.
            Go to <strong className="text-navy-600">Job Discovery → Preferences</strong> to fine-tune them.
          </p>
        </div>
      )}
    </div>
  )
}
