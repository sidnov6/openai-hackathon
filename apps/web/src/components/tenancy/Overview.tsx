import { CalendarClock, FileText, Scale, ShieldAlert } from 'lucide-react'
import type { TenancyWorkspace } from '@/api/contracts.mirror'
import { Callout } from '@/components/ui/Callout'
import { Badge } from '@/components/ui/Badge'
import { IncompleteTotal, Money } from '@/components/common/Money'
import { CitationChip } from '@/components/common/Citation'
import { formatDate } from '@/lib/dates'

/** Overview: costs first, because that is what a student needs to decide anything. */
export function OverviewTab({ workspace, onGoToTab }: { workspace: TenancyWorkspace; onGoToTab: (tab: string) => void }) {
  const { costs, analysis, document, legal, legalFindings, tenancy } = workspace

  if (analysis.status === 'awaiting_document') {
    return (
      <Callout tone="attention" title="Awaiting policy document">
        Slot {tenancy.policyBinding?.slotId} is reserved and bound to this location, but no policy file has been imported
        into it. Until a document exists there is nothing to analyse — Homi will not produce findings from another
        building's agreement.
      </Callout>
    )
  }

  const conflicts = legalFindings.filter((f) => f.severity === 'potential_conflict')

  return (
    <div className="space-y-4">
      {analysis.status === 'partial' && document ? (
        <Callout tone="attention" title="Coverage is complete, but the document is not">
          Every one of the {analysis.coverage?.unitsTotal} sections was read.{' '}
          {document.missingParts.map((p) => p.detail).join(' ')}
        </Callout>
      ) : null}

      {costs ? (
        <section className="rounded-md border border-line bg-surface p-4">
          <h3 className="text-label font-bold uppercase tracking-wide text-ink-faint">What it costs each month</h3>

          <IncompleteTotal
            className="mt-3"
            label="Monthly costs"
            cents={costs.knownMonthlyTotalCents}
            excluded={costs.excludedComponents}
          />

          <dl className="mt-3 divide-y divide-line-soft border-t border-line-soft">
            {costs.components.map((component) => (
              <div key={component.label} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="min-w-0 text-ui text-ink-soft">
                  {component.label}
                  {component.germanTerm ? <span className="block text-label text-ink-muted">{component.germanTerm}</span> : null}
                  {component.chargeKind === 'advance' ? (
                    <Badge tone="primary" className="mt-1">
                      advance — settled yearly
                    </Badge>
                  ) : null}
                </dt>
                <dd className="flex shrink-0 items-center gap-2">
                  <Money cents={component.amountCents} className="text-ui font-semibold" />
                  <CitationChip refs={component.sourceRefs} title={component.label} />
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
            <div className="rounded border border-line bg-surface-sunken p-3">
              <p className="text-label font-semibold text-ink-muted">Deposit (Kaution)</p>
              <Money cents={costs.depositCents} className="mt-0.5 block text-title font-bold text-ink" />
              <p className="mt-1 text-label leading-[18px] text-ink-muted">
                Refundable. Kept out of monthly spend — it is money you should get back, not money you spend.
              </p>
            </div>
            <div className="rounded border border-line bg-surface-sunken p-3">
              <p className="text-label font-semibold text-ink-muted">
                {costs.initialCashIncomplete ? 'Known cash needed up front' : 'Cash needed up front'}
              </p>
              <Money cents={costs.initialCashCents} className="mt-0.5 block text-title font-bold text-ink" />
              <ul className="mt-1 space-y-0.5 text-label text-ink-muted">
                {costs.initialCashComponents.map((c) => (
                  <li key={c.label} className="flex justify-between gap-2">
                    <span>{c.label}</span>
                    <Money cents={c.amountCents} />
                  </li>
                ))}
              </ul>
              {costs.initialCashIncomplete ? (
                <p className="mt-1.5 text-label text-amber">
                  Components whose timing the document does not state are not included here.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={<ShieldAlert className="h-4 w-4 text-amber" />}
          label="Legal flags"
          value={`${conflicts.length} possible conflict${conflicts.length === 1 ? '' : 's'}`}
          detail={legal.status === 'partial' ? 'Legal review is incomplete' : `${legalFindings.length} findings in total`}
          onClick={() => onGoToTab('legal')}
        />
        <SummaryCard
          icon={<FileText className="h-4 w-4 text-primary" />}
          label="Document"
          value={document ? `${analysis.coverage?.unitsRead}/${analysis.coverage?.unitsTotal} sections read` : 'None'}
          detail={document?.missingParts.length ? `${document.missingParts.length} part missing` : 'No missing parts'}
          onClick={() => onGoToTab('lease')}
        />
        <SummaryCard
          icon={<CalendarClock className="h-4 w-4 text-ink-muted" />}
          label="Move-in date"
          value={tenancy.moveInDate ? formatDate(tenancy.moveInDate) : 'Not confirmed'}
          detail={tenancy.moveInDate ? 'Deadlines calculated from this' : 'No deadlines can be calculated yet'}
          onClick={() => onGoToTab('movein')}
        />
      </div>

      {legal.status === 'partial' ? (
        <Callout tone="attention" title="The legal review is incomplete" >
          <ul className="space-y-1">
            {legal.unavailableSources.map((s) => (
              <li key={s.label}>
                <span className="font-semibold">{s.label}</span> — {s.reason}
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}

      <Callout tone="info" title="Homi gives legal information, not legal advice">
        Findings point at an official source and the exact clause so you can ask a better question. For anything that
        turns on your own facts, take it to a tenant advice service (Mieterverein) or a lawyer.
      </Callout>
    </div>
  )
}

function SummaryCard({ icon, label, value, detail, onClick }: { icon: React.ReactNode; label: string; value: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-line bg-surface p-3 text-left transition-colors hover:border-line-strong hover:bg-canvas"
    >
      <span className="flex items-center gap-1.5 text-label font-semibold text-ink-muted">
        {icon}
        {label}
      </span>
      <span className="mt-1 block text-ui font-bold text-ink">{value}</span>
      <span className="mt-0.5 block text-label text-ink-muted">{detail}</span>
    </button>
  )
}

export { Scale }
