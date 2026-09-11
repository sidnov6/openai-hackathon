import { useState } from 'react'
import { Plus, Scale } from 'lucide-react'
import type { ChecklistTask, TenancyWorkspace } from '@/api/contracts.mirror'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import { Money } from '@/components/common/Money'
import { CitationChip } from '@/components/common/Citation'
import { useApiClient } from '@/api/ApiProvider'
import { parseEurosToCents, subtractStrict } from '@/lib/money'
import { EvidenceCapture } from './Evidence'
import { TasksList } from './TasksList'
import type { MoveOutClaimInput } from '@/api/types'

/**
 * Move-out and the deposit.
 *
 * The ledger keeps four things strictly apart: the original deposit, deductions the
 * student has AGREED, deductions the provider has CLAIMED but which are unresolved, and
 * what has actually been returned. There is no predicted refund percentage and no
 * invented deduction — a claim is displayed as a claim until it is settled.
 */
export function MoveOutTab({
  workspace,
  onRefresh,
  onJobStarted,
}: {
  workspace: TenancyWorkspace
  onRefresh: () => void
  onJobStarted: (jobId: string) => void
}) {
  const client = useApiClient()
  const { tenancy, tasks, evidence, deposit } = workspace
  const [claims, setClaims] = useState<MoveOutClaimInput[]>([])
  const [draft, setDraft] = useState({ label: '', amount: '', statement: '' })
  const [busy, setBusy] = useState(false)

  const moveOutTasks = tasks.filter((t) => t.phase === 'move_out')
  const moveInEvidence = evidence.filter((e) => e.phase === 'move_in')

  const addClaim = () => {
    if (!draft.label.trim()) return
    setClaims([...claims, { label: draft.label.trim(), amountCents: draft.amount ? parseEurosToCents(draft.amount) : null, providerStatement: draft.statement.trim() }])
    setDraft({ label: '', amount: '', statement: '' })
  }

  const runReview = async () => {
    setBusy(true)
    try {
      const { jobId } = await client.startMoveOutReview(tenancy.id, claims)
      onJobStarted(jobId)
      onRefresh()
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (task: ChecklistTask) => {
    await client.updateTask(tenancy.id, task.id, { status: task.status === 'done' ? 'todo' : 'done' })
    onRefresh()
  }

  const claimedTotal = deposit?.claimedDeductions.reduce<number | null>(
    (acc, c) => (acc === null || c.amountCents === null ? null : acc + c.amountCents),
    0,
  ) ?? null

  return (
    <div className="space-y-4">
      {!tenancy.moveOutDate ? (
        <Callout tone="attention" title="No move-out date confirmed">
          Notice and return deadlines cannot be worked out yet. Confirm the contract end date in Move-in first — Homi
          will not guess one.
        </Callout>
      ) : null}

      {deposit ? (
        <section className="rounded-md border border-line bg-surface p-4">
          <h3 className="flex items-center gap-1.5 text-ui font-bold text-ink">
            <Scale aria-hidden className="h-4 w-4 text-primary" />
            Deposit account
          </h3>

          <dl className="mt-3 divide-y divide-line-soft">
            <LedgerRow label="Deposit you paid" value={<Money cents={deposit.originalDepositCents} className="font-bold" />} />
            <LedgerRow
              label="Deductions you have agreed"
              value={deposit.agreedDeductions.length === 0 ? <span className="text-ink-muted">None</span> : <Money cents={deposit.agreedDeductions.reduce((a, d) => a + (d.amountCents ?? 0), 0)} />}
            />
            <LedgerRow
              label="Deductions the provider claims"
              hint="Claimed, not settled. Nothing here is agreed."
              value={claimedTotal === null && deposit.claimedDeductions.length > 0 ? <span className="text-ink-muted">Amount not stated</span> : <Money cents={claimedTotal} />}
            />
            <LedgerRow label="Already returned to you" value={<Money cents={deposit.returnedCents} />} />
            <LedgerRow
              label="Remaining balance"
              hint={deposit.balanceIncomplete ? 'Cannot be calculated while any figure above is unknown.' : undefined}
              value={<Money cents={subtractStrict(deposit.originalDepositCents, claimedTotal, deposit.returnedCents)} className="font-bold" />}
            />
          </dl>

          {deposit.claimedDeductions.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {deposit.claimedDeductions.map((claim) => (
                <li key={claim.id} className="rounded border border-amber-line bg-amber-tint p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-ui font-bold text-ink">{claim.label}</p>
                    <Money cents={claim.amountCents} className="font-bold" />
                  </div>
                  {claim.providerStatement ? (
                    <blockquote className="clause-quote mt-2">{claim.providerStatement}</blockquote>
                  ) : null}
                  <p className="mt-1.5 text-label font-semibold text-ink-soft">
                    Status: claimed by the provider and not resolved.
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          <Callout tone="info" className="mt-3">
            Photographs help organise what you observed. They do not by themselves establish fault, cause, or who owes
            money. Homi does not estimate how likely a refund is.
          </Callout>
        </section>
      ) : null}

      <section className="rounded-md border border-line bg-surface p-4">
        <h3 className="text-ui font-bold text-ink">Record what the provider is actually claiming</h3>
        <p className="mt-0.5 text-label text-ink-muted">
          Only enter what they have told you. Nothing is invented here.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="What they say you owe for">
            {(props) => <TextInput {...props} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Repainting the bedroom" />}
          </Field>
          <Field label="Amount" hint="EUR">
            {(props) => <TextInput {...props} inputMode="decimal" className="tnum" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="150,00" />}
          </Field>
        </div>
        <Field label="Their exact wording" hint="optional">
          {(props) => <TextArea {...props} value={draft.statement} onChange={(e) => setDraft({ ...draft, statement: e.target.value })} />}
        </Field>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={addClaim}>
            <Plus aria-hidden className="h-4 w-4" />
            Add claim ({claims.length})
          </Button>
          <Button variant="primary" onClick={runReview} loading={busy} loadingLabel="Reviewing…" disabled={claims.length === 0}>
            Review these claims
          </Button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-label font-bold uppercase tracking-wide text-ink-faint">Move-out tasks</h3>
        <TasksList tasks={moveOutTasks} onToggle={toggle} />
      </section>

      {moveInEvidence.length > 0 ? (
        <section className="rounded-md border border-line bg-surface p-4">
          <h3 className="text-ui font-bold text-ink">Your move-in record ({moveInEvidence.length})</h3>
          <p className="mt-0.5 text-label text-ink-muted">
            This is what a move-out claim gets compared against. Photograph the same surfaces again below.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {moveInEvidence.map((item) => (
              <li key={item.id} className="rounded-xs border border-line bg-canvas px-2 py-1 text-label text-ink-soft">
                {item.roomOrItem}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <EvidenceCapture tenancyId={tenancy.id} phase="move_out" items={evidence} onAdded={onRefresh} compareOptions={moveInEvidence} />
    </div>
  )
}

function LedgerRow({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5">
      <dt className="text-ui text-ink-soft">
        {label}
        {hint ? <span className="block text-label text-ink-muted">{hint}</span> : null}
      </dt>
      <dd className="text-ui text-ink">{value}</dd>
    </div>
  )
}

export { CitationChip }
