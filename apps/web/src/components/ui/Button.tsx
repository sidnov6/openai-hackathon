import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover active:bg-primary-press shadow-card',
  secondary: 'bg-surface text-ink border border-line hover:bg-canvas hover:border-line-strong active:bg-surface-sunken shadow-card',
  ghost: 'bg-transparent text-ink hover:bg-canvas active:bg-line-soft',
  quiet: 'bg-canvas text-ink-soft hover:bg-line-soft hover:text-ink active:bg-line',
  danger: 'bg-surface text-danger border border-danger-line hover:bg-danger-tint active:bg-danger-tint',
}

const SIZES: Record<Size, string> = {
  // 44px minimum touch target on the two sizes used on mobile (brief section 4).
  sm: 'h-9 px-3 text-ui gap-1.5 rounded',
  md: 'h-11 px-4 text-ui gap-2 rounded-md',
  lg: 'h-12 px-5 text-body gap-2 rounded-md',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  asChild?: boolean
  /** Announced while `loading` so screen readers hear progress, not silence. */
  loadingLabel?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', loading, loadingLabel, asChild, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      ref={ref}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          <span>{loadingLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  )
})

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(function IconButton(
  { className, label, variant = 'ghost', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})
