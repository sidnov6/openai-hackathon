import { useCallback, useEffect, useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FlaskConical, Printer, Trash2 } from 'lucide-react'
import type { JobEnvelope, TenancyWorkspace as Workspace } from '@/api/contracts.mirror'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Modal } from '@/components/ui/Sheet'
import { ErrorState } from '@/components/ui/States'
import { FindingSkeleton } from '@/components/ui/Skeleton'
import { useApi, useApiClient } from '@/api/ApiProvider'
import { useJob } from '@/hooks/useJob'
import { AgentRail } from '@/components/agents/AgentRail'
import { OverviewTab } from './Overview'
import { LeaseTab } from './LeaseTab'
import { LegalTab } from './LegalTab'
import { MoveInTab } from './MoveInTab'
import { MoveOutTab } from './MoveOutTab'
import { PrintBrief } from './PrintBrief'
import { cn } from '@/lib/cn'

const TAB_LIST = [
  { id: 'overview', label: 'Overview' },
  { id: 'lease', label: 'Lease & rules' },
  { id: 'legal', label: 'Legal review' },
  { id: 'movein', label: 'Move-in' },
  { id: 'moveout', label: 'Move-out' },
] as const

/**
 * The tenancy workspace.
 *
 * Semantic tabs (Radix) so arrow keys move between them and the panel is announced. The
 * selected home and the data mode stay visible at all times, so the student always knows
 * which lease they are reading and where the data came from.
 */
export function TenancyWorkspaceView({ tenancyId, onBack }: { tenancyId: string; onBack: () => void }) {
  const client = useApiClient()
  const { mode } = useApi()
  const [tab, setTab] = useState<string>('overview')
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [analysisJob, setAnalysisJob] = useState<JobEnvelope | null>(null)

  const query = useQuery({
    queryKey: ['tenancy', tenancyId],
    queryFn: () => client.getTenancy(tenancyId),
  })

  const job = useJob(
    useCallback(
      (finished: JobEnvelope) => {
        setAnalysisJob(finished)
        void query.refetch()
      },
      [query],
    ),
  )

  const workspace = query.data

  // Start analysis automatically once the demo host has accepted and a document exists.
  useEffect(() => {
    if (!workspace) return
    const { tenancy, analysis } = workspace
    if (tenancy.acceptance && tenancy.documentId && analysis.status === 'not_started' && !job.polling) {
      client
        // The idempotency key is stable per tenancy+version, so a re-render cannot
        // create a second analysis job for the same document.
        .analyzeTenancy(tenancy.id, `analyze:${tenancy.id}:${tenancy.documentVersion}`)
        .then(({ jobId }) => job.start(jobId))
        .catch(() => undefined)
    }
  }, [workspace, client, job])

  const openTask = (taskId: string) => {
    setTab(taskId.startsWith('task-mo') ? 'moveout' : 'movein')
    setHighlightTaskId(taskId)
    window.setTimeout(() => document.getElementById(`task-${taskId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120)
  }

  const doPrint = () => {
    setPrinting(true)
    window.setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 120)
  }

  if (query.isLoading) {
    return (
      <div className="space-y-3 p-4">
        <FindingSkeleton />
        <FindingSkeleton />
      </div>
    )
  }
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (!workspace) return null

  const running = workspace.analysis.status === 'running' || job.polling

  if (printing) {
    return <PrintBrief workspace={workspace} dataMode={mode ?? 'mock'} />
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      {/* Header: the selected home and the data mode never leave the screen. */}
      <header className="shrink-0 border-b border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 shrink-0">
              <ArrowLeft aria-hidden className="h-4 w-4" />
              Back to the map
            </Button>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={doPrint}>
              <Printer aria-hidden className="h-4 w-4" />
              Print brief
            </Button>
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 aria-hidden className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
        <h2 className="mt-1.5 text-title font-bold text-ink">{workspace.listing.title}</h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-label text-ink-muted">
          <span className="inline-flex items-center gap-1 font-semibold text-demo">
            <FlaskConical aria-hidden className="h-3.5 w-3.5" />
            Fictional lease · {workspace.tenancy.policyBinding?.policyId ?? 'no policy'}
          </span>
          <span>· {workspace.listing.address ?? 'address not published'}</span>
        </p>
      </header>

      <div className="shrink-0 px-4 pt-3">
        <Callout tone="demo" title="Simulated acceptance — no real provider responded">
          The demo host in this app marked this application accepted on{' '}
          {workspace.tenancy.acceptance ? new Date(workspace.tenancy.acceptance.acceptedAt).toLocaleString('en-GB') : '—'}.
          Nothing was sent to {workspace.listing.provider}, and no one there has seen or agreed to anything.
        </Callout>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <Tabs.List
          aria-label="Tenancy workspace sections"
          className="scroll-thin mt-3 flex shrink-0 gap-0.5 overflow-x-auto border-b border-line px-4"
        >
          {TAB_LIST.map((t) => (
            <Tabs.Trigger
              key={t.id}
              value={t.id}
              className={cn(
                'relative whitespace-nowrap px-3 py-2.5 text-ui font-semibold text-ink-muted transition-colors',
                'hover:text-ink data-[state=active]:text-ink',
                'after:absolute after:inset-x-2 after:bottom-0 after:h-[2.5px] after:rounded-t after:bg-transparent data-[state=active]:after:bg-primary',
              )}
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto max-w-[840px]">
            {running ? (
              <div className="mb-4 space-y-3">
                <Callout tone="info" title="Reading the whole document">
                  Every section is read and reconciled before findings appear. Partial results are not shown as if they
                  were complete.
                </Callout>
                <FindingSkeleton />
              </div>
            ) : null}

            <Tabs.Content value="overview" className="outline-none">
              <OverviewTab workspace={workspace} onGoToTab={setTab} />
            </Tabs.Content>
            <Tabs.Content value="lease" className="outline-none">
              <LeaseTab workspace={workspace} onOpenTask={openTask} />
            </Tabs.Content>
            <Tabs.Content value="legal" className="outline-none">
              <LegalTab workspace={workspace} />
            </Tabs.Content>
            <Tabs.Content value="movein" className="outline-none">
              <MoveInTab workspace={workspace} onRefresh={() => query.refetch()} highlightTaskId={highlightTaskId} />
            </Tabs.Content>
            <Tabs.Content value="moveout" className="outline-none">
              <MoveOutTab workspace={workspace} onRefresh={() => query.refetch()} onJobStarted={job.start} />
            </Tabs.Content>
          </div>
        </div>
      </Tabs.Root>

      <AgentRail job={job.job ?? analysisJob} polling={job.polling} onCancel={job.cancel} />

      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this tenancy and its evidence?"
        description="Every task, note and uploaded photo for this tenancy is removed, along with any cached analysis. This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await client.deleteTenancy(tenancyId)
                setDeleteOpen(false)
                onBack()
              }}
            >
              Delete permanently
            </Button>
          </>
        }
      />
    </div>
  )
}

export type { Workspace }
