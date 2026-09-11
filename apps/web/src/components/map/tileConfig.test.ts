import { describe, expect, it } from 'vitest'
import { circlePolygon, isGoogleSourced } from './tileConfig'
import { haversineMeters } from '@/lib/geo'

/**
 * The MapLibre basemap may only carry independently sourced data. These verify the
 * guard that keeps Google Places content off it.
 */
describe('Google-sourced records are withheld from the non-Google basemap', () => {
  it('detects a Google provider name', () => {
    expect(isGoogleSourced({ provider: 'google_places' })).toBe(true)
    expect(isGoogleSourced({ provider: 'Google Places (New)' })).toBe(true)
  })

  it('detects a Google source URL even when the provider name is neutral', () => {
    expect(
      isGoogleSourced({ provider: 'studierendenwerk', sourceRefs: [{ url: 'https://maps.google.com/place/abc' }] }),
    ).toBe(true)
    expect(
      isGoogleSourced({ provider: 'studierendenwerk', sourceRefs: [{ url: 'https://places.googleapis.com/v1/places/x' }] }),
    ).toBe(true)
  })

  it('allows an independently sourced record through', () => {
    expect(
      isGoogleSourced({ provider: 'Studierendenwerk Frankfurt', sourceRefs: [{ url: 'https://www.swffm.de/wohnen' }] }),
    ).toBe(false)
    expect(isGoogleSourced({ provider: 'SAMPLE DATA', sourceRefs: [{ url: 'https://example.org/x' }] })).toBe(false)
  })

  it('does not crash on a malformed URL and does not withhold on one', () => {
    expect(isGoogleSourced({ provider: 'x', sourceRefs: [{ url: 'not a url' }] })).toBe(false)
    expect(isGoogleSourced({})).toBe(false)
  })
})

describe('search radius ring', () => {
  it('draws a closed ring whose points sit at the requested radius', () => {
    const center = { lat: 50.1109, lng: 8.6821 }
    const ring = circlePolygon(center, 3)
    const coords = ring.features[0].geometry.coordinates[0]
    expect(coords[0]).toEqual(coords[coords.length - 1]) // closed
    for (const [lng, lat] of coords) {
      const distanceKm = haversineMeters(center, { lat, lng }) / 1000
      expect(distanceKm).toBeGreaterThan(2.9)
      expect(distanceKm).toBeLessThan(3.1)
    }
  })
})
