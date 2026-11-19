import type { AppData, Collection, Swimmer, SyncedRecord } from './types'

export const COLLECTIONS: Collection[] = ['team', 'coaches', 'swimmers', 'gear', 'loans', 'photos', 'competitions', 'workouts', 'blocks', 'tags', 'bags', 'supplies', 'shopping']

// Union of two copies of a collection; for the same id the newer edit wins.
export function mergeRecords<T extends SyncedRecord>(a: T[], b: T[]): T[] {
  const byId = new Map<string, T>()
  for (const record of [...a, ...b]) {
    const existing = byId.get(record.id)
    if (!existing || record.updatedAt > existing.updatedAt) byId.set(record.id, record)
  }
  return [...byId.values()]
}

export function mergeData(a: AppData, b: Partial<AppData>): AppData {
  return {
    team: mergeRecords(a.team, b.team ?? []),
    coaches: mergeRecords(a.coaches, b.coaches ?? []),
    // Scrubbed here too so deletes made by older versions of the app, which kept
    // the details, get cleaned up in Drive on the next sync.
    swimmers: mergeRecords(a.swimmers, (b.swimmers ?? []).map(withSwimmerDefaults)).map(scrubDeletedSwimmer),
    gear: mergeRecords(a.gear, b.gear ?? []),
    loans: mergeRecords(a.loans, b.loans ?? []),
    photos: mergeRecords(a.photos, b.photos ?? []),
    competitions: mergeRecords(a.competitions ?? [], b.competitions ?? []),
    workouts: mergeRecords(a.workouts ?? [], b.workouts ?? []),
    blocks: mergeRecords(a.blocks ?? [], b.blocks ?? []),
    tags: mergeRecords(a.tags ?? [], b.tags ?? []),
    bags: mergeRecords(a.bags ?? [], b.bags ?? []),
    supplies: mergeRecords(a.supplies ?? [], b.supplies ?? []),
    shopping: mergeRecords(a.shopping ?? [], b.shopping ?? []),
  }
}

// Fills fields added after a record was first saved (Phase 1 rosters lack the
// profile fields), so older copies on a device or in Drive keep working.
export function withSwimmerDefaults(s: Partial<Swimmer> & SyncedRecord): Swimmer {
  return {
    firstName: '',
    lastName: '',
    level: 'Varsity',
    active: true,
    paddleSize: null,
    finSize: null,
    shoeSize: '',
    registration: null,
    gearNotes: '',
    grade: null,
    phone: '',
    email: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    dateJoined: null,
    clubTeams: [],
    captain: false,
    ...s,
  }
}

// A deleted swimmer keeps only its id, delete flag and timestamp, so their
// name and contact details (and their parents') don't linger in Drive or on
// any coach's device. The tombstone still has to stay so the delete syncs.
export function scrubDeletedSwimmer(s: Swimmer): Swimmer {
  if (!s.deleted) return s
  return { ...withSwimmerDefaults({ id: s.id, updatedAt: s.updatedAt }), active: false, deleted: true }
}

export function sameData(a: AppData, b: AppData): boolean {
  return COLLECTIONS.every((key) => {
    const left = a[key] as SyncedRecord[]
    const right = new Map((b[key] as SyncedRecord[]).map((r) => [r.id, r.updatedAt]))
    return left.length === right.size && left.every((r) => right.get(r.id) === r.updatedAt)
  })
}
