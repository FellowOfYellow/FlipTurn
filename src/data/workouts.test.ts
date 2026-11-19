import { describe, expect, it } from 'vitest'
import { emptyData } from './localStore'
import { autoTags, parseKeywords } from './tagging'
import {
  blockTags,
  datesUsed,
  deleteBlock,
  editBlockInWorkout,
  newBlock,
  newWorkout,
  saveWorkout,
  toggleTag,
  uniqueBlocks,
  workoutTags,
} from './workouts'
import type { CustomTag } from './types'

describe('autoTags', () => {
  it('finds strokes, gear and drills by whole word', () => {
    expect(autoTags('200 freestyle with paddles')).toEqual(['Free', 'Paddles'])
    expect(autoTags('Kick with a kickboard, then underwater dolphin kick')).toEqual(['Underwater', 'Kickboard'])
    expect(autoTags('Backyard games')).toEqual(['Fun'])
  })

  it('only counts short stroke words right after a distance', () => {
    expect(autoTags('4x50 back @1:00')).toContain('Backstroke')
    expect(autoTags('100 fly, 100 bk, 100 br, 100 fr')).toEqual(
      expect.arrayContaining(['Butterfly', 'Backstroke', 'Breaststroke', 'Free']),
    )
    expect(autoTags('Swim easy, then come back to the wall. Feel free to rest.')).toEqual([])
  })

  it('treats IM as all four strokes', () => {
    expect(autoTags('4x100 IM')).toEqual(['Butterfly', 'Backstroke', 'Breaststroke', 'Free'])
    expect(autoTags("I'm here")).toEqual([])
  })

  it('leans Sprint for repeats of 25 or 50 and Long distance for 500 and up', () => {
    expect(autoTags('8x25 free')).toContain('Sprint')
    expect(autoTags('10 x 50 choice')).toEqual(expect.arrayContaining(['Sprint', 'Your choice']))
    expect(autoTags('4x100 free')).not.toContain('Sprint')
    expect(autoTags('500 free')).toContain('Long distance')
    expect(autoTags('1x1000 swim')).toContain('Long distance')
    expect(autoTags('Rest 1:30, total 2000')).not.toContain('Long distance')
  })

  it('adds custom tags from their keywords', () => {
    const custom: CustomTag[] = [{ id: 't', updatedAt: 0, name: 'Pull', keywords: parseKeywords('pull buoy, Buoy') }]
    expect(autoTags('200 with a pull buoy', custom)).toContain('Pull')
    expect(autoTags('buoys everywhere', custom)).not.toContain('Pull')
  })
})

describe('block tags', () => {
  const block = { ...newBlock('set', '8x25 fly'), addedTags: [] as string[], removedTags: [] as string[] }

  it('adds and removes tags by hand', () => {
    expect(blockTags(block, [])).toEqual(['Butterfly', 'Sprint'])
    const noSprint = { ...block, ...toggleTag(block, 'Sprint', []) }
    expect(noSprint.removedTags).toEqual(['Sprint'])
    expect(blockTags(noSprint, [])).toEqual(['Butterfly'])
    const withFins = { ...noSprint, ...toggleTag(noSprint, 'Fins', []) }
    expect(blockTags(withFins, [])).toEqual(['Butterfly', 'Fins'])
    const back = { ...withFins, ...toggleTag(withFins, 'Sprint', []) }
    expect(back.removedTags).toEqual([])
  })
})

describe('workouts', () => {
  function setup() {
    const warm = newBlock('warmup', '400 easy free')
    const set = newBlock('set', '8x50 back')
    const monday = { ...newWorkout(), name: 'Monday', date: '2026-11-16', warmupId: warm.id, setIds: [set.id] }
    const tuesday = { ...newWorkout(), name: 'Tuesday', date: '2026-11-17', setIds: [set.id] }
    const data = saveWorkout(tuesday)(saveWorkout(monday, [warm, set])(emptyData()))
    return { data, warm, set, monday, tuesday }
  }

  it('unions the tags of its pieces', () => {
    const { data, monday } = setup()
    expect(workoutTags(data, monday)).toEqual(['Backstroke', 'Free', 'Sprint'])
  })

  it('works out the dates a piece was used', () => {
    const { data, set, warm } = setup()
    expect(datesUsed(data, set.id)).toEqual(['2026-11-17', '2026-11-16'])
    expect(datesUsed(data, warm.id)).toEqual(['2026-11-16'])
  })

  it('copies a shared piece when edited inside one workout', () => {
    const { data, set, monday, tuesday } = setup()
    const after = editBlockInWorkout(monday.id, set.id, { text: '8x50 fly' })(data)
    const mon = after.workouts.find((w) => w.id === monday.id)!
    const tue = after.workouts.find((w) => w.id === tuesday.id)!
    expect(mon.setIds[0]).not.toBe(set.id)
    expect(tue.setIds[0]).toBe(set.id)
    expect(after.blocks.find((b) => b.id === set.id)!.text).toBe('8x50 back')
    expect(after.blocks.find((b) => b.id === mon.setIds[0])!.text).toBe('8x50 fly')
  })

  it('edits an unshared piece in place', () => {
    const { data, warm, monday } = setup()
    const after = editBlockInWorkout(monday.id, warm.id, { text: '300 easy' })(data)
    expect(after.blocks.find((b) => b.id === warm.id)!.text).toBe('300 easy')
    expect(after.blocks).toHaveLength(2)
  })

  it('takes a deleted piece out of every workout', () => {
    const { data, set } = setup()
    const after = deleteBlock(set.id)(data)
    expect(after.workouts.every((w) => w.setIds.length === 0)).toBe(true)
    expect(after.blocks.find((b) => b.id === set.id)!.deleted).toBe(true)
  })

  it('lists each piece of text once in the pickers', () => {
    const { data } = setup()
    const copy = newBlock('warmup', '400  Easy free')
    const more = saveWorkout({ ...newWorkout(), warmupId: copy.id }, [copy])(data)
    expect(uniqueBlocks(more, 'warmup')).toHaveLength(1)
  })
})
