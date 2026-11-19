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
  return { id: crypto.randomUUID(), number: '', swimmerId: null, finSize: '', finNumber: '', paddleSize: '', paddleNumber: '', notes: '' }
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
