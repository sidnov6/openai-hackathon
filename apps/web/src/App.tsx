import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { List, Map as MapIcon, RefreshCw, Search } from 'lucide-react'
import type { JobEnvelope, SearchOrigin } from '@/api/contracts.mirror'
import { useApi, useApiClient } from '@/api/ApiProvider'
import { useJob } from '@/hooks/useJob'
import { buildSearchRequest, useJourney } from '@/state/journey'
import { MapCanvas } from '@/components/map/MapCanvas'
import { LocationCard } from '@/components/location/LocationCard'
import { FiltersBar } from '@/components/search/FiltersBar'
import { ResultsRail } from '@/components/search/ResultsRail'
import { ListingDetail } from '@/components/listing/ListingDetail'
import { ContactDraftSheet } from '@/components/listing/ContactDraftSheet'
import { TenancyWorkspaceView } from '@/components/tenancy/TenancyWorkspace'
import { AgentRail } from '@/components/agents/AgentRail'
import { DataModeBanner, TopBar } from '@/components/shell/TopBar'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { cn } from '@/lib/cn'

export function App() {
  const { ready, mode } = useApi()
  if (!ready) {
    return (
      <div className="flex h-dvh items-center justify-center bg-canvas">
        <p className="text-ui text-ink-muted" role="status">
          Starting Homi…
        </p>
      </div>
    )
  }
  return <AppShell key={mode ?? 'pending'} />
}

function AppShell() {
  const client = useApiClient()
  const journey = useJourney()
  const [pinDropMode, setPinDropMode] = useState(false)
  const [droppedPin, setDroppedPin] = useState<{ lat: number; lng: number } | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [demoBusy, setDemoBusy] = useState(false)
  const [searchJob, setSearchJob] = useState<JobEnvelope | null>(null)
  const railRef = useRef<HTMLDivElement>(null)

  const job = useJob(
    useCallback(
      (finished: JobEnvelope) => {
        setSearchJob(finished)
        journey.searchSettled(finished.searchResult ?? null)
      },
      [journey],
    ),
  )

  const runSearch = useCallback(
    async (origin: SearchOrigin) => {
      const request = buildSearchRequest(origin, journey.filters)
      journey.searchStarted(request)
      journey.searchSettled(null)
      setSearchJob(null)
      const { jobId } = await client.startSearch(request)
      job.start(jobId)
    },
    [client, journey, job],
  )

  // Search immediately once an origin is confirmed - the student already asked for it.
  const handleConfirmOrigin = useCallback(
    (origin: SearchOrigin) => {
      journey.confirmOrigin(origin)
      void runSearch(origin)
    },
    [journey, runSearch],
  )

  const detail = useQuery({
    queryKey: ['listing', journey.selectedListingId],
    queryFn: () => client.getListing(journey.selectedListingId as string),
    enabled: Boolean(journey.selectedListingId),
  })

  const startDemo = async () => {
    const listing = detail.data?.listing
    const slot = detail.data?.demoLink
    if (!listing || !slot) return
    setDemoBusy(true)
    try {
      const tenancy = await client.createDemoTenancy({ listingId: listing.id, slotId: slot.slotId })
      // Demo requests are accepted atomically; the workspace starts selected-document analysis.
      journey.setTenancy(tenancy.id)
      journey.closeDetail()
    } finally {
      setDemoBusy(false)
    }
  }

  if (journey.activeTenancyId) {
    return (
      <div className="flex h-dvh flex-col">
        <div className="print-hide contents">
          <TopBar origin={journey.origin?.label ?? null} onChangeOrigin={() => journey.setTenancy(null)} />
          <DataModeBanner />
        </div>
        <main id="main" className="min-h-0 flex-1">
          <TenancyWorkspaceView tenancyId={journey.activeTenancyId} onBack={() => journey.setTenancy(null)} />
        </main>
      </div>
    )
  }

  const listings = journey.result?.listings ?? []
  const showRail = journey.origin !== null

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <a href="#main" className="skip-link">
        Skip to the results
      </a>

      <TopBar
        origin={journey.origin?.label ?? null}
        onChangeOrigin={() => {
          journey.clearOrigin()
          setDroppedPin(null)
        }}
      />
      <DataModeBanner />

      <div className="relative flex min-h-0 flex-1">
        {/* ---------- Results rail (desktop) --------------------------------- */}
        {showRail ? (
          <aside
            ref={railRef}
            aria-label="Search results"
            className={cn(
              'z-20 flex w-full shrink-0 flex-col border-r border-line bg-surface md:w-[380px]',
              journey.mobileView === 'map' && 'max-md:hidden',
            )}
          >
            <div className="scroll-thin shrink-0 overflow-x-auto border-b border-line px-3 py-2.5">
              <FiltersBar
                filters={journey.filters}
                onChange={journey.setFilters}
                onApply={() => journey.origin && runSearch(journey.origin)}
                dirty={journey.isStale}
              />
            </div>

            <div id="main" className="min-h-0 flex-1">
              <ResultsRail
                result={journey.result}
                loading={job.polling}
                error={job.error}
                stale={journey.isStale}
                radiusKm={journey.filters.radiusKm}
                selectedId={journey.selectedListingId}
                onSelect={(id) => journey.selectListing(id)}
                onOpen={(id) => journey.selectListing(id, true)}
                onHover={journey.hoverListing}
                onRetry={() => journey.origin && runSearch(journey.origin)}
                onWidenRadius={() => {
                  const next = Math.min(journey.filters.radiusKm * 2, 25)
                  journey.setFilters({ radiusKm: next })
                  if (journey.origin) void runSearch({ ...journey.origin })
                }}
              />
            </div>

            <AgentRail job={job.job ?? searchJob} polling={job.polling} onCancel={job.cancel} />
          </aside>
        ) : null}

        {/* ---------- Map ---------------------------------------------------- */}
        <div className={cn('relative min-w-0 flex-1', showRail && journey.mobileView === 'list' && 'max-md:hidden')}>
          <MapCanvas
            origin={journey.origin}
            radiusKm={journey.filters.radiusKm}
            listings={listings}
            selectedId={journey.selectedListingId}
            hoveredId={journey.hoveredListingId}
            onSelect={(id) => journey.selectListing(id, true)}
            onUserMoved={journey.userMovedMap}
            pinDropMode={pinDropMode && !journey.origin}
            onPinDrop={setDroppedPin}
          />

          {/* Before confirmation: the location card sits over the map. */}
          {!journey.origin ? (
            <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-6">
              <LocationCard
                onConfirm={handleConfirmOrigin}
                onTogglePinDrop={setPinDropMode}
                droppedPin={droppedPin}
                geolocationDenied={journey.geolocationDenied}
                onGeolocationDenied={journey.markGeolocationDenied}
              />
            </div>
          ) : null}

          {/* "Search this area" appears only after a real pan, never on every drag. */}
          {journey.pendingAreaCenter ? (
            <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
              <Button
                variant="primary"
                size="sm"
                className="shadow-raised"
                onClick={() => {
                  const center = journey.pendingAreaCenter
                  if (!center) return
                  const origin: SearchOrigin = {
                    lat: center.lat,
                    lng: center.lng,
                    label: `Map area (${center.lat.toFixed(4)}, ${center.lng.toFixed(4)})`,
                    source: 'pin',
                  }
                  journey.confirmOrigin(origin)
                  void runSearch(origin)
                }}
              >
                <RefreshCw aria-hidden className="h-4 w-4" />
                Search this area
              </Button>
            </div>
          ) : null}

          {/* Mobile Map/List toggle, clear of the attribution strip. */}
          {showRail ? (
            <div className="absolute bottom-9 left-1/2 z-20 -translate-x-1/2 md:hidden">
              <Segmented
                name="mobile-view"
                label="Show map or list"
                value={journey.mobileView}
                onChange={journey.setMobileView}
                className="bg-surface shadow-raised"
                options={[
                  { value: 'map', label: 'Map', icon: <MapIcon /> },
                  { value: 'list', label: `List${listings.length ? ` (${listings.length})` : ''}`, icon: <List /> },
                ]}
              />
            </div>
          ) : null}

          {showRail && listings.length === 0 && !job.polling && journey.result ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3 md:hidden">
              <p className="rounded-md border border-line bg-surface px-3 py-2 text-label text-ink-muted shadow-card">
                <Search aria-hidden className="mr-1 inline h-3.5 w-3.5" />
                No results in this radius
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {detail.data ? (
        <>
          <ListingDetail
            listing={detail.data.listing}
            demoLink={detail.data.demoLink}
            open={journey.detailOpen}
            onOpenChange={(open) => (open ? journey.selectListing(detail.data!.listing.id, true) : journey.closeDetail())}
            onStartDemo={startDemo}
            onPrepareContact={() => setContactOpen(true)}
            demoBusy={demoBusy}
          />
          <ContactDraftSheet
            listing={detail.data.listing}
            open={contactOpen}
            onOpenChange={setContactOpen}
            onSend={detail.data.demoLink?.status === 'ready' ? startDemo : undefined}
          />
        </>
      ) : null}
    </div>
  )
}

/** Keeps `dvh` honest on mobile browsers whose chrome resizes the viewport. */
export function useViewportUnit() {
  useEffect(() => {
    const set = () => document.documentElement.style.setProperty('--app-vh', `${window.innerHeight * 0.01}px`)
    set()
    window.addEventListener('resize', set)
    return () => window.removeEventListener('resize', set)
  }, [])
}
