import { useEffect, useRef } from 'react'
import type { Listing, SearchResult } from '@/api/contracts.mirror'
import { ResultsRailSkeleton } from '@/components/ui/Skeleton'
import { ErrorState, NoResultsState } from '@/components/ui/States'
import { CountSummary } from './CountSummary'
import { ResultCard } from './ResultCard'

/**
 * The results rail. Keyboard model: a listbox. Up/Down moves between results, Home/End
 * jump, Enter opens the details sheet. Selecting a row emphasises the matching pin, and
 * selecting a pin scrolls the matching row into view - the two stay synchronised.
 */
export function ResultsRail({
  result,
  loading,
  error,
  selectedId,
  onSelect,
  onOpen,
  onHover,
  onRetry,
  onWidenRadius,
  radiusKm,
  stale,
}: {
  result: SearchResult | null
  loading: boolean
  error: unknown
  selectedId: string | null
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  onHover: (id: string | null) => void
  onRetry: () => void
  onWidenRadius: () => void
  radiusKm: number
  stale: boolean
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const listRef = useRef<HTMLDivElement>(null)

  // Keep the selected row visible when the selection came from a map pin.
  useEffect(() => {
    if (!selectedId) return
    const node = refs.current.get(selectedId)
    if (node && document.activeElement !== node) {
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedId])

  const listings: Listing[] = result?.listings ?? []

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (listings.length === 0) return
    const currentIndex = listings.findIndex((l) => l.id === selectedId)
    let nextIndex: number | null = null
    if (event.key === 'ArrowDown') nextIndex = Math.min(currentIndex + 1, listings.length - 1)
    else if (event.key === 'ArrowUp') nextIndex = Math.max(currentIndex - 1, 0)
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = listings.length - 1
    else if (event.key === 'Enter' && selectedId) {
      event.preventDefault()
      onOpen(selectedId)
      return
    }
    if (nextIndex !== null) {
      event.preventDefault()
      const next = listings[nextIndex === -1 ? 0 : nextIndex]
      onSelect(next.id)
      refs.current.get(next.id)?.focus()
    }
  }

  if (error) return <ErrorState error={error} onRetry={onRetry} />
  if (loading && !result) return <ResultsRailSkeleton />

  return (
    <div ref={listRef} className="flex h-full flex-col">
      {result ? <CountSummary result={result} /> : null}

      {stale ? (
        <p className="border-b border-amber-line bg-amber-tint px-4 py-2 text-label font-semibold text-ink" role="status">
          These results were found with your previous filters. Apply the filters to search again.
        </p>
      ) : null}

      {loading ? <ResultsRailSkeleton count={3} /> : null}

      {!loading && listings.length === 0 && result ? (
        <NoResultsState onWiden={onWidenRadius} radiusKm={radiusKm} />
      ) : null}

      {listings.length > 0 ? (
        <div
          role="listbox"
          aria-label="Housing results"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="scroll-thin min-h-0 flex-1 overflow-y-auto"
        >
          {listings.map((listing, index) => (
            <ResultCard
              key={listing.id}
              ref={(node) => {
                if (node) refs.current.set(listing.id, node)
                else refs.current.delete(listing.id)
              }}
              listing={listing}
              index={index}
              total={listings.length}
              selected={listing.id === selectedId}
              onSelect={() => {
                onSelect(listing.id)
                onOpen(listing.id)
              }}
              onHover={(hovered) => onHover(hovered ? listing.id : null)}
            />
          ))}
          <p className="px-4 py-4 text-label leading-[18px] text-ink-muted">
            This list is what the queried sources published. It is not a complete census of housing in Frankfurt.
          </p>
        </div>
      ) : null}
    </div>
  )
}
