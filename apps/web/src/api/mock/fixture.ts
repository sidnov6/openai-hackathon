import type {
  AnalysisStatus,
  ChecklistTask,
  CostBreakdown,
  DepositLedger,
  LegalFinding,
  LegalReviewStatus,
  PolicyDocument,
  PolicyFinding,
  SourceRef,
} from '../contracts.mirror'

/**
 * ============================================================================
 * UI FIXTURE LEASE - NOT ONE OF THE 20 SUPPLIED POLICY DOCUMENTS.
 * ============================================================================
 *
 * The 20 fictional policy documents and their template structure are deliberately NOT
 * generated in this repository. This file does NOT do that. It is a single, deliberately
 * named UI fixture whose only purpose is to drive the frontend's lease surfaces so they
 * can be built and tested independently of the document ingestion pipeline:
 *
 *   - the citation drawer (explanation beside the original German clause),
 *   - integer-cent cost arithmetic with unknown components excluded, not zeroed,
 *   - "Not specified in the supplied document" for an absent clause,
 *   - a flagged missing annex,
 *   - a legal flag with BOTH contract evidence and an official source,
 *   - the student-residence (BGB §549(3)) classification path,
 *   - tasks with no due date because the move-in date is not confirmed.
 *
 * Its document id is `doc-ui-fixture`, its fileName says what it is, and the UI labels
 * every one of its citations as fixture-sourced. Once the real 20 files are ingested,
 * this fixture is replaced by them and the mock adapter can drop it entirely.
 */

const FIXTURE_DOC_ID = 'doc-ui-fixture'
const FIXTURE_VERSION = 'fixture-v1'

const docRef = (id: string, page: number, section: string, excerpt: string): SourceRef => ({
  id,
  kind: 'document',
  documentId: FIXTURE_DOC_ID,
  version: FIXTURE_VERSION,
  page,
  section,
  excerpt,
  label: 'UI fixture lease (mock transport)',
})

const statuteRef = (id: string, section: string, url: string, excerpt: string): SourceRef => ({
  id,
  kind: 'statute',
  url,
  section,
  excerpt,
  label: `Gesetze im Internet - ${section}`,
  // Mock transport does not perform a live retrieval; the legal status below says so.
  retrievedAt: undefined,
})

export const FIXTURE_DOCUMENT: PolicyDocument = {
  id: FIXTURE_DOC_ID,
  policyId: 'policy-001',
  mode: 'demo',
  version: FIXTURE_VERSION,
  fileName: 'UI-FIXTURE-lease--not-a-supplied-policy.md',
  mediaType: 'text/markdown',
  pageOrSectionCount: 11,
  extractionStatus: 'partial',
  coverage: { unitsTotal: 11, unitsRead: 11, unit: 'section' },
  missingParts: [
    {
      kind: 'referenced_annex_not_supplied',
      detail: 'Section 9 refers to "Anlage 1 - Hausordnung" (house rules annex). That annex was not supplied, so quiet hours, guests, pets and waste separation cannot be read from it.',
    },
  ],
}

export const FIXTURE_ANALYSIS: AnalysisStatus = {
  status: 'partial',
  coverage: { unitsTotal: 11, unitsRead: 11, unit: 'section' },
  stage: 'Reconciled full-document extraction',
  failureReason: undefined,
  analysisVersion: 'fixture-analysis-v1',
  completedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
}

export const FIXTURE_FINDINGS: PolicyFinding[] = [
  {
    id: 'pf-room',
    tenancyId: '',
    documentId: FIXTURE_DOC_ID,
    documentVersion: FIXTURE_VERSION,
    topic: 'room_identity',
    title: 'Furnished room in a shared flat, 14 m², shared kitchen and bathroom',
    explanation:
      'You rent one furnished room of 14 m² inside a shared flat. Kitchen, bathroom and hallway are shared with the other residents. An inventory list is part of the agreement, so check it item by item at handover.',
    originalClause:
      '§1 Mietgegenstand. Vermietet wird ein möbliertes Zimmer (ca. 14 m²) in einer Wohngemeinschaft. Küche, Bad und Flur werden gemeinschaftlich genutzt. Das Inventarverzeichnis ist Bestandteil dieses Vertrages.',
    sourceRefs: [docRef('sr-room', 1, '§1 Mietgegenstand', 'Vermietet wird ein möbliertes Zimmer (ca. 14 m²) in einer Wohngemeinschaft.')],
    certainty: 'stated',
    action: 'Check every inventory item at handover and photograph anything already damaged.',
    dueDate: null,
    relatedTaskIds: ['task-inventory'],
  },
  {
    id: 'pf-type',
    tenancyId: '',
    documentId: FIXTURE_DOC_ID,
    documentVersion: FIXTURE_VERSION,
    topic: 'parties_and_type',
    title: 'Described as a student residence, with enrolment required throughout',
    explanation:
      'The agreement describes the building as a student residence and requires you to stay enrolled for the whole term. That description matters: a genuine student or youth residence is treated differently under German tenancy law. The wording alone is not proof of that status - the legal review keeps this open.',
    originalClause:
      '§2 Vertragszweck. Das Haus dient der Unterbringung von Studierenden (Studentenwohnheim). Der Mieter hat die Immatrikulation für die gesamte Vertragslaufzeit nachzuweisen.',
    sourceRefs: [docRef('sr-type', 1, '§2 Vertragszweck', 'Das Haus dient der Unterbringung von Studierenden (Studentenwohnheim).')],
    certainty: 'stated',
    action: 'Keep your enrolment certificate (Immatrikulationsbescheinigung) available.',
    dueDate: null,
    relatedTaskIds: [],
  },
  {
    id: 'pf-rent',
    tenancyId: '',
    documentId: FIXTURE_DOC_ID,
    documentVersion: FIXTURE_VERSION,
    topic: 'rent',
    title: 'Kaltmiete 315,00 EUR, due by the third working day of each month',
    explanation:
      'The cold rent (Kaltmiete) is 315,00 EUR per month - rent alone, before operating costs. It must arrive by the third working day of the month by bank transfer. Cash is excluded.',
    originalClause:
      '§3 Miete. Die Grundmiete (Kaltmiete) beträgt 315,00 EUR monatlich. Die Miete ist bis zum dritten Werktag eines jeden Monats unbar auf das Konto des Vermieters zu zahlen.',
    sourceRefs: [docRef('sr-rent', 2, '§3 Miete', 'Die Grundmiete (Kaltmiete) beträgt 315,00 EUR monatlich.')],
    certainty: 'stated',
    action: 'Set up a standing order that arrives before the third working day.',
    dueDate: null,
    relatedTaskIds: [],
  },
  {
    id: 'pf-nk',
    tenancyId: '',
    documentId: FIXTURE_DOC_ID,
    documentVersion: FIXTURE_VERSION,
    topic: 'operating_costs',
    title: 'Nebenkosten 85,00 EUR as an advance payment, settled once a year',
    explanation:
      'You pay 85,00 EUR per month towards operating costs. The agreement calls this a Vorauszahlung - an advance, not a flat charge. That difference matters: an advance is settled against actual costs once a year, so you may get money back or owe more. Internet is billed separately at 25,00 EUR. Electricity is your own contract and the agreement does not state an amount.',
    originalClause:
      '§4 Betriebskosten. Der Mieter leistet eine monatliche Vorauszahlung auf die Betriebskosten in Höhe von 85,00 EUR. Über die Betriebskosten wird jährlich abgerechnet. Der Internetanschluss wird gesondert mit 25,00 EUR monatlich berechnet. Strom ist vom Mieter direkt mit dem Versorger abzurechnen.',
    sourceRefs: [docRef('sr-nk', 2, '§4 Betriebskosten', 'Der Mieter leistet eine monatliche Vorauszahlung auf die Betriebskosten in Höhe von 85,00 EUR.')],
    certainty: 'stated',
    action: 'Expect an annual statement. Keep it - you can check it and object within the statutory window.',
    dueDate: null,
    relatedTaskIds: [],
  },
  {
    id: 'pf-deposit',
    tenancyId: '',
    documentId: FIXTURE_DOC_ID,
    documentVersion: FIXTURE_VERSION,
    topic: 'deposit',
    title: 'Deposit stated as four months of cold rent, payable in full before handover',
    explanation:
      'The agreement asks for 1.260,00 EUR - four times the cold rent - in one payment before you get the keys. It also says the deposit is forfeited if you leave early. Both points are recorded here exactly as the document states them. The legal review flags them separately; a clause in a contract is not automatically the law.',
    originalClause:
      '§5 Kaution. Der Mieter leistet eine Sicherheit in Höhe von vier Monatsgrundmieten (1.260,00 EUR). Die Kaution ist vollständig vor Übergabe der Schlüssel zu hinterlegen. Bei vorzeitigem Auszug verfällt die Kaution.',
    sourceRefs: [docRef('sr-deposit', 3, '§5 Kaution', 'Der Mieter leistet eine Sicherheit in Höhe von vier Monatsgrundmieten (1.260,00 EUR).')],
    certainty: 'stated',
    action: 'Before paying, ask the provider in writing how the deposit amount and the single payment are justified.',
    dueDate: null,
    relatedTaskIds: ['task-deposit'],
  },
  {
    id: 'pf-notice',
    tenancyId: '',
    documentId: FIXTURE_DOC_ID,
    documentVersion: FIXTURE_VERSION,
    topic: 'term_and_notice',
    title: 'Fixed term of 12 months; notice must reach the provider three months before the end',
    explanation:
      'The agreement runs for a fixed 12 months. To end it you must give written notice that arrives at least three months before the end date. There is no clause allowing you to leave earlier, and the start date is written as "beginning of the semester" rather than a calendar date.',
    originalClause:
      '§6 Mietzeit und Kündigung. Das Mietverhältnis wird auf die Dauer von 12 Monaten fest abgeschlossen und beginnt zum Semesterbeginn. Die Kündigung hat schriftlich und spätestens drei Monate vor Vertragsende zu erfolgen.',
    sourceRefs: [docRef('sr-notice', 3, '§6 Mietzeit und Kündigung', 'Das Mietverhältnis wird auf die Dauer von 12 Monaten fest abgeschlossen und beginnt zum Semesterbeginn.')],
    certainty: 'stated',
    action: 'Get the exact start date in writing from the provider - the document does not give a calendar date.',
    dueDate: null,
    relatedTaskIds: ['task-dates'],
  },
  {
    id: 'pf-wear',
    tenancyId: '',
    documentId: FIXTURE_DOC_ID,
    documentVersion: FIXTURE_VERSION,
    topic: 'move_out_obligations',
    title: 'Requires repainting at move-out regardless of the room condition',
    explanation:
      'The agreement says you must have the room professionally repainted when you leave, whatever condition it is in, and that 150,00 EUR is charged if you do not. It is recorded here as written. Whether ordinary use can be charged for is a separate legal question, flagged in the legal review.',
    originalClause:
      '§10 Rückgabe. Der Mieter hat das Zimmer bei Auszug unabhängig vom Zustand fachgerecht renovieren (streichen) zu lassen. Andernfalls wird eine Pauschale von 150,00 EUR einbehalten.',
    sourceRefs: [docRef('sr-wear', 8, '§10 Rückgabe', 'Der Mieter hat das Zimmer bei Auszug unabhängig vom Zustand fachgerecht renovieren (streichen) zu lassen.')],
    certainty: 'stated',
    action: 'Photograph the walls at move-in. That record is what a repainting demand is measured against.',
    dueDate: null,
    relatedTaskIds: ['task-photos'],
  },
  {
    id: 'pf-handover',
    tenancyId: '',
    documentId: FIXTURE_DOC_ID,
    documentVersion: FIXTURE_VERSION,
    topic: 'handover',
    title: 'A handover record (Übergabeprotokoll) is signed by both sides at move-in',
    explanation:
      'Both you and the provider sign a handover record listing existing defects and meter readings. Defects that are not in it are much harder to argue about later. Two keys and one mailbox key are handed over.',
    originalClause:
      '§8 Übergabe. Bei Einzug wird ein Übergabeprotokoll erstellt und von beiden Parteien unterzeichnet. Vorhandene Mängel und Zählerstände sind darin aufzunehmen. Übergeben werden zwei Zimmerschlüssel und ein Briefkastenschlüssel.',
    sourceRefs: [docRef('sr-handover', 6, '§8 Übergabe', 'Bei Einzug wird ein Übergabeprotokoll erstellt und von beiden Parteien unterzeichnet.')],
    certainty: 'stated',
    action: 'Do not sign the handover record until every defect you can see is written into it.',
    dueDate: null,
    relatedTaskIds: ['task-handover', 'task-photos', 'task-meter'],
  },
  {
    id: 'pf-defects',
    tenancyId: '',
    documentId: FIXTURE_DOC_ID,
    documentVersion: FIXTURE_VERSION,
    topic: 'maintenance',
    title: 'Defects must be reported to the caretaker without delay, in text form',
    explanation:
      'Any defect must be reported to the caretaker without delay and in text form (email is enough). Reporting promptly is your obligation; keep a copy of what you sent and when.',
    originalClause:
      '§7 Instandhaltung. Mängel sind dem Hausmeister unverzüglich in Textform anzuzeigen.',
    sourceRefs: [docRef('sr-defects', 5, '§7 Instandhaltung', 'Mängel sind dem Hausmeister unverzüglich in Textform anzuzeigen.')],
    certainty: 'stated',
    action: 'Report defects by email so you keep a dated copy.',
    dueDate: null,
    relatedTaskIds: ['task-defect-draft'],
  },
  {
    id: 'pf-rules',
    tenancyId: '',
    documentId: FIXTURE_DOC_ID,
    documentVersion: FIXTURE_VERSION,
    topic: 'house_rules',
    title: 'House rules are referenced as Annex 1, which was not supplied',
    explanation:
      'Section 9 makes an annexed Hausordnung binding, but that annex is not part of the supplied document. Quiet hours, guest rules, waste separation and use of common areas therefore cannot be read here.',
    originalClause: '§9 Hausordnung. Die als Anlage 1 beigefügte Hausordnung ist Bestandteil dieses Vertrages.',
    sourceRefs: [docRef('sr-rules', 7, '§9 Hausordnung', 'Die als Anlage 1 beigefügte Hausordnung ist Bestandteil dieses Vertrages.')],
    certainty: 'stated',
    action: 'Ask the provider for Annex 1 (Hausordnung) before you sign.',
    dueDate: null,
    relatedTaskIds: [],
  },
  {
    id: 'pf-pets',
    tenancyId: '',
    documentId: FIXTURE_DOC_ID,
    documentVersion: FIXTURE_VERSION,
    topic: 'house_rules',
    title: 'Pets',
    // The explicit "absent clause" state required by brief section 9.
    explanation: 'Not specified in the supplied document.',
    originalClause: null,
    sourceRefs: [],
    certainty: 'unknown',
    action: 'Ask the provider directly. Do not assume the rule from another building.',
    dueDate: null,
    relatedTaskIds: [],
  },
  {
    id: 'pf-sublet',
    tenancyId: '',
    documentId: FIXTURE_DOC_ID,
    documentVersion: FIXTURE_VERSION,
    topic: 'house_rules',
    title: 'Subletting requires written consent and is excluded during semester breaks',
    explanation:
      'You may not pass the room on to anyone else without written consent, and the agreement excludes subletting during semester breaks entirely.',
    originalClause:
      '§9.4 Untervermietung. Eine Überlassung des Zimmers an Dritte bedarf der vorherigen schriftlichen Zustimmung des Vermieters. Während der vorlesungsfreien Zeit ist eine Untervermietung ausgeschlossen.',
    sourceRefs: [docRef('sr-sublet', 7, '§9.4 Untervermietung', 'Eine Überlassung des Zimmers an Dritte bedarf der vorherigen schriftlichen Zustimmung des Vermieters.')],
    certainty: 'stated',
    action: null,
    dueDate: null,
    relatedTaskIds: [],
  },
]

export const FIXTURE_LEGAL_STATUS: LegalReviewStatus = {
  // Deliberately partial so the "legal source unavailable" state is exercised.
  status: 'partial',
  unavailableSources: [
    {
      label: 'Frankfurt registration guidance (frankfurt.de)',
      reason: 'Not retrieved in sample-data mode. Registration guidance below is therefore general and not confirmed against the current Frankfurt page.',
    },
  ],
  checkedTopics: ['Deposit (BGB §551)', 'Ordinary wear (BGB §538)', 'Operating costs (BGB §556)', 'Residence scope (BGB §549(3))', 'Notice (BGB §573c)', 'Defects (BGB §536c)'],
  retrievedAt: undefined,
}

export const FIXTURE_LEGAL_FINDINGS: LegalFinding[] = [
  {
    id: 'lf-deposit-cap',
    tenancyId: '',
    policyFindingIds: ['pf-deposit'],
    severity: 'potential_conflict',
    applicability: 'applies',
    applicabilityNote:
      'The deposit cap in BGB §551 is not among the provisions disapplied for student and youth residences by BGB §549(3), so it applies here even if the residence classification is confirmed.',
    title: 'The deposit is stated as four months of cold rent; BGB §551 generally caps it at three',
    explanation:
      'For residential tenancies, BGB §551(1) generally limits a security deposit to three months of rent, counted excluding operating costs that are shown separately. The agreement asks for four months of cold rent (1.260,00 EUR); three months would be 945,00 EUR. This is a difference of 315,00 EUR between what the document asks for and the usual statutory ceiling.',
    contractEvidence: [docRef('le-deposit-c', 3, '§5 Kaution', 'Der Mieter leistet eine Sicherheit in Höhe von vier Monatsgrundmieten (1.260,00 EUR).')],
    legalEvidence: [
      statuteRef('le-551', 'BGB §551', 'https://www.gesetze-im-internet.de/bgb/__551.html', 'Hat der Mieter dem Vermieter für die Erfüllung seiner Pflichten Sicherheit zu leisten, so darf diese vorbehaltlich des Absatzes 3 Satz 4 höchstens das Dreifache der auf einen Monat entfallenden Miete ohne die als Pauschale oder als Vorauszahlung ausgewiesenen Betriebskosten betragen.'),
    ],
    nextStep: 'Ask the provider in writing on what basis the deposit exceeds three months of cold rent, before you transfer anything.',
  },
  {
    id: 'lf-deposit-instalments',
    tenancyId: '',
    policyFindingIds: ['pf-deposit'],
    severity: 'potential_conflict',
    applicability: 'applies',
    applicabilityNote: 'BGB §551(2) applies to a cash deposit in a residential tenancy and is not disapplied by §549(3).',
    title: 'Full payment before handover is demanded; BGB §551(2) allows three equal instalments',
    explanation:
      'Where the deposit is a sum of money, BGB §551(2) entitles the tenant to pay it in three equal monthly instalments, the first of which becomes due at the start of the tenancy. The agreement instead requires the whole 1.260,00 EUR before the keys are handed over.',
    contractEvidence: [docRef('le-inst-c', 3, '§5 Kaution', 'Die Kaution ist vollständig vor Übergabe der Schlüssel zu hinterlegen.')],
    legalEvidence: [
      statuteRef('le-551-2', 'BGB §551(2)', 'https://www.gesetze-im-internet.de/bgb/__551.html', 'Ist als Sicherheit eine Geldsumme bereitzustellen, so ist der Mieter zu drei gleichen monatlichen Teilzahlungen berechtigt. Die erste Teilzahlung ist zu Beginn des Mietverhältnisses fällig.'),
    ],
    nextStep: 'Ask whether you may pay the deposit in three monthly instalments starting at the beginning of the tenancy.',
  },
  {
    id: 'lf-deposit-forfeit',
    tenancyId: '',
    policyFindingIds: ['pf-deposit'],
    severity: 'clarify',
    applicability: 'may_apply',
    applicabilityNote: 'Whether an automatic-forfeiture clause holds up depends on facts this tool cannot establish. It is recorded as a contract claim, not as law.',
    title: 'The document says the deposit "is forfeited" on early departure',
    explanation:
      'A deposit secures the provider\'s claims arising from the tenancy; it is not described in the statute as a penalty that falls in automatically. The agreement nonetheless states outright forfeiture on early departure. That is preserved here as what the contract says - it is not confirmed as an enforceable outcome.',
    contractEvidence: [docRef('le-forfeit-c', 3, '§5 Kaution', 'Bei vorzeitigem Auszug verfällt die Kaution.')],
    legalEvidence: [
      statuteRef('le-551-f', 'BGB §551', 'https://www.gesetze-im-internet.de/bgb/__551.html', 'Sicherheitsleistung des Mieters.'),
    ],
    nextStep: 'If early departure becomes likely, take this clause to a tenant advice service (Mieterverein) before agreeing to anything.',
  },
  {
    id: 'lf-wear',
    tenancyId: '',
    policyFindingIds: ['pf-wear'],
    severity: 'potential_conflict',
    applicability: 'applies',
    applicabilityNote: 'BGB §538 concerns changes or deterioration caused by contractual use and is not disapplied by §549(3).',
    title: 'Repainting is demanded "regardless of condition"; BGB §538 excludes ordinary wear',
    explanation:
      'Under BGB §538 the tenant is not answerable for changes or deterioration of the rented property brought about by use in accordance with the contract. A clause requiring professional repainting whatever the actual condition, with a 150,00 EUR charge if you do not, does not distinguish ordinary wear from damage.',
    contractEvidence: [docRef('le-wear-c', 8, '§10 Rückgabe', 'Der Mieter hat das Zimmer bei Auszug unabhängig vom Zustand fachgerecht renovieren (streichen) zu lassen.')],
    legalEvidence: [
      statuteRef('le-538', 'BGB §538', 'https://www.gesetze-im-internet.de/bgb/__538.html', 'Veränderungen oder Verschlechterungen der Mietsache, die durch den vertragsgemäßen Gebrauch herbeigeführt werden, hat der Mieter nicht zu vertreten.'),
    ],
    nextStep: 'Document the wall condition at move-in and at move-out, and ask the provider to identify damage beyond ordinary use before any charge is made.',
  },
  {
    id: 'lf-residence-scope',
    tenancyId: '',
    policyFindingIds: ['pf-type'],
    severity: 'information',
    applicability: 'applicability_uncertain',
    applicabilityNote:
      'Classification is not confirmed. The document describes a Studentenwohnheim, but marketing or descriptive wording is not itself proof; genuine status usually turns on how places are actually allocated - for example rotation and a published allocation policy.',
    title: 'Student-residence status changes which tenancy rules apply - and which still do',
    explanation:
      'BGB §549(3) disapplies certain tenant-protection provisions for rooms in a student or youth residence. That is why classification is checked before general rent and termination rules are applied. It does not switch off everything: the deposit rules in §551 and the ordinary-wear rule in §538 are outside the list of provisions disapplied, which is why the flags above still stand. Separately, §551(3) sentence 4 removes the interest-bearing requirement for deposits in a student or youth residence - that exception is preserved here without weakening the cap or the instalment right.',
    contractEvidence: [docRef('le-scope-c', 1, '§2 Vertragszweck', 'Das Haus dient der Unterbringung von Studierenden (Studentenwohnheim).')],
    legalEvidence: [
      statuteRef('le-549', 'BGB §549(3)', 'https://www.gesetze-im-internet.de/bgb/__549.html', 'Für Wohnraum in einem Studenten- oder Jugendwohnheim gelten die §557 bis 561, §568 Abs. 2, §573, §573a, §573d Abs. 1, §575, §575a Abs. 1, §577 und §577a nicht.'),
      statuteRef('le-551-3', 'BGB §551(3)', 'https://www.gesetze-im-internet.de/bgb/__551.html', 'Bei Wohnraum in einem Studenten- oder Jugendwohnheim besteht keine Pflicht zur Verzinsung.'),
    ],
    nextStep: 'Ask the provider how places are allocated and whether an allocation policy is published. That evidence, not the name, settles the classification.',
  },
  {
    id: 'lf-nk',
    tenancyId: '',
    policyFindingIds: ['pf-nk'],
    severity: 'information',
    applicability: 'applies',
    applicabilityNote: 'BGB §556 applies where operating costs are agreed. The agreement states an advance payment (Vorauszahlung), not a flat charge.',
    title: 'Your 85,00 EUR is an advance, so it is settled against real costs each year',
    explanation:
      'BGB §556 distinguishes a flat charge (Pauschale), which is not settled, from an advance payment (Vorauszahlung), which is. Your agreement uses Vorauszahlung, so you should receive an annual statement and can be refunded or asked for more. The statute also sets the period within which the landlord must provide that statement.',
    contractEvidence: [docRef('le-nk-c', 2, '§4 Betriebskosten', 'Der Mieter leistet eine monatliche Vorauszahlung auf die Betriebskosten in Höhe von 85,00 EUR.')],
    legalEvidence: [
      statuteRef('le-556', 'BGB §556', 'https://www.gesetze-im-internet.de/bgb/__556.html', 'Die Vertragsparteien können vereinbaren, dass der Mieter Betriebskosten trägt. Über Vorauszahlungen für Betriebskosten ist jährlich abzurechnen.'),
    ],
    nextStep: 'Keep the annual operating-cost statement when it arrives and check it against this figure.',
  },
  {
    id: 'lf-notice',
    tenancyId: '',
    policyFindingIds: ['pf-notice'],
    severity: 'clarify',
    applicability: 'applicability_uncertain',
    applicabilityNote:
      'The statutory notice periods in BGB §573c are written for tenancies of indefinite duration. This agreement is a fixed 12-month term, and student-residence classification is not confirmed, so the applicable rule cannot be settled from the document alone.',
    title: 'A three-month notice requirement is stated - which rule governs it is not settled here',
    explanation:
      'The agreement requires notice three months before the end of a fixed 12-month term. Statutory notice periods under BGB §573c are framed for open-ended tenancies, and a fixed-term agreement works differently. Because the document gives no calendar start date and the residence classification is unconfirmed, this tool does not assert a single notice rule for you.',
    contractEvidence: [docRef('le-notice-c', 3, '§6 Mietzeit und Kündigung', 'Die Kündigung hat schriftlich und spätestens drei Monate vor Vertragsende zu erfolgen.')],
    legalEvidence: [
      statuteRef('le-573c', 'BGB §573c', 'https://www.gesetze-im-internet.de/bgb/__573c.html', 'Die Kündigung ist spätestens am dritten Werktag eines Kalendermonats zum Ablauf des übernächsten Monats zulässig.'),
    ],
    nextStep: 'Get the exact contract start and end dates in writing, then confirm the notice deadline with the provider or a tenant adviser.',
  },
  {
    id: 'lf-defects',
    tenancyId: '',
    policyFindingIds: ['pf-defects'],
    severity: 'information',
    applicability: 'applies',
    applicabilityNote: 'BGB §536c applies generally to reporting defects during the tenancy.',
    title: 'Reporting defects promptly is a statutory obligation, not only a contract term',
    explanation:
      'BGB §536c requires the tenant to notify the landlord of a defect without delay. Failing to report can cost you rights you would otherwise have. This is about reporting and evidence - it is not an instruction to reduce or withhold rent, which is a separate question you should not decide from this screen.',
    contractEvidence: [docRef('le-def-c', 5, '§7 Instandhaltung', 'Mängel sind dem Hausmeister unverzüglich in Textform anzuzeigen.')],
    legalEvidence: [
      statuteRef('le-536c', 'BGB §536c', 'https://www.gesetze-im-internet.de/bgb/__536c.html', 'Zeigt sich im Laufe der Mietzeit ein Mangel der Mietsache, so hat der Mieter dies dem Vermieter unverzüglich anzuzeigen.'),
    ],
    nextStep: 'Send defect reports by email so the date is recorded, and attach the photos you took at handover.',
  },
]

/**
 * Cost arithmetic in integer cents. Electricity is UNKNOWN and is therefore excluded
 * from the total and named in `excludedComponents` - it is never added as 0.
 */
export const FIXTURE_COSTS: CostBreakdown = {
  knownMonthlyTotalCents: 31500 + 8500 + 2500,
  components: [
    { label: 'Cold rent', germanTerm: 'Kaltmiete', amountCents: 31500, cadence: 'monthly', chargeKind: 'direct', sourceRefs: [docRef('c-kalt', 2, '§3 Miete', 'Die Grundmiete (Kaltmiete) beträgt 315,00 EUR monatlich.')] },
    { label: 'Operating costs (advance)', germanTerm: 'Nebenkosten (Vorauszahlung)', amountCents: 8500, cadence: 'monthly', chargeKind: 'advance', sourceRefs: [docRef('c-nk', 2, '§4 Betriebskosten', 'monatliche Vorauszahlung auf die Betriebskosten in Höhe von 85,00 EUR')] },
    { label: 'Internet', germanTerm: 'Internetanschluss', amountCents: 2500, cadence: 'monthly', chargeKind: 'direct', sourceRefs: [docRef('c-net', 2, '§4 Betriebskosten', 'Der Internetanschluss wird gesondert mit 25,00 EUR monatlich berechnet.')] },
    { label: 'Electricity', germanTerm: 'Strom', amountCents: null, cadence: 'monthly', chargeKind: 'direct', sourceRefs: [docRef('c-strom', 2, '§4 Betriebskosten', 'Strom ist vom Mieter direkt mit dem Versorger abzurechnen.')] },
  ],
  excludedComponents: [
    { label: 'Electricity', reason: 'Your own contract with a supplier. The document states no amount.' },
  ],
  depositCents: 126000,
  depositInstalments: [
    { label: 'Full amount before handover, as the document requires', amountCents: 126000, dueDate: null },
  ],
  initialCashCents: 40000 + 126000,
  initialCashComponents: [
    { label: 'First month (Warmmiete as stated)', amountCents: 40000 },
    { label: 'Deposit as the document demands it', amountCents: 126000 },
  ],
  // Internet and electricity start dates are not stated, so this figure is not the whole story.
  initialCashIncomplete: true,
}

export const FIXTURE_DEPOSIT: DepositLedger = {
  originalDepositCents: 126000,
  agreedDeductions: [],
  claimedDeductions: [],
  returnedCents: null,
  remainingBalanceCents: null,
  balanceIncomplete: true,
}

/**
 * Move-in / move-out tasks. Note the null dueDates: the fixture's contract start date is
 * "Semesterbeginn" with no calendar date, so no deadline is invented. Each task says why.
 */
export const FIXTURE_TASKS: ChecklistTask[] = [
  {
    id: 'task-dates',
    tenancyId: '',
    phase: 'move_in',
    title: 'Get the exact contract start date in writing',
    detail: 'The document says the tenancy begins "zum Semesterbeginn" and gives no calendar date. Every other deadline depends on this.',
    dueDate: null,
    dueDateBlockedReason: 'The document does not state a calendar start date.',
    status: 'todo',
    basis: 'contract',
    sourceRefs: [docRef('t-dates', 3, '§6 Mietzeit und Kündigung', 'beginnt zum Semesterbeginn')],
    evidenceIds: [],
  },
  {
    id: 'task-handover',
    tenancyId: '',
    phase: 'move_in',
    title: 'Arrange the handover and insist on a signed Übergabeprotokoll',
    detail: 'Both parties sign it. Existing defects and meter readings belong in it. Do not sign before you have looked properly.',
    dueDate: null,
    dueDateBlockedReason: 'Depends on the confirmed move-in date.',
    status: 'todo',
    basis: 'contract',
    sourceRefs: [docRef('t-hand', 6, '§8 Übergabe', 'Bei Einzug wird ein Übergabeprotokoll erstellt und von beiden Parteien unterzeichnet.')],
    evidenceIds: [],
  },
  {
    id: 'task-photos',
    tenancyId: '',
    phase: 'move_in',
    title: 'Photograph every room surface, especially the walls',
    detail: 'The agreement demands repainting at move-out regardless of condition. Photographs taken at handover are what any later demand is measured against.',
    dueDate: null,
    dueDateBlockedReason: 'Depends on the confirmed move-in date.',
    status: 'todo',
    basis: 'contract',
    sourceRefs: [docRef('t-photo', 8, '§10 Rückgabe', 'unabhängig vom Zustand fachgerecht renovieren')],
    evidenceIds: [],
  },
  {
    id: 'task-inventory',
    tenancyId: '',
    phase: 'move_in',
    title: 'Check the furniture inventory item by item',
    detail: 'The inventory list is part of the agreement. Anything already damaged must be written down before you sign.',
    dueDate: null,
    dueDateBlockedReason: 'Depends on the confirmed move-in date.',
    status: 'todo',
    basis: 'contract',
    sourceRefs: [docRef('t-inv', 1, '§1 Mietgegenstand', 'Das Inventarverzeichnis ist Bestandteil dieses Vertrages.')],
    evidenceIds: [],
  },
  {
    id: 'task-meter',
    tenancyId: '',
    phase: 'move_in',
    title: 'Record the meter readings at handover',
    detail: 'Electricity is your own contract, so the reading at handover is the start of what you are billed for.',
    dueDate: null,
    dueDateBlockedReason: 'Depends on the confirmed move-in date.',
    status: 'todo',
    basis: 'contract',
    sourceRefs: [docRef('t-meter', 6, '§8 Übergabe', 'Vorhandene Mängel und Zählerstände sind darin aufzunehmen.')],
    evidenceIds: [],
  },
  {
    id: 'task-deposit',
    tenancyId: '',
    phase: 'move_in',
    title: 'Ask about the deposit amount and instalments before transferring money',
    detail: 'The document asks for four months of cold rent in one payment. Two separate legal flags apply. Ask in writing first.',
    dueDate: null,
    dueDateBlockedReason: 'Depends on the confirmed move-in date.',
    status: 'todo',
    basis: 'legal_guidance',
    sourceRefs: [
      docRef('t-dep', 3, '§5 Kaution', 'vier Monatsgrundmieten (1.260,00 EUR)'),
      statuteRef('t-dep-551', 'BGB §551', 'https://www.gesetze-im-internet.de/bgb/__551.html', 'höchstens das Dreifache der auf einen Monat entfallenden Miete'),
    ],
    evidenceIds: [],
  },
  {
    id: 'task-defect-draft',
    tenancyId: '',
    phase: 'move_in',
    title: 'Prepare a defect notification you can send the same day',
    detail: 'Defects must be reported without delay in text form. Having the email ready means nothing is lost in the first busy week.',
    dueDate: null,
    dueDateBlockedReason: 'Depends on the confirmed move-in date.',
    status: 'todo',
    basis: 'contract',
    sourceRefs: [docRef('t-def', 5, '§7 Instandhaltung', 'Mängel sind dem Hausmeister unverzüglich in Textform anzuzeigen.')],
    evidenceIds: [],
  },
  {
    id: 'task-wgb',
    tenancyId: '',
    phase: 'move_in',
    title: 'Request the Wohnungsgeberbestätigung from the provider',
    detail: 'You need the housing-provider confirmation to register your address. Homi cannot issue or sign it - only the provider can.',
    dueDate: null,
    dueDateBlockedReason: 'Depends on the confirmed move-in date.',
    status: 'todo',
    basis: 'legal_guidance',
    sourceRefs: [statuteRef('t-bmg19', 'BMG §19', 'https://www.gesetze-im-internet.de/bmg/__19.html', 'Der Wohnungsgeber ist verpflichtet, bei der Anmeldung mitzuwirken.')],
    evidenceIds: [],
  },
  {
    id: 'task-register',
    tenancyId: '',
    phase: 'move_in',
    title: 'Register your address in Frankfurt',
    detail: 'The registration deadline normally counts from when you actually move in, not from when you sign. Answer the registration questions in Move-in so this task can be given a real date and the exceptions can be checked.',
    dueDate: null,
    dueDateBlockedReason: 'Needs your actual move-in date and your answers to the registration questions.',
    status: 'todo',
    basis: 'legal_guidance',
    sourceRefs: [statuteRef('t-bmg17', 'BMG §17', 'https://www.gesetze-im-internet.de/bmg/__17.html', 'Wer eine Wohnung bezieht, hat sich innerhalb von zwei Wochen nach dem Einzug bei der Meldebehörde anzumelden.')],
    evidenceIds: [],
  },
  {
    id: 'task-mo-notice',
    tenancyId: '',
    phase: 'move_out',
    title: 'Work out the notice deadline once the dates are confirmed',
    detail: 'Three months before the end of a fixed 12-month term - but the end date is not in the document and the applicable rule is flagged as unsettled.',
    dueDate: null,
    dueDateBlockedReason: 'Needs the confirmed contract end date.',
    status: 'todo',
    basis: 'contract',
    sourceRefs: [docRef('t-mo-not', 3, '§6 Mietzeit und Kündigung', 'spätestens drei Monate vor Vertragsende')],
    evidenceIds: [],
  },
  {
    id: 'task-mo-photos',
    tenancyId: '',
    phase: 'move_out',
    title: 'Photograph the same surfaces again, in the same order',
    detail: 'Matching each move-out photo to its move-in photo is what makes the comparison readable to someone who was not there.',
    dueDate: null,
    dueDateBlockedReason: 'Needs the confirmed move-out date.',
    status: 'todo',
    basis: 'practical',
    sourceRefs: [],
    evidenceIds: [],
  },
  {
    id: 'task-mo-clean',
    tenancyId: '',
    phase: 'move_out',
    title: 'Check what cleaning and repainting is actually being demanded',
    detail: 'The clause demands repainting regardless of condition and 150,00 EUR otherwise. A legal flag applies. Do not agree to a deduction before checking it.',
    dueDate: null,
    dueDateBlockedReason: 'Needs the confirmed move-out date.',
    status: 'todo',
    basis: 'legal_guidance',
    sourceRefs: [
      docRef('t-mo-clean', 8, '§10 Rückgabe', 'Andernfalls wird eine Pauschale von 150,00 EUR einbehalten.'),
      statuteRef('t-mo-538', 'BGB §538', 'https://www.gesetze-im-internet.de/bgb/__538.html', 'Veränderungen oder Verschlechterungen der Mietsache durch vertragsgemäßen Gebrauch hat der Mieter nicht zu vertreten.'),
    ],
    evidenceIds: [],
  },
  {
    id: 'task-mo-keys',
    tenancyId: '',
    phase: 'move_out',
    title: 'Return two room keys and one mailbox key, and get a receipt',
    detail: 'The handover section names exactly these keys. Ask for written confirmation that all of them came back.',
    dueDate: null,
    dueDateBlockedReason: 'Needs the confirmed move-out date.',
    status: 'todo',
    basis: 'contract',
    sourceRefs: [docRef('t-mo-keys', 6, '§8 Übergabe', 'Übergeben werden zwei Zimmerschlüssel und ein Briefkastenschlüssel.')],
    evidenceIds: [],
  },
  {
    id: 'task-mo-meter',
    tenancyId: '',
    phase: 'move_out',
    title: 'Record the closing meter readings',
    detail: 'Photograph the meters with the readings legible, on the day you hand back the keys.',
    dueDate: null,
    dueDateBlockedReason: 'Needs the confirmed move-out date.',
    status: 'todo',
    basis: 'contract',
    sourceRefs: [docRef('t-mo-meter', 6, '§8 Übergabe', 'Zählerstände sind aufzunehmen.')],
    evidenceIds: [],
  },
]
