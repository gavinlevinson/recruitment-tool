import { Link } from 'react-router-dom'
import { Search, Briefcase, Sparkles, Calendar, ArrowRight } from 'lucide-react'
import OrionMark from '../components/OrionMark'

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-900 via-navy-800 to-navy-900 text-white">
      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center">
            <OrionMark className="w-8 h-8" light />
          </div>
          <h1 className="text-4xl font-black">Orion Recruit</h1>
        </div>
        <p className="text-xl text-violet-300 max-w-2xl mx-auto leading-relaxed">
          AI-powered job discovery and recruitment management for early-career professionals.
        </p>
        <p className="text-sm text-white/50 mt-3 max-w-xl mx-auto">
          Discover thousands of jobs daily from VC portfolios, job boards, and curated newsletters.
          Track your pipeline, build your network, and get AI coaching — all in one place.
        </p>

        <div className="flex items-center justify-center gap-4 mt-10">
          <Link to="/register" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-lg transition-colors">
            Get Started <ArrowRight size={20} />
          </Link>
          <Link to="/login" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl border border-white/20 hover:bg-white/10 text-white font-medium text-lg transition-colors">
            Sign In
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-4">
              <Search size={20} className="text-cyan-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Job Discovery</h3>
            <p className="text-sm text-white/60">Scrapes 20+ sources daily — VC portfolios, ATS systems, job boards, and newsletters — and scores each role against your profile.</p>
          </div>

          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
              <Briefcase size={20} className="text-amber-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Pipeline Tracker</h3>
            <p className="text-sm text-white/60">Track applications from discovery to offer. Manage contacts, send emails, and schedule networking calls — all from one dashboard.</p>
          </div>

          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center mb-4">
              <Sparkles size={20} className="text-pink-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">AI Coaching</h3>
            <p className="text-sm text-white/60">Get personalized feedback on your resume, cover letters, and application answers. Practice behavioral interviews with voice.</p>
          </div>

          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4">
              <Calendar size={20} className="text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Stay Organized</h3>
            <p className="text-sm text-white/60">Deadlines, interviews, and networking calls synced to Google Calendar. Career events from Eventbrite. Never miss an opportunity.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 py-8">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between text-xs text-white/30">
          <p>Orion Recruit</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-white/60">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white/60">Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
