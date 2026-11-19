import { bagUsage, summarizeGear, teamFinSizes } from './gear'
import type { AppData, GearBag, ShoppingItem, SupplyItem } from './types'

// Gear bags, other supplies and the shopping list: simple saves and deletes
// passed to update().

type Draft<T> = Omit<T, 'updatedAt'>
type ClosetKey = 'bags' | 'supplies' | 'shopping'
type ClosetRecord = { bags: GearBag; supplies: SupplyItem; shopping: ShoppingItem }

export const saveClosetRecord =
  <K extends ClosetKey>(key: K, record: Draft<ClosetRecord[K]>) =>
  (data: AppData): AppData => {
    const list = (data[key] ?? []) as ClosetRecord[K][]
    const stamped = { ...record, updatedAt: Date.now() } as ClosetRecord[K]
    const next = list.some((r) => r.id === record.id) ? list.map((r) => (r.id === record.id ? stamped : r)) : [...list, stamped]
    return { ...data, [key]: next }
  }

export const deleteClosetRecord =
  (key: ClosetKey, id: string) =>
  (data: AppData): AppData => ({
    ...data,
    [key]: (data[key] ?? []).map((r) => (r.id === id ? { ...r, deleted: true, updatedAt: Date.now() } : r)),
  })

export function newBag(): Draft<GearBag> {
  return { id: crypto.randomUUID(), number: '', swimmerId: null, finSize: '', finNumber: '', paddleSize: '', paddleNumber: '', kickboard: false, pullBuoy: false, notes: '' }
}

export function newSupply(): Draft<SupplyItem> {
  return { id: crypto.randomUUID(), name: '', quantity: 1, size: '', number: '', notes: '' }
}

export function newShoppingItem(): Draft<ShoppingItem> {
  return { id: crypto.randomUUID(), item: '', size: '', quantity: 1, notes: '', done: false }
}

// Bags in number order (numbers first, then anything else).
export function sortBags(bags: GearBag[]): GearBag[] {
  return bags
    .filter((b) => !b.deleted)
    .sort((a, b) => (Number(a.number) || Infinity) - (Number(b.number) || Infinity) || a.number.localeCompare(b.number))
}

export function sortSupplies(items: SupplyItem[]): SupplyItem[] {
  return items.filter((i) => !i.deleted).sort((a, b) => a.name.localeCompare(b.name) || a.size.localeCompare(b.size, undefined, { numeric: true }))
}

// Still to buy first, then bought.
export function sortShopping(items: ShoppingItem[]): ShoppingItem[] {
  return items.filter((i) => !i.deleted).sort((a, b) => Number(a.done) - Number(b.done) || a.item.localeCompare(b.item))
}

// What a bag is missing, worded like the coaches' own notes ("Needs pull
// buoy"). Skips anything the bag's notes already say.
export function missingPieces(
  bag: Pick<GearBag, 'finSize' | 'paddleSize' | 'kickboard' | 'pullBuoy' | 'notes'> & Partial<Pick<GearBag, 'finNumber' | 'paddleNumber'>>,
): string[] {
  const missing = [
    !bag.finSize && 'Needs fins',
    bag.finSize && !bag.finNumber?.trim() && 'Missing fin number',
    !bag.paddleSize && 'Needs paddles',
    bag.paddleSize && !bag.paddleNumber?.trim() && 'Missing paddle number',
    !bag.kickboard && 'Needs kickboard',
    !bag.pullBuoy && 'Needs pull buoy',
  ].filter((m): m is string => Boolean(m))
  const notes = bag.notes.toLowerCase()
  return missing.filter((m) => !notes.includes(m.toLowerCase()))
}

// How many of each inventory line are free for one bag: what's left in the
// closet with every other bag counted, so a bag can keep what it already has.
export function roomForBag(data: AppData, bagId: string): Map<string, number> {
  const others = (data.bags ?? []).filter((b) => b.id !== bagId)
  const room = new Map<string, number>()
  for (const summary of summarizeGear(data.gear, data.swimmers, data.loans, teamFinSizes(data), others)) {
    for (const line of summary.lines) room.set(line.itemId, line.available)
  }
  return room
}

// The pieces this bag would take that the team doesn't have free.
export function overLimit(data: AppData, bag: Omit<GearBag, 'updatedAt'>): string[] {
  const room = roomForBag(data, bag.id)
  const over: string[] = []
  for (const itemId of bagUsage([bag]).keys()) {
    if ((room.get(itemId) ?? 0) < 1) {
      const [type, size] = itemId.split(':')
      const label = { gearBag: 'gear bags', fins: 'fins', paddles: 'paddles', kickboard: 'kickboards', pullBuoy: 'pull buoys' }[type] ?? type
      over.push(size ? `${label} in size ${size}` : label)
    }
  }
  return over
}
