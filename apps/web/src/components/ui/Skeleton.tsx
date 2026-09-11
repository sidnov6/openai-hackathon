import { cn } from '@/lib/cn'

/**
 * Skeletons match the final geometry of what they replace, and NEVER contain a
 * placeholder number - a fabricated figure during loading is worse than no figure.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />
}

export function ResultCardSkeleton() {
  return (
    <div className="border-b border-line-soft px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-14" />
      </div>
      <Skeleton className="mt-2 h-3 w-28" />
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-4 w-20 rounded-xs" />
        <Skeleton className="h-4 w-16 rounded-xs" />
      </div>
    </div>
  )
}

export function ResultsRailSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Searching for housing near your chosen location.</span>
      {Array.from({ length: count }, (_, i) => (
        <ResultCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function FindingSkeleton() {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="mt-3 h-3 w-full" />
      <Skeleton className="mt-1.5 h-3 w-5/6" />
      <Skeleton className="mt-4 h-14 w-full rounded" />
    </div>
  )
}
