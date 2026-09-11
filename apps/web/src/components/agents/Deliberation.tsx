import { useState } from 'react'
import { ChevronDown, Gavel, Landmark, ScrollText, Swords } from 'lucide-react'
import type { LegalFinding, PolicyFinding } from '@/api/contracts.mirror'
import { Badge } from '@/components/ui/Badge'
import { CitationChip } from '@/components/common/Citation'
import { cn } from '@/lib/cn'

/**
 * The deliberation view — agents genuinely disagreeing, not a scripted chat.
 *
 * This is NOT an invented conversation (which the brief forbids). Every turn is derived
 * from data that already exists and is independently checkable:
 *
 *   Policy Analyst   states what the CONTRACT says      -> finding.originalClause + its citation
 *   Legal Reviewer   challenges it with the STATUTE     -> legalFinding.legalEvidence
 *   Evidence Gate    rules on what survives             -> applicability + nextStep
 *
 * Nothing is generated here for effect: remove the underlying finding and the exchange
 * disappears. Where the reviewer cannot settle the point, the gate says so rather than
 * manufacturing a winner — an unresolved disagreement is the honest outcome and is
 * displayed as one.
 */

type Turn = {
  speaker: 'policy_analyst' | 'legal_reviewer' | 'evidence_gate'
  role: string
  text: string
  quote?: string | null
  refs: LegalFinding['legalEvidence']
  verdict?: 'challenged' | 'upheld' | 'unresolved'
}

const SPEAKER = {
  policy_analyst: { name: 'Policy Analyst', icon: <ScrollText className="h-3.5 w-3.5" />, side: 'left' as const, tone: 'border-line bg-surface' },
  legal_reviewer: { name: 'German Legal Reviewer', icon: <Landmark className="h-3.5 w-3.5" />, side: 'right' as const, tone: 'border-amber-line bg-amber-tint' },
  evidence_gate: { name: 'Evidence & Consistency Gate', icon: <Gavel className="h-3.5 w-3.5" />, side: 'center' as const, tone: 'border-primary-ring/50 bg-primary-tint' },
}

function buildExchange(finding: PolicyFinding, flag: LegalFinding): Turn[] {
  const contested = flag.severity === 'potential_conflict'
  const uncertain = flag.applicability === 'applicability_uncertain' || flag.applicability === 'may_apply'

  return [
    {
      speaker: 'policy_analyst',
      role: 'reads the document',
      text: `The agreement is explicit on this. ${finding.explanation}`,
      quote: finding.originalClause,
      refs: finding.sourceRefs,
    },
    {
      speaker: 'legal_reviewer',
      role: contested ? 'challenges the clause' : 'adds the legal frame',
      text: contested
        ? `I am not disputing that the clause says that — I am disputing that saying it makes it so. ${flag.explanation}`
        : flag.explanation,
      refs: flag.legalEvidence,
      verdict: contested ? 'challenged' : 'upheld',
    },
    {
      speaker: 'evidence_gate',
      role: uncertain ? 'declines to settle it' : 'rules on the disagreement',
      text: uncertain
        ? `Both positions stand on their evidence, and I will not pick a winner without facts neither agent has. ${flag.applicabilityNote ?? ''} Recorded as unresolved. ${flag.nextStep}`
        : contested
          ? `The clause stays recorded exactly as written — it is what the student agreed to read. The statutory point stands beside it, not instead of it. ${flag.applicabilityNote ?? ''} ${flag.nextStep}`
          : `No conflict between the two. Both citations resolve. ${flag.nextStep}`,
      refs: [],
      verdict: uncertain ? 'unresolved' : contested ? 'challenged' : 'upheld',
    },
  ]
}

export function DeliberationPanel({
  findings,
  legalFindings,
}: {
  findings: PolicyFinding[]
  legalFindings: LegalFinding[]
}) {
  const exchanges = legalFindings
    .map((flag) => {
      const finding = findings.find((f) => flag.policyFindingIds.includes(f.id))
      return finding ? { flag, finding, turns: buildExchange(finding, flag) } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (exchanges.length === 0) return null

  const contested = exchanges.filter((e) => e.flag.severity === 'potential_conflict').length

  return (
    <section aria-labelledby="deliberation-heading" className="rounded-md border border-line bg-surface">
      <header className="border-b border-line px-4 py-3">
        <h3 id="deliberation-heading" className="flex items-center gap-1.5 text-ui font-bold text-ink">
          <Swords aria-hidden className="h-4 w-4 text-primary" />
          Where the agents disagreed
        </h3>
        <p className="mt-0.5 text-label leading-[18px] text-ink-muted">
          {contested} of {exchanges.length} clauses were contested. Each exchange below is reconstructed from the
          citations the agents actually resolved — every line points at a clause or a statute you can open. It is not a
          transcript of a conversation.
        </p>
      </header>

      <ul className="divide-y divide-line-soft">
        {exchanges.map((exchange) => (
          <ExchangeRow key={exchange.flag.id} {...exchange} />
        ))}
      </ul>
    </section>
  )
}

function ExchangeRow({ flag, finding, turns }: { flag: LegalFinding; finding: PolicyFinding; turns: Turn[] }) {
  const [open, setOpen] = useState(false)
  const contested = flag.severity === 'potential_conflict'
  const unresolved = flag.applicability === 'applicability_uncertain'

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-canvas"
      >
        <span className="mt-0.5 shrink-0">
          {contested ? (
            <Swords aria-hidden className="h-4 w-4 text-amber" />
          ) : (
            <Gavel aria-hidden className="h-4 w-4 text-ink-faint" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-ui font-semibold text-ink">{finding.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={contested ? 'amber' : 'neutral'}>
              {contested ? 'contested' : 'agreed'}
            </Badge>
            {unresolved ? <Badge tone="neutral">left unresolved</Badge> : null}
          </span>
        </span>
        <ChevronDown aria-hidden className={cn('mt-0.5 h-4 w-4 shrink-0 text-ink-faint transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <ol className="space-y-2.5 px-4 pb-4">
          {turns.map((turn, i) => {
            const meta = SPEAKER[turn.speaker]
            return (
              <li
                key={i}
                className={cn(
                  'rounded-md border p-3',
                  meta.tone,
                  meta.side === 'right' && 'ml-4 sm:ml-10',
                  meta.side === 'left' && 'mr-4 sm:mr-10',
                )}
              >
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-micro font-bold uppercase tracking-wide text-ink-muted">
                  <span aria-hidden>{meta.icon}</span>
                  {meta.name}
                  <span className="font-medium normal-case tracking-normal text-ink-faint">— {turn.role}</span>
                </p>
                <p className="mt-1.5 text-ui leading-[22px] text-ink">{turn.text}</p>
                {turn.quote ? (
                  <blockquote lang="de" className="clause-quote mt-2">
                    {turn.quote}
                  </blockquote>
                ) : null}
                {turn.refs.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {turn.refs.map((ref) => (
                      <CitationChip key={ref.id} refs={[ref]} title="What this agent cited" />
                    ))}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      ) : null}
    </li>
  )
}
