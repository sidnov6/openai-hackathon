import { CONTRACT_VERSION, HealthResponse } from './contracts.mirror'
import type { ApiClient, DataMode } from './types'
import { LiveApiClient } from './live'
import { MockApiClient } from './mock'

/**
 * Transport selection.
 *
 * VITE_API_TRANSPORT:
 *   "live"  - always call /api. A missing server surfaces as an explicit error state.
 *   "mock"  - always use the labelled sample adapter.
 *   "auto"  - (default) probe /api/health once; fall back to mock if nothing answers.
 *
 * Whichever is chosen, `mode` travels with every screen so sample results can never be
 * mistaken for live ones (brief section 3: "mock results never masquerade as live results").
 */
export type TransportChoice = 'live' | 'mock' | 'auto'

const PROBE_TIMEOUT_MS = 1500

export type Transport = {
  client: ApiClient
  mode: DataMode
  /** Why mock was chosen, when it was not the explicit request. Shown in the UI. */
  fallbackReason: string | null
}

let cached: Promise<Transport> | null = null

export function configuredChoice(): TransportChoice {
  const raw = (import.meta.env.VITE_API_TRANSPORT ?? 'auto').toLowerCase()
  return raw === 'live' || raw === 'mock' ? raw : 'auto'
}

/**
 * Probe for a real backend.
 *
 * HTTP 200 is NOT sufficient evidence. Any static host with an SPA fallback - including
 * `vite preview` - answers /api/health with index.html and a 200, which would make the
 * app select the live transport and then fail every call. So the probe insists on a
 * response that actually parses as the contract's health envelope. Anything less is
 * treated as "no server", and the app stays on the labelled mock transport.
 */
async function probeLive(): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const response = await fetch('/api/health', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) return false

    // An SPA fallback serves text/html here; a real API serves JSON.
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('json')) return false

    const body: unknown = await response.json().catch(() => null)
    if (!body || typeof body !== 'object') return false

    const envelope = body as { contractVersion?: unknown; data?: unknown }
    if (envelope.contractVersion !== CONTRACT_VERSION) return false
    return HealthResponse.safeParse(envelope.data).success
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export function resolveTransport(): Promise<Transport> {
  if (cached) return cached
  cached = (async (): Promise<Transport> => {
    const choice = configuredChoice()
    if (choice === 'mock') {
      return { client: new MockApiClient(), mode: 'mock', fallbackReason: null }
    }
    if (choice === 'live') {
      return { client: new LiveApiClient(), mode: 'live', fallbackReason: null }
    }
    const alive = await probeLive()
    if (alive) return { client: new LiveApiClient(), mode: 'live', fallbackReason: null }
    return {
      client: new MockApiClient(),
      mode: 'mock',
      fallbackReason: 'The Homi server did not answer on /api/health, so this session is showing labelled sample data.',
    }
  })()
  return cached
}

/** Used by tests and by the in-app transport switch to force a re-probe. */
export function resetTransport(): void {
  cached = null
}

/** Force a transport for this page load (developer control in the top bar). */
export function forceTransport(mode: DataMode): Promise<Transport> {
  cached = Promise.resolve(
    mode === 'live'
      ? { client: new LiveApiClient(), mode: 'live' as const, fallbackReason: null }
      : { client: new MockApiClient(), mode: 'mock' as const, fallbackReason: 'Sample data was selected manually.' },
  )
  return cached
}
