import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type Map as MlMap, type Marker as MlMarker } from 'maplibre-gl'
import { createRoot, type Root } from 'react-dom/client'
import { AlertTriangle } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Listing } from '@/api/contracts.mirror'
import type { MapViewProps } from './GoogleMapView'
import { FRANKFURT_CENTER, zoomForRadiusKm } from '@/lib/geo'
import { AVAILABILITY_META } from '@/components/common/Availability'
import { CUSTOM_ATTRIBUTION, MAP_STYLE_URL, RASTER_FALLBACK_STYLE, circlePolygon, isGoogleSourced } from './tileConfig'
import { OriginPin, ResultPin } from './Pin'

const RADIUS_SOURCE = 'mainhaus-radius'

/**
 * The keyless map path: MapLibre GL over OpenStreetMap-derived tiles.
 *
 * This is a real map of Frankfurt with no API key, so the app is useful out of the box.
 * Three things it takes seriously:
 *
 *   - Attribution is always expanded, never collapsed behind an icon, at every viewport.
 *   - Google-sourced records are withheld (see tileConfig.isGoogleSourced) and the count
 *     of withheld records is stated rather than silently dropped.
 *   - Markers are real <button> elements in the DOM, so the map is keyboard reachable
 *     and every pin is announced with its availability meaning, not just its colour.
 */
export function MapLibreView({
  origin,
  radiusKm,
  listings,
  selectedId,
  hoveredId,
  onSelect,
  onUserMoved,
  pinDropMode,
  onPinDrop,
}: MapViewProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MlMap | null>(null)
  const markers = useRef(new Map<string, { marker: MlMarker; root: Root; el: HTMLElement }>())
  const originMarker = useRef<{ marker: MlMarker; root: Root } | null>(null)
  const programmatic = useRef(false)
  const [ready, setReady] = useState(false)
  const [styleFailed, setStyleFailed] = useState(false)

  // Records we are not permitted to draw on a non-Google basemap.
  const { drawable, withheld } = useMemo(() => {
    const drawableList: Listing[] = []
    let withheldCount = 0
    for (const listing of listings) {
      if (!listing.coordinates) continue
      if (isGoogleSourced(listing)) withheldCount += 1
      else drawableList.push(listing)
    }
    return { drawable: drawableList, withheld: withheldCount }
  }, [listings])

  /* ------------------------------------------------------------ create map */
  useEffect(() => {
    if (!container.current || map.current) return

    const instance = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE_URL,
      center: [FRANKFURT_CENTER.lng, FRANKFURT_CENTER.lat],
      zoom: 11.5,
      attributionControl: false,
      // Let the page scroll past the map on touch; pinch still zooms.
      cooperativeGestures: false,
    })
    map.current = instance

    instance.addControl(
      // `compact: false` keeps the credit visible instead of hiding it behind an "i".
      new maplibregl.AttributionControl({ compact: false, customAttribution: CUSTOM_ATTRIBUTION }),
      'bottom-right',
    )
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right')

    instance.on('load', () => {
      instance.addSource(RADIUS_SOURCE, { type: 'geojson', data: circlePolygon(FRANKFURT_CENTER, 1) })
      instance.addLayer({ id: `${RADIUS_SOURCE}-fill`, type: 'fill', source: RADIUS_SOURCE, paint: { 'fill-color': '#B8431F', 'fill-opacity': 0.05 } })
      instance.addLayer({ id: `${RADIUS_SOURCE}-line`, type: 'line', source: RADIUS_SOURCE, paint: { 'line-color': '#B8431F', 'line-opacity': 0.5, 'line-width': 1.5, 'line-dasharray': [2, 1.5] } })
      setReady(true)
    })

    // If the vector style cannot load, fall back to raster tiles rather than a blank map.
    instance.on('error', (event) => {
      const message = String((event as { error?: { message?: string } }).error?.message ?? '')
      if (message.includes('style') || message.includes('Failed to fetch')) {
        setStyleFailed((already) => {
          if (!already) instance.setStyle(RASTER_FALLBACK_STYLE)
          return true
        })
      }
    })

    // 'moveend', not every drag frame - searching on each frame would be expensive.
    instance.on('moveend', () => {
      if (programmatic.current) return
      const center = instance.getCenter()
      onUserMoved({ lat: center.lat, lng: center.lng })
    })

    return () => {
      markers.current.forEach(({ marker, root }) => {
        marker.remove()
        queueMicrotask(() => root.unmount())
      })
      markers.current.clear()
      originMarker.current?.marker.remove()
      originMarker.current = null
      instance.remove()
      map.current = null
    }
    // Deliberately created once; callbacks are read through refs below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ------------------------------------------------------ pin-drop cursor  */
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const canvas = instance.getCanvas()
    canvas.style.cursor = pinDropMode ? 'crosshair' : ''
    if (!pinDropMode) return
    const handler = (event: maplibregl.MapMouseEvent) => onPinDrop({ lat: event.lngLat.lat, lng: event.lngLat.lng })
    instance.on('click', handler)
    return () => {
      instance.off('click', handler)
      canvas.style.cursor = ''
    }
  }, [pinDropMode, onPinDrop])

  /* -------------------------------------------------- origin + radius ring */
  useEffect(() => {
    const instance = map.current
    if (!instance || !ready) return

    const source = instance.getSource(RADIUS_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (origin) {
      source?.setData(circlePolygon({ lat: origin.lat, lng: origin.lng }, radiusKm))
      instance.setLayoutProperty(`${RADIUS_SOURCE}-fill`, 'visibility', 'visible')
      instance.setLayoutProperty(`${RADIUS_SOURCE}-line`, 'visibility', 'visible')

      programmatic.current = true
      instance.flyTo({ center: [origin.lng, origin.lat], zoom: zoomForRadiusKm(radiusKm), duration: 700 })
      const timer = window.setTimeout(() => {
        programmatic.current = false
      }, 900)

      if (!originMarker.current) {
        const el = document.createElement('div')
        const root = createRoot(el)
        const marker = new maplibregl.Marker({ element: el }).setLngLat([origin.lng, origin.lat]).addTo(instance)
        originMarker.current = { marker, root }
      }
      originMarker.current.marker.setLngLat([origin.lng, origin.lat])
      originMarker.current.root.render(<OriginPin label={`Search origin: ${origin.label}`} />)
      return () => window.clearTimeout(timer)
    }

    instance.setLayoutProperty(`${RADIUS_SOURCE}-fill`, 'visibility', 'none')
    instance.setLayoutProperty(`${RADIUS_SOURCE}-line`, 'visibility', 'none')
    originMarker.current?.marker.remove()
    originMarker.current = null
    return undefined
  }, [origin, radiusKm, ready])

  /* -------------------------------------------------------------- markers  */
  useEffect(() => {
    const instance = map.current
    if (!instance || !ready) return

    const seen = new Set<string>()

    for (const listing of drawable) {
      const coords = listing.coordinates as { lat: number; lng: number }
      seen.add(listing.id)
      let entry = markers.current.get(listing.id)

      if (!entry) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'block cursor-pointer rounded bg-transparent p-0'
        el.addEventListener('click', (event) => {
          event.stopPropagation()
          onSelect(listing.id)
        })
        const root = createRoot(el)
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([coords.lng, coords.lat]).addTo(instance)
        entry = { marker, root, el }
        markers.current.set(listing.id, entry)
      }

      entry.marker.setLngLat([coords.lng, coords.lat])
      const meta = AVAILABILITY_META[listing.availability]
      entry.el.setAttribute('aria-label', `${listing.title}. ${meta.label}. ${meta.meaning}`)
      entry.el.setAttribute('aria-pressed', String(listing.id === selectedId))
      entry.el.style.zIndex = listing.id === selectedId ? '20' : '10'
      entry.root.render(
        <ResultPin
          availability={listing.availability}
          selected={listing.id === selectedId}
          hovered={listing.id === hoveredId}
          hasDemoLease={Boolean(listing.demoPolicySlotId)}
          label={`${listing.title}. ${meta.label}.`}
        />,
      )
    }

    for (const [id, entry] of markers.current) {
      if (seen.has(id)) continue
      entry.marker.remove()
      const { root } = entry
      // Unmount outside the render phase - React throws if we do it synchronously here.
      queueMicrotask(() => root.unmount())
      markers.current.delete(id)
    }
  }, [drawable, selectedId, hoveredId, ready, onSelect])

  /* ----------------------------------------- keep the selection in view --- */
  useEffect(() => {
    const instance = map.current
    if (!instance || !ready || !selectedId) return
    const listing = drawable.find((l) => l.id === selectedId)
    if (!listing?.coordinates) return
    const bounds = instance.getBounds()
    const { lat, lng } = listing.coordinates
    if (lng < bounds.getWest() || lng > bounds.getEast() || lat < bounds.getSouth() || lat > bounds.getNorth()) {
      programmatic.current = true
      instance.easeTo({ center: [lng, lat], duration: 500 })
      window.setTimeout(() => {
        programmatic.current = false
      }, 700)
    }
  }, [selectedId, drawable, ready])

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" data-testid="maplibre-container" />

      {withheld > 0 ? (
        <div className="pointer-events-none absolute left-3 top-3 max-w-[min(360px,calc(100%-1.5rem))] rounded-md border border-amber-line bg-amber-tint/95 px-3 py-2 shadow-card">
          <p className="flex items-start gap-1.5 text-label leading-[18px] text-ink">
            <AlertTriangle aria-hidden className="mt-px h-4 w-4 shrink-0 text-amber" />
            <span>
              <strong>
                {withheld} {withheld === 1 ? 'record is' : 'records are'} not shown on this map.
              </strong>{' '}
              They come from Google Places, which may only be displayed on a Google map. They are still listed in the
              results panel with their source.
            </span>
          </p>
        </div>
      ) : null}

      {styleFailed ? (
        <div className="pointer-events-none absolute bottom-9 left-3 rounded-md border border-line bg-surface/95 px-2.5 py-1.5 text-micro text-ink-muted shadow-card">
          Vector basemap unavailable — using OpenStreetMap raster tiles.
        </div>
      ) : null}
    </div>
  )
}
