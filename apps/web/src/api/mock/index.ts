import type {
  AgentEvent,
  ChecklistTask,
  CitedAnswer,
  ContactDraft,
  EvidenceItem,
  HealthResponse,
  JobEnvelope,
  Listing,
  SearchCounts,
  SearchRequest,
  SearchResult,
  Tenancy,
  TenancyWorkspace,
} from '../contracts.mirror'
import type {
  ApiClient,
  ContactDraftInput,
  DatesPatch,
  EvidenceInput,
  ListingDetail,
  MoveOutClaimInput,
  TaskPatch,
} from '../types'
import { ApiError } from '../live'
import { formatDistance, haversineMeters } from '@/lib/geo'
import { addDaysOrNull } from '@/lib/dates'
import { withinBudget } from '@/lib/money'
import { SAMPLE_LISTINGS, SAMPLE_SLOTS } from './listings'
import {
  FIXTURE_ANALYSIS,
  FIXTURE_COSTS,
  FIXTURE_DEPOSIT,
  FIXTURE_DOCUMENT,
  FIXTURE_FINDINGS,
  FIXTURE_LEGAL_FINDINGS,
  FIXTURE_LEGAL_STATUS,
  FIXTURE_TASKS,
} from './fixture'
import { clearState, deleteBlobsWithPrefix, getBlob, loadState, putBlob, saveState } from './store'

const now = () => new Date().toISOString()
const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`

type MockJob = JobEnvelope & { _startedAt: number; _script: ScriptStep[]; _cancelled?: boolean }
type ScriptStep = Omit<AgentEvent, 'id' | 'jobId' | 'createdAt'> & { atMs: number; stage: string }

type PersistedState = {
  tenancies: Record<string, Tenancy>
  tasks: Record<string, ChecklistTask[]>
  evidence: Record<string, EvidenceItem[]>
  answers: Record<string, CitedAnswer[]>
  claims: Record<string, MoveOutClaimInput[]>
  drafts: Record<string, ContactDraft>
  acceptedKeys: Record<string, string>
  analysisKeys: Record<string, string>
}

const EMPTY_STATE: PersistedState = {
  tenancies: {},
  tasks: {},
  evidence: {},
  answers: {},
  claims: {},
  drafts: {},
  acceptedKeys: {},
  analysisKeys: {},
}

/**
 * ============================================================================
 * MOCK ADAPTER - CLEARLY LABELLED SAMPLE DATA. NEVER PRESENTED AS LIVE.
 * ============================================================================
 *
 * Implements the exact same `ApiClient` interface as the live adapter, so switching
 * transport changes nothing in the UI. Everything it returns is labelled:
 *   - SearchResult.freshness is always "saved", never "live",
 *   - the provider row says the source is generated sample data,
 *   - HealthResponse reports every live capability as false with a stated limitation.
 *
 * Jobs run on a timed script so the agent activity rail animates genuine task progress
 * rather than a fake conversation - each step corresponds to a state change here.
 */
export class MockApiClient implements ApiClient {
  readonly mode = 'mock' as const
  private jobs = new Map<string, MockJob>()
  private state: PersistedState

  constructor() {
    this.state = loadState<PersistedState>(EMPTY_STATE)
  }

  private persist() {
    saveState(this.state)
  }

  async health(): Promise<HealthResponse> {
    const bound = SAMPLE_SLOTS.filter((s) => s.listingId).length
    const ingested = SAMPLE_SLOTS.filter((s) => s.documentId).length
    return {
      status: 'degraded',
      capabilities: {
        liveSearch: false,
        openai: false,
        googleMaps: Boolean(import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY),
        documentIngestion: false,
        legalRegistry: false,
        demoMode: true,
      },
      demoCatalog: {
        totalSlots: 20,
        boundListings: bound,
        ingestedDocuments: ingested,
        readySlots: SAMPLE_SLOTS.filter((s) => s.status === 'ready').length,
        links: SAMPLE_SLOTS,
      },
      limitations: [
        'The Homi server (apps/api) is not running, so this session uses generated sample data. Nothing on screen was retrieved from a real housing provider.',
        `${20 - ingested} of the 20 reserved policy slots have no document. Those slots cannot produce an analysis.`,
        'The legal source registry was not retrieved live. Legal findings shown here come from the UI fixture.',
      ],
      serverTime: now(),
    }
  }

  /* ---------------------------------------------------------------- search */

  async startSearch(request: SearchRequest): Promise<{ jobId: string }> {
    const jobId = uid('job')
    const script: ScriptStep[] = [
      { atMs: 250, agent: 'orchestrator', status: 'started', summary: 'Confirming the search origin and radius', stage: 'Preparing search', sourceRefs: [] },
      { atMs: 900, agent: 'housing_scout', status: 'progress', summary: 'Looking for student housing near the origin', stage: 'Discovering candidates', sourceRefs: [] },
      { atMs: 1700, agent: 'listing_verifier', status: 'progress', summary: 'Checking provider pages for availability wording', stage: 'Verifying records', sourceRefs: [] },
      { atMs: 2300, agent: 'listing_verifier', status: 'progress', summary: 'Separating buildings from individual room offers', stage: 'Verifying records', sourceRefs: [] },
      { atMs: 2900, agent: 'evidence_gate', status: 'succeeded', summary: 'Every displayed figure carries a source and a timestamp', stage: 'Ready', sourceRefs: [] },
    ]
    const job: MockJob = {
      id: jobId,
      type: 'search',
      status: 'queued',
      stage: 'Preparing search',
      progress: { completed: 0, total: script.length },
      events: [],
      createdAt: now(),
      updatedAt: now(),
      _startedAt: Date.now(),
      _script: script,
      searchResult: this.buildSearchResult(request),
    }
    this.jobs.set(jobId, job)
    return { jobId }
  }

  private buildSearchResult(request: SearchRequest): SearchResult {
    const origin = { lat: request.origin.lat, lng: request.origin.lng }
    const radiusMeters = request.radiusKm * 1000

    const withDistance: Listing[] = SAMPLE_LISTINGS.map((l) => {
      const distanceMeters = l.coordinates ? haversineMeters(origin, l.coordinates) : undefined
      return { ...l, distanceMeters }
    })

    const inRadius = withDistance.filter((l) => l.distanceMeters !== undefined && l.distanceMeters <= radiusMeters)

    const filtered = inRadius.filter((l) => {
      if (request.roomTypes.length > 0 && !request.roomTypes.includes(l.roomType)) return false
      const cost = headlineCostCents(l)
      return withinBudget(cost, request.maxMonthlyCostCents ?? null, request.includeUnknownPrices)
    })

    // Transparent ranking: availability evidence first, then distance. No opaque score.
    const rankOrder: Record<Listing['availability'], number> = {
      offer_reported: 0,
      applications_open: 1,
      waitlist: 2,
      unknown: 3,
      unavailable: 4,
    }
    const ranked = [...filtered].sort((a, b) => {
      const byAvail = rankOrder[a.availability] - rankOrder[b.availability]
      if (byAvail !== 0) return byAvail
      return (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity)
    })

    const listings = ranked.map((l) => ({
      ...l,
      matchFactors: buildMatchFactors(l, request),
    }))

    const counts: SearchCounts = {
      residences: listings.filter((l) => l.scope === 'residence').length,
      rooms: listings.filter((l) => l.scope === 'room').length,
      offerReported: listings.filter((l) => l.availability === 'offer_reported').length,
      applicationsOpen: listings.filter((l) => l.availability === 'applications_open').length,
      waitlist: listings.filter((l) => l.availability === 'waitlist').length,
      unavailable: listings.filter((l) => l.availability === 'unavailable').length,
      availabilityUnknown: listings.filter((l) => l.availability === 'unknown').length,
      priceUnknown: listings.filter((l) => headlineCostCents(l) === null).length,
    }

    return {
      listings,
      counts,
      providers: [
        {
          name: 'Generated sample data (mock transport)',
          status: 'ok',
          note: 'No real provider was contacted. Start apps/api with live credentials to run a real search.',
          retrievedAt: now(),
        },
        {
          name: 'Live housing providers',
          status: 'skipped',
          note: 'The Homi server is not running, so no provider page was fetched.',
        },
      ],
      // Never "live". The banner and the results header both say Saved discovery.
      freshness: 'saved',
      retrievedAt: now(),
      incomplete: true,
      incompleteReason: 'Sample data only. No live provider source was queried in this session.',
    }
  }

  /* ------------------------------------------------------------------ jobs */

  async getJob(jobId: string): Promise<JobEnvelope> {
    const job = this.jobs.get(jobId)
    if (!job) throw new ApiError('job_not_found', 'That job no longer exists. Start the search again.', false, 404)
    if (job._cancelled) return stripInternals({ ...job, status: 'cancelled', stage: 'Cancelled' })

    const elapsed = Date.now() - job._startedAt
    const due = job._script.filter((s) => s.atMs <= elapsed)
    job.events = due.map((s, i) => ({
      id: `${jobId}-e${i}`,
      jobId,
      agent: s.agent,
      status: s.status,
      summary: s.summary,
      sourceRefs: s.sourceRefs,
      createdAt: new Date(job._startedAt + s.atMs).toISOString(),
    }))
    job.progress = { completed: due.length, total: job._script.length }
    job.stage = due.at(-1)?.stage ?? job.stage
    job.status = due.length === 0 ? 'queued' : due.length < job._script.length ? 'running' : 'partial'
    job.updatedAt = now()

    if (due.length === job._script.length) {
      // "partial" not "succeeded": sample data is never a complete result.
      job.status = job.type === 'search' ? 'partial' : 'succeeded'
      if (job.type === 'analysis' || job.type === 'move_out_review') {
        const tenancyId = job.tenancyId
        if (tenancyId && this.state.tenancies[tenancyId]) {
          const t = this.state.tenancies[tenancyId]
          if (t.status === 'analysis_running') {
            this.state.tenancies[tenancyId] = { ...t, status: 'ready', updatedAt: now() }
            this.persist()
          }
        }
      }
    }
    return stripInternals(job)
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId)
    if (job) job._cancelled = true
  }

  /* -------------------------------------------------------------- listings */

  async getListing(listingId: string): Promise<ListingDetail> {
    const listing = SAMPLE_LISTINGS.find((l) => l.id === listingId)
    if (!listing) throw new ApiError('listing_not_found', 'That listing is not in the sample catalogue.', false, 404)
    const demoLink = SAMPLE_SLOTS.find((s) => s.listingId === listingId) ?? null
    return { listing, demoLink }
  }

  /* --------------------------------------------------------------- contact */

  async createContactDraft(input: ContactDraftInput): Promise<ContactDraft> {
    const { listing } = await this.getListing(input.listingId)
    const contact = listing.contact
    const route: ContactDraft['route'] =
      contact?.email
        ? { kind: 'mailto', url: `mailto:${contact.email}`, label: `Email ${contact.organisation ?? 'the housing office'}`, sourceRefs: contact.sourceRefs }
        : contact?.url
          ? { kind: 'application_page', url: contact.url, label: 'Open the official application page', sourceRefs: contact.sourceRefs ?? [] }
          : { kind: 'provider_page', url: listing.canonicalUrl, label: 'Open the provider page', sourceRefs: listing.sourceRefs }

    const de = input.language === 'de'
    const draft: ContactDraft = {
      id: uid('draft'),
      listingId: listing.id,
      status: 'draft',
      subject: de ? `Anfrage zu einem Zimmer - ${listing.title}` : `Enquiry about a room - ${listing.title}`,
      body: buildContactBody(input, listing, de),
      route,
      createdAt: now(),
    }
    this.state.drafts[draft.id] = draft
    this.persist()
    return draft
  }

  async markContactHandoff(draftId: string): Promise<ContactDraft> {
    const draft = this.state.drafts[draftId]
    if (!draft) throw new ApiError('draft_not_found', 'That draft no longer exists.', false, 404)
    // "external_handoff" records only that the route was opened - never that it was sent.
    const updated: ContactDraft = { ...draft, status: 'external_handoff' }
    this.state.drafts[draftId] = updated
    this.persist()
    return updated
  }

  /* ---------------------------------------------------------- demo tenancy */

  async createDemoTenancy(input: { listingId: string; slotId: string }): Promise<Tenancy> {
    const existing = Object.values(this.state.tenancies).find(
      (t) => t.listingId === input.listingId && t.status !== 'closed',
    )
    // Idempotent by listing: a second click reuses the open tenancy, never duplicates it.
    if (existing) {
      return existing.acceptance
        ? existing
        : this.acceptDemoTenancy(existing.id, `auto-accept:${existing.id}`)
    }

    const slot = SAMPLE_SLOTS.find((s) => s.slotId === input.slotId)
    if (!slot) throw new ApiError('slot_not_found', 'That demo slot does not exist.', false, 404)
    if (slot.listingId !== input.listingId) {
      throw new ApiError('slot_mismatch', 'That demo slot is bound to a different listing. The binding is not reassigned.', false, 409)
    }

    const acceptedAt = now()
    const tenancy: Tenancy = {
      id: uid('ten'),
      listingId: input.listingId,
      mode: 'demo',
      status: slot.documentId ? 'policy_linked' : 'accepted_demo',
      contactStatus: null,
      acceptance: {
        acceptedAt,
        actor: 'demo_host',
        note: 'Automatically simulated by the demo host. No real provider was contacted and no real provider responded.',
      },
      // Immutable snapshot: a later remap of the slot does not rewrite this.
      policyBinding: { ...slot },
      documentId: slot.documentId,
      documentVersion: slot.documentVersion,
      moveInDate: null,
      moveOutDate: null,
      datesConfirmed: false,
      tenancyType: 'student_residence_549_3',
      classificationStatus: 'probable',
      classificationEvidence: [],
      registration: null,
      createdAt: acceptedAt,
      updatedAt: acceptedAt,
    }
    this.state.tenancies[tenancy.id] = tenancy
    this.state.acceptedKeys[tenancy.id] = `auto-accept:${tenancy.id}`
    this.persist()
    return tenancy
  }

  async acceptDemoTenancy(tenancyId: string, idempotencyKey: string): Promise<Tenancy> {
    const tenancy = this.requireTenancy(tenancyId)
    const seen = this.state.acceptedKeys[tenancyId]
    if (seen === idempotencyKey && tenancy.acceptance) return tenancy
    if (tenancy.acceptance) return tenancy

    const updated: Tenancy = {
      ...tenancy,
      status: tenancy.documentId ? 'policy_linked' : 'accepted_demo',
      acceptance: {
        acceptedAt: now(),
        actor: 'demo_host',
        note: 'Simulated by the demo host control. No real provider was contacted and no real provider responded.',
      },
      tenancyType: 'student_residence_549_3',
      classificationStatus: 'probable',
      updatedAt: now(),
    }
    this.state.tenancies[tenancyId] = updated
    this.state.acceptedKeys[tenancyId] = idempotencyKey
    this.persist()
    return updated
  }

  async resetDemoTenancy(tenancyId: string): Promise<Tenancy> {
    const tenancy = this.requireTenancy(tenancyId)
    const updated: Tenancy = {
      ...tenancy,
      status: 'application_prepared',
      acceptance: null,
      moveInDate: null,
      moveOutDate: null,
      datesConfirmed: false,
      updatedAt: now(),
    }
    this.state.tenancies[tenancyId] = updated
    delete this.state.acceptedKeys[tenancyId]
    delete this.state.analysisKeys[tenancyId]
    delete this.state.tasks[tenancyId]
    this.persist()
    return updated
  }

  /* -------------------------------------------------------------- analysis */

  async analyzeTenancy(tenancyId: string, idempotencyKey: string): Promise<{ jobId: string }> {
    const tenancy = this.requireTenancy(tenancyId)
    if (!tenancy.acceptance) {
      throw new ApiError('not_accepted', 'The demo application has not been accepted yet.', false, 409)
    }
    if (!tenancy.documentId) {
      throw new ApiError(
        'awaiting_document',
        'This demo slot has no policy document yet, so there is nothing to analyse.',
        true,
        409,
      )
    }
    // Same key while a job is alive -> reuse it. No duplicate analysis jobs.
    const existingJobId = this.state.analysisKeys[tenancyId]
    if (existingJobId?.startsWith(idempotencyKey) && this.jobs.has(existingJobId.split('::')[1] ?? '')) {
      return { jobId: existingJobId.split('::')[1] as string }
    }

    const jobId = uid('job')
    const script: ScriptStep[] = [
      { atMs: 300, agent: 'orchestrator', status: 'started', summary: 'Opening the document version bound to this tenancy', stage: 'Opening document', sourceRefs: [] },
      { atMs: 1100, agent: 'policy_analyst', status: 'progress', summary: 'Reading section 3 - rent and payment', stage: 'Reading the whole document', sourceRefs: [] },
      { atMs: 1900, agent: 'policy_analyst', status: 'progress', summary: 'Reading section 5 - deposit', stage: 'Reading the whole document', sourceRefs: [] },
      { atMs: 2600, agent: 'policy_analyst', status: 'progress', summary: 'Reading section 10 - return of the room', stage: 'Reading the whole document', sourceRefs: [] },
      { atMs: 3200, agent: 'policy_analyst', status: 'succeeded', summary: '11 of 11 sections read; Annex 1 was referenced but not supplied', stage: 'Reconciling extraction', sourceRefs: [] },
      { atMs: 4000, agent: 'legal_reviewer', status: 'progress', summary: 'Checking the deposit clause against BGB §551', stage: 'Legal review', sourceRefs: [] },
      { atMs: 4700, agent: 'legal_reviewer', status: 'progress', summary: 'Classifying the tenancy under BGB §549(3)', stage: 'Legal review', sourceRefs: [] },
      { atMs: 5300, agent: 'lifecycle_planner', status: 'progress', summary: 'Preparing the handover checklist', stage: 'Planning move-in', sourceRefs: [] },
      { atMs: 5900, agent: 'evidence_gate', status: 'succeeded', summary: 'Citations resolved; deposit arithmetic checked in integer cents', stage: 'Complete', sourceRefs: [] },
    ]
    const job: MockJob = {
      id: jobId,
      tenancyId,
      type: 'analysis',
      status: 'queued',
      stage: 'Opening document',
      progress: { completed: 0, total: script.length },
      events: [],
      createdAt: now(),
      updatedAt: now(),
      _startedAt: Date.now(),
      _script: script,
    }
    this.jobs.set(jobId, job)
    this.state.analysisKeys[tenancyId] = `${idempotencyKey}::${jobId}`
    this.state.tenancies[tenancyId] = { ...tenancy, status: 'analysis_running', updatedAt: now() }
    if (!this.state.tasks[tenancyId]) {
      this.state.tasks[tenancyId] = FIXTURE_TASKS.map((t) => ({ ...t, tenancyId }))
    }
    this.persist()
    return { jobId }
  }

  /* ------------------------------------------------------------- workspace */

  async getTenancy(tenancyId: string): Promise<TenancyWorkspace> {
    const tenancy = this.requireTenancy(tenancyId)
    const { listing } = await this.getListing(tenancy.listingId)
    const hasDoc = Boolean(tenancy.documentId)
    const analysisDone = tenancy.status === 'ready' || tenancy.status === 'move_in' || tenancy.status === 'living' || tenancy.status === 'move_out'

    return {
      tenancy,
      listing,
      document: hasDoc ? FIXTURE_DOCUMENT : null,
      analysis: !hasDoc
        ? {
            status: 'awaiting_document',
            coverage: null,
            failureReason: 'No policy document has been imported for this reserved slot yet.',
          }
        : tenancy.status === 'analysis_running'
          ? { status: 'running', coverage: null, stage: 'Reading the whole document' }
          : analysisDone
            ? FIXTURE_ANALYSIS
            : { status: 'not_started', coverage: null },
      findings: analysisDone ? FIXTURE_FINDINGS.map((f) => ({ ...f, tenancyId })) : [],
      legal: analysisDone ? FIXTURE_LEGAL_STATUS : { status: 'not_started', unavailableSources: [], checkedTopics: [] },
      legalFindings: analysisDone ? FIXTURE_LEGAL_FINDINGS.map((f) => ({ ...f, tenancyId })) : [],
      costs: analysisDone ? FIXTURE_COSTS : null,
      deposit: analysisDone ? this.buildDeposit(tenancyId) : null,
      tasks: this.state.tasks[tenancyId] ?? [],
      evidence: this.state.evidence[tenancyId] ?? [],
      activeJob: null,
    }
  }

  private buildDeposit(tenancyId: string) {
    const claims = this.state.claims[tenancyId] ?? []
    return {
      ...FIXTURE_DEPOSIT,
      claimedDeductions: claims.map((c, i) => ({
        id: `claim-${i}`,
        label: c.label,
        amountCents: c.amountCents,
        status: 'claimed' as const,
        providerStatement: c.providerStatement || null,
        counterEvidenceIds: [],
        sourceRefs: [],
      })),
    }
  }

  async askQuestion(tenancyId: string, question: string): Promise<CitedAnswer> {
    const tenancy = this.requireTenancy(tenancyId)
    if (!tenancy.documentId) {
      throw new ApiError('awaiting_document', 'There is no document bound to this tenancy yet.', false, 409)
    }
    // Scope is fixed server-side by tenancy. A question cannot reach another document.
    const q = question.toLowerCase()
    const match = FIXTURE_FINDINGS.find((f) =>
      [f.title, f.explanation, f.topic].join(' ').toLowerCase().includes(q.split(/\s+/).filter((w) => w.length > 3)[0] ?? '~~'),
    )
    const answer: CitedAnswer = match
      ? {
          id: uid('ans'),
          question,
          answer: match.explanation,
          sourceRefs: match.sourceRefs,
          notSpecified: match.certainty === 'unknown',
          createdAt: now(),
        }
      : {
          id: uid('ans'),
          question,
          answer: 'Not specified in the supplied document. Nothing in this lease answers that, and Homi will not fill the gap from another building\'s agreement or from a typical German tenancy.',
          sourceRefs: [],
          notSpecified: true,
          createdAt: now(),
        }
    this.state.answers[tenancyId] = [...(this.state.answers[tenancyId] ?? []), answer]
    this.persist()
    return answer
  }

  async updateDates(tenancyId: string, patch: DatesPatch): Promise<TenancyWorkspace> {
    const tenancy = this.requireTenancy(tenancyId)
    const confirmed = Boolean(patch.moveInDate)
    const updated: Tenancy = {
      ...tenancy,
      moveInDate: patch.moveInDate,
      moveOutDate: patch.moveOutDate,
      datesConfirmed: confirmed,
      registration: patch.registration ?? tenancy.registration ?? null,
      status: confirmed && tenancy.status === 'ready' ? 'move_in' : tenancy.status,
      updatedAt: now(),
    }
    this.state.tenancies[tenancyId] = updated
    this.state.tasks[tenancyId] = regenerateTaskDates(
      this.state.tasks[tenancyId] ?? FIXTURE_TASKS.map((t) => ({ ...t, tenancyId })),
      updated,
    )
    this.persist()
    return this.getTenancy(tenancyId)
  }

  async updateTask(tenancyId: string, taskId: string, patch: TaskPatch): Promise<ChecklistTask> {
    this.requireTenancy(tenancyId)
    const tasks = this.state.tasks[tenancyId] ?? []
    const index = tasks.findIndex((t) => t.id === taskId)
    if (index === -1) throw new ApiError('task_not_found', 'That task does not belong to this tenancy.', false, 404)
    const updated = { ...tasks[index], ...patch, changeNotice: null }
    tasks[index] = updated
    this.state.tasks[tenancyId] = [...tasks]
    this.persist()
    return updated
  }

  /* -------------------------------------------------------------- evidence */

  async addEvidence(tenancyId: string, input: EvidenceInput): Promise<EvidenceItem> {
    this.requireTenancy(tenancyId)
    const id = uid('ev')
    const storageKey = `${tenancyId}/${id}`
    if (input.file) await putBlob(storageKey, input.file)
    const item: EvidenceItem = {
      id,
      tenancyId,
      roomOrItem: input.roomOrItem,
      mediaType: input.file?.type ?? 'text/plain',
      storageKey,
      uploadedAt: now(),
      capturedAtStated: input.capturedAtStated,
      note: input.note || null,
      phase: input.phase,
      comparisonIds: input.comparisonIds ?? [],
      byteSize: input.file?.size,
    }
    this.state.evidence[tenancyId] = [...(this.state.evidence[tenancyId] ?? []), item]
    this.persist()
    return item
  }

  async getEvidenceObjectUrl(tenancyId: string, evidenceId: string): Promise<string | null> {
    const items = this.state.evidence[tenancyId] ?? []
    const item = items.find((e) => e.id === evidenceId)
    // Ownership check: an evidence id from another tenancy resolves to nothing.
    if (!item) return null
    const blob = await getBlob(item.storageKey)
    return blob ? URL.createObjectURL(blob) : null
  }

  /* -------------------------------------------------------------- move-out */

  async startMoveOutReview(tenancyId: string, claims: MoveOutClaimInput[]): Promise<{ jobId: string }> {
    this.requireTenancy(tenancyId)
    this.state.claims[tenancyId] = claims
    const jobId = uid('job')
    const script: ScriptStep[] = [
      { atMs: 300, agent: 'orchestrator', status: 'started', summary: 'Loading the confirmed dates and obligations', stage: 'Preparing review', sourceRefs: [] },
      { atMs: 1100, agent: 'lifecycle_planner', status: 'progress', summary: 'Comparing move-in notes with move-out notes', stage: 'Comparing evidence', sourceRefs: [] },
      { atMs: 1900, agent: 'legal_reviewer', status: 'progress', summary: 'Checking the repainting charge against BGB §538', stage: 'Checking claims', sourceRefs: [] },
      { atMs: 2600, agent: 'evidence_gate', status: 'succeeded', summary: 'Claims recorded as claimed, not as agreed. No deduction was invented.', stage: 'Complete', sourceRefs: [] },
    ]
    this.jobs.set(jobId, {
      id: jobId,
      tenancyId,
      type: 'move_out_review',
      status: 'queued',
      stage: 'Preparing review',
      progress: { completed: 0, total: script.length },
      events: [],
      createdAt: now(),
      updatedAt: now(),
      _startedAt: Date.now(),
      _script: script,
    })
    this.state.tenancies[tenancyId] = { ...this.requireTenancy(tenancyId), status: 'move_out', updatedAt: now() }
    this.persist()
    return { jobId }
  }

  /* ---------------------------------------------------------------- admin  */

  async deleteTenancy(tenancyId: string): Promise<void> {
    this.requireTenancy(tenancyId)
    await deleteBlobsWithPrefix(`${tenancyId}/`)
    delete this.state.tenancies[tenancyId]
    delete this.state.tasks[tenancyId]
    delete this.state.evidence[tenancyId]
    delete this.state.answers[tenancyId]
    delete this.state.claims[tenancyId]
    delete this.state.acceptedKeys[tenancyId]
    delete this.state.analysisKeys[tenancyId]
    this.persist()
    if (Object.keys(this.state.tenancies).length === 0) clearState()
  }

  async listTenancies(): Promise<Tenancy[]> {
    return Object.values(this.state.tenancies).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  private requireTenancy(tenancyId: string): Tenancy {
    const tenancy = this.state.tenancies[tenancyId]
    if (!tenancy) {
      throw new ApiError('tenancy_not_found', 'That tenancy is not in this session.', false, 404)
    }
    return tenancy
  }
}

/* ---------------------------------------------------------------- helpers */

function stripInternals(job: MockJob): JobEnvelope {
  const { _startedAt, _script, _cancelled, ...rest } = job
  void _startedAt
  void _script
  void _cancelled
  return rest
}

/** The figure a card headlines, respecting the stated cost basis. Null stays null. */
export function headlineCostCents(listing: Listing): number | null {
  const c = listing.monthlyCost
  if (!c) return null
  if (c.basis === 'warm') return c.warmmieteCents
  if (c.basis === 'kalt') return c.kaltmieteCents
  return null
}

function buildMatchFactors(listing: Listing, request: SearchRequest) {
  const factors: { label: string; detail: string }[] = []
  const d = formatDistance(listing.distanceMeters)
  if (d) factors.push({ label: 'Distance', detail: `${d} straight line from ${request.origin.label}` })
  if (listing.availability === 'offer_reported') {
    factors.push({ label: 'Availability', detail: 'A source reported an offer, with the date it was observed' })
  } else if (listing.availability === 'applications_open') {
    factors.push({ label: 'Availability', detail: 'Applications open - this is not a room offer' })
  }
  const cost = headlineCostCents(listing)
  if (cost === null) {
    factors.push({ label: 'Price', detail: 'No price published, so it was not compared against your budget' })
  } else if (request.maxMonthlyCostCents) {
    factors.push({
      label: 'Budget',
      detail: cost <= request.maxMonthlyCostCents ? 'Within your stated budget' : 'Above your stated budget',
    })
  }
  if (listing.demoPolicySlotId) {
    factors.push({ label: 'Demo', detail: 'Paired with a fictional sample lease for demonstration' })
  }
  return factors
}

function buildContactBody(input: ContactDraftInput, listing: Listing, de: boolean): string {
  const moveIn = input.moveInDate ?? (de ? '[Datum bitte ergänzen]' : '[please add a date]')
  const duration = input.durationMonths ? `${input.durationMonths}` : de ? '[Dauer]' : '[duration]'
  if (de) {
    return [
      `Sehr geehrte Damen und Herren,`,
      ``,
      `ich interessiere mich für ein Zimmer in ${listing.title}.`,
      `Ich studiere ${input.studyProgramme || '[Studiengang]'} und suche eine Unterkunft ab ${moveIn} für ${duration} Monate.`,
      input.notes ? `` : null,
      input.notes || null,
      ``,
      `Könnten Sie mir bitte mitteilen, ob ein Zimmer verfügbar ist und welche Unterlagen Sie benötigen?`,
      ``,
      `Mit freundlichen Grüßen`,
      input.studentName || '[Name]',
    ]
      .filter((l) => l !== null)
      .join('\n')
  }
  return [
    `Dear Sir or Madam,`,
    ``,
    `I am interested in a room at ${listing.title}.`,
    `I am studying ${input.studyProgramme || '[study programme]'} and I am looking for accommodation from ${moveIn} for ${duration} months.`,
    input.notes ? `` : null,
    input.notes || null,
    ``,
    `Could you let me know whether a room is available and which documents you need from me?`,
    ``,
    `Kind regards,`,
    input.studentName || '[your name]',
  ]
    .filter((l) => l !== null)
    .join('\n')
}

/**
 * Recompute task dates from the confirmed dates. A task whose date cannot be derived
 * keeps dueDate: null and states why - no invented calendar deadlines (brief section 15).
 */
function regenerateTaskDates(tasks: ChecklistTask[], tenancy: Tenancy): ChecklistTask[] {
  const moveIn = tenancy.moveInDate
  const moveOut = tenancy.moveOutDate
  const actualMoveIn = tenancy.registration?.actualMoveInDate ?? moveIn

  return tasks.map((task) => {
    const previous = task.dueDate
    let dueDate: string | null = null
    let blocked: string | null = task.dueDateBlockedReason ?? null

    if (task.phase === 'move_in') {
      if (task.id === 'task-register') {
        // BMG §17: two weeks from ACTUAL move-in, not from signing.
        dueDate = addDaysOrNull(actualMoveIn, 14)
        blocked = dueDate ? null : 'Needs the date you actually move in.'
      } else if (task.id === 'task-dates') {
        dueDate = null
        blocked = 'The document does not state a calendar start date. Confirm it with the provider.'
      } else {
        dueDate = moveIn
        blocked = dueDate ? null : 'Depends on the confirmed move-in date.'
      }
    } else if (task.phase === 'move_out') {
      if (task.id === 'task-mo-notice') {
        // The contract states three months before the end of the fixed term.
        dueDate = addDaysOrNull(moveOut, -92)
        blocked = dueDate ? null : 'Needs the confirmed contract end date.'
      } else {
        dueDate = moveOut
        blocked = dueDate ? null : 'Needs the confirmed move-out date.'
      }
    }

    const changed = previous !== dueDate && (previous !== null || dueDate !== null)
    return {
      ...task,
      dueDate,
      dueDateBlockedReason: blocked,
      changeNotice: changed && task.status !== 'done' ? 'Date updated after you changed the tenancy dates.' : task.changeNotice ?? null,
    }
  })
}
