import { beforeEach, describe, expect, it } from 'vitest'
import { MockApiClient } from './index'
import { SAMPLE_SLOTS } from './listings'

/**
 * Data-isolation and binding-stability checks against the mock adapter. The live adapter
 * enforces the same rules server-side; these verify the CLIENT never papers over them.
 */
describe('demo policy binding', () => {
  it('reserves exactly 20 unique slot ids and 20 unique policy ids', () => {
    expect(SAMPLE_SLOTS).toHaveLength(20)
    expect(new Set(SAMPLE_SLOTS.map((s) => s.slotId)).size).toBe(20)
    expect(new Set(SAMPLE_SLOTS.map((s) => s.policyId)).size).toBe(20)
  })

  it('never assigns a policy by index, order or hash - unbound slots stay unbound', () => {
    const unbound = SAMPLE_SLOTS.filter((s) => s.listingId === null)
    for (const slot of unbound) {
      expect(slot.status).toBe('unbound')
      expect(slot.documentId).toBeNull()
    }
  })

  it('reports slots with no document as awaiting_document rather than ready', () => {
    for (const slot of SAMPLE_SLOTS) {
      if (slot.documentId === null && slot.listingId !== null) {
        expect(slot.status).toBe('awaiting_document')
      }
    }
  })

  it('refuses to bind a slot to a different listing', async () => {
    const client = new MockApiClient()
    const slot = SAMPLE_SLOTS.find((s) => s.listingId)!
    await expect(
      client.createDemoTenancy({ listingId: 'sample-999', slotId: slot.slotId }),
    ).rejects.toThrow()
  })
})

describe('tenancy isolation and idempotency', () => {
  // Each test builds its own client; clear any persisted state when a DOM is present.
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear()
  })

  it('rejects a tenancy id that is not in this session', async () => {
    const client = new MockApiClient()
    await expect(client.getTenancy('ten_someone_else')).rejects.toThrow()
  })

  it('does not resolve evidence belonging to another tenancy', async () => {
    const client = new MockApiClient()
    const slot = SAMPLE_SLOTS.find((s) => s.status === 'ready')!
    const tenancy = await client.createDemoTenancy({ listingId: slot.listingId!, slotId: slot.slotId })
    const url = await client.getEvidenceObjectUrl(tenancy.id, 'ev_from_another_tenancy')
    expect(url).toBeNull()
  })

  it('does not create a duplicate tenancy for the same listing', async () => {
    const client = new MockApiClient()
    const slot = SAMPLE_SLOTS.find((s) => s.status === 'ready')!
    const a = await client.createDemoTenancy({ listingId: slot.listingId!, slotId: slot.slotId })
    const b = await client.createDemoTenancy({ listingId: slot.listingId!, slotId: slot.slotId })
    expect(b.id).toBe(a.id)
  })

  it('automatically accepts a demo request so the next step can start', async () => {
    const client = new MockApiClient()
    const slot = SAMPLE_SLOTS.find((s) => s.status === 'ready')!
    const tenancy = await client.createDemoTenancy({ listingId: slot.listingId!, slotId: slot.slotId })
    expect(tenancy.status).toBe('policy_linked')
    expect(tenancy.acceptance?.actor).toBe('demo_host')
  })

  it('does not create a second acceptance event on a repeated request', async () => {
    const client = new MockApiClient()
    const slot = SAMPLE_SLOTS.find((s) => s.status === 'ready')!
    const tenancy = await client.createDemoTenancy({ listingId: slot.listingId!, slotId: slot.slotId })
    const first = await client.acceptDemoTenancy(tenancy.id, 'key-1')
    const second = await client.acceptDemoTenancy(tenancy.id, 'key-1')
    expect(second.acceptance?.acceptedAt).toBe(first.acceptance?.acceptedAt)
    expect(second.acceptance?.actor).toBe('demo_host')
  })

  it('refuses to analyse a slot with no document', async () => {
    const client = new MockApiClient()
    const slot = SAMPLE_SLOTS.find((s) => s.status === 'awaiting_document')!
    const tenancy = await client.createDemoTenancy({ listingId: slot.listingId!, slotId: slot.slotId })
    await expect(client.analyzeTenancy(tenancy.id, 'k')).rejects.toThrow(/document/i)
  })
})

describe('search results are never presented as live', () => {
  it('always labels mock discovery as saved', async () => {
    const client = new MockApiClient()
    const { jobId } = await client.startSearch({
      origin: { lat: 50.1109, lng: 8.6821, label: 'Frankfurt' },
      radiusKm: 5,
      roomTypes: [],
      includeUnknownPrices: true,
      maxMonthlyCostCents: null,
      moveInDate: null,
    })
    const job = await client.getJob(jobId)
    expect(job.searchResult?.freshness).toBe('saved')
    expect(job.searchResult?.incomplete).toBe(true)
  })

  it('reports every capability as unavailable in mock mode', async () => {
    const health = await new MockApiClient().health()
    expect(health.capabilities.liveSearch).toBe(false)
    expect(health.capabilities.openai).toBe(false)
    expect(health.limitations.length).toBeGreaterThan(0)
  })
})
