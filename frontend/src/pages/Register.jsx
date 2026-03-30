import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Zap, User, Mail, Lock, Eye, EyeOff, RefreshCw, AlertCircle,
  GraduationCap, ChevronRight, ChevronLeft, Check,
  BookOpen, Linkedin, FileText, Upload, X, Sparkles, Minus, Plus,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { profileApi, preferencesApi } from '../api'
import OrionMark from '../components/OrionMark'

const STEPS = ['Account', 'Background', 'Resume']

function yearsToStage(n) {
  if (n <= 0) return 'college_senior'
  if (n <= 2) return 'early_career'
  if (n <= 5) return 'mid_career'
  return 'senior'
}

const STAGE_LABELS = {
  college_senior: { label: 'Student / New Grad', color: 'bg-violet-100 text-violet-700' },
  early_career:   { label: 'Early Career',        color: 'bg-blue-100 text-blue-700' },
  mid_career:     { label: 'Mid-Level',            color: 'bg-amber-100 text-amber-700' },
  senior:         { label: 'Senior',               color: 'bg-emerald-100 text-emerald-700' },
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const [showPw, setShowPw] = useState(false)
  const [resumeFile, setResumeFile]     = useState(null)
  const [dragOver, setDragOver]         = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    years_num: 0,           // freeform years — drives career_stage
    career_stage: 'college_senior',
    years_experience: '0',
    linkedin_url: '',
    university: '',
    major: '',
    minor: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const setYears = (n) => {
    const clamped = Math.max(0, Math.min(40, n))
    setForm(f => ({
      ...f,
      years_num: clamped,
      years_experience: String(clamped),
      career_stage: yearsToStage(clamped),
    }))
  }

  const validateStep = () => {
    if (step === 0) {
      if (!form.name.trim()) return 'Name is required'
      if (!form.email.trim() || !form.email.includes('@')) return 'Valid email is required'
      if (form.password.length < 8) return 'Password must be at least 8 characters'
    }
    return null
  }

  const next = () => {
    const err = validateStep()
    if (err) { setError(err); return }
    setError(null)
    setStep(s => s + 1)
  }

  const handleFileSelect = (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['pdf', 'docx', 'doc'].includes(ext)) {
      setError('Please upload a PDF or Word document.')
      return
    }
    setError(null)
    setResumeFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFileSelect(e.dataTransfer.files[0])
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await register(form)

      if (resumeFile) {
        setUploadStatus('uploading')
        try {
          const fd = new FormData()
          fd.append('file', resumeFile)
          await profileApi.uploadFile(fd)
          await preferencesApi.rescore()
          setUploadStatus('done')
        } catch {
          setUploadStatus('error')
        }
      }

      navigate('/discovery', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const stageInfo = STAGE_LABELS[form.career_stage]

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <OrionMark className="w-12 h-12" />
          <div>
            <h1 className="text-2xl font-bold text-navy-900">Orion</h1>
            <p className="text-xs text-navy-400">AI-Powered Job Search</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? 'bg-emerald-500 text-white' :
                i === step ? 'text-white' : 'bg-navy-200 text-navy-500'
              }`} style={i === step ? { background: '#8b6bbf' } : {}}>
                {i < step ? <Check size={13} /> : i + 1}
              </div>
              <span className={`text-xs font-medium ${i === step ? 'text-navy-700' : 'text-navy-400'}`}>{label}</span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-navy-200 mx-1" />}
            </div>
          ))}
        </div>

        <div className="card p-8 space-y-5">

          {error && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {/* ── Step 0: Account ── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-navy-900">Create your account</h2>
                <p className="text-sm text-navy-400 mt-1">Free forever. No credit card required.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Full Name</label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
                  <input className="input pl-9" placeholder="Jane Smith" value={form.name}
                    onChange={e => set('name', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
                  <input type="email" className="input pl-9" placeholder="you@example.com" value={form.email}
                    onChange={e => set('email', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
                  <input type={showPw ? 'text' : 'password'} className="input pl-9 pr-10"
                    placeholder="Min 8 characters" value={form.password}
                    onChange={e => set('password', e.target.value)} />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy-600">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button onClick={next} className="btn-primary w-full justify-center py-2.5">
                Continue <ChevronRight size={15} />
              </button>

              <p className="text-center text-sm text-navy-400">
                Already have an account?{' '}
                <Link to="/login" className="font-medium hover:underline" style={{ color: '#8b6bbf' }}>Sign in</Link>
              </p>
            </div>
          )}

          {/* ── Step 1: Background ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-navy-900">Tell us about yourself</h2>
                <p className="text-sm text-navy-400 mt-1">Helps us personalize your job discovery.</p>
              </div>

              {/* Years of experience */}
              <div>
                <label className="block text-xs font-semibold text-navy-500 mb-0.5 uppercase tracking-wide">
                  Years of professional experience
                </label>
                <p className="text-xs text-navy-400 mb-3">Include internships, co-ops, and part-time roles</p>

                <div className="flex items-center gap-4">
                  {/* Stepper */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setYears(form.years_num - 1)}
                      className="w-9 h-9 rounded-lg border border-navy-200 bg-white flex items-center justify-center text-navy-600 hover:bg-navy-50 transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="40"
                      value={form.years_num}
                      onChange={e => setYears(parseInt(e.target.value) || 0)}
                      className="w-16 text-center input font-semibold text-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setYears(form.years_num + 1)}
                      className="w-9 h-9 rounded-lg border border-navy-200 bg-white flex items-center justify-center text-navy-600 hover:bg-navy-50 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Dynamic level badge */}
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${stageInfo.color}`}>
                    {stageInfo.label}
                  </span>
                </div>
              </div>

              {/* University / Major / Minor — only relevant for students & new grads */}
              {form.years_num < 3 && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
                      University <span className="text-navy-300 font-normal normal-case">(optional)</span>
                    </label>
                    <div className="relative">
                      <GraduationCap size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
                      <input className="input pl-9" placeholder="e.g. University of Michigan"
                        value={form.university} onChange={e => set('university', e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
                        Major <span className="text-navy-300 font-normal normal-case">(optional)</span>
                      </label>
                      <div className="relative">
                        <BookOpen size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
                        <input className="input pl-9" placeholder="e.g. Finance, CS"
                          value={form.major} onChange={e => set('major', e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
                        Minor <span className="text-navy-300 font-normal normal-case">(optional)</span>
                      </label>
                      <div className="relative">
                        <BookOpen size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
                        <input className="input pl-9" placeholder="e.g. Statistics"
                          value={form.minor} onChange={e => set('minor', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* LinkedIn */}
              <div>
                <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">
                  LinkedIn URL <span className="text-navy-300 font-normal normal-case">(optional)</span>
                </label>
                <div className="relative">
                  <Linkedin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
                  <input
                    className="input pl-9"
                    placeholder="https://linkedin.com/in/yourprofile"
                    value={form.linkedin_url}
                    onChange={e => set('linkedin_url', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(0)} className="btn-secondary flex-1 justify-center">
                  <ChevronLeft size={15} /> Back
                </button>
                <button onClick={next} className="btn-primary flex-1 justify-center">
                  Continue <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Resume Upload ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-navy-900">Add your resume</h2>
                <p className="text-sm text-navy-400 mt-1">Optional — you can skip and add it later.</p>
              </div>

              {/* Info banner */}
              <div className="flex gap-3 p-4 rounded-xl border border-violet-200 bg-violet-50">
                <Sparkles size={16} className="shrink-0 mt-0.5" style={{ color: '#8b6bbf' }} />
                <p className="text-sm text-violet-800 leading-relaxed">
                  Your resume automatically configures your <strong>Job Discovery preferences</strong> — role types,
                  location, and experience level are set for you. You can always fine-tune them later in the{' '}
                  <strong>Discovery</strong> page.
                </p>
              </div>

              {/* Upload area */}
              {!resumeFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragOver
                      ? 'border-violet-400 bg-violet-50'
                      : 'border-navy-200 bg-navy-50 hover:border-navy-300 hover:bg-white'
                  }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white border border-navy-200 flex items-center justify-center shadow-sm">
                      <Upload size={20} className="text-navy-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-navy-700">
                        {dragOver ? 'Drop your resume here' : 'Drag & drop your resume'}
                      </p>
                      <p className="text-xs text-navy-400 mt-0.5">or click to browse — PDF or Word (.docx)</p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc"
                    className="hidden"
                    onChange={e => handleFileSelect(e.target.files[0])}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-800 truncate">{resumeFile.name}</p>
                    <p className="text-xs text-emerald-600">{(resumeFile.size / 1024).toFixed(0)} KB — ready to upload</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResumeFile(null)}
                    className="text-emerald-400 hover:text-emerald-700 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1 justify-center">
                  <ChevronLeft size={15} /> Back
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-2.5">
                  {loading ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      {uploadStatus === 'uploading' ? 'Uploading…' : 'Creating account…'}
                    </>
                  ) : resumeFile ? (
                    <><Check size={15} /> Upload & Get Started</>
                  ) : (
                    <><Zap size={15} /> Create Account</>
                  )}
                </button>
              </div>

              {!resumeFile && (
                <p className="text-center text-xs text-navy-400">
                  No resume? No problem — you can upload one anytime from your{' '}
                  <span className="font-medium text-navy-500">Profile</span> page.
                </p>
              )}
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
