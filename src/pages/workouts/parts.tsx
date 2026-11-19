import { useState } from 'react'
import { Button, Field, Sheet, inputClass } from '../../components/ui'
import { useData } from '../../data/DataProvider'
import { newId } from '../../data/actions'
import { allTagNames, BUILT_IN_TAGS, parseKeywords } from '../../data/tagging'
import { blockTags, deleteTag, saveTag, toggleTag } from '../../data/workouts'
import type { WorkoutBlock } from '../../data/types'

export const textareaClass =
  'block w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-base leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

export function TagList({ tags, max }: { tags: string[]; max?: number }) {
  if (tags.length === 0) return null
  const shown = max ? tags.slice(0, max) : tags
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <span key={t} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
          {t}
        </span>
      ))}
      {shown.length < tags.length && <span className="px-1 text-xs text-slate-500">+{tags.length - shown.length}</span>}
    </span>
  )
}

type TagFields = Pick<WorkoutBlock, 'text' | 'addedTags' | 'removedTags'>

// The tags on a piece, as chips the coach can tap to switch on or off. Tags the
// text doesn't mention are tucked behind "More tags".
export function TagEditor({ block, onChange }: { block: TagFields; onChange: (tags: Pick<WorkoutBlock, 'addedTags' | 'removedTags'>) => void }) {
  const { data } = useData()
  const [open, setOpen] = useState(false)
  const on = blockTags(block, data.tags)
  const options = open ? allTagNames(data.tags) : [...new Set([...on, ...block.removedTags])]
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((tag) => {
        const active = on.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(toggleTag(block, tag, data.tags))}
            className={`min-h-8 rounded-full px-3 text-xs font-semibold ring-1 transition ${
              active ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-500 ring-slate-300'
            } ${!active && block.removedTags.includes(tag) ? 'line-through' : ''}`}
          >
            {tag}
          </button>
        )
      })}
      {options.length === 0 && <span className="text-xs text-slate-500">No tags yet. They appear as you type.</span>}
      <button type="button" onClick={() => setOpen(!open)} className="min-h-8 rounded-full px-2 text-xs font-semibold text-brand-700">
        {open ? 'Fewer tags' : '+ More tags'}
      </button>
    </div>
  )
}

// Manage the coach's own tags and the words that switch them on.
export function TagSettings({ onClose }: { onClose: () => void }) {
  const { data, update } = useData()
  const custom = data.tags.filter((t) => !t.deleted)
  const [name, setName] = useState('')
  const [keywords, setKeywords] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const clean = name.trim()
    if (!clean) return setError('Give the tag a name.')
    if (allTagNames(data.tags).some((t) => t.toLowerCase() === clean.toLowerCase())) return setError('That tag already exists.')
    update(saveTag({ id: newId(), name: clean, keywords: parseKeywords(keywords || clean) }))
    setName('')
    setKeywords('')
    setError(null)
  }

  return (
    <Sheet title="Tags" onClose={onClose} footer={<Button className="flex-1" onClick={onClose}>Done</Button>}>
      <p className="mb-3 text-sm text-slate-600">
        Sets are tagged as you type. Built-in tags: {BUILT_IN_TAGS.join(', ')}.
      </p>
      <h3 className="mb-2 font-semibold">Your tags</h3>
      {custom.length === 0 && <p className="mb-3 text-sm text-slate-500">None yet.</p>}
      <ul className="mb-4 space-y-2">
        {custom.map((t) => (
          <li key={t.id} className="rounded-xl bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{t.name}</span>
              <Button variant="ghost" onClick={() => update(deleteTag(t.id))}>
                Remove
              </Button>
            </div>
            <Field label="Words that switch it on">
              <input
                className={inputClass}
                defaultValue={t.keywords.join(', ')}
                onBlur={(e) => update(saveTag({ ...t, keywords: parseKeywords(e.target.value) }))}
              />
            </Field>
          </li>
        ))}
      </ul>
      <h3 className="mb-2 font-semibold">Add a tag</h3>
      <div className="space-y-3">
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pull" />
        </Field>
        <Field label="Words that switch it on (comma separated)">
          <input className={inputClass} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. pull, buoy, pull buoy" />
        </Field>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <Button variant="secondary" onClick={add}>
          Add tag
        </Button>
      </div>
    </Sheet>
  )
}
