import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { lendGear, saveSwimmer, setGearQuantity } from './actions'
import { emptyData } from './localStore'
import { withSwimmerDefaults } from './merge'
import { backupTables, buildXlsx } from './sheetBackup'
import { newBlock, newWorkout, saveWorkout } from './workouts'

function sampleData() {
  let data = emptyData()
  data = saveSwimmer(withSwimmerDefaults({ id: 's1', updatedAt: 0, firstName: 'Ana', lastName: 'Lopez & Co', finSize: '9' }))(data)
  data = setGearQuantity('fins:9', 2)(data)
  data = lendGear('s1', ['fins:9'])(data)
  return data
}

describe('backup sheet', () => {
  it('lists swimmers, gear and loans', () => {
    const tables = Object.fromEntries(backupTables(sampleData()).map((t) => [t.name, t.rows]))
    expect(tables.Swimmers[1].slice(0, 2)).toEqual(['Lopez & Co', 'Ana'])
    expect(tables.Gear.find((r) => r[0] === 'Fins (size 9)')).toEqual(['Fins (size 9)', 2, 0, 1, 1, 1, 0])
    expect(tables['Lent out'][1].slice(0, 3)).toEqual(['Ana Lopez & Co', 'Fins (size 9)', 1])
  })

  it('builds a valid xlsx with one sheet per table and escaped text', () => {
    const files = unzipSync(buildXlsx(backupTables(sampleData())))
    expect(Object.keys(files)).toContain('xl/worksheets/sheet5.xml')
    const workbook = strFromU8(files['xl/workbook.xml'])
    expect(workbook).toContain('name="Lent out"')
    const swimmers = strFromU8(files['xl/worksheets/sheet1.xml'])
    expect(swimmers).toContain('Lopez &amp; Co')
    expect(swimmers).not.toContain('Lopez & Co')
  })

  it('lists workouts with their pieces and tags', () => {
    const set = newBlock('set', '8x50 fly')
    const data = saveWorkout({ ...newWorkout(), name: 'Monday', date: '2026-11-16', setIds: [set.id] }, [set])(emptyData())
    const rows = Object.fromEntries(backupTables(data).map((t) => [t.name, t.rows])).Workouts
    expect(rows[1]).toEqual(['Monday', '2026-11-16', 'Butterfly, Sprint', '', '8x50 fly', ''])
  })
})
