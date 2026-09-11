import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ApiClient, DataMode } from './types'
import { ApiError } from './live'
import { forceTransport, resolveTransport, type Transport } from './transport'

type ApiContextValue = {
  client: ApiClient | null
  mode: DataMode | null
  fallbackReason: string | null
  ready: boolean
  switchMode: (mode: DataMode) => void
}

const ApiContext = createContext<ApiContextValue | null>(null)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Housing facts are timestamped; we never silently re-fetch behind the user's back.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError) return error.retryable && failureCount < 2
        return failureCount < 1
      },
    },
    mutations: { retry: false },
  },
})

export function ApiProvider({ children }: { children: ReactNode }) {
  const [transport, setTransport] = useState<Transport | null>(null)

  useEffect(() => {
    let active = true
    resolveTransport().then((t) => {
      if (active) setTransport(t)
    })
    return () => {
      active = false
    }
  }, [])

  const value = useMemo<ApiContextValue>(
    () => ({
      client: transport?.client ?? null,
      mode: transport?.mode ?? null,
      fallbackReason: transport?.fallbackReason ?? null,
      ready: transport !== null,
      switchMode: (mode: DataMode) => {
        queryClient.clear()
        forceTransport(mode).then(setTransport)
      },
    }),
    [transport],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={value}>{children}</ApiContext.Provider>
    </QueryClientProvider>
  )
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext)
  if (!ctx) throw new Error('useApi must be used inside <ApiProvider>')
  return ctx
}

/** Throws until the transport has resolved. Use inside components guarded by `ready`. */
export function useApiClient(): ApiClient {
  const { client } = useApi()
  if (!client) throw new Error('API transport is not ready yet')
  return client
}

export { queryClient }
