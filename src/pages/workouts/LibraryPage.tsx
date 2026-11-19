import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Chips, EmptyState, PageHeader, Section, Sheet, inputClass } from '../../components/ui'
import { useData } from '../../data/DataProvider'
import type { BlockKind, WorkoutBlock } from '../../data/types'
import { blockTags, datesUsed, deleteBlock, KIND_LABEL, liveBlocks, matchesSearch, newBlock, saveBlocks, workoutsUsing } from '../../data/workouts'
import { formatDate } from '../../lib/format'
import { TagEditor, TagList, textareaClass } from './parts'

const KINDS: Record<string, BlockKind> = { 'Warm ups': 'warmup', Sets: 'set', 'Cool downs': 'cooldown' }
type KindLabel = keyof typeof KINDS

// Every saved warm up, set and cool down, to browse, fix or tidy up.
export default function LibraryPage() {
  const { data } = useData()
  const [tab, setTab] = useState<KindLabel>('Sets')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<WorkoutBlock | 'new' | null>(null)
  const kind = KINDS[tab]
  const pieces = liveBlocks(data, kind)
    .filter((b) => matchesSearch(`${b.text} ${blockTags(b, data.tags).join(' ')}`, query))
    .sort((a, b) => (datesUsed(data, b.id)[0] ?? b.createdOn).localeCompare(datesUsed(data, a.id)[0] ?? a.createdOn))

  return (
    <>
      <PageHeader title="Saved pieces" action={<Button onClick={() => setEditing('new')}>New {KIND_LABEL[kind].toLowerCase()}</Button>} />
      <div className="space-y-3 px-4 pb-4 md:px-8">
        <p className="text-sm text-slate-600">
          <Link to="/workouts" className="text-brand-700 underline">
            Workouts
          </Link>{' '}
          · Changing a piece here changes it in every workout that uses it.
        </p>
        <Chips options={Object.keys(KINDS) as KindLabel[]} value={tab} onChange={(v) => v && setTab(v)} />
        <input type="search" className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search text or tags" aria-label="Search saved pieces" />
      </div>
      <Section title={`${pieces.length} ${tab.toLowerCase()}`}>
        {pieces.length === 0 ? (
          <EmptyState>Nothing here yet. Pieces you write in a workout are saved here automatically.</EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {pieces.map((b) => {
              const dates = datesUsed(data, b.id)
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(b)}
                    className="block h-full w-full space-y-2 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-brand-500"
                  >
                    <span className="line-clamp-6 block whitespace-pre-wrap font-mono text-sm text-slate-800">{b.text}</span>
                    <TagList tags={blockTags(b, data.tags)} />
                    <span className="block text-xs text-slate-500">
                      {dates.length ? `Used ${dates.slice(0, 4).map(formatDate).join(', ')}${dates.length > 4 ? '…' : ''}` : 'Not used in a workout'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
      {editing && <PieceSheet piece={editing === 'new' ? newBlock(kind) : editing} isNew={editing === 'new'} onClose={() => setEditing(null)} />}
    </>
  )
}

function PieceSheet({ piece, isNew, onClose }: { piece: Omit<WorkoutBlock, 'updatedAt'>; isNew: boolean; onClose: () => void }) {
  const { data, update } = useData()
  const [draft, setDraft] = useState(piece)
  const [confirm, setConfirm] = useState(false)
  const used = workoutsUsing(data, piece.id).length
  const save = () => {
    if (draft.text.trim()) update(saveBlocks([{ ...draft, text: draft.text.trim() }]))
    onClose()
  }
  return (
    <Sheet
      title={isNew ? `New ${KIND_LABEL[piece.kind].toLowerCase()}` : KIND_LABEL[piece.kind]}
      onClose={onClose}
      footer={
        confirm ? (
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                update(deleteBlock(piece.id))
                onClose()
              }}
            >
              Delete
            </Button>
          </>
        ) : (
          <>
            {!isNew && (
              <Button variant="danger" onClick={() => setConfirm(true)}>
                Delete
              </Button>
            )}
            <Button className="flex-1" disabled={!draft.text.trim()} onClick={save}>
              Save
            </Button>
          </>
        )
      }
    >
      <div className="space-y-3">
        {confirm && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {used ? `This also takes it out of the workouts that use it.` : 'Delete this piece?'}
          </p>
        )}
        <textarea rows={10} className={textareaClass} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} aria-label="Text" />
        <TagEditor block={draft} onChange={(tags) => setDraft({ ...draft, ...tags })} />
      </div>
    </Sheet>
  )
}
