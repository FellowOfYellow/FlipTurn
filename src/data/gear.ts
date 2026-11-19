import {
  FIN_SIZES,
  PADDLE_SIZES,
  type AppData,
  type GearBag,
  type GearItem,
  type GearLoan,
  type GearType,
  type Swimmer,
} from './types'

export interface GearTypeInfo {
  type: GearType
  label: string
  singular: string
  sizes: readonly string[] | null
  sizeLabel?: string
  swimmerSize?: (s: Swimmer) => string | null
}

export const GEAR_TYPES: GearTypeInfo[] = [
  {
    type: 'paddles',
    label: 'Paddles',
    singular: 'Paddles',
    sizes: PADDLE_SIZES,
    sizeLabel: 'Size',
    swimmerSize: (s) => s.paddleSize,
  },
  {
    type: 'fins',
    label: 'Fins',
    singular: 'Fins',
    sizes: FIN_SIZES,
    sizeLabel: 'Size',
    swimmerSize: (s) => s.finSize,
  },
  { type: 'gearBag', label: 'Gear bags', singular: 'Gear bag', sizes: null },
  { type: 'kickboard', label: 'Kickboards', singular: 'Kickboard', sizes: null },
  { type: 'pullBuoy', label: 'Pull buoys', singular: 'Pull buoy', sizes: null },
]

export function teamFinSizes(data: Pick<AppData, 'team'>): string[] {
  const sizes = data.team.find((t) => t.id === 'team' && !t.deleted)?.finSizes
  return sizes?.length ? sizes : [...FIN_SIZES]
}

// Sorts sizes like "4.5-5", "7.5-9", "12.5-13" by their first number; sizes
// with no number (like "Y2" for youth) go first.
export function sortSizes(sizes: string[]): string[] {
  const first = (s: string) => parseFloat(/\d+(\.\d+)?/.exec(s)?.[0] ?? '-1')
  return [...new Set(sizes)].sort((a, b) => first(a) - first(b) || a.localeCompare(b))
}

export function gearTypeInfo(type: GearType): GearTypeInfo {
  return GEAR_TYPES.find((g) => g.type === type)!
}

export function gearItemId(type: GearType, size: string | null): string {
  return size ? `${type}:${size}` : type
}

export function describeItem(item: Pick<GearItem, 'type' | 'size'>): string {
  const info = gearTypeInfo(item.type)
  return item.size ? `${info.singular} (size ${item.size})` : info.singular
}

// The full list of inventory lines, so every size shows even before it has stock.
export function defaultGearItems(now: number): GearItem[] {
  return GEAR_TYPES.flatMap((info) =>
    (info.sizes ?? [null]).map((size) => ({
      id: gearItemId(info.type, size),
      type: info.type,
      size,
      quantity: 0,
      updatedAt: now,
    })),
  )
}

export interface SizeLine {
  itemId: string
  size: string | null
  inventory: number
  lentOut: number
  // Packed in gear bags (or, for gear bags, the bags themselves).
  inBags: number
  // Left in the closet: inventory minus lent out minus in bags. Below zero
  // means more is assigned than the team owns.
  available: number
  needed: number
  toOrder: number
}

export interface GearSummary {
  info: GearTypeInfo
  lines: SizeLine[]
  inventory: number
  lentOut: number
  inBags: number
  toOrder: number
  // Active swimmers with no size recorded, so they can't be counted for a size.
  missingSize: number
}

// How many of each inventory line the gear bags use: one gear bag per bag,
// plus the fins, paddles, kickboard and pull buoy packed in it.
export function bagUsage(bags: Pick<GearBag, 'deleted' | 'finSize' | 'paddleSize' | 'kickboard' | 'pullBuoy'>[]): Map<string, number> {
  const used = new Map<string, number>()
  const add = (id: string) => used.set(id, (used.get(id) ?? 0) + 1)
  for (const bag of bags) {
    if (bag.deleted) continue
    add('gearBag')
    if (bag.finSize) add(gearItemId('fins', bag.finSize))
    if (bag.paddleSize) add(gearItemId('paddles', bag.paddleSize))
    if (bag.kickboard) add('kickboard')
    if (bag.pullBuoy) add('pullBuoy')
  }
  return used
}

export function activeSwimmers(swimmers: Swimmer[]): Swimmer[] {
  return swimmers.filter((s) => !s.deleted && s.active)
}

export function openLoans(loans: GearLoan[]): GearLoan[] {
  return loans.filter((l) => !l.deleted && !l.returnedOn)
}

// Inventory is everything the team owns, including gear lent out. Every active
// swimmer needs one of every piece, so to order = active swimmers minus
// inventory (per size for paddles and fins), never below zero.
export function summarizeGear(
  gear: GearItem[],
  swimmers: Swimmer[],
  loans: GearLoan[],
  finSizes: readonly string[] = FIN_SIZES,
  bags: GearBag[] = [],
): GearSummary[] {
  const packed = bagUsage(bags)
  const active = activeSwimmers(swimmers)
  const lent = new Map<string, number>()
  for (const loan of openLoans(loans)) {
    lent.set(loan.itemId, (lent.get(loan.itemId) ?? 0) + loan.quantity)
  }
  const quantity = new Map(gear.filter((g) => !g.deleted).map((g) => [g.id, g.quantity]))

  return GEAR_TYPES.map((info) => {
    // The team's fin sizes, plus any size that still has stock so it never hides.
    const sizes =
      info.type === 'fins'
        ? [...finSizes, ...gear.filter((g) => g.type === 'fins' && !g.deleted && g.quantity > 0 && g.size && !finSizes.includes(g.size)).map((g) => g.size!)]
        : info.sizes
    const lines: SizeLine[] = (sizes ?? [null]).map((size) => {
      const itemId = gearItemId(info.type, size)
      const needed =
        size === null
          ? active.length
          : active.filter((s) => info.swimmerSize?.(s) === size).length
      const inventory = quantity.get(itemId) ?? 0
      const lentOut = lent.get(itemId) ?? 0
      const inBags = packed.get(itemId) ?? 0
      return {
        itemId,
        size,
        inventory,
        lentOut,
        inBags,
        available: inventory - lentOut - inBags,
        needed,
        toOrder: Math.max(0, needed - inventory),
      }
    })
    const sum = (key: 'inventory' | 'lentOut' | 'inBags' | 'toOrder') =>
      lines.reduce((total, line) => total + line[key], 0)
    return {
      info,
      lines,
      inventory: sum('inventory'),
      lentOut: sum('lentOut'),
      inBags: sum('inBags'),
      toOrder: sum('toOrder'),
      missingSize: info.swimmerSize
        ? active.filter((s) => info.swimmerSize!(s) === null).length
        : 0,
    }
  })
}

export function orderListText(summaries: GearSummary[], schoolName: string): string {
  const lines: string[] = []
  for (const summary of summaries) {
    for (const line of summary.lines) {
      if (line.toOrder === 0) continue
      const name = line.size ? `${summary.info.label}, size ${line.size}` : summary.info.label
      lines.push(`${name}: ${line.toOrder}`)
    }
  }
  if (lines.length === 0) return 'Nothing to order.'
  const title = schoolName ? `${schoolName} swim gear order` : 'Swim gear order'
  return [title, '', ...lines].join('\n')
}
