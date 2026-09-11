import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const CONTROL =
  'w-full rounded border border-line bg-surface px-3 text-ui text-ink placeholder:text-ink-faint ' +
  'transition-colors hover:border-line-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-ring/50 ' +
  'disabled:bg-canvas disabled:text-ink-faint'

export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 flex items-baseline justify-between gap-2 text-label font-semibold text-ink-soft">
      <span>{children}</span>
      {hint ? <span className="text-micro font-medium normal-case text-ink-muted">{hint}</span> : null}
    </label>
  )
}

export function Field({
  label,
  hint,
  help,
  error,
  children,
  id,
}: {
  label: ReactNode
  hint?: ReactNode
  help?: ReactNode
  error?: ReactNode
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode
  id?: string
}) {
  const generated = useId()
  const fieldId = id ?? generated
  const helpId = help ? `${fieldId}-help` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <Label htmlFor={fieldId} hint={hint}>
        {label}
      </Label>
      {children({ id: fieldId, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {help ? (
        <p id={helpId} className="mt-1 text-label text-ink-muted">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1 text-label font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, 'h-11', className)} />
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(CONTROL, 'min-h-[96px] resize-y py-2.5 leading-[22px]', className)} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(CONTROL, 'h-11 appearance-none bg-[length:16px] pr-9', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%235A6B84' stroke-width='1.6'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
      }}
    >
      {children}
    </select>
  )
}
