// Google sign-in. On the website it uses Google Identity Services; in the iOS
// app it uses Google's native sign-in, because Google blocks its web sign-in
// inside apps. FlipTurn asks only for the drive.file scope: it can see files it
// created or that the coach picks.

import { Capacitor } from '@capacitor/core'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}

interface TokenClient {
  requestAccessToken(options?: { prompt?: string; login_hint?: string }): void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (response: TokenResponse) => void
            error_callback?: (error: { type: string }) => void
          }): TokenClient
          revoke(token: string, done?: () => void): void
        }
      }
    }
  }
}

export const isNativeApp = Capacitor.isNativePlatform()
const iosClientId = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID ?? ''

// Preview builds run inside a sandboxed frame where Google's sign-in popup can't
// open. Empty means sign-in isn't set up, and the app stays on this device only.
export const googleClientId = import.meta.env.VITE_PREVIEW
  ? ''
  : isNativeApp
    ? iosClientId
    : (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '')

let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Could not load Google sign-in. Check your connection.'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export interface AccessToken {
  value: string
  expiresAt: number
}

// Opens Google's consent popup (or reuses an earlier consent) and returns a
// one-hour access token. Must be called from a tap or click.
export async function requestAccessToken(): Promise<AccessToken> {
  if (isNativeApp) return requestNativeToken()
  await loadScript()
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? 'Google sign-in failed.'))
          return
        }
        resolve({
          value: response.access_token,
          expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
        })
      },
      error_callback: (error) =>
        reject(new Error(error.type === 'popup_closed' ? 'Sign-in was cancelled.' : 'Google sign-in failed.')),
    })
    client.requestAccessToken({ prompt: '' })
  })
}

export function revokeToken(token: string): void {
  if (isNativeApp) {
    void import('@capgo/capacitor-social-login').then(({ SocialLogin }) => SocialLogin.logout({ provider: 'google' }))
    return
  }
  window.google?.accounts.oauth2.revoke(token)
}

let nativeReady: Promise<typeof import('@capgo/capacitor-social-login').SocialLogin> | null = null

function nativeLogin() {
  nativeReady ??= import('@capgo/capacitor-social-login').then(async ({ SocialLogin }) => {
    await SocialLogin.initialize({ google: { iOSClientId: iosClientId, mode: 'online' } })
    return SocialLogin
  })
  return nativeReady
}

async function requestNativeToken(): Promise<AccessToken> {
  const SocialLogin = await nativeLogin()
  const { result } = await SocialLogin.login({ provider: 'google', options: { scopes: [SCOPE] } })
  if (!('accessToken' in result) || !result.accessToken?.token) throw new Error('Google sign-in failed.')
  const expires = result.accessToken.expires ? Date.parse(result.accessToken.expires) : NaN
  return {
    value: result.accessToken.token,
    // Refresh a little early; Google's tokens last an hour.
    expiresAt: Number.isFinite(expires) ? expires : Date.now() + 55 * 60 * 1000,
  }
}
