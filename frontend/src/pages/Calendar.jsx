import { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, CalendarDays, Briefcase,
  Clock, Bell, X, ExternalLink, Download, Zap, RefreshCw, Users,
} from 'lucide-react'
import { calendarApi, jobsApi } from '../api'
import { useNavigate } from 'react-router-dom'

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const EVENT_CONFIG = {
  interview: {
    label:  'Interview',
    bg:     'bg-violet-100',
    text:   'text-violet-700',
    border: 'border-violet-200',
    dot:    'bg-violet-500',
    pill:   'bg-violet-600 text-white',
    Icon:   Briefcase,
  },
  deadline: {
    label:  'Deadline',
    bg:     'bg-red-100',
    text:   'text-red-700',
    border: 'border-red-200',
    dot:    'bg-red-500',
    pill:   'bg-red-600 text-white',
    Icon:   Clock,
  },
  reminder: {
    label:  'Reminder',
    bg:     'bg-sky-100',
    text:   'text-sky-700',
    border: 'border-sky-200',
    dot:    'bg-sky-500',
    pill:   'bg-sky-600 text-white',
    Icon:   Bell,
  },
  networking: {
    label:  'Event',
    bg:     'bg-emerald-100',
    text:   'text-emerald-700',
    border: 'border-emerald-200',
    dot:    'bg-emerald-500',
    pill:   'bg-emerald-600 text-white',
    Icon:   Users,
  },
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function todayStr() { return toDateStr(new Date()) }

function parseLocalDate(str) {
  // Parse YYYY-MM-DD as local date (not UTC) to avoid off-by-one
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getMonthGrid(year, month) {
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth    = new Date(year, month + 1, 0).getDate()
  const prevDays       = new Date(year, month, 0).getDate()
  const cells = []

  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, prevDays - i), current: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), current: true })
  }
  while (cells.length < 42) {
    cells.push({ date: new Date(year, month + 1, cells.length - firstDayOfWeek - daysInMonth + 1), current: false })
  }
  return cells
}

function getWeekDays(anchor) {
  const start = new Date(anchor)
  start.setDate(anchor.getDate() - anchor.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function formatDisplayDate(str) {
  if (!str) return ''
  const d = parseLocalDate(str)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function daysUntil(str) {
  if (!str) return null
  const today  = new Date(); today.setHours(0, 0, 0, 0)
  const target = parseLocalDate(str); target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

// ── ICS export ────────────────────────────────────────────────────────────────

function exportIcs(event) {
  const ds  = event.date.replace(/-/g, '')
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Orion//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@orion`,
    `DTSTART;VALUE=DATE:${ds}`,
    `DTEND;VALUE=DATE:${ds}`,
    `SUMMARY:${EVENT_CONFIG[event.type]?.label} — ${event.title}`,
    `DESCRIPTION:${event.role || ''}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `${event.title.replace(/[^a-z0-9]/gi, '_')}_${event.type}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Event Popover ─────────────────────────────────────────────────────────────

function EventPopover({ event, onClose }) {
  const navigate = useNavigate()
  if (!event) return null
  const cfg     = EVENT_CONFIG[event.type] || EVENT_CONFIG.reminder
  const delta   = daysUntil(event.date)
  const deltaLabel =
    delta === 0  ? 'Today'         :
    delta === 1  ? 'Tomorrow'      :
    delta === -1 ? 'Yesterday'     :
    delta < 0   ? `${Math.abs(delta)} days ago` :
                   `In ${delta} days`
  const deltaColor =
    delta < 0   ? 'text-red-600'    :
    delta <= 3  ? 'text-amber-600'  :
    delta <= 7  ? 'text-sky-600'    :
                  'text-navy-500'

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className={`relative bg-white rounded-2xl shadow-2xl border ${cfg.border} w-full max-w-sm pointer-events-auto`}>
          {/* Header */}
          <div className={`flex items-center justify-between px-5 py-4 rounded-t-2xl ${cfg.bg}`}>
            <div className="flex items-center gap-2.5">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.pill}`}>
                <cfg.Icon size={11} />
                {cfg.label}
              </span>
            </div>
            <button onClick={onClose} className={`p-1 rounded-lg ${cfg.text} hover:bg-white/40 transition-colors`}>
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-3">
            <div>
              <p className="text-lg font-bold text-navy-900 leading-tight">{event.title}</p>
              {event.round_info && <p className="text-xs font-semibold text-violet-600 mt-0.5">{event.round_info}</p>}
              {event.role && <p className="text-sm text-navy-500 mt-0.5">{event.role}</p>}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-navy-600">{formatDisplayDate(event.date)}</p>
              <span className={`text-xs font-semibold ${deltaColor}`}>{deltaLabel}</span>
            </div>

            {event.status && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-navy-400">Status:</span>
                <span className="text-xs font-medium text-navy-700">{event.status}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 pb-5 flex gap-2">
            {event.type === 'networking' ? (
              event.url ? (
                <button
                  onClick={() => { window.open(event.url, '_blank', 'noopener,noreferrer'); onClose() }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  <ExternalLink size={13} /> Open Event
                </button>
              ) : null
            ) : (
              <button
                onClick={() => { navigate('/tracker'); onClose() }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
              >
                <ExternalLink size={13} /> View in Tracker
              </button>
            )}
            <button
              onClick={() => exportIcs(event)}
              title="Export to Google Calendar / Apple Calendar"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-navy-200 text-navy-600 text-sm font-medium hover:bg-navy-50 transition-colors"
            >
              <Download size={13} /> .ics
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Event Chip (calendar cell) ────────────────────────────────────────────────

function EventChip({ event, onClick }) {
  const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.reminder
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(event) }}
      className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate border ${cfg.bg} ${cfg.text} ${cfg.border} hover:opacity-80 transition-opacity`}
    >
      {event.title}{event.round_info ? ` · ${event.round_info}` : ''}
    </button>
  )
}

// ── Upcoming Sidebar ──────────────────────────────────────────────────────────

function UpcomingSidebar({ events, onEventClick }) {
  const today = todayStr()
  const upcoming = events
    .filter(e => e.date >= today)
    .slice(0, 10)

  const past = events
    .filter(e => e.date < today)
    .slice(-3)
    .reverse()

  return (
    <aside className="w-64 shrink-0 bg-white border border-navy-100 rounded-2xl p-4 flex flex-col gap-4 h-full overflow-y-auto">
      <h3 className="text-xs font-semibold text-navy-400 uppercase tracking-wide">Upcoming</h3>

      {upcoming.length === 0 && (
        <p className="text-xs text-navy-300 italic">No upcoming events. Add interview dates or deadlines to your jobs in the Tracker.</p>
      )}

      <div className="space-y-1.5">
        {upcoming.map(e => {
          const cfg   = EVENT_CONFIG[e.type] || EVENT_CONFIG.reminder
          const delta = daysUntil(e.date)
          const when  = delta === 0 ? 'Today' : delta === 1 ? 'Tomorrow' : `in ${delta}d`
          return (
            <button
              key={e.id}
              onClick={() => onEventClick(e)}
              className="w-full text-left flex items-start gap-2.5 p-2 rounded-lg hover:bg-navy-50 transition-colors group"
            >
              <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-navy-800 truncate group-hover:text-violet-700">{e.title}</p>
                <p className="text-[10px] text-navy-400 truncate">{cfg.label} · {e.round_info || e.role || '—'}</p>
              </div>
              <span className={`text-[10px] font-medium shrink-0 ${delta <= 3 ? 'text-amber-600' : 'text-navy-400'}`}>{when}</span>
            </button>
          )
        })}
      </div>

      {past.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-navy-300 uppercase tracking-wide mt-2">Recent Past</h3>
          <div className="space-y-1.5">
            {past.map(e => {
              const cfg = EVENT_CONFIG[e.type] || EVENT_CONFIG.reminder
              return (
                <button
                  key={e.id}
                  onClick={() => onEventClick(e)}
                  className="w-full text-left flex items-start gap-2.5 p-2 rounded-lg hover:bg-navy-50 transition-colors group opacity-50"
                >
                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-navy-600 truncate">{e.title}</p>
                    <p className="text-[10px] text-navy-400 truncate">{cfg.label}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Legend */}
      <div className="mt-auto pt-4 border-t border-navy-100 space-y-1.5">
        <p className="text-[10px] font-semibold text-navy-400 uppercase tracking-wide mb-2">Legend</p>
        {Object.entries(EVENT_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            <span className="text-xs text-navy-500">{cfg.label}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({ year, month, events, onEventClick, onDayClick }) {
  const cells  = getMonthGrid(year, month)
  const today  = todayStr()

  const eventsByDate = {}
  events.forEach(e => {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = []
    eventsByDate[e.date].push(e)
  })

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-navy-100">
        {DAYS_SHORT.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-navy-400 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* 6-week grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 min-h-0">
        {cells.map(({ date, current }, i) => {
          const ds     = toDateStr(date)
          const isToday = ds === today
          const dayEvs = eventsByDate[ds] || []
          const shown  = dayEvs.slice(0, 3)
          const extra  = dayEvs.length - shown.length

          return (
            <div
              key={i}
              className={[
                'border-r border-b border-navy-100 p-1.5 flex flex-col gap-0.5 overflow-hidden',
                current ? 'bg-white' : 'bg-slate-50',
                i % 7 === 0 ? '' : '',
              ].join(' ')}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className={[
                    'w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold',
                    isToday
                      ? 'bg-violet-600 text-white'
                      : current
                        ? 'text-navy-700'
                        : 'text-navy-300',
                  ].join(' ')}
                >
                  {date.getDate()}
                </span>
              </div>

              {/* Events */}
              {shown.map(e => (
                <EventChip key={e.id} event={e} onClick={onEventClick} />
              ))}
              {extra > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); onEventClick(dayEvs[3]) }}
                  className="text-[9px] font-medium text-navy-400 hover:text-violet-600 pl-1"
                >
                  +{extra} more
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({ anchor, events, onEventClick }) {
  const days  = getWeekDays(anchor)
  const today = todayStr()

  const eventsByDate = {}
  events.forEach(e => {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = []
    eventsByDate[e.date].push(e)
  })

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header row */}
      <div className="grid grid-cols-7 border-b border-navy-100">
        {days.map(d => {
          const ds      = toDateStr(d)
          const isToday = ds === today
          return (
            <div key={ds} className="py-3 text-center border-r border-navy-100 last:border-r-0">
              <p className="text-xs font-semibold text-navy-400 uppercase tracking-wide">
                {DAYS_SHORT[d.getDay()]}
              </p>
              <span
                className={[
                  'mt-1 mx-auto w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold',
                  isToday ? 'bg-violet-600 text-white' : 'text-navy-700',
                ].join(' ')}
              >
                {d.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      {/* Day columns */}
      <div className="flex-1 grid grid-cols-7 min-h-0 overflow-y-auto">
        {days.map(d => {
          const ds   = toDateStr(d)
          const evs  = eventsByDate[ds] || []
          return (
            <div key={ds} className="border-r border-navy-100 last:border-r-0 p-2 flex flex-col gap-1.5">
              {evs.map(e => {
                const cfg = EVENT_CONFIG[e.type] || EVENT_CONFIG.reminder
                return (
                  <button
                    key={e.id}
                    onClick={() => onEventClick(e)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border} hover:opacity-80 transition-opacity`}
                  >
                    <p className="text-xs font-semibold truncate">{e.title}</p>
                    <p className="text-[10px] opacity-75 truncate mt-0.5">{cfg.label} · {e.role || '—'}</p>
                  </button>
                )
              })}
              {evs.length === 0 && (
                <div className="flex-1 flex items-start justify-center pt-4">
                  <span className="text-[10px] text-navy-200">—</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Calendar Page ────────────────────────────────────────────────────────

export default function Calendar() {
  const today = new Date()
  const [anchor, setAnchor] = useState(today)   // drives both month and week navigation
  const [view, setView]     = useState('month')  // 'month' | 'week'
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  const year  = anchor.getFullYear()
  const month = anchor.getMonth()

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await calendarApi.getEvents()
      setEvents(res.data || [])
    } catch (err) {
      console.error('Failed to load calendar events', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // Navigation
  const prev = () => {
    if (view === 'month') {
      setAnchor(new Date(year, month - 1, 1))
    } else {
      const d = new Date(anchor)
      d.setDate(d.getDate() - 7)
      setAnchor(d)
    }
  }
  const next = () => {
    if (view === 'month') {
      setAnchor(new Date(year, month + 1, 1))
    } else {
      const d = new Date(anchor)
      d.setDate(d.getDate() + 7)
      setAnchor(d)
    }
  }
  const goToday = () => setAnchor(new Date())

  // Header label
  const headerLabel = view === 'month'
    ? `${MONTH_NAMES[month]} ${year}`
    : (() => {
        const days = getWeekDays(anchor)
        const first = days[0], last = days[6]
        const sameMonth = first.getMonth() === last.getMonth()
        return sameMonth
          ? `${MONTH_NAMES[first.getMonth()]} ${first.getDate()}–${last.getDate()}, ${year}`
          : `${MONTH_NAMES[first.getMonth()]} ${first.getDate()} – ${MONTH_NAMES[last.getMonth()]} ${last.getDate()}, ${year}`
      })()

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-navy-100 shrink-0">
        <div className="flex items-center gap-3">
          <CalendarDays size={20} className="text-violet-600" />
          <h1 className="text-lg font-bold text-navy-900">Calendar</h1>
          {loading && <RefreshCw size={14} className="text-navy-300 animate-spin" />}
        </div>

        <div className="flex items-center gap-2">
          {/* Navigation */}
          <button onClick={prev} className="p-1.5 rounded-lg text-navy-500 hover:bg-navy-100 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[200px] text-center text-sm font-semibold text-navy-800">{headerLabel}</span>
          <button onClick={next} className="p-1.5 rounded-lg text-navy-500 hover:bg-navy-100 transition-colors">
            <ChevronRight size={18} />
          </button>

          {/* Today */}
          <button
            onClick={goToday}
            className="ml-2 px-3 py-1.5 rounded-lg border border-navy-200 text-xs font-medium text-navy-600 hover:bg-navy-50 transition-colors"
          >
            Today
          </button>

          {/* View toggle */}
          <div className="ml-2 flex bg-navy-100 rounded-lg p-0.5">
            {['month', 'week'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={[
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize',
                  view === v ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-500 hover:text-navy-700',
                ].join(' ')}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="w-32" /> {/* spacer to center title */}
      </div>

      {/* Body */}
      <div className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <UpcomingSidebar events={events} onEventClick={setSelected} />

        {/* Calendar grid */}
        <div className="flex-1 bg-white border border-navy-100 rounded-2xl overflow-hidden flex flex-col min-h-0">
          {loading && events.length === 0 ? (
            <div className="flex-1 flex items-center justify-center gap-3 text-navy-400">
              <Zap size={18} className="text-violet-400 animate-pulse" />
              <span className="text-sm">Loading calendar…</span>
            </div>
          ) : events.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-navy-400 p-8">
              <CalendarDays size={36} className="text-navy-200" />
              <p className="text-sm font-medium text-navy-500">No events yet</p>
              <p className="text-xs text-navy-400 text-center max-w-xs">
                Open a job in the Tracker and set an interview date, application deadline, or reminder — it will appear here automatically.
              </p>
            </div>
          ) : view === 'month' ? (
            <MonthView
              year={year}
              month={month}
              events={events}
              onEventClick={setSelected}
              onDayClick={() => {}}
            />
          ) : (
            <WeekView
              anchor={anchor}
              events={events}
              onEventClick={setSelected}
            />
          )}
        </div>
      </div>

      {/* Event Popover */}
      {selected && <EventPopover event={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
