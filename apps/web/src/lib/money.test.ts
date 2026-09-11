import { describe, expect, it } from 'vitest'
import { formatCents, parseEurosToCents, subtractStrict, sumKnown, withinBudget } from './money'
import { addDaysOrNull, daysUntil } from './dates'

describe('money: unknown is never zero', () => {
  it('excludes unknown components from a total and names them', () => {
    const result = sumKnown([
      { label: 'Kaltmiete', amountCents: 31500 },
      { label: 'Nebenkosten', amountCents: 8500 },
      { label: 'Strom', amountCents: null },
    ])
    expect(result.cents).toBe(40000)
    expect(result.complete).toBe(false)
    expect(result.excluded).toEqual(['Strom'])
  })

  it('returns null rather than 0 when nothing is known', () => {
    expect(sumKnown([{ label: 'a', amountCents: null }]).cents).toBeNull()
  })

  it('refuses to subtract through an unknown', () => {
    expect(subtractStrict(126000, null, 0)).toBeNull()
    expect(subtractStrict(126000, 15000, 0)).toBe(111000)
  })

  it('renders unknown as "Not stated", never as a currency zero', () => {
    expect(formatCents(null)).toBe('Not stated')
    expect(formatCents(0)).not.toBe('Not stated')
  })

  it('formats euros with German convention', () => {
    expect(formatCents(126000).replace(/ /g, ' ')).toBe('1.260,00 €')
  })

  it('parses German and plain input to integer cents', () => {
    expect(parseEurosToCents('1.260,00')).toBe(126000)
    expect(parseEurosToCents('315')).toBe(31500)
    expect(parseEurosToCents('nonsense')).toBeNull()
  })
})

describe('budget: an unknown price is not "within budget"', () => {
  it('excludes unknown prices unless explicitly included', () => {
    expect(withinBudget(null, 40000, false)).toBe(false)
    expect(withinBudget(null, 40000, true)).toBe(true)
  })
  it('compares known prices normally', () => {
    expect(withinBudget(39000, 40000, false)).toBe(true)
    expect(withinBudget(41000, 40000, false)).toBe(false)
  })
  it('treats no budget as no constraint', () => {
    expect(withinBudget(null, null, false)).toBe(true)
  })
})

describe('dates: a missing date never becomes a deadline', () => {
  it('returns null instead of inventing a registration deadline', () => {
    expect(addDaysOrNull(null, 14)).toBeNull()
    expect(daysUntil(null)).toBeNull()
  })
  it('adds days correctly when the date IS known (BMG §17: two weeks)', () => {
    expect(addDaysOrNull('2026-10-01', 14)).toBe('2026-10-15')
  })
  it('handles a month boundary', () => {
    expect(addDaysOrNull('2026-10-25', 14)).toBe('2026-11-08')
  })
})
