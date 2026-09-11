import type { ChecklistTask, LegalFinding, PolicyFinding, SourceRef, Tenancy } from "@mainhaus/contracts";
import { legalSourceRef } from "./legal-registry.js";
import { stableId } from "./ids.js";

type Unit = { number: number; label: "page" | "section"; text: string };

const TOPICS = [
  { topic: "room", title: "Room and shared spaces", pattern: /zimmer|wohnfläche|möbl|inventar|gemeinschaft|room|furnish/i },
  { topic: "term", title: "Term, dates, and termination", pattern: /mietzeit|beginn|endet|befrist|kündig|termination|notice/i },
  { topic: "rent", title: "Rent and monthly costs", pattern: /kaltmiete|warmmiete|nebenkosten|betriebskosten|miete|rent|utilities/i },
  { topic: "deposit", title: "Kaution (security deposit)", pattern: /kaution|sicherheit|deposit/i },
  { topic: "rules", title: "Hausordnung (house rules)", pattern: /hausordnung|ruhezeit|gast|tier|rauch|reinigung|abfall|quiet|guest|pet|smok/i },
  { topic: "maintenance", title: "Maintenance and reporting defects", pattern: /mangel|schaden|instand|reparatur|defect|damage|maintenance/i },
  { topic: "handover", title: "Handover and evidence", pattern: /übergabe|protokoll|schlüssel|zähler|key|meter|handover|inventory/i },
  { topic: "move_out", title: "Move-out obligations", pattern: /auszug|rückgabe|renov|streichen|besenrein|move.out|return/i },
] as const;

function parseUnits(anchoredText: string): Unit[] {
  const markers = [...anchoredText.matchAll(/^\[\[(PAGE|SECTION) (\d+)\]\]\n/gm)];
  return markers.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = markers[index + 1]?.index ?? anchoredText.length;
    return { label: match[1] === "PAGE" ? "page" : "section", number: Number(match[2]), text: anchoredText.slice(start, end).trim() };
  });
}

function sourceRef(documentId: string, version: string, unit: Unit, excerpt: string): SourceRef {
  return {
    id: stableId("source", `${documentId}:${version}:${unit.label}:${unit.number}`),
    kind: "document",
    documentId,
    version,
    ...(unit.label === "page" ? { page: unit.number } : { section: String(unit.number) }),
    excerpt: excerpt.slice(0, 2_500),
  };
}

function bestClause(unit: Unit, pattern: RegExp) {
  const paragraphs = unit.text.split(/\n\s*\n|(?<=[.!?])\s+(?=[A-ZÄÖÜ])/).map((part) => part.trim()).filter(Boolean);
  return paragraphs.find((part) => pattern.test(part)) ?? unit.text.slice(0, 2_500);
}

export function analyzePolicyDeterministically(tenancyId: string, documentId: string, version: string, anchoredText: string): PolicyFinding[] {
  const units = parseUnits(anchoredText);
  return TOPICS.map(({ topic, title, pattern }) => {
    const unit = units.find((candidate) => pattern.test(candidate.text));
    const id = stableId("finding", `${tenancyId}:${version}:${topic}`);
    if (!unit) {
      return {
        id, tenancyId, documentVersion: version, topic, title,
        explanation: "Not specified in the supplied document",
        originalClause: "",
        sourceRefs: [],
        certainty: "unknown" as const,
        action: "Ask the provider to clarify this point before relying on an assumption.",
      };
    }
    const clause = bestClause(unit, pattern);
    return {
      id, tenancyId, documentVersion: version, topic, title,
      explanation: `The supplied document addresses ${title.toLowerCase()}. Review the exact clause and confirm any ambiguous dates or amounts with the provider.`,
      originalClause: clause,
      sourceRefs: [sourceRef(documentId, version, unit, clause)],
      certainty: "stated" as const,
      action: topic === "deposit" ? "Keep proof of each Kaution payment and link move-in condition evidence." : undefined,
    };
  });
}

function parseEuro(text: string): number | null {
  const match = text.match(/(?:€\s*|EUR\s*)?(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR)/i);
  if (!match?.[1]) return null;
  const raw = match[1].replace(/\s/g, "");
  const normalized = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw)
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

export function buildLegalReview(tenancy: Tenancy, findings: PolicyFinding[]): LegalFinding[] {
  const result: LegalFinding[] = [];
  const deposit = findings.find((finding) => finding.topic === "deposit" && finding.certainty === "stated");
  const rent = findings.find((finding) => finding.topic === "rent" && finding.certainty === "stated");
  if (deposit) {
    const depositCents = parseEuro(deposit.originalClause);
    const rentCents = rent ? parseEuro(rent.originalClause) : null;
    const excessive = depositCents !== null && rentCents !== null && depositCents > rentCents * 3;
    result.push({
      id: stableId("legal", `${tenancy.id}:deposit`), tenancyId: tenancy.id, policyFindingIds: [deposit.id],
      severity: excessive ? "potential_conflict" : "clarify",
      applicability: tenancy.classificationStatus === "confirmed" ? "applicable" : "applicability_uncertain",
      title: excessive ? "Stated deposit may exceed the general residential cap" : "Confirm deposit basis and instalment option",
      explanation: excessive
        ? "The stated Kaution appears higher than three times the detected monthly rent. This is a triage flag: the rent basis and tenancy classification still need confirmation."
        : "BGB §551 generally caps a residential cash deposit using monthly rent excluding separately stated operating costs and permits three instalments. Student-residence status preserves a specific interest exception, not an automatic removal of the cap or instalment checks.",
      contractEvidence: deposit.sourceRefs,
      legalEvidence: [legalSourceRef("deposit"), legalSourceRef("student_residence")],
      nextStep: "Ask the provider to identify the Kaltmiete basis, deposit handling, and payment schedule; seek tenant advice if the figures remain inconsistent.",
    });
  }

  const maintenance = findings.find((finding) => finding.topic === "maintenance");
  result.push({
    id: stableId("legal", `${tenancy.id}:wear`), tenancyId: tenancy.id,
    policyFindingIds: maintenance?.certainty === "stated" ? [maintenance.id] : [],
    severity: "information", applicability: "applicability_uncertain",
    title: "Normal use is different from chargeable damage",
    explanation: "BGB §538 distinguishes ordinary wear from damage. Photos and notes help organize observations but do not by themselves establish fault or a deduction amount.",
    contractEvidence: maintenance?.sourceRefs ?? [], legalEvidence: [legalSourceRef("ordinary_wear")],
    nextStep: "Record the handover condition and ask for an itemized claim before agreeing to a deduction.",
  });

  result.push({
    id: stableId("legal", `${tenancy.id}:registration`), tenancyId: tenancy.id, policyFindingIds: [],
    severity: "information", applicability: "applicability_uncertain", title: "Registration depends on actual move-in and personal circumstances",
    explanation: "The usual registration timeline runs from actual move-in, not contract signing. Existing German registration and intended stay can affect BMG §27 exceptions. A lease is not a Wohnungsgeberbestätigung, and MAINHAUS cannot issue one.",
    contractEvidence: [], legalEvidence: [legalSourceRef("registration")],
    nextStep: "Confirm your actual move-in date, existing registration, intended stay, and request the provider confirmation when applicable.",
  });
  return result;
}

function berlinDateOffset(date: string | undefined, days: number): string | undefined {
  if (!date) return undefined;
  const instant = new Date(`${date}T12:00:00+02:00`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

export function buildTasks(tenancy: Tenancy, findings: PolicyFinding[]): ChecklistTask[] {
  const moveIn = tenancy.confirmedDates.moveIn;
  const moveOut = tenancy.confirmedDates.moveOut;
  const practical: Array<[string, ChecklistTask["phase"], string, number | null, ChecklistTask["basis"]]> = [
    ["handover", "move_in", "Arrange the handover and Übergabeprotokoll", -3, "practical"],
    ["photos", "move_in", "Photograph each room, item, and pre-existing defect", 0, "practical"],
    ["keys", "move_in", "Record keys, inventory, and relevant meter readings", 0, "practical"],
    ["defects", "move_in", "Send a dated defect-notification draft for visible issues", 1, "legal_guidance"],
    ["confirmation", "move_in", "Request the Wohnungsgeberbestätigung if applicable", 1, "legal_guidance"],
    ["registration", "move_in", "Review Frankfurt registration steps and personal exceptions", 14, "legal_guidance"],
    ["notice", "move_out", "Confirm the contract-specific notice and return dates", -30, "contract"],
    ["compare", "move_out", "Compare move-in and move-out condition notes", -3, "practical"],
    ["return", "move_out", "Record cleaning, inventory, meters, and key return", 0, "practical"],
  ];
  return practical.map(([key, phase, title, offset, basis]) => {
    const related = findings.filter((finding) => {
      if (key === "notice") return finding.topic === "term";
      if (["handover", "keys", "photos", "compare", "return"].includes(key)) return ["handover", "move_out", "maintenance"].includes(finding.topic);
      if (key === "defects") return finding.topic === "maintenance";
      return false;
    }).flatMap((finding) => finding.sourceRefs);
    const baseDate = phase === "move_out" ? moveOut : moveIn;
    const dueDate = offset === null ? undefined : berlinDateOffset(baseDate, offset);
    return {
      id: stableId("task", `${tenancy.id}:${key}`), tenancyId: tenancy.id, phase, title,
      ...(dueDate ? { dueDate } : {}), status: "todo" as const, basis, sourceRefs: related, evidenceIds: [],
    };
  });
}

export function extractKnownCosts(findings: PolicyFinding[]) {
  const rent = findings.find((finding) => finding.topic === "rent" && finding.certainty === "stated");
  const deposit = findings.find((finding) => finding.topic === "deposit" && finding.certainty === "stated");
  return {
    knownMonthlyCents: rent ? parseEuro(rent.originalClause) : null,
    unknownComponents: rent ? [] : ["Kaltmiete", "Nebenkosten", "utilities/internet"],
    depositCents: deposit ? parseEuro(deposit.originalClause) : null,
    agreedDeductionsCents: 0,
    unresolvedClaimedDeductionsCents: 0,
    returnedCents: 0,
    remainingAccountingBalanceCents: deposit ? parseEuro(deposit.originalClause) : null,
  };
}
