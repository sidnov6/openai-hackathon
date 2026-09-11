import { describe, expect, it } from "vitest";
import type { PolicyFinding, Tenancy } from "@mainhaus/contracts";
import { buildLegalReview, buildTasks } from "./analysis.js";

const tenancy: Tenancy = {
  id: "tenancy-1", ownerSessionId: "session-1", listingId: "listing-1", mode: "demo", status: "ready",
  acceptanceEvent: null, policyBinding: null, confirmedDates: {}, tenancyType: "student_residence",
  classificationEvidence: [], classificationStatus: "confirmed",
};

const finding = (topic: string, clause: string): PolicyFinding => ({
  id: `finding-${topic}`, tenancyId: tenancy.id, documentVersion: "version-1", topic, title: topic,
  explanation: topic, originalClause: clause, sourceRefs: [{ id: `source-${topic}`, kind: "document", documentId: "doc-1", version: "version-1", page: 1, excerpt: clause }], certainty: "stated",
});

describe("analysis safeguards", () => {
  it("does not invent task dates when move-in and move-out are unknown", () => {
    expect(buildTasks(tenancy, []).every((task) => task.dueDate === undefined)).toBe(true);
  });

  it("extracts the clause and separately flags an excessive deposit", () => {
    const findings = [finding("rent", "Die Kaltmiete beträgt 400 EUR."), finding("deposit", "Die Kaution beträgt 2.000 EUR.")];
    const review = buildLegalReview(tenancy, findings);
    expect(review.find((item) => item.title.includes("exceed"))?.severity).toBe("potential_conflict");
    expect(findings[1]?.originalClause).toContain("2.000 EUR");
  });

  it("does not treat normal wear as automatically chargeable damage", () => {
    const review = buildLegalReview(tenancy, []);
    expect(review.find((item) => item.title.includes("Normal use"))?.explanation).toContain("ordinary wear");
  });
});
