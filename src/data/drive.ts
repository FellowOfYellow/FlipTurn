import { mergeData } from './merge'
import { BACKUP_NAME, SHEET_MIME, XLSX_MIME, backupTables, buildXlsx } from './sheetBackup'
import type { AppData, Collection } from './types'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
export const FOLDER_NAME = 'FlipTurn'

// Which collections live in which Drive file, matching the folder layout in
// the implementation plan.
export const FILES: Record<string, Collection[]> = {
  'team.json': ['team', 'gear'],
  'coaches.json': ['coaches'],
  'swimmers.json': ['swimmers'],
  'gear-loans.json': ['loans'],
  'photos.json': ['photos'],
  'competitions.json': ['competitions'],
  'workouts.json': ['workouts', 'blocks', 'tags'],
  'closet.json': ['bags', 'supplies', 'shopping'],
}

// Files later phases fill in. They're created with the team so an assistant
// coach who picked the folder's files already has access to them.
const RESERVED_FILES: string[] = []

export interface DriveUser {
  name: string
  email: string
}

export class DriveError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function fileContents(data: AppData, name: string): string {
  const contents = Object.fromEntries(FILES[name].map((key) => [key, data[key]]))
  return JSON.stringify({ version: 1, ...contents }, null, 2)
}

export class DriveClient {
  private token: string
  folderId: string | null = null
  // Only the folder's owner creates missing files. A file an assistant coach
  // created would be invisible to the head coach under the drive.file scope.
  private ownsFolder = false
  private fileIds = new Map<string, string>()
  // What each file held when last read or written, so unchanged files are skipped.
  private lastSeen = new Map<string, string>()
  // What the backup sheet was last written with, minus its timestamp.
  private lastBackup: string | null = null
  backupError: string | null = null

  constructor(token: string) {
    this.token = token
  }

  setToken(token: string) {
    this.token = token
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${this.token}`, ...init.headers },
    })
    if (!response.ok) {
      throw new DriveError(response.status, `Google Drive request failed (${response.status}).`)
    }
    return response
  }

  private async list(query: string): Promise<{ id: string; name: string }[]> {
    const params = new URLSearchParams({ q: query, fields: 'files(id,name)', spaces: 'drive', pageSize: '100' })
    const response = await this.request(`${API}/files?${params}`)
    return ((await response.json()) as { files: { id: string; name: string }[] }).files
  }

  async getUser(): Promise<DriveUser> {
    const response = await this.request(`${API}/about?fields=user(displayName,emailAddress)`)
    const { user } = (await response.json()) as { user: { displayName: string; emailAddress: string } }
    return { name: user.displayName, email: user.emailAddress.toLowerCase() }
  }

  // FlipTurn folders this coach can reach: ones the app created, or a shared
  // one they picked earlier. Returns null when there are none yet.
  async findTeamFolder(preferredId: string | null): Promise<string | null> {
    const folders = await this.list(`name = '${FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and trashed = false`)
    const folder = folders.find((f) => f.id === preferredId) ?? folders[0]
    return folder?.id ?? null
  }

  async createTeamFolder(data: AppData): Promise<string> {
    const response = await this.request(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
    })
    this.folderId = ((await response.json()) as { id: string }).id
    this.ownsFolder = true
    this.fileIds.clear()
    this.lastSeen.clear()
    this.lastBackup = null
    for (const name of Object.keys(FILES)) await this.writeFile(name, fileContents(data, name))
    for (const name of RESERVED_FILES) await this.writeFile(name, JSON.stringify({ version: 1 }))
    return this.folderId
  }

  // Opens a team folder and reports which data files FlipTurn can't see yet,
  // which happens when Google shares a picked folder without its contents.
  async openTeamFolder(folderId: string): Promise<string[]> {
    if (this.folderId !== folderId) {
      this.fileIds.clear()
      this.lastSeen.clear()
      this.lastBackup = null
    }
    this.folderId = folderId
    const meta = await this.request(`${API}/files/${folderId}?fields=ownedByMe`)
    this.ownsFolder = ((await meta.json()) as { ownedByMe: boolean }).ownedByMe
    await this.refreshFileIds()
    if (this.ownsFolder) {
      // Folders made by an earlier version may lack newer files; add them.
      for (const name of RESERVED_FILES) {
        if (!this.fileIds.has(name)) await this.writeFile(name, JSON.stringify({ version: 1 }))
      }
      return []
    }
    return [...Object.keys(FILES), ...RESERVED_FILES].filter((name) => !this.fileIds.has(name))
  }

  // Re-listed on every pull so files another coach created are picked up.
  private async refreshFileIds(): Promise<void> {
    for (const file of await this.list(`'${this.folderId}' in parents and trashed = false`)) {
      this.fileIds.set(file.name, file.id)
    }
  }

  async pull(): Promise<Partial<AppData>> {
    await this.refreshFileIds()
    const data: Partial<AppData> = {}
    for (const [name, collections] of Object.entries(FILES)) {
      const id = this.fileIds.get(name)
      if (!id) continue
      const response = await this.request(`${API}/files/${id}?alt=media`)
      const text = await response.text()
      this.lastSeen.set(name, text)
      const contents = JSON.parse(text) as Partial<AppData>
      for (const key of collections) {
        if (Array.isArray(contents[key])) Object.assign(data, { [key]: contents[key] })
      }
    }
    return data
  }

  // Merges with whatever another coach saved since our last pull, then writes
  // back only the files whose merged contents differ from what Drive holds.
  async push(local: AppData): Promise<AppData> {
    const merged = mergeData(local, await this.pull())
    for (const name of Object.keys(FILES)) {
      const body = fileContents(merged, name)
      if (!this.fileIds.has(name) && !this.ownsFolder) continue
      if (this.lastSeen.get(name) !== body) await this.writeFile(name, body)
    }
    await this.writeBackup(merged)
    return merged
  }

  // Keeps the read-only Google Sheet copy current. A failure here never stops
  // the sync itself; it's reported through backupError instead.
  async writeBackup(data: AppData): Promise<void> {
    const tables = backupTables(data)
    const signature = JSON.stringify(tables.filter((t) => t.name !== 'About'))
    if (signature === this.lastBackup) return
    const id = this.fileIds.get(BACKUP_NAME)
    // Only the owner creates it, like the other files; an assistant coach
    // updates it once they can see it.
    if (!id && !this.ownsFolder) return
    const xlsx = buildXlsx(tables) as Uint8Array<ArrayBuffer>
    try {
      if (id) {
        await this.request(`${UPLOAD}/files/${id}?uploadType=media`, {
          method: 'PATCH',
          headers: { 'Content-Type': XLSX_MIME },
          body: xlsx,
        })
      } else {
        const boundary = `flipturn${Math.random().toString(36).slice(2)}`
        const metadata = { name: BACKUP_NAME, parents: [this.folderId], mimeType: SHEET_MIME }
        const body = new Blob([
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
          `--${boundary}\r\nContent-Type: ${XLSX_MIME}\r\n\r\n`,
          xlsx,
          `\r\n--${boundary}--`,
        ])
        const response = await this.request(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body,
        })
        this.fileIds.set(BACKUP_NAME, ((await response.json()) as { id: string }).id)
      }
      this.lastBackup = signature
      this.backupError = null
    } catch (e) {
      this.backupError = (e as Error).message
    }
  }

  private async writeFile(name: string, body: string): Promise<void> {
    const id = this.fileIds.get(name)
    if (id) {
      await this.request(`${UPLOAD}/files/${id}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    } else {
      const boundary = `flipturn${Math.random().toString(36).slice(2)}`
      const metadata = { name, parents: [this.folderId], mimeType: 'application/json' }
      const multipart = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        'Content-Type: application/json',
        '',
        body,
        `--${boundary}--`,
      ].join('\r\n')
      const response = await this.request(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipart,
      })
      this.fileIds.set(name, ((await response.json()) as { id: string }).id)
    }
    this.lastSeen.set(name, body)
  }
}
