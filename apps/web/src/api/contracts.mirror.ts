/**
 * ============================================================================
 * TEMPORARY LOCAL MIRROR of `packages/contracts`, which is treated as read-only here.
 * ============================================================================
 *
 * `packages/contracts` did not exist when this frontend was built, so these Zod
 * schemas mirror the agreed API contract exactly.
 *
 * ONCE packages/contracts IS AVAILABLE:
 *   1. Replace this file's body with `export * from '@mainhaus/contracts'`.
 *   2. Run `pnpm --dir apps/web typecheck` - every divergence surfaces as a type error.
 *   3. Reconcile any divergence in the shared schema before relying on it.
 *
 * Rules encoded here that the UI depends on:
 *   - Money is integer cents or null. `null` means UNKNOWN and must never render as 0.
 *   - Dates are ISO strings. Display uses Europe/Berlin semantics (see lib/dates.ts).
 *   - Every displayed material fact carries sourceRefs + a timestamp.
 *   - contractVersion is frozen at "1"; extensions must be additive.
 */
import { z } from 'zod'

export const CONTRACT_VERSION = '1' as const

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

/** Integer cents, or null for "unknown". Never coerce null to 0. */
export const MoneyCents = z.number().int().nullable()
export const IsoDateTime = z.string().min(4)
/** Calendar date, no time-of-day. Interpreted in Europe/Berlin. */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const Coordinates = z.object({ lat: z.number(), lng: z.number() })
export type Coordinates = z.infer<typeof Coordinates>

export const LocationPrecision = z.enum([
  'exact', // provider published this coordinate or address
  'approximate', // geocoded from a street/address, render with an uncertainty ring
  'area_only', // only a district is known
  'unknown',
])
export type LocationPrecision = z.infer<typeof LocationPrecision>

/**
 * Allowed availability values (brief section 12). A reported offer retains its source
 * date and is NEVER an assurance that the room remains available.
 */
export const Availability = z.enum([
  'offer_reported',
  'applications_open',
  'waitlist',
  'unavailable',
  'unknown',
])
export type Availability = z.infer<typeof Availability>

export const RoomType = z.enum(['single_apartment', 'room_in_shared_flat', 'studio', 'couple_apartment', 'unknown'])
export type RoomType = z.infer<typeof RoomType>

/* -------------------------------------------------------------------------- */
/* SourceRef - provenance for every material fact                              */
/* -------------------------------------------------------------------------- */

export const SourceRef = z.object({
  id: z.string(),
  kind: z.enum(['webpage', 'document', 'statute', 'user_evidence']),
  url: z.string().url().optional(),
  documentId: z.string().optional(),
  version: z.string().optional(),
  page: z.number().int().positive().optional(),
  section: z.string().optional(),
  excerpt: z.string().optional(),
  retrievedAt: IsoDateTime.optional(),
  /** Human label, e.g. "Studierendenwerk Frankfurt - residence directory" or "BGB §551". */
  label: z.string().optional(),
})
export type SourceRef = z.infer<typeof SourceRef>

/* -------------------------------------------------------------------------- */
/* Search + Listing                                                            */
/* -------------------------------------------------------------------------- */

export const SearchOrigin = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string(),
  /** How the student set this origin - shown back to them so it is never a mystery. */
  source: z.enum(['geolocation', 'pin', 'address', 'campus']).optional(),
})
export type SearchOrigin = z.infer<typeof SearchOrigin>

export const SearchRequest = z.object({
  origin: SearchOrigin,
  radiusKm: z.number().positive().max(50),
  /**
   * Budget ceiling. The UI always states the cost basis this is compared against
   * (see `monthlyCostBasis` on Listing) - a Kaltmiete budget is not a Warmmiete budget.
   */
  maxMonthlyCostCents: z.number().int().positive().nullable().optional(),
  roomTypes: z.array(RoomType).default([]),
  moveInDate: IsoDate.nullable().optional(),
  /** Unknown prices do NOT count as within budget unless the student opts in. */
  includeUnknownPrices: z.boolean().default(true),
})
export type SearchRequest = z.infer<typeof SearchRequest>

export const MonthlyCost = z.object({
  /** Cold rent - rent excluding operating costs. */
  kaltmieteCents: MoneyCents,
  /** Operating-cost component (Nebenkosten), advance or flat charge. */
  nebenkostenCents: MoneyCents,
  /** Warm rent as STATED by the source. Not computed by the UI. */
  warmmieteCents: MoneyCents,
  /** Which figure the card headline shows, so a budget comparison is honest. */
  basis: z.enum(['kalt', 'warm', 'unknown']),
  currency: z.literal('EUR').default('EUR'),
  /** Components the source did not state. Rendered as "not stated", never as 0. */
  unknownComponents: z.array(z.string()).default([]),
  sourceRefs: z.array(SourceRef).default([]),
})
export type MonthlyCost = z.infer<typeof MonthlyCost>

export const ListingContact = z.object({
  /** A letting agent or dorm operator is not necessarily the legal owner. Label it. */
  role: z.enum(['provider_office', 'operator', 'letting_agent', 'application_portal', 'unknown']),
  organisation: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  /** Official listing / application page, used when no direct contact is published. */
  url: z.string().url().nullable(),
  sourceRefs: z.array(SourceRef).default([]),
})
export type ListingContact = z.infer<typeof ListingContact>

export const AvailabilityEvidence = z.object({
  statement: z.string(),
  observedAt: IsoDateTime,
  sourceRefs: z.array(SourceRef).default([]),
})
export type AvailabilityEvidence = z.infer<typeof AvailabilityEvidence>

export const ListingPhoto = z.object({
  url: z.string().url(),
  /** Required attribution string. If this is absent the photo is NOT rendered. */
  attribution: z.string(),
  attributionUrl: z.string().url().optional(),
})
export type ListingPhoto = z.infer<typeof ListingPhoto>

export const Listing = z.object({
  id: z.string(),
  provider: z.string(),
  externalId: z.string().optional(),
  canonicalUrl: z.string().url(),
  title: z.string(),
  /** A residence is a building; a room is an individual offer inside it. Never conflate. */
  scope: z.enum(['residence', 'room']),
  address: z.string().optional(),
  coordinates: Coordinates.optional(),
  locationPrecision: LocationPrecision,
  /** Straight-line distance. Call it "distance", never "travel time". */
  distanceMeters: z.number().nonnegative().optional(),
  availability: Availability,
  availabilityEvidence: AvailabilityEvidence.optional(),
  monthlyCost: MonthlyCost.optional(),
  roomType: RoomType.default('unknown'),
  contact: ListingContact.optional(),
  photos: z.array(ListingPhoto).default([]),
  sourceRefs: z.array(SourceRef).default([]),
  checkedAt: IsoDateTime,
  /** Present only when this real record is bound to a reserved fictional policy slot. */
  demoPolicySlotId: z.string().nullable().optional(),
  /** Transparent ranking factors. The UI explains the match, it does not invent a score. */
  matchFactors: z.array(z.object({ label: z.string(), detail: z.string() })).default([]),
})
export type Listing = z.infer<typeof Listing>

/**
 * Counts must be literal (brief section 5):
 * "12 residences found; 2 source-reported offers; availability unknown for 10."
 */
export const SearchCounts = z.object({
  residences: z.number().int().nonnegative(),
  rooms: z.number().int().nonnegative(),
  offerReported: z.number().int().nonnegative(),
  applicationsOpen: z.number().int().nonnegative(),
  waitlist: z.number().int().nonnegative(),
  unavailable: z.number().int().nonnegative(),
  availabilityUnknown: z.number().int().nonnegative(),
  priceUnknown: z.number().int().nonnegative(),
})
export type SearchCounts = z.infer<typeof SearchCounts>

export const SearchResult = z.object({
  listings: z.array(Listing),
  counts: SearchCounts,
  /** Providers actually queried, with per-provider outcome. Outages are visible. */
  providers: z.array(
    z.object({
      name: z.string(),
      url: z.string().url().optional(),
      status: z.enum(['ok', 'partial', 'unavailable', 'skipped']),
      note: z.string().optional(),
      retrievedAt: IsoDateTime.optional(),
    }),
  ),
  /** "live" = fetched now. "saved" = replayed record, labelled "Saved discovery". */
  freshness: z.enum(['live', 'saved']),
  retrievedAt: IsoDateTime,
  /** True when the search could not reach every intended source. */
  incomplete: z.boolean().default(false),
  incompleteReason: z.string().optional(),
})
export type SearchResult = z.infer<typeof SearchResult>

/* -------------------------------------------------------------------------- */
/* Demo policy binding - explicit fiction, never a claim about a real property  */
/* -------------------------------------------------------------------------- */

export const DemoPolicyLink = z.object({
  slotId: z.string(),
  listingId: z.string().nullable(),
  policyId: z.string(),
  documentId: z.string().nullable(),
  documentVersion: z.string().nullable(),
  relation: z.literal('fictional_demo'),
  status: z.enum(['unbound', 'awaiting_document', 'ready', 'retired']),
  /** A remap creates a new mapping version; existing tenancies keep their binding. */
  mappingVersion: z.string().optional(),
  boundAt: IsoDateTime.nullable().optional(),
})
export type DemoPolicyLink = z.infer<typeof DemoPolicyLink>

export const DemoCatalogStatus = z.object({
  totalSlots: z.literal(20),
  boundListings: z.number().int().min(0).max(20),
  ingestedDocuments: z.number().int().min(0).max(20),
  readySlots: z.number().int().min(0).max(20),
  links: z.array(DemoPolicyLink),
})
export type DemoCatalogStatus = z.infer<typeof DemoCatalogStatus>

/* -------------------------------------------------------------------------- */
/* Document                                                                    */
/* -------------------------------------------------------------------------- */

export const DocumentCoverage = z.object({
  unitsTotal: z.number().int().nonnegative(),
  unitsRead: z.number().int().nonnegative(),
  unit: z.enum(['page', 'section']),
})
export type DocumentCoverage = z.infer<typeof DocumentCoverage>

export const PolicyDocument = z.object({
  id: z.string(),
  policyId: z.string().optional(),
  tenancyId: z.string().optional(),
  mode: z.enum(['demo', 'user_supplied']),
  /** Immutable content hash/version. Analysis is keyed to it. */
  version: z.string(),
  fileName: z.string(),
  mediaType: z.string(),
  pageOrSectionCount: z.number().int().nonnegative(),
  extractionStatus: z.enum(['pending', 'extracting', 'complete', 'partial', 'failed', 'ocr_required']),
  coverage: DocumentCoverage,
  /** Unreadable pages, missing annexes, referenced-but-not-supplied documents. */
  missingParts: z.array(z.object({ kind: z.string(), detail: z.string() })).default([]),
  failureReason: z.string().optional(),
})
export type PolicyDocument = z.infer<typeof PolicyDocument>

/* -------------------------------------------------------------------------- */
/* Tenancy                                                                     */
/* -------------------------------------------------------------------------- */

export const TenancyStatus = z.enum([
  'created',
  'application_prepared',
  'submitted_demo',
  'accepted_demo',
  'policy_linked',
  'analysis_running',
  'ready',
  'move_in',
  'living',
  'move_out',
  'closed',
])
export type TenancyStatus = z.infer<typeof TenancyStatus>

/** Real-contact workflow is kept strictly separate from the demo tenancy workflow. */
export const ContactStatus = z.enum(['draft', 'reviewed', 'external_handoff', 'awaiting_provider'])
export type ContactStatus = z.infer<typeof ContactStatus>

export const TenancyType = z.enum([
  'student_residence_549_3', // BGB §549(3) genuine student/youth residence
  'furnished_living_space',
  'standard_residential',
  'unclassified',
])
export type TenancyType = z.infer<typeof TenancyType>

export const Tenancy = z.object({
  id: z.string(),
  listingId: z.string(),
  mode: z.enum(['demo', 'user_supplied']),
  status: TenancyStatus,
  contactStatus: ContactStatus.nullable().optional(),
  acceptance: z
    .object({
      acceptedAt: IsoDateTime,
      /** Always "demo_host" here. Never a real provider. */
      actor: z.literal('demo_host'),
      note: z.string().optional(),
    })
    .nullable()
    .optional(),
  /** Immutable once set; a remap does not rewrite an existing tenancy's binding. */
  policyBinding: DemoPolicyLink.nullable(),
  documentId: z.string().nullable(),
  documentVersion: z.string().nullable(),
  moveInDate: IsoDate.nullable(),
  moveOutDate: IsoDate.nullable(),
  datesConfirmed: z.boolean().default(false),
  tenancyType: TenancyType,
  classificationStatus: z.enum(['confirmed', 'probable', 'insufficient_evidence']),
  classificationEvidence: z.array(SourceRef).default([]),
  /** Optional registration inputs - asked before applying BMG §27 exceptions. */
  registration: z
    .object({
      hasExistingGermanRegistration: z.boolean().nullable(),
      intendedStayMonths: z.number().int().positive().nullable(),
      actualMoveInDate: IsoDate.nullable(),
    })
    .nullable()
    .optional(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
})
export type Tenancy = z.infer<typeof Tenancy>

/* -------------------------------------------------------------------------- */
/* Findings                                                                    */
/* -------------------------------------------------------------------------- */

export const PolicyTopic = z.enum([
  'room_identity',
  'parties_and_type',
  'term_and_notice',
  'rent',
  'operating_costs',
  'deposit',
  'house_rules',
  'maintenance',
  'handover',
  'move_out_obligations',
  'other',
])
export type PolicyTopic = z.infer<typeof PolicyTopic>

export const PolicyFinding = z.object({
  id: z.string(),
  tenancyId: z.string(),
  documentId: z.string(),
  documentVersion: z.string(),
  topic: PolicyTopic,
  title: z.string(),
  /** Plain-English explanation. Kept distinct from the original clause. */
  explanation: z.string(),
  /** The original German clause text, preserved verbatim beside the explanation. */
  originalClause: z.string().nullable(),
  sourceRefs: z.array(SourceRef).default([]),
  /** "unknown" renders as "Not specified in the supplied document". */
  certainty: z.enum(['stated', 'derived', 'unknown']),
  action: z.string().nullable().optional(),
  dueDate: IsoDate.nullable().optional(),
  /** Links a deposit finding straight to its move-in photo/checklist task. */
  relatedTaskIds: z.array(z.string()).default([]),
})
export type PolicyFinding = z.infer<typeof PolicyFinding>

export const LegalFinding = z.object({
  id: z.string(),
  tenancyId: z.string(),
  policyFindingIds: z.array(z.string()).default([]),
  /** No synthetic "legality score", no definitive valid/invalid verdict. */
  severity: z.enum(['information', 'clarify', 'potential_conflict']),
  applicability: z.enum(['applies', 'may_apply', 'does_not_apply', 'applicability_uncertain']),
  applicabilityNote: z.string().optional(),
  title: z.string(),
  explanation: z.string(),
  /** The exact contract evidence this flag is about. */
  contractEvidence: z.array(SourceRef).default([]),
  /** The official legal source. A search snippet alone is not sufficient evidence. */
  legalEvidence: z.array(SourceRef).default([]),
  /** A question for the provider or a tenant adviser - not an instruction. */
  nextStep: z.string(),
})
export type LegalFinding = z.infer<typeof LegalFinding>

export const LegalReviewStatus = z.object({
  status: z.enum(['complete', 'partial', 'unavailable', 'not_started']),
  /** An unavailable legal source makes the legal section incomplete, not silently safe. */
  unavailableSources: z.array(z.object({ label: z.string(), reason: z.string() })).default([]),
  checkedTopics: z.array(z.string()).default([]),
  retrievedAt: IsoDateTime.optional(),
})
export type LegalReviewStatus = z.infer<typeof LegalReviewStatus>

/* -------------------------------------------------------------------------- */
/* Tasks + evidence                                                            */
/* -------------------------------------------------------------------------- */

export const ChecklistTask = z.object({
  id: z.string(),
  tenancyId: z.string(),
  phase: z.enum(['move_in', 'living', 'move_out']),
  title: z.string(),
  detail: z.string().optional(),
  dueDate: IsoDate.nullable(),
  /** Null dueDate + this reason = "no date yet", never an invented deadline. */
  dueDateBlockedReason: z.string().nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'not_applicable']),
  /** Contract obligation vs sourced legal guidance vs general practical advice. */
  basis: z.enum(['contract', 'legal_guidance', 'practical']),
  sourceRefs: z.array(SourceRef).default([]),
  evidenceIds: z.array(z.string()).default([]),
  /** Set when a date change regenerated or invalidated this task. */
  changeNotice: z.string().nullable().optional(),
})
export type ChecklistTask = z.infer<typeof ChecklistTask>

export const EvidenceItem = z.object({
  id: z.string(),
  tenancyId: z.string(),
  roomOrItem: z.string(),
  mediaType: z.string(),
  /** Server-side private storage key. There is NO public file URL. */
  storageKey: z.string(),
  /** When the server received it. This does NOT prove when the photo was taken. */
  uploadedAt: IsoDateTime,
  /** Optional, user-stated. Explicitly labelled as user-stated in the UI. */
  capturedAtStated: IsoDate.nullable().optional(),
  note: z.string().nullable(),
  phase: z.enum(['move_in', 'living', 'move_out']),
  /** Move-out item compared against the move-in item it answers. */
  comparisonIds: z.array(z.string()).default([]),
  byteSize: z.number().int().nonnegative().optional(),
})
export type EvidenceItem = z.infer<typeof EvidenceItem>

/* -------------------------------------------------------------------------- */
/* Costs + deposit                                                             */
/* -------------------------------------------------------------------------- */

export const CostBreakdown = z.object({
  /** Labelled "Known monthly costs" whenever components are excluded. */
  knownMonthlyTotalCents: MoneyCents,
  components: z.array(
    z.object({
      label: z.string(),
      germanTerm: z.string().optional(),
      amountCents: MoneyCents,
      cadence: z.enum(['monthly', 'once', 'annual', 'unknown']),
      /** advance (Vorauszahlung) vs flat charge (Pauschale) - BGB §556 distinction. */
      chargeKind: z.enum(['advance', 'flat_rate', 'direct', 'unknown']).optional(),
      sourceRefs: z.array(SourceRef).default([]),
    }),
  ),
  excludedComponents: z.array(z.object({ label: z.string(), reason: z.string() })).default([]),
  /** Refundable deposit is kept OUT of monthly spend. */
  depositCents: MoneyCents,
  depositInstalments: z
    .array(z.object({ label: z.string(), amountCents: MoneyCents, dueDate: IsoDate.nullable() }))
    .default([]),
  /** Only components whose timing is actually known. */
  initialCashCents: MoneyCents,
  initialCashComponents: z.array(z.object({ label: z.string(), amountCents: MoneyCents })).default([]),
  initialCashIncomplete: z.boolean().default(false),
})
export type CostBreakdown = z.infer<typeof CostBreakdown>

export const DepositLedger = z.object({
  originalDepositCents: MoneyCents,
  agreedDeductions: z.array(z.object({ id: z.string(), label: z.string(), amountCents: MoneyCents, sourceRefs: z.array(SourceRef).default([]) })).default([]),
  claimedDeductions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      amountCents: MoneyCents,
      /** Unresolved provider claim - never presented as settled. */
      status: z.enum(['claimed', 'disputed', 'accepted']),
      providerStatement: z.string().nullable(),
      counterEvidenceIds: z.array(z.string()).default([]),
      sourceRefs: z.array(SourceRef).default([]),
    }),
  ).default([]),
  returnedCents: MoneyCents,
  /** Remaining accounting balance. Null when any input is unknown. */
  remainingBalanceCents: MoneyCents,
  balanceIncomplete: z.boolean().default(false),
})
export type DepositLedger = z.infer<typeof DepositLedger>

/* -------------------------------------------------------------------------- */
/* Jobs + agent events                                                         */
/* -------------------------------------------------------------------------- */

export const AgentName = z.enum([
  'orchestrator',
  'housing_scout',
  'listing_verifier',
  'policy_analyst',
  'legal_reviewer',
  'lifecycle_planner',
  'evidence_gate',
])
export type AgentName = z.infer<typeof AgentName>

export const AgentEvent = z.object({
  id: z.string(),
  jobId: z.string(),
  agent: AgentName,
  status: z.enum(['started', 'progress', 'succeeded', 'failed', 'skipped', 'retrying']),
  /** A short observable summary: "Reading clause 8". Never a hidden reasoning trace. */
  summary: z.string(),
  sourceRefs: z.array(SourceRef).default([]),
  createdAt: IsoDateTime,
})
export type AgentEvent = z.infer<typeof AgentEvent>

export const AgentJob = z.object({
  id: z.string(),
  tenancyId: z.string().nullable().optional(),
  type: z.enum(['search', 'analysis', 'move_out_review']),
  status: z.enum(['queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled']),
  stage: z.string(),
  progress: z.object({ completed: z.number().int().nonnegative(), total: z.number().int().positive() }).nullable(),
  events: z.array(AgentEvent).default([]),
  resultRef: z.string().nullable().optional(),
  /** Sanitised - never contains raw lease text or provider secrets. */
  error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }).nullable().optional(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
})
export type AgentJob = z.infer<typeof AgentJob>

/** Search jobs carry a SearchResult; analysis jobs carry nothing extra here. */
export const JobEnvelope = AgentJob.extend({
  searchResult: SearchResult.optional(),
})
export type JobEnvelope = z.infer<typeof JobEnvelope>

/* -------------------------------------------------------------------------- */
/* Tenancy workspace (GET /api/tenancies/:id)                                  */
/* -------------------------------------------------------------------------- */

export const AnalysisStatus = z.object({
  status: z.enum(['not_started', 'running', 'complete', 'partial', 'failed', 'awaiting_document']),
  /** Whole-document coverage, or the incomplete coverage made visible. */
  coverage: DocumentCoverage.nullable(),
  stage: z.string().optional(),
  failureReason: z.string().optional(),
  analysisVersion: z.string().optional(),
  completedAt: IsoDateTime.optional(),
})
export type AnalysisStatus = z.infer<typeof AnalysisStatus>

export const TenancyWorkspace = z.object({
  tenancy: Tenancy,
  listing: Listing,
  document: PolicyDocument.nullable(),
  analysis: AnalysisStatus,
  findings: z.array(PolicyFinding).default([]),
  legal: LegalReviewStatus,
  legalFindings: z.array(LegalFinding).default([]),
  costs: CostBreakdown.nullable(),
  deposit: DepositLedger.nullable(),
  tasks: z.array(ChecklistTask).default([]),
  evidence: z.array(EvidenceItem).default([]),
  activeJob: AgentJob.nullable().optional(),
})
export type TenancyWorkspace = z.infer<typeof TenancyWorkspace>

export const CitedAnswer = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  sourceRefs: z.array(SourceRef).default([]),
  /** True when the answer is "not specified in the supplied document". */
  notSpecified: z.boolean().default(false),
  createdAt: IsoDateTime,
})
export type CitedAnswer = z.infer<typeof CitedAnswer>

export const ContactDraft = z.object({
  id: z.string(),
  listingId: z.string(),
  status: ContactStatus,
  subject: z.string(),
  body: z.string(),
  /** The verified route. Opening it does not prove submission or delivery. */
  route: z.object({
    kind: z.enum(['mailto', 'application_page', 'provider_page']),
    url: z.string(),
    label: z.string(),
    sourceRefs: z.array(SourceRef).default([]),
  }),
  createdAt: IsoDateTime,
})
export type ContactDraft = z.infer<typeof ContactDraft>

/* -------------------------------------------------------------------------- */
/* Health + envelope                                                           */
/* -------------------------------------------------------------------------- */

export const HealthResponse = z.object({
  status: z.enum(['ok', 'degraded']),
  /** Capability flags only. Never secrets. */
  capabilities: z.object({
    liveSearch: z.boolean(),
    openai: z.boolean(),
    googleMaps: z.boolean(),
    documentIngestion: z.boolean(),
    legalRegistry: z.boolean(),
    demoMode: z.boolean(),
  }),
  demoCatalog: DemoCatalogStatus.nullable().optional(),
  /** Reasons a capability is off, e.g. "OPENAI_API_KEY not configured". */
  limitations: z.array(z.string()).default([]),
  serverTime: IsoDateTime,
})
export type HealthResponse = z.infer<typeof HealthResponse>

export const ApiErrorBody = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
})
export type ApiErrorBody = z.infer<typeof ApiErrorBody>

export function successEnvelope<T extends z.ZodTypeAny>(data: T) {
  return z.object({ contractVersion: z.literal(CONTRACT_VERSION), data, requestId: z.string() })
}

export const ErrorEnvelope = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  error: ApiErrorBody,
  requestId: z.string(),
})
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>

export const JobAccepted = z.object({ jobId: z.string() })
export type JobAccepted = z.infer<typeof JobAccepted>
