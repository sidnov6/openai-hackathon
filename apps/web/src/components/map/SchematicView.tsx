import { useCallback, useMemo, useRef } from 'react'
import { Compass } from 'lucide-react'
import type { MapViewProps } from './GoogleMapView'
import { FRANKFURT_CENTER, haversineMeters } from '@/lib/geo'
import { AVAILABILITY_META } from '@/components/common/Availability'
import { ResultPin } from './Pin'

/**
 * Retained as a last-resort, offline-safe plot.
 *
 * It is NO LONGER the keyless default - MapLibreView now renders a real Frankfurt
 * basemap with no API key. This stays in the tree because it is the only surface that
 * needs no network at all, which makes it a useful fallback if every tile provider is
 * unreachable.
 *
 * This is deliberately NOT a map. It loads no third-party basemap tiles and makes no
 * cartographic claim: it is a schematic distance plot of the records Homi already
 * holds, drawn around the chosen origin, and it says so on its face. Using someone
 * else's tiles to fake a basemap - or drawing Google Places content onto a non-Google
 * map - would breach the providers' terms, so the app shows less rather than more.
 *
 * Everything on it stays keyboard reachable, so the journey works without the key.
 */
export function SchematicView({
  origin,
  radiusKm,
  listings,
  selectedId,
  hoveredId,
  onSelect,
  pinDropMode,
  onPinDrop,
  unavailableReason,
}: MapViewProps & { unavailableReason?: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const center = origin ?? { ...FRANKFURT_CENTER, label: 'Frankfurt am Main' }
  const spanMeters = Math.max(radiusKm * 1000 * 1.25, 1500)

  // Project metres from the origin onto a square viewport, north up.
  const project = useCallback(
    (point: { lat: number; lng: number }) => {
      const dyMeters = haversineMeters({ lat: center.lat, lng: center.lng }, { lat: point.lat, lng: center.lng }) * (point.lat >= center.lat ? 1 : -1)
      const dxMeters = haversineMeters({ lat: center.lat, lng: center.lng }, { lat: center.lat, lng: point.lng }) * (point.lng >= center.lng ? 1 : -1)
      return { x: 50 + (dxMeters / spanMeters) * 50, y: 50 - (dyMeters / spanMeters) * 50 }
    },
    [center.lat, center.lng, spanMeters],
  )

  const unproject = useCallback(
    (xPct: number, yPct: number) => {
      const dxMeters = ((xPct - 50) / 50) * spanMeters
      const dyMeters = ((50 - yPct) / 50) * spanMeters
      const latPerMeter = 1 / 111_320
      const lngPerMeter = 1 / (111_320 * Math.cos((center.lat * Math.PI) / 180))
      return { lat: center.lat + dyMeters * latPerMeter, lng: center.lng + dxMeters * lngPerMeter }
    },
    [center.lat, center.lng, spanMeters],
  )

  const plotted = useMemo(
    () =>
      listings
        .filter((l) => l.coordinates)
        .map((l) => ({ listing: l, pos: project(l.coordinates as { lat: number; lng: number }) }))
        .filter((p) => p.pos.x >= 0 && p.pos.x <= 100 && p.pos.y >= 0 && p.pos.y <= 100),
    [listings, project],
  )

  const rings = [0.33, 0.66, 1].map((factor) => ({ factor, km: (radiusKm * factor).toFixed(1).replace(/\.0$/, '') }))

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!pinDropMode || !boxRef.current) return
    if ((event.target as HTMLElement).closest('button')) return
    const rect = boxRef.current.getBoundingClientRect()
    const xPct = ((event.clientX - rect.left) / rect.width) * 100
    const yPct = ((event.clientY - rect.top) / rect.height) * 100
    onPinDrop(unproject(xPct, yPct))
  }

  return (
    <div className="relative h-full w-full bg-[#F4EDE6]">
      <div
        ref={boxRef}
        onClick={handleClick}
        className={pinDropMode ? 'absolute inset-0 cursor-crosshair' : 'absolute inset-0'}
        style={{
          backgroundImage:
            'linear-gradient(#EADFD7 1px, transparent 1px), linear-gradient(90deg, #EADFD7 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      >
        <svg className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="none" viewBox="0 0 100 100">
          {rings.map((ring) => (
            <circle
              key={ring.factor}
              cx="50"
              cy="50"
              r={(ring.factor * 50 * radiusKm * 1000) / spanMeters}
              fill="none"
              stroke="#B8431F"
              strokeOpacity={0.28}
              strokeWidth="0.2"
              strokeDasharray="1.2 1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {rings.map((ring) => (
          <span
            key={ring.factor}
            aria-hidden
            className="absolute -translate-x-1/2 rounded-xs bg-[#F4EDE6]/90 px-1 text-micro font-semibold tabular-nums text-primary-press"
            style={{ left: '50%', top: `calc(50% - ${(ring.factor * 50 * radiusKm * 1000) / spanMeters}%)` }}
          >
            {ring.km} km
          </span>
        ))}

        {origin ? (
          <span
            aria-hidden
            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-card"
            style={{ left: '50%', top: '50%' }}
          />
        ) : null}

        {plotted.map(({ listing, pos }) => (
          <button
            key={listing.id}
            type="button"
            onClick={() => onSelect(listing.id)}
            aria-pressed={listing.id === selectedId}
            className="absolute -translate-x-1/2 -translate-y-full rounded"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, zIndex: listing.id === selectedId ? 20 : 10 }}
          >
            <ResultPin
              availability={listing.availability}
              selected={listing.id === selectedId}
              hovered={listing.id === hoveredId}
              hasDemoLease={Boolean(listing.demoPolicySlotId)}
              label={`${listing.title}. ${AVAILABILITY_META[listing.availability].label}.`}
            />
          </button>
        ))}
      </div>

      {/* The honest label. It is never styled to look like map attribution. */}
      <div className="pointer-events-none absolute left-3 top-3 max-w-[min(360px,calc(100%-1.5rem))] rounded-md border border-amber-line bg-amber-tint/95 px-3 py-2 shadow-card backdrop-blur-sm">
        <p className="flex items-center gap-1.5 text-label font-bold text-ink">
          <Compass aria-hidden className="h-4 w-4 text-amber" />
          Schematic view — this is not a map
        </p>
        <p className="mt-0.5 text-label leading-[18px] text-ink-soft">
          {unavailableReason ??
            'The interactive basemap is unavailable, so Homi plots distance from your origin instead.'}{' '}
          Everything else works normally — results, filters and the tenancy workspace are unaffected. If your browser has
          hardware acceleration turned off, switching it on restores the map.
        </p>
      </div>
    </div>
  )
}
