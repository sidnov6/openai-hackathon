import { useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import type { ChecklistTask, TenancyWorkspace } from '@/api/contracts.mirror'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Field, Select, TextInput } from '@/components/ui/Field'
import { useApiClient } from '@/api/ApiProvider'
import { EvidenceCapture } from './Evidence'
import { TasksList } from './TasksList'

/**
 * Move-in.
 *
 * Dates come first, because nothing downstream can be dated without them. The
 * registration questions are asked BEFORE any BMG §27 exception is applied — the
 * deadline normally counts from actual move-in, not from signing, and a student who
 * already has a German registration or is staying only briefly is in a different case.
 */
export function MoveInTab({
  workspace,
  onRefresh,
  highlightTaskId,
}: {
  workspace: TenancyWorkspace
  onRefresh: () => void
  highlightTaskId?: string | null
}) {
  const client = useApiClient()
  const { tenancy, tasks, evidence } = workspace
  const [moveIn, setMoveIn] = useState(tenancy.moveInDate ?? '')
  const [moveOut, setMoveOut] = useState(tenancy.moveOutDate ?? '')
  const [actualMoveIn, setActualMoveIn] = useState(tenancy.registration?.actualMoveInDate ?? '')
  const [hasRegistration, setHasRegistration] = useState<string>(
    tenancy.registration?.hasExistingGermanRegistration === null || tenancy.registration?.hasExistingGermanRegistration === undefined
      ? ''
      : String(tenancy.registration.hasExistingGermanRegistration),
  )
  const [stayMonths, setStayMonths] = useState(tenancy.registration?.intendedStayMonths?.toString() ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await client.updateDates(tenancy.id, {
        moveInDate: moveIn || null,
        moveOutDate: moveOut || null,
        registration: {
          hasExistingGermanRegistration: hasRegistration === '' ? null : hasRegistration === 'true',
          intendedStayMonths: stayMonths ? Number(stayMonths) : null,
          actualMoveInDate: actualMoveIn || null,
        },
      })
      onRefresh()
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (task: ChecklistTask) => {
    await client.updateTask(tenancy.id, task.id, { status: task.status === 'done' ? 'todo' : 'done' })
    onRefresh()
  }

  const moveInTasks = tasks.filter((t) => t.phase === 'move_in')

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-line bg-surface p-4">
        <h3 className="flex items-center gap-1.5 text-ui font-bold text-ink">
          <CalendarCheck aria-hidden className="h-4 w-4 text-primary" />
          Confirm your dates
        </h3>
        <p className="mt-0.5 text-label leading-[18px] text-ink-muted">
          Until these are confirmed, Homi leaves deadlines empty rather than inventing them.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Contract move-in date">
            {(props) => <TextInput {...props} type="date" className="tnum" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} />}
          </Field>
          <Field label="Contract end / move-out date">
            {(props) => <TextInput {...props} type="date" className="tnum" value={moveOut} onChange={(e) => setMoveOut(e.target.value)} />}
          </Field>
        </div>

        <fieldset className="mt-4 rounded border border-line bg-surface-sunken p-3">
          <legend className="px-1 text-label font-bold text-ink-soft">Registration (Anmeldung)</legend>
          <p className="text-label leading-[18px] text-ink-muted">
            The deadline normally counts two weeks from when you <strong>actually move in</strong>, not from signing.
            These answers decide whether an exception applies — Homi will not assume one.
          </p>
          <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
            <Field label="Date you actually move in">
              {(props) => <TextInput {...props} type="date" className="tnum" value={actualMoveIn} onChange={(e) => setActualMoveIn(e.target.value)} />}
            </Field>
            <Field label="Already registered in Germany?">
              {(props) => (
                <Select {...props} value={hasRegistration} onChange={(e) => setHasRegistration(e.target.value)}>
                  <option value="">Not answered</option>
                  <option value="true">Yes, I have a German address</option>
                  <option value="false">No, this is my first</option>
                </Select>
              )}
            </Field>
            <Field label="Intended stay (months)">
              {(props) => <TextInput {...props} inputMode="numeric" className="tnum" value={stayMonths} onChange={(e) => setStayMonths(e.target.value)} placeholder="e.g. 12" />}
            </Field>
          </div>
        </fieldset>

        <Button variant="primary" className="mt-3" onClick={save} loading={busy} loadingLabel="Updating tasks…">
          Save dates and update tasks
        </Button>
      </section>

      <Callout tone="info" title="Homi cannot issue your Wohnungsgeberbestätigung">
        Only the housing provider can sign the housing-provider confirmation, and a lease does not replace it. Ask them
        for it — the task below tracks that.
      </Callout>

      <section>
        <h3 className="mb-2 text-label font-bold uppercase tracking-wide text-ink-faint">Move-in tasks</h3>
        <TasksList tasks={moveInTasks} onToggle={toggle} highlightId={highlightTaskId} />
      </section>

      <EvidenceCapture tenancyId={tenancy.id} phase="move_in" items={evidence} onAdded={onRefresh} />
    </div>
  )
}
