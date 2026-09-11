import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { RoomType } from '@/api/contracts.mirror'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextInput } from '@/components/ui/Field'
import { formatCents, parseEurosToCents } from '@/lib/money'
import type { Filters } from '@/state/journey'
import { cn } from '@/lib/cn'

const ROOM_TYPE_OPTIONS: { value: RoomType; label: string }[] = [
  { value: 'room_in_shared_flat', label: 'Room in a shared flat (WG-Zimmer)' },
  { value: 'single_apartment', label: 'Single apartment' },
  { value: 'studio', label: 'Studio' },
  { value: 'couple_apartment', label: 'Couple apartment' },
]

const RADIUS_OPTIONS = [1, 2, 3, 5, 8, 12, 20]

/**
 * Filters.
 *
 * The budget control states its cost basis explicitly: a budget compared against warm
 * rent is a different question from one compared against cold rent, and a student who
 * does not know which they typed will misread every card. Unknown prices are excluded
 * from a budget filter unless the student opts in, because "price not published" is not
 * the same as "cheap enough".
 */
export function FiltersBar({
  filters,
  onChange,
  onApply,
  dirty,
  compact,
}: {
  filters: Filters
  onChange: (next: Partial<Filters>) => void
  onApply: () => void
  dirty: boolean
  compact?: boolean
}) {
  const [budgetText, setBudgetText] = useState(
    filters.maxMonthlyCostCents === null ? '' : String(Math.round(filters.maxMonthlyCostCents / 100)),
  )

  const budgetSummary =
    filters.maxMonthlyCostCents === null ? 'Any budget' : `up to ${formatCents(filters.maxMonthlyCostCents, { whole: true })}`

  return (
    <div className={cn('flex flex-wrap items-center gap-2', compact && 'gap-1.5')}>
      <label className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5">
        <span className="text-label font-semibold text-ink-muted">Radius</span>
        <select
          aria-label="Search radius in kilometres"
          value={filters.radiusKm}
          onChange={(e) => onChange({ radiusKm: Number(e.target.value) })}
          className="bg-transparent text-ui font-semibold text-ink outline-none"
        >
          {RADIUS_OPTIONS.map((km) => (
            <option key={km} value={km}>
              {km} km
            </option>
          ))}
        </select>
      </label>

      <Popover.Root>
        <Popover.Trigger asChild>
          <Button variant="secondary" size="sm" className="font-semibold">
            <SlidersHorizontal aria-hidden className="h-4 w-4" />
            {budgetSummary}
            <ChevronDown aria-hidden className="h-4 w-4 text-ink-faint" />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            align="start"
            className="z-50 w-[min(340px,calc(100vw-1.5rem))] rounded-lg border border-line bg-surface p-4 shadow-sheet animate-slide-up motion-reduce:animate-none"
          >
            <Field
              label="Maximum monthly cost"
              hint="EUR"
              help="Compared against the cost basis each source publishes. Cards state whether the figure is cold or warm rent."
            >
              {(props) => (
                <TextInput
                  {...props}
                  inputMode="numeric"
                  placeholder="No limit"
                  value={budgetText}
                  onChange={(e) => {
                    setBudgetText(e.target.value)
                    onChange({ maxMonthlyCostCents: e.target.value.trim() === '' ? null : parseEurosToCents(e.target.value) })
                  }}
                />
              )}
            </Field>

            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded border border-line bg-canvas p-2.5">
              <input
                type="checkbox"
                checked={filters.includeUnknownPrices}
                onChange={(e) => onChange({ includeUnknownPrices: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#B8431F]"
              />
              <span className="text-label leading-[18px] text-ink-soft">
                <span className="block font-semibold text-ink">Also show homes with no published price</span>
                An unknown price is not counted as within your budget. Tick this to see them anyway.
              </span>
            </label>

            <Popover.Close asChild>
              <Button variant="primary" size="sm" className="mt-3 w-full">
                Done
              </Button>
            </Popover.Close>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <label className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5">
        <span className="text-label font-semibold text-ink-muted">Type</span>
        <Select
          aria-label="Room type"
          className="h-auto border-0 bg-transparent px-0 pr-6 text-ui font-semibold focus:ring-0"
          value={filters.roomTypes[0] ?? ''}
          onChange={(e) => onChange({ roomTypes: e.target.value ? [e.target.value as RoomType] : [] })}
        >
          <option value="">Any</option>
          {ROOM_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>

      <label className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5">
        <span className="text-label font-semibold text-ink-muted">Move in</span>
        <input
          type="date"
          aria-label="Desired move-in date"
          value={filters.moveInDate ?? ''}
          onChange={(e) => onChange({ moveInDate: e.target.value || null })}
          className="bg-transparent text-ui font-semibold text-ink outline-none tnum"
        />
      </label>

      {dirty ? (
        <Button variant="primary" size="sm" onClick={onApply}>
          Apply filters
        </Button>
      ) : null}
    </div>
  )
}
