// Every stored record carries an id and an updatedAt timestamp so copies from
// two devices can be merged record by record. Deleted records stay as
// tombstones (deleted: true) so a delete on one device wins over an older copy.
export interface SyncedRecord {
  id: string
  updatedAt: number
  deleted?: boolean
}

export const SWIMMER_LEVELS = ['Open', 'JV', 'Varsity'] as const
export type SwimmerLevel = (typeof SWIMMER_LEVELS)[number]

export const PADDLE_SIZES = ['S', 'M', 'L'] as const
export type PaddleSize = (typeof PADDLE_SIZES)[number]

export const FIN_SIZES = ['6', '7', '8', '9', '10', '11', '12', '13', '14'] as const
export type FinSize = (typeof FIN_SIZES)[number]

export const GRADES = ['Freshman', 'Sophomore', 'Junior', 'Senior'] as const
export type Grade = (typeof GRADES)[number]

export interface Swimmer extends SyncedRecord {
  firstName: string
  lastName: string
  level: SwimmerLevel
  active: boolean
  paddleSize: PaddleSize | null
  finSize: FinSize | null
  grade: Grade | null
  phone: string
  email: string
  parentName: string
  parentPhone: string
  parentEmail: string
  dateJoined: string | null
  clubTeams: string[]
  captain: boolean
}

export interface Coach extends SyncedRecord {
  name: string
  title: string
  // Year they started coaching this team; years coached is worked out from it.
  startYear: number | null
  // Google account email, linking the profile to whoever signs in with it.
  email: string
}

// Photos live in their own file so the roster stays small. The id matches the
// swimmer or coach the photo belongs to.
export interface Photo extends SyncedRecord {
  dataUrl: string
}

export type GearType = 'paddles' | 'fins' | 'gearBag' | 'kickboard'

// One inventory line per gear type and size, e.g. "fins:9" or "kickboard".
export interface GearItem extends SyncedRecord {
  type: GearType
  size: string | null
  quantity: number
}

export interface GearLoan extends SyncedRecord {
  swimmerId: string
  itemId: string
  quantity: number
  lentOn: string
  returnedOn: string | null
}

export const STROKES = ['Free', 'Back', 'Breast', 'Fly', 'IM', 'Medley'] as const
export type Stroke = (typeof STROKES)[number]
export type EventKind = 'relay' | 'individual'

// A relay holds 12 slots, A1 to C4; an empty slot is ''.
export const RELAY_SLOTS = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4'] as const

export interface MeetEvent {
  id: string
  name: string
  kind: EventKind
  stroke: Stroke | null
  distance: number | null
  // Relay: 12 swimmer ids in slot order ('' when empty). Individual: entrant ids.
  entries: string[]
}

// Events live inside their competition, so a meet syncs as one record.
export interface Competition extends SyncedRecord {
  name: string
  date: string | null
  location: string
  swimmerIds: string[]
  // In meet order. Relays are shown first, then individual events.
  events: MeetEvent[]
}

export interface TeamSettings extends SyncedRecord {
  schoolName: string
}

export interface AppData {
  team: TeamSettings[]
  coaches: Coach[]
  swimmers: Swimmer[]
  gear: GearItem[]
  loans: GearLoan[]
  photos: Photo[]
  competitions: Competition[]
}

export type Collection = keyof AppData
