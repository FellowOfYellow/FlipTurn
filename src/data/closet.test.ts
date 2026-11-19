import { describe, expect, it } from 'vitest'
import { lendGear, setGearQuantity } from './actions'
import { missingPieces, newBag, overLimit, saveClosetRecord } from './closet'
import { summarizeGear } from './gear'
import { emptyData } from './localStore'

function setup() {
  let data = emptyData()
  data = setGearQuantity('gearBag', 2)(data)
  data = setGearQuantity('fins:9', 1)(data)
  data = setGearQuantity('paddles:M', 2)(data)
  data = setGearQuantity('pullBuoy', 1)(data)
  const bag = { ...newBag(), number: '1', finSize: '9', paddleSize: 'M', pullBuoy: true }
  return { data: saveClosetRecord('bags', bag)(data), bag }
}

describe('gear bags and inventory limits', () => {
  it('counts what is packed in bags against the totals', () => {
    const { data } = setup()
    const lines = Object.fromEntries(summarizeGear(data.gear, data.swimmers, data.loans, ['9'], data.bags).flatMap((s) => s.lines.map((l) => [l.itemId, l])))
    expect(lines.gearBag).toMatchObject({ inventory: 2, inBags: 1, available: 1 })
    expect(lines['fins:9']).toMatchObject({ inBags: 1, available: 0 })
    expect(lines.pullBuoy.available).toBe(0)
    expect(lines.kickboard.inBags).toBe(0)
  })

  it('blocks a bag that would take more than the team owns', () => {
    const { data, bag } = setup()
    expect(overLimit(data, bag)).toEqual([])
    const second = { ...newBag(), number: '2', finSize: '9', paddleSize: 'M', pullBuoy: true }
    expect(overLimit(data, second)).toEqual(['fins in size 9', 'pull buoys'])
    expect(overLimit(data, { ...second, finSize: '', pullBuoy: false })).toEqual([])
    const full = saveClosetRecord('bags', { ...second, finSize: '', pullBuoy: false })(data)
    expect(overLimit(full, { ...newBag(), number: '3' })).toEqual(['gear bags'])
  })

  it('counts gear lent out against what a bag can take', () => {
    const { data } = setup()
    const lent = lendGear('s1', ['paddles:M'])(data)
    expect(overLimit(lent, { ...newBag(), paddleSize: 'M' })).toEqual(['paddles in size M'])
  })

  it('lists what a bag is missing, skipping what its notes already say', () => {
    expect(missingPieces({ finSize: '9', paddleSize: '', kickboard: false, pullBuoy: false, notes: 'Needs pull buoy' })).toEqual([
      'Needs paddles',
      'Needs kickboard',
    ])
    expect(missingPieces({ finSize: '9', paddleSize: 'M', kickboard: true, pullBuoy: true, notes: '' })).toEqual([])
  })
})
