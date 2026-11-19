import { newId, today } from './actions'
import { RELAY_SLOTS, type AppData, type Competition, type MeetEvent, type Stroke, type Swimmer } from './types'

// Competitions: pure updates (passed to update()) and the values worked out
// from lineups, like I/R badges and focus strokes.

export type CompetitionDraft = Omit<Competition, 'updatedAt'>

export function newCompetition(): CompetitionDraft {
  return { id: newId(), name: '', date: today(), location: '', swimmerIds: [], events: [] }
}

export function newEvent(fields: Pick<MeetEvent, 'name' | 'kind'> & Partial<MeetEvent>): MeetEvent {
  return {
    id: newId(),
    stroke: null,
    distance: null,
    ...fields,
    entries: fields.entries ?? (fields.kind === 'relay' ? RELAY_SLOTS.map(() => '') : []),
  }
}

export const saveCompetition =
  (competition: CompetitionDraft) =>
  (data: AppData): AppData => {
    const record = { ...competition, updatedAt: Date.now() }
    const exists = data.competitions.some((c) => c.id === competition.id)
    return {
      ...data,
      competitions: exists ? data.competitions.map((c) => (c.id === competition.id ? record : c)) : [...data.competitions, record],
    }
  }

export const deleteCompetition =
  (id: string) =>
  (data: AppData): AppData => ({
    ...data,
    competitions: data.competitions.map((c) =>
      c.id === id ? { id, updatedAt: Date.now(), deleted: true, name: '', date: null, location: '', swimmerIds: [], events: [] } : c,
    ),
  })

export const updateEvent =
  (competitionId: string, eventId: string, change: (e: MeetEvent) => MeetEvent) =>
  (data: AppData): AppData => ({
    ...data,
    competitions: data.competitions.map((c) =>
      c.id === competitionId
        ? { ...c, events: c.events.map((e) => (e.id === eventId ? change(e) : e)), updatedAt: Date.now() }
        : c,
    ),
  })

// Tapping a swimmer in the panel: takes them out of the event if they're in
// it; otherwise a relay puts them in the chosen slot (or the next empty one)
// and an individual event adds them.
export function toggleEntry(event: MeetEvent, swimmerId: string, slot: number | null = null): MeetEvent {
  if (event.kind === 'individual') {
    return {
      ...event,
      entries: event.entries.includes(swimmerId) ? event.entries.filter((s) => s !== swimmerId) : [...event.entries, swimmerId],
    }
  }
  const entries = padSlots(event.entries)
  const current = entries.indexOf(swimmerId)
  if (current >= 0 && (slot === null || slot === current)) {
    entries[current] = ''
    return { ...event, entries }
  }
  const target = slot ?? entries.indexOf('')
  if (target < 0) return event
  if (current >= 0) entries[current] = entries[target] // moving within the relay swaps
  entries[target] = swimmerId
  return { ...event, entries }
}

export function clearSlot(event: MeetEvent, slot: number): MeetEvent {
  const entries = padSlots(event.entries)
  entries[slot] = ''
  return { ...event, entries }
}

function padSlots(entries: string[]): string[] {
  return RELAY_SLOTS.map((_, i) => entries[i] ?? '')
}

export function relayEvents(c: Pick<Competition, 'events'>): MeetEvent[] {
  return c.events.filter((e) => e.kind === 'relay')
}

export function individualEvents(c: Pick<Competition, 'events'>): MeetEvent[] {
  return c.events.filter((e) => e.kind === 'individual')
}

export interface Badges {
  individual: number
  relay: number
}

// The circled I and R counts next to each swimmer for one competition.
export function badgesFor(c: Pick<Competition, 'events'>, swimmerId: string): Badges {
  let individual = 0
  let relay = 0
  for (const e of c.events) {
    if (!e.entries.includes(swimmerId)) continue
    if (e.kind === 'relay') relay++
    else individual++
  }
  return { individual, relay }
}

// Upcoming meets first (soonest at the top), then past meets (latest first).
export function sortCompetitions(competitions: Competition[], now = today()): { upcoming: Competition[]; past: Competition[] } {
  const live = competitions.filter((c) => !c.deleted)
  const upcoming = live.filter((c) => !c.date || c.date >= now).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
  const past = live.filter((c) => c.date && c.date < now).sort((a, b) => b.date!.localeCompare(a.date!))
  return { upcoming, past }
}

// Medley relays swim back, breast, fly, free in that leg order.
const MEDLEY_LEGS: Stroke[] = ['Back', 'Breast', 'Fly', 'Free']

// Which stroke a swimmer swims in an event they're entered in.
export function strokeSwum(event: MeetEvent, swimmerId: string): Stroke | null {
  if (event.stroke === 'Medley') {
    if (event.kind !== 'relay') return 'IM'
    const slot = event.entries.indexOf(swimmerId)
    return slot >= 0 ? MEDLEY_LEGS[slot % 4] : null
  }
  return event.stroke
}

// Focus strokes: the strokes of every event they've been entered in, across
// all competitions, most often first.
export function focusStrokes(data: Pick<AppData, 'competitions'>, swimmerId: string): { stroke: Stroke; count: number }[] {
  const counts = new Map<Stroke, number>()
  for (const c of data.competitions) {
    if (c.deleted) continue
    for (const e of c.events) {
      if (!e.entries.includes(swimmerId)) continue
      const stroke = strokeSwum(e, swimmerId)
      if (stroke) counts.set(stroke, (counts.get(stroke) ?? 0) + 1)
    }
  }
  return [...counts].map(([stroke, count]) => ({ stroke, count })).sort((a, b) => b.count - a.count)
}

// The meets a swimmer was entered in, latest first, with their events.
export function competitionHistory(data: Pick<AppData, 'competitions'>, swimmerId: string) {
  return data.competitions
    .filter((c) => !c.deleted && c.events.some((e) => e.entries.includes(swimmerId)))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .map((c) => ({ competition: c, events: c.events.filter((e) => e.entries.includes(swimmerId)) }))
}

export function swimmerName(s: Pick<Swimmer, 'firstName' | 'lastName'> | undefined): string {
  return s ? `${s.firstName} ${s.lastName}`.trim() : 'Removed swimmer'
}
