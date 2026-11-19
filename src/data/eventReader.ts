import type { EventKind, Stroke } from './types'

// Finds competition events in the text of a meet sheet, one line at a time,
// e.g. "Event 3  Girls 200 Yard Medley Relay". Rule based; tuned on real meet
// sheets in a later phase.

export interface FoundEvent {
  name: string
  kind: EventKind
  stroke: Stroke
  distance: number
}

export interface ReadResult {
  events: FoundEvent[]
  // Lines that looked like they might be events but weren't used, with why.
  skipped: { line: string; reason: string }[]
}

const STROKE_PATTERNS: [RegExp, Stroke][] = [
  [/\b(individual\s+medley|i\.?m\.?)\b/i, 'IM'],
  [/\bmedley\b/i, 'Medley'],
  [/\b(butterfly|fly|bfly)\b/i, 'Fly'],
  [/\b(breaststroke|breast|brst)\b/i, 'Breast'],
  [/\b(backstroke|back|bk)\b/i, 'Back'],
  [/\b(freestyle|free|fr)\b/i, 'Free'],
]

const DISTANCE = /\b(?:(\d)\s*[x×]\s*)?(25|50|100|200|400|500|800|1000|1500|1650)\b/i
const DIVING = /\b(diving|dive|1\s*m(eter)?\s+board|3\s*m(eter)?\s+board)\b/i

export function readEvents(text: string): ReadResult {
  const events: FoundEvent[] = []
  const skipped: ReadResult['skipped'] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (!line) continue
    if (DIVING.test(line)) {
      skipped.push({ line, reason: 'Diving is not tracked' })
      continue
    }
    const found = readLine(line)
    if (found) events.push(found)
    else if (/\d/.test(line) && line.length <= 120) skipped.push({ line, reason: 'No distance and stroke found' })
  }
  return { events, skipped }
}

function readLine(line: string): FoundEvent | null {
  const distanceMatch = DISTANCE.exec(line)
  const stroke = STROKE_PATTERNS.find(([pattern]) => pattern.test(line))?.[1]
  if (!distanceMatch || !stroke) return null
  const legs = distanceMatch[1] ? Number(distanceMatch[1]) : 1
  const distance = Number(distanceMatch[2]) * legs
  const kind: EventKind = /\brelay\b/i.test(line) || legs > 1 ? 'relay' : 'individual'
  return { name: cleanName(line), kind, stroke: kind === 'individual' && stroke === 'Medley' ? 'IM' : stroke, distance }
}

// Drops the event number and anything after the event name (times, records).
function cleanName(line: string): string {
  let name = line
    .replace(/^\s*(event|evt|ev)?\s*#?\s*\d{1,3}\s*[.):-]?\s+(?=\D)/i, '')
    .replace(/\s+\d{1,2}:\d{2}(\.\d+)?.*$/, '')
    .replace(/\s+\d{2}\.\d{2}.*$/, '')
  const relayAt = name.search(/\brelay\b/i)
  if (relayAt >= 0) name = name.slice(0, relayAt + 5)
  return name.trim()
}
