import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleAlert, FlaskConical, Info } from 'lucide-react'
import { cn } from '@/lib/cn'

type Tone = 'info' | 'attention' | 'problem' | 'good' | 'demo'

const TONE_STYLES: Record<Tone, { box: string; icon: ReactNode; srPrefix: string }> = {
  info: { box: 'border-line bg-surface-sunken text-ink-soft', icon: <Info aria-hidden className="h-4 w-4 text-ink-muted" />, srPrefix: 'Information:' },
  attention: { box: 'border-amber-line bg-amber-tint text-ink', icon: <AlertTriangle aria-hidden className="h-4 w-4 text-amber" />, srPrefix: 'Needs attention:' },
  problem: { box: 'border-danger-line bg-danger-tint text-ink', icon: <CircleAlert aria-hidden className="h-4 w-4 text-danger" />, srPrefix: 'Problem:' },
  good: { box: 'border-success-line bg-success-tint text-ink', icon: <CheckCircle2 aria-hidden className="h-4 w-4 text-success" />, srPrefix: 'Confirmed:' },
  demo: { box: 'border-demo-line bg-demo-tint text-ink', icon: <FlaskConical aria-hidden className="h-4 w-4 text-demo" />, srPrefix: 'Demonstration data:' },
}

/**
 * Every callout pairs its colour with an icon AND a screen-reader prefix, so the meaning
 * survives greyscale, colour-blindness and audio-only use.
 */
export function Callout({
  tone = 'info',
  title,
  children,
  className,
  action,
}: {
  tone?: Tone
  title?: ReactNode
  children?: ReactNode
  className?: string
  action?: ReactNode
}) {
  const style = TONE_STYLES[tone]
  return (
    <div className={cn('rounded-md border px-3 py-2.5', style.box, className)}>
      <div className="flex gap-2.5">
        <span className="mt-0.5 shrink-0">{style.icon}</span>
        <div className="min-w-0 flex-1 text-ui leading-[21px]">
          <span className="sr-only">{style.srPrefix} </span>
          {title ? <p className="font-semibold text-ink">{title}</p> : null}
          {children ? <div className={cn(title && 'mt-0.5', 'text-ink-soft')}>{children}</div> : null}
          {action ? <div className="mt-2.5">{action}</div> : null}
        </div>
      </div>
    </div>
  )
}
