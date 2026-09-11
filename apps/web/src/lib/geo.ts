/**
 * Deterministic straight-line distance (brief section 5).
 *
 * This is DISTANCE, not travel time. Walking / transit minutes are only ever shown
 * when a routing source actually supplies them - this module cannot produce them.
 */

const EARTH_RADIUS_M = 6_371_008.8

export type LatLng = { lat: number; lng: number }

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h))))
}

/** "1.2 km" / "450 m". Always prefixed with "distance" by the caller, never "walk". */
export function formatDistance(meters: number | null | undefined): string | null {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return null
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

/** Frankfurt am Main city centre - the opening map view. */
export const FRANKFURT_CENTER: LatLng = { lat: 50.1109, lng: 8.6821 }

/** Rough bounds of Frankfurt am Main, used to keep the opening view on the city. */
export const FRANKFURT_BOUNDS = { north: 50.2270, south: 50.0150, east: 8.8000, west: 8.4720 }

export function isInFrankfurtArea(p: LatLng): boolean {
  return (
    p.lat <= FRANKFURT_BOUNDS.north &&
    p.lat >= FRANKFURT_BOUNDS.south &&
    p.lng <= FRANKFURT_BOUNDS.east &&
    p.lng >= FRANKFURT_BOUNDS.west
  )
}

/** Metres -> approximate map zoom that fits a radius circle. */
export function zoomForRadiusKm(radiusKm: number): number {
  if (radiusKm <= 1) return 15
  if (radiusKm <= 2) return 14
  if (radiusKm <= 4) return 13
  if (radiusKm <= 8) return 12
  if (radiusKm <= 16) return 11
  return 10
}
