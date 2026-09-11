import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { IconButton } from './Button'

/**
 * The details sheet. Radix Dialog gives us the behaviour the brief requires without
 * hand-rolling it: focus trapping, focus RESTORATION to the trigger on close, Escape,
 * and `aria-modal` semantics. On mobile it is full height; on desktop it is a right rail.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = 'right',
  labelledById,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  side?: 'right' | 'bottom'
  labelledById?: string
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25 animate-fade-in motion-reduce:animate-none" />
        <Dialog.Content
          aria-labelledby={labelledById}
          className={cn(
            'fixed z-50 flex flex-col bg-surface shadow-sheet outline-none',
            side === 'right'
              ? 'inset-y-0 right-0 w-full max-w-[min(560px,100vw)] sm:animate-slide-in-right motion-reduce:animate-none'
              : 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl animate-slide-up motion-reduce:animate-none',
            // Full height on phones regardless of side.
            'max-sm:inset-0 max-sm:max-w-none max-sm:rounded-none',
          )}
        >
          <header className="flex items-start gap-3 border-b border-line px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title id={labelledById} className="text-title font-bold text-ink">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-ui text-ink-muted">{description}</Dialog.Description>
              ) : (
                // Radix warns without a description; keep the a11y tree clean either way.
                <Dialog.Description className="sr-only">Details panel</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close panel" className="-mr-2 -mt-1">
                <X className="h-5 w-5" aria-hidden />
              </IconButton>
            </Dialog.Close>
          </header>

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

          {footer ? (
            <footer className="border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
              {footer}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** A centred modal for short confirmations (delete, demo acceptance, handoff). */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 animate-fade-in motion-reduce:animate-none" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-5 shadow-sheet outline-none animate-slide-up motion-reduce:animate-none">
          <Dialog.Title className="text-title font-bold text-ink">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="mt-1.5 text-ui leading-[22px] text-ink-muted">{description}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">Dialog</Dialog.Description>
          )}
          {children ? <div className="mt-4">{children}</div> : null}
          {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export const SheetClose = Dialog.Close
