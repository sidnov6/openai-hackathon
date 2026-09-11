import type { AgentEvent, AgentJob, SearchRequest, Tenancy } from "@mainhaus/contracts";
import type { Config } from "./config.js";
import { analyzePolicyDeterministically, buildLegalReview, buildTasks } from "./analysis.js";
import { discoverHousing } from "./discovery.js";
import { newId } from "./ids.js";
import { enrichSelectedPolicyWithLLM } from "./openai-analysis.js";
import type { Store } from "./store.js";

const now = () => new Date().toISOString();

function event(store: Store, owner: string, job: AgentJob, agent: AgentEvent["agent"], status: AgentEvent["status"], summary: string) {
  store.saveEvent(owner, { id: newId("evt"), jobId: job.id, agent, status, summary, sourceRefs: [], createdAt: now() });
}

function updateJob(store: Store, job: AgentJob, status: AgentJob["status"], stage: string, progress: number, result?: unknown, error?: AgentJob["error"]) {
  const updated: AgentJob = { ...job, status, stage, progress, ...(error ? { error } : {}), updatedAt: now() };
  store.saveJob(updated, result);
  return updated;
}

export function createJob(owner: string, type: AgentJob["type"], tenancyId?: string): AgentJob {
  const createdAt = now();
  return {
    id: newId("job"), ownerSessionId: owner, ...(tenancyId ? { tenancyId } : {}), type,
    status: "queued", stage: "queued", progress: 0, createdAt, updatedAt: createdAt,
  };
}

export async function runSearchJob(store: Store, config: Config, job: AgentJob, request: SearchRequest) {
  try {
    job = updateJob(store, job, "running", "discovering", 15);
    event(store, job.ownerSessionId, job, "housing_scout", "working", "Checking the official Frankfurt student-residence directory");
    const result = await discoverHousing(request, { googleKey: config.GOOGLE_MAPS_SERVER_KEY });
    event(store, job.ownerSessionId, job, "listing_verifier", "working", "Verifying canonical provider links, public contact route, and availability wording");
    store.upsertListings(result.listings);
    event(store, job.ownerSessionId, job, "listing_verifier", "complete", `${result.counts.residencesFound} residences retained; ${result.counts.sourceReportedOffers} source-reported offers; ${result.counts.availabilityUnknown} with unknown availability`);
    updateJob(store, job, "complete", "complete", 100, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Housing discovery failed";
    event(store, job.ownerSessionId, job, "housing_scout", "failed", "Discovery could not be completed");
    updateJob(store, job, "failed", "failed", job.progress, undefined, { code: "DISCOVERY_FAILED", message, retryable: true });
  }
}

export async function runAnalysisJob(store: Store, config: Config, job: AgentJob, tenancy: Tenancy) {
  try {
    const link = tenancy.policyBinding;
    if (!link?.documentId || !link.documentVersion) throw new Error("The mapped policy document is still awaiting upload");
    const document = store.getDocument(link.documentId);
    if (!document || document.document.version !== link.documentVersion) throw new Error("The immutable document version could not be resolved");
    if (!["complete", "partial"].includes(document.document.extractionStatus)) throw new Error(`Document extraction is ${document.document.extractionStatus}`);

    job = updateJob(store, job, "running", "reading_document", 25);
    event(store, job.ownerSessionId, job, "policy_analyst", "working", `Reading all ${document.document.pageOrSectionCount} extracted pages or sections`);
    let findings = analyzePolicyDeterministically(tenancy.id, document.document.id, document.document.version, document.extractedText);
    if (config.openAiEnabled || config.groqEnabled) {
      event(store, job.ownerSessionId, job, "policy_analyst", "working", "Using the configured model for this selected agreement only");
      try {
        findings = await enrichSelectedPolicyWithLLM({
          ...(config.openAiEnabled ? { openAi: { apiKey: config.OPENAI_API_KEY!, model: config.OPENAI_MODEL! } } : {}),
          ...(config.groqEnabled ? { groq: { apiKeys: config.groqApiKeys, model: config.GROQ_MODEL! } } : {}),
          anchoredText: document.extractedText,
          deterministicFindings: findings,
        });
      } catch {
        event(store, job.ownerSessionId, job, "policy_analyst", "failed", "Model enrichment was unavailable; complete deterministic extraction and citations were retained");
      }
    }
    store.replaceFindings(tenancy.id, document.document.version, findings);
    event(store, job.ownerSessionId, job, "policy_analyst", "complete", `Document coverage ${document.document.coverage.processed}/${document.document.coverage.total}; ${findings.filter((finding) => finding.certainty === "unknown").length} requested topics not specified`);

    job = updateJob(store, job, "running", "legal_and_lifecycle_review", 65);
    event(store, job.ownerSessionId, job, "legal_reviewer", "working", "Comparing relevant clauses with the reviewed official-source registry");
    event(store, job.ownerSessionId, job, "lifecycle_planner", "working", "Preparing move-in and move-out tasks from confirmed dates and cited obligations");
    const [legal, tasks] = await Promise.all([
      Promise.resolve(buildLegalReview(tenancy, findings)),
      Promise.resolve(buildTasks(tenancy, findings)),
    ]);
    store.replaceLegalFindings(tenancy.id, legal);
    store.replaceTasks(tenancy.id, tasks);
    event(store, job.ownerSessionId, job, "legal_reviewer", "complete", `${legal.length} sourced legal information and triage findings prepared`);
    event(store, job.ownerSessionId, job, "lifecycle_planner", "complete", `${tasks.length} lifecycle tasks prepared without inventing unknown dates`);

    job = updateJob(store, job, "running", "evidence_gate", 90);
    const badCitation = findings.some((finding) => finding.certainty === "stated" && finding.sourceRefs.some((ref) => ref.documentId !== document.document.id || ref.version !== document.document.version));
    if (badCitation) throw new Error("Evidence gate rejected a citation outside the selected immutable document version");
    event(store, job.ownerSessionId, job, "evidence_gate", "complete", "Citation scope, document version, and task dates passed deterministic checks");
    const readyStatus = document.document.coverage.complete ? "complete" : "partial";
    const updatedTenancy: Tenancy = { ...tenancy, status: document.document.coverage.complete ? "ready" : "analysis_running" };
    store.saveTenancy(updatedTenancy);
    updateJob(store, job, readyStatus, readyStatus === "complete" ? "complete" : "incomplete_coverage", 100, {
      tenancyId: tenancy.id,
      findingCount: findings.length,
      legalFindingCount: legal.length,
      taskCount: tasks.length,
      coverage: document.document.coverage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    event(store, job.ownerSessionId, job, "evidence_gate", "failed", message);
    updateJob(store, job, "failed", "failed", job.progress, undefined, { code: "ANALYSIS_FAILED", message, retryable: true });
  }
}
