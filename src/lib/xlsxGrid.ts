// Reads an .xlsx into a grid of cells per sheet, keeping sheet names and
// turning date cells back into the text a person would see. That matters for
// sizes like "6-7", which Excel quietly stores as the date June 7.

import { strFromU8, unzipSync } from 'fflate'

export type CellValue = string | number

export interface Sheet {
  name: string
  // rows[r][c], 0-based; missing cells are undefined.
  rows: (CellValue | undefined)[][]
  // "r,c" of cells holding a formula; their values are worked out, not typed.
  formulas: Set<string>
}

const BUILT_IN_DATE_FORMATS: Record<number, string> = {
  14: 'm/d/yyyy',
  15: 'd-mmm-yy',
  16: 'd-mmm',
  17: 'mmm-yy',
  22: 'm/d/yyyy h:mm',
}

function decodeXml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&(lt|gt|amp|quot|apos);/g, (_, e) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" })[e as string]!)
}

const textOf = (xml: string) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodeXml(t[1])).join('')

function isDateFormat(code: string): boolean {
  const plain = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')
  return /[dmy]/i.test(plain) && !/^[#0.,%\s]*$/.test(plain)
}

// Shows a date serial the way its format would, for the formats coaches use.
function formatDate(serial: number, code: string): string {
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000))
  const m = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  const y = date.getUTCFullYear()
  const plain = code.replace(/"[^"]*"|\[[^\]]*\]|\\/g, '').toLowerCase().trim()
  if (/^m{1,2}[-/.]d{1,2}$/.test(plain)) return `${m}${plain.match(/[-/.]/)![0]}${d}`
  if (/^d{1,2}[-/.]m{1,2}$/.test(plain)) return `${d}${plain.match(/[-/.]/)![0]}${m}`
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)![0]
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
}

export function readWorkbook(bytes: Uint8Array): Sheet[] {
  const files = unzipSync(bytes)
  const read = (path: string) => (files[path] ? strFromU8(files[path]) : '')
  if (!files['xl/workbook.xml']) throw new Error('This file isn’t an Excel workbook.')

  const shared = [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))

  const styles = read('xl/styles.xml')
  const customFormats = new Map(
    [...styles.matchAll(/<numFmt [^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)].map((m) => [Number(m[1]), decodeXml(m[2])]),
  )
  const xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? ''
  const styleFormats = [...xfs.matchAll(/<xf\b([^>]*)/g)].map((m) => {
    const id = Number(/numFmtId="(\d+)"/.exec(m[1])?.[1] ?? 0)
    return customFormats.get(id) ?? BUILT_IN_DATE_FORMATS[id] ?? ''
  })

  const rels = new Map(
    [...read('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => [
      /Id="([^"]+)"/.exec(m[1])?.[1],
      /Target="([^"]+)"/.exec(m[1])?.[1] ?? '',
    ]),
  )

  return [...read('xl/workbook.xml').matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => {
    const name = decodeXml(/name="([^"]*)"/.exec(m[1])?.[1] ?? '')
    const target = rels.get(/r:id="([^"]+)"/.exec(m[1])?.[1]) ?? ''
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
    const rows: (CellValue | undefined)[][] = []
    const formulas = new Set<string>()
    for (const cell of read(path).matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, attrs, inner = ''] = cell
      const ref = /r="([A-Z]+)(\d+)"/.exec(attrs)
      if (!ref) continue
      const r = Number(ref[2]) - 1
      const c = columnIndex(ref[1])
      const type = /t="(\w+)"/.exec(attrs)?.[1]
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
      let value: CellValue | undefined
      if (type === 's') value = shared[Number(raw)]
      else if (type === 'inlineStr') value = textOf(inner)
      else if (type === 'str' || type === 'e') value = raw === undefined ? undefined : decodeXml(raw)
      else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE'
      else if (raw !== undefined) {
        const n = Number(raw)
        const format = styleFormats[Number(/s="(\d+)"/.exec(attrs)?.[1] ?? 0)] ?? ''
        value = format && isDateFormat(format) ? formatDate(n, format) : n
      }
      if (/<f[\s>/]/.test(inner)) formulas.add(`${r},${c}`)
      if (value === undefined || value === '') continue
      ;(rows[r] ??= [])[c] = value
    }
    return { name, rows, formulas }
  })
}
