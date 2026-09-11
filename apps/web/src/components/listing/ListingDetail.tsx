import { useState } from 'react'
import { Building2, ExternalLink, FlaskConical, ImageOff, Mail, ShieldQuestion } from 'lucide-react'
import type { DemoPolicyLink, Listing } from '@/api/contracts.mirror'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { Sheet } from '@/components/ui/Sheet'
import { AvailabilityExplanation } from '@/components/common/Availability'
import { Money } from '@/components/common/Money'
import { SourceRow } from '@/components/common/Citation'
import { formatDistance } from '@/lib/geo'
import { formatDateTime } from '@/lib/dates'

const CONTACT_ROLE_LABEL: Record<NonNullable<Listing['contact']>['role'], string> = {
  provider_office: 'Housing provider office',
  operator: 'Residence operator',
  letting_agent: 'Letting agent (not necessarily the owner)',
  application_portal: 'Official application portal',
  unknown: 'Contact role not established',
}

/**
 * The details sheet.
 *
 * Two things are kept rigorously apart here: what the REAL source says about this
 * location, and the FICTIONAL demo lease that may be paired with it. They never share a
 * section, and the demo pairing is announced before the student can enter it.
 */
export function ListingDetail({
  listing,
  demoLink,
  open,
  onOpenChange,
  onStartDemo,
  onPrepareContact,
  demoBusy,
}: {
  listing: Listing
  demoLink: DemoPolicyLink | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStartDemo: () => void
  onPrepareContact: () => void
  demoBusy: boolean
}) {
  const [demoConfirmOpen, setDemoConfirmOpen] = useState(false)
  const cost = listing.monthlyCost
  const distance = formatDistance(listing.distanceMeters)
  const canDemo = demoLink?.status === 'ready'
  const awaitingDoc = demoLink?.status === 'awaiting_document'

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      labelledById="listing-detail-title"
      title={listing.title}
      description={listing.address ?? 'Address not published by the source'}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" className="flex-1" onClick={onPrepareContact}>
            <Mail aria-hidden className="h-4 w-4" />
            Prepare a message
          </Button>
          {canDemo ? (
            <Button variant="secondary" onClick={() => setDemoConfirmOpen(true)} loading={demoBusy}>
              <FlaskConical aria-hidden className="h-4 w-4" />
              Open sample lease demo
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5 px-4 py-4 sm:px-5">
        {/* ---------- Photos: honest absence rather than a decorative stand-in ------ */}
        {listing.photos.length > 0 ? (
          <figure>
            <img src={listing.photos[0].url} alt="" className="h-40 w-full rounded-md object-cover" />
            <figcaption className="mt-1 text-micro text-ink-muted">{listing.photos[0].attribution}</figcaption>
          </figure>
        ) : (
          <div className="flex items-center gap-2.5 rounded-md border border-dashed border-line-strong bg-surface-sunken px-3 py-4 text-ui text-ink-muted">
            <ImageOff aria-hidden className="h-5 w-5 shrink-0 text-ink-faint" />
            <span>
              No licensed photo is available for this location. Homi does not show a generated interior in its place —
              it would not depict this building.
            </span>
          </div>
        )}

        {/* ---------- Real facts --------------------------------------------------- */}
        <section aria-labelledby="facts-heading">
          <h3 id="facts-heading" className="text-label font-bold uppercase tracking-wide text-ink-faint">
            What the source says
          </h3>

          <dl className="mt-2 divide-y divide-line-soft rounded-md border border-line">
            <Row label="Scope">
              {listing.scope === 'residence' ? 'A whole residence — not a single advertised room' : 'One individual room offer'}
            </Row>
            <Row label="Distance">
              {distance ? `${distance} straight line from your origin` : 'Not calculable — no coordinate published'}
              <span className="block text-label text-ink-muted">Straight-line distance, not travel time.</span>
            </Row>
            <Row label="Cold rent (Kaltmiete)">
              <Money cents={cost?.kaltmieteCents ?? null} />
            </Row>
            <Row label="Operating costs (Nebenkosten)">
              <Money cents={cost?.nebenkostenCents ?? null} />
            </Row>
            <Row label="Warm rent (Warmmiete)">
              <Money cents={cost?.warmmieteCents ?? null} />
              <span className="block text-label text-ink-muted">
                Shown only when the source states it. Homi does not add up components to invent one.
              </span>
            </Row>
            <Row label="Location precision">
              {listing.locationPrecision === 'exact'
                ? 'Published by the provider'
                : listing.locationPrecision === 'approximate'
                  ? 'Derived — the pin is approximate'
                  : listing.locationPrecision === 'area_only'
                    ? 'District only'
                    : 'Unknown'}
            </Row>
          </dl>

          <SourceRow refs={listing.sourceRefs} title="Where this record came from" className="mt-2.5" />
        </section>

        {/* ---------- Availability ------------------------------------------------- */}
        <section aria-labelledby="avail-heading">
          <h3 id="avail-heading" className="text-label font-bold uppercase tracking-wide text-ink-faint">
            Availability
          </h3>
          <div className="mt-2 rounded-md border border-line p-3">
            <AvailabilityExplanation value={listing.availability} evidence={listing.availabilityEvidence} />
          </div>
        </section>

        {/* ---------- Contact ------------------------------------------------------ */}
        <section aria-labelledby="contact-heading">
          <h3 id="contact-heading" className="text-label font-bold uppercase tracking-wide text-ink-faint">
            Contact route
          </h3>
          {listing.contact ? (
            <div className="mt-2 rounded-md border border-line p-3">
              <p className="flex items-center gap-1.5 text-ui font-semibold text-ink">
                <Building2 aria-hidden className="h-4 w-4 text-ink-muted" />
                {listing.contact.organisation ?? 'Organisation not named by the source'}
              </p>
              <p className="mt-0.5 text-label text-ink-muted">{CONTACT_ROLE_LABEL[listing.contact.role]}</p>
              <ul className="mt-2 space-y-1 text-ui">
                {listing.contact.email ? <li>{listing.contact.email}</li> : null}
                {listing.contact.phone ? <li className="tnum">{listing.contact.phone}</li> : null}
                {listing.contact.url ? (
                  <li>
                    <a
                      href={listing.contact.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-print-url={listing.contact.url}
                      className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2"
                    >
                      Official page
                      <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ) : null}
                {!listing.contact.email && !listing.contact.phone ? (
                  <li className="text-ink-muted">
                    No public contact details were published. Use the official page above — Homi will not infer a
                    private owner's details.
                  </li>
                ) : null}
              </ul>
              <SourceRow refs={listing.contact.sourceRefs} title="Contact source" className="mt-2.5" />
            </div>
          ) : (
            <Callout tone="attention" className="mt-2" title="No contact route was found">
              The source page published no contact details. Open the provider page and look for their application route.
            </Callout>
          )}
        </section>

        {/* ---------- Demo lease pairing: fenced off from everything above --------- */}
        <section aria-labelledby="demo-heading" className="rounded-md border border-demo-line bg-demo-tint p-3">
          <h3 id="demo-heading" className="flex items-center gap-1.5 text-label font-bold uppercase tracking-wide text-demo">
            <FlaskConical aria-hidden className="h-4 w-4" />
            Demonstration lease
          </h3>
          {canDemo ? (
            <>
              <p className="mt-1.5 text-ui leading-[22px] text-ink">
                This real location is paired with a <strong>fictional lease</strong> for demonstration. It is not the
                provider's actual agreement, and nothing in it describes this building.
              </p>
              <p className="mt-1.5 text-label text-ink-soft">
                Slot {demoLink.slotId} · policy {demoLink.policyId} · document version {demoLink.documentVersion}
              </p>
            </>
          ) : awaitingDoc ? (
            <p className="mt-1.5 text-ui leading-[22px] text-ink">
              Slot {demoLink?.slotId} is reserved for this location, but no policy document has been imported into it
              yet. <strong>Awaiting policy document</strong> — the demo cannot produce an analysis until the file exists.
            </p>
          ) : (
            <p className="mt-1.5 flex items-start gap-2 text-ui leading-[22px] text-ink">
              <ShieldQuestion aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-demo" />
              <span>
                <strong>No demo lease linked.</strong> This record is outside the 20-slot demo catalogue. It will not be
                given a fictional policy just to fill the screen.
              </span>
            </p>
          )}
        </section>

        <p className="text-label leading-[18px] text-ink-muted">
          Record checked {formatDateTime(listing.checkedAt)}. Availability and price can change without the source page
          being updated.
        </p>
      </div>

      <DemoConfirmModal
        open={demoConfirmOpen}
        onOpenChange={setDemoConfirmOpen}
        listing={listing}
        onConfirm={() => {
          setDemoConfirmOpen(false)
          onStartDemo()
        }}
      />
    </Sheet>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5 px-3 py-2.5">
      <dt className="w-full text-label font-semibold text-ink-muted sm:w-44 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 flex-1 text-ui text-ink">{children}</dd>
    </div>
  )
}

/** The gate before the demo flow. The student must read what the pairing is. */
function DemoConfirmModal({
  open,
  onOpenChange,
  listing,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  listing: Listing
  onConfirm: () => void
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="bottom"
      title="You are entering a demonstration"
      description="Read this before continuing"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            <FlaskConical aria-hidden className="h-4 w-4" />
            Continue to the demo
          </Button>
        </div>
      }
    >
      <div className="space-y-3 px-4 py-4 sm:px-5">
        <Callout tone="demo" title="This real location is paired with a fictional lease for demonstration.">
          It is <strong>not the provider's actual agreement</strong>. {listing.title} is a real record from a real source;
          the lease you are about to read was written for this demonstration and describes no real building.
        </Callout>
        <ul className="space-y-1.5 text-ui leading-[22px] text-ink-soft">
          <li>· Nothing is sent to the real provider, now or later.</li>
          <li>· The acceptance you will see is triggered by a demo control in this app, not by anyone at the provider.</li>
          <li>· Rent, deposit and addresses in the sample lease do not describe this location and must not be used to judge it.</li>
          <li>· The real contact route stays separate and remains available on the details panel.</li>
        </ul>
      </div>
    </Sheet>
  )
}
