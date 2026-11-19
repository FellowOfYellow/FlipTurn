import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveSwimmer } from './actions'
import { DriveClient, FILES, fileContents } from './drive'
import { BACKUP_NAME } from './sheetBackup'
import { emptyData } from './localStore'
import { withSwimmerDefaults } from './merge'

// A tiny in-memory Drive: one folder of named files, recording each upload.
function fakeDrive({ ownedByMe, files }: { ownedByMe: boolean; files: Record<string, string> }) {
  const store = new Map(Object.entries(files).map(([name, body], i) => [`id${i}`, { name, body }]))
  const uploads: string[] = []
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const u = new URL(url)
    const json = (body: unknown) => new Response(JSON.stringify(body))
    const text = init.body instanceof Blob ? await init.body.text() : String(init.body)
    if (u.pathname.endsWith('/files') && init.method === 'POST') {
      const id = `id${store.size}`
      const name = /"name":"([^"]+)"/.exec(text)![1]
      store.set(id, { name, body: '' })
      uploads.push(`create ${name}`)
      return json({ id })
    }
    if (u.pathname.endsWith('/files')) {
      return json({ files: [...store].map(([id, f]) => ({ id, name: f.name })) })
    }
    const id = u.pathname.split('/').pop()!
    if (init.method === 'PATCH') {
      store.get(id)!.body = text
      uploads.push(`update ${store.get(id)!.name}`)
      return json({})
    }
    if (u.searchParams.get('fields') === 'ownedByMe') return json({ ownedByMe })
    return new Response(store.get(id)!.body)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { uploads }
}

afterEach(() => vi.unstubAllGlobals())

function allFiles(data = emptyData()) {
  return {
    ...Object.fromEntries(Object.keys(FILES).map((name) => [name, fileContents(data, name)])),
    'competitions.json': '{"version":1}',
    'workouts.json': '{"version":1}',
    [BACKUP_NAME]: '',
  }
}

describe('DriveClient', () => {
  it('uploads only the files that changed', async () => {
    const { uploads } = fakeDrive({ ownedByMe: true, files: allFiles() })
    const drive = new DriveClient('token')
    expect(await drive.openTeamFolder('folder')).toEqual([])
    const local = saveSwimmer(withSwimmerDefaults({ id: 's1', updatedAt: 0, firstName: 'Ana', lastName: 'Lopez' }))(emptyData())
    await drive.push(local)
    expect(uploads).toEqual(['update swimmers.json', `update ${BACKUP_NAME}`])
    uploads.length = 0
    await drive.push(local)
    expect(uploads).toEqual([])
  })

  it("reports files an assistant coach can't see and never creates them", async () => {
    const files = allFiles()
    delete (files as Record<string, string>)['photos.json']
    const { uploads } = fakeDrive({ ownedByMe: false, files })
    const drive = new DriveClient('token')
    expect(await drive.openTeamFolder('folder')).toEqual(['photos.json'])
    await drive.push(emptyData())
    expect(uploads.some((u) => u.startsWith('create'))).toBe(false)
  })

  it('lets the owner add files that an older version did not create', async () => {
    const { uploads } = fakeDrive({ ownedByMe: true, files: { 'team.json': fileContents(emptyData(), 'team.json') } })
    const drive = new DriveClient('token')
    expect(await drive.openTeamFolder('folder')).toEqual([])
    await drive.push(emptyData())
    expect(uploads).toContain('create coaches.json')
    expect(uploads).toContain('create photos.json')
    expect(uploads).toContain('create workouts.json')
  })
  it('creates the backup sheet for the owner, and only rewrites it when data changes', async () => {
    const files = allFiles()
    delete (files as Record<string, string>)[BACKUP_NAME]
    const { uploads } = fakeDrive({ ownedByMe: true, files })
    const drive = new DriveClient('token')
    await drive.openTeamFolder('folder')
    await drive.push(emptyData())
    expect(uploads).toEqual([`create ${BACKUP_NAME}`])
    uploads.length = 0
    await drive.push(emptyData())
    expect(uploads).toEqual([])
    expect(drive.backupError).toBeNull()
  })

  it("never creates the backup sheet for an assistant coach", async () => {
    const files = allFiles()
    delete (files as Record<string, string>)[BACKUP_NAME]
    const { uploads } = fakeDrive({ ownedByMe: false, files })
    const drive = new DriveClient('token')
    await drive.openTeamFolder('folder')
    await drive.push(emptyData())
    expect(uploads).toEqual([])
  })
})
