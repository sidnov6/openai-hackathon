import { useState } from 'react'
import { CircleHelp, MessageCircleQuestion, Search } from 'lucide-react'
import type { LegalFinding, PolicyFinding, SourceRef, TenancyWorkspace } from '@/api/contracts.mirror'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Field, TextInput } from '@/components/ui/Field'
import { CitationChip, SourceRow } from '@/components/common/Citation'
import { useApiClient } from '@/api/ApiProvider'
import { cn } from '@/lib/cn'

const TOPIC_LABEL: Record<PolicyFinding['topic'], string> = {
  room_identity: 'The room',
  parties_and_type: 'Parties and type',
  term_and_notice: 'Term and notice',
  rent: 'Rent',
  operating_costs: 'Operating costs',
  deposit: 'Deposit',
  house_rules: 'House rules',
  maintenance: 'Maintenance',
  handover: 'Handover',
  move_out_obligations: 'Moving out',
  other: 'Other',
}

/**
 * The signature interaction.
 *
 * Each finding offers three views of the same clause: what the document SAYS (the German
 * original, verbatim), what the legal review FLAGS about it, and what the student SHOULD
 * DO. A deposit finding links straight through to its move-in evidence task.
 */
export function LeaseTab({
  workspace,
  onOpenTask,
}: {
  workspace: TenancyWorkspace
  onOpenTask: (taskId: string) => void
}) {
  const { findings, legalFindings, document, analysis } = workspace
  const [query, setQuery] = useState('')

  if (analysis.status === 'awaiting_document') {
    return (
      <Callout tone="attention" title="Awaiting policy document">
        No file has been imported into this reserved slot yet, so there is nothing to read.
      </Callout>
    )
  }

  const visible = query.trim()
    ? findings.filter((f) => `${f.title} ${f.explanation} ${f.originalClause ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    : findings

  return (
    <div className="space-y-4">
      {document ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-ui font-semibold text-ink">{document.fileName}</p>
            <p className="text-label text-ink-muted tnum">
              version {document.version} · {analysis.coverage?.unitsRead}/{analysis.coverage?.unitsTotal}{' '}
              {analysis.coverage?.unit}s read
            </p>
          </div>
          <Badge tone={analysis.status === 'complete' ? 'success' : 'amber'}>
            {analysis.status === 'complete' ? 'full coverage' : 'coverage incomplete'}
          </Badge>
        </div>
      ) : null}

      {document?.missingParts.length ? (
        <Callout tone="attention" title="Referenced but not supplied">
          <ul className="space-y-1">
            {document.missingParts.map((part, i) => (
              <li key={i}>{part.detail}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      <Field label="Find a term in this lease" id="lease-search">
        {(props) => (
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <TextInput {...props} type="search" className="pl-9" placeholder="deposit, notice, pets…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        )}
      </Field>

      {visible.length === 0 ? (
        <p className="rounded-md border border-line bg-surface-sunken px-3 py-4 text-ui text-ink-muted">
          Nothing in this lease matches “{query}”. That is not the same as the lease permitting it — try the question box
          below to get an explicit answer.
        </p>
      ) : null}

      <div className="space-y-3">
        {visible.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            legal={legalFindings.filter((l) => l.policyFindingIds.includes(finding.id))}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>

      <AskBox tenancyId={workspace.tenancy.id} />
    </div>
  )
}

function FindingCard({
  finding,
  legal,
  onOpenTask,
}: {
  finding: PolicyFinding
  legal: LegalFinding[]
  onOpenTask: (taskId: string) => void
}) {
  const [view, setView] = useState<'says' | 'flags' | 'do'>('says')
  const notSpecified = finding.certainty === 'unknown'

  const tabs = [
    { id: 'says' as const, label: 'What the document says' },
    { id: 'flags' as const, label: `What the legal review flags${legal.length ? ` (${legal.length})` : ''}`, disabled: legal.length === 0 },
    { id: 'do' as const, label: 'What I should do', disabled: !finding.action },
  ]

  return (
    <article className="overflow-hidden rounded-md border border-line bg-surface">
      <header className="border-b border-line-soft px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{TOPIC_LABEL[finding.topic]}</Badge>
          {notSpecified ? (
            <Badge tone="amber" icon={<CircleHelp />}>
              not specified
            </Badge>
          ) : null}
          {legal.some((l) => l.severity === 'potential_conflict') ? <Badge tone="amber">possible conflict</Badge> : null}
        </div>
        <h3 className="mt-1.5 text-body font-bold leading-[24px] text-ink">{finding.title}</h3>
      </header>

      <div role="tablist" aria-label={`Views of: ${finding.title}`} className="flex flex-wrap gap-1 border-b border-line-soft bg-surface-sunken px-2 py-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={view === tab.id}
            disabled={tab.disabled}
            onClick={() => setView(tab.id)}
            className={cn(
              'rounded-sm px-2.5 py-1.5 text-label font-semibold transition-colors',
              view === tab.id ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
              tab.disabled && 'cursor-not-allowed opacity-40 hover:text-ink-muted',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-3.5">
        {view === 'says' ? (
          <div>
            <p className="text-ui leading-[23px] text-ink-soft">{finding.explanation}</p>
            {finding.originalClause ? (
              <figure className="mt-3">
                <figcaption className="mb-1 text-micro font-semibold uppercase tracking-wide text-ink-faint">
                  The original clause
                </figcaption>
                <blockquote lang="de" className="clause-quote">
                  {finding.originalClause}
                </blockquote>
              </figure>
            ) : null}
            <SourceRow refs={finding.sourceRefs} title={finding.title} className="mt-2.5" />
          </div>
        ) : null}

        {view === 'flags' ? (
          <ul className="space-y-3">
            {legal.map((flag) => (
              <li key={flag.id} className="rounded border border-amber-line bg-amber-tint p-3">
                <p className="text-ui font-bold text-ink">{flag.title}</p>
                <p className="mt-1 text-ui leading-[22px] text-ink-soft">{flag.explanation}</p>
                {flag.applicabilityNote ? (
                  <p className="mt-1.5 text-label leading-[18px] text-ink-muted">
                    <span className="font-semibold">Applicability:</span> {flag.applicabilityNote}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  <CitationChip refs={flag.contractEvidence} title="The clause this is about" label="contract clause" />
                  <CitationChip refs={flag.legalEvidence} title="Official legal source" label="official source" />
                </div>
                <p className="mt-2 text-ui font-semibold text-ink">{flag.nextStep}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {view === 'do' ? (
          <div>
            <p className="text-ui leading-[23px] text-ink">{finding.action}</p>
            {finding.relatedTaskIds.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {finding.relatedTaskIds.map((taskId) => (
                  <Button key={taskId} variant="secondary" size="sm" onClick={() => onOpenTask(taskId)}>
                    Go to the related task
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}

/** Questions are answered only from THIS tenancy's document version. */
function AskBox({ tenancyId }: { tenancyId: string }) {
  const client = useApiClient()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<{ answer: string; refs: SourceRef[]; notSpecified: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const ask = async () => {
    if (!question.trim()) return
    setBusy(true)
    try {
      const result = await client.askQuestion(tenancyId, question.trim())
      setAnswer({ answer: result.answer, refs: result.sourceRefs, notSpecified: result.notSpecified })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-md border border-line bg-surface p-4">
      <h3 className="flex items-center gap-1.5 text-ui font-bold text-ink">
        <MessageCircleQuestion aria-hidden className="h-4 w-4 text-primary" />
        Ask about this lease
      </h3>
      <p className="mt-0.5 text-label text-ink-muted">
        Answers come only from this document version. Homi will not answer from another building's lease.
      </p>
      <div className="mt-2.5 flex gap-2">
        <TextInput
          aria-label="Your question about this lease"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="Can I keep a cat?"
        />
        <Button variant="primary" onClick={ask} loading={busy} loadingLabel="Reading…">
          Ask
        </Button>
      </div>
      {answer ? (
        <div className={cn('mt-3 rounded border p-3', answer.notSpecified ? 'border-amber-line bg-amber-tint' : 'border-line bg-surface-sunken')}>
          <p className="text-ui leading-[22px] text-ink">{answer.answer}</p>
          {answer.refs.length > 0 ? <SourceRow refs={answer.refs} className="mt-2" /> : null}
        </div>
      ) : null}
    </section>
  )
}
