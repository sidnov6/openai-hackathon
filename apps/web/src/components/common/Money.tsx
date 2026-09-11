import { Info } from 'lucide-react'
import type { Cents } from '@/lib/money'
import { formatCents, isKnown } from '@/lib/money'
import { cn } from '@/lib/cn'

/**
 * The only component allowed to render a money value.
 *
 * Unknown renders as "Not stated" in muted type - never as 0, never as a dash that
 * could be mistaken for zero. Figures use tabular numerals so columns align.
 */
export function Money({
  cents,
  className,
  whole,
  unknownLabel,
}: {
  cents: Cents
  className?: string
  whole?: boolean
  unknownLabel?: string
}) {
  if (!isKnown(cents)) {
    return (
      <span className={cn('text-ink-muted', className)}>
        {unknownLabel ?? 'Not stated'}
      </span>
    )
  }
  return <span className={cn('tnum', className)}>{formatCents(cents, { whole })}</span>
}

/**
 * A total whose completeness is part of its meaning. When components were excluded
 * because their value is unknown, the label says "Known ..." and names what is missing.
 */
export function IncompleteTotal({
  label,
  cents,
  excluded,
  className,
}: {
  label: string
  cents: Cents
  excluded: { label: string; reason?: string }[]
  className?: string
}) {
  const incomplete = excluded.length > 0
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-ui font-semibold text-ink-soft">
          {incomplete ? `Known ${label.toLowerCase()}` : label}
        </span>
        <Money cents={cents} className="text-title font-bold text-ink" />
      </div>
      {incomplete ? (
        <p className="mt-1.5 flex gap-1.5 text-label leading-[18px] text-ink-muted">
          <Info aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            Not included, because the document does not state an amount:{' '}
            {excluded.map((e, i) => (
              <span key={e.label}>
                {i > 0 ? ', ' : ''}
                <span className="font-medium text-ink-soft">{e.label}</span>
                {e.reason ? ` (${e.reason})` : ''}
              </span>
            ))}
            . The real total will be higher.
          </span>
        </p>
      ) : null}
    </div>
  )
}
