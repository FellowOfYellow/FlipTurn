import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { claimCoachProfile } from './actions'
import { DriveClient, DriveError, type DriveUser } from './drive'
import { googleClientId, requestAccessToken, revokeToken, type AccessToken } from './google'
import { clearLocal, emptyData, loadLocal, saveLocal } from './localStore'
import { mergeData, sameData } from './merge'
import { pickTeamFiles, pickTeamFolder } from './picker'
import type { AppData } from './types'

export type SyncStatus =
  | 'local-only' // no Google client ID configured yet
  | 'signed-out'
  | 'connecting'
  | 'choose-team' // signed in, but no FlipTurn folder yet: start one or join one
  | 'syncing'
  | 'synced'
  | 'error'

interface DataContextValue {
  data: AppData
  update: (change: (data: AppData) => AppData) => void
  status: SyncStatus
  error: string | null
  folderId: string | null
  user: DriveUser | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  forgetDevice: () => void
  startNewTeam: () => Promise<void>
  joinTeam: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

const SAVE_DELAY_MS = 1500
const SIGNED_IN_KEY = 'flipturn.signedIn'
const FOLDER_KEY = 'flipturn.folderId'
// The Google account whose team data is saved on this device. Data entered
// before anyone signed in has no owner and moves into the first account.
const OWNER_KEY = 'flipturn.owner'

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeKey(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage blocked; the coach just picks the folder again next time.
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadLocal)
  const [status, setStatus] = useState<SyncStatus>(googleClientId ? 'signed-out' : 'local-only')
  const [error, setError] = useState<string | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [user, setUser] = useState<DriveUser | null>(null)

  const dataRef = useRef(data)
  const tokenRef = useRef<AccessToken | null>(null)
  const driveRef = useRef<DriveClient | null>(null)
  const userRef = useRef<DriveUser | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const syncing = useRef(false)

  const replaceData = useCallback((next: AppData) => {
    dataRef.current = next
    setData(next)
    saveLocal(next)
  }, [])

  const applyMerged = useCallback(
    (merged: AppData) => {
      if (!sameData(merged, dataRef.current)) replaceData(merged)
    },
    [replaceData],
  )

  const sync = useCallback(async () => {
    const drive = driveRef.current
    if (!drive?.folderId || syncing.current) return
    if (tokenRef.current && tokenRef.current.expiresAt < Date.now() + 60_000) {
      // Token is about to expire; ask the coach to tap sign in again.
      setStatus('signed-out')
      return
    }
    syncing.current = true
    setStatus('syncing')
    try {
      applyMerged(await drive.push(dataRef.current))
      setStatus('synced')
      setError(null)
    } catch (e) {
      if (e instanceof DriveError && e.status === 401) {
        setStatus('signed-out')
      } else {
        setStatus('error')
        setError(navigator.onLine ? (e as Error).message : 'Offline. Changes are saved on this device and will sync later.')
      }
    } finally {
      syncing.current = false
    }
  }, [applyMerged])

  const update = useCallback(
    (change: (data: AppData) => AppData) => {
      replaceData(change(dataRef.current))
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => void sync(), SAVE_DELAY_MS)
    },
    [replaceData, sync],
  )

  // Once a team folder is open: load it, link this Google account to a coach
  // profile, and save.
  const finishConnecting = useCallback(
    async (folder: string, remote: Partial<AppData>, replaceLocal: boolean) => {
      writeKey(FOLDER_KEY, folder)
      setFolderId(folder)
      const base = replaceLocal ? emptyData() : dataRef.current
      const merged = mergeData(base, remote)
      replaceData(userRef.current ? claimCoachProfile(userRef.current)(merged) : merged)
      await sync()
    },
    [replaceData, sync],
  )

  const signIn = useCallback(async () => {
    setStatus('connecting')
    setError(null)
    try {
      const token = await requestAccessToken()
      tokenRef.current = token
      let drive = driveRef.current ?? new DriveClient(token.value)
      drive.setToken(token.value)
      const me = await drive.getUser()
      const owner = readKey(OWNER_KEY)
      if (owner && owner !== me.email) {
        // A different coach is signing in on this device. Start them from a
        // clean slate so the last account's team never reaches their Drive.
        window.clearTimeout(saveTimer.current)
        drive = new DriveClient(token.value)
        writeKey(FOLDER_KEY, null)
        clearLocal()
        replaceData(emptyData())
      }
      driveRef.current = drive
      writeKey(OWNER_KEY, me.email)
      userRef.current = me
      setUser(me)
      writeKey(SIGNED_IN_KEY, '1')

      const folder = drive.folderId ?? (await drive.findTeamFolder(readKey(FOLDER_KEY)))
      if (!folder) {
        setStatus('choose-team')
        return
      }
      const missing = await drive.openTeamFolder(folder)
      if (missing.length > 0) {
        setStatus('choose-team')
        setError('FlipTurn can see the team folder but not all of its files. Tap "Join a team" and select every file in the folder.')
        return
      }
      await finishConnecting(folder, await drive.pull(), false)
    } catch (e) {
      setStatus('signed-out')
      setError((e as Error).message)
    }
  }, [finishConnecting, replaceData])

  const startNewTeam = useCallback(async () => {
    const drive = driveRef.current
    if (!drive) return
    setStatus('connecting')
    setError(null)
    try {
      const withMe = userRef.current ? claimCoachProfile(userRef.current)(dataRef.current) : dataRef.current
      const folder = await drive.createTeamFolder(withMe)
      await finishConnecting(folder, {}, false)
    } catch (e) {
      setStatus('choose-team')
      setError((e as Error).message)
    }
  }, [finishConnecting])

  const joinTeam = useCallback(async () => {
    const drive = driveRef.current
    const token = tokenRef.current
    if (!drive || !token) return
    setError(null)
    try {
      const picked = await pickTeamFolder(token.value)
      if (!picked) return
      setStatus('connecting')
      let missing = await drive.openTeamFolder(picked.id)
      if (missing.length > 0) {
        await pickTeamFiles(token.value, picked.id)
        missing = await drive.openTeamFolder(picked.id)
      }
      if (missing.length > 0) {
        setStatus('choose-team')
        setError(`FlipTurn still can't open ${missing.join(', ')}. Try again and select every file in the folder.`)
        return
      }
      // Joining replaces whatever was on this device with the team's data.
      await finishConnecting(picked.id, await drive.pull(), true)
    } catch (e) {
      setStatus('choose-team')
      setError((e as Error).message)
    }
  }, [finishConnecting])

  // Signs out and removes the team's data from this device, so the next person
  // to use it can't see the roster.
  const forgetDevice = useCallback(() => {
    window.clearTimeout(saveTimer.current)
    if (tokenRef.current) revokeToken(tokenRef.current.value)
    tokenRef.current = null
    driveRef.current = null
    userRef.current = null
    setUser(null)
    setFolderId(null)
    setError(null)
    for (const key of [SIGNED_IN_KEY, FOLDER_KEY, OWNER_KEY]) writeKey(key, null)
    clearLocal()
    dataRef.current = emptyData()
    setData(dataRef.current)
    setStatus('signed-out')
  }, [])

  // Saves any last changes to Drive first. If that fails, the coach stays signed
  // in so nothing is lost; forgetDevice skips the save.
  const signOut = useCallback(async () => {
    const drive = driveRef.current
    const token = tokenRef.current
    window.clearTimeout(saveTimer.current)
    if (drive?.folderId && token && !syncing.current) {
      syncing.current = true
      setStatus('syncing')
      try {
        await drive.push(dataRef.current)
      } catch {
        setStatus('error')
        setError("Couldn't save your latest changes to Google Drive, so you're still signed in. Check your connection and try again.")
        return
      } finally {
        syncing.current = false
      }
    } else if (syncing.current) {
      setError('Still saving. Try signing out again in a moment.')
      return
    }
    forgetDevice()
  }, [forgetDevice])

  // Pick up other coaches' edits when the app comes back to the foreground.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [sync])

  return (
    <DataContext.Provider
      value={{ data, update, status, error, folderId, user, signIn, signOut, forgetDevice, startNewTeam, joinTeam }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData(): DataContextValue {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used inside DataProvider')
  return value
}

export function wasSignedIn(): boolean {
  return readKey(SIGNED_IN_KEY) === '1'
}
