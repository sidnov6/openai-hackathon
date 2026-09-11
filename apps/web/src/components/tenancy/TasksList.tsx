import type { ChecklistTask } from '@/api/contracts.mirror'
import { Badge } from '@/components/ui/Badge'
import { SourceRow } from '@/components/common/Citation'
import { describeDue, formatDate } from '@/lib/dates'
import { cn } from '@/lib/cn'

const BASIS: Record<ChecklistTask['basis'], { label: string; tone: 'primary' | 'amber' | 'neutral' }> = {
  contract: { label: 'From your contract', tone: 'primary' },
  legal_guidance: { label: 'From a legal source', tone: 'amber' },
  practical: { label: 'General practical advice', tone: 'neutral' },
}

/**
 * The checklist.
 *
 * `basis` is always shown: a contract obligation, a sourced legal point, and a general
 * practical suggestion are three different kinds of thing, and a student deciding what to
 * prioritise needs to know which is which. A task with no date says WHY it has no date
 * rather than inventing a deadline.
 */
export function TasksList({
  tasks,
  onToggle,
  highlightId,
}: {
  tasks: ChecklistTask[]
  onToggle: (task: ChecklistTask) => void
  highlightId?: string | null
}) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-md border border-line bg-surface-sunken px-3 py-4 text-ui text-ink-muted">
        No tasks yet. They are created from the lease once the analysis completes.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => {
        const due = describeDue(task.dueDate)
        const done = task.status === 'done'
        return (
          <li
            key={task.id}
            id={`task-${task.id}`}
            className={cn(
              'rounded-md border bg-surface p-3.5 transition-colors',
              highlightId === task.id ? 'border-primary ring-2 ring-primary-ring/50' : 'border-line',
            )}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id={`check-${task.id}`}
                checked={done}
                onChange={() => onToggle(task)}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#B8431F]"
              />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`check-${task.id}`}
                  className={cn('block cursor-pointer text-ui font-bold leading-[21px]', done ? 'text-ink-muted line-through' : 'text-ink')}
                >
                  {task.title}
                </label>
                {task.detail ? <p className="mt-1 text-ui leading-[21px] text-ink-soft">{task.detail}</p> : null}

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={BASIS[task.basis].tone}>{BASIS[task.basis].label}</Badge>
                  {task.dueDate ? (
                    <Badge tone={due?.overdue ? 'danger' : 'neutral'}>
                      {formatDate(task.dueDate)} · {due?.text}
                    </Badge>
                  ) : (
                    <Badge tone="neutral" title={task.dueDateBlockedReason ?? undefined}>
                      no date yet
                    </Badge>
                  )}
                </div>

                {!task.dueDate && task.dueDateBlockedReason ? (
                  <p className="mt-1.5 text-label leading-[18px] text-ink-muted">{task.dueDateBlockedReason}</p>
                ) : null}

                {task.changeNotice ? (
                  <p className="mt-1.5 rounded border border-amber-line bg-amber-tint px-2 py-1 text-label text-ink">
                    {task.changeNotice}
                  </p>
                ) : null}

                <SourceRow refs={task.sourceRefs} title={task.title} className="mt-2" />
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
