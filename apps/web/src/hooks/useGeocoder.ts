import { useCallback, useEffect, useState } from 'react'
import { FRANKFURT_BOUNDS, isInFrankfurtArea } from '@/lib/geo'
import { hasMapsKey } from '@/components/map/mapConfig'

export type GeocodeHit = { label: string; lat: number; lng: number; approximate: boolean }

/** Attribution the UI must display next to results from the keyless geocoder. */
export const NOMINATIM_ATTRIBUTION = 'Address search © OpenStreetMap contributors (Nominatim)'

/**
 * Address lookup, biased to Frankfurt am Main.
 *
 * With a Google browser key it uses the Geocoder from the already-loaded Maps JS API.
 * Without one it falls back to Nominatim, the OpenStreetMap geocoder, so address search
 * works with no key at all.
 *
 * Nominatim's usage policy caps low-volume clients at roughly one request per second and
 * requires attribution. The caller therefore debounces at NOMINATIM_MIN_INTERVAL_MS and
 * the UI credits OpenStreetMap beneath the results. A failed lookup returns no hits and
 * the UI says lookup failed — it never guesses a coordinate from the typed text.
 */
export const NOMINATIM_MIN_INTERVAL_MS = 1100

async function searchNominatim(query: string): Promise<GeocodeHit[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '0')
  url.searchParams.set('limit', '5')
  url.searchParams.set('countrycodes', 'de')
  url.searchParams.set('bounded', '1')
  url.searchParams.set('viewbox', `${FRANKFURT_BOUNDS.west},${FRANKFURT_BOUNDS.north},${FRANKFURT_BOUNDS.east},${FRANKFURT_BOUNDS.south}`)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!response.ok) return []
    const json = (await response.json()) as { display_name: string; lat: string; lon: string; type?: string }[]
    return json
      .map((row) => ({
        label: row.display_name,
        lat: Number(row.lat),
        lng: Number(row.lon),
        // Only a house-number match is treated as precise; anything broader is flagged.
        approximate: row.type !== 'house' && row.type !== 'building',
      }))
      .filter((hit) => Number.isFinite(hit.lat) && Number.isFinite(hit.lng) && isInFrankfurtArea(hit))
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

export function useGeocoder() {
  const [googleReady, setGoogleReady] = useState(false)

  useEffect(() => {
    if (!hasMapsKey) return
    if (window.google?.maps?.Geocoder) {
      setGoogleReady(true)
      return
    }
    const started = Date.now()
    const timer = window.setInterval(() => {
      if (window.google?.maps?.Geocoder) {
        setGoogleReady(true)
        window.clearInterval(timer)
      } else if (Date.now() - started > 12_000) {
        window.clearInterval(timer)
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [])

  const search = useCallback(
    async (query: string): Promise<GeocodeHit[]> => {
      if (hasMapsKey && googleReady && window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder()
        const bounds = new window.google.maps.LatLngBounds(
          { lat: FRANKFURT_BOUNDS.south, lng: FRANKFURT_BOUNDS.west },
          { lat: FRANKFURT_BOUNDS.north, lng: FRANKFURT_BOUNDS.east },
        )
        try {
          const { results } = await geocoder.geocode({ address: query, bounds, componentRestrictions: { country: 'DE' }, region: 'de' })
          return results
            .map((result) => ({
              label: result.formatted_address,
              lat: result.geometry.location.lat(),
              lng: result.geometry.location.lng(),
              approximate: result.geometry.location_type !== 'ROOFTOP',
            }))
            .filter((hit) => isInFrankfurtArea(hit))
            .slice(0, 5)
        } catch {
          return []
        }
      }
      return searchNominatim(query)
    },
    [googleReady],
  )

  return {
    // Address search is available either way now - Google with a key, Nominatim without.
    available: true,
    ready: hasMapsKey ? googleReady : true,
    provider: hasMapsKey ? ('google' as const) : ('nominatim' as const),
    search,
  }
}

export type GeolocationOutcome =
  | { status: 'ok'; lat: number; lng: number; accuracyMeters: number }
  | { status: 'denied' }
  | { status: 'unavailable'; reason: string }
  | { status: 'outside_frankfurt'; lat: number; lng: number }

/**
 * Geolocation is requested ONLY when the student presses the button - never on page
 * load (brief section 4). Denial is a normal outcome, not an error state.
 */
export function requestGeolocation(): Promise<GeolocationOutcome> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ status: 'unavailable', reason: 'This browser does not offer location access.' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        if (!isInFrankfurtArea({ lat: latitude, lng: longitude })) {
          resolve({ status: 'outside_frankfurt', lat: latitude, lng: longitude })
          return
        }
        resolve({ status: 'ok', lat: latitude, lng: longitude, accuracyMeters: accuracy })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) resolve({ status: 'denied' })
        else resolve({ status: 'unavailable', reason: error.message || 'Your location could not be determined.' })
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  })
}
