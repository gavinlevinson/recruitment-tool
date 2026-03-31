import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase, RefreshCw, ChevronRight,
  Users, Plus, Check, Mail, AlertCircle,
} from 'lucide-react'
import { jobsApi, contactsApi, discoveredApi, statsApi, nylasApi, interviewRoundsApi } from '../api'
import OrionMark from '../components/OrionMark'
import { useAuth } from '../context/AuthContext'
import { daysSince as _daysSince } from '../utils/dates'

// ── Helpers ───────────────────────────────────────────────────────────────────
function greeting(name) {
  const h = new Date().getHours()
  const prefix = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${prefix}, ${(name || '').split(' ')[0]}`
}
function daysSince(d) { return _daysSince(d) }
const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700', 'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
]
function avatarColor(name) { return AVATAR_COLORS[(name || '').length % 4] }
function nameInitials(name) {
  if (!name) return '?'
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}
const OUTREACH_CLASS = {
  'Emailed':           'bg-sky-100 text-sky-700 border border-sky-200',
  'Called':            'bg-amber-100 text-amber-700 border border-amber-200',
  'Meeting Scheduled': 'bg-violet-100 text-violet-700 border border-violet-200',
  'Met':               'bg-emerald-100 text-emerald-700 border border-emerald-200',
}
const HEALTH_ORDER = { bad: 0, warn: 1, good: 2, neutral: 3 }
const HEALTH = {
  good:    { dot: 'bg-emerald-400', label: 'On track',   text: 'text-emerald-700', bg: 'bg-emerald-50' },
  warn:    { dot: 'bg-amber-400',   label: 'Watch this', text: 'text-amber-700',   bg: 'bg-amber-50'   },
  bad:     { dot: 'bg-red-400',     label: 'Needs work', text: 'text-red-600',     bg: 'bg-red-50'     },
  neutral: { dot: 'bg-slate-300',   label: 'No data yet',text: 'text-slate-500',   bg: 'bg-slate-50'   },
}

// ── Company Logo ──────────────────────────────────────────────────────────────
function CompanyLogo({ company, size = 26 }) {
  const domain = (company || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'
  const src = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=64`
  const [failed, setFailed] = useState(false)
  if (failed || !company) {
    return (
      <div className="rounded-md bg-violet-100 text-violet-700 font-bold flex items-center justify-center shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.4 }}>
        {(company?.[0] || '?').toUpperCase()}
      </div>
    )
  }
  return <img src={src} alt={company} onError={() => setFailed(true)}
    className="rounded-md object-contain bg-white border border-navy-100 shrink-0"
    style={{ width: size, height: size }} />
}

// ── Analytics engine ──────────────────────────────────────────────────────────
function analyse(jobs, contacts, discovered) {
  const active  = jobs.filter(j => !['Accepted', 'Rejected'].includes(j.status))
  const notApp  = jobs.filter(j => j.status === 'Not Applied')
  const review  = jobs.filter(j => j.status === 'Under Review')
  const inter   = jobs.filter(j => j.status === 'Interviewing')
  const applied = jobs.filter(j => j.status !== 'Not Applied')

  // ── Pipeline velocity ─────────────────────────────────────────────────────
  const reviewAges   = review.map(j => daysSince(j.updated_at) ?? 0)
  const avgReviewAge = reviewAges.length
    ? Math.round(reviewAges.reduce((a, b) => a + b, 0) / reviewAges.length) : null
  const stagnant14 = review.filter(j => (daysSince(j.updated_at) ?? 0) >= 14)
  const stagnant21 = review.filter(j => (daysSince(j.updated_at) ?? 0) >= 21)
  const velocityHealth =
    avgReviewAge === null                ? 'neutral' :
    avgReviewAge >= 14 || stagnant14.length >= 2 ? 'bad'  :
    avgReviewAge >= 7  || stagnant14.length >= 1 ? 'warn' : 'good'

  // ── Application cadence ───────────────────────────────────────────────────
  const appliedThisWeek  = applied.filter(j => (daysSince(j.date_applied || j.created_at) ?? 99) < 7).length
  const appliedThisMonth = applied.filter(j => (daysSince(j.date_applied || j.created_at) ?? 99) < 30).length
  const lastAppliedDate  = applied.length
    ? applied.reduce((best, j) => {
        const d = new Date(j.date_applied || j.created_at)
        return d > best ? d : best
      }, new Date(0))
    : null
  const daysSinceApply = lastAppliedDate
    ? Math.floor((Date.now() - lastAppliedDate.getTime()) / 86_400_000) : null
  const cadenceHealth =
    daysSinceApply === null ? 'neutral' :
    daysSinceApply >= 14    ? 'bad'     :
    daysSinceApply >= 7     ? 'warn'    : 'good'

  // ── Conversion rate ───────────────────────────────────────────────────────
  const submitted  = jobs.filter(j => j.status !== 'Not Applied')
  const advanced   = jobs.filter(j => ['Interviewing', 'Accepted'].includes(j.status))
  const convRate   = submitted.length >= 3
    ? Math.round((advanced.length / submitted.length) * 100) : null
  const convHealth =
    convRate === null ? 'neutral' :
    convRate >= 15    ? 'good'    :
    convRate >= 5     ? 'warn'    : 'bad'

  // ── Network leverage ──────────────────────────────────────────────────────
  const activeCompanyKeys = new Set(
    active.map(j => (j.company || '').toLowerCase().trim()).filter(Boolean))
  const contactKeys = new Set(
    contacts.map(c => (c.company || '').toLowerCase().trim()).filter(Boolean))
  const coveredCount = [...activeCompanyKeys].filter(k => contactKeys.has(k)).length
  const coveragePct  = activeCompanyKeys.size > 0
    ? Math.round((coveredCount / activeCompanyKeys.size) * 100) : null
  const netHealth =
    coveragePct === null                               ? 'neutral' :
    coveragePct < 25 && activeCompanyKeys.size >= 3   ? 'bad'     :
    coveragePct < 50                                  ? 'warn'    : 'good'

  // ── Outreach follow-through ───────────────────────────────────────────────
  const outreached  = contacts.filter(c => c.outreach_status && c.outreach_status !== 'Not Contacted')
  const followedUp1 = outreached.filter(c => c.follow_up_1)
  const met         = contacts.filter(c => ['Met', 'Meeting Scheduled'].includes(c.outreach_status || ''))
  const followRate  = outreached.length >= 2
    ? Math.round((followedUp1.length / outreached.length) * 100) : null
  const needsFollowUp = outreached
    .filter(c => !c.follow_up_1 && (daysSince(c.updated_at) ?? 0) >= 5)
    .sort((a, b) => (daysSince(b.updated_at) ?? 0) - (daysSince(a.updated_at) ?? 0))
  const outHealth =
    needsFollowUp.length >= 3 || (followRate !== null && followRate < 30) ? 'bad'  :
    needsFollowUp.length >= 1 || (followRate !== null && followRate < 60) ? 'warn' :
    followRate === null ? 'neutral' : 'good'

  // ── Backlog pressure ──────────────────────────────────────────────────────
  const backlogAges   = notApp.map(j => daysSince(j.created_at) ?? 0)
  const avgBacklogAge = backlogAges.length
    ? Math.round(backlogAges.reduce((a, b) => a + b, 0) / backlogAges.length) : 0
  const oldBacklog    = notApp.filter(j => (daysSince(j.created_at) ?? 0) >= 14)
  // Aggressive thresholds — a large backlog is a real problem
  const backlogHealth =
    notApp.length === 0                                                    ? 'neutral' :
    notApp.length >= 10 || oldBacklog.length >= 4 || avgBacklogAge >= 14  ? 'bad'     :
    notApp.length >= 5  || oldBacklog.length >= 1 || avgBacklogAge >= 7   ? 'warn'    : 'good'

  // ── Match opportunities ───────────────────────────────────────────────────
  const highMatches  = discovered
    .filter(d => d.match_score >= 70 && !d.added_to_tracker && d.is_active)
    .sort((a, b) => b.match_score - a.match_score)
  const freshMatches = highMatches.filter(d => (daysSince(d.scraped_at) ?? 99) < 14)
  const agingMatches = highMatches.filter(d => {
    const age = daysSince(d.scraped_at) ?? 0; return age >= 14 && age < 45
  })
  const matchHealth =
    highMatches.length === 0    ? 'neutral' :
    agingMatches.length >= 3    ? 'bad'     :
    freshMatches.length >= 1    ? 'good'    : 'warn'

  // ── Upcoming deadlines ────────────────────────────────────────────────────
  const today0 = new Date(); today0.setHours(0, 0, 0, 0)
  const upcomingDeadlines = jobs
    .filter(j => j.deadline && j.status === 'Not Applied')
    .map(j => {
      const [y, m, d] = j.deadline.split('-').map(Number)
      const dt = new Date(y, m - 1, d); dt.setHours(0, 0, 0, 0)
      return { ...j, daysUntil: Math.round((dt - today0) / 86400000) }
    })
    .filter(j => j.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
  const urgentDeadlines = upcomingDeadlines.filter(j => j.daysUntil <= 3)
  const soonDeadlines   = upcomingDeadlines.filter(j => j.daysUntil <= 7)
  const deadlineHealth  =
    urgentDeadlines.length > 0   ? 'bad'     :
    soonDeadlines.length > 0     ? 'warn'    :
    upcomingDeadlines.length > 0 ? 'good'    : 'neutral'

  return {
    review, avgReviewAge, stagnant14, stagnant21, velocityHealth,
    appliedThisWeek, appliedThisMonth, daysSinceApply, cadenceHealth,
    submitted, advanced, convRate, convHealth,
    activeCompanyKeys, coveredCount, coveragePct, netHealth,
    outreached, followedUp1, met, followRate, needsFollowUp, outHealth,
    notApp, avgBacklogAge, oldBacklog, backlogHealth,
    highMatches, freshMatches, agingMatches, matchHealth,
    upcomingDeadlines, urgentDeadlines, soonDeadlines, deadlineHealth,
    inter, active, applied,
  }
}

// ── InsightPanel ──────────────────────────────────────────────────────────────
function InsightPanel({ category, metric, metricSub, health, body, benchmark, to, cta, children }) {
  const h = HEALTH[health] || HEALTH.neutral
  return (
    <div className="card p-5 flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-navy-400 uppercase tracking-widest">{category}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${h.bg} ${h.text}`}>{h.label}</span>
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${h.dot}`} />
        </div>
      </div>
      <div>
        <p className="text-4xl font-bold text-navy-900 leading-none tracking-tight">{metric ?? '—'}</p>
        {metricSub && <p className="text-xs text-navy-400 mt-1.5 leading-snug">{metricSub}</p>}
      </div>
      <p className="text-sm text-navy-600 leading-relaxed flex-1">{body}</p>
      {children}
      {(benchmark || (to && cta)) && (
        <div className="border-t border-navy-50 pt-3 flex items-end justify-between gap-3">
          {benchmark && <p className="text-[11px] text-navy-400 italic leading-snug flex-1">{benchmark}</p>}
          {to && cta && (
            <Link to={to} className="text-xs text-violet-500 hover:text-violet-700 font-medium flex items-center gap-0.5 shrink-0 transition-colors">
              {cta} <ChevronRight size={10} />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const [jobs,       setJobs]       = useState([])
  const [contacts,   setContacts]   = useState([])
  const [discovered, setDiscovered] = useState([])
  const [stats,      setStats]      = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [adding,        setAdding]        = useState({}) // { [discoveredId]: 'loading' | 'done' }
  const [replyCount,    setReplyCount]    = useState(0)  // Gmail reply alerts
  const [todayRounds,   setTodayRounds]   = useState([]) // Interview rounds happening today

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [jr, cr, dr, sr] = await Promise.allSettled([
        jobsApi.getAll(),
        contactsApi.getAll(),
        discoveredApi.getAll({ per_page: 200 }),
        statsApi.getAll(),
      ])
      if (jr.status === 'fulfilled') setJobs(jr.value.data || [])
      if (cr.status === 'fulfilled') setContacts(cr.value.data || [])
      if (dr.status === 'fulfilled') {
        const d = dr.value.data
        setDiscovered(Array.isArray(d) ? d : (d?.jobs || d?.items || []))
      }
      if (sr.status === 'fulfilled') setStats(sr.value.data)
    } finally { setLoading(false) }
  }, [])

  // Check for email replies via Nylas (quietly — don't block main load)
  useEffect(() => {
    nylasApi.getStatus().then(res => {
      if (res.data?.connected) {
        nylasApi.getThreads(20).then(res2 => {
          const threads = res2.data?.threads || []
          // Count threads with unread messages that aren't just from us
          const withReplies = threads.filter(t => (t.unread_message_count || 0) > 0).length
          setReplyCount(withReplies)
        }).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Load today's interviews — show thank-you reminder at 8pm
  useEffect(() => {
    interviewRoundsApi.getToday()
      .then(res => setTodayRounds(res.data?.rounds || []))
      .catch(() => {})
  }, [])

  const handleThankYou = async (roundId) => {
    try {
      const res = await interviewRoundsApi.setThankYou(roundId)
      setTodayRounds(prev => prev.map(r =>
        r.id === roundId ? { ...r, thank_you_sent: res.data.thank_you_sent } : r
      ))
    } catch (e) { console.error('[handleThankYou]', e) }
  }

  const handleAddToTracker = async (jobId) => {
    setAdding(prev => ({ ...prev, [jobId]: 'loading' }))
    try {
      await discoveredApi.addToTracker(jobId)
      setAdding(prev => ({ ...prev, [jobId]: 'done' }))
      // Refresh discovered list after short delay
      setTimeout(() => fetchAll(), 800)
    } catch {
      setAdding(prev => ({ ...prev, [jobId]: null }))
    }
  }

  const D    = loading ? null : analyse(jobs, contacts, discovered)
  const hasData = jobs.length > 0
  const newToday = stats?.new_jobs_today ?? 0

  // ── Build sorted panel list ───────────────────────────────────────────────
  const buildPanels = (D) => {
    const panels = []

    // 1. Backlog
    panels.push({
      id: 'backlog',
      health: D.backlogHealth,
      jsx: (
        <InsightPanel
          key="backlog"
          category="Backlog Management"
          metric={D.notApp.length}
          metricSub={
            D.notApp.length === 0
              ? 'jobs waiting to be applied to'
              : `in Not Applied${D.oldBacklog.length > 0 ? ` · ${D.oldBacklog.length} added 2+ weeks ago` : D.avgBacklogAge > 0 ? ` · avg ${D.avgBacklogAge}d old` : ''}`
          }
          health={D.backlogHealth}
          body={
            D.notApp.length === 0
              ? "Your backlog is clear. Add jobs from Discovery as you find them and process them regularly to keep your pipeline healthy."
              : D.notApp.length >= 10
              ? `${D.notApp.length} jobs is a large backlog — that's a signal the queue is growing faster than you're processing it. A large Not Applied list often creates decision fatigue. Try committing to 2–3 applications per session and pruning anything that's no longer a real target.`
              : D.oldBacklog.length >= 4
              ? `${D.oldBacklog.length} of your ${D.notApp.length} queued jobs have been sitting for 2+ weeks. At that age, some postings may already be filled. Review the oldest ones first and either apply or remove them.`
              : D.avgBacklogAge >= 7
              ? `Your ${D.notApp.length} queued jobs are averaging ${D.avgBacklogAge} days old. Try processing your backlog at least once a week — set a recurring block to review and submit.`
              : `${D.notApp.length} job${D.notApp.length !== 1 ? 's' : ''} in your queue. Process these within the next week before postings start to close.`
          }
          benchmark="A healthy backlog is 5–10 jobs, processed within 7 days. Postings older than 2–3 weeks are often already filled."
          to="/tracker"
          cta="Open tracker"
        />
      ),
    })

    // 2. Pipeline velocity
    panels.push({
      id: 'velocity',
      health: D.velocityHealth,
      jsx: (
        <InsightPanel
          key="velocity"
          category="Pipeline Velocity"
          metric={D.avgReviewAge !== null ? `${D.avgReviewAge}d` : '—'}
          metricSub={
            D.review.length === 0
              ? 'no applications currently under review'
              : `avg time in Under Review · ${D.stagnant14.length} job${D.stagnant14.length !== 1 ? 's' : ''} stagnant 14+ days`
          }
          health={D.velocityHealth}
          body={
            D.review.length === 0
              ? "No applications are currently under review. As you apply, this will track how quickly companies are moving — a key signal of role fit and hiring urgency."
              : D.avgReviewAge >= 21
              ? `Averaging ${D.avgReviewAge} days in Under Review is past the typical active review window. Most companies that haven't responded in 3 weeks have moved forward with other candidates. Consider moving stale applications to Rejected to keep your pipeline honest.`
              : D.avgReviewAge >= 14
              ? `${D.stagnant14.length > 0 ? `${D.stagnant14.length} application${D.stagnant14.length !== 1 ? 's have' : ' has'} crossed 2 weeks with no update.` : `Applications averaging ${D.avgReviewAge} days — approaching the end of the typical response window.`} Companies that respond slowly tend to have longer overall processes.`
              : D.avgReviewAge >= 7
              ? `Applications are averaging ${D.avgReviewAge} days in Under Review — within the normal range. Watch for anything crossing 14 days without movement.`
              : `Your pipeline is moving well — applications averaging ${D.avgReviewAge} days in Under Review, comfortably within the response window.`
          }
          benchmark="Most companies respond within 1–2 weeks of reviewing an application. After 3 weeks, response likelihood drops significantly."
          to="/tracker"
          cta="View tracker"
        />
      ),
    })

    // 3. Application cadence
    panels.push({
      id: 'cadence',
      health: D.cadenceHealth,
      jsx: (
        <InsightPanel
          key="cadence"
          category="Application Cadence"
          metric={D.appliedThisMonth}
          metricSub={`applications this month · ${D.appliedThisWeek} this week${D.daysSinceApply !== null ? ` · last applied ${D.daysSinceApply}d ago` : ''}`}
          health={D.cadenceHealth}
          body={
            D.applied.length === 0
              ? "No applications submitted yet. Consistent volume is the strongest predictor of job search success — start with 3–5 applications this week and build from there."
              : D.daysSinceApply >= 14
              ? `It's been ${D.daysSinceApply} days since your last application. A gap that long typically signals the search has stalled. Output is directly tied to input — a week without applications usually means a week without pipeline movement 2–3 weeks from now.`
              : D.daysSinceApply >= 7
              ? `You last applied ${D.daysSinceApply} days ago. ${D.appliedThisMonth < 8 ? `${D.appliedThisMonth} applications this month is on the lower side. A consistent weekly cadence — even 2–3 applications — compounds over time.` : `${D.appliedThisMonth} this month is solid. Keep the pace up this week.`}`
              : `Good momentum — ${D.appliedThisWeek} application${D.appliedThisWeek !== 1 ? 's' : ''} this week and ${D.appliedThisMonth} this month. Consistent weekly volume is the foundation of a strong search.`
          }
          benchmark="Candidates applying consistently (3–5/week) typically see results 2–3x faster than those who apply in sporadic bursts."
          to="/tracker"
          cta="View tracker"
        />
      ),
    })

    // 4. Apply-to-interview rate
    panels.push({
      id: 'conversion',
      health: D.convHealth,
      jsx: (
        <InsightPanel
          key="conversion"
          category="Apply-to-Interview Rate"
          metric={D.convRate !== null ? `${D.convRate}%` : '—'}
          metricSub={
            D.submitted.length < 3
              ? 'submit 3+ applications to unlock this metric'
              : `${D.advanced.length} interview${D.advanced.length !== 1 ? 's' : ''} from ${D.submitted.length} submitted`
          }
          health={D.convHealth}
          body={
            D.submitted.length < 3
              ? "You need at least a few submitted applications to calculate a meaningful conversion rate. This will become your clearest signal of resume-to-role fit."
              : D.convRate >= 15
              ? `A ${D.convRate}% conversion rate is strong — your resume is resonating with the roles you're targeting. This is above industry average and suggests good role-to-resume alignment.`
              : D.convRate >= 5
              ? `Your ${D.convRate}% conversion rate is within the typical range. If you're not seeing traction in specific role types, that's a signal to refine targeting or tailor your resume more specifically for those job descriptions.`
              : `At ${D.convRate}%, your apply-to-interview rate is below average. This almost always points to a resume-role alignment issue — either the roles need better targeting, or your resume needs to more closely mirror the language and priorities of those job descriptions.`
          }
          benchmark="Industry average: 5–10% of applications advance to a phone screen. Highly targeted or referred applications can reach 20–30%."
          to="/tracker"
          cta="View tracker"
        />
      ),
    })

    // 5. Outreach follow-through
    panels.push({
      id: 'outreach',
      health: D.outHealth,
      jsx: (
        <InsightPanel
          key="outreach"
          category="Outreach Follow-Through"
          metric={D.followRate !== null ? `${D.followRate}%` : D.outreached.length === 0 ? '0' : '—'}
          metricSub={
            D.outreached.length === 0
              ? 'contacts reached out to'
              : `of ${D.outreached.length} contacted · ${D.met.length} conversation${D.met.length !== 1 ? 's' : ''} reached · ${D.needsFollowUp.length} overdue`
          }
          health={D.outHealth}
          body={
            D.outreached.length === 0
              ? "No outreach logged yet. Networking is one of the highest-leverage activities in a job search — 70–80% of roles are filled through relationships, not job boards alone."
              : D.needsFollowUp.length > 0
              ? `${D.needsFollowUp.length} contact${D.needsFollowUp.length !== 1 ? 's have' : ' has'} been waiting 5+ days for a follow-up. A single cold message has a ~5% response rate — a follow-up nearly doubles it. These are your highest-leverage next steps.`
              : D.followRate !== null && D.followRate < 60
              ? `Only ${D.followRate}% follow-up rate means most of your outreach effort is going unrealized. Most meaningful connections happen on the 2nd or 3rd touchpoint — first messages are just table stakes.`
              : `${D.followRate}% follow-up rate — strong. ${D.met.length > 0 ? `${D.met.length} outreach${D.met.length !== 1 ? 'es have' : ' has'} led to real conversations.` : 'Keep tracking your conversations to measure what converts.'}`
          }
          benchmark="Most successful networking outcomes require 2–3 touchpoints. Follow up within 5–7 days of your initial message."
          to="/tracker"
          cta="View contacts"
        >
          {/* Overdue follow-up list */}
          {D.needsFollowUp.length > 0 && (
            <div className="space-y-1.5 mt-1">
              {D.needsFollowUp.slice(0, 4).map(c => (
                <div key={c.id} className="flex items-center gap-2.5 py-1.5 px-2.5 bg-red-50 rounded-lg border border-red-100">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(c.name)}`}>
                    {nameInitials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-navy-800 truncate">{c.name}</p>
                    <p className="text-[10px] text-navy-400 truncate">{c.company} · {daysSince(c.updated_at)}d ago</p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${OUTREACH_CLASS[c.outreach_status] || 'bg-slate-100 text-slate-600'}`}>
                    {c.outreach_status}
                  </span>
                </div>
              ))}
              {D.needsFollowUp.length > 4 && (
                <p className="text-[10px] text-navy-400 pl-2">+{D.needsFollowUp.length - 4} more</p>
              )}
            </div>
          )}
        </InsightPanel>
      ),
    })

    // 6. Unclaimed matches
    panels.push({
      id: 'matches',
      health: D.matchHealth,
      jsx: (
        <InsightPanel
          key="matches"
          category="Unclaimed Matches"
          metric={D.highMatches.length}
          metricSub={
            D.highMatches.length === 0
              ? '70%+ match jobs waiting in Discovery'
              : `strong matches not in your tracker · ${D.freshMatches.length} found in last 2 weeks${D.agingMatches.length > 0 ? ` · ${D.agingMatches.length} aging` : ''}`
          }
          health={D.matchHealth}
          body={
            D.highMatches.length === 0
              ? "No high-match jobs sitting unclaimed. Run Job Discovery regularly — as your preferences are refined, better matches surface over time."
              : D.agingMatches.length >= 3
              ? `${D.agingMatches.length} of your high matches have been in Discovery for 2+ weeks. Job postings typically close within 3–4 weeks — act on the aging ones first.`
              : `${D.freshMatches.length > 0 ? `${D.freshMatches.length} strong match${D.freshMatches.length !== 1 ? 'es were' : ' was'} discovered in the last 2 weeks` : `${D.highMatches.length} high-match job${D.highMatches.length !== 1 ? 's are' : ' is'} waiting`}. Add the ones you're interested in directly to your tracker.`
          }
          benchmark="Apply within the first 2 weeks of a posting — applications received early are significantly more likely to be reviewed."
          to="/discovery"
          cta="Go to Discovery"
        >
          {/* Inline job list with quick-add */}
          {D.highMatches.length > 0 && (
            <div className="space-y-1.5 mt-1">
              {D.highMatches.slice(0, 5).map(job => {
                const state = adding[job.id]
                const age   = daysSince(job.scraped_at)
                return (
                  <div key={job.id} className={`flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg border transition-colors ${
                    age >= 14 ? 'bg-orange-50 border-orange-100' : 'bg-violet-50 border-violet-100'
                  }`}>
                    <CompanyLogo company={job.company} size={24} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-navy-800 truncate">{job.company}</p>
                      <p className="text-[10px] text-navy-400 truncate">
                        {job.role}{age !== null ? ` · ${age}d old` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white text-violet-700 border border-violet-200 shrink-0">
                      {Math.round(job.match_score)}%
                    </span>
                    <button
                      onClick={() => handleAddToTracker(job.id)}
                      disabled={state === 'loading' || state === 'done'}
                      className={`shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all ${
                        state === 'done'
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : state === 'loading'
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-wait'
                          : 'bg-white text-navy-600 border border-navy-200 hover:border-violet-400 hover:text-violet-700'
                      }`}
                    >
                      {state === 'done'
                        ? <><Check size={9} /> Added</>
                        : state === 'loading'
                        ? 'Adding…'
                        : <><Plus size={9} /> Add</>
                      }
                    </button>
                  </div>
                )
              })}
              {D.highMatches.length > 5 && (
                <Link to="/discovery" className="text-[10px] text-violet-500 hover:text-violet-700 pl-2 flex items-center gap-0.5">
                  +{D.highMatches.length - 5} more in Discovery <ChevronRight size={9} />
                </Link>
              )}
            </div>
          )}
        </InsightPanel>
      ),
    })

    // 7. Upcoming deadlines
    if (D.upcomingDeadlines.length > 0 || D.deadlineHealth !== 'neutral') {
      panels.push({
        id: 'deadlines',
        health: D.deadlineHealth,
        jsx: (
          <InsightPanel
            key="deadlines"
            category="Upcoming Deadlines"
            metric={D.upcomingDeadlines.length}
            metricSub={
              D.upcomingDeadlines.length === 0
                ? 'jobs with deadlines set'
                : `unapplied job${D.upcomingDeadlines.length !== 1 ? 's' : ''} with upcoming deadlines${D.urgentDeadlines.length > 0 ? ` · ${D.urgentDeadlines.length} due within 3 days` : D.soonDeadlines.length > 0 ? ` · ${D.soonDeadlines.length} due this week` : ''}`
            }
            health={D.deadlineHealth}
            body={
              D.urgentDeadlines.length > 0
                ? `${D.urgentDeadlines.length} job${D.urgentDeadlines.length !== 1 ? 's are' : ' is'} due within 3 days and you haven't applied yet. These need to be your immediate priority — submit today or remove them if they're no longer a target.`
                : D.soonDeadlines.length > 0
                ? `${D.soonDeadlines.length} deadline${D.soonDeadlines.length !== 1 ? 's' : ''} are coming up this week. Getting applications in early — ideally 1–2 weeks before a deadline — means your materials get reviewed, not rushed through.`
                : `${D.upcomingDeadlines.length} deadline${D.upcomingDeadlines.length !== 1 ? 's' : ''} on the horizon. Applications submitted well before the deadline have a materially better review rate than last-minute submissions.`
            }
            benchmark="Most strong applications are submitted 7–14 days before the deadline. Last-day submissions are often deprioritized."
            to="/tracker"
            cta="Open tracker"
          >
            <div className="space-y-1.5 mt-1">
              {D.upcomingDeadlines.slice(0, 5).map(job => {
                const urgent = job.daysUntil <= 3
                const soon   = job.daysUntil <= 7
                const dLabel = job.daysUntil === 0 ? 'Today' : job.daysUntil === 1 ? 'Tomorrow' : `${job.daysUntil}d`
                return (
                  <div key={job.id} className={`flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg border ${urgent ? 'bg-red-50 border-red-200' : soon ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                    <AlertCircle size={13} className={urgent ? 'text-red-500 shrink-0' : soon ? 'text-amber-500 shrink-0' : 'text-slate-400 shrink-0'} />
                    <CompanyLogo company={job.company} size={22} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-navy-800 truncate">{job.company}</p>
                      <p className="text-[10px] text-navy-400 truncate">{job.role || 'No role'}</p>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${urgent ? 'text-red-600' : soon ? 'text-amber-600' : 'text-navy-500'}`}>
                      {dLabel}
                    </span>
                  </div>
                )
              })}
              {D.upcomingDeadlines.length > 5 && (
                <p className="text-[10px] text-navy-400 pl-2">+{D.upcomingDeadlines.length - 5} more</p>
              )}
            </div>
          </InsightPanel>
        ),
      })
    }

    // Sort: bad first → warn → good → neutral
    panels.sort((a, b) => (HEALTH_ORDER[a.health] ?? 3) - (HEALTH_ORDER[b.health] ?? 3))
    return panels
  }

  const panels = D ? buildPanels(D) : []

  return (
    <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">{greeting(user?.name)}</h1>
          <p className="text-sm text-navy-400 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <button onClick={fetchAll} disabled={loading} className="btn-secondary self-start sm:self-auto">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Thank-you email reminder — shown at 8pm on interview days */}
      {todayRounds.length > 0 && new Date().getHours() >= 20 && (
        <div className="card p-5 border-l-4 border-amber-400">
          <div className="flex items-start gap-3">
            <Mail size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-navy-800">Don't forget to send thank-you emails!</p>
              <p className="text-xs text-navy-400 mt-0.5 mb-3">You had {todayRounds.length} interview{todayRounds.length !== 1 ? 's' : ''} today. A quick thank-you goes a long way.</p>
              <div className="space-y-2">
                {todayRounds.map(r => (
                  <label key={r.id} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={r.thank_you_sent}
                      onChange={() => handleThankYou(r.id)}
                      className="w-4 h-4 rounded accent-violet-600 cursor-pointer"
                    />
                    <span className={`text-sm ${r.thank_you_sent ? 'line-through text-navy-300' : 'text-navy-700'}`}>
                      <span className="font-medium">{r.company}</span>
                      {r.interviewer_name && <span className="text-navy-400"> · {r.interviewer_name}</span>}
                      <span className="text-navy-400 ml-1">(Round {r.round_number})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New jobs banner */}
      {!loading && newToday > 0 && (
        <Link to="/discovery"
          className="flex items-center justify-between gap-4 rounded-xl px-5 py-4 text-white shadow-matte-md hover:opacity-95 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #8b6bbf 0%, #6a4fa3 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <OrionMark className="w-4 h-4" light />
            </div>
            <div>
              <p className="text-sm font-semibold">{newToday} new job{newToday !== 1 ? 's' : ''} discovered in the last 24 hours</p>
              <p className="text-xs text-white/70 mt-0.5">Click to review in Job Discovery</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-white/70 shrink-0" />
        </Link>
      )}

      {/* Gmail replies alert */}
      {replyCount > 0 && (
        <Link to="/networking"
          className="flex items-center justify-between gap-4 rounded-xl px-5 py-4 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center shrink-0">
              <Mail size={17} className="text-sky-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-sky-800">
                {replyCount} unread email thread{replyCount !== 1 ? 's' : ''} — possible replies to your outreach
              </p>
              <p className="text-xs text-sky-600 mt-0.5">Go to Networking to follow up</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-sky-400 shrink-0" />
        </Link>
      )}

      {/* Section label */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-navy-400 uppercase tracking-widest">
          Job Search Intelligence
        </h2>
        {!loading && D && (
          <div className="flex items-center gap-3 text-[10px] text-navy-400">
            {['bad','warn','good'].map(h => {
              const count = panels.filter(p => p.health === h).length
              if (!count) return null
              return (
                <span key={h} className={`flex items-center gap-1 font-medium ${HEALTH[h].text}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${HEALTH[h].dot}`} />
                  {count} {HEALTH[h].label.toLowerCase()}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Insight panels */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="card h-56 animate-pulse bg-navy-50/60" />)}
        </div>
      ) : !hasData ? (
        <div className="card p-10 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center">
            <Briefcase size={26} className="text-violet-400" />
          </div>
          <div>
            <p className="font-semibold text-navy-800 text-base">Nothing to analyse yet</p>
            <p className="text-sm text-navy-400 mt-1 max-w-xs">
              Add jobs to your tracker and run Job Discovery — insights will populate as your pipeline grows.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <Link to="/tracker" className="btn-primary text-sm py-1.5">Add jobs to tracker</Link>
            <Link to="/discovery" className="btn-secondary text-sm py-1.5">Run Job Discovery</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {panels.map(p => p.jsx)}
        </div>
      )}

    </div>
  )
}
