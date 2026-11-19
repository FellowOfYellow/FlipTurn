import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, EmptyState, PageHeader, Section, inputClass } from '../../components/ui'
import { useData } from '../../data/DataProvider'
import { orderTags } from '../../data/tagging'
import { liveWorkouts, matchesSearch, sortWorkouts, workoutTags, workoutText } from '../../data/workouts'
import { formatLongDate } from '../../lib/format'
import { TagList, TagSettings } from './parts'

export default function WorkoutsPage() {
  const { data } = useData()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string[]>([])
  const [tagsOpen, setTagsOpen] = useState(false)

  const all = sortWorkouts(liveWorkouts(data)).map((w) => ({ workout: w, tags: workoutTags(data, w) }))
  const usedTags = orderTags(all.flatMap((w) => w.tags), data.tags)
  const shown = all.filter(
    ({ workout, tags }) => filter.every((t) => tags.includes(t)) && matchesSearch(workoutText(data, workout), query),
  )
  const toggle = (tag: string) => setFilter((f) => (f.includes(tag) ? f.filter((t) => t !== tag) : [...f, tag]))

  return (
    <>
      <PageHeader title="Workouts" action={<Button onClick={() => navigate('/workouts/new')}>New workout</Button>} />
      <div className="flex gap-2 px-4 pb-4 md:px-8">
        <Link to="/workouts/library" className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-brand-700 ring-1 ring-slate-300 hover:bg-brand-50">
          Saved pieces
        </Link>
        <Button variant="secondary" onClick={() => setTagsOpen(true)}>
          Tags
        </Button>
      </div>

      {all.length > 0 && (
        <div className="space-y-3 px-4 pb-4 md:px-8">
          <input
            type="search"
            className={inputClass}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workouts and sets"
            aria-label="Search workouts"
          />
          {usedTags.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tag">
              {usedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={filter.includes(tag)}
                  onClick={() => toggle(tag)}
                  className={`min-h-9 rounded-full px-3 text-sm font-semibold ring-1 ${
                    filter.includes(tag) ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-700 ring-slate-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Section title={filter.length || query ? `${shown.length} matching` : 'All workouts'}>
        {all.length === 0 ? (
          <EmptyState>No workouts yet. Tap “New workout” to build one from a warm up, sets and a cool down.</EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState>No workouts match.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {shown.map(({ workout, tags }) => (
              <li key={workout.id}>
                <Link
                  to={`/workouts/${workout.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 hover:ring-brand-500"
                >
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block truncate font-semibold">{workout.name || 'Untitled workout'}</span>
                    <span className="block truncate text-sm text-slate-500">
                      {workout.date ? formatLongDate(workout.date) : 'No date'} · {workout.setIds.length} set
                      {workout.setIds.length === 1 ? '' : 's'}
                    </span>
                    <TagList tags={tags} max={5} />
                  </span>
                  <span aria-hidden className="text-xl text-slate-400">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {tagsOpen && <TagSettings onClose={() => setTagsOpen(false)} />}
    </>
  )
}
