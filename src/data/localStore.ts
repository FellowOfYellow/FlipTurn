import { defaultGearItems } from './gear'
import { mergeData } from './merge'
import type { AppData } from './types'

const KEY = 'flipturn.data.v1'

export function emptyData(): AppData {
  // Timestamp 0 so any real edit, local or from Drive, wins over the defaults.
  return {
    team: [{ id: 'team', schoolName: '', updatedAt: 0 }],
    coaches: [],
    swimmers: [],
    gear: defaultGearItems(0),
    loans: [],
    photos: [],
  }
}

export function loadLocal(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return mergeData(emptyData(), JSON.parse(raw) as Partial<AppData>)
  } catch {
    // Private browsing or corrupt data: start empty rather than fail.
  }
  return emptyData()
}

export function saveLocal(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Storage full or blocked; Drive sync still keeps a copy when signed in.
  }
}
