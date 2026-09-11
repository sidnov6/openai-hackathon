import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import type { RoomType, SearchOrigin, SearchRequest, SearchResult } from '@/api/contracts.mirror'

/**
 * Journey state.
 *
 * One reducer owns the whole flow so the map, the results rail and the workspace can
 * never disagree about what is selected or which origin the results belong to. Search
 * results carry the exact request that produced them, so a filter change cannot make a
 * stale result look current.
 */

export type Filters = {
  radiusKm: number
  maxMonthlyCostCents: number | null
  roomTypes: RoomType[]
  moveInDate: string | null
  includeUnknownPrices: boolean
}

export const DEFAULT_FILTERS: Filters = {
  radiusKm: 3,
  maxMonthlyCostCents: null,
  roomTypes: [],
  moveInDate: null,
  includeUnknownPrices: true,
}

export type JourneyState = {
  /** Null until the student confirms where to search from. Nothing is assumed. */
  origin: SearchOrigin | null
  filters: Filters
  /** The request that produced `result`, so staleness is detectable, not guessed. */
  appliedRequest: SearchRequest | null
  result: SearchResult | null
  selectedListingId: string | null
  hoveredListingId: string | null
  /** Set when the user pans away from the searched area. Drives "Search this area". */
  pendingAreaCenter: { lat: number; lng: number } | null
  activeTenancyId: string | null
  mobileView: 'map' | 'list'
  detailOpen: boolean
  geolocationDenied: boolean
}

const INITIAL: JourneyState = {
  origin: null,
  filters: DEFAULT_FILTERS,
  appliedRequest: null,
  result: null,
  selectedListingId: null,
  hoveredListingId: null,
  pendingAreaCenter: null,
  activeTenancyId: null,
  mobileView: 'map',
  detailOpen: false,
  geolocationDenied: false,
}

type Action =
  | { type: 'confirmOrigin'; origin: SearchOrigin }
  | { type: 'clearOrigin' }
  | { type: 'setFilters'; filters: Partial<Filters> }
  | { type: 'searchStarted'; request: SearchRequest }
  | { type: 'searchSettled'; result: SearchResult | null }
  | { type: 'selectListing'; id: string | null; openDetail?: boolean }
  | { type: 'hoverListing'; id: string | null }
  | { type: 'closeDetail' }
  | { type: 'userMovedMap'; center: { lat: number; lng: number } }
  | { type: 'clearPendingArea' }
  | { type: 'setTenancy'; id: string | null }
  | { type: 'setMobileView'; view: 'map' | 'list' }
  | { type: 'geolocationDenied' }

function reducer(state: JourneyState, action: Action): JourneyState {
  switch (action.type) {
    case 'confirmOrigin':
      return { ...state, origin: action.origin, pendingAreaCenter: null, geolocationDenied: false }
    case 'clearOrigin':
      return { ...INITIAL, filters: state.filters }
    case 'setFilters':
      return { ...state, filters: { ...state.filters, ...action.filters } }
    case 'searchStarted':
      return { ...state, appliedRequest: action.request, pendingAreaCenter: null }
    case 'searchSettled':
      return { ...state, result: action.result }
    case 'selectListing':
      return {
        ...state,
        selectedListingId: action.id,
        detailOpen: action.openDetail ?? state.detailOpen,
      }
    case 'hoverListing':
      return { ...state, hoveredListingId: action.id }
    case 'closeDetail':
      return { ...state, detailOpen: false }
    case 'userMovedMap': {
      if (!state.origin) return state
      const moved =
        Math.abs(action.center.lat - state.origin.lat) > 0.004 || Math.abs(action.center.lng - state.origin.lng) > 0.006
      return moved ? { ...state, pendingAreaCenter: action.center } : { ...state, pendingAreaCenter: null }
    }
    case 'clearPendingArea':
      return { ...state, pendingAreaCenter: null }
    case 'setTenancy':
      return { ...state, activeTenancyId: action.id }
    case 'setMobileView':
      return { ...state, mobileView: action.view }
    case 'geolocationDenied':
      return { ...state, geolocationDenied: true }
    default:
      return state
  }
}

export function buildSearchRequest(origin: SearchOrigin, filters: Filters): SearchRequest {
  return {
    origin,
    radiusKm: filters.radiusKm,
    maxMonthlyCostCents: filters.maxMonthlyCostCents,
    roomTypes: filters.roomTypes,
    moveInDate: filters.moveInDate,
    includeUnknownPrices: filters.includeUnknownPrices,
  }
}

/** True when the current filters no longer match the results on screen. */
export function resultsAreStale(state: JourneyState): boolean {
  if (!state.result || !state.appliedRequest || !state.origin) return false
  const applied = state.appliedRequest
  const current = buildSearchRequest(state.origin, state.filters)
  return JSON.stringify(applied) !== JSON.stringify(current)
}

type JourneyContextValue = JourneyState & {
  confirmOrigin: (origin: SearchOrigin) => void
  clearOrigin: () => void
  setFilters: (filters: Partial<Filters>) => void
  searchStarted: (request: SearchRequest) => void
  searchSettled: (result: SearchResult | null) => void
  selectListing: (id: string | null, openDetail?: boolean) => void
  hoverListing: (id: string | null) => void
  closeDetail: () => void
  userMovedMap: (center: { lat: number; lng: number }) => void
  clearPendingArea: () => void
  setTenancy: (id: string | null) => void
  setMobileView: (view: 'map' | 'list') => void
  markGeolocationDenied: () => void
  isStale: boolean
}

const JourneyContext = createContext<JourneyContextValue | null>(null)

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL)

  const value = useMemo<JourneyContextValue>(
    () => ({
      ...state,
      isStale: resultsAreStale(state),
      confirmOrigin: (origin) => dispatch({ type: 'confirmOrigin', origin }),
      clearOrigin: () => dispatch({ type: 'clearOrigin' }),
      setFilters: (filters) => dispatch({ type: 'setFilters', filters }),
      searchStarted: (request) => dispatch({ type: 'searchStarted', request }),
      searchSettled: (result) => dispatch({ type: 'searchSettled', result }),
      selectListing: (id, openDetail) => dispatch({ type: 'selectListing', id, openDetail }),
      hoverListing: (id) => dispatch({ type: 'hoverListing', id }),
      closeDetail: () => dispatch({ type: 'closeDetail' }),
      userMovedMap: (center) => dispatch({ type: 'userMovedMap', center }),
      clearPendingArea: () => dispatch({ type: 'clearPendingArea' }),
      setTenancy: (id) => dispatch({ type: 'setTenancy', id }),
      setMobileView: (view) => dispatch({ type: 'setMobileView', view }),
      markGeolocationDenied: () => dispatch({ type: 'geolocationDenied' }),
    }),
    [state],
  )

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>
}

export function useJourney(): JourneyContextValue {
  const ctx = useContext(JourneyContext)
  if (!ctx) throw new Error('useJourney must be used inside <JourneyProvider>')
  return ctx
}

/** Campus origins offered as a shortcut. Marked approximate - they are area centroids. */
export const FRANKFURT_CAMPUSES: { id: string; name: string; detail: string; lat: number; lng: number }[] = [
  { id: 'westend', name: 'Campus Westend', detail: 'Goethe University · Theodor-W.-Adorno-Platz', lat: 50.1259, lng: 8.6673 },
  { id: 'bockenheim', name: 'Campus Bockenheim', detail: 'Goethe University · Mertonstraße', lat: 50.1256, lng: 8.6519 },
  { id: 'riedberg', name: 'Campus Riedberg', detail: 'Goethe University · Max-von-Laue-Straße', lat: 50.1740, lng: 8.6303 },
  { id: 'niederrad', name: 'Campus Niederrad', detail: 'University Hospital · Theodor-Stern-Kai', lat: 50.0940, lng: 8.6600 },
  { id: 'uas', name: 'Frankfurt UAS', detail: 'University of Applied Sciences · Nibelungenplatz', lat: 50.1305, lng: 8.6930 },
]

export const useJourneyDispatchless = useJourney
