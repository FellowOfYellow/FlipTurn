import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, EmptyState, Field, PageHeader, Section, Sheet, inputClass } from '../../components/ui'
import { useData } from '../../data/DataProvider'
import { allTagNames } from '../../data/tagging'
import type { BlockKind } from '../../data/types'
import {
  blockTags,
  datesUsed,
  KIND_LABEL,
  matchesSearch,
  newBlock,
  newWorkout,
  saveWorkout,
  uniqueBlocks,
  usesBlock,
  workoutBlocks,
  type BlockDraft,
  type WorkoutDraft,
} from '../../data/workouts'
import { formatDate, formatLongDate } from '../../lib/format'
import { TagEditor, TagList, textareaClass } from './parts'

export default function WorkoutEditor() {
  const { id } = useParams()
  const { data, update } = useData()
  const navigate = useNavigate()
  const existing = data.workouts.find((w) => w.id === id && !w.deleted)
  const [draft, setDraft] = useState<WorkoutDraft>(() => existing ?? newWorkout())
  // Pieces written during this edit; saved to the library with the workout.
  const [written, setWritten] = useState<BlockDraft[]>([])
  const [picking, setPicking] = useState<BlockKind | null>(null)

  if (id && !existing) {
    return (
      <Section title="Workout not found">
        <Link className="text-brand-700 underline" to="/workouts">
          Back to workouts
        </Link>
      </Section>
    )
  }

  const set = (change: Partial<WorkoutDraft>) => setDraft((d) => ({ ...d, ...change }))
  const { warmup, sets, cooldown } = workoutBlocks(data, draft, written)

  const choose = (kind: BlockKind, block: BlockDraft, isNew: boolean) => {
    if (isNew) setWritten((w) => [...w, block])
    if (kind === 'warmup') set({ warmupId: block.id })
    else if (kind === 'cooldown') set({ cooldownId: block.id })
    else setDraft((d) => ({ ...d, setIds: [...d.setIds, block.id] }))
    if (kind !== 'set') setPicking(null)
  }

  const moveSet = (index: number, by: number) => {
    const ids = [...draft.setIds]
    const [moved] = ids.splice(index, 1)
    ids.splice(index + by, 0, moved)
    set({ setIds: ids })
  }

  const save = () => {
    const name = draft.name.trim() || (draft.date ? `Practice ${formatDate(draft.date)}` : 'Practice')
    update(saveWorkout({ ...draft, name }, written.filter((b) => usesBlock(draft, b.id))))
    navigate(`/workouts/${draft.id}`, { replace: true })
  }

  return (
    <>
      <PageHeader
        title={existing ? 'Edit workout' : 'New workout'}
        action={
          <Button variant="ghost" onClick={() => navigate(existing ? `/workouts/${draft.id}` : '/workouts')}>
            Cancel
          </Button>
        }
      />

      <Section title="Details">
        <div className="grid gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
          <Field label="Name">
            <input className={inputClass} value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Monday aerobic" />
          </Field>
          <Field label="Date">
            <input type="date" className={inputClass} value={draft.date ?? ''} onChange={(e) => set({ date: e.target.value || null })} />
          </Field>
        </div>
      </Section>

      <Section title="Warm up">
        <PieceSlot kind="warmup" block={warmup} onPick={() => setPicking('warmup')} onRemove={() => set({ warmupId: null })} />
      </Section>

      <Section title="Sets" subtitle={sets.length ? `${sets.length} set${sets.length === 1 ? '' : 's'}, in order` : undefined}>
        <ol className="space-y-2">
          {sets.map((block, i) => (
            <li key={`${block.id}-${i}`} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <PieceText block={block} />
              <div className="mt-2 flex flex-wrap gap-1">
                <Button variant="ghost" disabled={i === 0} onClick={() => moveSet(i, -1)}>
                  ↑ Up
                </Button>
                <Button variant="ghost" disabled={i === sets.length - 1} onClick={() => moveSet(i, 1)}>
                  ↓ Down
                </Button>
                <Button variant="ghost" onClick={() => set({ setIds: draft.setIds.filter((_, j) => j !== i) })}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setPicking('set')}
          className="mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 font-semibold text-brand-700 hover:border-brand-500"
        >
          + Add set
        </button>
      </Section>

      <Section title="Cool down">
        <PieceSlot kind="cooldown" block={cooldown} onPick={() => setPicking('cooldown')} onRemove={() => set({ cooldownId: null })} />
      </Section>

      <div className="flex gap-3 px-4 pb-8 md:px-8">
        <Button className="flex-1 sm:flex-none" onClick={save}>
          Save workout
        </Button>
      </div>

      {(picking === 'warmup' || picking === 'cooldown') && (
        <PiecePicker kind={picking} onClose={() => setPicking(null)} onChoose={(b, isNew) => choose(picking, b, isNew)} />
      )}
      {picking === 'set' && (
        <SetPicker
          addedIds={draft.setIds}
          onClose={() => setPicking(null)}
          onChoose={(b, isNew) => choose('set', b, isNew)}
        />
      )}
    </>
  )
}

function PieceText({ block }: { block: BlockDraft }) {
  const { data } = useData()
  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-800">{block.text}</p>
      <TagList tags={blockTags(block, data.tags)} />
    </div>
  )
}

function PieceSlot({ kind, block, onPick, onRemove }: { kind: BlockKind; block: BlockDraft | null; onPick: () => void; onRemove: () => void }) {
  if (!block) {
    return (
      <button
        type="button"
        onClick={onPick}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 font-semibold text-brand-700 hover:border-brand-500"
      >
        + Add {KIND_LABEL[kind].toLowerCase()}
      </button>
    )
  }
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <PieceText block={block} />
      <div className="mt-2 flex gap-1">
        <Button variant="ghost" onClick={onPick}>
          Change
        </Button>
        <Button variant="ghost" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  )
}

// Write a new warm up, set or cool down, with tags showing as you type.
function NewPieceForm({ kind, onAdd, onCancel }: { kind: BlockKind; onAdd: (block: BlockDraft) => void; onCancel: () => void }) {
  const [block, setBlock] = useState(() => newBlock(kind))
  return (
    <div className="space-y-3">
      <textarea
        autoFocus
        rows={8}
        className={textareaClass}
        value={block.text}
        onChange={(e) => setBlock({ ...block, text: e.target.value })}
        placeholder={kind === 'set' ? 'e.g.\n8x50 free @:50\n4x100 IM @1:45' : 'e.g.\n400 easy swim\n200 kick with board'}
        aria-label={`New ${KIND_LABEL[kind].toLowerCase()}`}
      />
      <TagEditor block={block} onChange={(tags) => setBlock({ ...block, ...tags })} />
      <div className="flex gap-2">
        <Button disabled={!block.text.trim()} onClick={() => onAdd({ ...block, text: block.text.trim() })}>
          Add {KIND_LABEL[kind].toLowerCase()}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Back
        </Button>
      </div>
    </div>
  )
}

function UsedOn({ blockId }: { blockId: string }) {
  const { data } = useData()
  const dates = datesUsed(data, blockId)
  if (dates.length === 0) return <span className="text-xs text-slate-500">Not used yet</span>
  return (
    <span className="text-xs text-slate-500">
      Last used {formatLongDate(dates[0])}
      {dates.length > 1 ? ` · used ${dates.length} times` : ''}
    </span>
  )
}

function PieceButton({ block, onClick, added }: { block: BlockDraft; onClick: () => void; added?: boolean }) {
  const { data } = useData()
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full space-y-1 rounded-xl p-3 text-left ring-1 transition ${
        added ? 'bg-brand-50 ring-brand-500' : 'bg-white ring-slate-200 hover:ring-brand-500'
      }`}
    >
      <span className="line-clamp-4 block whitespace-pre-wrap font-mono text-sm text-slate-800">{block.text}</span>
      <TagList tags={blockTags(block, data.tags)} max={4} />
      <span className="flex items-center justify-between gap-2">
        <UsedOn blockId={block.id} />
        {added && <span className="text-xs font-semibold text-brand-700">✓ Added</span>}
      </span>
    </button>
  )
}

function PiecePicker({ kind, onClose, onChoose }: { kind: BlockKind; onClose: () => void; onChoose: (block: BlockDraft, isNew: boolean) => void }) {
  const { data } = useData()
  const [writing, setWriting] = useState(false)
  const [query, setQuery] = useState('')
  const pieces = uniqueBlocks(data, kind).filter((b) => matchesSearch(b.text, query))
  const label = KIND_LABEL[kind]
  return (
    <Sheet title={writing ? `New ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`} onClose={onClose}>
      {writing ? (
        <NewPieceForm kind={kind} onAdd={(b) => onChoose(b, true)} onCancel={() => setWriting(false)} />
      ) : (
        <div className="space-y-3">
          <Button className="w-full" onClick={() => setWriting(true)}>
            Write a new one
          </Button>
          {uniqueBlocks(data, kind).length > 0 && (
            <input type="search" className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search saved ${label.toLowerCase()}s`} />
          )}
          {pieces.map((b) => (
            <PieceButton key={b.id} block={b} onClick={() => onChoose(b, false)} />
          ))}
          {uniqueBlocks(data, kind).length === 0 && <p className="text-center text-sm text-slate-500">No saved {label.toLowerCase()}s yet.</p>}
        </div>
      )}
    </Sheet>
  )
}

// A full page for picking sets: one box per tag, so the coach can browse by
// what the set works on.
function SetPicker({ addedIds, onClose, onChoose }: { addedIds: string[]; onClose: () => void; onChoose: (block: BlockDraft, isNew: boolean) => void }) {
  const { data } = useData()
  const [writing, setWriting] = useState(false)
  const [query, setQuery] = useState('')
  const sets = uniqueBlocks(data, 'set').filter((b) => matchesSearch(b.text, query))
  const tagged = sets.map((b) => ({ block: b, tags: blockTags(b, data.tags) }))
  const boxes = [
    ...allTagNames(data.tags).map((tag) => ({ tag, items: tagged.filter((s) => s.tags.includes(tag)) })),
    { tag: 'No tags', items: tagged.filter((s) => s.tags.length === 0) },
  ].filter((box) => box.items.length > 0)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" role="dialog" aria-modal="true" aria-label="Add a set">
      <PageHeader
        title={writing ? 'New set' : 'Add a set'}
        action={!writing && <Button onClick={onClose}>Done</Button>}
      />
      <div className="px-4 pb-8 md:px-8">
        {writing ? (
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <NewPieceForm
              kind="set"
              onAdd={(b) => {
                onChoose(b, true)
                onClose()
              }}
              onCancel={() => setWriting(false)}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <Button className="w-full sm:w-auto" onClick={() => setWriting(true)}>
              Create a new set
            </Button>
            {uniqueBlocks(data, 'set').length === 0 ? (
              <EmptyState>No saved sets yet. Create one and it will be here next time, sorted by tag.</EmptyState>
            ) : (
              <>
                <input type="search" className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search saved sets" />
                {boxes.length === 0 && <EmptyState>No sets match.</EmptyState>}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {boxes.map((box) => (
                    <section key={box.tag} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                      <h3 className="mb-2 px-1 font-semibold">
                        {box.tag} <span className="text-sm font-normal text-slate-500">({box.items.length})</span>
                      </h3>
                      <div className="max-h-96 space-y-2 overflow-y-auto">
                        {box.items.map(({ block }) => (
                          <PieceButton key={block.id} block={block} added={addedIds.includes(block.id)} onClick={() => onChoose(block, false)} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
