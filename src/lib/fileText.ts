// Turns an uploaded meet sheet into plain text lines, all in the browser.
// The PDF and Word readers are large, so they load only when needed.

import { strFromU8, unzipSync } from 'fflate'

export const ACCEPTED_FILES = '.pdf,.docx,.xlsx,.csv,.txt,text/plain,text/csv,application/pdf'

export async function fileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return pdfText(await file.arrayBuffer())
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth/mammoth.browser.js')
    return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value
  }
  if (name.endsWith('.xlsx')) return xlsxText(new Uint8Array(await file.arrayBuffer()))
  if (name.endsWith('.csv')) return csvText(await file.text())
  if (name.endsWith('.doc')) throw new Error('Older .doc files can’t be read. Save it as .docx or PDF and try again.')
  if (file.type.startsWith('image/')) throw new Error('Photos can’t be read yet. Paste the event list as text, or upload a PDF or Word file.')
  return file.text()
}

async function pdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  const lines: string[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const content = await page.getTextContent()
    // Group text pieces into lines by their vertical position.
    const rows = new Map<number, { x: number; text: string }[]>()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5] / 2) * 2
      const row = rows.get(y) ?? []
      row.push({ x: item.transform[4], text: item.str })
      rows.set(y, row)
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      lines.push(rows.get(y)!.sort((a, b) => a.x - b.x).map((p) => p.text).join(' '))
    }
  }
  return lines.join('\n')
}

export function csvText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.replace(/^"|"$/g, '').trim()).filter(Boolean).join(' '))
    .join('\n')
}

// Reads every sheet of an .xlsx, one spreadsheet row per line.
export function xlsxText(bytes: Uint8Array): string {
  const files = unzipSync(bytes)
  const shared = files['xl/sharedStrings.xml']
    ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodeXml(t[1])).join(''),
      )
    : []
  const sheets = Object.keys(files)
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
  const lines: string[] = []
  for (const path of sheets) {
    for (const row of strFromU8(files[path]).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [...row[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(([, attrs, inner = '']) => {
        if (/t="s"/.test(attrs)) return shared[Number(/<v>(.*?)<\/v>/.exec(inner)?.[1])] ?? ''
        if (/t="inlineStr"/.test(attrs)) return [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodeXml(t[1])).join('')
        return decodeXml(/<v>(.*?)<\/v>/.exec(inner)?.[1] ?? '')
      })
      const line = cells.filter(Boolean).join(' ')
      if (line) lines.push(line)
    }
  }
  return lines.join('\n')
}

function decodeXml(text: string): string {
  return text.replace(/&(lt|gt|amp|quot|apos);/g, (_, e) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" })[e as string]!)
}
