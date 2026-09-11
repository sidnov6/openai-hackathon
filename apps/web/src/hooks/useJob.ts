import { useCallback, useEffect, useRef, useState } from 'react'
import type { JobEnvelope } from '@/api/contracts.mirror'
import { useApiClient } from '@/api/ApiProvider'
import { ApiError } from '@/api/live'

/**
 * Poll a job until a terminal state, then stop.
 *
 * Backoff is deliberate (brief section 12): start fast so the activity rail feels live,
 * then ease off so a long analysis does not hammer the server. Polling stops on a
 * terminal status, on unmount, and on explicit cancellation - never left running.
 */
const TERMINAL = new Set(['succeeded', 'partial', 'failed', 'cancelled'])
const FIRST_DELAY = 400
const MAX_DELAY = 4000

export type JobState = {
  job: JobEnvelope | null
  error: ApiError | Error | null
  polling: boolean
  start: (jobId: string) => void
  cancel: () => void
  reset: () => void
}

export function useJob(onSettled?: (job: JobEnvelope) => void): JobState {
  const client = useApiClient()
  const [job, setJob] = useState<JobEnvelope | null>(null)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [polling, setPolling] = useState(false)

  const timer = useRef<number | null>(null)
  const jobId = useRef<string | null>(null)
  const delay = useRef(FIRST_DELAY)
  const settled = useRef(false)
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  const stopTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const tick = useCallback(async () => {
    const id = jobId.current
    if (!id) return
    try {
      const next = await client.getJob(id)
      if (jobId.current !== id) return // a newer job superseded this one
      setJob(next)
      if (TERMINAL.has(next.status)) {
        setPolling(false)
        if (!settled.current) {
          settled.current = true
          onSettledRef.current?.(next)
        }
        return
      }
      delay.current = Math.min(Math.round(delay.current * 1.45), MAX_DELAY)
      timer.current = window.setTimeout(tick, delay.current)
    } catch (cause) {
      if (jobId.current !== id) return
      setError(cause instanceof Error ? cause : new Error('Job polling failed'))
      setPolling(false)
    }
  }, [client])

  const start = useCallback(
    (id: string) => {
      stopTimer()
      jobId.current = id
      delay.current = FIRST_DELAY
      settled.current = false
      setJob(null)
      setError(null)
      setPolling(true)
      timer.current = window.setTimeout(tick, FIRST_DELAY)
    },
    [stopTimer, tick],
  )

  const cancel = useCallback(() => {
    const id = jobId.current
    stopTimer()
    setPolling(false)
    if (id) void client.cancelJob(id).catch(() => undefined)
    jobId.current = null
  }, [client, stopTimer])

  const reset = useCallback(() => {
    stopTimer()
    jobId.current = null
    setJob(null)
    setError(null)
    setPolling(false)
  }, [stopTimer])

  // Navigating away stops polling. No orphaned intervals.
  useEffect(() => stopTimer, [stopTimer])

  return { job, error, polling, start, cancel, reset }
}
