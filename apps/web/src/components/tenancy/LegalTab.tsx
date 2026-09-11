import { ExternalLink, Scale } from 'lucide-react'
import type { LegalFinding, TenancyWorkspace } from '@/api/contracts.mirror'
import { Badge } from '@/components/ui/Badge'
import { Callout } from '@/components/ui/Callout'
import { CitationChip } from '@/components/common/Citation'
import { DeliberationPanel } from '@/components/agents/Deliberation'
import { formatDateTime } from '@/lib/dates'

const SEVERITY: Record<LegalFinding['severity'], { label: string; tone: 'neutral' | 'primary' | 'amber' }> = {
  information: { label: 'Information', tone: 'neutral' },
  clarify: { label: 'Worth clarifying', tone: 'primary' },
  potential_conflict: { label: 'Possible conflict', tone: 'amber' },
}

const APPLICABILITY: Record<LegalFinding['applicability'], string> = {
  applies: 'Applies to this tenancy',
  may_apply: 'May apply',
  does_not_apply: 'Does not apply here',
  applicability_uncertain: 'Applicability uncertain — facts are missing',
}

/**
 * The legal review.
 *
 * There is deliberately no "legality score" and no valid/invalid verdict: those are
 * fact-dependent and a number would imply a certainty that does not exist. Every finding
 * shows the contract evidence, the official source, why it may matter, and a question to
 * put to the provider or a tenant adviser.
 */
export function LegalTab({ workspace }: { workspace: TenancyWorkspace }) {
  const { legal, legalFindings, tenancy } = workspace

  if (legal.status === 'not_started') {
    return <Callout tone="info" title="The legal review has not run yet">It starts once the document analysis completes.</Callout>
  }

  const deliberation = <DeliberationPanel findings={workspace.findings} legalFindings={legalFindings} />

  const grouped = (['potential_conflict', 'clarify', 'information'] as const).map((severity) => ({
    severity,
    items: legalFindings.filter((f) => f.severity === severity),
  }))

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-line bg-surface p-3.5">
        <h3 className="flex items-center gap-1.5 text-ui font-bold text-ink">
          <Scale aria-hidden className="h-4 w-4 text-primary" />
          How this tenancy was classified
        </h3>
        <p className="mt-1 text-ui leading-[22px] text-ink-soft">
          {tenancy.tenancyType === 'student_residence_549_3'
            ? 'Treated as a student/youth residence under BGB §549(3) — which changes which rules apply, but does not switch off the deposit cap or the ordinary-wear rule.'
            : tenancy.tenancyType === 'furnished_living_space'
              ? 'Treated as furnished living space.'
              : tenancy.tenancyType === 'standard_residential'
                ? 'Treated as a standard residential tenancy.'
                : 'Not classified yet.'}
        </p>
        <p className="mt-1.5 text-label text-ink-muted">
          Classification confidence:{' '}
          <span className="font-semibold">
            {tenancy.classificationStatus === 'confirmed'
              ? 'confirmed by evidence'
              : tenancy.classificationStatus === 'probable'
                ? 'probable — described as a residence, but not proven'
                : 'insufficient evidence'}
          </span>
          . Marketing wording alone is not proof.
        </p>
      </div>

      {legal.status !== 'complete' ? (
        <Callout tone="attention" title={legal.status === 'unavailable' ? 'The legal review could not run' : 'The legal review is incomplete'}>
          Sections below that depend on an unavailable source are missing, not cleared. An unreachable source does not
          mean nothing is wrong.
          <ul className="mt-1.5 space-y-1">
            {legal.unavailableSources.map((s) => (
              <li key={s.label}>
                <span className="font-semibold">{s.label}</span> — {s.reason}
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}

      {deliberation}

      {grouped.map(({ severity, items }) =>
        items.length === 0 ? null : (
          <section key={severity} aria-labelledby={`legal-${severity}`}>
            <h3 id={`legal-${severity}`} className="mb-2 text-label font-bold uppercase tracking-wide text-ink-faint">
              {SEVERITY[severity].label} ({items.length})
            </h3>
            <ul className="space-y-3">
              {items.map((finding) => (
                <li key={finding.id} className="rounded-md border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={SEVERITY[finding.severity].tone}>{SEVERITY[finding.severity].label}</Badge>
                    <Badge tone={finding.applicability === 'applies' ? 'neutral' : 'amber'}>
                      {APPLICABILITY[finding.applicability]}
                    </Badge>
                  </div>
                  <h4 className="mt-2 text-body font-bold leading-[24px] text-ink">{finding.title}</h4>
                  <p className="mt-1.5 text-ui leading-[23px] text-ink-soft">{finding.explanation}</p>

                  {finding.applicabilityNote ? (
                    <p className="mt-2 rounded border border-line bg-surface-sunken p-2.5 text-label leading-[19px] text-ink-soft">
                      <span className="font-semibold">Why applicability matters here: </span>
                      {finding.applicabilityNote}
                    </p>
                  ) : null}

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded border border-line p-2.5">
                      <p className="text-micro font-semibold uppercase tracking-wide text-ink-faint">Your contract says</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {finding.contractEvidence.map((ref) => (
                          <CitationChip key={ref.id} refs={[ref]} title="Contract evidence" />
                        ))}
                      </div>
                    </div>
                    <div className="rounded border border-line p-2.5">
                      <p className="text-micro font-semibold uppercase tracking-wide text-ink-faint">Official source</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {finding.legalEvidence.map((ref) => (
                          <CitationChip key={ref.id} refs={[ref]} title="Official legal source" />
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 rounded border border-primary-ring/40 bg-primary-tint px-3 py-2 text-ui font-semibold leading-[22px] text-ink">
                    Next step: {finding.nextStep}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}

      <div className="rounded-md border border-line bg-surface-sunken p-3.5">
        <p className="text-label font-semibold text-ink-soft">Sources checked</p>
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-label text-ink-muted">
          {legal.checkedTopics.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
        {legal.retrievedAt ? (
          <p className="mt-1.5 text-label text-ink-muted">Retrieved {formatDateTime(legal.retrievedAt)}</p>
        ) : (
          <p className="mt-1.5 text-label text-amber">Not retrieved live in this session.</p>
        )}
        <p className="mt-2 text-label leading-[18px] text-ink-muted">
          Homi is not a lawyer and does not offer individualised legal services. For anything that turns on your own
          facts, contact a tenant advice service (Mieterverein) or a Rechtsanwalt.{' '}
          <a
            href="https://www.gesetze-im-internet.de/bgb/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2"
          >
            BGB full text
            <ExternalLink aria-hidden className="h-3 w-3" />
          </a>
        </p>
      </div>
    </div>
  )
}
