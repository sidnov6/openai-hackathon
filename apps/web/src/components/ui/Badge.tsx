import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'primary' | 'amber' | 'danger' | 'success' | 'demo'

const TONES: Record<Tone, string> = {
  neutral: 'bg-canvas text-ink-muted border-line',
  primary: 'bg-primary-tint text-primary-press border-primary-ring/50',
  amber: 'bg-amber-tint text-amber border-amber-line',
  danger: 'bg-danger-tint text-danger border-danger-line',
  success: 'bg-success-tint text-success border-success-line',
  demo: 'bg-demo-tint text-demo border-demo-line',
}

/**
 * A badge always carries a text label, and callers pass an icon for any status meaning.
 * Colour is never the only carrier of meaning (brief section 4).
 */
export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
  title,
}: {
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-xs border px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wide',
        TONES[tone],
        className,
      )}
    >
      {icon ? <span aria-hidden className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span> : null}
      {children}
    </span>
  )
}
