import { describe, expect, it } from 'vitest'
import { deleteSwimmer, saveSwimmer } from './actions'
import {
  badgesFor,
  competitionHistory,
  focusStrokes,
  newCompetition,
  newEvent,
  saveCompetition,
  sortCompetitions,
  toggleEntry,
} from './competitions'
import { emptyData } from './localStore'
import { mergeData, withSwimmerDefaults } from './merge'
import { xlsxText } from '../lib/fileText'
import { backupTables, buildXlsx } from './sheetBackup'

const medley = () => newEvent({ name: 'Girls 200 Medley Relay', kind: 'relay', stroke: 'Medley', distance: 200 })
const fly = () => newEvent({ name: 'Girls 50 Fly', kind: 'individual', stroke: 'Fly', distance: 50 })

describe('relay slots', () => {
  it('fills the next empty slot, or the chosen one, and taps again to clear', () => {
    let e = medley()
    e = toggleEntry(e, 'ana')
    e = toggleEntry(e, 'bea')
    expect(e.entries.slice(0, 3)).toEqual(['ana', 'bea', ''])
    e = toggleEntry(e, 'cat', 5)
    expect(e.entries[5]).toBe('cat')
    e = toggleEntry(e, 'ana')
    expect(e.entries[0]).toBe('')
  })

  it('moves a swimmer to a chosen slot, swapping with whoever was there', () => {
    let e = toggleEntry(toggleEntry(medley(), 'ana'), 'bea')
    e = toggleEntry(e, 'ana', 1)
    expect(e.entries.slice(0, 2)).toEqual(['bea', 'ana'])
  })

  it('adds and removes individual entrants', () => {
    let e = toggleEntry(fly(), 'ana')
    expect(e.entries).toEqual(['ana'])
    e = toggleEntry(e, 'ana')
    expect(e.entries).toEqual([])
  })
})

describe('derived values', () => {
  const meet = () => {
    const relay = toggleEntry(toggleEntry(medley(), 'ana'), 'bea') // ana backstroke leg, bea breaststroke leg
    const event = toggleEntry(fly(), 'ana')
    return { ...newCompetition(), name: 'Dual', date: '2026-12-01', swimmerIds: ['ana', 'bea'], events: [relay, event] }
  }

  it('counts I and R badges', () => {
    expect(badgesFor(meet(), 'ana')).toEqual({ individual: 1, relay: 1 })
    expect(badgesFor(meet(), 'bea')).toEqual({ individual: 0, relay: 1 })
  })

  it('works out focus strokes, using the medley relay leg', () => {
    const data = saveCompetition(meet())(emptyData())
    expect(focusStrokes(data, 'ana')).toEqual([
      { stroke: 'Back', count: 1 },
      { stroke: 'Fly', count: 1 },
    ])
    expect(focusStrokes(data, 'bea')).toEqual([{ stroke: 'Breast', count: 1 }])
    expect(competitionHistory(data, 'bea')[0].events.map((e) => e.name)).toEqual(['Girls 200 Medley Relay'])
  })

  it('sorts upcoming meets soonest first and past meets latest first', () => {
    const at = (name: string, date: string) => ({ ...newCompetition(), name, date, updatedAt: 1 })
    const { upcoming, past } = sortCompetitions([at('a', '2026-12-10'), at('b', '2026-12-01'), at('c', '2026-10-01'), at('d', '2026-11-01')], '2026-11-19')
    expect(upcoming.map((c) => c.name)).toEqual(['b', 'a'])
    expect(past.map((c) => c.name)).toEqual(['d', 'c'])
  })

  it('takes a removed swimmer out of every lineup', () => {
    let data = saveSwimmer(withSwimmerDefaults({ id: 'ana', updatedAt: 0, firstName: 'Ana', lastName: 'Lopez' }))(emptyData())
    data = saveCompetition(meet())(data)
    data = deleteSwimmer('ana')(data)
    const c = data.competitions[0]
    expect(c.swimmerIds).toEqual(['bea'])
    expect(c.events.some((e) => e.entries.includes('ana'))).toBe(false)
    expect(c.events[0].entries.slice(0, 2)).toEqual(['', 'bea'])
  })

  it('merges competitions from older data that has none', () => {
    const data = mergeData(emptyData(), { swimmers: [] })
    expect(data.competitions).toEqual([])
  })

  it('lists meet lineups in the backup sheet, and reads xlsx back as lines', () => {
    let data = saveSwimmer(withSwimmerDefaults({ id: 'ana', updatedAt: 0, firstName: 'Ana', lastName: 'Lopez' }))(emptyData())
    data = saveCompetition(meet())(data)
    const meets = backupTables(data).find((t) => t.name === 'Meets')!
    expect(meets.rows[1]).toEqual(['Dual', '2026-12-01', '', 'Girls 200 Medley Relay', 'Relay', 'A1 Ana Lopez, A2 Removed swimmer'])
    expect(xlsxText(buildXlsx([meets]))).toContain('Girls 50 Fly Individual Ana Lopez')
  })
})
