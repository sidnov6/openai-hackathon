/**
 * Money is ALWAYS integer cents, and `null` ALWAYS means "unknown".
 *
 * The single rule this module exists to enforce (brief sections 9 and 15):
 * an unknown component must never be silently treated as zero. Every sum here
 * returns `{ cents, complete, excluded }` so the caller is forced to say whether
 * the total is complete before rendering it.
 */

export type Cents = number | null

export type Sum = {
  /** Sum of the KNOWN components only. Null when nothing was known. */
  cents: Cents
  /** False when at least one component was unknown - render "Known monthly costs". */
  complete: boolean
  /** Labels of components excluded from `cents` because their value is unknown. */
  excluded: string[]
}

export type Component = { label: string; amountCents: Cents }

/**
 * Sum components, keeping unknowns out of the arithmetic and naming them.
 * `sumKnown([{a,1000},{b,null}])` -> { cents: 1000, complete: false, excluded: ['b'] }
 */
export function sumKnown(components: readonly Component[]): Sum {
  let total = 0
  let sawKnown = false
  const excluded: string[] = []
  for (const c of components) {
    if (c.amountCents === null || !Number.isFinite(c.amountCents)) {
      excluded.push(c.label)
      continue
    }
    total += Math.trunc(c.amountCents)
    sawKnown = true
  }
  return { cents: sawKnown ? total : null, complete: excluded.length === 0, excluded }
}

/** Subtract in cents. Returns null if ANY operand is unknown - no guessing. */
export function subtractStrict(a: Cents, ...rest: Cents[]): Cents {
  if (a === null) return null
  let acc = Math.trunc(a)
  for (const b of rest) {
    if (b === null) return null
    acc -= Math.trunc(b)
  }
  return acc
}

const EUR = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const EUR_WHOLE = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** The single string the UI shows when a money value is unknown. */
export const NOT_STATED = 'Not stated'

/**
 * Format integer cents using German currency convention (1.234,50 EUR).
 * Unknown renders as "Not stated" - never "0 EUR", never "-".
 */
export function formatCents(cents: Cents, opts?: { whole?: boolean; unknownLabel?: string }): string {
  if (cents === null || !Number.isFinite(cents)) return opts?.unknownLabel ?? NOT_STATED
  const value = cents / 100
  if (opts?.whole && Number.isInteger(value)) return EUR_WHOLE.format(value)
  return EUR.format(value)
}

export function isKnown(cents: Cents): cents is number {
  return cents !== null && Number.isFinite(cents)
}

/** Parse a user-typed euro amount into integer cents. Returns null for unparseable. */
export function parseEurosToCents(input: string): Cents {
  const cleaned = input.replace(/\s|EUR|€/gi, '').replace(/\./g, '').replace(',', '.')
  if (cleaned === '') return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

/**
 * Budget comparison. Unknown prices do NOT count as within budget (brief section 5);
 * the caller decides whether to include them via `includeUnknown`.
 */
export function withinBudget(costCents: Cents, budgetCents: Cents, includeUnknown: boolean): boolean {
  if (budgetCents === null) return true
  if (costCents === null) return includeUnknown
  return costCents <= budgetCents
}
