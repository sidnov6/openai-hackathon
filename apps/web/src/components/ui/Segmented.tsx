import { cn } from '@/lib/cn'

/**
 * A radio group styled as a segmented control. Implemented with real radio inputs so
 * arrow keys work and the selection is announced - not divs with click handlers.
 */
export function Segmented<T extends string>({
  name,
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
}: {
  name: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; icon?: React.ReactNode }[]
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex rounded-md border border-line bg-canvas p-0.5', className)}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <label
            key={option.value}
            className={cn(
              'relative inline-flex cursor-pointer select-none items-center justify-center gap-1.5 rounded-sm font-semibold transition-colors',
              size === 'sm' ? 'h-8 px-2.5 text-label' : 'h-9 px-3 text-ui',
              selected ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
              'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.icon ? <span aria-hidden className="[&>svg]:h-4 [&>svg]:w-4">{option.icon}</span> : null}
            {option.label}
          </label>
        )
      })}
    </div>
  )
}
