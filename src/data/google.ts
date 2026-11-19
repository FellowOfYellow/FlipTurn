// Google sign-in through Google Identity Services. FlipTurn asks only for the
// drive.file scope: it can see files it created or that the coach picks.

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

// Preview builds run inside a sandboxed frame where Google's sign-in popup can't open.
export const googleClientId = import.meta.env.VITE_PREVIEW ? '' : (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '')

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
  window.google?.accounts.oauth2.revoke(token)
}
