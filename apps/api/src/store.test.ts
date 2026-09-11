import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Store } from "./store.js";

describe("stable mapping manifest", () => {
  it("contains exactly twenty unique slots, policies, and real listing bindings", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mainhaus-store-"));
    const store = new Store(path.join(root, "test.sqlite"));
    const links = store.listPolicyLinks();
    expect(links).toHaveLength(20);
    expect(new Set(links.map((link) => link.slotId)).size).toBe(20);
    expect(new Set(links.map((link) => link.policyId)).size).toBe(20);
    expect(new Set(links.map((link) => link.listingId)).size).toBe(20);
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
});

