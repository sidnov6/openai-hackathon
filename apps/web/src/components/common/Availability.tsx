import { CalendarCheck, CircleHelp, DoorClosed, FileClock, KeyRound } from 'lucide-react'
import type { Availability, AvailabilityEvidence } from '@/api/contracts.mirror'
import { Badge } from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/dates'

/**
 * Availability wording is the most dangerous place in this product to be loose.
 *
 * A residence marker is NOT an available room. "Applications open" is NOT an offer.
 * A waiting-list application is NOT a room offer. These labels say exactly that, and
 * each is paired with an icon so the distinction is not carried by colour.
 */
export const AVAILABILITY_META: Record<
  Availability,
  { label: string; tone: 'success' | 'primary' | 'amber' | 'neutral' | 'danger'; icon: React.ReactNode; meaning: string }
> = {
  offer_reported: {
    label: 'Offer reported',
    tone: 'success',
    icon: <KeyRound />,
    meaning:
      'A source reported a room as available at the time shown. It is not an assurance that the room is still free now.',
  },
  applications_open: {
    label: 'Applications open',
    tone: 'primary',
    icon: <CalendarCheck />,
    meaning: 'The provider is accepting applications. This is not a room offer and does not mean a room is free.',
  },
  waitlist: {
    label: 'Waiting list',
    tone: 'amber',
    icon: <FileClock />,
    meaning: 'You can join a waiting list. A waiting-list application is not a room offer.',
  },
  unavailable: {
    label: 'No rooms reported',
    tone: 'danger',
    icon: <DoorClosed />,
    meaning: 'The source states that no rooms are currently available.',
  },
  unknown: {
    label: 'Availability unknown',
    tone: 'neutral',
    icon: <CircleHelp />,
    meaning:
      'No source stated whether a room is available. This is shown as unknown rather than guessed in either direction.',
  },
}

export function AvailabilityBadge({ value }: { value: Availability }) {
  const meta = AVAILABILITY_META[value]
  return (
    <Badge tone={meta.tone} icon={meta.icon} title={meta.meaning}>
      {meta.label}
    </Badge>
  )
}

export function AvailabilityExplanation({
  value,
  evidence,
}: {
  value: Availability
  evidence?: AvailabilityEvidence | undefined
}) {
  const meta = AVAILABILITY_META[value]
  return (
    <div className="text-ui leading-[22px]">
      <p className="text-ink-soft">{meta.meaning}</p>
      {evidence ? (
        <figure className="mt-2">
          <blockquote className="clause-quote">{evidence.statement}</blockquote>
          <figcaption className="mt-1 text-label text-ink-muted">
            Observed {formatDateTime(evidence.observedAt)}
          </figcaption>
        </figure>
      ) : (
        <p className="mt-2 text-label text-ink-muted">No availability statement was found on the source page.</p>
      )}
    </div>
  )
}
