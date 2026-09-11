import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { ExternalLink, FileText, Image as ImageIcon, Landmark, Quote } from 'lucide-react'
import type { SourceRef } from '@/api/contracts.mirror'
import { Sheet } from '@/components/ui/Sheet'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/cn'

/**
 * The citation surface.
 *
 * Everything material on screen is traceable: a document clause, a statute, a web page,
 * or a piece of the student's own evidence. Clicking any citation opens the drawer
 * showing the EXACT source text beside where it came from. A citation with no resolvable
 * source is rendered as unresolved rather than quietly dropped.
 */

type CitationContextValue = {
  open: (refs: SourceRef[], context?: { title?: string; explanation?: ReactNode }) => void
}

const CitationContext = createContext<CitationContextValue | null>(null)

export function CitationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ refs: SourceRef[]; title?: string; explanation?: ReactNode } | null>(null)

  const open = useCallback((refs: SourceRef[], context?: { title?: string; explanation?: ReactNode }) => {
    setState({ refs, title: context?.title, explanation: context?.explanation })
  }, [])

  const value = useMemo(() => ({ open }), [open])

  return (
    <CitationContext.Provider value={value}>
      {children}
      <Sheet
        open={state !== null}
        onOpenChange={(next) => !next && setState(null)}
        title={state?.title ?? 'Source'}
        description={`${state?.refs.length ?? 0} source${(state?.refs.length ?? 0) === 1 ? '' : 's'} for this statement`}
      >
        <div className="px-4 py-4 sm:px-5">
          {state?.explanation ? (
            <div className="mb-4 rounded-md border border-line bg-surface-sunken p-3 text-ui leading-[22px] text-ink-soft">
              {state.explanation}
            </div>
          ) : null}
          {state?.refs.length ? (
            <ul className="space-y-3">
              {state.refs.map((ref) => (
                <li key={ref.id}>
                  <SourceCard sourceRef={ref} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md border border-amber-line bg-amber-tint p-3 text-ui text-ink">
              No source is attached to this statement. Treat it as unverified: Homi shows a citation only when it can
              resolve one.
            </p>
          )}
        </div>
      </Sheet>
    </CitationContext.Provider>
  )
}

export function useCitations(): CitationContextValue {
  const ctx = useContext(CitationContext)
  if (!ctx) throw new Error('useCitations must be used inside <CitationProvider>')
  return ctx
}

const KIND_META = {
  document: { icon: <FileText aria-hidden className="h-3.5 w-3.5" />, noun: 'Document' },
  statute: { icon: <Landmark aria-hidden className="h-3.5 w-3.5" />, noun: 'Official legal source' },
  webpage: { icon: <ExternalLink aria-hidden className="h-3.5 w-3.5" />, noun: 'Web page' },
  user_evidence: { icon: <ImageIcon aria-hidden className="h-3.5 w-3.5" />, noun: 'Your own evidence' },
} as const

/** A short human anchor for a ref: "§5 Kaution · p. 3" or "BGB §551". */
export function refAnchor(ref: SourceRef): string {
  const parts: string[] = []
  if (ref.section) parts.push(ref.section)
  if (ref.page) parts.push(`p. ${ref.page}`)
  if (parts.length === 0 && ref.label) parts.push(ref.label)
  if (parts.length === 0 && ref.url) {
    try {
      parts.push(new URL(ref.url).hostname.replace(/^www\./, ''))
    } catch {
      parts.push('source')
    }
  }
  return parts.join(' · ') || 'source'
}

/** Inline clickable citation. Always a real button, so it is keyboard reachable. */
export function CitationChip({
  refs,
  title,
  explanation,
  className,
  label,
}: {
  refs: SourceRef[]
  title?: string
  explanation?: ReactNode
  className?: string
  label?: string
}) {
  const { open } = useCitations()
  if (refs.length === 0) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-xs border border-amber-line bg-amber-tint px-1.5 py-0.5 text-micro font-semibold text-amber', className)}>
        No source
      </span>
    )
  }
  const first = refs[0]
  const meta = KIND_META[first.kind]
  const text = label ?? (refs.length > 1 ? `${refAnchor(first)} +${refs.length - 1}` : refAnchor(first))
  return (
    <button
      type="button"
      onClick={() => open(refs, { title: title ?? 'Source', explanation })}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-xs border border-line bg-surface px-1.5 py-0.5 text-micro font-semibold text-ink-muted',
        'transition-colors hover:border-primary-ring hover:bg-primary-tint hover:text-primary-press',
        className,
      )}
    >
      {meta.icon}
      <span className="truncate">{text}</span>
      <span className="sr-only">
        {' '}
        — open the {meta.noun.toLowerCase()} this comes from
      </span>
    </button>
  )
}

function SourceCard({ sourceRef }: { sourceRef: SourceRef }) {
  const meta = KIND_META[sourceRef.kind]
  return (
    <article className="rounded-md border border-line bg-surface p-3">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1 text-micro font-semibold uppercase tracking-wide text-ink-muted">
          {meta.icon}
          {meta.noun}
        </span>
        {sourceRef.section ? <span className="text-ui font-semibold text-ink">{sourceRef.section}</span> : null}
        {sourceRef.page ? <span className="text-label text-ink-muted">page {sourceRef.page}</span> : null}
      </header>

      {sourceRef.label ? <p className="mt-1 text-label text-ink-muted">{sourceRef.label}</p> : null}

      {sourceRef.excerpt ? (
        <figure className="mt-2.5">
          <blockquote className="clause-quote">
            <Quote aria-hidden className="mb-1 h-3.5 w-3.5 text-ink-faint" />
            {sourceRef.excerpt}
          </blockquote>
          <figcaption className="mt-1 text-micro text-ink-faint">
            Reproduced exactly as it appears in the source.
          </figcaption>
        </figure>
      ) : (
        <p className="mt-2 text-label text-ink-muted">This source has no stored excerpt.</p>
      )}

      <footer className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-label">
        {sourceRef.url ? (
          <a
            href={sourceRef.url}
            target="_blank"
            rel="noopener noreferrer"
            data-print-url={sourceRef.url}
            className="inline-flex items-center gap-1 font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
          >
            Open the source
            <ExternalLink aria-hidden className="h-3.5 w-3.5" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
        {sourceRef.version ? <span className="text-ink-muted">version {sourceRef.version}</span> : null}
        {sourceRef.retrievedAt ? (
          <span className="text-ink-muted">retrieved {formatDateTime(sourceRef.retrievedAt)}</span>
        ) : sourceRef.kind === 'statute' ? (
          <span className="text-amber">not retrieved in this session</span>
        ) : null}
      </footer>
    </article>
  )
}

/** Compact horizontal list of citations under a fact. */
export function SourceRow({ refs, title, className }: { refs: SourceRef[]; title?: string; className?: string }) {
  if (refs.length === 0) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      <span className="text-micro font-semibold uppercase tracking-wide text-ink-faint">Source</span>
      {refs.map((ref) => (
        <CitationChip key={ref.id} refs={[ref]} title={title} />
      ))}
    </div>
  )
}
