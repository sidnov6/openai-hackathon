import type { SourceRef } from "@mainhaus/contracts";

export type LegalSource = {
  topic: string;
  statute: string;
  title: string;
  url: string;
  retrievedAt: string;
  applicability: string;
};

export const LEGAL_SOURCES: LegalSource[] = [
  { topic: "deposit", statute: "BGB §551", title: "Begrenzung und Anlage von Mietsicherheiten", url: "https://www.gesetze-im-internet.de/bgb/__551.html", retrievedAt: "2026-09-11T10:00:00+02:00", applicability: "Residential tenancies; preserve the §549(3) interest exception for student/youth residences." },
  { topic: "ordinary_wear", statute: "BGB §538", title: "Abnutzung der Mietsache durch vertragsgemäßen Gebrauch", url: "https://www.gesetze-im-internet.de/bgb/__538.html", retrievedAt: "2026-09-11T10:00:00+02:00", applicability: "Distinguishes normal contractual use from tenant-caused damage." },
  { topic: "operating_costs", statute: "BGB §556", title: "Vereinbarungen über Betriebskosten", url: "https://www.gesetze-im-internet.de/bgb/__556.html", retrievedAt: "2026-09-11T10:00:00+02:00", applicability: "Depends on whether the contract uses an advance or flat charge." },
  { topic: "student_residence", statute: "BGB §549(3)", title: "Auf Wohnraummietverhältnisse anwendbare Vorschriften", url: "https://www.gesetze-im-internet.de/bgb/__549.html", retrievedAt: "2026-09-11T10:00:00+02:00", applicability: "Requires a genuine student/youth residence classification; a marketing label alone is insufficient." },
  { topic: "notice", statute: "BGB §573c", title: "Fristen der ordentlichen Kündigung", url: "https://www.gesetze-im-internet.de/bgb/__573c.html", retrievedAt: "2026-09-11T10:00:00+02:00", applicability: "Contract and tenancy classification determine whether and how the general notice rule applies." },
  { topic: "defects", statute: "BGB §536c", title: "Während der Mietzeit auftretende Mängel; Mängelanzeige durch den Mieter", url: "https://www.gesetze-im-internet.de/bgb/__536c.html", retrievedAt: "2026-09-11T10:00:00+02:00", applicability: "Supports prompt defect reporting; does not itself justify an automated instruction to withhold rent." },
  { topic: "registration", statute: "BMG §§17, 19, 27", title: "Registration and housing-provider confirmation", url: "https://www.gesetze-im-internet.de/bmg/__17.html", retrievedAt: "2026-09-11T10:00:00+02:00", applicability: "Usually measured from actual move-in; exceptions depend on existing registration and intended stay." },
  { topic: "legal_service", statute: "RDG §§2, 3, 5", title: "Legal-services boundary", url: "https://www.gesetze-im-internet.de/rdg/BJNR284010007.html", retrievedAt: "2026-09-11T10:00:00+02:00", applicability: "MAINHAUS provides sourced information and triage, not a definitive individualized legal judgment." },
];

export function legalSourceRef(topic: string): SourceRef {
  const source = LEGAL_SOURCES.find((candidate) => candidate.topic === topic) ?? LEGAL_SOURCES.at(-1)!;
  return {
    id: `statute-${source.topic}`,
    kind: "statute",
    url: source.url,
    section: source.statute,
    excerpt: source.applicability,
    retrievedAt: source.retrievedAt,
  };
}

