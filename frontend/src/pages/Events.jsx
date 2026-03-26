import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MapPin, Clock, Calendar, ExternalLink, Plus, Users, Tag, Zap, X, Search,
} from 'lucide-react'
import { eventsApi } from '../api'

// ── Event type metadata ───────────────────────────────────────────────────────
const EVENT_TYPE_META = {
  'Career Fair':  { bg: 'bg-violet-100',  text: 'text-violet-700',  border: 'border-violet-200',  strip: 'bg-violet-500'  },
  'Networking':   { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', strip: 'bg-emerald-500' },
  'Conference':   { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200',    strip: 'bg-blue-500'    },
  'Info Session': { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   strip: 'bg-amber-500'   },
  'Workshop':     { bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-200',    strip: 'bg-rose-500'    },
}

const DEFAULT_TYPE_META = { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', strip: 'bg-slate-400' }

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

const TYPE_FILTERS = [
  { id: 'all',           label: 'All' },
  { id: 'Career Fair',   label: 'Career Fair' },
  { id: 'Networking',    label: 'Networking' },
  { id: 'Conference',    label: 'Conference' },
  { id: 'Info Session',  label: 'Info Session' },
  { id: 'Workshop',      label: 'Workshop' },
]

const QUICK_LOCATIONS = [
  'New York, NY',
  'San Francisco, CA',
  'Los Angeles, CA',
  'Chicago, IL',
  'Boston, MA',
  'Austin, TX',
  'Seattle, WA',
  'Virtual',
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseDateParts(dateStr) {
  if (!dateStr) return { month: '—', day: '—', time: '—', full: '' }
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return { month: '—', day: '—', time: '—', full: '' }
    const month = MONTH_ABBR[d.getMonth()]
    const day   = String(d.getDate()).padStart(2, '0')
    const hour  = d.getHours()
    const min   = String(d.getMinutes()).padStart(2, '0')
    const ampm  = hour >= 12 ? 'PM' : 'AM'
    const h12   = hour % 12 || 12
    const time  = `${h12}:${min} ${ampm}`
    const full  = d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
    return { month, day, time, full }
  } catch {
    return { month: '—', day: '—', time: '—', full: '' }
  }
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="card animate-pulse flex gap-4 p-5">
      <div className="flex-shrink-0 w-14 rounded-xl overflow-hidden">
        <div className="h-3 bg-navy-200 rounded-t" />
        <div className="bg-navy-100 px-2 py-3 flex flex-col items-center gap-1">
          <div className="h-2 w-8 bg-navy-200 rounded" />
          <div className="h-6 w-10 bg-navy-200 rounded" />
        </div>
      </div>
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 bg-navy-100 rounded-full" />
          <div className="h-4 w-12 bg-navy-100 rounded-full" />
        </div>
        <div className="h-5 w-3/4 bg-navy-100 rounded" />
        <div className="h-3 w-1/2 bg-navy-100 rounded" />
        <div className="flex gap-4">
          <div className="h-3 w-32 bg-navy-100 rounded" />
          <div className="h-3 w-24 bg-navy-100 rounded" />
        </div>
        <div className="h-8 w-24 bg-navy-100 rounded-lg" />
      </div>
    </div>
  )
}

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({ event }) {
  const meta  = EVENT_TYPE_META[event.event_type] || DEFAULT_TYPE_META
  const start = parseDateParts(event.start_date)
  const end   = parseDateParts(event.end_date)

  return (
    <div className="card hover:shadow-md transition-shadow duration-200 flex gap-0 p-0 overflow-hidden">
      {/* Date badge */}
      <div className="flex-shrink-0 w-14 flex flex-col items-center">
        <div className={`w-full h-2.5 ${meta.strip}`} />
        <div className="flex-1 flex flex-col items-center justify-center py-3 px-1 bg-navy-50 border-r border-navy-100">
          <span className="text-[10px] font-bold tracking-wider text-navy-400 uppercase leading-tight">
            {start.month}
          </span>
          <span className="text-2xl font-black text-navy-800 leading-tight">
            {start.day}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col gap-2 min-w-0">
        {/* Top row: type badge + free/paid */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}>
            <Tag size={10} />
            {event.event_type || 'Event'}
          </span>
          <div className="flex items-center gap-1.5">
            {event.is_online && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                <Zap size={10} />
                Online
              </span>
            )}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
              event.is_free
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {event.is_free ? 'Free' : 'Paid'}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-navy-900 text-sm leading-snug line-clamp-2">
          {event.title}
        </h3>

        {/* Organizer */}
        {event.organizer && (
          <p className="text-xs text-navy-400 truncate">by {event.organizer}</p>
        )}

        {/* Venue & time row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-500">
          {(event.venue || event.city) && (
            <span className="flex items-center gap-1">
              <MapPin size={11} className="text-navy-400 flex-shrink-0" />
              <span className="truncate max-w-[180px]">
                {event.venue || event.city}
              </span>
            </span>
          )}
          {start.time && start.time !== '—' && (
            <span className="flex items-center gap-1">
              <Clock size={11} className="text-navy-400 flex-shrink-0" />
              {start.time}
              {end.time && end.time !== '—' && ` – ${end.time}`}
            </span>
          )}
          {event.capacity && (
            <span className="flex items-center gap-1">
              <Users size={11} className="text-navy-400 flex-shrink-0" />
              {event.capacity} spots
            </span>
          )}
        </div>

        {/* RSVP button */}
        {event.url && (
          <div className="mt-1">
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-1.5 text-xs py-1.5 px-3 h-auto"
            >
              RSVP
              <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ searched, onAddManual }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-xl bg-navy-100 flex items-center justify-center mx-auto mb-4">
        <Calendar size={22} className="text-navy-400" />
      </div>
      <h3 className="font-semibold text-navy-700 mb-1">
        {searched ? 'No events found for that location' : 'Search for events near you'}
      </h3>
      <p className="text-sm text-navy-400 mb-4">
        {searched
          ? 'Try a broader location (e.g. "New York") or a different event type.'
          : 'Enter a city above and click Search.'}
      </p>
      <button onClick={onAddManual} className="btn-secondary flex items-center gap-2 text-sm">
        <Plus size={14} />
        Add an Event Manually
      </button>
    </div>
  )
}

// ── Add Event Modal ───────────────────────────────────────────────────────────
const EMPTY_FORM = { title: '', date: '', url: '', location: '', notes: '' }

function AddEventModal({ onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
    if (errors[field]) setErrors(e => ({ ...e, [field]: null }))
  }

  function validate() {
    const e = {}
    if (!form.title.trim()) e.title = 'Title is required'
    if (!form.date) e.date = 'Date is required'
    return e
  }

  function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    onSave({
      id: `manual-${Date.now()}`,
      title: form.title.trim(),
      start_date: form.date,
      end_date: '',
      url: form.url.trim(),
      venue: form.location.trim(),
      city: form.location.trim(),
      organizer: 'Added manually',
      description: form.notes.trim(),
      event_type: 'Networking',
      is_free: true,
      is_online: false,
      source: 'Manual',
    })
  }

  return (
    <>
      <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-navy-100">
            <h2 className="text-base font-bold text-navy-900">Add Event Manually</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-navy-400 hover:text-navy-700 hover:bg-navy-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-navy-600 mb-1">Event Title *</label>
              <input
                className={`w-full px-3 py-2 rounded-lg border text-sm text-navy-900 placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-violet-DEFAULT/30 ${
                  errors.title ? 'border-red-400' : 'border-navy-200'
                }`}
                placeholder="e.g. Tech Networking Night — NYC"
                value={form.title}
                onChange={e => set('title', e.target.value)}
              />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-600 mb-1">Date & Time *</label>
              <input
                type="datetime-local"
                className={`w-full px-3 py-2 rounded-lg border text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-violet-DEFAULT/30 ${
                  errors.date ? 'border-red-400' : 'border-navy-200'
                }`}
                value={form.date}
                onChange={e => set('date', e.target.value)}
              />
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-600 mb-1">Location / Venue</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-navy-200 text-sm text-navy-900 placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-violet-DEFAULT/30"
                placeholder="e.g. 123 Broadway, New York, NY or Virtual"
                value={form.location}
                onChange={e => set('location', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-600 mb-1">Event URL</label>
              <input
                type="url"
                className="w-full px-3 py-2 rounded-lg border border-navy-200 text-sm text-navy-900 placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-violet-DEFAULT/30"
                placeholder="https://eventbrite.com/..."
                value={form.url}
                onChange={e => set('url', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-600 mb-1">Notes</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-navy-200 text-sm text-navy-900 placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-violet-DEFAULT/30 resize-none"
                placeholder="Who's attending, dress code, what to bring…"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-navy-100">
            <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleSave} className="btn-primary text-sm">Save Event</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Events() {
  const [locationInput, setLocationInput] = useState('')
  const [searchedLocation, setSearchedLocation] = useState('')  // what was actually searched
  const [eventType, setEventType]         = useState('all')
  const [events, setEvents]               = useState([])
  const [loading, setLoading]             = useState(false)
  const [showModal, setShowModal]         = useState(false)
  const [manualEvents, setManualEvents]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('recruitiq_manual_events') || '[]') } catch { return [] }
  })
  const inputRef = useRef(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async (loc, type) => {
    setLoading(true)
    try {
      const params = {
        location: loc || 'all',
        event_type: type === 'all' ? 'all' : type,
      }
      const res  = await eventsApi.getAll(params)
      const list = res.data?.events || []
      setEvents(list)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Check if Eventbrite key is configured on mount
  useEffect(() => {
    fetchEvents('', 'all')
  }, [fetchEvents])

  function handleSearch(e) {
    e?.preventDefault()
    const loc = locationInput.trim()
    setSearchedLocation(loc)
    fetchEvents(loc, eventType)
  }

  function handleQuickLocation(loc) {
    setLocationInput(loc)
    setSearchedLocation(loc)
    fetchEvents(loc, eventType)
  }

  function handleTypeChange(type) {
    setEventType(type)
    fetchEvents(searchedLocation, type)
  }

  // ── Manual events helpers ──────────────────────────────────────────────────
  function saveManual(event) {
    const updated = [event, ...manualEvents]
    setManualEvents(updated)
    localStorage.setItem('recruitiq_manual_events', JSON.stringify(updated))
    setShowModal(false)
  }

  function removeManual(id) {
    const updated = manualEvents.filter(e => e.id !== id)
    setManualEvents(updated)
    localStorage.setItem('recruitiq_manual_events', JSON.stringify(updated))
  }

  // Filter manual events to match current location/type
  const filteredManual = manualEvents.filter(e => {
    const locMatch =
      !searchedLocation ||
      (e.city || '').toLowerCase().includes(searchedLocation.toLowerCase()) ||
      (e.venue || '').toLowerCase().includes(searchedLocation.toLowerCase())
    const typeMatch = eventType === 'all' || (e.event_type || '') === eventType
    return locMatch && typeMatch
  })

  const allEvents = [...filteredManual, ...events]
  const hasSearched = !!searchedLocation

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-navy-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <MapPin size={16} className="text-violet-DEFAULT" />
              </div>
              <h1 className="text-2xl font-bold text-navy-900">Recruitment Events</h1>
            </div>
            <p className="text-sm text-navy-500">
              Find career fairs, networking nights, and recruiting events near you
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Plus size={15} />
            Add Event Manually
          </button>
        </div>

        {/* ── Location search ─────────────────────────────────────────────── */}
        <div className="card p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={locationInput}
                onChange={e => setLocationInput(e.target.value)}
                placeholder="Enter your city or 'Virtual'…"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-navy-200 text-sm text-navy-900 placeholder-navy-400 focus:outline-none focus:ring-2 focus:ring-violet-DEFAULT/30 focus:border-violet-DEFAULT"
              />
            </div>
            <button
              type="submit"
              className="btn-primary flex items-center gap-2 px-5 text-sm"
            >
              <Search size={15} />
              Search
            </button>
          </form>

          {/* Quick location chips */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-navy-400 self-center mr-1">Quick:</span>
            {QUICK_LOCATIONS.map(loc => (
              <button
                key={loc}
                onClick={() => handleQuickLocation(loc)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors duration-150 ${
                  searchedLocation === loc
                    ? 'bg-violet-DEFAULT text-white border-violet-DEFAULT'
                    : 'bg-white text-navy-600 border-navy-200 hover:border-violet-DEFAULT hover:text-violet-DEFAULT'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>

        {/* ── Event type filter chips ─────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {TYPE_FILTERS.map(f => {
            const meta = EVENT_TYPE_META[f.id] || null
            const active = eventType === f.id
            return (
              <button
                key={f.id}
                onClick={() => handleTypeChange(f.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors duration-150 ${
                  active
                    ? meta
                      ? `${meta.bg} ${meta.text} ${meta.border}`
                      : 'bg-navy-800 text-white border-navy-800'
                    : 'bg-white text-navy-500 border-navy-200 hover:border-navy-400 hover:text-navy-700'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {/* ── Events grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : allEvents.length === 0 ? (
            <EmptyState searched={hasSearched} onAddManual={() => setShowModal(true)} />
          ) : (
            allEvents.map(event => (
              <div key={event.id || event.title} className="relative group">
                <EventCard event={event} />
                {event.source === 'Manual' && (
                  <button
                    onClick={() => removeManual(event.id)}
                    title="Remove manual event"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-white shadow border border-navy-100 text-navy-400 hover:text-red-500"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Results count */}
        {!loading && allEvents.length > 0 && (
          <p className="text-xs text-navy-400 text-center">
            {allEvents.length} event{allEvents.length !== 1 ? 's' : ''} found
            {searchedLocation && ` near ${searchedLocation}`}
            {filteredManual.length > 0 && ` · ${filteredManual.length} added manually`}
          </p>
        )}
      </div>

      {/* ── Add event modal ──────────────────────────────────────────────── */}
      {showModal && (
        <AddEventModal onClose={() => setShowModal(false)} onSave={saveManual} />
      )}
    </div>
  )
}
