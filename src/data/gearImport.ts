// Brings a team's existing gear spreadsheet into FlipTurn: roster sizes, gear
// bags, closet counts, other supplies and the shopping list. Tables are found
// by their header words, not by position, and every cell that doesn't fit a
// field is kept as a note on the team so nothing in the sheet is lost.

import type { CellValue, Sheet } from '../lib/xlsxGrid'
import { today } from './actions'
import { gearItemId, sortSizes, teamFinSizes } from './gear'
import { withSwimmerDefaults } from './merge'
import {
  PADDLE_SIZES,
  type AppData,
  type GearBag,
  type PaddleSize,
  type Registration,
  type ShoppingItem,
  type SupplyItem,
  type Swimmer,
} from './types'

type Draft<T> = Omit<T, 'updatedAt'>

export interface SwimmerImport {
  swimmer: Draft<Swimmer>
  existing: boolean
}

export interface GearImport {
  fileName: string
  swimmers: SwimmerImport[]
  finSizes: string[]
  counts: { itemId: string; label: string; quantity: number }[]
  bags: Draft<GearBag>[]
  supplies: Draft<SupplyItem>[]
  shopping: Draft<ShoppingItem>[]
  // Cells that had no field to go in, as "Sheet name C4: value".
  leftovers: string[]
  warnings: string[]
}

// Numbers print without a trailing ".0"; text is trimmed.
export function cellText(value: CellValue | undefined): string {
  if (value === undefined) return ''
  if (typeof value === 'number') return String(Math.round(value * 1000) / 1000)
  return value.trim()
}

const norm = (value: CellValue | undefined) => cellText(value).toLowerCase().replace(/[^a-z0-9]/g, '')
const columnName = (c: number) => {
  let name = ''
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}
const capitalize = (name: string) => (name === name.toLowerCase() ? name.replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase()) : name)
const numberOrNull = (value: CellValue | undefined) => {
  const n = typeof value === 'number' ? value : Number(cellText(value))
  return cellText(value) !== '' && Number.isFinite(n) ? n : null
}
const slug = (...parts: string[]) => parts.map((p) => p.toLowerCase().replace(/\s+/g, ' ').trim()).join('|')

// Tracks which cells were read so the rest can be kept as notes.
class Reader {
  used = new Set<string>()
  sheet: Sheet
  constructor(sheet: Sheet) {
    this.sheet = sheet
  }
  get(r: number, c: number): CellValue | undefined {
    return this.sheet.rows[r]?.[c]
  }
  take(r: number, c: number): CellValue | undefined {
    this.used.add(`${r},${c}`)
    return this.get(r, c)
  }
  find(test: (value: CellValue, r: number, c: number) => boolean): { r: number; c: number }[] {
    const hits: { r: number; c: number }[] = []
    this.sheet.rows.forEach((row, r) => row?.forEach((v, c) => v !== undefined && test(v, r, c) && hits.push({ r, c })))
    return hits
  }
  // Column positions of the named headers in one row, from a starting column
  // until the first blank header.
  headers(r: number, from: number): Map<string, number> {
    const map = new Map<string, number>()
    for (let c = from; this.get(r, c) !== undefined; c++) map.set(norm(this.get(r, c)), c)
    return map
  }
  leftovers(): string[] {
    const out: string[] = []
    this.sheet.rows.forEach((row, r) =>
      row?.forEach((v, c) => {
        if (v === undefined || this.used.has(`${r},${c}`) || this.sheet.formulas.has(`${r},${c}`) || !cellText(v)) return
        // Name the cell by the nearest heading above it and label to its left.
        const isLabel = (x: CellValue | undefined) => typeof x === 'string' && numberOrNull(x) === null && !x.startsWith('#')
        let heading = ''
        for (let up = r - 1; up >= 0 && !heading; up--) if (isLabel(this.get(up, c))) heading = cellText(this.get(up, c))
        let label = ''
        for (let left = c - 1; left >= Math.max(0, c - 3) && !label; left--) if (typeof this.get(r, left) === 'string') label = cellText(this.get(r, left))
        const context = [heading, label].filter(Boolean).join(', ')
        out.push(`${this.sheet.name} ${columnName(c)}${r + 1}${context ? ` (${context})` : ''}: ${cellText(v)}`)
      }),
    )
    return out
  }
}

// Reads rows under a header until a row where every column is blank, or a
// row that starts another table.
function tableRows(reader: Reader, headerRow: number, cols: number[], stopWords: string[] = []): number[] {
  const rows: number[] = []
  for (let r = headerRow + 1; r < reader.sheet.rows.length; r++) {
    const values = cols.map((c) => reader.get(r, c))
    if (values.every((v) => cellText(v) === '')) break
    if (stopWords.includes(norm(values[0]))) break
    rows.push(r)
  }
  return rows
}

function registration(raw: string): Registration | null {
  if (!raw) return null
  if (/^not\b|^no\b|unregistered/i.test(raw)) return 'Not registered'
  if (/\bbut\b/i.test(raw)) return 'Registered, but…'
  if (/^(good|yes|y|registered|done|ok)\b/i.test(raw)) return 'Registered'
  return null
}

const SET_WORDS = /^(full set|set|pair|single|left|right)$/i

export function readGearWorkbook(sheets: Sheet[], data: AppData, fileName = 'spreadsheet'): GearImport {
  const plan: GearImport = { fileName, swimmers: [], finSizes: [], counts: [], bags: [], supplies: [], shopping: [], leftovers: [], warnings: [] }
  const readers = sheets.map((s) => new Reader(s))
  const sizesSeen: string[] = []
  const existingByName = new Map(
    data.swimmers.filter((s) => !s.deleted).map((s) => [`${s.firstName} ${s.lastName}`.trim().toLowerCase(), s]),
  )
  const importedByName = new Map<string, Draft<Swimmer>>()
  const duplicates: Draft<Swimmer>[] = []
  const nameKey = (name: string) => capitalize(name.trim().replace(/\s+/g, ' ')).toLowerCase()

  // Roster: a table with a Name column and gear sizes.
  for (const reader of readers) {
    for (const { r, c } of reader.find((v) => norm(v) === 'name')) {
      const h = reader.headers(r, Math.max(0, c - 1))
      if (!h.has('shoesize') && !h.has('paddlesize') && !h.has('category') && !h.has('finsize')) continue
      const cols = [...h.values()]
      cols.forEach((col) => reader.take(r, col))
      for (const row of tableRows(reader, r, cols)) {
        const name = cellText(reader.take(row, c))
        if (!name) continue
        const take = (key: string) => (h.has(key) ? cellText(reader.take(row, h.get(key)!)) : '')
        const student = take('student')
        const finSize = take('category') || take('finsize')
        const paddle = take('paddlesize').toUpperCase()
        const shoe = take('shoesize')
        const regRaw = take('registered') || take('registration')
        const notes = [take('notes')]
        const reg = registration(regRaw)
        if (regRaw && (!reg || (reg === 'Registered, but…' && !/^good, but$/i.test(regRaw)))) notes.push(`Registration: ${regRaw}`)
        if (student) notes.push(`Student: ${student}`)
        const validPaddle = (PADDLE_SIZES as readonly string[]).includes(paddle) ? (paddle as PaddleSize) : null
        if (paddle && !validPaddle) notes.push(`Paddle size: ${paddle}`)
        if (finSize) sizesSeen.push(finSize)

        const full = capitalize(name.replace(/\s+/g, ' '))
        const [firstName, ...rest] = full.split(' ')
        const existing = existingByName.get(full.toLowerCase())
        const base = existing ?? withSwimmerDefaults({ id: crypto.randomUUID(), updatedAt: 0, firstName, lastName: rest.join(' '), dateJoined: today() })
        const gearNotes = [base.gearNotes, ...notes].map((n) => n.trim()).filter(Boolean)
        const swimmer: Draft<Swimmer> = {
          ...base,
          finSize: finSize || base.finSize,
          paddleSize: validPaddle ?? base.paddleSize,
          shoeSize: shoe || base.shoeSize,
          registration: reg ?? base.registration,
          gearNotes: [...new Set(gearNotes)].join('\n'),
        }
        delete (swimmer as Partial<Swimmer>).updatedAt
        if (importedByName.has(nameKey(name))) {
          plan.warnings.push(`${full} is listed twice, so they were added as two swimmers. Check the roster.`)
          duplicates.push({ ...swimmer, id: crypto.randomUUID() })
        } else importedByName.set(nameKey(name), swimmer)
      }
    }
  }
  plan.swimmers = [...importedByName.values(), ...duplicates].map((swimmer) => ({
    swimmer,
    existing: data.swimmers.some((s) => s.id === swimmer.id),
  }))
  const swimmerIdFor = (name: string) =>
    importedByName.get(nameKey(name))?.id ?? existingByName.get(capitalize(name.trim()).toLowerCase())?.id ?? null

  // Gear bags: a table with a Bag Number column.
  for (const reader of readers) {
    for (const { r, c } of reader.find((v) => norm(v) === 'bagnumber' || norm(v) === 'bag')) {
      const h = reader.headers(r, Math.max(0, c - 1))
      const cols = [...h.values()]
      cols.forEach((col) => reader.take(r, col))
      for (const row of tableRows(reader, r, cols)) {
        const take = (key: string) => (h.has(key) ? cellText(reader.take(row, h.get(key)!)) : '')
        const number = take('bagnumber') || take('bag')
        const student = take('student')
        const finSize = take('finsize')
        if (finSize) sizesSeen.push(finSize)
        const swimmerId = student ? swimmerIdFor(student) : null
        const notes = [take('notes')]
        if (student && !swimmerId) notes.push(`Student: ${student}`)
        plan.bags.push({
          id: `bag:${number || row}`,
          number,
          swimmerId,
          finSize,
          finNumber: take('finnumber'),
          paddleSize: take('paddlesize'),
          paddleNumber: take('paddlenumber'),
          notes: notes.filter(Boolean).join('\n'),
        })
      }
    }
  }

  // Closet counts: "Fin Size" / "Paddle Size" followed by "Count" or "Inventory".
  const counts = new Map<string, { label: string; quantity: number; from: string }>()
  const COUNT_WORDS = ['count', 'inventory', 'quantity', 'qty']
  for (const reader of readers) {
    for (const { r, c } of reader.find((v, r, c) => ['finsize', 'paddlesize'].includes(norm(v)) && COUNT_WORDS.includes(norm(reader.get(r, c + 1))))) {
      const type = norm(reader.get(r, c)) === 'finsize' ? 'fins' : 'paddles'
      const h = reader.headers(r, c)
      const cols = [...h.values()]
      cols.forEach((col) => reader.take(r, col))
      for (const row of tableRows(reader, r, [c, c + 1], ['finsize', 'paddlesize'])) {
        const size = cellText(reader.take(row, c))
        const quantity = numberOrNull(reader.take(row, c + 1))
        if (!size || quantity === null) {
          // A half-filled row isn't a count; keep what's there as a note.
          reader.used.delete(`${row},${c}`)
          reader.used.delete(`${row},${c + 1}`)
          continue
        }
        const normalSize = type === 'paddles' ? size.toUpperCase() : size
        if (type === 'fins') sizesSeen.push(size)
        const itemId = gearItemId(type, normalSize)
        const label = `${type === 'fins' ? 'Fins' : 'Paddles'} size ${normalSize}`
        const prior = counts.get(itemId)
        if (prior && prior.quantity !== quantity) {
          plan.warnings.push(`${label}: "${prior.from}" says ${prior.quantity}, "${reader.sheet.name}" says ${quantity}. Using ${quantity}.`)
          plan.leftovers.push(`${prior.from}: ${label} count ${prior.quantity}`)
        }
        counts.set(itemId, { label, quantity, from: reader.sheet.name })
        // Columns after the count (Buy, Actuals, To Buy) are worked out by the
        // app from the roster, but keep what was typed in as notes.
      }
    }
  }
  plan.counts = [...counts].map(([itemId, { label, quantity }]) => ({ itemId, label, quantity }))

  // Things to buy: "Qty Buy" / "Size" / "Item".
  const shopping = new Map<string, Draft<ShoppingItem> & { from: string }>()
  for (const reader of readers) {
    for (const { r, c } of reader.find((v, r, c) => norm(v) === 'qtybuy' || (norm(v) === 'quantity' && norm(reader.get(r, c + 2)) === 'item'))) {
      const h = reader.headers(r, c)
      const cols = [...h.values()]
      cols.forEach((col) => reader.take(r, col))
      for (const row of tableRows(reader, r, cols)) {
        const quantity = numberOrNull(reader.take(row, c))
        const size = h.has('size') ? cellText(reader.take(row, h.get('size')!)) : ''
        const item = capitalize(h.has('item') ? cellText(reader.take(row, h.get('item')!)) : '')
        if (!item) continue
        if (/^fins?$/i.test(item) && size) sizesSeen.push(size)
        const id = `shop:${slug(item, size)}`
        const prior = shopping.get(id)
        const notes = prior && prior.quantity !== quantity ? [`${prior.from} tab said ${prior.quantity ?? 'blank'}`] : []
        shopping.set(id, { id, item, size, quantity, notes: [...(prior ? [prior.notes] : []), ...notes].filter(Boolean).join('\n'), done: false, from: reader.sheet.name })
      }
    }
  }
  // A plain shopping list: "Item" / "Quantity".
  for (const reader of readers) {
    for (const { r, c } of reader.find((v, r, c) => norm(v) === 'item' && ['quantity', 'qty'].includes(norm(reader.get(r, c + 1))) && norm(reader.get(r, c - 1)) !== 'size')) {
      const h = reader.headers(r, c)
      const cols = [...h.values()]
      cols.forEach((col) => reader.take(r, col))
      for (const row of tableRows(reader, r, cols)) {
        const item = capitalize(cellText(reader.take(row, c)))
        if (!item) continue
        const quantity = numberOrNull(reader.take(row, c + 1))
        const take = (key: string) => (h.has(key) ? cellText(reader.take(row, h.get(key)!)) : '')
        const id = `shop:${slug(item, take('size'))}`
        shopping.set(id, { id, item, size: take('size'), quantity, notes: take('notes'), done: false, from: reader.sheet.name })
      }
    }
  }
  plan.shopping = [...shopping.values()].map(({ from: _from, ...item }) => item)

  // Other supplies: a table with Quantity and Notes (and usually Size, Number),
  // item names in the first column.
  for (const reader of readers) {
    for (const { r, c } of reader.find((v, r, c) => norm(v) === 'quantity' && c > 0 && reader.headers(r, c).has('notes'))) {
      const h = reader.headers(r, c)
      const nameCol = c - 1
      const header = cellText(reader.get(r, nameCol))
      ;[...h.values()].forEach((col) => reader.take(r, col))
      // A header like "Item" is just a label; anything else is kept as a note.
      if (['item', 'items', 'name', ''].includes(norm(header))) reader.take(r, nameCol)
      for (const row of tableRows(reader, r, [nameCol, ...h.values()])) {
        const name = capitalize(cellText(reader.take(row, nameCol)))
        if (!name) continue
        const qtyRaw = cellText(reader.take(row, c))
        const take = (key: string) => (h.has(key) ? cellText(reader.take(row, h.get(key)!)) : '')
        const size = take('size')
        const numeric = numberOrNull(qtyRaw)
        const notes = [take('notes')]
        let quantity = numeric
        if (numeric === null && qtyRaw) {
          if (SET_WORDS.test(qtyRaw)) quantity = 1
          notes.unshift(qtyRaw === '?' ? 'Quantity unknown' : qtyRaw)
        }
        if (/^fins?$/i.test(name) && size) sizesSeen.push(size)
        const number = take('number')
        const noteText = notes.filter(Boolean).join(', ')
        plan.supplies.push({ id: `supply:${slug(name, size, number, noteText)}`, name, quantity, size, number, notes: noteText })
      }
    }
  }

  const current = data.team.find((t) => t.id === 'team')?.finSizes ?? []
  const inUse = data.swimmers.filter((s) => !s.deleted && s.finSize).map((s) => s.finSize!)
  const finSizes = sortSizes([...current, ...inUse, ...sizesSeen].filter(Boolean))
  plan.finSizes = finSizes.join() === teamFinSizes(data).join() ? [] : finSizes

  for (const reader of readers) plan.leftovers.push(...reader.leftovers())
  return plan
}

function upsert<T extends { id: string }>(list: T[], records: T[]): T[] {
  const byId = new Map(list.map((r) => [r.id, r]))
  for (const record of records) byId.set(record.id, record)
  return [...byId.values()]
}

export const applyGearImport =
  (plan: GearImport) =>
  (data: AppData): AppData => {
    const now = Date.now()
    const stamp = <T>(records: T[]) => records.map((r) => ({ ...r, updatedAt: now }))
    const team = data.team.find((t) => t.id === 'team') ?? { id: 'team', schoolName: '', updatedAt: 0 }
    // Skipped when the same cells were already saved by an earlier import.
    const note =
      plan.leftovers.length && !(team.notes ?? '').includes(plan.leftovers.join('\n'))
        ? `From ${plan.fileName}, imported ${today()}:\n${plan.leftovers.join('\n')}`
        : ''
    const teamRecord = {
      ...team,
      finSizes: plan.finSizes.length ? plan.finSizes : team.finSizes,
      notes: [team.notes, note].filter(Boolean).join('\n\n'),
      updatedAt: now,
    }
    const gear = [...data.gear]
    for (const { itemId, quantity } of plan.counts) {
      const i = gear.findIndex((g) => g.id === itemId)
      const [type, ...size] = itemId.split(':')
      const item = { id: itemId, type: type as 'fins' | 'paddles', size: size.join(':') || null, quantity, updatedAt: now }
      if (i >= 0) gear[i] = { ...gear[i], quantity, deleted: false, updatedAt: now }
      else gear.push(item)
    }
    return {
      ...data,
      team: upsert(data.team, [teamRecord]),
      swimmers: upsert(data.swimmers, stamp(plan.swimmers.map((s) => s.swimmer))),
      gear,
      bags: upsert(data.bags ?? [], stamp(plan.bags)),
      supplies: upsert(data.supplies ?? [], stamp(plan.supplies)),
      shopping: upsert(data.shopping ?? [], stamp(plan.shopping)),
    }
  }
