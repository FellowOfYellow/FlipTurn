import { scrubDeletedSwimmer } from './merge'
import type { AppData, Coach, Competition, GearItem, GearLoan, Swimmer, TeamSettings } from './types'

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
      swimmers: data.swimmers.map((s) => (s.id === id ? scrubDeletedSwimmer({ ...s, deleted: true, updatedAt: now }) : s)),
      photos: data.photos.map((p) => (p.id === id ? { ...p, dataUrl: '', deleted: true, updatedAt: now } : p)),
      // Their open loans go with them so gear doesn't stay "lent out" forever.
      loans: data.loans.map((l) =>
        l.swimmerId === id && !l.returnedOn ? { ...l, deleted: true, updatedAt: now } : l,
      ),
      // And out of every meet, so no lineup points at a removed swimmer.
      competitions: data.competitions.map((c) =>
        c.swimmerIds.includes(id) || c.events.some((e) => e.entries.includes(id))
          ? { ...removeFromCompetition(c, id), updatedAt: now }
          : c,
      ),
    }
  }

function removeFromCompetition(c: Competition, swimmerId: string): Competition {
  return {
    ...c,
    swimmerIds: c.swimmerIds.filter((s) => s !== swimmerId),
    events: c.events.map((e) => ({
      ...e,
      entries: e.kind === 'relay' ? e.entries.map((s) => (s === swimmerId ? '' : s)) : e.entries.filter((s) => s !== swimmerId),
    })),
  }
}

export const setGearQuantity =
  (itemId: string, quantity: number) =>
  (data: AppData): AppData => {
    const clean = Math.max(0, Math.round(quantity))
    if (!data.gear.some((g) => g.id === itemId)) {
      // A size from the team's own list that has no inventory line yet.
      const [type, ...size] = itemId.split(':') as [GearItem['type'], ...string[]]
      const item: GearItem = { id: itemId, type, size: size.join(':') || null, quantity: clean, updatedAt: Date.now() }
      return { ...data, gear: [...data.gear, item] }
    }
    return {
      ...data,
      gear: data.gear.map((g) => (g.id === itemId ? { ...g, quantity: clean, deleted: false, updatedAt: Date.now() } : g)),
    }
  }

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

// Changes team-wide settings, creating the team record if there isn't one yet.
export const updateTeam =
  (change: Partial<Omit<TeamSettings, 'id' | 'updatedAt'>>) =>
  (data: AppData): AppData => {
    const team = data.team.find((t) => t.id === 'team') ?? { id: 'team', schoolName: '', updatedAt: 0 }
    const record = { ...team, ...change, updatedAt: Date.now() }
    return { ...data, team: data.team.some((t) => t.id === 'team') ? data.team.map((t) => (t.id === 'team' ? record : t)) : [...data.team, record] }
  }

export const LOCAL_COACH_ID = 'local-coach'

// The same id on every device for the same Google account, so two devices
// signing in for the first time merge into one profile instead of two.
export function coachIdFor(email: string): string {
  return `coach:${email.toLowerCase()}`
}

export function findMyCoach(data: AppData, email: string | null): Coach | undefined {
  const id = email ? coachIdFor(email) : LOCAL_COACH_ID
  return data.coaches.find((c) => c.id === id && !c.deleted)
}

// Links the signed-in Google account to a coach profile, creating one from
// their Google name, or adopting the profile they filled in before signing in.
export const claimCoachProfile =
  (user: { name: string; email: string }) =>
  (data: AppData): AppData => {
    if (findMyCoach(data, user.email)) return data
    const now = Date.now()
    const local = findMyCoach(data, null)
    const coach: Coach = {
      id: coachIdFor(user.email),
      name: local?.name || user.name,
      title: local?.title || 'Coach',
      startYear: local?.startYear ?? null,
      email: user.email,
      updatedAt: now,
    }
    const localPhoto = data.photos.find((p) => p.id === LOCAL_COACH_ID && !p.deleted)
    return {
      ...data,
      coaches: [
        ...data.coaches.map((c) => (c.id === LOCAL_COACH_ID ? { ...c, deleted: true, updatedAt: now } : c)),
        coach,
      ],
      photos: localPhoto
        ? [
            ...data.photos.map((p) => (p.id === LOCAL_COACH_ID ? { ...p, deleted: true, updatedAt: now } : p)),
            { id: coach.id, dataUrl: localPhoto.dataUrl, updatedAt: now },
          ]
        : data.photos,
    }
  }

export const saveCoach =
  (coach: Omit<Coach, 'updatedAt'>) =>
  (data: AppData): AppData => {
    const record = { ...coach, updatedAt: Date.now() }
    const exists = data.coaches.some((c) => c.id === coach.id)
    return {
      ...data,
      coaches: exists ? data.coaches.map((c) => (c.id === coach.id ? record : c)) : [...data.coaches, record],
    }
  }

export const deleteCoach =
  (id: string) =>
  (data: AppData): AppData => ({
    ...data,
    coaches: data.coaches.map((c) => (c.id === id ? { ...c, deleted: true, updatedAt: Date.now() } : c)),
  })

// A null dataUrl removes the photo.
export const setPhoto =
  (ownerId: string, dataUrl: string | null) =>
  (data: AppData): AppData => {
    const current = data.photos.find((p) => p.id === ownerId && !p.deleted)
    if ((current?.dataUrl ?? null) === dataUrl) return data
    const record = dataUrl
      ? { id: ownerId, dataUrl, updatedAt: Date.now() }
      : { id: ownerId, dataUrl: '', deleted: true, updatedAt: Date.now() }
    const exists = data.photos.some((p) => p.id === ownerId)
    return {
      ...data,
      photos: exists ? data.photos.map((p) => (p.id === ownerId ? record : p)) : [...data.photos, record],
    }
  }

export function photoFor(data: AppData, ownerId: string): string | null {
  const photo = data.photos.find((p) => p.id === ownerId && !p.deleted)
  return photo?.dataUrl || null
}

export function yearsCoaching(startYear: number | null, now = new Date()): number | null {
  if (!startYear) return null
  // A school season starts in the fall, so the count ticks over each August.
  const season = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  return Math.max(1, season - startYear + 1)
}
