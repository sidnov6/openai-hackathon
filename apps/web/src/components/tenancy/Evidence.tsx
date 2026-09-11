import { useEffect, useState } from 'react'
import { Camera, FileText, Trash2, Upload } from 'lucide-react'
import type { EvidenceItem } from '@/api/contracts.mirror'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Sheet'
import { useApiClient } from '@/api/ApiProvider'
import { formatDate, formatDateTime } from '@/lib/dates'

const MAX_BYTES = 12 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

/**
 * Evidence capture.
 *
 * The timestamp recorded is when the SERVER received the file. That does not prove when
 * the photo was taken, and the UI says so rather than implying a chain of custody it
 * cannot support. An optional user-stated capture date is kept clearly labelled as the
 * user's own statement.
 */
export function EvidenceCapture({
  tenancyId,
  phase,
  items,
  onAdded,
  compareOptions,
}: {
  tenancyId: string
  phase: EvidenceItem['phase']
  items: EvidenceItem[]
  onAdded: () => void
  compareOptions?: EvidenceItem[]
}) {
  const client = useApiClient()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [roomOrItem, setRoomOrItem] = useState('')
  const [note, setNote] = useState('')
  const [capturedAt, setCapturedAt] = useState('')
  const [compareId, setCompareId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError(null)
    if (!roomOrItem.trim()) return setError('Say which room or item this is about.')
    if (file) {
      if (!ALLOWED.includes(file.type)) return setError(`That file type (${file.type || 'unknown'}) is not accepted. Use JPEG, PNG, WebP or HEIC.`)
      if (file.size > MAX_BYTES) return setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 12 MB.`)
    }
    setBusy(true)
    try {
      await client.addEvidence(tenancyId, {
        file,
        roomOrItem: roomOrItem.trim(),
        note: note.trim(),
        phase,
        capturedAtStated: capturedAt || null,
        comparisonIds: compareId ? [compareId] : [],
      })
      setOpen(false)
      setFile(null)
      setRoomOrItem('')
      setNote('')
      setCapturedAt('')
      setCompareId('')
      onAdded()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const phaseItems = items.filter((i) => i.phase === phase)

  return (
    <section className="rounded-md border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-ui font-bold text-ink">
          <Camera aria-hidden className="h-4 w-4 text-primary" />
          Evidence ({phaseItems.length})
        </h3>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Upload aria-hidden className="h-4 w-4" />
          Add evidence
        </Button>
      </div>

      {phaseItems.length === 0 ? (
        <p className="mt-2 text-ui leading-[22px] text-ink-muted">
          Nothing recorded yet. Photographs and notes taken at handover are what a later deposit claim gets measured
          against.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {phaseItems.map((item) => (
            <EvidenceCard key={item.id} item={item} tenancyId={tenancyId} onDeleted={onAdded} />
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Add evidence"
        description="Stored privately against this tenancy. It is never given a public link."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={busy} loadingLabel="Saving…">
              Save evidence
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Room or item" help="e.g. Bedroom — north wall, or Kitchen — fridge door">
            {(props) => <TextInput {...props} value={roomOrItem} onChange={(e) => setRoomOrItem(e.target.value)} />}
          </Field>

          <Field label="Photo" hint="optional" help="JPEG, PNG, WebP or HEIC, up to 12 MB.">
            {(props) => (
              <input
                {...props}
                type="file"
                accept={ALLOWED.join(',')}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded border border-line bg-surface p-2 text-ui file:mr-3 file:rounded file:border-0 file:bg-canvas file:px-3 file:py-1.5 file:text-ui file:font-semibold file:text-ink"
              />
            )}
          </Field>

          <Field label="What you observed" hint="optional">
            {(props) => <TextArea {...props} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Scuff mark about 10 cm, already there at handover." />}
          </Field>

          <Field label="When you took it" hint="optional, your own statement">
            {(props) => <TextInput {...props} type="date" className="tnum" value={capturedAt} onChange={(e) => setCapturedAt(e.target.value)} />}
          </Field>

          {compareOptions && compareOptions.length > 0 ? (
            <Field label="Compare against a move-in record" hint="optional">
              {(props) => (
                <select {...props} value={compareId} onChange={(e) => setCompareId(e.target.value)} className="h-11 w-full rounded border border-line bg-surface px-3 text-ui">
                  <option value="">No comparison</option>
                  {compareOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.roomOrItem}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : null}

          <Callout tone="info">
            Homi strips unnecessary location metadata. The upload time is when it reached the server — it does not
            prove when the photo was taken.
          </Callout>

          {error ? (
            <p role="alert" className="rounded border border-danger-line bg-danger-tint px-3 py-2 text-ui text-ink">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </section>
  )
}

function EvidenceCard({ item, tenancyId }: { item: EvidenceItem; tenancyId: string; onDeleted: () => void }) {
  const client = useApiClient()
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoked: string | null = null
    if (item.mediaType.startsWith('image/')) {
      client.getEvidenceObjectUrl(tenancyId, item.id).then((next) => {
        if (next) {
          revoked = next
          setUrl(next)
        }
      })
    }
    return () => {
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [client, tenancyId, item.id, item.mediaType])

  return (
    <li className="overflow-hidden rounded border border-line">
      {url ? (
        <img src={url} alt={`Evidence: ${item.roomOrItem}`} className="h-32 w-full bg-canvas object-cover" />
      ) : (
        <div className="flex h-32 items-center justify-center bg-canvas text-ink-faint">
          <FileText aria-hidden className="h-6 w-6" />
        </div>
      )}
      <div className="p-2.5">
        <p className="text-ui font-semibold text-ink">{item.roomOrItem}</p>
        {item.note ? <p className="mt-0.5 text-label leading-[18px] text-ink-soft">{item.note}</p> : null}
        <p className="mt-1 text-micro text-ink-faint">Uploaded {formatDateTime(item.uploadedAt)}</p>
        {item.capturedAtStated ? (
          <p className="text-micro text-ink-faint">You stated it was taken {formatDate(item.capturedAtStated)}</p>
        ) : null}
      </div>
    </li>
  )
}

export { Trash2 }
