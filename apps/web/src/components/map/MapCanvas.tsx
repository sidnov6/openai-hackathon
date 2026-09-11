import { Suspense, lazy, useMemo } from 'react'
import { hasMapsKey } from './mapConfig'
import { supportsWebGL } from './tileConfig'
import { MapErrorBoundary } from './MapErrorBoundary'
import { SchematicView } from './SchematicView'
import type { MapViewProps } from './GoogleMapView'

/**
 * One entry point for the map surface, chosen in this order:
 *
 *   1. Google Maps  — when VITE_GOOGLE_MAPS_BROWSER_KEY is set. The brief's primary path,
 *                     and the only one allowed to render Google Places content.
 *   2. MapLibre     — the default. A real map of Frankfurt over OpenStreetMap-derived
 *                     tiles with no API key. Google-sourced records are withheld from it.
 *   3. Schematic    — when WebGL is unavailable, or if the map throws anyway. Loads no
 *                     tiles at all and plots only our own records, clearly labelled as
 *                     not being a map.
 *
 * Both map engines are large and only one is used per session, so each is loaded lazily.
 * Nothing else in the app needs to know which is showing.
 */
const GoogleMapView = lazy(() => import('./GoogleMapView').then((m) => ({ default: m.GoogleMapView })))
const MapLibreView = lazy(() => import('./MapLibreView').then((m) => ({ default: m.MapLibreView })))

/** Matches the map's final geometry; carries no fabricated content. */
function MapLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#F4EDE6]" role="status" aria-live="polite">
      <span className="text-ui text-ink-muted">Loading the map of Frankfurt…</span>
    </div>
  )
}

export function MapCanvas(props: MapViewProps) {
  // Checked once per mount: creating a throwaway WebGL context on every render is wasteful.
  const webgl = useMemo(() => supportsWebGL(), [])
  const kind = hasMapsKey ? 'google' : webgl ? 'maplibre' : 'schematic'

  return (
    <div className="absolute inset-0" data-testid="map-canvas" data-map-kind={kind}>
      <MapErrorBoundary fallback={(reason) => <SchematicView {...props} unavailableReason={reason} />}>
        {kind === 'schematic' ? (
          <SchematicView
            {...props}
            unavailableReason="This browser could not create a WebGL context, which the interactive map needs."
          />
        ) : (
          <Suspense fallback={<MapLoading />}>
            {kind === 'google' ? <GoogleMapView {...props} /> : <MapLibreView {...props} />}
          </Suspense>
        )}
      </MapErrorBoundary>
    </div>
  )
}

export type { MapViewProps }
