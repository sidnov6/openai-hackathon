import type { DemoPolicyLink, Listing, SourceRef } from '../contracts.mirror'

/**
 * ============================================================================
 * SAMPLE DATA - MOCK TRANSPORT ONLY. NOT REAL FRANKFURT LISTINGS.
 * ============================================================================
 *
 * The brief forbids inventing operators, landlord identities, phone numbers, room
 * prices, photos or coordinates for REAL listings. Nothing here claims to be real:
 *
 *   - every provider is the string "SAMPLE DATA", never a real operator name,
 *   - every canonicalUrl is on example.org (RFC 2606 reserved documentation domain),
 *   - every title is suffixed "(sample)",
 *   - every record carries a sourceRef whose label says it is generated sample data,
 *   - the app shows a persistent "Sample data" banner whenever this adapter is active.
 *
 * Its only job is to exercise the UI states independently of the real discovery
 * pipeline in apps/api. Coordinates are plausible points in Frankfurt
 * districts so the map geometry can be evaluated; they are marked `approximate` and are
 * not asserted to be any building's location.
 */

const SAMPLE_SOURCE = (id: string, note: string): SourceRef => ({
  id,
  kind: 'webpage',
  url: 'https://example.org/mainhaus-sample/discovery',
  label: 'Generated sample data (mock transport) - not a real source',
  excerpt: note,
  retrievedAt: new Date().toISOString(),
})

type Seed = {
  id: string
  district: string
  lat: number
  lng: number
  scope: 'residence' | 'room'
  availability: Listing['availability']
  roomType: Listing['roomType']
  kalt: number | null
  neben: number | null
  warm: number | null
  basis: 'kalt' | 'warm' | 'unknown'
  slot: string | null
  contactRole: NonNullable<Listing['contact']>['role']
  hasEmail: boolean
  evidence: string | null
}

const SEEDS: Seed[] = [
  { id: 'sample-001', district: 'Bockenheim', lat: 50.1249, lng: 8.6435, scope: 'residence', availability: 'applications_open', roomType: 'room_in_shared_flat', kalt: 31500, neben: 8500, warm: 40000, basis: 'warm', slot: 'ffm-demo-001', contactRole: 'application_portal', hasEmail: true, evidence: 'Sample page states applications are open for the winter semester.' },
  { id: 'sample-002', district: 'Westend-Süd', lat: 50.1188, lng: 8.6592, scope: 'room', availability: 'offer_reported', roomType: 'single_apartment', kalt: 46000, neben: 11000, warm: 57000, basis: 'warm', slot: 'ffm-demo-002', contactRole: 'operator', hasEmail: true, evidence: 'Sample page lists one room as free from 1 October.' },
  { id: 'sample-003', district: 'Riedberg', lat: 50.1729, lng: 8.6270, scope: 'residence', availability: 'waitlist', roomType: 'single_apartment', kalt: null, neben: null, warm: null, basis: 'unknown', slot: 'ffm-demo-003', contactRole: 'provider_office', hasEmail: false, evidence: 'Sample page shows a waiting list only; no prices published.' },
  { id: 'sample-004', district: 'Nordend-West', lat: 50.1290, lng: 8.6820, scope: 'residence', availability: 'unknown', roomType: 'room_in_shared_flat', kalt: 29000, neben: null, warm: null, basis: 'kalt', slot: 'ffm-demo-004', contactRole: 'provider_office', hasEmail: true, evidence: null },
  { id: 'sample-005', district: 'Sachsenhausen-Nord', lat: 50.1015, lng: 8.6845, scope: 'residence', availability: 'applications_open', roomType: 'studio', kalt: 39000, neben: 9500, warm: 48500, basis: 'warm', slot: 'ffm-demo-005', contactRole: 'application_portal', hasEmail: false, evidence: 'Sample page states the application window is open.' },
  { id: 'sample-006', district: 'Ginnheim', lat: 50.1476, lng: 8.6472, scope: 'residence', availability: 'unknown', roomType: 'room_in_shared_flat', kalt: null, neben: null, warm: null, basis: 'unknown', slot: 'ffm-demo-006', contactRole: 'unknown', hasEmail: false, evidence: null },
  { id: 'sample-007', district: 'Bornheim', lat: 50.1305, lng: 8.7085, scope: 'room', availability: 'offer_reported', roomType: 'room_in_shared_flat', kalt: 34000, neben: 7500, warm: 41500, basis: 'warm', slot: 'ffm-demo-007', contactRole: 'letting_agent', hasEmail: true, evidence: 'Sample page reports a room available from 15 October.' },
  { id: 'sample-008', district: 'Niederrad', lat: 50.0898, lng: 8.6318, scope: 'residence', availability: 'waitlist', roomType: 'single_apartment', kalt: 36500, neben: 8000, warm: 44500, basis: 'warm', slot: 'ffm-demo-008', contactRole: 'provider_office', hasEmail: true, evidence: 'Sample page shows a waiting list.' },
  { id: 'sample-009', district: 'Gallus', lat: 50.1043, lng: 8.6310, scope: 'residence', availability: 'applications_open', roomType: 'studio', kalt: 42000, neben: null, warm: null, basis: 'kalt', slot: 'ffm-demo-009', contactRole: 'application_portal', hasEmail: false, evidence: 'Sample page states applications open year-round.' },
  { id: 'sample-010', district: 'Eschersheim', lat: 50.1602, lng: 8.6553, scope: 'residence', availability: 'unavailable', roomType: 'room_in_shared_flat', kalt: 28000, neben: 7000, warm: 35000, basis: 'warm', slot: 'ffm-demo-010', contactRole: 'provider_office', hasEmail: true, evidence: 'Sample page states no rooms are free this semester.' },
  { id: 'sample-011', district: 'Ostend', lat: 50.1148, lng: 8.7051, scope: 'residence', availability: 'unknown', roomType: 'single_apartment', kalt: null, neben: null, warm: null, basis: 'unknown', slot: null, contactRole: 'provider_office', hasEmail: false, evidence: null },
  { id: 'sample-012', district: 'Rödelheim', lat: 50.1268, lng: 8.6079, scope: 'residence', availability: 'applications_open', roomType: 'room_in_shared_flat', kalt: 30500, neben: 8000, warm: 38500, basis: 'warm', slot: null, contactRole: 'application_portal', hasEmail: true, evidence: 'Sample page states applications are open.' },
  { id: 'sample-013', district: 'Hausen', lat: 50.1402, lng: 8.6235, scope: 'room', availability: 'unknown', roomType: 'room_in_shared_flat', kalt: 33000, neben: null, warm: null, basis: 'kalt', slot: null, contactRole: 'unknown', hasEmail: false, evidence: null },
  { id: 'sample-014', district: 'Sachsenhausen-Süd', lat: 50.0913, lng: 8.6764, scope: 'residence', availability: 'waitlist', roomType: 'single_apartment', kalt: 44000, neben: 10500, warm: 54500, basis: 'warm', slot: null, contactRole: 'provider_office', hasEmail: true, evidence: 'Sample page shows a waiting list only.' },
]

const ROOM_LABEL: Record<Listing['roomType'], string> = {
  single_apartment: 'Single apartment',
  room_in_shared_flat: 'Room in a shared flat (WG-Zimmer)',
  studio: 'Studio',
  couple_apartment: 'Couple apartment',
  unknown: 'Room type not stated',
}

export const SAMPLE_LISTINGS: Listing[] = SEEDS.map((s, index) => {
  const checkedAt = new Date(Date.now() - (index + 1) * 7 * 60 * 1000).toISOString()
  return {
    id: s.id,
    provider: 'SAMPLE DATA',
    externalId: `sample/${s.id}`,
    canonicalUrl: `https://example.org/mainhaus-sample/${s.id}`,
    title: `${s.district} student residence (sample)`,
    scope: s.scope,
    address: `${s.district}, Frankfurt am Main (sample address withheld)`,
    coordinates: { lat: s.lat, lng: s.lng },
    locationPrecision: 'approximate',
    availability: s.availability,
    availabilityEvidence: s.evidence
      ? { statement: s.evidence, observedAt: checkedAt, sourceRefs: [SAMPLE_SOURCE(`${s.id}-avail`, s.evidence)] }
      : undefined,
    monthlyCost:
      s.basis === 'unknown' && s.kalt === null
        ? {
            kaltmieteCents: null,
            nebenkostenCents: null,
            warmmieteCents: null,
            basis: 'unknown',
            currency: 'EUR',
            unknownComponents: ['Kaltmiete', 'Nebenkosten', 'Warmmiete'],
            sourceRefs: [],
          }
        : {
            kaltmieteCents: s.kalt,
            nebenkostenCents: s.neben,
            warmmieteCents: s.warm,
            basis: s.basis,
            currency: 'EUR',
            unknownComponents: [
              ...(s.neben === null ? ['Nebenkosten'] : []),
              ...(s.warm === null ? ['Warmmiete'] : []),
            ],
            sourceRefs: [SAMPLE_SOURCE(`${s.id}-cost`, 'Sample price figures. Not a real published rent.')],
          },
    roomType: s.roomType,
    contact:
      s.contactRole === 'unknown'
        ? {
            role: 'unknown',
            organisation: null,
            email: null,
            phone: null,
            url: `https://example.org/mainhaus-sample/${s.id}`,
            sourceRefs: [],
          }
        : {
            role: s.contactRole,
            organisation: 'Sample housing office (not a real organisation)',
            email: s.hasEmail ? `housing@example.org` : null,
            phone: null,
            url: `https://example.org/mainhaus-sample/${s.id}/apply`,
            sourceRefs: [SAMPLE_SOURCE(`${s.id}-contact`, 'Sample public contact route.')],
          },
    photos: [],
    sourceRefs: [SAMPLE_SOURCE(`${s.id}-src`, `${ROOM_LABEL[s.roomType]} in ${s.district}.`)],
    checkedAt,
    demoPolicySlotId: s.slot,
    matchFactors: [],
  }
})

/**
 * All 20 reserved slots exist from the start (brief section 6: the IDs reserve
 * integration slots). In mock transport the first 14 mirror the sample records above;
 * slots beyond the available sample records stay `unbound` - the app never manufactures
 * a result to hit 20.
 *
 * Every slot's document is `null` because the 20 supplied policy documents are NOT part
 * of this frontend build. The UI therefore shows "Awaiting policy document" for all of
 * them, except slot ffm-demo-001, which carries a clearly-named UI fixture so the
 * citation, cost and legal surfaces can be exercised and tested. See mock/fixture.ts.
 */
export const SAMPLE_SLOTS: DemoPolicyLink[] = Array.from({ length: 20 }, (_, i) => {
  const n = String(i + 1).padStart(3, '0')
  const listing = SAMPLE_LISTINGS.find((l) => l.demoPolicySlotId === `ffm-demo-${n}`) ?? null
  const isFixture = n === '001'
  return {
    slotId: `ffm-demo-${n}`,
    listingId: listing?.id ?? null,
    policyId: `policy-${n}`,
    documentId: isFixture ? 'doc-ui-fixture' : null,
    documentVersion: isFixture ? 'fixture-v1' : null,
    relation: 'fictional_demo' as const,
    status: isFixture ? ('ready' as const) : listing ? ('awaiting_document' as const) : ('unbound' as const),
    mappingVersion: 'mock-mapping-v1',
    boundAt: listing ? new Date(Date.now() - 86_400_000).toISOString() : null,
  }
})
