import { FlaskConical, MapPin, Radio, Wifi } from 'lucide-react'
import { useApi } from '@/api/ApiProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/**
 * Slim top bar. It carries the one thing that must never be ambiguous: whether what the
 * student is looking at came from a live source or from labelled sample data.
 */
export function TopBar({ origin, onChangeOrigin }: { origin: string | null; onChangeOrigin: () => void }) {
  const { mode, switchMode, fallbackReason } = useApi()

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-4">
      <p className="flex shrink-0 items-center gap-2.5">
        {/* The wordmark already reads "Homi", so the image carries the name and the alt
            text does not repeat it into the accessibility tree twice. */}
        <img src="/homi-logo.png" alt="Homi" width={84} height={42} className="h-[26px] w-auto shrink-0" />
        <span className="hidden border-l border-line pl-2.5 text-label text-ink-muted sm:inline">
          Frankfurt student housing, understood
        </span>
      </p>

      {origin ? (
        <button
          type="button"
          onClick={onChangeOrigin}
          className="ml-auto flex min-w-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-label font-semibold text-ink transition-colors hover:border-line-strong hover:bg-canvas sm:ml-2"
        >
          <MapPin aria-hidden className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate max-w-[40vw] sm:max-w-[280px]">{origin}</span>
          <span className="shrink-0 text-ink-muted">change</span>
        </button>
      ) : null}

      <div className={cn('flex shrink-0 items-center gap-2', origin ? 'ml-2' : 'ml-auto')}>
        {mode === 'mock' ? (
          <Badge tone="demo" icon={<FlaskConical />} title={fallbackReason ?? 'Labelled sample data'}>
            Sample data
          </Badge>
        ) : mode === 'live' ? (
          <Badge tone="success" icon={<Wifi />} title="Connected to the Homi server">
            Live
          </Badge>
        ) : (
          <Badge tone="neutral" icon={<Radio />}>
            connecting
          </Badge>
        )}
        <Button
          variant="quiet"
          size="sm"
          className="hidden sm:inline-flex"
          onClick={() => switchMode(mode === 'live' ? 'mock' : 'live')}
          title="Developer control: switch the data transport"
        >
          use {mode === 'live' ? 'sample' : 'live'}
        </Button>
      </div>
    </header>
  )
}

/** Persistent banner explaining exactly what the current data mode means. */
export function DataModeBanner() {
  const { mode, fallbackReason } = useApi()
  if (mode !== 'mock') return null
  return (
    <div role="status" className="flex items-start gap-2 border-b border-demo-line bg-demo-tint px-4 py-2 text-label leading-[18px] text-ink">
      <FlaskConical aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-demo" />
      <p>
        <strong>Sample data.</strong> {fallbackReason ?? 'The labelled mock transport is active.'} Nothing on this screen
        was retrieved from a real housing provider, and no figure here describes a real room.
      </p>
    </div>
  )
}
