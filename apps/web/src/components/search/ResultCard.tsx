import { forwardRef } from 'react'
import { FileText, MapPin, Ruler } from 'lucide-react'
import type { Listing } from '@/api/contracts.mirror'
import { Badge } from '@/components/ui/Badge'
import { AvailabilityBadge } from '@/components/common/Availability'
import { Money } from '@/components/common/Money'
import { headlineCostCents } from '@/api/mock'
import { formatDistance } from '@/lib/geo'
import { formatRelative } from '@/lib/dates'
import { cn } from '@/lib/cn'

const BASIS_LABEL = { kalt: 'cold rent (Kaltmiete)', warm: 'warm rent (Warmmiete)', unknown: 'basis not stated' } as const

/**
 * A result row.
 *
 * It is a real <button> inside a listbox option, so the rail is fully keyboard
 * navigable. The price always names its basis - a 315 EUR cold rent and a 315 EUR warm
 * rent are very different offers, and a card that hides which one it is misleads.
 */
export const ResultCard = forwardRef<
  HTMLButtonElement,
  {
    listing: Listing
    selected: boolean
    onSelect: () => void
    onHover: (hovered: boolean) => void
    index: number
    total: number
  }
>(function ResultCard({ listing, selected, onSelect, onHover, index, total }, ref) {
  const cost = headlineCostCents(listing)
  const distance = formatDistance(listing.distanceMeters)
  const basis = listing.monthlyCost?.basis ?? 'unknown'

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={selected}
      aria-setsize={total}
      aria-posinset={index + 1}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={cn(
        'relative block w-full border-b border-line-soft px-4 py-3.5 text-left transition-colors',
        selected ? 'bg-primary-tint' : 'bg-surface hover:bg-canvas',
      )}
    >
      {selected ? <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-primary" /> : null}

      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-ui font-bold leading-[20px] text-ink">{listing.title}</h3>
        <div className="shrink-0 text-right">
          <Money cents={cost} className="text-ui font-bold text-ink" whole />
          <span className="block text-micro text-ink-muted">{cost === null ? 'no price published' : `/month · ${BASIS_LABEL[basis]}`}</span>
        </div>
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-label text-ink-muted">
        {distance ? (
          <span className="inline-flex items-center gap-1">
            <Ruler aria-hidden className="h-3.5 w-3.5" />
            {distance} away
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <MapPin aria-hidden className="h-3.5 w-3.5" />
          {listing.scope === 'residence' ? 'Whole residence' : 'Single room offer'}
        </span>
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <AvailabilityBadge value={listing.availability} />
        {listing.locationPrecision !== 'exact' ? (
          <Badge tone="neutral" title="The coordinate is derived, not published by the provider.">
            location approximate
          </Badge>
        ) : null}
        {listing.demoPolicySlotId ? (
          // Deliberately NOT "Sample lease available": a reserved slot whose document has
          // not been imported yet has no lease to read. The Listing contract carries only
          // the slot id, not its status (see CR-11), so the card states what it can
          // actually vouch for and the details panel resolves ready vs awaiting.
          <Badge tone="demo" icon={<FileText />} title="A demonstration slot is reserved for this location. Open it to see whether its fictional lease has been imported yet.">
            Demo lease slot
          </Badge>
        ) : null}
      </div>

      <p className="mt-2 text-micro text-ink-faint">
        {listing.provider} · checked {formatRelative(listing.checkedAt)}
      </p>
    </button>
  )
})
