import type { CustomTag } from './types'

// Works out a block's tags from its text, as the coach types. Words match whole
// words only, so "backyard" never counts as Backstroke.

export const BUILT_IN_TAGS = [
  'Butterfly',
  'Backstroke',
  'Breaststroke',
  'Free',
  'Paddles',
  'Fins',
  'Underwater',
  'Kickboard',
  'Fun',
  'Sprint',
  'Long distance',
  'Dives',
  'Your choice',
] as const

type BuiltInTag = (typeof BUILT_IN_TAGS)[number]

// Words that switch a tag on anywhere in the text.
const WORDS: Partial<Record<BuiltInTag, string[]>> = {
  Butterfly: ['butterfly', 'fly kick'],
  Backstroke: ['backstroke', 'backstrokes'],
  Breaststroke: ['breaststroke', 'breast', 'breastroke'],
  Free: ['freestyle'],
  Paddles: ['paddle', 'paddles'],
  Fins: ['fin', 'fins', 'zoomers', 'flippers'],
  Underwater: ['underwater', 'underwaters', 'uw', 'breakout', 'breakouts', 'streamline kick', 'dolphin kick'],
  Kickboard: ['kickboard', 'kickboards', 'board', 'boards'],
  Fun: ['fun', 'game', 'games', 'relay', 'relays', 'scavenger'],
  Sprint: ['sprint', 'sprints', 'all out', 'fast', 'race pace'],
  'Long distance': ['distance', 'mile', 'long swim'],
  Dives: ['dive', 'dives', 'diving', 'starts', 'off the blocks', 'blocks'],
  'Your choice': ['choice', 'your choice', 'any stroke', 'swimmers choice', "swimmer's choice"],
}

// Short stroke words that mean something else in plain English ("come back",
// "feel free"), so they only count right after a distance: "4x50 back".
const SHORT_STROKES: Record<string, BuiltInTag> = {
  fly: 'Butterfly',
  fl: 'Butterfly',
  back: 'Backstroke',
  bk: 'Backstroke',
  free: 'Free',
  fr: 'Free',
  br: 'Breaststroke',
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Whole-word match that treats letters, digits and apostrophes as word parts.
function hasPhrase(text: string, phrase: string): boolean {
  const words = phrase.trim().split(/\s+/).map(escape).join('\\s+')
  if (!words) return false
  return new RegExp(`(?<![\\w'])${words}(?![\\w'])`, 'i').test(text)
}

const UNIT = String.raw`(?:\s*(?:m|y|yd|yds|yards?|meters?|metres?))?`
// "50 back", "4x50 back", "4 x 50y fly", "100s free", "400 easy free"
const AFTER_DISTANCE = new RegExp(
  String.raw`\d+\s*s?${UNIT}(?:\s+(?:easy|moderate|smooth|fast|build|steady|strong|hard|descend|drill|kick|pull|swim))?\s+(${Object.keys(SHORT_STROKES).join('|')})(?![\w'])`,
  'gi',
)

// Repeats like "8x25" or "10 x 50" and single swims like "500 free" or "1x500".
function distances(text: string): { reps: number; distance: number }[] {
  const found: { reps: number; distance: number }[] = []
  const rest = text.replace(/(\d+)\s*[x×]\s*(\d+)/gi, (_, reps, distance) => {
    found.push({ reps: Number(reps), distance: Number(distance) })
    return ' '
  })
  // A lone number is a swim when a stroke, unit or "swim/kick/pull" follows it.
  const single = new RegExp(
    String.raw`(?<![\d:@])(\d{2,4})${UNIT}\s+(?:free|freestyle|back|backstroke|breast|breaststroke|fly|butterfly|im|swim|kick|pull|drill|choice|fr|bk|br|fl|easy)(?![\w'])`,
    'gi',
  )
  for (const m of rest.matchAll(single)) found.push({ reps: 1, distance: Number(m[1]) })
  return found
}

export function autoTags(text: string, custom: CustomTag[] = []): string[] {
  const tags = new Set<string>()
  for (const [tag, words] of Object.entries(WORDS)) {
    if (words.some((w) => hasPhrase(text, w))) tags.add(tag)
  }
  for (const m of text.matchAll(AFTER_DISTANCE)) tags.add(SHORT_STROKES[m[1].toLowerCase()])
  // IM covers all four strokes.
  if (hasPhrase(text, 'im') || hasPhrase(text, 'individual medley')) {
    for (const tag of ['Butterfly', 'Backstroke', 'Breaststroke', 'Free']) tags.add(tag)
  }
  for (const { reps, distance } of distances(text)) {
    if (reps > 1 && (distance === 25 || distance === 50)) tags.add('Sprint')
    if (distance >= 500 && distance <= 10000) tags.add('Long distance')
  }
  for (const tag of custom) {
    if (!tag.deleted && tag.keywords.some((k) => hasPhrase(text, k))) tags.add(tag.name)
  }
  return orderTags([...tags], custom)
}

// Every tag the coach can pick: built-ins first, then their own.
export function allTagNames(custom: CustomTag[]): string[] {
  const names: string[] = [...BUILT_IN_TAGS]
  for (const tag of custom) {
    if (!tag.deleted && tag.name && !names.includes(tag.name)) names.push(tag.name)
  }
  return names
}

export function orderTags(tags: string[], custom: CustomTag[]): string[] {
  const order = allTagNames(custom)
  return [...new Set(tags)]
    .filter((t) => order.includes(t))
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

// Keywords typed as "pull buoy, buoy" become ["pull buoy", "buoy"].
export function parseKeywords(input: string): string[] {
  return [...new Set(input.split(/[,\n]/).map((k) => k.trim().toLowerCase()).filter(Boolean))]
}
