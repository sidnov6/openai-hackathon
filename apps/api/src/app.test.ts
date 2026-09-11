import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { extractPolicyFile } from "./documents.js";
import { Store } from "./store.js";

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => { while (cleanups.length) await cleanups.pop()?.(); });

async function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mainhaus-test-"));
  const config = loadConfig({ NODE_ENV: "test", DATABASE_PATH: path.join(root, "test.sqlite"), UPLOAD_DIR: path.join(root, "uploads"), SESSION_SECRET: "test-session-secret-at-least-32-characters", OPENAI_API_KEY: "", OPENAI_MODEL: "", GROQ_API_KEYS: "", GROQ_MODEL: "", GOOGLE_MAPS_SERVER_KEY: "" });
  const store = new Store(config.databasePath);
  const app = await buildApp(config, store);
  cleanups.push(async () => { await app.close(); store.close(); fs.rmSync(root, { recursive: true, force: true }); });
  const bootstrap = await app.inject({ method: "GET", url: "/api/health" });
  const cookie = bootstrap.cookies[0]!;
  return { app, store, cookie: `${cookie.name}=${cookie.value}` };
}

describe("API tenancy boundaries", () => {
  it("keeps tenancy data isolated by signed session cookie and reuses duplicate creation", async () => {
    const { app, cookie } = await fixture();
    const listingId = "swffm:beethovenplatz-4";
    const first = await app.inject({ method: "POST", url: "/api/demo/tenancies", headers: { cookie }, payload: { listingId } });
    expect(first.statusCode).toBe(201);
    expect(first.json().data.acceptance?.actor).toBe("demo_host");
    const tenancyId = first.json().data.id as string;
    const duplicate = await app.inject({ method: "POST", url: "/api/demo/tenancies", headers: { cookie }, payload: { listingId } });
    expect(duplicate.json().data.id).toBe(tenancyId);
    const outsider = await app.inject({ method: "GET", url: `/api/tenancies/${tenancyId}` });
    expect(outsider.statusCode).toBe(404);
  });

  it("automatically accepts a selected demo request and allows analysis immediately", async () => {
    const { app, store, cookie } = await fixture();
    const bytes = new TextEncoder().encode("§ 1 Kaltmiete\nDie Kaltmiete beträgt 400 EUR.\n\n§ 2 Kaution\nDie Kaution beträgt 2.000 EUR.");
    const extracted = await extractPolicyFile("policy-001", "policy-001.txt", bytes);
    store.saveDocument(extracted.record, extracted.anchoredText);
    const link = store.getPolicyLinkBySlot("ffm-demo-001")!;
    store.bindDocument({ ...link, documentId: extracted.record.id, documentVersion: extracted.record.version, status: "ready" });

    const created = await app.inject({ method: "POST", url: "/api/demo/tenancies", headers: { cookie }, payload: { listingId: link.listingId } });
    const tenancyId = created.json().data.id as string;
    expect(created.json().data.acceptance?.actor).toBe("demo_host");
    expect(created.json().data.status).toBe("policy_linked");
    const started = await app.inject({ method: "POST", url: `/api/tenancies/${tenancyId}/analyze`, headers: { cookie } });
    expect(started.statusCode).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const result = await app.inject({ method: "GET", url: `/api/tenancies/${tenancyId}`, headers: { cookie } });
    expect(result.json().data.findings.length).toBeGreaterThan(0);
    expect(result.json().data.legalFindings.some((item: { severity: string }) => item.severity === "potential_conflict")).toBe(true);
  });
});
