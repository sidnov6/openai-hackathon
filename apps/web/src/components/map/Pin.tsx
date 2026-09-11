import type { Availability } from '@/api/contracts.mirror'
import { cn } from '@/lib/cn'

/**
 * Result pin.
 *
 * Availability is carried by SHAPE and GLYPH as well as colour: a key glyph for a
 * reported offer, a calendar tick for open applications, a clock for a waiting list,
 * a slash for none reported, a question mark for unknown. Selection is carried by size,
 * ring and elevation, not by hue alone.
 */
const GLYPH: Record<Availability, string> = {
  offer_reported: 'M5.5 8.5a2.5 2.5 0 1 1 4.9.7h3.1v1.6h-1.3v1.5h-1.6v-1.5h-0.2A2.5 2.5 0 0 1 5.5 8.5Zm2.5-.9a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z',
  applications_open: 'M5.6 5.4h8.8v9.2H5.6zM7.2 4v2.6M12.8 4v2.6M5.6 8.2h8.8M8 11l1.5 1.5L12.4 9.6',
  waitlist: 'M10 5.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Zm0 1.9v2.9l2 1.2',
  unavailable: 'M10 5.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Zm-3 4.8h6',
  unknown: 'M10 5.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Zm-.1 7.6h.2v.2h-.2zM8.4 8.5a1.7 1.7 0 1 1 2.2 1.6c-.4.2-.6.5-.6.9v.3',
}

const FILL: Record<Availability, string> = {
  offer_reported: '#067647',
  applications_open: '#B8431F',
  waitlist: '#B45309',
  unavailable: '#A08B84',
  unknown: '#7A625B',
}

export function ResultPin({
  availability,
  selected,
  hovered,
  hasDemoLease,
  label,
}: {
  availability: Availability
  selected?: boolean
  hovered?: boolean
  hasDemoLease?: boolean
  label: string
}) {
  const fill = selected ? '#2B1C18' : FILL[availability]
  const scale = selected ? 1.25 : hovered ? 1.1 : 1
  return (
    <div
      className={cn('relative origin-bottom transition-transform duration-150 ease-out motion-reduce:transition-none')}
      style={{ transform: `scale(${scale})` }}
    >
      <svg width="28" height="36" viewBox="0 0 28 36" role="img" aria-label={label} className="drop-shadow-[0_2px_4px_rgba(20,33,50,0.35)]">
        <path
          d="M14 35.2C14 35.2 26 22.6 26 14A12 12 0 1 0 2 14c0 8.6 12 21.2 12 21.2Z"
          fill={fill}
          stroke={selected ? '#FFFFFF' : 'rgba(255,255,255,0.9)'}
          strokeWidth={selected ? 2.5 : 1.75}
        />
        <g transform="translate(4,4)" stroke="#FFFFFF" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={GLYPH[availability]} />
        </g>
      </svg>
      {hasDemoLease ? (
        <span
          aria-hidden
          title="Paired with a fictional sample lease"
          className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] border-white bg-demo text-[8px] font-bold text-white"
        >
          L
        </span>
      ) : null}
    </div>
  )
}

export function OriginPin({ label }: { label: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" role="img" aria-label={label}>
      <circle cx="13" cy="13" r="11" fill="#B8431F" fillOpacity="0.16" />
      <circle cx="13" cy="13" r="6.5" fill="#B8431F" stroke="#FFFFFF" strokeWidth="2.5" />
    </svg>
  )
}
