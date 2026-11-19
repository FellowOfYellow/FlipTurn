import { describe, expect, it } from 'vitest'
import { lendGear, returnLoan, saveSwimmer, setGearQuantity } from './actions'
import { orderListText, summarizeGear } from './gear'
import { emptyData } from './localStore'
import { mergeRecords, withSwimmerDefaults } from './merge'
import type { AppData, Swimmer } from './types'

function swimmer(id: string, overrides: Partial<Swimmer> = {}): Omit<Swimmer, 'updatedAt'> {
  return withSwimmerDefaults({ id, updatedAt: 0, firstName: id, lastName: 'Test', paddleSize: 'M', finSize: '9', ...overrides })
}

function build(...changes: ((d: AppData) => AppData)[]): AppData {
  return changes.reduce((data, change) => change(data), emptyData())
}

describe('summarizeGear', () => {
  it('orders active swimmers minus inventory for unsized gear', () => {
    const data = build(
      saveSwimmer(swimmer('a')),
      saveSwimmer(swimmer('b')),
      saveSwimmer(swimmer('c')),
      saveSwimmer(swimmer('d', { active: false })),
      setGearQuantity('kickboard', 1),
    )
    const kick = summarizeGear(data.gear, data.swimmers, data.loans).find((s) => s.info.type === 'kickboard')!
    expect(kick.inventory).toBe(1)
    expect(kick.toOrder).toBe(2)
  })

  it('never orders a negative amount', () => {
    const data = build(saveSwimmer(swimmer('a')), setGearQuantity('gearBag', 5))
    const bags = summarizeGear(data.gear, data.swimmers, data.loans).find((s) => s.info.type === 'gearBag')!
    expect(bags.toOrder).toBe(0)
  })

  it('orders fins and paddles per size', () => {
    const data = build(
      saveSwimmer(swimmer('a', { finSize: '9', paddleSize: 'S' })),
      saveSwimmer(swimmer('b', { finSize: '9', paddleSize: 'L' })),
      saveSwimmer(swimmer('c', { finSize: '12', paddleSize: null })),
      setGearQuantity('fins:9', 1),
      setGearQuantity('fins:12', 3),
    )
    const [paddles, fins] = summarizeGear(data.gear, data.swimmers, data.loans)
    expect(fins.lines.find((l) => l.size === '9')!.toOrder).toBe(1)
    expect(fins.lines.find((l) => l.size === '12')!.toOrder).toBe(0)
    expect(fins.toOrder).toBe(1)
    expect(paddles.toOrder).toBe(2)
    expect(paddles.missingSize).toBe(1)
  })

  it('counts lent gear in inventory and tracks what is out', () => {
    let data = build(saveSwimmer(swimmer('a')), setGearQuantity('fins:9', 2), lendGear('a', ['fins:9']))
    let fins = summarizeGear(data.gear, data.swimmers, data.loans)[1]
    expect(fins.inventory).toBe(2)
    expect(fins.lentOut).toBe(1)
    data = returnLoan(data.loans[0].id)(data)
    fins = summarizeGear(data.gear, data.swimmers, data.loans)[1]
    expect(fins.lentOut).toBe(0)
  })

  it('writes an order list', () => {
    const data = build(saveSwimmer(swimmer('a')), saveSwimmer(swimmer('b')))
    const text = orderListText(summarizeGear(data.gear, data.swimmers, data.loans), 'Lincoln High')
    expect(text).toContain('Lincoln High swim gear order')
    expect(text).toContain('Fins, size 9: 2')
    expect(text).toContain('Kickboards: 2')
  })
})

describe('mergeRecords', () => {
  it('keeps the newer edit of each record and the union of both sides', () => {
    const merged = mergeRecords(
      [{ id: '1', updatedAt: 5, v: 'old' }, { id: '2', updatedAt: 1, v: 'only-a' }],
      [{ id: '1', updatedAt: 9, v: 'new' }, { id: '3', updatedAt: 1, v: 'only-b' }],
    )
    expect(merged.map((r) => r.v).sort()).toEqual(['new', 'only-a', 'only-b'])
  })
})
