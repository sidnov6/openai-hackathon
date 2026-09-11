import type { TenancyWorkspace } from '@/api/contracts.mirror'
import { formatCents } from '@/lib/money'
import { formatDate, formatDateTime } from '@/lib/dates'
import { refAnchor } from '@/components/common/Citation'

/**
 * The exportable tenancy brief.
 *
 * A print-ready HTML view is enough for the first build — the browser saves it to PDF.
 * It carries the data-mode label, the demo watermark, the generation date and every
 * citation as visible text, because a printed page has no drawers to open.
 */
export function PrintBrief({ workspace, dataMode }: { workspace: TenancyWorkspace; dataMode: 'live' | 'mock' }) {
  const { tenancy, listing, document, findings, legalFindings, costs, tasks, evidence, analysis, legal } = workspace
  const generated = new Date().toISOString()

  return (
    <article className="print-sheet mx-auto max-w-[820px] bg-surface p-6 text-ink">
      <header className="border-b-2 border-ink pb-3">
        <img src="/homi-logo.png" alt="Homi" className="mb-2 h-9 w-auto" />
        <p className="text-micro font-bold uppercase tracking-widest text-ink-muted">Tenancy brief</p>
        <h1 className="mt-1 text-display font-bold">{listing.title}</h1>
        <p className="mt-1 text-ui text-ink-muted">{listing.address ?? 'Address not published by the source'}</p>

        <div className="mt-3 space-y-1 rounded border border-demo-line bg-demo-tint p-2.5 text-ui">
          <p className="font-bold text-demo">DEMONSTRATION DOCUMENT — NOT A REAL TENANCY</p>
          <p className="text-ink-soft">
            This real location is paired with a fictional lease for demonstration. It is not the provider's actual
            agreement. No real provider accepted any application.
          </p>
          <p className="text-ink-soft">
            Data mode: <strong>{dataMode === 'live' ? 'live server' : 'labelled sample data'}</strong> · Generated{' '}
            {formatDateTime(generated)}
          </p>
        </div>
      </header>

      <Section title="The document analysed">
        {document ? (
          <dl className="space-y-1 text-ui">
            <Line label="File" value={document.fileName} />
            <Line label="Immutable version" value={document.version} />
            <Line label="Coverage" value={`${analysis.coverage?.unitsRead ?? 0} of ${analysis.coverage?.unitsTotal ?? 0} ${analysis.coverage?.unit ?? 'section'}s read`} />
            {document.missingParts.map((part, i) => (
              <Line key={i} label="Missing" value={part.detail} />
            ))}
          </dl>
        ) : (
          <p className="text-ui">No policy document has been imported for this tenancy. No analysis was produced.</p>
        )}
      </Section>

      {costs ? (
        <Section title="Costs">
          <table className="w-full text-ui">
            <tbody>
              {costs.components.map((c) => (
                <tr key={c.label} className="border-b border-line-soft">
                  <td className="py-1.5">
                    {c.label}
                    {c.germanTerm ? ` (${c.germanTerm})` : ''}
                  </td>
                  <td className="py-1.5 text-right tnum">{formatCents(c.amountCents)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-ink font-bold">
                <td className="py-1.5">{costs.excludedComponents.length ? 'Known monthly total' : 'Monthly total'}</td>
                <td className="py-1.5 text-right tnum">{formatCents(costs.knownMonthlyTotalCents)}</td>
              </tr>
            </tbody>
          </table>
          {costs.excludedComponents.length ? (
            <p className="mt-2 text-label text-ink-muted">
              Excluded because no amount is stated: {costs.excludedComponents.map((e) => e.label).join(', ')}. The real
              total will be higher.
            </p>
          ) : null}
          <p className="mt-2 text-ui">
            Deposit (Kaution): <strong className="tnum">{formatCents(costs.depositCents)}</strong> — refundable, and kept
            out of monthly spend.
          </p>
        </Section>
      ) : null}

      <Section title={`What the lease says (${findings.length})`}>
        <ul className="space-y-3">
          {findings.map((f) => (
            <li key={f.id} className="avoid-break">
              <p className="text-ui font-bold">{f.title}</p>
              <p className="mt-0.5 text-ui text-ink-soft">{f.explanation}</p>
              {f.originalClause ? (
                <blockquote lang="de" className="clause-quote mt-1.5 text-label">
                  {f.originalClause}
                </blockquote>
              ) : null}
              {f.sourceRefs.length ? (
                <p className="mt-1 text-micro text-ink-muted">Source: {f.sourceRefs.map(refAnchor).join('; ')}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Legal review (${legalFindings.length})`}>
        {legal.status !== 'complete' ? (
          <p className="mb-2 text-ui font-semibold text-amber">
            This legal review is incomplete. {legal.unavailableSources.map((s) => `${s.label}: ${s.reason}`).join(' ')}
          </p>
        ) : null}
        <ul className="space-y-3">
          {legalFindings.map((f) => (
            <li key={f.id} className="avoid-break">
              <p className="text-ui font-bold">
                [{f.severity.replace('_', ' ')}] {f.title}
              </p>
              <p className="mt-0.5 text-ui text-ink-soft">{f.explanation}</p>
              <p className="mt-1 text-micro text-ink-muted">
                Contract: {f.contractEvidence.map(refAnchor).join('; ') || 'none'} · Legal source:{' '}
                {f.legalEvidence.map((r) => `${refAnchor(r)}${r.url ? ` (${r.url})` : ''}`).join('; ') || 'none'}
              </p>
              <p className="mt-1 text-ui font-semibold">Next step: {f.nextStep}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Checklist">
        <ul className="space-y-1.5 text-ui">
          {tasks.map((t) => (
            <li key={t.id} className="avoid-break">
              [{t.status === 'done' ? 'x' : ' '}] <strong>{t.title}</strong>
              {' — '}
              {t.dueDate ? formatDate(t.dueDate) : `no date (${t.dueDateBlockedReason ?? 'date not confirmed'})`}
              {' · '}
              {t.basis === 'contract' ? 'from your contract' : t.basis === 'legal_guidance' ? 'from a legal source' : 'general advice'}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Evidence index (${evidence.length})`}>
        {evidence.length === 0 ? (
          <p className="text-ui text-ink-muted">No evidence recorded.</p>
        ) : (
          <ul className="space-y-1 text-ui">
            {evidence.map((e) => (
              <li key={e.id}>
                <strong>{e.roomOrItem}</strong> ({e.phase.replace('_', '-')}) · uploaded {formatDateTime(e.uploadedAt)}
                {e.capturedAtStated ? ` · you stated it was taken ${formatDate(e.capturedAtStated)}` : ''}
                {e.note ? ` · ${e.note}` : ''}
                <span className="block text-micro text-ink-muted">id {e.id}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-label text-ink-muted">
          Upload times are when the file reached the server. They do not prove when a photograph was taken.
        </p>
      </Section>

      <footer className="mt-6 border-t border-line pt-3 text-label text-ink-muted">
        <p>
          Homi provides legal information, not legal advice, and cannot issue a Wohnungsgeberbestätigung. For
          anything that turns on your own facts, contact a tenant advice service (Mieterverein) or a lawyer.
        </p>
        <p className="mt-1">Tenancy {tenancy.id} · generated {formatDateTime(generated)} · contract version 1</p>
      </footer>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 avoid-break">
      <h2 className="mb-2 border-b border-line pb-1 text-title font-bold">{title}</h2>
      {children}
    </section>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-40 shrink-0 font-semibold text-ink-muted">{label}</dt>
      <dd className="min-w-0 flex-1">{value}</dd>
    </div>
  )
}
