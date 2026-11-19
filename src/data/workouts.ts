import { newId, today } from './actions'
import { autoTags, orderTags } from './tagging'
import type { AppData, BlockKind, CustomTag, Workout, WorkoutBlock } from './types'

// Workouts are built from reusable blocks (warm ups, sets, cool downs). These
// are pure updates passed to update(), plus values worked out from the data.

export type WorkoutDraft = Omit<Workout, 'updatedAt'>
export type BlockDraft = Omit<WorkoutBlock, 'updatedAt'>

export const KIND_LABEL: Record<BlockKind, string> = { warmup: 'Warm up', set: 'Set', cooldown: 'Cool down' }

export function newWorkout(): WorkoutDraft {
  return { id: newId(), name: '', date: today(), warmupId: null, setIds: [], cooldownId: null }
}

export function newBlock(kind: BlockKind, text = ''): BlockDraft {
  return { id: newId(), kind, text, addedTags: [], removedTags: [], createdOn: today() }
}

function upsert<T extends { id: string }>(list: T[], record: T): T[] {
  return list.some((r) => r.id === record.id) ? list.map((r) => (r.id === record.id ? record : r)) : [...list, record]
}

export const saveBlocks =
  (blocks: BlockDraft[]) =>
  (data: AppData): AppData => {
    const now = Date.now()
    return { ...data, blocks: blocks.reduce((list, b) => upsert(list, { ...b, updatedAt: now }), data.blocks) }
  }

export const saveWorkout =
  (workout: WorkoutDraft, newBlocks: BlockDraft[] = []) =>
  (data: AppData): AppData => {
    const withBlocks = saveBlocks(newBlocks)(data)
    return { ...withBlocks, workouts: upsert(withBlocks.workouts, { ...workout, updatedAt: Date.now() }) }
  }

export const deleteWorkout =
  (id: string) =>
  (data: AppData): AppData => ({
    ...data,
    workouts: data.workouts.map((w) =>
      w.id === id
        ? { id, updatedAt: Date.now(), deleted: true, name: '', date: null, warmupId: null, setIds: [], cooldownId: null }
        : w,
    ),
  })

// Deleting a piece from the library also takes it out of every workout.
export const deleteBlock =
  (id: string) =>
  (data: AppData): AppData => {
    const now = Date.now()
    return {
      ...data,
      blocks: data.blocks.map((b) =>
        b.id === id ? { ...b, text: '', addedTags: [], removedTags: [], deleted: true, updatedAt: now } : b,
      ),
      workouts: data.workouts.map((w) =>
        usesBlock(w, id)
          ? {
              ...w,
              warmupId: w.warmupId === id ? null : w.warmupId,
              cooldownId: w.cooldownId === id ? null : w.cooldownId,
              setIds: w.setIds.filter((s) => s !== id),
              updatedAt: now,
            }
          : w,
      ),
    }
  }

export function usesBlock(workout: Workout | WorkoutDraft, blockId: string): boolean {
  return workout.warmupId === blockId || workout.cooldownId === blockId || workout.setIds.includes(blockId)
}

export function workoutsUsing(data: AppData, blockId: string): Workout[] {
  return liveWorkouts(data).filter((w) => usesBlock(w, blockId))
}

// Changing a block from inside one workout. If other workouts use it too, this
// workout gets its own copy so their text doesn't change underneath them.
export const editBlockInWorkout =
  (workoutId: string, blockId: string, change: Partial<Pick<WorkoutBlock, 'text' | 'addedTags' | 'removedTags'>>) =>
  (data: AppData): AppData => {
    const block = data.blocks.find((b) => b.id === blockId)
    if (!block) return data
    const shared = workoutsUsing(data, blockId).some((w) => w.id !== workoutId)
    if (!shared) return saveBlocks([{ ...block, ...change }])(data)
    const copy: BlockDraft = { ...block, ...change, id: newId(), createdOn: today() }
    const now = Date.now()
    return {
      ...saveBlocks([copy])(data),
      workouts: data.workouts.map((w) =>
        w.id === workoutId
          ? {
              ...w,
              warmupId: w.warmupId === blockId ? copy.id : w.warmupId,
              cooldownId: w.cooldownId === blockId ? copy.id : w.cooldownId,
              setIds: w.setIds.map((s) => (s === blockId ? copy.id : s)),
              updatedAt: now,
            }
          : w,
      ),
    }
  }

// A block's tags: what the text says, plus the ones added by hand, minus the
// ones removed by hand.
export function blockTags(block: Pick<WorkoutBlock, 'text' | 'addedTags' | 'removedTags'>, custom: CustomTag[]): string[] {
  const tags = new Set([...autoTags(block.text, custom), ...block.addedTags])
  for (const t of block.removedTags) tags.delete(t)
  return orderTags([...tags], custom)
}

// Tapping a tag chip flips it, remembering it as a hand-made choice only when it
// differs from what the text says.
export function toggleTag(
  block: Pick<WorkoutBlock, 'text' | 'addedTags' | 'removedTags'>,
  tag: string,
  custom: CustomTag[],
): Pick<WorkoutBlock, 'addedTags' | 'removedTags'> {
  const auto = autoTags(block.text, custom).includes(tag)
  const on = blockTags(block, custom).includes(tag)
  const addedTags = block.addedTags.filter((t) => t !== tag)
  const removedTags = block.removedTags.filter((t) => t !== tag)
  if (on && auto) removedTags.push(tag)
  if (!on && !auto) addedTags.push(tag)
  return { addedTags, removedTags }
}

export function liveWorkouts(data: AppData): Workout[] {
  return data.workouts.filter((w) => !w.deleted)
}

export function liveBlocks(data: AppData, kind?: BlockKind): WorkoutBlock[] {
  return data.blocks.filter((b) => !b.deleted && (!kind || b.kind === kind))
}

export function workoutBlocks(data: AppData, workout: Workout | WorkoutDraft, extra: BlockDraft[] = []) {
  const byId = new Map<string, BlockDraft>([...liveBlocks(data), ...extra].map((b) => [b.id, b]))
  return {
    warmup: workout.warmupId ? byId.get(workout.warmupId) ?? null : null,
    sets: workout.setIds.map((id) => byId.get(id)).filter((b): b is BlockDraft => Boolean(b)),
    cooldown: workout.cooldownId ? byId.get(workout.cooldownId) ?? null : null,
  }
}

// A workout's tags are every tag on its pieces.
export function workoutTags(data: AppData, workout: Workout | WorkoutDraft, extra: BlockDraft[] = []): string[] {
  const { warmup, sets, cooldown } = workoutBlocks(data, workout, extra)
  const pieces = [warmup, ...sets, cooldown].filter((b): b is BlockDraft => Boolean(b))
  return orderTags(pieces.flatMap((b) => blockTags(b, data.tags)), data.tags)
}

// The days a piece was used, newest first.
export function datesUsed(data: AppData, blockId: string): string[] {
  return [...new Set(workoutsUsing(data, blockId).flatMap((w) => (w.date ? [w.date] : [])))].sort().reverse()
}

// Newest first; workouts with no date go last.
export function sortWorkouts(workouts: Workout[]): Workout[] {
  return [...workouts].sort(
    (a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.updatedAt - a.updatedAt,
  )
}

// Pieces with the same text (ignoring spacing and case) show once in the
// pickers, keeping the most recently used copy.
export function uniqueBlocks(data: AppData, kind: BlockKind): WorkoutBlock[] {
  const lastUsed = (b: WorkoutBlock) => datesUsed(data, b.id)[0] ?? b.createdOn
  const seen = new Map<string, WorkoutBlock>()
  for (const b of liveBlocks(data, kind)) {
    const key = b.text.trim().replace(/\s+/g, ' ').toLowerCase()
    if (!key) continue
    const kept = seen.get(key)
    if (!kept || lastUsed(b) > lastUsed(kept)) seen.set(key, b)
  }
  return [...seen.values()].sort((a, b) => lastUsed(b).localeCompare(lastUsed(a)))
}

export function matchesSearch(text: string, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const haystack = text.toLowerCase()
  return words.every((w) => haystack.includes(w))
}

export function workoutText(data: AppData, workout: Workout): string {
  const { warmup, sets, cooldown } = workoutBlocks(data, workout)
  return [workout.name, warmup?.text, ...sets.map((s) => s.text), cooldown?.text].filter(Boolean).join('\n')
}

// Custom tags.
export const saveTag =
  (tag: Omit<CustomTag, 'updatedAt'>) =>
  (data: AppData): AppData => ({ ...data, tags: upsert(data.tags, { ...tag, updatedAt: Date.now() }) })

export const deleteTag =
  (id: string) =>
  (data: AppData): AppData => ({
    ...data,
    tags: data.tags.map((t) => (t.id === id ? { ...t, keywords: [], deleted: true, updatedAt: Date.now() } : t)),
  })
