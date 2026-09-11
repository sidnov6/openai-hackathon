import { useState } from 'react'
import { ExternalLink, Send } from 'lucide-react'
import type { ContactDraft, Listing } from '@/api/contracts.mirror'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { ErrorState } from '@/components/ui/States'
import { useApiClient } from '@/api/ApiProvider'

/**
 * The real contact workflow: draft -> reviewed -> external handoff.
 *
 * Homi never sends anything. It prepares text the student edits, then opens the
 * verified route. Opening a link is not proof of submission or delivery, and the UI
 * says exactly that rather than implying the message went somewhere.
 */
export function ContactDraftSheet({
  listing,
  open,
  onOpenChange,
  onSend,
}: {
  listing: Listing
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Ready demo listings continue straight into the auto-approved agent workspace. */
  onSend?: () => Promise<void>
}) {
  const client = useApiClient()
  const [draft, setDraft] = useState<ContactDraft | null>(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [handedOff, setHandedOff] = useState(false)
  const [form, setForm] = useState({
    studentName: '',
    studyProgramme: '',
    moveInDate: '',
    durationMonths: '12',
    notes: '',
    language: 'en' as 'en' | 'de',
  })

  const generate = async () => {
    setBusy(true)
    setError(null)
    try {
      const next = await client.createContactDraft({
        listingId: listing.id,
        studentName: form.studentName,
        studyProgramme: form.studyProgramme,
        moveInDate: form.moveInDate || null,
        durationMonths: form.durationMonths ? Number(form.durationMonths) : null,
        notes: form.notes,
        language: form.language,
      })
      setDraft(next)
      setBody(next.body)
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }

  const openRoute = async () => {
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      const url =
        draft.route.kind === 'mailto'
          ? `${draft.route.url}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(body)}`
          : draft.route.url
      window.open(url, '_blank', 'noopener,noreferrer')
      await client.markContactHandoff(draft.id).catch(() => undefined)
      if (onSend) {
        await onSend()
        return
      }
      setHandedOff(true)
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Prepare a message"
      description={listing.title}
      footer={
        draft ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" className="flex-1" onClick={openRoute} loading={busy} loadingLabel="Opening agents…">
              <ExternalLink aria-hidden className="h-4 w-4" />
              {draft.route.kind === 'mailto' ? 'Send email' : draft.route.label}
            </Button>
          </div>
        ) : (
          <Button variant="primary" className="w-full" onClick={generate} loading={busy} loadingLabel="Preparing…">
            <Send aria-hidden className="h-4 w-4" />
            Prepare the message
          </Button>
        )
      }
    >
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <Callout tone="info" title="Homi does not send anything">
          It writes a draft you can edit, then opens the provider's own route so you send it yourself. No automatic
          outreach, no bulk messaging.
        </Callout>

        {error ? <ErrorState error={error} compact onRetry={generate} /> : null}

        {!draft ? (
          <div className="space-y-3">
            <Field label="Your name">
              {(props) => (
                <TextInput {...props} value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} placeholder="Optional" />
              )}
            </Field>
            <Field label="Study programme">
              {(props) => (
                <TextInput {...props} value={form.studyProgramme} onChange={(e) => setForm({ ...form, studyProgramme: e.target.value })} placeholder="e.g. MSc Computer Science" />
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Desired move-in">
                {(props) => <TextInput {...props} type="date" className="tnum" value={form.moveInDate} onChange={(e) => setForm({ ...form, moveInDate: e.target.value })} />}
              </Field>
              <Field label="Months">
                {(props) => <TextInput {...props} inputMode="numeric" className="tnum" value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} />}
              </Field>
            </div>
            <Field label="Language">
              {(props) => (
                <Select {...props} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as 'en' | 'de' })}>
                  <option value="en">English</option>
                  <option value="de">German (Deutsch)</option>
                </Select>
              )}
            </Field>
            <Field label="Anything to add" help="Kept short. Do not include passport, bank or ID details.">
              {(props) => <TextArea {...props} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Subject">{(props) => <TextInput {...props} readOnly value={draft.subject} />}</Field>
            <Field label="Message" help="Edit freely before you send it.">
              {(props) => <TextArea {...props} className="min-h-[220px]" value={body} onChange={(e) => setBody(e.target.value)} />}
            </Field>
            {handedOff ? (
              <Callout tone="attention" title="Opened — but not proof it was sent">
                Homi opened the provider's route. It cannot confirm the message was submitted or delivered. Check
                your own sent items or the provider's confirmation.
              </Callout>
            ) : null}
          </div>
        )}
      </div>
    </Sheet>
  )
}
