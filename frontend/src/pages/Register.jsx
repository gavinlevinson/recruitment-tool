import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Zap, User, Mail, Lock, Eye, EyeOff, RefreshCw, AlertCircle,
  GraduationCap, BookOpen, ChevronRight, ChevronLeft, Check,
  Briefcase, TrendingUp, Sprout, Rocket,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const CAREER_STAGES = [
  {
    id: 'college_senior',
    label: 'College Senior',
    sublabel: 'Entry-level full-time roles after graduation',
    Icon: GraduationCap,
    available: true,
  },
  {
    id: 'college_junior',
    label: 'College Junior',
    sublabel: 'Summer internships',
    Icon: BookOpen,
    available: false,
  },
  {
    id: 'college_sophomore',
    label: 'College Sophomore',
    sublabel: 'Freshman / Sophomore internships',
    Icon: Sprout,
    available: false,
  },
  {
    id: 'early_career',
    label: '1–3 Years Experience',
    sublabel: 'Full-time roles with some experience',
    Icon: Rocket,
    available: false,
  },
  {
    id: 'mid_career',
    label: '3–6 Years Experience',
    sublabel: 'Mid-level and senior IC roles',
    Icon: Briefcase,
    available: false,
  },
]

const STEPS = ['Account', 'Career Stage', 'Academic Info']

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const [showPw, setShowPw] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    career_stage: 'college_senior',
    university: '',
    graduation_year: '',
    major: '',
    minor: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await register(form)
      navigate('/profile', { replace: true, state: { firstTime: true } })
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const currentYear = new Date().getFullYear()
  const gradYears = Array.from({ length: 8 }, (_, i) => String(currentYear + i))

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#8b6bbf' }}>
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy-900">RecruitIQ</h1>
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
            </div>
          )}

          {/* ── Step 1: Career Stage ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-navy-900">Where are you in your career?</h2>
                <p className="text-sm text-navy-400 mt-1">We'll tailor job discovery to your stage.</p>
              </div>

              <div className="space-y-2">
                {CAREER_STAGES.map(stage => (
                  <button
                    key={stage.id}
                    type="button"
                    disabled={!stage.available}
                    onClick={() => stage.available && set('career_stage', stage.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                      !stage.available
                        ? 'opacity-40 cursor-not-allowed border-navy-100 bg-navy-50'
                        : form.career_stage === stage.id
                        ? 'border-violet-DEFAULT bg-violet-50'
                        : 'border-navy-200 bg-white hover:border-navy-300'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      form.career_stage === stage.id && stage.available
                        ? 'bg-violet-100'
                        : 'bg-navy-100'
                    }`}>
                      <stage.Icon size={16} className={form.career_stage === stage.id && stage.available ? 'text-violet-DEFAULT' : 'text-navy-500'} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${form.career_stage === stage.id ? 'text-violet-DEFAULT' : 'text-navy-800'}`}>
                        {stage.label}
                        {!stage.available && <span className="ml-2 text-xs font-normal text-navy-400">Coming soon</span>}
                      </p>
                      <p className="text-xs text-navy-400 mt-0.5">{stage.sublabel}</p>
                    </div>
                    {form.career_stage === stage.id && stage.available && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: '#8b6bbf' }}>
                        <Check size={11} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="btn-secondary flex-1 justify-center">
                  <ChevronLeft size={15} /> Back
                </button>
                <button onClick={next} className="btn-primary flex-1 justify-center">
                  Continue <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Academic Info ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-navy-900">Academic background</h2>
                <p className="text-sm text-navy-400 mt-1">Optional — helps us personalize job matching.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">University</label>
                <div className="relative">
                  <GraduationCap size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
                  <input className="input pl-9" placeholder="e.g. University of Michigan"
                    value={form.university} onChange={e => set('university', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Graduation Year</label>
                  <select className="input appearance-none" value={form.graduation_year}
                    onChange={e => set('graduation_year', e.target.value)}>
                    <option value="">Select year</option>
                    {gradYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Major</label>
                  <div className="relative">
                    <BookOpen size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
                    <input className="input pl-9" placeholder="e.g. BCN, Finance"
                      value={form.major} onChange={e => set('major', e.target.value)} />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-navy-500 mb-1.5 uppercase tracking-wide">Minor <span className="text-navy-300 font-normal normal-case">(optional)</span></label>
                  <div className="relative">
                    <BookOpen size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
                    <input className="input pl-9" placeholder="e.g. Statistics, Philosophy"
                      value={form.minor} onChange={e => set('minor', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1 justify-center">
                  <ChevronLeft size={15} /> Back
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-2.5">
                  {loading
                    ? <><RefreshCw size={15} className="animate-spin" /> Creating…</>
                    : <><Check size={15} /> Create Account</>}
                </button>
              </div>

              <p className="text-center text-xs text-navy-400">
                You can upload your resume next to auto-fill your profile.
              </p>
            </form>
          )}

          {step === 0 && (
            <p className="text-center text-sm text-navy-400">
              Already have an account?{' '}
              <Link to="/login" className="font-medium hover:underline" style={{ color: '#8b6bbf' }}>Sign in</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
