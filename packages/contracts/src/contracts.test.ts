import { describe, expect, it } from "vitest";
import { DemoPolicyLinkSchema, SearchRequestSchema } from "./index.js";

describe("contract v1", () => {
  it("rejects unknown costs masquerading as zero", () => {
    const parsed = SearchRequestSchema.safeParse({
      origin: { lat: 50.1109, lng: 8.6821, label: "Frankfurt" },
      radiusKm: 5,
      maxMonthlyCostCents: 0,
      roomTypes: [],
      includeUnknownPrices: true,
    });
    expect(parsed.success).toBe(false);
  });

  it("only accepts the twenty reserved demo slots", () => {
    const base = {
      listingId: null,
      policyId: "policy-020",
      documentId: null,
      documentVersion: null,
      relation: "fictional_demo",
      status: "unbound",
    };
    expect(DemoPolicyLinkSchema.safeParse({ ...base, slotId: "ffm-demo-020" }).success).toBe(true);
    expect(DemoPolicyLinkSchema.safeParse({ ...base, slotId: "ffm-demo-021" }).success).toBe(false);
  });
});
