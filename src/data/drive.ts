import { mergeData } from './merge'
import type { AppData, Collection } from './types'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
export const FOLDER_NAME = 'FlipTurn'

// Which collections live in which Drive file, matching the folder layout in
// the implementation plan.
const FILES: Record<string, Collection[]> = {
  'team.json': ['team', 'gear'],
  'swimmers.json': ['swimmers'],
  'gear-loans.json': ['loans'],
}

export class DriveError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export class DriveClient {
  private token: string
  folderId: string | null = null
  private fileIds = new Map<string, string>()

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
    const params = new URLSearchParams({ q: query, fields: 'files(id,name)', spaces: 'drive' })
    const response = await this.request(`${API}/files?${params}`)
    return ((await response.json()) as { files: { id: string; name: string }[] }).files
  }

  // Finds the FlipTurn folder this app created earlier, or creates it.
  async connect(): Promise<string> {
    const folders = await this.list(
      `name = '${FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    )
    if (folders.length > 0) {
      this.folderId = folders[0].id
    } else {
      const response = await this.request(`${API}/files?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
      })
      this.folderId = ((await response.json()) as { id: string }).id
    }
    return this.folderId
  }

  // Re-listed on every pull so files another coach created are picked up.
  private async refreshFileIds(): Promise<void> {
    for (const file of await this.list(`'${this.folderId}' in parents and trashed = false`)) {
      if (file.name in FILES) this.fileIds.set(file.name, file.id)
    }
  }

  async pull(): Promise<Partial<AppData>> {
    await this.refreshFileIds()
    const data: Partial<AppData> = {}
    for (const [name, collections] of Object.entries(FILES)) {
      const id = this.fileIds.get(name)
      if (!id) continue
      const response = await this.request(`${API}/files/${id}?alt=media`)
      const contents = (await response.json()) as Partial<AppData>
      for (const key of collections) {
        if (Array.isArray(contents[key])) Object.assign(data, { [key]: contents[key] })
      }
    }
    return data
  }

  // Merges with whatever another coach saved since our last pull, then writes
  // the merged copy back, so neither device overwrites the other's edits.
  async push(local: AppData): Promise<AppData> {
    const merged = mergeData(local, await this.pull())
    for (const [name, collections] of Object.entries(FILES)) {
      const contents = Object.fromEntries(collections.map((key) => [key, merged[key]]))
      await this.writeFile(name, JSON.stringify({ version: 1, ...contents }, null, 2))
    }
    return merged
  }

  private async writeFile(name: string, body: string): Promise<void> {
    const id = this.fileIds.get(name)
    if (id) {
      await this.request(`${UPLOAD}/files/${id}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      return
    }
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
}
