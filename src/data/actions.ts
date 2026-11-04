import type { AppData, GearLoan, Swimmer } from './types'

// Pure updates passed to update(); each stamps updatedAt so sync can merge.

export function newId(): string {
  return crypto.randomUUID()
}

export function today(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export const saveSwimmer =
  (swimmer: Omit<Swimmer, 'updatedAt'>) =>
  (data: AppData): AppData => {
    const record = { ...swimmer, updatedAt: Date.now() }
    const exists = data.swimmers.some((s) => s.id === swimmer.id)
    return {
      ...data,
      swimmers: exists
        ? data.swimmers.map((s) => (s.id === swimmer.id ? record : s))
        : [...data.swimmers, record],
    }
  }

export const deleteSwimmer =
  (id: string) =>
  (data: AppData): AppData => {
    const now = Date.now()
    return {
      ...data,
      swimmers: data.swimmers.map((s) => (s.id === id ? { ...s, deleted: true, updatedAt: now } : s)),
      // Their open loans go with them so gear doesn't stay "lent out" forever.
      loans: data.loans.map((l) =>
        l.swimmerId === id && !l.returnedOn ? { ...l, deleted: true, updatedAt: now } : l,
      ),
    }
  }

export const setGearQuantity =
  (itemId: string, quantity: number) =>
  (data: AppData): AppData => ({
    ...data,
    gear: data.gear.map((g) =>
      g.id === itemId ? { ...g, quantity: Math.max(0, Math.round(quantity)), updatedAt: Date.now() } : g,
    ),
  })

export const lendGear =
  (swimmerId: string, itemIds: string[], lentOn: string = today()) =>
  (data: AppData): AppData => {
    const now = Date.now()
    const loans: GearLoan[] = itemIds.map((itemId) => ({
      id: newId(),
      swimmerId,
      itemId,
      quantity: 1,
      lentOn,
      returnedOn: null,
      updatedAt: now,
    }))
    return { ...data, loans: [...data.loans, ...loans] }
  }

export const returnLoan =
  (loanId: string, returnedOn: string = today()) =>
  (data: AppData): AppData => ({
    ...data,
    loans: data.loans.map((l) => (l.id === loanId ? { ...l, returnedOn, updatedAt: Date.now() } : l)),
  })

export const setSchoolName =
  (schoolName: string) =>
  (data: AppData): AppData => ({
    ...data,
    team: data.team.map((t) => (t.id === 'team' ? { ...t, schoolName, updatedAt: Date.now() } : t)),
  })
