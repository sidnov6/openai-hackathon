import type {
  CitedAnswer,
  ChecklistTask,
  ContactDraft,
  DemoPolicyLink,
  EvidenceItem,
  HealthResponse,
  JobEnvelope,
  Listing,
  SearchRequest,
  Tenancy,
  TenancyWorkspace,
} from './contracts.mirror'

/** Where the data on screen came from. Surfaced to the user at all times. */
export type DataMode = 'live' | 'mock'

export type ListingDetail = {
  listing: Listing
  /** Present only when this real record is bound to a reserved fictional policy slot. */
  demoLink: DemoPolicyLink | null
}

export type ContactDraftInput = {
  listingId: string
  studentName: string
  studyProgramme: string
  moveInDate: string | null
  durationMonths: number | null
  notes: string
  language: 'en' | 'de'
}

export type MoveOutClaimInput = {
  label: string
  amountCents: number | null
  providerStatement: string
}

export type TaskPatch = {
  status?: ChecklistTask['status']
}

export type DatesPatch = {
  moveInDate: string | null
  moveOutDate: string | null
  registration?: {
    hasExistingGermanRegistration: boolean | null
    intendedStayMonths: number | null
    actualMoveInDate: string | null
  }
}

export type EvidenceInput = {
  file: File | null
  roomOrItem: string
  note: string
  phase: EvidenceItem['phase']
  capturedAtStated: string | null
  comparisonIds?: string[]
}

/**
 * The single interface the UI talks to. The live adapter (src/api/live.ts) and the
 * labelled mock adapter (src/api/mock/index.ts) both implement it, so mock/live parity
 * is enforced by the type system rather than by discipline.
 *
 * Mirrors API v1 in brief section 12.
 */
export interface ApiClient {
  readonly mode: DataMode

  /** GET /api/health - capability flags, never secrets. */
  health(): Promise<HealthResponse>

  /** POST /api/search -> 202 { jobId } */
  startSearch(request: SearchRequest): Promise<{ jobId: string }>

  /** GET /api/jobs/:id - events + result when ready. */
  getJob(jobId: string): Promise<JobEnvelope>

  /** Cancel an in-flight job (client-initiated; server marks it cancelled). */
  cancelJob(jobId: string): Promise<void>

  /** GET /api/listings/:id */
  getListing(listingId: string): Promise<ListingDetail>

  /** POST /api/contact-drafts - prepares a draft. Never sends anything. */
  createContactDraft(input: ContactDraftInput): Promise<ContactDraft>

  /** Records that the student opened the external route. Not proof of delivery. */
  markContactHandoff(draftId: string): Promise<ContactDraft>

  /** POST /api/demo/tenancies - atomically creates and simulates acceptance. */
  createDemoTenancy(input: { listingId: string; slotId: string }): Promise<Tenancy>

  /** Backwards-compatible idempotent simulated-host acceptance endpoint. */
  acceptDemoTenancy(tenancyId: string, idempotencyKey: string): Promise<Tenancy>

  /** Student rejects / resets their own demo application. */
  resetDemoTenancy(tenancyId: string): Promise<Tenancy>

  /** POST /api/tenancies/:id/analyze -> 202 { jobId } */
  analyzeTenancy(tenancyId: string, idempotencyKey: string): Promise<{ jobId: string }>

  /** GET /api/tenancies/:id */
  getTenancy(tenancyId: string): Promise<TenancyWorkspace>

  /** POST /api/tenancies/:id/questions - answer is scoped to THIS tenancy's document. */
  askQuestion(tenancyId: string, question: string): Promise<CitedAnswer>

  /** PATCH /api/tenancies/:id/dates - regenerates affected tasks with a change notice. */
  updateDates(tenancyId: string, patch: DatesPatch): Promise<TenancyWorkspace>

  /** PATCH /api/tenancies/:id/tasks/:taskId */
  updateTask(tenancyId: string, taskId: string, patch: TaskPatch): Promise<ChecklistTask>

  /** POST /api/tenancies/:id/evidence - multipart. */
  addEvidence(tenancyId: string, input: EvidenceInput): Promise<EvidenceItem>

  /**
   * GET /api/tenancies/:id/evidence/:evidenceId - authorised fetch.
   * Returns an object URL the caller must revoke. There is no public file URL.
   */
  getEvidenceObjectUrl(tenancyId: string, evidenceId: string): Promise<string | null>

  /** POST /api/tenancies/:id/move-out-review -> 202 { jobId } */
  startMoveOutReview(tenancyId: string, claims: MoveOutClaimInput[]): Promise<{ jobId: string }>

  /** DELETE /api/tenancies/:id - confirmed deletion of tenancy data + evidence. */
  deleteTenancy(tenancyId: string): Promise<void>

  /** Tenancies belonging to the current session cookie. */
  listTenancies(): Promise<Tenancy[]>
}
