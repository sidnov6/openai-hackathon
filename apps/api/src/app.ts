import fs from "node:fs";
import path from "node:path";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import sharp from "sharp";
import { z } from "zod";
import {
  CONTRACT_VERSION,
  ChecklistTaskSchema,
  SearchRequestSchema,
  type AgentEvent,
  type AgentJob,
  type ChecklistTask,
  type DocumentRecord,
  type EvidenceItem,
  type LegalFinding,
  type Listing,
  type PolicyFinding,
  type SearchResult,
  type SourceRef,
  type Tenancy,
  type Workspace,
} from "@mainhaus/contracts";
import { extractKnownCosts, buildTasks } from "./analysis.js";
import type { Config } from "./config.js";
import { newId } from "./ids.js";
import { LEGAL_SOURCES } from "./legal-registry.js";
import { createJob, runAnalysisJob, runSearchJob } from "./orchestrator.js";
import { Store } from "./store.js";

declare module "fastify" {
  interface FastifyRequest { mainhausSessionId: string }
}

const SESSION_COOKIE = "mainhaus_session";

const uiSource = (ref: SourceRef) => ({ ...ref, label: ref.section ? `Official source — ${ref.section}` : ref.kind === "document" ? "Selected agreement" : "Studierendenwerk Frankfurt" });
const uiListing = (listing: Listing) => ({
  id: listing.id, provider: listing.provider.name, externalId: listing.externalId, canonicalUrl: listing.canonicalUrl,
  title: listing.title, scope: listing.scope, address: listing.address, coordinates: listing.coordinates,
  locationPrecision: listing.locationPrecision, distanceMeters: listing.distanceMeters, availability: listing.availability,
  availabilityEvidence: listing.availabilityEvidence ? { statement: listing.availabilityEvidence.summary, observedAt: listing.availabilityEvidence.observedAt, sourceRefs: listing.sourceRefs.map(uiSource) } : undefined,
  monthlyCost: { kaltmieteCents: null, nebenkostenCents: null, warmmieteCents: listing.monthlyCost?.amountCents ?? null, basis: listing.monthlyCost?.basis === "warm" ? "warm" : listing.monthlyCost?.basis === "cold" ? "kalt" : "unknown", currency: "EUR", unknownComponents: listing.monthlyCost?.unknownComponents ?? ["Kaltmiete", "Nebenkosten"], sourceRefs: listing.sourceRefs.map(uiSource) },
  roomType: "unknown", contact: { role: "application_portal", organisation: listing.provider.name, email: listing.contact?.email ?? null, phone: listing.contact?.phone ?? null, url: listing.contact?.url ?? listing.canonicalUrl, sourceRefs: listing.sourceRefs.map(uiSource) },
  photos: [], sourceRefs: listing.sourceRefs.map(uiSource), checkedAt: listing.checkedAt, demoPolicySlotId: listing.demoPolicySlotId ?? null,
  matchFactors: [{ label: "Official source", detail: "Canonical Studierendenwerk residence page" }, ...(listing.distanceMeters !== undefined ? [{ label: "Distance", detail: `${listing.distanceMeters} m straight-line` }] : [])],
});
const uiSearchResult = (result: SearchResult) => ({
  listings: result.listings.map(uiListing),
  counts: { residences: result.counts.residencesFound, rooms: result.listings.filter((item) => item.scope === "room").length, offerReported: result.counts.sourceReportedOffers, applicationsOpen: result.counts.applicationsOpen, waitlist: result.listings.filter((item) => item.availability === "waitlist").length, unavailable: result.listings.filter((item) => item.availability === "unavailable").length, availabilityUnknown: result.counts.availabilityUnknown, priceUnknown: result.listings.filter((item) => item.monthlyCost?.amountCents == null).length },
  providers: [{ name: "Studierendenwerk Frankfurt am Main", url: "https://www.swffm.de/wohnen/wohnheime", status: result.dataMode === "live" ? "ok" : "unavailable", note: result.limitations.join(" ") || undefined, retrievedAt: result.searchedAt }],
  freshness: result.dataMode === "live" ? "live" : "saved", retrievedAt: result.searchedAt,
  incomplete: result.limitations.length > 0, incompleteReason: result.limitations.join(" ") || undefined,
});
const uiEvent = (event: AgentEvent) => ({ ...event, status: event.status === "working" ? "progress" : event.status === "complete" ? "succeeded" : event.status === "queued" ? "started" : event.status, sourceRefs: event.sourceRefs.map(uiSource) });
const uiJob = (job: AgentJob, events: AgentEvent[], result?: unknown) => ({
  id: job.id, tenancyId: job.tenancyId ?? null, type: job.type, status: job.status === "complete" ? "succeeded" : job.status,
  stage: job.stage, progress: { completed: job.progress, total: 100 }, events: events.map(uiEvent), resultRef: job.resultRef ?? null,
  error: job.error ?? null, createdAt: job.createdAt, updatedAt: job.updatedAt,
  ...(job.type === "search" && result ? { searchResult: uiSearchResult(result as SearchResult) } : {}),
});
const uiTenancy = (tenancy: Tenancy) => ({
  id: tenancy.id, listingId: tenancy.listingId, mode: tenancy.mode, status: tenancy.status, contactStatus: "reviewed",
  acceptance: tenancy.acceptanceEvent ? { acceptedAt: tenancy.acceptanceEvent.occurredAt, actor: "demo_host", note: "Simulated acceptance only" } : null,
  policyBinding: tenancy.policyBinding, documentId: tenancy.policyBinding?.documentId ?? null, documentVersion: tenancy.policyBinding?.documentVersion ?? null,
  moveInDate: tenancy.confirmedDates.moveIn ?? null, moveOutDate: tenancy.confirmedDates.moveOut ?? null, datesConfirmed: Boolean(tenancy.confirmedDates.moveIn),
  tenancyType: tenancy.tenancyType === "student_residence" ? "student_residence_549_3" : tenancy.tenancyType === "furnished_temporary" ? "furnished_living_space" : tenancy.tenancyType === "residential" ? "standard_residential" : "unclassified",
  classificationStatus: tenancy.classificationStatus === "confirmed" ? "confirmed" : tenancy.classificationStatus === "provisional" ? "probable" : "insufficient_evidence",
  classificationEvidence: tenancy.classificationEvidence.map(uiSource), registration: tenancy.registrationInputs ? { hasExistingGermanRegistration: tenancy.registrationInputs.alreadyRegisteredInGermany ?? null, intendedStayMonths: tenancy.registrationInputs.intendedStayMonths ?? null, actualMoveInDate: tenancy.confirmedDates.moveIn ?? null } : null,
  createdAt: tenancy.acceptanceEvent?.occurredAt ?? new Date().toISOString(), updatedAt: new Date().toISOString(),
});
const uiDocument = (document: DocumentRecord | null) => document ? ({
  id: document.id, policyId: document.policyId, tenancyId: document.tenancyId, mode: document.mode === "fictional_demo" ? "demo" : "user_supplied", version: document.version,
  fileName: document.fileName, mediaType: document.mediaType, pageOrSectionCount: document.pageOrSectionCount,
  extractionStatus: document.extractionStatus === "awaiting_upload" ? "pending" : document.extractionStatus,
  coverage: { unitsTotal: document.coverage.total, unitsRead: document.coverage.processed, unit: document.mediaType === "application/pdf" ? "page" : "section" },
  missingParts: document.missingParts.map((detail) => ({ kind: "missing_or_unreadable", detail })),
}) : null;
const uiFinding = (finding: PolicyFinding, documentId: string, tasks: ChecklistTask[]) => ({
  ...finding, documentId, topic: ({ room: "room_identity", term: "term_and_notice", rules: "house_rules", move_out: "move_out_obligations" } as Record<string, string>)[finding.topic] ?? finding.topic,
  originalClause: finding.originalClause || null, sourceRefs: finding.sourceRefs.map(uiSource), action: finding.action ?? null, dueDate: finding.dueDate ?? null,
  relatedTaskIds: finding.topic === "deposit" ? tasks.filter((task) => task.phase === "move_in").map((task) => task.id).slice(0, 1) : [],
});
const uiLegal = (finding: LegalFinding) => ({ ...finding, applicability: finding.applicability === "applicable" ? "applies" : finding.applicability === "not_applicable" ? "does_not_apply" : "applicability_uncertain", contractEvidence: finding.contractEvidence.map(uiSource), legalEvidence: finding.legalEvidence.map(uiSource) });
const uiTask = (task: ChecklistTask) => ({ ...task, detail: task.description, dueDate: task.dueDate ?? null, dueDateBlockedReason: task.dueDate ? null : "A move-in or move-out date has not been confirmed", status: task.status === "skipped" ? "not_applicable" : task.status, sourceRefs: task.sourceRefs.map(uiSource), changeNotice: null });
const uiEvidence = (item: Omit<EvidenceItem, "storageKey">) => ({ ...item, storageKey: `private:${item.id}`, capturedAtStated: item.userCaptureDate ?? null, note: item.note || null, phase: "move_in", comparisonIds: item.comparisonIds ?? [] });

function success(reply: FastifyReply, data: unknown, status = 200) {
  return reply.status(status).send({ contractVersion: CONTRACT_VERSION, data, requestId: reply.request.id });
}

function failure(reply: FastifyReply, status: number, code: string, message: string, retryable = false) {
  return reply.status(status).send({ contractVersion: CONTRACT_VERSION, error: { code, message, retryable }, requestId: reply.request.id });
}

function requireTenancy(store: Store, request: FastifyRequest, reply: FastifyReply, id: string) {
  const tenancy = store.getTenancy(id, request.mainhausSessionId);
  if (!tenancy) {
    failure(reply, 404, "TENANCY_NOT_FOUND", "This tenancy was not found in your session.");
    return null;
  }
  return tenancy;
}

function workspace(store: Store, tenancy: Tenancy): Workspace {
  const listing = store.getListing(tenancy.listingId);
  if (!listing) throw new Error("Listing backing this tenancy is missing");
  const document = tenancy.policyBinding?.documentId ? store.getDocument(tenancy.policyBinding.documentId)?.document ?? null : null;
  const findings = store.getFindings(tenancy.id);
  const evidence = store.listEvidence(tenancy.id).map(({ storageKey: _private, ...item }) => item);
  return {
    tenancy, listing, document, findings,
    legalFindings: store.getLegalFindings(tenancy.id),
    tasks: store.getTasks(tenancy.id), evidence,
    costs: extractKnownCosts(findings),
    analysisStatus: !document ? "awaiting_document" : tenancy.status === "ready" ? "ready" : tenancy.status === "analysis_running" ? "running" : findings.length ? "partial" : "not_started",
  };
}

function uiWorkspace(store: Store, tenancy: Tenancy) {
  const data = workspace(store, tenancy);
  const documentId = data.document?.id ?? "awaiting-document";
  const findings = data.findings.map((finding) => uiFinding(finding, documentId, data.tasks));
  const known = data.costs.knownMonthlyCents;
  return {
    tenancy: uiTenancy(data.tenancy), listing: uiListing(data.listing), document: uiDocument(data.document),
    analysis: {
      status: data.analysisStatus === "ready" ? "complete" : data.analysisStatus,
      coverage: data.document ? { unitsTotal: data.document.coverage.total, unitsRead: data.document.coverage.processed, unit: data.document.mediaType === "application/pdf" ? "page" : "section" } : null,
      stage: data.analysisStatus, analysisVersion: data.document?.version,
    },
    findings,
    legal: { status: data.legalFindings.length ? "complete" : "not_started", unavailableSources: [], checkedTopics: data.legalFindings.map((item) => item.title), retrievedAt: data.legalFindings.length ? new Date().toISOString() : undefined },
    legalFindings: data.legalFindings.map(uiLegal),
    costs: data.findings.length ? { knownMonthlyTotalCents: known, components: [{ label: "Known monthly amount detected", germanTerm: "Miete", amountCents: known, cadence: "monthly", chargeKind: "unknown", sourceRefs: findings.find((item) => item.topic === "rent")?.sourceRefs ?? [] }], excludedComponents: data.costs.unknownComponents.map((label) => ({ label, reason: "Not specified in the supplied document" })), depositCents: data.costs.depositCents, depositInstalments: [], initialCashCents: null, initialCashComponents: [], initialCashIncomplete: true } : null,
    deposit: data.findings.length ? { originalDepositCents: data.costs.depositCents, agreedDeductions: [], claimedDeductions: [], returnedCents: data.costs.returnedCents, remainingBalanceCents: data.costs.remainingAccountingBalanceCents, balanceIncomplete: data.costs.depositCents === null } : null,
    tasks: data.tasks.map(uiTask), evidence: data.evidence.map(uiEvidence), activeJob: null,
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[char]!);
}

function printableBrief(data: Workspace) {
  const generatedAt = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date());
  const findings = data.findings.map((finding) => `<article><h3>${escapeHtml(finding.title)}</h3><p>${escapeHtml(finding.explanation)}</p>${finding.originalClause ? `<blockquote>${escapeHtml(finding.originalClause)}</blockquote>` : ""}<small>${escapeHtml(finding.sourceRefs.map((ref) => ref.page ? `page ${ref.page}` : ref.section ? `section ${ref.section}` : "source unavailable").join(", "))}</small></article>`).join("");
  const tasks = data.tasks.map((task) => `<li><strong>${escapeHtml(task.title)}</strong>${task.dueDate ? ` — ${escapeHtml(task.dueDate)}` : " — date not confirmed"} (${escapeHtml(task.basis)})</li>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>MAINHAUS tenancy brief</title><style>body{font:16px/1.55 system-ui;max-width:800px;margin:40px auto;padding:0 24px;color:#142132}header{border-bottom:3px solid #2458e8}aside{background:#fff4d6;padding:12px 16px;border-left:4px solid #b36b00}article{break-inside:avoid;border-bottom:1px solid #dce3ed;padding:14px 0}blockquote{background:#f5f7fb;margin:8px 0;padding:12px}small{color:#536173}@media print{body{margin:0}button{display:none}}</style></head><body><header><h1>MAINHAUS tenancy brief</h1><p>${escapeHtml(data.listing.title)} · generated ${escapeHtml(generatedAt)}</p></header><aside><strong>Fictional demo lease.</strong> This real location is paired with a fictional lease for demonstration. It is not the provider's actual agreement and this is legal information, not legal advice.</aside><h2>Lease & rules</h2>${findings || "<p>Analysis is not available.</p>"}<h2>Checklist</h2><ul>${tasks}</ul><p><small>Document version: ${escapeHtml(data.document?.version ?? "awaiting document")} · Data mode: ${escapeHtml(data.tenancy.mode)}</small></p><button onclick="print()">Print / save as PDF</button></body></html>`;
}

export async function buildApp(config: Config, injectedStore?: Store): Promise<FastifyInstance> {
  fs.mkdirSync(config.uploadDir, { recursive: true });
  const app = Fastify({ logger: config.NODE_ENV !== "test", bodyLimit: 1_000_000, requestTimeout: 20_000 });
  const store = injectedStore ?? new Store(config.databasePath);
  const contactDrafts = new Map<string, { owner: string; draft: Record<string, unknown> }>();
  await app.register(cookie, { secret: config.SESSION_SECRET, hook: "onRequest" });
  await app.register(multipart, { limits: { files: 1, fileSize: 10 * 1024 * 1024, fields: 8 } });

  app.decorateRequest("mainhausSessionId", "");
  app.addHook("onRequest", async (request, reply) => {
    const signed = request.cookies[SESSION_COOKIE];
    const existing = signed ? request.unsignCookie(signed) : null;
    request.mainhausSessionId = existing?.valid && existing.value ? existing.value : newId("session");
    if (!existing?.valid) {
      reply.setCookie(SESSION_COOKIE, request.mainhausSessionId, {
        path: "/", httpOnly: true, sameSite: "lax", secure: config.NODE_ENV === "production", signed: true,
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "request failed");
    if (error instanceof z.ZodError) return failure(reply, 400, "INVALID_REQUEST", z.prettifyError(error));
    return failure(reply, 500, "INTERNAL_ERROR", config.NODE_ENV === "production" ? "The request could not be completed." : error.message, false);
  });

  app.get("/api/health", async (_request, reply) => success(reply, {
    status: "ok",
    capabilities: { liveSearch: true, openai: config.openAiEnabled || config.groqEnabled, googleMaps: config.googleMapsEnabled, documentIngestion: true, legalRegistry: true, demoMode: config.DEMO_MODE },
    demoCatalog: { totalSlots: 20, boundListings: store.listPolicyLinks().filter((link) => link.listingId).length, ingestedDocuments: store.listPolicyLinks().filter((link) => link.documentId).length, readySlots: store.listPolicyLinks().filter((link) => link.status === "ready").length, links: store.listPolicyLinks() },
    limitations: [
      ...(!config.googleMapsEnabled ? ["Google Places server key is not configured; API distance assertions are disabled."] : []),
      ...(!config.openAiEnabled && !config.groqEnabled ? ["No model provider is configured; deterministic cited extraction remains available."] : []),
      ...(store.listPolicyLinks().some((link) => link.status !== "ready") ? ["One or more fictional policy documents are awaiting import."] : []),
    ], serverTime: new Date().toISOString(),
  }));

  app.get("/api/demo/policies", async (_request, reply) => success(reply, {
    links: store.listPolicyLinks(),
    ready: store.listPolicyLinks().filter((link) => link.status === "ready").length,
    required: 20,
  }));

  app.post("/api/search", async (request, reply) => {
    const raw = z.object({ origin: z.object({ lat: z.number(), lng: z.number(), label: z.string() }), radiusKm: z.number(), maxMonthlyCostCents: z.number().nullable().optional(), roomTypes: z.array(z.string()).default([]), moveInDate: z.string().nullable().optional(), includeUnknownPrices: z.boolean().default(true) }).parse(request.body);
    const roomMap: Record<string, "single_room" | "shared_room" | "studio" | "apartment" | "accessible" | "other"> = { single_apartment: "single_room", room_in_shared_flat: "shared_room", studio: "studio", couple_apartment: "apartment", unknown: "other" };
    const input = SearchRequestSchema.parse({ ...raw, maxMonthlyCostCents: raw.maxMonthlyCostCents ?? undefined, moveInDate: raw.moveInDate ?? undefined, roomTypes: raw.roomTypes.map((type) => roomMap[type] ?? "other") });
    const job = createJob(request.mainhausSessionId, "search");
    store.saveJob(job, undefined, `search:${JSON.stringify(input)}`);
    queueMicrotask(() => void runSearchJob(store, config, job, input));
    return success(reply, { jobId: job.id }, 202);
  });

  app.get<{ Params: { id: string } }>("/api/jobs/:id", async (request, reply) => {
    const found = store.getJob(request.params.id, request.mainhausSessionId);
    return found ? success(reply, uiJob(found.job, found.events, found.result)) : failure(reply, 404, "JOB_NOT_FOUND", "This job was not found in your session.");
  });

  app.post<{ Params: { id: string } }>("/api/jobs/:id/cancel", async (request, reply) => {
    const found = store.getJob(request.params.id, request.mainhausSessionId);
    if (!found) return failure(reply, 404, "JOB_NOT_FOUND", "This job was not found in your session.");
    const cancelled = { ...found.job, status: "cancelled" as const, stage: "cancelled", updatedAt: new Date().toISOString() };
    store.saveJob(cancelled, found.result);
    return success(reply, { cancelled: true });
  });

  app.get<{ Params: { id: string } }>("/api/listings/:id", async (request, reply) => {
    const listing = store.getListing(request.params.id);
    if (!listing) return failure(reply, 404, "LISTING_NOT_FOUND", "Listing not found.");
    return success(reply, { listing: uiListing(listing), demoLink: store.getPolicyLinkByListing(listing.id) });
  });

  app.post("/api/contact-drafts", async (request, reply) => {
    const input = z.object({ listingId: z.string(), studentName: z.string().max(120).optional(), studyProgramme: z.string().max(200).optional(), moveInDate: z.iso.date().nullable().optional(), durationMonths: z.number().nullable().optional(), notes: z.string().max(1500).optional(), language: z.enum(["en", "de"]).optional() }).parse(request.body);
    const listing = store.getListing(input.listingId);
    if (!listing) return failure(reply, 404, "LISTING_NOT_FOUND", "Listing not found.");
    const greeting = "Dear housing team,";
    const body = `${greeting}\n\nI am interested in ${listing.title}.${input.moveInDate ? ` My preferred move-in date is ${input.moveInDate}.` : ""}${input.studyProgramme ? ` I study ${input.studyProgramme}.` : ""}\n\nCould you please confirm the current application route, eligibility, costs, and whether any offer is currently reported?${input.notes ? `\n\n${input.notes}` : ""}\n\nKind regards${input.studentName ? `,\n${input.studentName}` : ""}`;
    const routeUrl = listing.contact?.url ?? listing.canonicalUrl;
    const draft = { id: newId("draft"), listingId: listing.id, status: "draft", subject: `Housing enquiry: ${listing.title}`, body, route: { kind: "application_page", url: routeUrl, label: listing.contact?.label ?? "Official listing page", sourceRefs: listing.sourceRefs.map(uiSource) }, createdAt: new Date().toISOString() };
    contactDrafts.set(draft.id, { owner: request.mainhausSessionId, draft });
    return success(reply, draft, 201);
  });

  app.post<{ Params: { id: string } }>("/api/contact-drafts/:id/handoff", async (request, reply) => {
    const found = contactDrafts.get(request.params.id);
    if (!found || found.owner !== request.mainhausSessionId) return failure(reply, 404, "DRAFT_NOT_FOUND", "Contact draft not found in this session.");
    found.draft = { ...found.draft, status: "external_handoff" };
    return success(reply, found.draft);
  });

  app.post("/api/demo/tenancies", async (request, reply) => {
    if (!config.DEMO_MODE) return failure(reply, 403, "DEMO_DISABLED", "Demo tenancy controls are disabled.");
    const input = z.object({ listingId: z.string(), slotId: z.string().optional() }).parse(request.body);
    const listing = store.getListing(input.listingId);
    if (!listing) return failure(reply, 404, "LISTING_NOT_FOUND", "Listing not found.");
    const link = store.getPolicyLinkByListing(listing.id);
    if (!link || (input.slotId && link.slotId !== input.slotId)) return failure(reply, 409, "NO_DEMO_POLICY", "This listing has no stable sample-lease association.");
    const existing = store.findTenancy(request.mainhausSessionId, listing.id);
    if (existing?.acceptanceEvent) return success(reply, uiTenancy(existing));
    const tenancy: Tenancy = {
      ...(existing ?? { id: newId("tenancy"), ownerSessionId: request.mainhausSessionId, listingId: listing.id, mode: "demo" as const }),
      status: link.status === "ready" ? "policy_linked" : "accepted_demo",
      acceptanceEvent: { id: newId("acceptance"), kind: "simulated_provider_acceptance", occurredAt: new Date().toISOString() },
      policyBinding: { ...link }, confirmedDates: existing?.confirmedDates ?? {}, tenancyType: "student_residence", classificationEvidence: listing.sourceRefs,
      classificationStatus: "provisional",
    };
    store.saveTenancy(tenancy);
    return success(reply, uiTenancy(tenancy), existing ? 200 : 201);
  });

  app.post<{ Params: { id: string } }>("/api/demo/tenancies/:id/accept", async (request, reply) => {
    if (!config.DEMO_MODE) return failure(reply, 403, "DEMO_DISABLED", "Demo tenancy controls are disabled.");
    if (config.DEMO_ADMIN_TOKEN && request.headers["x-demo-admin-token"] !== config.DEMO_ADMIN_TOKEN) return failure(reply, 403, "DEMO_HOST_REQUIRED", "The demo-host token is required.");
    const tenancy = requireTenancy(store, request, reply, request.params.id);
    if (!tenancy) return;
    if (tenancy.acceptanceEvent) return success(reply, uiTenancy(tenancy));
    const currentLink = store.getPolicyLinkByListing(tenancy.listingId);
    if (!currentLink || currentLink.slotId !== tenancy.policyBinding?.slotId) return failure(reply, 409, "POLICY_BINDING_CHANGED", "The stable policy mapping no longer matches this tenancy.");
    const accepted: Tenancy = { ...tenancy, status: currentLink.status === "ready" ? "policy_linked" : "accepted_demo", acceptanceEvent: { id: newId("acceptance"), kind: "simulated_provider_acceptance", occurredAt: new Date().toISOString() }, policyBinding: { ...currentLink } };
    store.saveTenancy(accepted);
    return success(reply, uiTenancy(accepted));
  });

  app.post<{ Params: { id: string } }>("/api/demo/tenancies/:id/reset", async (request, reply) => {
    const tenancy = requireTenancy(store, request, reply, request.params.id);
    if (!tenancy) return;
    const reset: Tenancy = { ...tenancy, status: "application_prepared", acceptanceEvent: null };
    store.saveTenancy(reset);
    return success(reply, uiTenancy(reset));
  });

  app.post<{ Params: { id: string } }>("/api/tenancies/:id/analyze", async (request, reply) => {
    const tenancy = requireTenancy(store, request, reply, request.params.id);
    if (!tenancy) return;
    if (!tenancy.acceptanceEvent) return failure(reply, 409, "DEMO_NOT_ACCEPTED", "Simulate demo acceptance before starting lease analysis.");
    const link = store.getPolicyLinkByListing(tenancy.listingId);
    if (!link?.documentId || !link.documentVersion) return failure(reply, 409, "DOCUMENT_AWAITING_UPLOAD", "Awaiting policy document. Import the mapped policy file before analysis.", true);
    const key = `analysis:${tenancy.id}:${link.documentVersion}`;
    const existing = store.findJobByIdempotency(request.mainhausSessionId, key);
    if (existing) return success(reply, { jobId: existing.id, reused: true }, 202);
    const current: Tenancy = { ...tenancy, status: "analysis_running", policyBinding: { ...link } };
    store.saveTenancy(current);
    const job = createJob(request.mainhausSessionId, "analysis", tenancy.id);
    store.saveJob(job, undefined, key);
    queueMicrotask(() => void runAnalysisJob(store, config, job, current));
    return success(reply, { jobId: job.id, reused: false }, 202);
  });

  app.get<{ Params: { id: string } }>("/api/tenancies/:id", async (request, reply) => {
    const tenancy = requireTenancy(store, request, reply, request.params.id);
    return tenancy ? success(reply, uiWorkspace(store, tenancy)) : undefined;
  });

  app.get("/api/tenancies", async (request, reply) => success(reply, store.listTenancies(request.mainhausSessionId).map(uiTenancy)));

  app.post<{ Params: { id: string } }>("/api/tenancies/:id/questions", async (request, reply) => {
    const tenancy = requireTenancy(store, request, reply, request.params.id);
    if (!tenancy) return;
    const { question } = z.object({ question: z.string().min(2).max(1000) }).parse(request.body);
    const tokens = question.toLocaleLowerCase("de").split(/\W+/).filter((token) => token.length > 3);
    const candidates = store.getFindings(tenancy.id).map((finding) => ({ finding, score: tokens.filter((token) => `${finding.topic} ${finding.title} ${finding.explanation} ${finding.originalClause}`.toLocaleLowerCase("de").includes(token)).length })).sort((a, b) => b.score - a.score);
    const selected = candidates[0]?.finding;
    const answer = selected && (candidates[0]?.score ?? 0) > 0 ? selected.explanation : "Not specified in the supplied document";
    return success(reply, { id: newId("answer"), question, answer, sourceRefs: selected && (candidates[0]?.score ?? 0) > 0 ? selected.sourceRefs.map(uiSource) : [], notSpecified: answer === "Not specified in the supplied document", createdAt: new Date().toISOString() });
  });

  app.patch<{ Params: { id: string } }>("/api/tenancies/:id/dates", async (request, reply) => {
    const tenancy = requireTenancy(store, request, reply, request.params.id);
    if (!tenancy) return;
    const input = z.object({ moveInDate: z.iso.date().nullable(), moveOutDate: z.iso.date().nullable(), registration: z.object({ hasExistingGermanRegistration: z.boolean().nullable(), intendedStayMonths: z.number().int().positive().nullable(), actualMoveInDate: z.iso.date().nullable() }).optional() }).refine((value) => !value.moveInDate || !value.moveOutDate || value.moveOutDate >= value.moveInDate, "Move-out cannot precede move-in").parse(request.body);
    const dates = { ...(input.moveInDate ? { moveIn: input.moveInDate } : {}), ...(input.moveOutDate ? { moveOut: input.moveOutDate } : {}) };
    const updated: Tenancy = { ...tenancy, confirmedDates: dates, ...(input.registration ? { registrationInputs: { ...(input.registration.hasExistingGermanRegistration !== null ? { alreadyRegisteredInGermany: input.registration.hasExistingGermanRegistration } : {}), ...(input.registration.intendedStayMonths ? { intendedStayMonths: input.registration.intendedStayMonths } : {}) } } : {}) };
    store.saveTenancy(updated);
    store.replaceTasks(tenancy.id, buildTasks(updated, store.getFindings(tenancy.id)));
    return success(reply, uiWorkspace(store, updated));
  });

  app.patch<{ Params: { id: string; taskId: string } }>("/api/tenancies/:id/tasks/:taskId", async (request, reply) => {
    const tenancy = requireTenancy(store, request, reply, request.params.id);
    if (!tenancy) return;
    const update = z.object({ status: z.enum(["todo", "in_progress", "done", "skipped"]) }).parse(request.body);
    const task = store.getTasks(tenancy.id).find((candidate) => candidate.id === request.params.taskId);
    if (!task) return failure(reply, 404, "TASK_NOT_FOUND", "Task not found in this tenancy.");
    const changed = ChecklistTaskSchema.parse({ ...task, ...update });
    store.saveTask(changed);
    return success(reply, uiTask(changed));
  });

  app.post<{ Params: { id: string } }>("/api/tenancies/:id/evidence", async (request, reply) => {
    const tenancy = requireTenancy(store, request, reply, request.params.id);
    if (!tenancy) return;
    const part = await request.file();
    if (!part) return failure(reply, 400, "EVIDENCE_FILE_REQUIRED", "Select a JPEG, PNG, or WebP evidence image.");
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(part.mimetype)) return failure(reply, 415, "UNSUPPORTED_EVIDENCE", "Only JPEG, PNG, and WebP evidence images are accepted.");
    const bytes = await part.toBuffer();
    const fields = part.fields as Record<string, { value?: unknown }>;
    const roomOrItem = String(fields.roomOrItem?.value ?? "Room").slice(0, 200);
    const note = String(fields.note?.value ?? "").slice(0, 4000);
    const userCaptureDate = fields.capturedAtStated?.value ? z.iso.date().parse(String(fields.capturedAtStated.value)) : undefined;
    const phase = z.enum(["move_in", "living", "move_out"]).catch("move_in").parse(String(fields.phase?.value ?? "move_in"));
    const id = newId("evidence");
    const extension = part.mimetype === "image/png" ? ".png" : part.mimetype === "image/webp" ? ".webp" : ".jpg";
    const storageKey = `${tenancy.id}/${id}${extension}`;
    const target = path.join(config.uploadDir, storageKey);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    let pipeline = sharp(bytes).rotate();
    pipeline = part.mimetype === "image/png" ? pipeline.png() : part.mimetype === "image/webp" ? pipeline.webp() : pipeline.jpeg({ quality: 92 });
    await pipeline.toFile(target);
    const item: EvidenceItem = { id, tenancyId: tenancy.id, roomOrItem, storageKey, mediaType: part.mimetype, uploadedAt: new Date().toISOString(), ...(userCaptureDate ? { userCaptureDate } : {}), note };
    store.saveEvidence(item);
    const { storageKey: _private, ...safeItem } = item;
    return success(reply, { ...uiEvidence(safeItem), phase }, 201);
  });

  app.get<{ Params: { id: string; evidenceId: string } }>("/api/tenancies/:id/evidence/:evidenceId", async (request, reply) => {
    const tenancy = requireTenancy(store, request, reply, request.params.id);
    if (!tenancy) return;
    const item = store.getEvidence(request.params.evidenceId, tenancy.id);
    if (!item) return failure(reply, 404, "EVIDENCE_NOT_FOUND", "Evidence item not found in this tenancy.");
    const resolved = path.resolve(config.uploadDir, item.storageKey);
    if (!resolved.startsWith(`${path.resolve(config.uploadDir)}${path.sep}`) || !fs.existsSync(resolved)) return failure(reply, 404, "EVIDENCE_FILE_MISSING", "The private evidence file is unavailable.");
    reply.header("Cache-Control", "private, no-store").type(item.mediaType);
    return reply.send(fs.createReadStream(resolved));
  });

  app.post<{ Params: { id: string } }>("/api/tenancies/:id/move-out-review", async (request, reply) => {
    const tenancy = requireTenancy(store, request, reply, request.params.id);
    if (!tenancy) return;
    const input = z.object({ claims: z.array(z.object({ label: z.string().min(1).max(1000), amountCents: z.number().int().nonnegative().nullable(), providerStatement: z.string().max(2000) })).max(50), evidenceIds: z.array(z.string()).max(100).default([]) }).parse(request.body);
    const ownedEvidence = new Set(store.listEvidence(tenancy.id).map((item) => item.id));
    if (input.evidenceIds.some((id) => !ownedEvidence.has(id))) return failure(reply, 403, "EVIDENCE_SCOPE_VIOLATION", "One or more evidence IDs do not belong to this tenancy.");
    const job = createJob(request.mainhausSessionId, "move_out_review", tenancy.id);
    const unresolvedTotal = input.claims.reduce((sum, claim) => sum + (claim.amountCents ?? 0), 0);
    const result = { claims: input.claims.map((claim) => ({ ...claim, status: "unresolved_claim", review: "Request an itemized factual basis and compare it with the handover record. Ordinary wear is not automatically chargeable damage." })), evidenceIds: input.evidenceIds, unresolvedClaimedDeductionsCents: unresolvedTotal, disclaimer: "This review organizes claims and evidence. It does not decide liability, causation, or the deposit refund." };
    const completed = { ...job, status: "complete" as const, stage: "complete", progress: 100, updatedAt: new Date().toISOString() };
    store.saveJob(completed, result, `moveout:${tenancy.id}:${JSON.stringify(input)}`);
    return success(reply, { jobId: completed.id, result }, 202);
  });

  app.get<{ Params: { id: string } }>("/api/tenancies/:id/export", async (request, reply) => {
    const tenancy = requireTenancy(store, request, reply, request.params.id);
    if (!tenancy) return;
    reply.type("text/html; charset=utf-8").header("Content-Disposition", `inline; filename="mainhaus-${tenancy.id}.html"`);
    return reply.send(printableBrief(workspace(store, tenancy)));
  });

  app.delete<{ Params: { id: string } }>("/api/tenancies/:id", async (request, reply) => {
    const tenancy = requireTenancy(store, request, reply, request.params.id);
    if (!tenancy) return;
    const keys = store.deleteTenancy(tenancy.id, request.mainhausSessionId);
    for (const key of keys) {
      const target = path.resolve(config.uploadDir, key);
      if (target.startsWith(`${path.resolve(config.uploadDir)}${path.sep}`)) fs.rmSync(target, { force: true });
    }
    return success(reply, { deleted: true, tenancyId: tenancy.id, evidenceFilesDeleted: keys.length });
  });

  app.get("/api/legal-sources", async (_request, reply) => success(reply, { sources: LEGAL_SOURCES, disclaimer: "Reviewed source registry for information and triage; applicability remains fact-dependent." }));

  app.addHook("onClose", async () => { if (!injectedStore) store.close(); });
  return app;
}
