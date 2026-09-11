import type { StyleSpecification } from 'maplibre-gl'

/**
 * Basemap configuration for the keyless MapLibre path.
 *
 * The brief permits a MapLibre alternative to Google Maps "only with independently
 * sourced data and an appropriate attributed tile provider". Both conditions are met
 * deliberately:
 *
 *   1. INDEPENDENT DATA. Only records Homi holds itself are drawn here. Anything
 *      whose provenance is Google Places is withheld from this map by
 *      `isGoogleSourced()` below — rendering Google Places content on a non-Google
 *      basemap would breach Google's terms, so the app shows a notice instead.
 *
 *   2. ATTRIBUTED TILES. Attribution is rendered by MapLibre's AttributionControl in
 *      non-collapsed form, so the required credit is visible at every viewport rather
 *      than hidden behind an "i" button.
 *
 * Default provider is OpenFreeMap, which serves OpenStreetMap-derived vector tiles with
 * no API key. Override with VITE_MAP_STYLE_URL to point at your own style or a provider
 * you hold a licence for. If the vector style cannot load, the raster OSM fallback below
 * is used; that one is rate-limited by the OSM Foundation and is a safety net for a local
 * demo, not a production basemap.
 */

export const MAP_STYLE_URL: string =
  import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty'

export const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'

export const CUSTOM_ATTRIBUTION = [OSM_ATTRIBUTION, '<a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>']

/** Raster fallback used only when the vector style fails to load. */
export const RASTER_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: OSM_ATTRIBUTION,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

/**
 * True when a record's provenance is Google Places / Google Maps.
 *
 * Such a record is NOT drawn on the MapLibre basemap. This is a deliberate refusal:
 * Google's terms tie Places content to a Google map, and quietly moving it onto OSM tiles
 * to make the demo look fuller would be a licence breach.
 */
export function isGoogleSourced(listing: { provider?: string; sourceRefs?: { url?: string }[] }): boolean {
  const provider = (listing.provider ?? '').toLowerCase()
  if (provider.includes('google') || provider.includes('places')) return true
  return (listing.sourceRefs ?? []).some((ref) => {
    if (!ref.url) return false
    try {
      const host = new URL(ref.url).hostname
      return host.endsWith('google.com') || host.endsWith('googleapis.com') || host.endsWith('goo.gle')
    } catch {
      return false
    }
  })
}

/** Approximates a circle as a GeoJSON polygon, for the search-radius ring. */
export function circlePolygon(center: { lat: number; lng: number }, radiusKm: number, steps = 96) {
  const coords: [number, number][] = []
  const latRad = (center.lat * Math.PI) / 180
  const kmPerDegLat = 110.574
  const kmPerDegLng = 111.32 * Math.cos(latRad)
  for (let i = 0; i <= steps; i += 1) {
    const theta = (i / steps) * 2 * Math.PI
    coords.push([center.lng + (radiusKm / kmPerDegLng) * Math.cos(theta), center.lat + (radiusKm / kmPerDegLat) * Math.sin(theta)])
  }
  return {
    type: 'FeatureCollection' as const,
    features: [{ type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [coords] } }],
  }
}

/**
 * MapLibre renders through WebGL. Where WebGL is unavailable — hardware acceleration
 * switched off, an old device, a locked-down VM, some headless browsers — constructing
 * the map throws, and an exception thrown during render takes the WHOLE React tree with
 * it. The app must degrade to a working page, never to a blank one, so this is checked
 * before the map is built and the schematic plot is used instead.
 */
export function supportsWebGL(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const context =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')
    if (!context) return false
    // Release it immediately; we only wanted to know whether it could be created.
    const lose = (context as WebGLRenderingContext).getExtension?.('WEBGL_lose_context')
    lose?.loseContext()
    return true
  } catch {
    return false
  }
}
