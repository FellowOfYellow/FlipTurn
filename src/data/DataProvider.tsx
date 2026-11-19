import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { DriveClient, DriveError } from './drive'
import { googleClientId, requestAccessToken, revokeToken, type AccessToken } from './google'
import { loadLocal, saveLocal } from './localStore'
import { mergeData, sameData } from './merge'
import type { AppData } from './types'

export type SyncStatus =
  | 'local-only' // no Google client ID configured yet
  | 'signed-out'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'error'

interface DataContextValue {
  data: AppData
  update: (change: (data: AppData) => AppData) => void
  status: SyncStatus
  error: string | null
  folderId: string | null
  signIn: () => Promise<void>
  signOut: () => void
}

const DataContext = createContext<DataContextValue | null>(null)

const SAVE_DELAY_MS = 1500
const SIGNED_IN_KEY = 'flipturn.signedIn'

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadLocal)
  const [status, setStatus] = useState<SyncStatus>(googleClientId ? 'signed-out' : 'local-only')
  const [error, setError] = useState<string | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)

  const dataRef = useRef(data)
  const tokenRef = useRef<AccessToken | null>(null)
  const driveRef = useRef<DriveClient | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const syncing = useRef(false)

  const applyMerged = useCallback((merged: AppData) => {
    if (sameData(merged, dataRef.current)) return
    dataRef.current = merged
    setData(merged)
    saveLocal(merged)
  }, [])

  const sync = useCallback(async () => {
    const drive = driveRef.current
    if (!drive || syncing.current) return
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
      const next = change(dataRef.current)
      dataRef.current = next
      setData(next)
      saveLocal(next)
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => void sync(), SAVE_DELAY_MS)
    },
    [sync],
  )

  const signIn = useCallback(async () => {
    setStatus('connecting')
    setError(null)
    try {
      const token = await requestAccessToken()
      tokenRef.current = token
      const drive = driveRef.current ?? new DriveClient(token.value)
      drive.setToken(token.value)
      driveRef.current = drive
      setFolderId(drive.folderId ?? (await drive.connect()))
      localStorage.setItem(SIGNED_IN_KEY, '1')
      applyMerged(mergeData(dataRef.current, await drive.pull()))
      await sync()
    } catch (e) {
      setStatus('signed-out')
      setError((e as Error).message)
    }
  }, [applyMerged, sync])

  const signOut = useCallback(() => {
    if (tokenRef.current) revokeToken(tokenRef.current.value)
    tokenRef.current = null
    driveRef.current = null
    setFolderId(null)
    localStorage.removeItem(SIGNED_IN_KEY)
    setStatus('signed-out')
  }, [])

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
    <DataContext.Provider value={{ data, update, status, error, folderId, signIn, signOut }}>
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
  try {
    return localStorage.getItem(SIGNED_IN_KEY) === '1'
  } catch {
    return false
  }
}
