import { useEffect, useMemo, useRef } from 'react'
import { APIProvider, AdvancedMarker, Map, useMap } from '@vis.gl/react-google-maps'
import type { Listing, SearchOrigin } from '@/api/contracts.mirror'
import { FRANKFURT_CENTER, zoomForRadiusKm } from '@/lib/geo'
import { MAPS_BROWSER_KEY, MAPS_MAP_ID, MAP_OPTIONS } from './mapConfig'
import { OriginPin, ResultPin } from './Pin'
import { AVAILABILITY_META } from '@/components/common/Availability'

export type MapViewProps = {
  origin: SearchOrigin | null
  radiusKm: number
  listings: Listing[]
  selectedId: string | null
  hoveredId: string | null
  onSelect: (id: string) => void
  /** Fired when the user pans/zooms, so "Search this area" can appear. */
  onUserMoved: (center: { lat: number; lng: number }) => void
  /** Click-to-drop-a-pin, only while the origin is being confirmed. */
  pinDropMode: boolean
  onPinDrop: (point: { lat: number; lng: number }) => void
}

/** Draws the search radius and keeps the viewport in step with origin/radius changes. */
function MapController({
  origin,
  radiusKm,
  onUserMoved,
  selectedId,
  listings,
}: Pick<MapViewProps, 'origin' | 'radiusKm' | 'onUserMoved' | 'selectedId' | 'listings'>) {
  const map = useMap()
  const circleRef = useRef<google.maps.Circle | null>(null)
  const programmatic = useRef(false)

  useEffect(() => {
    if (!map || !origin) return
    programmatic.current = true
    map.panTo({ lat: origin.lat, lng: origin.lng })
    map.setZoom(zoomForRadiusKm(radiusKm))
    const timer = window.setTimeout(() => {
      programmatic.current = false
    }, 600)
    return () => window.clearTimeout(timer)
  }, [map, origin, radiusKm])

  useEffect(() => {
    if (!map) return
    if (!origin) {
      circleRef.current?.setMap(null)
      circleRef.current = null
      return
    }
    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        strokeColor: '#B8431F',
        strokeOpacity: 0.5,
        strokeWeight: 1.5,
        fillColor: '#B8431F',
        fillOpacity: 0.05,
        clickable: false,
      })
    }
    circleRef.current.setOptions({
      map,
      center: { lat: origin.lat, lng: origin.lng },
      radius: radiusKm * 1000,
    })
    return () => {
      circleRef.current?.setMap(null)
    }
  }, [map, origin, radiusKm])

  // Keep the selected pin in view when the selection came from the results rail.
  useEffect(() => {
    if (!map || !selectedId) return
    const listing = listings.find((l) => l.id === selectedId)
    if (!listing?.coordinates) return
    const bounds = map.getBounds()
    if (bounds && !bounds.contains(listing.coordinates)) {
      programmatic.current = true
      map.panTo(listing.coordinates)
      window.setTimeout(() => {
        programmatic.current = false
      }, 600)
    }
  }, [map, selectedId, listings])

  useEffect(() => {
    if (!map) return
    // `idle` rather than every drag frame: searching on each drag would be expensive.
    const listener = map.addListener('idle', () => {
      if (programmatic.current) return
      const center = map.getCenter()
      if (center) onUserMoved({ lat: center.lat(), lng: center.lng() })
    })
    return () => listener.remove()
  }, [map, onUserMoved])

  return null
}

function PinDropLayer({ enabled, onPinDrop }: { enabled: boolean; onPinDrop: MapViewProps['onPinDrop'] }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !enabled) return
    const listener = map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (event.latLng) onPinDrop({ lat: event.latLng.lat(), lng: event.latLng.lng() })
    })
    map.setOptions({ draggableCursor: 'crosshair' })
    return () => {
      listener.remove()
      map.setOptions({ draggableCursor: undefined })
    }
  }, [map, enabled, onPinDrop])
  return null
}

export function GoogleMapView(props: MapViewProps) {
  const { origin, listings, selectedId, hoveredId, onSelect, pinDropMode, onPinDrop } = props
  const defaultCenter = useMemo(() => (origin ? { lat: origin.lat, lng: origin.lng } : FRANKFURT_CENTER), [origin])

  return (
    <APIProvider apiKey={MAPS_BROWSER_KEY as string} libraries={['marker']}>
      <Map
        mapId={MAPS_MAP_ID}
        defaultCenter={defaultCenter}
        defaultZoom={origin ? zoomForRadiusKm(props.radiusKm) : 12}
        className="h-full w-full"
        {...MAP_OPTIONS}
      >
        <MapController {...props} />
        <PinDropLayer enabled={pinDropMode} onPinDrop={onPinDrop} />

        {origin ? (
          <AdvancedMarker position={{ lat: origin.lat, lng: origin.lng }} zIndex={5} title={`Search origin: ${origin.label}`}>
            <OriginPin label={`Search origin: ${origin.label}`} />
          </AdvancedMarker>
        ) : null}

        {listings.map((listing) =>
          listing.coordinates ? (
            <AdvancedMarker
              key={listing.id}
              position={listing.coordinates}
              zIndex={listing.id === selectedId ? 20 : 10}
              onClick={() => onSelect(listing.id)}
              title={`${listing.title} — ${AVAILABILITY_META[listing.availability].label}`}
            >
              <ResultPin
                availability={listing.availability}
                selected={listing.id === selectedId}
                hovered={listing.id === hoveredId}
                hasDemoLease={Boolean(listing.demoPolicySlotId)}
                label={`${listing.title}. ${AVAILABILITY_META[listing.availability].label}.`}
              />
            </AdvancedMarker>
          ) : null,
        )}
      </Map>
    </APIProvider>
  )
}
