import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { readWorkbook } from '../lib/xlsxGrid'
import { applyGearImport, readGearWorkbook } from './gearImport'
import { emptyData } from './localStore'
import { saveSwimmer } from './actions'
import { withSwimmerDefaults } from './merge'

// A cell is text, a number, a date typed as "m-d" ({ md: serial }), or a formula.
type TestCell = string | number | { md: number } | { f: string; v: number } | null

const col = (c: number) => String.fromCharCode(65 + c)
// Excel serial for a day in 2026.
const serial = (m: number, d: number) => (Date.UTC(2026, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000

function workbook(sheets: Record<string, TestCell[][]>): Uint8Array {
  const names = Object.keys(sheets)
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(
      `<workbook><sheets>${names.map((n, i) => `<sheet name="${n.replace(/&/g, '&amp;')}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<Relationships>${names.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
    ),
    'xl/styles.xml': strToU8('<styleSheet><numFmts><numFmt numFmtId="164" formatCode="m-d"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>'),
  }
  names.forEach((name, i) => {
    const rows = sheets[name]
      .map((row, r) => `<row r="${r + 1}">${row
        .map((v, c) => {
          const ref = `${col(c)}${r + 1}`
          if (v === null) return ''
          if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`
          if (typeof v === 'string') return `<c r="${ref}" t="inlineStr"><is><t>${v.replace(/&/g, '&amp;')}</t></is></c>`
          if ('md' in v) return `<c r="${ref}" s="1"><v>${v.md}</v></c>`
          return `<c r="${ref}"><f>${v.f}</f><v>${v.v}</v></c>`
        })
        .join('')}</row>`)
      .join('')
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(`<worksheet><sheetData>${rows}</sheetData></worksheet>`)
  })
  return zipSync(files)
}

const sample = () =>
  readWorkbook(
    workbook({
      'Gear Bags': [
        ['Student', 'Bag Number', 'Fin Size', 'Fin Number', 'Paddle Size', 'Paddle Number', 'Notes', null, 'Fin Size', 'Count', 'Buy', null, 'Qty Buy', 'Size', 'Item'],
        [null, 41, '9.5-10.5', 35, 'M', 12, null, null, '4.5-5', 3, 1, null, 8, 'black arena', 'bags'],
        ['Ana', 45, { md: serial(6, 7) }, 51, 'S', 3, 'Needs pull buoy', null, { md: serial(6, 7) }, 5, 3],
      ],
      'Team Shoe & Paddle Sizes': [
        ['Student', 'Name', 'category', 'Shoe Size', 'Paddle Size', 'Notes', 'Registered?', null, 'Fin Size', 'Inventory', 'Actuals', 'To Buy', null, 'Qty Buy', 'Size', 'Item'],
        [null, 'ana', '7.5-9', 'W9.5', 'M', 'Already has fins', 'good', null, '4.5-5', 3, 2, { f: 'K2-J2', v: -1 }, null, 12, 'black arena', 'bags'],
        [null, 'Monty', { md: serial(11, 12) }, { md: serial(12, 13) }, 'L', null, 'not registered', null, null, null, null, null, 36],
        [null, 'Iris', 'Y2', 'Y2', 'S', null, 'good, but'],
      ],
      'Misc Inventory': [
        [1, 'Quantity', 'Size', 'Number', 'Notes'],
        ['Towels', 26],
        ['Fins', 'Full set', { md: serial(6, 7) }, 7],
        ['Fins', 'Single', '7.5-9', null, 'left fin'],
        ['Assorted ribbons', '?'],
      ],
      'Shopping List': [['Item', 'Quantity'], ['Goggles', null]],
    }),
  )

describe('reading a workbook', () => {
  it('turns sizes Excel stored as dates back into text', () => {
    const [bags] = sample()
    expect(bags.rows[2][2]).toBe('6-7')
    expect(bags.rows[1][1]).toBe(41)
  })
})

describe('gear spreadsheet import', () => {
  it('reads the roster with sizes, registration and notes', () => {
    const plan = readGearWorkbook(sample(), emptyData(), 'gear.xlsx')
    const byName = Object.fromEntries(plan.swimmers.map(({ swimmer }) => [swimmer.firstName, swimmer]))
    expect(Object.keys(byName)).toEqual(['Ana', 'Monty', 'Iris'])
    expect(byName.Ana).toMatchObject({ finSize: '7.5-9', shoeSize: 'W9.5', paddleSize: 'M', registration: 'Registered', gearNotes: 'Already has fins' })
    expect(byName.Monty).toMatchObject({ finSize: '11-12', shoeSize: '12-13', registration: 'Not registered' })
    expect(byName.Iris.registration).toBe('Registered, but…')
    expect(plan.finSizes).toEqual(['Y2', '4.5-5', '6-7', '7.5-9', '9.5-10.5', '11-12'])
  })

  it('reads bags, counts, supplies and shopping, and links bags to swimmers', () => {
    const plan = readGearWorkbook(sample(), emptyData())
    const ana = plan.swimmers.find((s) => s.swimmer.firstName === 'Ana')!.swimmer
    expect(plan.bags).toHaveLength(2)
    expect(plan.bags[1]).toMatchObject({ number: '45', swimmerId: ana.id, finSize: '6-7', finNumber: '51', notes: 'Needs pull buoy' })
    expect(plan.counts).toEqual([
      { itemId: 'fins:4.5-5', label: 'Fins size 4.5-5', quantity: 3 },
      { itemId: 'fins:6-7', label: 'Fins size 6-7', quantity: 5 },
    ])
    expect(plan.supplies.map((s) => [s.name, s.quantity, s.size, s.number, s.notes])).toEqual([
      ['Towels', 26, '', '', ''],
      ['Fins', 1, '6-7', '7', 'Full set'],
      ['Fins', 1, '7.5-9', '', 'Single, left fin'],
      ['Assorted ribbons', null, '', '', 'Quantity unknown'],
    ])
    expect(plan.shopping.map((s) => [s.item, s.size, s.quantity, s.notes])).toEqual([
      ['Bags', 'black arena', 12, 'Gear Bags tab said 8'],
      ['Goggles', '', null, ''],
    ])
  })

  it('keeps every cell it has no field for, but not worked-out formulas', () => {
    const plan = readGearWorkbook(sample(), emptyData())
    expect(plan.leftovers).toEqual([
      'Gear Bags K2 (Buy, 4.5-5): 1',
      'Gear Bags K3 (Buy, 6-7): 3',
      'Team Shoe & Paddle Sizes K2 (Actuals, 4.5-5): 2',
      'Team Shoe & Paddle Sizes M3: 36',
      'Misc Inventory A1: 1',
    ])
  })

  it('updates a swimmer with the same name instead of adding them twice', () => {
    const existing = withSwimmerDefaults({ id: 'a1', updatedAt: 1, firstName: 'Ana', lastName: '', phone: '555', gearNotes: 'Lost goggles' })
    const data = saveSwimmer(existing)(emptyData())
    const plan = readGearWorkbook(sample(), data)
    expect(plan.swimmers.filter((s) => s.existing)).toHaveLength(1)
    const after = applyGearImport(plan)(data)
    const ana = after.swimmers.find((s) => s.id === 'a1')!
    expect(ana).toMatchObject({ phone: '555', finSize: '7.5-9', gearNotes: 'Lost goggles\nAlready has fins' })
    expect(after.swimmers.filter((s) => !s.deleted)).toHaveLength(3)
  })

  it('saves everything, and importing the same file again changes nothing new', () => {
    const once = applyGearImport(readGearWorkbook(sample(), emptyData(), 'gear.xlsx'))(emptyData())
    expect(once.team[0].finSizes).toContain('6-7')
    expect(once.team[0].notes).toContain('Misc Inventory A1: 1')
    expect(once.gear.find((g) => g.id === 'fins:6-7')!.quantity).toBe(5)
    const twice = applyGearImport(readGearWorkbook(sample(), once, 'gear.xlsx'))(once)
    expect(twice.swimmers).toHaveLength(3)
    expect(twice.bags).toHaveLength(2)
    expect(twice.supplies).toHaveLength(4)
    expect(twice.shopping).toHaveLength(2)
    expect(twice.team[0].notes).toBe(once.team[0].notes)
  })
})
