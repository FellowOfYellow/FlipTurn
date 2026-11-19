import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, PageHeader, Section, Sheet } from '../../components/ui'
import { useData } from '../../data/DataProvider'
import type { WorkoutBlock } from '../../data/types'
import {
  deleteWorkout,
  editBlockInWorkout,
  KIND_LABEL,
  newWorkout,
  saveWorkout,
  workoutBlocks,
  workoutTags,
  workoutsUsing,
} from '../../data/workouts'
import { formatLongDate } from '../../lib/format'
import { TagEditor, TagList, textareaClass } from './parts'

export default function WorkoutDetail() {
  const { id } = useParams()
  const { data, update } = useData()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const workout = data.workouts.find((w) => w.id === id && !w.deleted)

  if (!workout) {
    return (
      <Section title="Workout not found">
        <Link className="text-brand-700 underline" to="/workouts">
          Back to workouts
        </Link>
      </Section>
    )
  }

  const { warmup, sets, cooldown } = workoutBlocks(data, workout)
  const pieces = [
    ...(warmup ? [{ block: warmup, title: 'Warm up' }] : []),
    ...sets.map((block, i) => ({ block, title: sets.length > 1 ? `Set ${i + 1}` : 'Set' })),
    ...(cooldown ? [{ block: cooldown, title: 'Cool down' }] : []),
  ] as { block: WorkoutBlock; title: string }[]

  const useAgain = () => {
    const copy = { ...newWorkout(), name: workout.name, warmupId: workout.warmupId, setIds: workout.setIds, cooldownId: workout.cooldownId }
    update(saveWorkout(copy))
    navigate(`/workouts/${copy.id}/edit`)
  }

  return (
    <>
      <PageHeader
        title={workout.name || 'Untitled workout'}
        action={
          <Button variant="secondary" onClick={() => navigate(`/workouts/${workout.id}/edit`)}>
            Edit
          </Button>
        }
      />
      <div className="space-y-2 px-4 pb-5 md:px-8">
        <p className="text-sm text-slate-600">
          <Link to="/workouts" className="text-brand-700 underline">
            Workouts
          </Link>{' '}
          · {workout.date ? formatLongDate(workout.date) : 'No date'}
        </p>
        <TagList tags={workoutTags(data, workout)} />
      </div>

      {pieces.length === 0 && (
        <Section title="Empty workout">
          <p className="text-sm text-slate-500">Tap Edit to add a warm up, sets and a cool down.</p>
        </Section>
      )}
      {pieces.map(({ block, title }, i) => (
        <Section key={`${block.id}-${i}`} title={title}>
          <PieceEditor workoutId={workout.id} block={block} />
        </Section>
      ))}

      <div className="flex flex-wrap gap-3 px-4 pb-8 md:px-8">
        <Button variant="secondary" onClick={useAgain}>
          Use again
        </Button>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          Delete workout
        </Button>
      </div>

      {confirmDelete && (
        <Sheet
          title="Delete this workout?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => {
                  update(deleteWorkout(workout.id))
                  navigate('/workouts', { replace: true })
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-600">Its warm up, sets and cool down stay in your saved pieces.</p>
        </Sheet>
      )}
    </>
  )
}

// A big text box for one piece. Changes save when the box loses focus. If
// other workouts use the same piece, this workout gets its own copy.
function PieceEditor({ workoutId, block }: { workoutId: string; block: WorkoutBlock }) {
  const { data, update } = useData()
  const [text, setText] = useState(block.text)
  const others = workoutsUsing(data, block.id).filter((w) => w.id !== workoutId).length
  const commit = () => {
    if (text.trim() !== block.text) update(editBlockInWorkout(workoutId, block.id, { text: text.trim() }))
  }
  const draft = { ...block, text }
  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <textarea
        className={`${textareaClass} min-h-40 field-sizing-content`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        aria-label={KIND_LABEL[block.kind]}
      />
      <TagEditor block={draft} onChange={(tags) => update(editBlockInWorkout(workoutId, block.id, { text: text.trim(), ...tags }))} />
      {others > 0 && (
        <p className="text-xs text-slate-500">
          Also used in {others} other workout{others === 1 ? '' : 's'}. Changes here only change this workout.
        </p>
      )}
    </div>
  )
}
