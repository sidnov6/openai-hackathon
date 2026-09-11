import { z } from 'zod'
import {
  CONTRACT_VERSION,
  ChecklistTask,
  CitedAnswer,
  ContactDraft,
  DemoPolicyLink,
  ErrorEnvelope,
  EvidenceItem,
  HealthResponse,
  JobAccepted,
  JobEnvelope,
  Listing,
  Tenancy,
  TenancyWorkspace,
  type SearchRequest,
} from './contracts.mirror'
import type {
  ApiClient,
  ContactDraftInput,
  DatesPatch,
  EvidenceInput,
  ListingDetail,
  MoveOutClaimInput,
  TaskPatch,
} from './types'

/** A failure the UI can render honestly: code, message, and whether retrying helps. */
export class ApiError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly httpStatus: number
  constructor(code: string, message: string, retryable: boolean, httpStatus: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.retryable = retryable
    this.httpStatus = httpStatus
  }
}

export const OFFLINE_CODE = 'transport_unavailable'

const ListingDetailSchema = z.object({ listing: Listing, demoLink: DemoPolicyLink.nullable() })

/**
 * Live adapter for API v1. Same-origin so the session cookie (signed, HttpOnly)
 * travels with every request - the client never holds or sends a tenancy token itself.
 *
 * Every response is parsed through the contract schema. A backend that drifts from the
 * contract produces a loud, explicit error rather than a half-rendered screen.
 */
export class LiveApiClient implements ApiClient {
  readonly mode = 'live' as const
  private readonly base: string

  constructor(base = '/api') {
    this.base = base.replace(/\/$/, '')
  }

  private async request<T extends z.ZodTypeAny>(
    path: string,
    schema: T,
    init?: RequestInit & { rawBody?: BodyInit },
  ): Promise<z.infer<T>> {
    let response: Response
    try {
      response = await fetch(`${this.base}${path}`, {
        credentials: 'same-origin',
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init?.rawBody ? {} : init?.body ? { 'Content-Type': 'application/json' } : {}),
          ...init?.headers,
        },
        body: init?.rawBody ?? init?.body,
      })
    } catch (cause) {
      throw new ApiError(
        OFFLINE_CODE,
        'The Homi server did not respond. Start apps/api, or switch to sample data.',
        true,
        0,
      )
    }

    if (response.status === 204) return undefined as z.infer<T>

    let json: unknown
    try {
      json = await response.json()
    } catch {
      throw new ApiError('invalid_response', `The server returned a non-JSON response (HTTP ${response.status}).`, false, response.status)
    }

    if (!response.ok) {
      const parsed = ErrorEnvelope.safeParse(json)
      if (parsed.success) {
        throw new ApiError(parsed.data.error.code, parsed.data.error.message, parsed.data.error.retryable, response.status)
      }
      throw new ApiError('http_error', `Request failed with HTTP ${response.status}.`, response.status >= 500, response.status)
    }

    const envelope = z
      .object({ contractVersion: z.literal(CONTRACT_VERSION), data: z.unknown(), requestId: z.string() })
      .safeParse(json)
    if (!envelope.success) {
      throw new ApiError('contract_mismatch', 'The server response did not match contract version 1.', false, response.status)
    }

    const data = schema.safeParse(envelope.data.data)
    if (!data.success) {
      // Surface the first path so a contract drift is actionable, not mysterious.
      const issue = data.error.issues[0]
      throw new ApiError(
        'contract_mismatch',
        `Response field "${issue?.path.join('.') || '(root)'}" did not match the contract: ${issue?.message ?? 'unknown'}.`,
        false,
        response.status,
      )
    }
    return data.data
  }

  health() {
    return this.request('/health', HealthResponse)
  }

  startSearch(request: SearchRequest) {
    return this.request('/search', JobAccepted, { method: 'POST', body: JSON.stringify(request) })
  }

  getJob(jobId: string) {
    return this.request(`/jobs/${encodeURIComponent(jobId)}`, JobEnvelope)
  }

  async cancelJob(jobId: string) {
    await this.request(`/jobs/${encodeURIComponent(jobId)}/cancel`, z.unknown(), { method: 'POST' })
  }

  getListing(listingId: string): Promise<ListingDetail> {
    return this.request(`/listings/${encodeURIComponent(listingId)}`, ListingDetailSchema)
  }

  createContactDraft(input: ContactDraftInput) {
    return this.request('/contact-drafts', ContactDraft, { method: 'POST', body: JSON.stringify(input) })
  }

  markContactHandoff(draftId: string) {
    return this.request(`/contact-drafts/${encodeURIComponent(draftId)}/handoff`, ContactDraft, { method: 'POST' })
  }

  createDemoTenancy(input: { listingId: string; slotId: string }) {
    return this.request('/demo/tenancies', Tenancy, { method: 'POST', body: JSON.stringify(input) })
  }

  acceptDemoTenancy(tenancyId: string, idempotencyKey: string) {
    // Idempotency-Key stops a double click creating two acceptance events.
    return this.request(`/demo/tenancies/${encodeURIComponent(tenancyId)}/accept`, Tenancy, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    })
  }

  resetDemoTenancy(tenancyId: string) {
    return this.request(`/demo/tenancies/${encodeURIComponent(tenancyId)}/reset`, Tenancy, { method: 'POST' })
  }

  analyzeTenancy(tenancyId: string, idempotencyKey: string) {
    return this.request(`/tenancies/${encodeURIComponent(tenancyId)}/analyze`, JobAccepted, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    })
  }

  getTenancy(tenancyId: string) {
    return this.request(`/tenancies/${encodeURIComponent(tenancyId)}`, TenancyWorkspace)
  }

  askQuestion(tenancyId: string, question: string) {
    return this.request(`/tenancies/${encodeURIComponent(tenancyId)}/questions`, CitedAnswer, {
      method: 'POST',
      body: JSON.stringify({ question }),
    })
  }

  updateDates(tenancyId: string, patch: DatesPatch) {
    return this.request(`/tenancies/${encodeURIComponent(tenancyId)}/dates`, TenancyWorkspace, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }

  updateTask(tenancyId: string, taskId: string, patch: TaskPatch) {
    return this.request(
      `/tenancies/${encodeURIComponent(tenancyId)}/tasks/${encodeURIComponent(taskId)}`,
      ChecklistTask,
      { method: 'PATCH', body: JSON.stringify(patch) },
    )
  }

  addEvidence(tenancyId: string, input: EvidenceInput) {
    const form = new FormData()
    if (input.file) form.append('file', input.file)
    form.append('roomOrItem', input.roomOrItem)
    form.append('note', input.note)
    form.append('phase', input.phase)
    if (input.capturedAtStated) form.append('capturedAtStated', input.capturedAtStated)
    for (const id of input.comparisonIds ?? []) form.append('comparisonIds', id)
    return this.request(`/tenancies/${encodeURIComponent(tenancyId)}/evidence`, EvidenceItem, {
      method: 'POST',
      rawBody: form,
    })
  }

  async getEvidenceObjectUrl(tenancyId: string, evidenceId: string): Promise<string | null> {
    // Authorised binary fetch. The server never exposes a public file URL.
    const response = await fetch(
      `${this.base}/tenancies/${encodeURIComponent(tenancyId)}/evidence/${encodeURIComponent(evidenceId)}`,
      { credentials: 'same-origin' },
    )
    if (!response.ok) return null
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

  startMoveOutReview(tenancyId: string, claims: MoveOutClaimInput[]) {
    return this.request(`/tenancies/${encodeURIComponent(tenancyId)}/move-out-review`, JobAccepted, {
      method: 'POST',
      body: JSON.stringify({ claims }),
    })
  }

  async deleteTenancy(tenancyId: string) {
    await this.request(`/tenancies/${encodeURIComponent(tenancyId)}`, z.unknown(), { method: 'DELETE' })
  }

  listTenancies() {
    return this.request('/tenancies', z.array(Tenancy))
  }
}
