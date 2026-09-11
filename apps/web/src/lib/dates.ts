/**
 * Dates use Europe/Berlin semantics (brief section 9).
 *
 * A missing date NEVER becomes an invented deadline: `addDaysOrNull(null, 14)`
 * returns null, and the UI renders "Date not confirmed yet" instead of a calendar entry.
 */

export const BERLIN_TZ = 'Europe/Berlin'

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: BERLIN_TZ,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: BERLIN_TZ,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const NO_DATE = 'Date not confirmed yet'

/** "14 Sep 2026" in Europe/Berlin, or a caller-supplied unknown label. */
export function formatDate(iso: string | null | undefined, unknownLabel = NO_DATE): string {
  if (!iso) return unknownLabel
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(d.getTime())) return unknownLabel
  return dateFmt.format(d)
}

/** "14 Sep 2026, 16:20" in Europe/Berlin. Used for source retrieval timestamps. */
export function formatDateTime(iso: string | null | undefined, unknownLabel = 'Time unknown'): string {
  if (!iso) return unknownLabel
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return unknownLabel
  return `${dateTimeFmt.format(d)} (Berlin)`
}

/** Relative freshness for source timestamps: "checked 4 min ago". */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'time unknown'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'time unknown'
  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 0) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 31) return `${days} d ago`
  return formatDate(iso)
}

/** A saved discovery older than this is labelled stale in the UI. */
export const STALE_AFTER_MS = 1000 * 60 * 60 * 24

export function isStale(iso: string | null | undefined, afterMs = STALE_AFTER_MS): boolean {
  if (!iso) return true
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return true
  return Date.now() - t > afterMs
}

/** Add calendar days to an ISO date. Returns null for a null input - no invented dates. */
export function addDaysOrNull(isoDate: string | null | undefined, days: number): string | null {
  if (!isoDate) return null
  const d = new Date(`${isoDate}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Whole days from today (Berlin) until an ISO date. Null when the date is unknown. */
export function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null
  const target = new Date(`${isoDate}T12:00:00Z`).getTime()
  if (Number.isNaN(target)) return null
  const today = new Date()
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  return Math.round((target - todayUtc) / 86_400_000)
}

/** "in 6 days" / "3 days overdue" / null when there is no date. */
export function describeDue(isoDate: string | null | undefined): { text: string; overdue: boolean } | null {
  const d = daysUntil(isoDate)
  if (d === null) return null
  if (d < 0) return { text: `${Math.abs(d)} ${Math.abs(d) === 1 ? 'day' : 'days'} overdue`, overdue: true }
  if (d === 0) return { text: 'due today', overdue: false }
  if (d === 1) return { text: 'due tomorrow', overdue: false }
  return { text: `in ${d} days`, overdue: false }
}

export function todayIsoDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: BERLIN_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return parts
}
