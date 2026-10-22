import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { app, safeStorage } from 'electron'
import type { ResolvedGoogleOAuthConfig } from '../shared/config'
import type {
  GoogleOAuthStartResult,
  GoogleOAuthStatus
} from '../shared/types'
import { openExternalBrowser } from './external-browser'

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const CALLBACK_HOST = 'auth-callback'
const FLOW_TTL_MS = 10 * 60 * 1000

interface StoredTokens {
  accessToken: string
  refreshToken: string | null
  idToken: string | null
  tokenType: string
  expiresAt: number
  scope: string
}

interface PendingFlow {
  state: string
  verifier: string
  redirectUri: string
  createdAt: number
}

let config: ResolvedGoogleOAuthConfig = {
  clientId: '',
  redirectUri: 'devlens://auth-callback',
  scopes: ['openid', 'email', 'profile']
}
let tokens: StoredTokens | null = null
let pending: PendingFlow | null = null
let lastError: string | null = null
let onChanged: (status: GoogleOAuthStatus) => void = () => {}

export function registerGoogleOAuthProtocol(): boolean {
  if (process.defaultApp && process.argv[1]) {
    return app.setAsDefaultProtocolClient('devlens', process.execPath, [
      resolve(process.argv[1])
    ])
  }
  return app.setAsDefaultProtocolClient('devlens')
}

export function configureGoogleOAuth(input: {
  config: ResolvedGoogleOAuthConfig
  onChanged: (status: GoogleOAuthStatus) => void
}): void {
  config = input.config
  onChanged = input.onChanged
  tokens = loadTokens()
}

export function googleOAuthStatus(): GoogleOAuthStatus {
  const claims = tokens?.idToken ? idTokenClaims(tokens.idToken) : null
  const storage = tokens
    ? safeStorage.isEncryptionAvailable()
      ? 'encrypted'
      : 'memory'
    : 'none'
  return {
    configured: Boolean(config.clientId && config.redirectUri),
    signedIn: Boolean(tokens?.accessToken),
    email: stringClaim(claims, 'email'),
    name: stringClaim(claims, 'name'),
    expiresAt: tokens?.expiresAt ?? null,
    scopes: tokens?.scope
      ? tokens.scope.split(/\s+/).filter(Boolean)
      : [...config.scopes],
    redirectUri: config.redirectUri,
    storage,
    error: lastError
  }
}

export async function startGoogleOAuth(): Promise<GoogleOAuthStartResult> {
  if (!config.clientId) {
    lastError =
      'Set oauth.google.clientId in devlens.config.json or DEVLENS_GOOGLE_CLIENT_ID.'
    notify()
    return { ok: false, error: lastError }
  }
  if (!isGoogleCallback(config.redirectUri)) {
    lastError = 'The Google OAuth redirect URI must be exactly devlens://auth-callback.'
    notify()
    return { ok: false, error: lastError }
  }

  const verifier = base64Url(randomBytes(48))
  const challenge = base64Url(createHash('sha256').update(verifier).digest())
  const state = base64Url(randomBytes(32))
  pending = {
    state,
    verifier,
    redirectUri: config.redirectUri,
    createdAt: Date.now()
  }
  lastError = null
  notify()

  const url = new URL(AUTHORIZATION_ENDPOINT)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', config.scopes.join(' '))
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('prompt', 'select_account')

  if (!(await openExternalBrowser(url.toString()))) {
    pending = null
    lastError = 'No system browser accepted the Google authorization request.'
    notify()
    return { ok: false, error: lastError }
  }
  return { ok: true, error: null }
}

/** Handles both cold-start arguments and the second-instance/open-url callback. */
export async function handleGoogleOAuthUrl(value: string): Promise<boolean> {
  let callback: URL
  try {
    callback = new URL(value)
  } catch {
    return false
  }
  if (callback.protocol !== 'devlens:' || callback.hostname !== CALLBACK_HOST) return false

  if (callback.searchParams.has('error')) {
    lastError =
      callback.searchParams.get('error_description') ??
      callback.searchParams.get('error') ??
      'Google authorization was cancelled.'
    pending = null
    notify()
    return true
  }

  const code = callback.searchParams.get('code')
  const state = callback.searchParams.get('state')
  if (!pending || Date.now() - pending.createdAt > FLOW_TTL_MS) {
    lastError = 'The Google authorization flow expired. Start sign-in again.'
    pending = null
    notify()
    return true
  }
  if (!code || !state || state !== pending.state) {
    lastError = 'Google returned an invalid authorization callback.'
    pending = null
    notify()
    return true
  }

  const flow = pending
  pending = null
  try {
    const body = new URLSearchParams({
      client_id: config.clientId,
      code,
      code_verifier: flow.verifier,
      grant_type: 'authorization_code',
      redirect_uri: flow.redirectUri
    })
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(15_000)
    })
    const payload = (await response.json()) as Record<string, unknown>
    if (!response.ok || typeof payload.access_token !== 'string') {
      throw new Error(
        typeof payload.error_description === 'string'
          ? payload.error_description
          : `Google token exchange failed with ${response.status}.`
      )
    }

    const expiresIn = Number(payload.expires_in)
    tokens = {
      accessToken: payload.access_token,
      refreshToken:
        typeof payload.refresh_token === 'string'
          ? payload.refresh_token
          : tokens?.refreshToken ?? null,
      idToken: typeof payload.id_token === 'string' ? payload.id_token : null,
      tokenType: typeof payload.token_type === 'string' ? payload.token_type : 'Bearer',
      expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
      scope:
        typeof payload.scope === 'string'
          ? payload.scope
          : config.scopes.join(' ')
    }
    persistTokens(tokens)
    lastError = null
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error)
  }
  notify()
  return true
}

export function signOutGoogle(): GoogleOAuthStatus {
  tokens = null
  pending = null
  lastError = null
  try {
    const file = tokenFile()
    if (existsSync(file)) unlinkSync(file)
  } catch {
    // The in-memory token is already gone; a locked file can be replaced next time.
  }
  notify()
  return googleOAuthStatus()
}

/** Finds the first devlens:// URL in a Windows/Linux process argument list. */
export function googleOAuthUrlFromArguments(args: readonly string[]): string | null {
  return args.find((argument) => /^devlens:\/\/auth-callback(?:[/?#]|$)/i.test(argument)) ?? null
}

function base64Url(value: Buffer): string {
  return value.toString('base64url')
}

function isGoogleCallback(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'devlens:' &&
      url.hostname === CALLBACK_HOST &&
      !url.username &&
      !url.password &&
      (url.pathname === '' || url.pathname === '/') &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}

function tokenFile(): string {
  return join(app.getPath('userData'), 'oauth', 'google-token.bin')
}

function persistTokens(value: StoredTokens): void {
  if (!safeStorage.isEncryptionAvailable()) return
  const file = tokenFile()
  mkdirSync(dirname(file), { recursive: true })
  const temp = `${file}.tmp`
  writeFileSync(temp, safeStorage.encryptString(JSON.stringify(value)), {
    mode: 0o600
  })
  renameSync(temp, file)
}

function loadTokens(): StoredTokens | null {
  if (!safeStorage.isEncryptionAvailable()) return null
  const file = tokenFile()
  if (!existsSync(file)) return null
  try {
    const parsed = JSON.parse(safeStorage.decryptString(readFileSync(file))) as StoredTokens
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      typeof parsed.scope !== 'string'
    ) {
      return null
    }
    return parsed
  } catch {
    lastError = 'The saved Google login could not be decrypted.'
    return null
  }
}

function idTokenClaims(idToken: string): Record<string, unknown> | null {
  try {
    const payload = idToken.split('.')[1]
    if (!payload) return null
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >
  } catch {
    return null
  }
}

function stringClaim(
  claims: Record<string, unknown> | null,
  key: string
): string | null {
  const value = claims?.[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function notify(): void {
  onChanged(googleOAuthStatus())
}
