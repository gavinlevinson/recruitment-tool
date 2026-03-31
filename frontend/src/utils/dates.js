/**
 * Date utility helpers — ensures backend timestamps are always interpreted correctly.
 *
 * Problem 1 — Full datetimes: SQLite/PostgreSQL return UTC timestamps without a 'Z'
 *   suffix (e.g. "2024-03-15 14:30:00"). Browsers treat bare strings without timezone
 *   info as LOCAL time, so the timestamp is off by the user's UTC offset.
 *   Fix: append 'Z' if no timezone indicator is present.
 *
 * Problem 2 — Date-only strings: new Date("2024-03-15") is treated as UTC midnight by
 *   browsers. In US timezones (UTC-4 to UTC-8) this renders as March 14 — off by one day.
 *   Fix: parse YYYY-MM-DD by splitting into components and constructing a LOCAL midnight date.
 */

/**
 * Parse a backend datetime string as UTC, return a JS Date in the user's local timezone.
 * Handles: "2024-03-15 14:30:00", "2024-03-15T14:30:00", "2024-03-15T14:30:00Z", ISO with offset.
 */
export function parseUTCDateTime(str) {
  if (!str) return null
  try {
    // Already has timezone info — trust it as-is
    if (str.endsWith('Z') || str.includes('+') || /\d{2}:\d{2}$/.test(str)) {
      return new Date(str)
    }
    // Replace space separator with T and append Z to force UTC interpretation
    return new Date(str.replace(' ', 'T') + 'Z')
  } catch {
    return null
  }
}

/**
 * Parse a date-only string (YYYY-MM-DD) as local midnight — avoids the UTC-midnight
 * off-by-one-day bug that new Date("2024-03-15") causes in US timezones.
 */
export function parseLocalDate(str) {
  if (!str) return null
  try {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d)
  } catch {
    return null
  }
}

/**
 * Format a backend datetime string for display (e.g. "Mar 15, 2:30 PM").
 * Automatically uses the user's local timezone.
 */
export function formatDateTime(str, opts = {}) {
  const d = parseUTCDateTime(str)
  if (!d || isNaN(d)) return '—'
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    ...opts,
  })
}

/**
 * Format a date-only backend string for display (e.g. "Mar 15, 2024").
 */
export function formatDate(str, opts = {}) {
  const d = parseLocalDate(str)
  if (!d || isNaN(d)) return '—'
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    ...opts,
  })
}

/**
 * How many days ago was this backend datetime string?
 * Works correctly for both full datetimes and date-only strings.
 */
export function daysSince(str) {
  if (!str) return null
  // Try full datetime first, fall back to date-only
  const d = str.includes('T') || str.includes(' ')
    ? parseUTCDateTime(str)
    : parseLocalDate(str)
  if (!d || isNaN(d)) return null
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}

/**
 * Human-readable relative time ("2 hours ago", "3 days ago").
 * Handles both full datetimes and ISO strings from RSS feeds.
 */
export function timeAgo(str) {
  if (!str) return ''
  try {
    const d = parseUTCDateTime(str)
    if (!d || isNaN(d)) return ''
    const ms = Date.now() - d.getTime()
    const mins  = Math.floor(ms / 60_000)
    const hours = Math.floor(ms / 3_600_000)
    const days  = Math.floor(ms / 86_400_000)
    if (mins  <  1) return 'just now'
    if (mins  < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days  <  7) return `${days}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}
