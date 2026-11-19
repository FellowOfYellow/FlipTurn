// A read-only copy of the team's data as a spreadsheet, kept next to the JSON
// files so the coaches can still read everything without the app. The app
// builds an .xlsx file and Google Drive converts it to a Google Sheet.

import { zipSync, strToU8 } from 'fflate'
import { yearsCoaching } from './actions'
import { sortBags, sortShopping, sortSupplies } from './closet'
import { describeItem, summarizeGear, teamFinSizes } from './gear'
import { RELAY_SLOTS, type AppData } from './types'
import { liveWorkouts, sortWorkouts, workoutBlocks, workoutTags } from './workouts'

export const BACKUP_NAME = 'FlipTurn data (read only)'
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const SHEET_MIME = 'application/vnd.google-apps.spreadsheet'

type Cell = string | number
export interface Table {
  name: string
  rows: Cell[][]
}

const yesNo = (value: boolean) => (value ? 'Yes' : '')

export function backupTables(data: AppData, now = new Date()): Table[] {
  const swimmers = data.swimmers
    .filter((s) => !s.deleted)
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
  const swimmerName = new Map(swimmers.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()]))
  const gear = summarizeGear(data.gear, data.swimmers, data.loans, teamFinSizes(data))
  const itemName = new Map(
    gear.flatMap((g) => g.lines.map((l) => [l.itemId, describeItem({ type: g.info.type, size: l.size })] as const)),
  )
  const school = data.team.find((t) => !t.deleted)?.schoolName ?? ''

  return [
    {
      name: 'Swimmers',
      rows: [
        ['Last name', 'First name', 'Active', 'Level', 'Grade', 'Captain', 'Paddle size', 'Fin size', 'Shoe size',
          'Registration', 'Gear notes', 'Phone', 'Email', 'Parent', 'Parent phone', 'Parent email', 'Date joined', 'Club teams'],
        ...swimmers.map((s) => [
          s.lastName, s.firstName, yesNo(s.active), s.level, s.grade ?? '', yesNo(s.captain), s.paddleSize ?? '',
          s.finSize ?? '', s.shoeSize ?? '', s.registration ?? '', s.gearNotes ?? '', s.phone, s.email, s.parentName,
          s.parentPhone, s.parentEmail, s.dateJoined ?? '', s.clubTeams.join(', '),
        ]),
      ],
    },
    {
      name: 'Coaches',
      rows: [
        ['Name', 'Title', 'Email', 'Started', 'Years coaching'],
        ...data.coaches
          .filter((c) => !c.deleted)
          .map((c) => [c.name, c.title, c.email, c.startYear ?? '', yearsCoaching(c.startYear, now) ?? '']),
      ],
    },
    {
      name: 'Gear',
      rows: [
        ['Item', 'Inventory', 'Lent out', 'Needed', 'To order'],
        ...gear.flatMap((g) =>
          g.lines.map((l) => [itemName.get(l.itemId) ?? l.itemId, l.inventory, l.lentOut, l.needed, l.toOrder]),
        ),
      ],
    },
    {
      name: 'Lent out',
      rows: [
        ['Swimmer', 'Item', 'Quantity', 'Lent on', 'Returned on'],
        ...data.loans
          .filter((l) => !l.deleted)
          .sort((a, b) => Number(Boolean(a.returnedOn)) - Number(Boolean(b.returnedOn)) || b.lentOn.localeCompare(a.lentOn))
          .map((l) => [swimmerName.get(l.swimmerId) ?? 'Removed swimmer', itemName.get(l.itemId) ?? l.itemId, l.quantity,
            l.lentOn, l.returnedOn ?? '']),
      ],
    },
    {
      name: 'Meets',
      rows: [
        ['Meet', 'Date', 'Location', 'Event', 'Type', 'Swimmers'],
        ...data.competitions
          .filter((c) => !c.deleted)
          .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
          .flatMap((c) =>
            c.events.map((e) => [
              c.name,
              c.date ?? '',
              c.location,
              e.name,
              e.kind === 'relay' ? 'Relay' : 'Individual',
              e.kind === 'relay'
                ? e.entries.map((sid, i) => (sid ? `${RELAY_SLOTS[i]} ${swimmerName.get(sid) ?? 'Removed swimmer'}` : '')).filter(Boolean).join(', ')
                : e.entries.map((sid) => swimmerName.get(sid) ?? 'Removed swimmer').join(', '),
            ]),
          ),
      ],
    },
    {
      name: 'Gear bags',
      rows: [
        ['Bag', 'Swimmer', 'Fin size', 'Fin number', 'Paddle size', 'Paddle number', 'Notes'],
        ...sortBags(data.bags ?? []).map((b) => [
          b.number, b.swimmerId ? swimmerName.get(b.swimmerId) ?? '' : '', b.finSize, b.finNumber, b.paddleSize,
          b.paddleNumber, b.notes,
        ]),
      ],
    },
    {
      name: 'Supplies',
      rows: [
        ['Item', 'Quantity', 'Size', 'Number', 'Notes'],
        ...sortSupplies(data.supplies ?? []).map((i) => [i.name, i.quantity ?? '?', i.size, i.number, i.notes]),
      ],
    },
    {
      name: 'Shopping list',
      rows: [
        ['Item', 'Size', 'Quantity', 'Bought', 'Notes'],
        ...sortShopping(data.shopping ?? []).map((i) => [i.item, i.size, i.quantity ?? '', yesNo(i.done), i.notes]),
      ],
    },
    {
      name: 'Workouts',
      rows: [
        ['Workout', 'Date', 'Tags', 'Warm up', 'Sets', 'Cool down'],
        ...sortWorkouts(liveWorkouts(data)).map((w) => {
          const { warmup, sets, cooldown } = workoutBlocks(data, w)
          return [
            w.name,
            w.date ?? '',
            workoutTags(data, w).join(', '),
            warmup?.text ?? '',
            sets.map((s) => s.text).join('\n\n'),
            cooldown?.text ?? '',
          ]
        }),
      ],
    },
    {
      name: 'About',
      rows: [
        ['School', school],
        ['Updated', now.toLocaleString()],
        ['Team notes', data.team.find((t) => t.id === 'team')?.notes ?? ''],
        ['Note', 'FlipTurn rewrites this sheet whenever the team syncs. Edits made here are not copied into the app.'],
      ],
    },
  ]
}

const escapeXml = (text: string) =>
  text.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)
// Strip characters XML doesn't allow, which can sneak in through pasted text.
// eslint-disable-next-line no-control-regex
const clean = (text: string) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')

function columnName(index: number): string {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

function sheetXml(rows: Cell[][]): string {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const ref = `${columnName(c)}${r + 1}`
          const bold = r === 0 ? ' s="1"' : ''
          if (typeof value === 'number') return `<c r="${ref}"${bold}><v>${value}</v></c>`
          if (value === '') return ''
          return `<c r="${ref}" t="inlineStr"${bold}><is><t xml:space="preserve">${escapeXml(clean(value))}</t></is></c>`
        })
        .join('')
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${body}</sheetData></worksheet>`
}

// A minimal .xlsx: one worksheet per table, bold header row.
export function buildXlsx(tables: Table[]): Uint8Array {
  const ns = 'http://schemas.openxmlformats.org'
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${tables
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('')}</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets>${tables
      .map((t, i) => `<sheet name="${escapeXml(t.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${ns}/package/2006/relationships">${tables
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')}<Relationship Id="rId${tables.length + 1}" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${ns}/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`),
  }
  tables.forEach((t, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(t.rows))))
  return zipSync(files)
}
