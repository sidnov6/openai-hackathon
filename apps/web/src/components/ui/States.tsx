import type { ReactNode } from 'react'
import { CircleAlert, MapPinOff, RefreshCw, SearchX, WifiOff } from 'lucide-react'
import { Button } from './Button'
import { ApiError, OFFLINE_CODE } from '@/api/live'

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div aria-hidden className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-ink-faint">
        {icon ?? <SearchX className="h-5 w-5" />}
      </div>
      <h3 className="text-body font-bold text-ink">{title}</h3>
      {children ? <div className="mt-1.5 max-w-[42ch] text-ui leading-[22px] text-ink-muted">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function NoResultsState({ onWiden, radiusKm }: { onWiden: () => void; radiusKm: number }) {
  return (
    <EmptyState
      icon={<MapPinOff className="h-5 w-5" />}
      title="Nothing found within this radius"
      action={
        <Button variant="secondary" onClick={onWiden}>
          Widen to {Math.min(radiusKm * 2, 25)} km
        </Button>
      }
    >
      No housing record matched inside {radiusKm} km of your origin with these filters. Widening the radius, raising the
      budget, or allowing records with no published price will each search differently.
    </EmptyState>
  )
}

/**
 * Failure states say what failed, whether retrying helps, and never imply the result
 * was empty when it was actually unavailable.
 */
export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const apiError = error instanceof ApiError ? error : null
  const offline = apiError?.code === OFFLINE_CODE
  const message =
    apiError?.message ??
    (error instanceof Error ? error.message : 'Something went wrong, and the cause was not reported.')
  const retryable = apiError ? apiError.retryable : true

  return (
    <div
      role="alert"
      className={compact ? 'rounded-md border border-danger-line bg-danger-tint p-3' : 'px-6 py-10 text-center'}
    >
      <div className={compact ? 'flex gap-2.5' : 'flex flex-col items-center'}>
        <span aria-hidden className={compact ? 'mt-0.5 shrink-0' : 'mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger-tint'}>
          {offline ? <WifiOff className="h-5 w-5 text-danger" /> : <CircleAlert className="h-5 w-5 text-danger" />}
        </span>
        <div className={compact ? 'min-w-0 flex-1 text-left' : ''}>
          <h3 className="text-ui font-bold text-ink">
            {offline ? 'The Homi server is not reachable' : 'That request did not complete'}
          </h3>
          <p className="mt-1 text-ui leading-[21px] text-ink-soft">{message}</p>
          {apiError?.code ? (
            <p className="mt-1 font-mono text-micro text-ink-faint">
              {apiError.code}
              {apiError.httpStatus ? ` · HTTP ${apiError.httpStatus}` : ''}
            </p>
          ) : null}
          {onRetry && retryable ? (
            <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Try again
            </Button>
          ) : null}
          {!retryable ? (
            <p className="mt-2 text-label text-ink-muted">Retrying will not change this. The cause needs fixing first.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
