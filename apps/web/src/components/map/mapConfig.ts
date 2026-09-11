/**
 * Google Maps configuration.
 *
 * The browser key is intentionally public but MUST be restricted by HTTP referrer and
 * limited to the Maps JavaScript API (brief section 3). Server keys never reach this
 * bundle - anything server-side (Places, geocoding) belongs to apps/api.
 *
 * When no key is configured the app does NOT silently degrade to a third-party tile
 * provider: it renders a clearly-labelled schematic view of our own data instead. That
 * avoids both misrepresenting the source of the basemap and any tile-policy breach.
 */
export const MAPS_BROWSER_KEY: string | undefined = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY || undefined

/**
 * Advanced Markers require a Map ID. Google publishes DEMO_MAP_ID for development;
 * a real deployment should set VITE_GOOGLE_MAPS_MAP_ID to a cloud-styled map.
 */
export const MAPS_MAP_ID: string = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'

export const hasMapsKey = Boolean(MAPS_BROWSER_KEY)

/** Quiet basemap styling so the results rail and pins stay the focus. */
export const MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: true,
  fullscreenControl: false,
  streetViewControl: false,
  mapTypeControl: false,
  clickableIcons: false,
  gestureHandling: 'greedy' as const,
  // Keep required Google attribution and the Terms link visible at every viewport by
  // reserving space at the bottom of the map container (see MapFrame).
}
