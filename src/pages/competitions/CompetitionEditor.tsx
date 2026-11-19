import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Chips, EmptyState, Field, PageHeader, Section, Sheet, inputClass } from '../../components/ui'
import { deleteCompetition, newCompetition, newEvent, saveCompetition, swimmerName, type CompetitionDraft } from '../../data/competitions'
import { useData } from '../../data/DataProvider'
import { readEvents, type ReadResult } from '../../data/eventReader'
import type { EventKind, MeetEvent } from '../../data/types'
import { ACCEPTED_FILES, fileToText } from '../../lib/fileText'
import { KindTag } from './parts'

const KIND_LABELS = { Relay: 'relay', Individual: 'individual' } as const

export default function CompetitionEditor() {
  const { id } = useParams()
  const { data, update } = useData()
  const navigate = useNavigate()
  const existing = data.competitions.find((c) => c.id === id && !c.deleted)
  const [draft, setDraft] = useState<CompetitionDraft>(() => existing ?? newCompetition())
  const [importing, setImporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (id && !existing) {
    return (
      <Section title="Competition not found">
        <Link className="text-brand-700 underline" to="/competitions">
          Back to competitions
        </Link>
      </Section>
    )
  }

  const set = (change: Partial<CompetitionDraft>) => setDraft((d) => ({ ...d, ...change }))
  const setEvents = (events: MeetEvent[]) => set({ events })

  // Active swimmers, plus anyone already picked who has since gone inactive.
  const choices = data.swimmers
    .filter((s) => !s.deleted && (s.active || draft.swimmerIds.includes(s.id)))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
  const allPicked = choices.length > 0 && choices.every((s) => draft.swimmerIds.includes(s.id))

  const save = () => {
    if (!draft.name.trim()) {
      setError('Give the competition a name.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    update(saveCompetition({ ...draft, name: draft.name.trim(), location: draft.location.trim() }))
    navigate(`/competitions/${draft.id}`, { replace: true })
  }

  return (
    <>
      <PageHeader
        title={existing ? 'Edit competition' : 'New competition'}
        action={
          <Button variant="ghost" onClick={() => navigate(existing ? `/competitions/${draft.id}` : '/competitions')}>
            Cancel
          </Button>
        }
      />

      <Section title="Details">
        <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <Field label="Name">
            <input className={inputClass} value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Home dual vs. Lincoln" />
          </Field>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date">
              <input type="date" className={inputClass} value={draft.date ?? ''} onChange={(e) => set({ date: e.target.value || null })} />
            </Field>
            <Field label="Location">
              <input className={inputClass} value={draft.location} onChange={(e) => set({ location: e.target.value })} placeholder="Pool or school" />
            </Field>
          </div>
        </div>
      </Section>

      <Section
        title="Swimmers"
        subtitle={`${draft.swimmerIds.length} of ${choices.length} picked`}
        action={
          choices.length > 0 && (
            <Button variant="ghost" onClick={() => set({ swimmerIds: allPicked ? [] : choices.map((s) => s.id) })}>
              {allPicked ? 'Clear all' : 'Select all'}
            </Button>
          )
        }
      >
        {choices.length === 0 ? (
          <EmptyState>Add swimmers on the Swimmers tab first.</EmptyState>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {choices.map((s) => {
              const checked = draft.swimmerIds.includes(s.id)
              return (
                <li key={s.id}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-white px-3 shadow-sm ring-1 ring-slate-200">
                    <input
                      type="checkbox"
                      className="size-5 accent-brand-700"
                      checked={checked}
                      onChange={() =>
                        set({ swimmerIds: checked ? draft.swimmerIds.filter((x) => x !== s.id) : [...draft.swimmerIds, s.id] })
                      }
                    />
                    <span className="flex-1 font-medium">{swimmerName(s)}</span>
                    <span className="text-xs text-slate-500">{s.active ? s.level : 'Inactive'}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section
        title="Events"
        subtitle="Relays are shown first in the lineup, then individual events."
        action={
          <Button variant="secondary" onClick={() => setImporting(true)}>
            Upload or paste
          </Button>
        }
      >
        <EventList events={draft.events} onChange={setEvents} />
        <Button
          variant="ghost"
          className="mt-2"
          onClick={() => setEvents([...draft.events, newEvent({ name: '', kind: 'individual' })])}
        >
          + Add event
        </Button>
      </Section>

      <div className="flex flex-wrap gap-3 px-4 pb-8 md:px-8">
        <Button className="flex-1 sm:flex-none" onClick={save}>
          Save competition
        </Button>
        {existing &&
          (confirmDelete ? (
            <>
              <Button
                variant="danger"
                onClick={() => {
                  update(deleteCompetition(draft.id))
                  navigate('/competitions', { replace: true })
                }}
              >
                Yes, delete it
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete competition
            </Button>
          ))}
      </div>

      {importing && (
        <ImportSheet
          onClose={() => setImporting(false)}
          onAdd={(found) => {
            setEvents([...draft.events, ...found])
            setImporting(false)
          }}
        />
      )}
    </>
  )
}

function EventList({ events, onChange }: { events: MeetEvent[]; onChange: (events: MeetEvent[]) => void }) {
  if (events.length === 0) return <EmptyState>No events yet. Upload the meet’s event list, paste it, or add events one by one.</EmptyState>

  const replace = (i: number, change: Partial<MeetEvent>) => onChange(events.map((e, j) => (j === i ? { ...e, ...change } : e)))
  const move = (i: number, by: number) => {
    const next = [...events]
    const [item] = next.splice(i, 1)
    next.splice(i + by, 0, item)
    onChange(next)
  }

  return (
    <ol className="space-y-2">
      {events.map((e, i) => (
        <li key={e.id} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-sm font-semibold text-slate-400">{i + 1}</span>
            <input
              aria-label={`Event ${i + 1} name`}
              className={inputClass}
              value={e.name}
              placeholder="e.g. Girls 200 Medley Relay"
              onChange={(ev) => {
                const name = ev.target.value
                const found = readEvents(name).events[0]
                replace(i, { name, stroke: found?.stroke ?? null, distance: found?.distance ?? null })
              }}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 sm:pl-8">
            <Chips
              options={['Relay', 'Individual'] as const}
              value={e.kind === 'relay' ? 'Relay' : 'Individual'}
              onChange={(label) => {
                const kind: EventKind = KIND_LABELS[label ?? 'Individual']
                if (kind !== e.kind) replace(i, { kind, entries: newEvent({ name: e.name, kind }).entries })
              }}
            />
            <span className="flex-1" />
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="size-11 rounded-xl text-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30">
              ↑
            </button>
            <button type="button" aria-label="Move down" disabled={i === events.length - 1} onClick={() => move(i, 1)} className="size-11 rounded-xl text-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30">
              ↓
            </button>
            <button type="button" aria-label="Remove event" onClick={() => onChange(events.filter((_, j) => j !== i))} className="size-11 rounded-xl text-xl text-red-700 hover:bg-red-50">
              ×
            </button>
          </div>
        </li>
      ))}
    </ol>
  )
}

function ImportSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (events: MeetEvent[]) => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [result, setResult] = useState<ReadResult | null>(null)
  const [picked, setPicked] = useState<boolean[]>([])
  const [status, setStatus] = useState<string | null>(null)

  const read = (source: string) => {
    const found = readEvents(source)
    setResult(found)
    setPicked(found.events.map(() => true))
  }

  return (
    <Sheet
      title="Add events"
      onClose={onClose}
      footer={
        result ? (
          <>
            <Button variant="secondary" onClick={() => setResult(null)}>
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={!picked.some(Boolean)}
              onClick={() => onAdd(result.events.filter((_, i) => picked[i]).map((e) => newEvent(e)))}
            >
              Add {picked.filter(Boolean).length} event{picked.filter(Boolean).length === 1 ? '' : 's'}
            </Button>
          </>
        ) : (
          <Button className="flex-1" disabled={!text.trim()} onClick={() => read(text)}>
            Find events
          </Button>
        )
      }
    >
      {!result ? (
        <div className="space-y-4">
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_FILES}
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              setStatus(`Reading ${file.name}…`)
              try {
                const content = await fileToText(file)
                setText(content)
                setStatus(null)
                read(content)
              } catch (err) {
                setStatus((err as Error).message || 'That file couldn’t be read.')
              }
            }}
          />
          <Button variant="secondary" className="w-full" onClick={() => fileInput.current?.click()}>
            Upload a file (PDF, Word, Excel, CSV or text)
          </Button>
          {status && <p className="text-sm text-slate-600">{status}</p>}
          <Field label="Or paste the event list">
            <textarea
              className={`${inputClass} h-48 py-2`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Event 1  Girls 200 Yard Medley Relay\nEvent 2  Boys 200 Yard Medley Relay\nEvent 3  Girls 200 Yard Freestyle'}
            />
          </Field>
        </div>
      ) : (
        <div className="space-y-4">
          {result.events.length === 0 ? (
            <EmptyState>No events found. Check the text, or add events by hand.</EmptyState>
          ) : (
            <ul className="space-y-1">
              {result.events.map((e, i) => (
                <li key={i}>
                  <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="size-5 accent-brand-700"
                      checked={picked[i]}
                      onChange={() => setPicked((p) => p.map((v, j) => (j === i ? !v : v)))}
                    />
                    <span className="flex-1 text-sm font-medium">{e.name}</span>
                    <KindTag kind={e.kind} />
                  </label>
                </li>
              ))}
            </ul>
          )}
          {result.skipped.length > 0 && (
            <details className="rounded-xl bg-slate-50 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-slate-700">
                {result.skipped.length} line{result.skipped.length === 1 ? '' : 's'} skipped
              </summary>
              <ul className="mt-2 space-y-1 text-slate-600">
                {result.skipped.map((s, i) => (
                  <li key={i}>
                    <span className="text-slate-900">{s.line}</span> · {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="text-xs text-slate-500">You can rename, reorder or remove events after adding them.</p>
        </div>
      )}
    </Sheet>
  )
}
