import type { SearchCounts, SearchResult } from '@/api/contracts.mirror'
import { Callout } from '@/components/ui/Callout'
import { formatRelative, isStale } from '@/lib/dates'

/**
 * Counts are literal (brief section 5).
 *
 * "14 residences found; 2 source-reported offers; availability unknown for 6."
 * A residence marker is not an available room, so residences and offers are counted
 * separately and never added together into a single reassuring number.
 */
export function countSentence(counts: SearchCounts): string {
  const parts: string[] = []
  if (counts.residences > 0) parts.push(`${counts.residences} ${counts.residences === 1 ? 'residence' : 'residences'}`)
  if (counts.rooms > 0) parts.push(`${counts.rooms} individual room ${counts.rooms === 1 ? 'offer' : 'offers'}`)
  const found = parts.length > 0 ? parts.join(' and ') : 'nothing'
  const detail: string[] = []
  detail.push(`${counts.offerReported} source-reported ${counts.offerReported === 1 ? 'offer' : 'offers'}`)
  if (counts.applicationsOpen > 0) detail.push(`${counts.applicationsOpen} accepting applications`)
  if (counts.waitlist > 0) detail.push(`${counts.waitlist} waiting-list only`)
  if (counts.availabilityUnknown > 0) detail.push(`availability unknown for ${counts.availabilityUnknown}`)
  if (counts.unavailable > 0) detail.push(`${counts.unavailable} reporting no rooms`)
  return `${found} found; ${detail.join('; ')}.`
}

export function CountSummary({ result }: { result: SearchResult }) {
  const stale = result.freshness === 'saved' && isStale(result.retrievedAt)
  const failedProviders = result.providers.filter((p) => p.status === 'unavailable' || p.status === 'partial')
  const skipped = result.providers.filter((p) => p.status === 'skipped')

  return (
    <div className="border-b border-line bg-surface px-4 py-3">
      <p className="text-ui font-semibold leading-[22px] text-ink" role="status">
        {countSentence(result.counts)}
      </p>

      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-label text-ink-muted">
        <span>
          {result.freshness === 'live' ? 'Live search' : 'Saved discovery'} · {formatRelative(result.retrievedAt)}
        </span>
        {stale ? <span className="font-semibold text-amber">· more than a day old</span> : null}
      </p>

      {result.counts.priceUnknown > 0 ? (
        <p className="mt-1 text-label text-ink-muted">
          {result.counts.priceUnknown} of these publish no price, so they were not compared against a budget.
        </p>
      ) : null}

      {result.incomplete ? (
        <Callout tone="attention" className="mt-2.5" title="This is not a complete picture of Frankfurt">
          {result.incompleteReason ??
            'Some sources could not be reached, so records that exist elsewhere may be missing from this list.'}
          {failedProviders.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5">
              {failedProviders.map((p) => (
                <li key={p.name}>
                  <span className="font-semibold">{p.name}</span>
                  {p.note ? ` — ${p.note}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          {skipped.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5">
              {skipped.map((p) => (
                <li key={p.name}>
                  <span className="font-semibold">{p.name}</span> — not queried{p.note ? `: ${p.note}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </Callout>
      ) : null}
    </div>
  )
}
