import { ChevronDown, Loader2, CircleCheck, CircleX, SkipForward, RotateCw } from 'lucide-react'
import * as Collapsible from '@radix-ui/react-accordion'
import type { AgentEvent, JobEnvelope } from '@/api/contracts.mirror'
import { Button } from '@/components/ui/Button'
import { CitationChip } from '@/components/common/Citation'
import { formatDateTime } from '@/lib/dates'

const AGENT_LABEL: Record<AgentEvent['agent'], string> = {
  orchestrator: 'Orchestrator',
  housing_scout: 'Housing Scout',
  listing_verifier: 'Listing & Contact Verifier',
  policy_analyst: 'Policy Analyst',
  legal_reviewer: 'German Legal Reviewer',
  lifecycle_planner: 'Move-in / Move-out Planner',
  evidence_gate: 'Evidence & Consistency Gate',
}

const STATUS_ICON: Record<AgentEvent['status'], React.ReactNode> = {
  started: <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin text-primary motion-reduce:animate-none" />,
  progress: <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin text-primary motion-reduce:animate-none" />,
  succeeded: <CircleCheck aria-hidden className="h-3.5 w-3.5 text-success" />,
  failed: <CircleX aria-hidden className="h-3.5 w-3.5 text-danger" />,
  skipped: <SkipForward aria-hidden className="h-3.5 w-3.5 text-ink-faint" />,
  retrying: <RotateCw aria-hidden className="h-3.5 w-3.5 text-amber" />,
}

/**
 * The agent activity rail: secondary, collapsible, and factual.
 *
 * It shows observable work — "Reading clause 8", "Checking the deposit clause against
 * BGB §551" — with the sources each step touched. It never shows an invented
 * conversation between personas or a private reasoning trace, and it only animates when
 * a step is genuinely in progress.
 */
export function AgentRail({
  job,
  polling,
  onCancel,
  defaultOpen,
}: {
  job: JobEnvelope | null
  polling: boolean
  onCancel?: () => void
  defaultOpen?: boolean
}) {
  if (!job) return null
  const progress = job.progress
  const pct = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

  return (
    <Collapsible.Root type="single" collapsible defaultValue={defaultOpen ? 'activity' : undefined} className="border-t border-line bg-surface-sunken">
      <Collapsible.Item value="activity">
        <Collapsible.Header className="flex">
          <Collapsible.Trigger className="group flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-canvas">
            <span aria-hidden className="shrink-0">
              {polling ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary motion-reduce:animate-none" />
              ) : (
                <CircleCheck className="h-4 w-4 text-success" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ui font-semibold text-ink">{job.stage}</span>
              {progress ? (
                <span className="block text-label text-ink-muted tnum">
                  step {progress.completed} of {progress.total}
                </span>
              ) : null}
            </span>
            <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-data-[state=open]:rotate-180" />
          </Collapsible.Trigger>
        </Collapsible.Header>

        <div aria-hidden className="h-0.5 bg-line-soft">
          <div className="h-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </div>

        <Collapsible.Content className="overflow-hidden">
          <ol className="space-y-0 px-4 py-2" aria-label="Agent activity">
            {job.events.map((event) => (
              <li key={event.id} className="flex gap-2.5 py-1.5">
                <span className="mt-0.5 shrink-0">{STATUS_ICON[event.status]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-ui leading-[20px] text-ink">{event.summary}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-micro text-ink-faint">
                      {AGENT_LABEL[event.agent]} · {formatDateTime(event.createdAt)}
                    </span>
                    {event.sourceRefs.map((ref) => (
                      <CitationChip key={ref.id} refs={[ref]} title="Source touched by this step" />
                    ))}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          {job.error ? (
            <p className="mx-4 mb-3 rounded border border-danger-line bg-danger-tint px-3 py-2 text-ui text-ink">
              {job.error.message}
              {job.error.retryable ? ' You can try again.' : ' Retrying will not help.'}
            </p>
          ) : null}

          {polling && onCancel ? (
            <div className="px-4 pb-3">
              <Button variant="quiet" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          ) : null}
        </Collapsible.Content>
      </Collapsible.Item>
    </Collapsible.Root>
  )
}
