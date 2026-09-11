import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  AgentEvent,
  AgentJob,
  ChecklistTask,
  DemoPolicyLink,
  DocumentRecord,
  EvidenceItem,
  LegalFinding,
  Listing,
  PolicyFinding,
  Tenancy,
} from "@mainhaus/contracts";
import { initialPolicyLinks, savedCatalog } from "./catalog.js";

type Row = Record<string, unknown>;
const parse = <T>(value: unknown): T => JSON.parse(String(value)) as T;

export class Store {
  readonly db: DatabaseSync;

  constructor(filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    this.migrate();
    this.seed();
  }

  close() { this.db.close(); }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS listings (
        id TEXT PRIMARY KEY,
        canonical_url TEXT NOT NULL UNIQUE,
        json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS policy_links (
        slot_id TEXT PRIMARY KEY,
        listing_id TEXT UNIQUE,
        policy_id TEXT NOT NULL UNIQUE,
        document_id TEXT,
        document_version TEXT,
        status TEXT NOT NULL,
        json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        policy_id TEXT,
        tenancy_id TEXT,
        version TEXT NOT NULL,
        extracted_text TEXT NOT NULL,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(policy_id, version)
      );
      CREATE TABLE IF NOT EXISTS tenancies (
        id TEXT PRIMARY KEY,
        owner_session_id TEXT NOT NULL,
        listing_id TEXT NOT NULL,
        status TEXT NOT NULL,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(owner_session_id, listing_id)
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        owner_session_id TEXT NOT NULL,
        tenancy_id TEXT,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        idempotency_key TEXT,
        result_json TEXT,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(owner_session_id, idempotency_key)
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        owner_session_id TEXT NOT NULL,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS findings (
        id TEXT PRIMARY KEY,
        tenancy_id TEXT NOT NULL,
        document_version TEXT NOT NULL,
        json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS legal_findings (
        id TEXT PRIMARY KEY,
        tenancy_id TEXT NOT NULL,
        json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        tenancy_id TEXT NOT NULL,
        phase TEXT NOT NULL,
        json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS evidence (
        id TEXT PRIMARY KEY,
        tenancy_id TEXT NOT NULL,
        storage_key TEXT NOT NULL UNIQUE,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs(owner_session_id);
      CREATE INDEX IF NOT EXISTS idx_events_job ON events(job_id);
      CREATE INDEX IF NOT EXISTS idx_tenancies_owner ON tenancies(owner_session_id);
      CREATE INDEX IF NOT EXISTS idx_evidence_tenancy ON evidence(tenancy_id);
    `);
  }

  private seed() {
    const upsertListing = this.db.prepare(`
      INSERT INTO listings(id, canonical_url, json, updated_at) VALUES(?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);
    for (const listing of savedCatalog()) {
      upsertListing.run(listing.id, listing.canonicalUrl, JSON.stringify(listing), listing.checkedAt);
    }
    const upsertLink = this.db.prepare(`
      INSERT INTO policy_links(slot_id, listing_id, policy_id, document_id, document_version, status, json, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slot_id) DO NOTHING
    `);
    const now = new Date().toISOString();
    for (const link of initialPolicyLinks()) {
      upsertLink.run(link.slotId, link.listingId, link.policyId, link.documentId, link.documentVersion, link.status, JSON.stringify(link), now);
    }
  }

  listListings(): Listing[] {
    return (this.db.prepare("SELECT json FROM listings ORDER BY id").all() as Row[]).map((row) => parse<Listing>(row.json));
  }

  getListing(id: string): Listing | null {
    const row = this.db.prepare("SELECT json FROM listings WHERE id = ?").get(id) as Row | undefined;
    return row ? parse<Listing>(row.json) : null;
  }

  upsertListings(listings: Listing[]) {
    const statement = this.db.prepare(`
      INSERT INTO listings(id, canonical_url, json, updated_at) VALUES(?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET canonical_url=excluded.canonical_url, json=excluded.json, updated_at=excluded.updated_at
    `);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const listing of listings) statement.run(listing.id, listing.canonicalUrl, JSON.stringify(listing), listing.checkedAt);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  listPolicyLinks(): DemoPolicyLink[] {
    return (this.db.prepare("SELECT json FROM policy_links ORDER BY slot_id").all() as Row[]).map((row) => parse<DemoPolicyLink>(row.json));
  }

  getPolicyLinkBySlot(slotId: string): DemoPolicyLink | null {
    const row = this.db.prepare("SELECT json FROM policy_links WHERE slot_id = ?").get(slotId) as Row | undefined;
    return row ? parse<DemoPolicyLink>(row.json) : null;
  }

  getPolicyLinkByListing(listingId: string): DemoPolicyLink | null {
    const row = this.db.prepare("SELECT json FROM policy_links WHERE listing_id = ?").get(listingId) as Row | undefined;
    return row ? parse<DemoPolicyLink>(row.json) : null;
  }

  bindDocument(link: DemoPolicyLink) {
    this.db.prepare(`UPDATE policy_links SET document_id=?, document_version=?, status=?, json=?, updated_at=? WHERE slot_id=?`)
      .run(link.documentId, link.documentVersion, link.status, JSON.stringify(link), new Date().toISOString(), link.slotId);
  }

  saveDocument(document: DocumentRecord, extractedText: string) {
    this.db.prepare(`
      INSERT INTO documents(id, policy_id, tenancy_id, version, extracted_text, json, created_at)
      VALUES(?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(policy_id, version) DO UPDATE SET extracted_text=excluded.extracted_text, json=excluded.json
    `).run(document.id, document.policyId ?? null, document.tenancyId ?? null, document.version, extractedText, JSON.stringify(document), new Date().toISOString());
  }

  getDocument(id: string): { document: DocumentRecord; extractedText: string } | null {
    const row = this.db.prepare("SELECT json, extracted_text FROM documents WHERE id = ?").get(id) as Row | undefined;
    return row ? { document: parse<DocumentRecord>(row.json), extractedText: String(row.extracted_text) } : null;
  }

  getTenancy(id: string, owner: string): Tenancy | null {
    const row = this.db.prepare("SELECT json FROM tenancies WHERE id=? AND owner_session_id=?").get(id, owner) as Row | undefined;
    return row ? parse<Tenancy>(row.json) : null;
  }

  findTenancy(owner: string, listingId: string): Tenancy | null {
    const row = this.db.prepare("SELECT json FROM tenancies WHERE owner_session_id=? AND listing_id=?").get(owner, listingId) as Row | undefined;
    return row ? parse<Tenancy>(row.json) : null;
  }

  listTenancies(owner: string): Tenancy[] {
    return (this.db.prepare("SELECT json FROM tenancies WHERE owner_session_id=? ORDER BY created_at DESC").all(owner) as Row[]).map((row) => parse<Tenancy>(row.json));
  }

  saveTenancy(tenancy: Tenancy) {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO tenancies(id, owner_session_id, listing_id, status, json, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status, json=excluded.json, updated_at=excluded.updated_at
    `).run(tenancy.id, tenancy.ownerSessionId, tenancy.listingId, tenancy.status, JSON.stringify(tenancy), now, now);
  }

  deleteTenancy(id: string, owner: string): string[] {
    const tenancy = this.getTenancy(id, owner);
    if (!tenancy) return [];
    const keys = (this.db.prepare("SELECT storage_key FROM evidence WHERE tenancy_id=?").all(id) as Row[]).map((row) => String(row.storage_key));
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const table of ["events", "jobs", "findings", "legal_findings", "tasks", "evidence"]) {
        if (table === "events") this.db.prepare("DELETE FROM events WHERE job_id IN (SELECT id FROM jobs WHERE tenancy_id=?)").run(id);
        else this.db.prepare(`DELETE FROM ${table} WHERE tenancy_id=?`).run(id);
      }
      this.db.prepare("DELETE FROM tenancies WHERE id=? AND owner_session_id=?").run(id, owner);
      this.db.exec("COMMIT");
      return keys;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  saveJob(job: AgentJob, result?: unknown, idempotencyKey?: string) {
    this.db.prepare(`
      INSERT INTO jobs(id, owner_session_id, tenancy_id, type, status, idempotency_key, result_json, json, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status, result_json=excluded.result_json, json=excluded.json, updated_at=excluded.updated_at
    `).run(job.id, job.ownerSessionId, job.tenancyId ?? null, job.type, job.status, idempotencyKey ?? null, result === undefined ? null : JSON.stringify(result), JSON.stringify(job), job.createdAt, job.updatedAt);
  }

  getJob(id: string, owner: string): { job: AgentJob; result?: unknown; events: AgentEvent[] } | null {
    const row = this.db.prepare("SELECT json, result_json FROM jobs WHERE id=? AND owner_session_id=?").get(id, owner) as Row | undefined;
    if (!row) return null;
    return {
      job: parse<AgentJob>(row.json),
      ...(row.result_json ? { result: parse<unknown>(row.result_json) } : {}),
      events: this.listEvents(id, owner),
    };
  }

  findJobByIdempotency(owner: string, key: string): AgentJob | null {
    const row = this.db.prepare("SELECT json FROM jobs WHERE owner_session_id=? AND idempotency_key=?").get(owner, key) as Row | undefined;
    return row ? parse<AgentJob>(row.json) : null;
  }

  saveEvent(owner: string, event: AgentEvent) {
    this.db.prepare("INSERT INTO events(id, job_id, owner_session_id, json, created_at) VALUES(?, ?, ?, ?, ?)")
      .run(event.id, event.jobId, owner, JSON.stringify(event), event.createdAt);
  }

  listEvents(jobId: string, owner: string): AgentEvent[] {
    return (this.db.prepare("SELECT json FROM events WHERE job_id=? AND owner_session_id=? ORDER BY created_at").all(jobId, owner) as Row[])
      .map((row) => parse<AgentEvent>(row.json));
  }

  replaceFindings(tenancyId: string, documentVersion: string, findings: PolicyFinding[]) {
    this.db.prepare("DELETE FROM findings WHERE tenancy_id=?").run(tenancyId);
    const insert = this.db.prepare("INSERT INTO findings(id, tenancy_id, document_version, json) VALUES(?, ?, ?, ?)");
    for (const finding of findings) insert.run(finding.id, tenancyId, documentVersion, JSON.stringify(finding));
  }

  getFindings(tenancyId: string): PolicyFinding[] {
    return (this.db.prepare("SELECT json FROM findings WHERE tenancy_id=? ORDER BY id").all(tenancyId) as Row[]).map((row) => parse<PolicyFinding>(row.json));
  }

  replaceLegalFindings(tenancyId: string, findings: LegalFinding[]) {
    this.db.prepare("DELETE FROM legal_findings WHERE tenancy_id=?").run(tenancyId);
    const insert = this.db.prepare("INSERT INTO legal_findings(id, tenancy_id, json) VALUES(?, ?, ?)");
    for (const finding of findings) insert.run(finding.id, tenancyId, JSON.stringify(finding));
  }

  getLegalFindings(tenancyId: string): LegalFinding[] {
    return (this.db.prepare("SELECT json FROM legal_findings WHERE tenancy_id=? ORDER BY id").all(tenancyId) as Row[]).map((row) => parse<LegalFinding>(row.json));
  }

  replaceTasks(tenancyId: string, tasks: ChecklistTask[]) {
    this.db.prepare("DELETE FROM tasks WHERE tenancy_id=?").run(tenancyId);
    const insert = this.db.prepare("INSERT INTO tasks(id, tenancy_id, phase, json) VALUES(?, ?, ?, ?)");
    for (const task of tasks) insert.run(task.id, tenancyId, task.phase, JSON.stringify(task));
  }

  getTasks(tenancyId: string): ChecklistTask[] {
    return (this.db.prepare("SELECT json FROM tasks WHERE tenancy_id=? ORDER BY phase, id").all(tenancyId) as Row[]).map((row) => parse<ChecklistTask>(row.json));
  }

  saveTask(task: ChecklistTask) {
    this.db.prepare("UPDATE tasks SET json=? WHERE id=? AND tenancy_id=?").run(JSON.stringify(task), task.id, task.tenancyId);
  }

  saveEvidence(item: EvidenceItem) {
    this.db.prepare("INSERT INTO evidence(id, tenancy_id, storage_key, json, created_at) VALUES(?, ?, ?, ?, ?)")
      .run(item.id, item.tenancyId, item.storageKey, JSON.stringify(item), item.uploadedAt);
  }

  getEvidence(id: string, tenancyId: string): EvidenceItem | null {
    const row = this.db.prepare("SELECT json FROM evidence WHERE id=? AND tenancy_id=?").get(id, tenancyId) as Row | undefined;
    return row ? parse<EvidenceItem>(row.json) : null;
  }

  listEvidence(tenancyId: string): EvidenceItem[] {
    return (this.db.prepare("SELECT json FROM evidence WHERE tenancy_id=? ORDER BY created_at").all(tenancyId) as Row[]).map((row) => parse<EvidenceItem>(row.json));
  }
}
