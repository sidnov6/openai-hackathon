import { z } from "zod";

export const CONTRACT_VERSION = "1" as const;
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const IsoDateSchema = z.iso.date();
export const IdSchema = z.string().min(1).max(160);
export const MoneyCentsSchema = z.number().int().nonnegative().nullable();

export const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const SourceRefSchema = z.object({
  id: IdSchema,
  kind: z.enum(["webpage", "document", "statute", "user_evidence"]),
  url: z.url().optional(),
  documentId: IdSchema.optional(),
  version: z.string().min(1).optional(),
  page: z.number().int().positive().optional(),
  section: z.string().min(1).optional(),
  excerpt: z.string().max(12_000).optional(),
  retrievedAt: IsoDateTimeSchema.optional(),
});

export const SearchRequestSchema = z.object({
  origin: CoordinatesSchema.extend({ label: z.string().min(1).max(240) }),
  radiusKm: z.number().positive().max(50),
  maxMonthlyCostCents: z.number().int().positive().optional(),
  roomTypes: z.array(z.enum(["single_room", "shared_room", "studio", "apartment", "accessible", "other"])).max(12),
  moveInDate: IsoDateSchema.optional(),
  includeUnknownPrices: z.boolean().default(true),
});

export const AvailabilitySchema = z.enum([
  "offer_reported",
  "applications_open",
  "waitlist",
  "unavailable",
  "unknown",
]);

export const ListingSchema = z.object({
  id: IdSchema,
  provider: z.object({
    id: IdSchema,
    name: z.string().min(1),
    role: z.enum(["operator", "listing_platform", "housing_provider", "unknown"]),
  }),
  externalId: z.string().min(1).optional(),
  canonicalUrl: z.url(),
  title: z.string().min(1),
  scope: z.enum(["residence", "room"]),
  address: z.string().min(1).optional(),
  coordinates: CoordinatesSchema.optional(),
  locationPrecision: z.enum(["exact", "approximate", "unknown"]),
  distanceMeters: z.number().int().nonnegative().optional(),
  availability: AvailabilitySchema,
  availabilityEvidence: z.object({
    summary: z.string().min(1),
    observedAt: IsoDateTimeSchema,
    sourceRefId: IdSchema,
  }).optional(),
  monthlyCost: z.object({
    amountCents: MoneyCentsSchema,
    basis: z.enum(["warm", "cold", "known_total", "unknown"]),
    label: z.string().min(1),
    unknownComponents: z.array(z.string()),
  }).optional(),
  contact: z.object({
    role: z.enum(["provider", "operator", "application_office", "unknown"]),
    label: z.string().min(1),
    email: z.email().optional(),
    phone: z.string().min(3).optional(),
    url: z.url().optional(),
  }).optional(),
  sourceRefs: z.array(SourceRefSchema).min(1),
  checkedAt: IsoDateTimeSchema,
  demoPolicySlotId: IdSchema.optional(),
});

export const DemoPolicyLinkSchema = z.object({
  slotId: z.string().regex(/^ffm-demo-(00[1-9]|01\d|020)$/),
  listingId: IdSchema.nullable(),
  policyId: z.string().regex(/^policy-(00[1-9]|01\d|020)$/),
  documentId: IdSchema.nullable(),
  documentVersion: z.string().min(1).nullable(),
  relation: z.literal("fictional_demo"),
  status: z.enum(["unbound", "awaiting_document", "ready", "retired"]),
});

export const DocumentSchema = z.object({
  id: IdSchema,
  policyId: IdSchema.optional(),
  tenancyId: IdSchema.optional(),
  mode: z.enum(["fictional_demo", "user_supplied"]),
  version: z.string().min(8),
  fileName: z.string().min(1),
  mediaType: z.enum(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"]),
  pageOrSectionCount: z.number().int().nonnegative(),
  extractionStatus: z.enum(["awaiting_upload", "extracting", "complete", "partial", "failed", "ocr_required"]),
  coverage: z.object({
    processed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    unreadable: z.array(z.number().int().positive()),
    complete: z.boolean(),
  }),
  missingParts: z.array(z.string()),
});

export const TenancyStatusSchema = z.enum([
  "created", "application_prepared", "submitted_demo", "accepted_demo", "policy_linked",
  "analysis_running", "ready", "move_in", "living", "move_out", "closed",
]);

export const TenancySchema = z.object({
  id: IdSchema,
  ownerSessionId: IdSchema,
  listingId: IdSchema,
  mode: z.enum(["demo", "user_supplied"]),
  status: TenancyStatusSchema,
  acceptanceEvent: z.object({
    id: IdSchema,
    kind: z.literal("simulated_provider_acceptance"),
    occurredAt: IsoDateTimeSchema,
  }).nullable(),
  policyBinding: DemoPolicyLinkSchema.nullable(),
  confirmedDates: z.object({ moveIn: IsoDateSchema.optional(), moveOut: IsoDateSchema.optional() }),
  tenancyType: z.enum(["student_residence", "residential", "furnished_temporary", "unknown"]),
  classificationEvidence: z.array(SourceRefSchema),
  classificationStatus: z.enum(["confirmed", "provisional", "unknown"]),
  registrationInputs: z.object({
    alreadyRegisteredInGermany: z.boolean().optional(),
    intendedStayMonths: z.number().int().positive().optional(),
    leavingGermanyOnMoveOut: z.boolean().optional(),
  }).optional(),
});

export const PolicyFindingSchema = z.object({
  id: IdSchema,
  tenancyId: IdSchema,
  documentVersion: z.string().min(1),
  topic: z.string().min(1),
  title: z.string().min(1),
  explanation: z.string().min(1),
  originalClause: z.string(),
  sourceRefs: z.array(SourceRefSchema),
  certainty: z.enum(["stated", "derived", "unknown"]),
  action: z.string().optional(),
  dueDate: IsoDateSchema.optional(),
});

export const LegalFindingSchema = z.object({
  id: IdSchema,
  tenancyId: IdSchema,
  policyFindingIds: z.array(IdSchema),
  severity: z.enum(["information", "clarify", "potential_conflict"]),
  applicability: z.enum(["applicable", "not_applicable", "applicability_uncertain"]),
  title: z.string().min(1),
  explanation: z.string().min(1),
  contractEvidence: z.array(SourceRefSchema),
  legalEvidence: z.array(SourceRefSchema).min(1),
  nextStep: z.string().min(1),
});

export const ChecklistTaskSchema = z.object({
  id: IdSchema,
  tenancyId: IdSchema,
  phase: z.enum(["move_in", "living", "move_out"]),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: IsoDateSchema.optional(),
  status: z.enum(["todo", "in_progress", "done", "skipped"]),
  basis: z.enum(["contract", "legal_guidance", "practical"]),
  sourceRefs: z.array(SourceRefSchema),
  evidenceIds: z.array(IdSchema),
});

export const EvidenceItemSchema = z.object({
  id: IdSchema,
  tenancyId: IdSchema,
  roomOrItem: z.string().min(1),
  storageKey: z.string().min(1),
  mediaType: z.string().min(1),
  uploadedAt: IsoDateTimeSchema,
  userCaptureDate: IsoDateSchema.optional(),
  note: z.string().max(4000),
  comparisonIds: z.array(IdSchema).optional(),
});

export const AgentEventSchema = z.object({
  id: IdSchema,
  jobId: IdSchema,
  agent: z.enum(["housing_scout", "listing_verifier", "policy_analyst", "legal_reviewer", "lifecycle_planner", "evidence_gate"]),
  status: z.enum(["queued", "working", "complete", "failed", "cancelled"]),
  summary: z.string().min(1),
  sourceRefs: z.array(SourceRefSchema),
  createdAt: IsoDateTimeSchema,
});

export const AgentJobSchema = z.object({
  id: IdSchema,
  ownerSessionId: IdSchema,
  tenancyId: IdSchema.optional(),
  type: z.enum(["search", "analysis", "move_out_review"]),
  status: z.enum(["queued", "running", "complete", "partial", "failed", "cancelled"]),
  stage: z.string().min(1),
  progress: z.number().int().min(0).max(100),
  resultRef: z.string().optional(),
  error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }).optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const SearchResultSchema = z.object({
  dataMode: z.enum(["live", "saved_discovery", "limited"]),
  dataModeLabel: z.string().min(1),
  listings: z.array(ListingSchema),
  counts: z.object({
    residencesFound: z.number().int().nonnegative(),
    sourceReportedOffers: z.number().int().nonnegative(),
    applicationsOpen: z.number().int().nonnegative(),
    availabilityUnknown: z.number().int().nonnegative(),
  }),
  searchedAt: IsoDateTimeSchema,
  limitations: z.array(z.string()),
});

export const WorkspaceSchema = z.object({
  tenancy: TenancySchema,
  listing: ListingSchema,
  document: DocumentSchema.nullable(),
  findings: z.array(PolicyFindingSchema),
  legalFindings: z.array(LegalFindingSchema),
  tasks: z.array(ChecklistTaskSchema),
  evidence: z.array(EvidenceItemSchema.omit({ storageKey: true })),
  costs: z.object({
    knownMonthlyCents: MoneyCentsSchema,
    unknownComponents: z.array(z.string()),
    depositCents: MoneyCentsSchema,
    agreedDeductionsCents: z.number().int().nonnegative(),
    unresolvedClaimedDeductionsCents: z.number().int().nonnegative(),
    returnedCents: z.number().int().nonnegative(),
    remainingAccountingBalanceCents: MoneyCentsSchema,
  }),
  analysisStatus: z.enum(["awaiting_document", "not_started", "running", "partial", "ready", "failed"]),
});

export const ApiErrorSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }),
  requestId: z.string(),
});

export const successEnvelope = <T extends z.ZodType>(schema: T) => z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  data: schema,
  requestId: z.string(),
});

export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type SourceRef = z.infer<typeof SourceRefSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type Listing = z.infer<typeof ListingSchema>;
export type DemoPolicyLink = z.infer<typeof DemoPolicyLinkSchema>;
export type DocumentRecord = z.infer<typeof DocumentSchema>;
export type Tenancy = z.infer<typeof TenancySchema>;
export type PolicyFinding = z.infer<typeof PolicyFindingSchema>;
export type LegalFinding = z.infer<typeof LegalFindingSchema>;
export type ChecklistTask = z.infer<typeof ChecklistTaskSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type AgentJob = z.infer<typeof AgentJobSchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
