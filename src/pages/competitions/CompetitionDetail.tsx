import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar, Button, EmptyState, PageHeader, Section } from '../../components/ui'
import { badgesFor, clearSlot, individualEvents, relayEvents, swimmerName, toggleEntry, updateEvent } from '../../data/competitions'
import { useData } from '../../data/DataProvider'
import { RELAY_SLOTS, type Competition, type MeetEvent, type Swimmer } from '../../data/types'
import { formatLongDate } from '../../lib/format'
import { EntryBadges, KindTag } from './parts'

export default function CompetitionDetail() {
  const { id } = useParams()
  const { data, update } = useData()
  const navigate = useNavigate()
  const competition = data.competitions.find((c) => c.id === id && !c.deleted)
  const [open, setOpen] = useState<{ eventId: string; slot: number | null } | null>(null)

  if (!competition) {
    return (
      <Section title="Competition not found">
        <Link className="text-brand-700 underline" to="/competitions">
          Back to competitions
        </Link>
      </Section>
    )
  }

  const swimmersById = new Map(data.swimmers.map((s) => [s.id, s]))
  const relays = relayEvents(competition)
  const individual = individualEvents(competition)
  const openEvent = open && competition.events.find((e) => e.id === open.eventId)

  return (
    <>
      <div className="px-4 pt-4 md:px-8">
        <Link to="/competitions" className="text-sm font-semibold text-brand-700">
          ‹ Competitions
        </Link>
      </div>
      <PageHeader
        title={competition.name || 'Untitled meet'}
        action={
          <Button variant="secondary" onClick={() => navigate(`/competitions/${competition.id}/edit`)}>
            Edit
          </Button>
        }
      />
      <p className="-mt-2 px-4 pb-4 text-sm text-slate-500 md:px-8">
        {[competition.date && formatLongDate(competition.date), competition.location, `${competition.swimmerIds.length} swimmers`]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {relays.length > 0 && (
        <p className="mx-4 mb-4 hidden rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900 portrait:block wide:hidden">
          Turn your phone sideways to see every relay slot.
        </p>
      )}

      {competition.events.length === 0 ? (
        <Section title="Lineup">
          <EmptyState>
            No events yet.{' '}
            <Link className="font-semibold text-brand-700 underline" to={`/competitions/${competition.id}/edit`}>
              Add the meet’s events
            </Link>{' '}
            to start building the lineup.
          </EmptyState>
        </Section>
      ) : (
        <>
          {relays.length > 0 && (
            <Section title="Relays" subtitle="Tap a relay or a slot to assign swimmers.">
              <RelayGrid relays={relays} swimmersById={swimmersById} onOpen={(eventId, slot) => setOpen({ eventId, slot })} />
            </Section>
          )}
          {individual.length > 0 && (
            <Section title="Individual events" subtitle="Tap an event to enter swimmers.">
              <ul className="space-y-2">
                {individual.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setOpen({ eventId: e.id, slot: null })}
                      className="w-full rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-slate-200 hover:ring-brand-500"
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex-1 font-semibold">{e.name || 'Unnamed event'}</span>
                        <KindTag kind="individual" />
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {e.entries.length === 0 ? (
                          <span className="text-sm text-slate-400">No swimmers entered</span>
                        ) : (
                          e.entries.map((sid) => (
                            <span key={sid} className="rounded-lg bg-slate-100 px-2 py-1 text-sm">
                              {swimmerName(swimmersById.get(sid))}
                            </span>
                          ))
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}

      {openEvent && (
        <AssignPanel
          competition={competition}
          event={openEvent}
          initialSlot={open.slot}
          swimmersById={swimmersById}
          onChange={(change) => update(updateEvent(competition.id, openEvent.id, change))}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}

function shortName(s: Swimmer | undefined): string {
  if (!s) return '?'
  return `${s.firstName} ${s.lastName.slice(0, 1)}${s.lastName ? '.' : ''}`.trim()
}

function RelayGrid({
  relays,
  swimmersById,
  onOpen,
}: {
  relays: MeetEvent[]
  swimmersById: Map<string, Swimmer>
  onOpen: (eventId: string, slot: number | null) => void
}) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <th className="sticky left-0 z-10 min-w-40 border-b border-slate-200 bg-white px-3 py-2">Event</th>
            <th className="border-b border-slate-200 px-2 py-2">Type</th>
            {RELAY_SLOTS.map((slot) => (
              <th key={slot} className="min-w-[4.75rem] border-b border-slate-200 px-2 py-2">
                {slot}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {relays.map((e) => (
            <tr key={e.id} className="group">
              <th scope="row" className="sticky left-0 z-10 border-b border-slate-100 bg-white p-0 text-left font-semibold group-hover:bg-brand-50">
                <button type="button" onClick={() => onOpen(e.id, null)} className="block min-h-12 w-full px-3 py-2 text-left">
                  {e.name || 'Unnamed relay'}
                </button>
              </th>
              <td className="border-b border-slate-100 px-2 group-hover:bg-brand-50">
                <KindTag kind="relay" />
              </td>
              {RELAY_SLOTS.map((slot, i) => {
                const sid = e.entries[i]
                return (
                  <td key={slot} className="border-b border-slate-100 p-0 group-hover:bg-brand-50">
                    <button
                      type="button"
                      aria-label={`${e.name} slot ${slot}`}
                      onClick={() => onOpen(e.id, i)}
                      className={`block min-h-12 w-full px-2 text-left ${sid ? 'font-medium text-slate-900' : 'text-slate-300'} ${i % 4 === 0 ? 'border-l border-slate-100' : ''}`}
                    >
                      {sid ? shortName(swimmersById.get(sid)) : '—'}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Slides in from the right with the competition's swimmers. Each shows its
// I and R badges; tapping a name enters or removes them from this event.
function AssignPanel({
  competition,
  event,
  initialSlot,
  swimmersById,
  onChange,
  onClose,
}: {
  competition: Competition
  event: MeetEvent
  initialSlot: number | null
  swimmersById: Map<string, Swimmer>
  onChange: (change: (e: MeetEvent) => MeetEvent) => void
  onClose: () => void
}) {
  const [slot, setSlot] = useState<number | null>(initialSlot)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true))
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const isRelay = event.kind === 'relay'
  // The meet's swimmers, plus anyone entered who was later unpicked.
  const ids = [...new Set([...competition.swimmerIds, ...event.entries.filter(Boolean)])]
  const swimmers = ids
    .map((sid) => swimmersById.get(sid))
    .filter((s): s is Swimmer => Boolean(s && !s.deleted))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
  const relayFull = isRelay && event.entries.every(Boolean)

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={event.name}>
      <div className={`absolute inset-0 bg-slate-900/40 transition-opacity ${shown ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-xl transition-transform duration-200 ${
          shown ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{event.name || 'Unnamed event'}</h2>
            <KindTag kind={event.kind} />
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="size-10 rounded-full text-2xl text-slate-500 hover:bg-slate-100">
            ×
          </button>
        </div>

        {isRelay && (
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="mb-2 text-xs text-slate-500">
              {slot === null ? 'Tapping a name fills the next empty slot. Tap a slot to choose it.' : `Tapping a name fills ${RELAY_SLOTS[slot]}.`}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {RELAY_SLOTS.map((label, i) => {
                const sid = event.entries[i]
                const selected = slot === i
                return (
                  <div key={label} className="relative">
                    <button
                      type="button"
                      onClick={() => setSlot(selected ? null : i)}
                      aria-pressed={selected}
                      className={`flex min-h-12 w-full flex-col items-start justify-center rounded-lg px-2 text-left ring-1 ${
                        selected ? 'bg-brand-50 ring-2 ring-brand-600' : 'ring-slate-200'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-slate-400">{label}</span>
                      <span className={`w-full truncate text-xs ${sid ? 'font-semibold' : 'text-slate-300'}`}>
                        {sid ? shortName(swimmersById.get(sid)) : 'Empty'}
                      </span>
                    </button>
                    {sid && (
                      <button
                        type="button"
                        aria-label={`Clear ${label}`}
                        onClick={() => onChange((e) => clearSlot(e, i))}
                        className="absolute -top-1.5 -right-1.5 size-6 rounded-full bg-white text-sm text-slate-500 shadow ring-1 ring-slate-200"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {swimmers.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">No swimmers are picked for this competition yet. Edit the competition to pick them.</p>
          ) : (
            <ul>
              {swimmers.map((s) => {
                const at = event.entries.indexOf(s.id)
                const entered = at >= 0
                const disabled = isRelay && !entered && relayFull && slot === null
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onChange((e) => toggleEntry(e, s.id, slot))
                        setSlot(null)
                      }}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left disabled:opacity-40 ${entered ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
                    >
                      <Avatar id={s.id} name={swimmerName(s)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{swimmerName(s)}</span>
                        <EntryBadges badges={badgesFor(competition, s.id)} />
                      </span>
                      {entered && (
                        <span className="rounded-full bg-brand-700 px-2 py-0.5 text-xs font-bold text-white">
                          {isRelay ? RELAY_SLOTS[at] : '✓'}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-slate-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
