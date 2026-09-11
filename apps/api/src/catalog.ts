import type { DemoPolicyLink, Listing, SourceRef } from "@mainhaus/contracts";

export const SWFFM_DIRECTORY_URL = "https://www.swffm.de/wohnen/wohnheime";
export const SWFFM_APPLICATION_URL = "https://www.swffm.de/wohnen/online-bewerbung";

const residences = [
  ["beethovenplatz-4", "Beethovenplatz 4"],
  ["bockenheimer-landstrasse-135", "Bockenheimer Landstraße 135"],
  ["froebelstrasse-6-8", "Fröbelstraße 6–8"],
  ["ginnheimer-landstrasse-40", "Ginnheimer Landstraße 40"],
  ["ginnheimer-landstrasse-42", "Ginnheimer Landstraße 42"],
  ["max-kade-haeuser-hansaallee", "Hansaallee 139–139a"],
  ["homburger-strasse-30", "Homburger Straße 30"],
  ["juegelstrasse-1", "Jügelstraße 1"],
  ["kleine-seestrasse-11", "Kleine Seestraße 11"],
  ["kronberger-strasse-43", "Kronberger Straße 43"],
  ["ludwig-landmann-strasse-343", "Ludwig-Landmann-Straße 343"],
  ["max-von-laue-strasse-14", "Max-von-Laue-Straße 14"],
  ["porthstrasse-1-3", "Porthstraße 1–3"],
  ["rat-beil-strasse-29", "Rat-Beil-Straße 29"],
  ["sandhoefer-allee-2-haus-56", "Sandhöfer Allee 2"],
  ["sandhofstrasse-3-5", "Sandhofstraße 3–5"],
  ["schlossstrasse-119", "Schloßstraße 119"],
  ["stralsunder-strasse-24-30", "Stralsunder Straße 24–30"],
  ["uhlandstrasse-23", "Uhlandstraße 23"],
  ["wiesenhuettenplatz-37", "Wiesenhüttenplatz 37"],
] as const;

const savedAt = "2026-09-11T10:15:00+02:00";

export function savedCatalog(): Listing[] {
  return residences.map(([slug, address], index) => {
    const canonicalUrl = `https://www.swffm.de/wohnen/wohnheime/frankfurt-am-main/${slug}`;
    const source: SourceRef = {
      id: `swffm-${slug}`,
      kind: "webpage",
      url: canonicalUrl,
      retrievedAt: savedAt,
    };
    return {
      id: `swffm:${slug}`,
      provider: { id: "swffm", name: "Studierendenwerk Frankfurt am Main", role: "housing_provider" },
      externalId: slug,
      canonicalUrl,
      title: address,
      scope: "residence",
      address: `${address}, Frankfurt am Main`,
      locationPrecision: "unknown",
      availability: "unknown",
      monthlyCost: { amountCents: null, basis: "unknown", label: "Price not verified from current residence page", unknownComponents: ["Kaltmiete", "Nebenkosten", "utilities"] },
      contact: { role: "application_office", label: "Official Studierendenwerk application route", url: SWFFM_APPLICATION_URL },
      sourceRefs: [source],
      checkedAt: savedAt,
      demoPolicySlotId: `ffm-demo-${String(index + 1).padStart(3, "0")}`,
    };
  });
}

export function initialPolicyLinks(): DemoPolicyLink[] {
  return savedCatalog().map((listing, index) => ({
    slotId: `ffm-demo-${String(index + 1).padStart(3, "0")}`,
    listingId: listing.id,
    policyId: `policy-${String(index + 1).padStart(3, "0")}`,
    documentId: null,
    documentVersion: null,
    relation: "fictional_demo",
    status: "awaiting_document",
  }));
}

