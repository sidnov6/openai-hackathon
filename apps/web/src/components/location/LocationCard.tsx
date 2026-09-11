import { useEffect, useRef, useState } from 'react'
import { Crosshair, GraduationCap, Loader2, MapPin, Search } from 'lucide-react'
import type { SearchOrigin } from '@/api/contracts.mirror'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Field, TextInput } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { FRANKFURT_CAMPUSES } from '@/state/journey'
import { NOMINATIM_ATTRIBUTION, NOMINATIM_MIN_INTERVAL_MS, requestGeolocation, useGeocoder, type GeocodeHit } from '@/hooks/useGeocoder'
import { cn } from '@/lib/cn'

type Method = 'campus' | 'address' | 'pin'

/**
 * The first meaningful interaction: confirm where to search from.
 *
 * Three equal routes - campus, address, or a pin on the map - plus an explicit
 * "Use my location" button. Geolocation is never requested on page load, and declining
 * it never blocks the flow: the other three routes remain fully usable.
 */
export function LocationCard({
  onConfirm,
  onTogglePinDrop,
  droppedPin,
  geolocationDenied,
  onGeolocationDenied,
}: {
  onConfirm: (origin: SearchOrigin) => void
  onTogglePinDrop: (on: boolean) => void
  droppedPin: { lat: number; lng: number } | null
  geolocationDenied: boolean
  onGeolocationDenied: () => void
}) {
  const [method, setMethod] = useState<Method>('campus')
  const [campusId, setCampusId] = useState(FRANKFURT_CAMPUSES[0].id)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<GeocodeHit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationNote, setLocationNote] = useState<string | null>(null)
  const geocoder = useGeocoder()
  const debounce = useRef<number | null>(null)

  useEffect(() => {
    onTogglePinDrop(method === 'pin')
  }, [method, onTogglePinDrop])

  useEffect(() => {
    if (method !== 'address' || query.trim().length < 3 || !geocoder.ready) {
      setHits(null)
      return
    }
    if (debounce.current) window.clearTimeout(debounce.current)
    // Nominatim's usage policy caps low-volume clients near one request per second, so
    // the keyless path waits longer between keystrokes than the Google path needs to.
    const wait = geocoder.provider === 'nominatim' ? NOMINATIM_MIN_INTERVAL_MS : 450
    debounce.current = window.setTimeout(async () => {
      setSearching(true)
      const results = await geocoder.search(query.trim())
      setHits(results)
      setSearching(false)
    }, wait)
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current)
    }
  }, [query, method, geocoder])

  const handleUseMyLocation = async () => {
    setLocating(true)
    setLocationNote(null)
    const outcome = await requestGeolocation()
    setLocating(false)
    if (outcome.status === 'ok') {
      onConfirm({
        lat: outcome.lat,
        lng: outcome.lng,
        label: `Your location (accurate to about ${Math.round(outcome.accuracyMeters)} m)`,
        source: 'geolocation',
      })
      return
    }
    if (outcome.status === 'denied') {
      onGeolocationDenied()
      setLocationNote(null)
      return
    }
    if (outcome.status === 'outside_frankfurt') {
      setLocationNote(
        'You appear to be outside Frankfurt am Main. Homi searches Frankfurt specifically, so pick a campus or an address in the city instead.',
      )
      return
    }
    setLocationNote(outcome.reason)
  }

  const confirmCampus = () => {
    const campus = FRANKFURT_CAMPUSES.find((c) => c.id === campusId)
    if (!campus) return
    onConfirm({ lat: campus.lat, lng: campus.lng, label: campus.name, source: 'campus' })
  }

  return (
    <section
      aria-labelledby="location-card-title"
      className="w-full max-w-[440px] rounded-lg border border-line bg-surface/97 p-4 shadow-sheet backdrop-blur-sm sm:p-5"
    >
      <h1 id="location-card-title" className="text-display font-bold tracking-tight text-ink">
        Where should we look from?
      </h1>
      <p className="mt-1 text-ui leading-[22px] text-ink-muted">
        Homi searches Frankfurt am Main. Pick a campus, type an address, or drop a pin — whichever you prefer.
      </p>
      <p className="mt-1 text-label font-semibold uppercase tracking-wide text-brand-orange">Feel like home</p>

      <Segmented
        className="mt-4 w-full [&>label]:flex-1"
        name="origin-method"
        label="How to set your search origin"
        value={method}
        onChange={setMethod}
        options={[
          { value: 'campus', label: 'Campus', icon: <GraduationCap /> },
          { value: 'address', label: 'Address', icon: <Search /> },
          { value: 'pin', label: 'Drop a pin', icon: <MapPin /> },
        ]}
      />

      <div className="mt-4">
        {method === 'campus' ? (
          <fieldset>
            <legend className="mb-1.5 text-label font-semibold text-ink-soft">Choose a campus</legend>
            <div className="space-y-1.5">
              {FRANKFURT_CAMPUSES.map((campus) => (
                <label
                  key={campus.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded border px-3 py-2.5 transition-colors',
                    campus.id === campusId
                      ? 'border-primary bg-primary-tint'
                      : 'border-line bg-surface hover:border-line-strong hover:bg-canvas',
                    'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary',
                  )}
                >
                  <input
                    type="radio"
                    name="campus"
                    value={campus.id}
                    checked={campus.id === campusId}
                    onChange={() => setCampusId(campus.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
                      campus.id === campusId ? 'border-[5px] border-primary' : 'border-line-strong',
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block text-ui font-semibold text-ink">{campus.name}</span>
                    <span className="block text-label text-ink-muted">{campus.detail}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-label text-ink-muted">
              Campus points are approximate area centres, used only to measure distance from.
            </p>
            <Button variant="primary" size="lg" className="mt-3 w-full" onClick={confirmCampus}>
              Search from this campus
            </Button>
          </fieldset>
        ) : null}

        {method === 'address' ? (
          <div>
            <Field
              label="Address or district in Frankfurt"
              help="Start typing — matches are limited to the Frankfurt area."
            >
              {(props) => (
                <TextInput
                  {...props}
                  type="search"
                  autoComplete="off"
                  placeholder="e.g. Bockenheimer Landstraße 133"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              )}
            </Field>

            {!geocoder.ready ? (
              <p className="mt-2 flex items-center gap-1.5 text-label text-ink-muted">
                <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                Waiting for the map service to load…
              </p>
            ) : null}

            {searching ? (
              <p className="mt-2 text-label text-ink-muted" role="status">
                Searching addresses…
              </p>
            ) : null}

            {hits !== null && !searching ? (
              hits.length === 0 ? (
                <p className="mt-2 text-label text-ink-muted" role="status">
                  No match in the Frankfurt area. Try a street name with a house number, or drop a pin.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-line-soft overflow-hidden rounded border border-line">
                  {hits.map((hit) => (
                    <li key={`${hit.lat},${hit.lng}`}>
                      <button
                        type="button"
                        onClick={() =>
                          onConfirm({ lat: hit.lat, lng: hit.lng, label: hit.label, source: 'address' })
                        }
                        className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-canvas"
                      >
                        <MapPin aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
                        <span className="min-w-0 text-ui text-ink">
                          {hit.label}
                          {hit.approximate ? (
                            <span className="ml-1.5 text-label text-amber">approximate</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {geocoder.provider === 'nominatim' ? (
              <p className="mt-2 text-micro text-ink-faint">{NOMINATIM_ATTRIBUTION}</p>
            ) : null}
          </div>
        ) : null}

        {method === 'pin' ? (
          <div>
            <Callout tone={droppedPin ? 'good' : 'info'} title={droppedPin ? 'Pin placed' : 'Click anywhere on the map'}>
              {droppedPin ? (
                <span className="tnum">
                  {droppedPin.lat.toFixed(5)}, {droppedPin.lng.toFixed(5)}
                </span>
              ) : (
                'Pick the spot you want to measure distance from — your future workplace, a friend, a station.'
              )}
            </Callout>
            <Button
              variant="primary"
              size="lg"
              className="mt-3 w-full"
              disabled={!droppedPin}
              onClick={() =>
                droppedPin &&
                onConfirm({
                  lat: droppedPin.lat,
                  lng: droppedPin.lng,
                  label: `Dropped pin (${droppedPin.lat.toFixed(4)}, ${droppedPin.lng.toFixed(4)})`,
                  source: 'pin',
                })
              }
            >
              Search from this pin
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t border-line-soft pt-3.5">
        <Button variant="secondary" className="w-full" onClick={handleUseMyLocation} loading={locating} loadingLabel="Asking your browser…">
          <Crosshair aria-hidden className="h-4 w-4" />
          Use my location
        </Button>
        <p className="mt-1.5 text-label leading-[18px] text-ink-muted">
          Optional. Your browser will ask first, and Homi only uses the coordinates to measure distance.
        </p>

        {geolocationDenied ? (
          <Callout tone="info" className="mt-2.5" title="Location access was declined — that is fine">
            Nothing is blocked. Choosing a campus, typing an address or dropping a pin all work exactly the same. You can
            change the permission later in your browser's site settings.
          </Callout>
        ) : null}

        {locationNote ? (
          <Callout tone="attention" className="mt-2.5">
            {locationNote}
          </Callout>
        ) : null}
      </div>
    </section>
  )
}
