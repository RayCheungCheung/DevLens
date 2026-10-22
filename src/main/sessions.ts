import { BrowserWindow, dialog, session, shell, type Session } from 'electron'
import type { CookieRecord, GhostSessionState, SessionProfileId, PermissionEntry } from '../shared/types'
import type { ProtectionPolicy } from '../shared/protection'
import { trackedHostTier } from './tracker-list'
import { WIMH_PARTITION, isWimhActive } from './wimh'
import { forcesTrackerBlocking } from './mode'
import { currentProtection, protectionBlocksUrl } from './protection'
import { activeProfilePartition } from './profiles'
import { isPrivateTabPartition } from '../shared/private-tab'
import { desktopChromeUserAgent } from './user-agent'
import { clearBrowserFingerprint, rotateBrowserFingerprint } from './fingerprint'

/**
 * Session profiles.
 *
 * - `standard`: the persistent partition both viewports normally share.
 * - `ghost`: an in-memory partition (no `persist:` prefix, cache off) with trackers blocked
 *   and storage wiped on entry and exit. Cookies and history cannot outlive the session
 *   because nothing is written to disk.
 * - `sandbox`: an even stricter partition used by the `:sandbox` window, which loads the
 *   target directly with no preload, no bridge and no downloads.
 */
export const GHOST_PARTITION = 'devlens-ghost'
export const SANDBOX_PARTITION = 'devlens-sandbox'
const hardenedSessions = new WeakSet<Session>()

let ghostState: GhostSessionState = {
  active: false,
  partition: GHOST_PARTITION,
  blockedRequests: 0,
  enteredAt: null
}

let blockTrackers = true
let notify: (state: GhostSessionState) => void = () => {}

export function configureSessions(block: boolean, listener: (state: GhostSessionState) => void): void {
  blockTrackers = block
  notify = listener
}

export function ghostStateNow(): GhostSessionState {
  return { ...ghostState }
}

export function isGhostActive(): boolean {
  return ghostState.active
}

export function shouldBlockTrackers(): boolean {
  // Extreme defense gets the blocklist on top of its own isolation, and normal mode keeps it
  // on because "max privacy" should not depend on remembering to open a panel. A protection
  // level above Standard turns it on for dev mode too, which is the point of the dial.
  return (
    blockTrackers &&
    (ghostState.active || isWimhActive() || forcesTrackerBlocking() || currentProtection() !== 'standard')
  )
}

/**
 * True when a URL belongs to a host on the base tracker list.
 *
 * Kept for the sessions' own hardening code; the request pipeline asks the protection engine
 * instead, because only it knows which tier the active level wants.
 */
export function isTrackerUrl(url: string): boolean {
  try {
    return trackedHostTier(new URL(url).host) !== null
  } catch {
    return false
  }
}

/**
 * The decision the request pipeline makes: should this URL be cancelled before it goes out?
 *
 * Ghost and extreme sessions always block; otherwise the protection level decides which tiers
 * are in play. Both cases end up in the same place, which is the point - one switch, one rule.
 *
 * A session that carries its own policy (a private tab) passes it in. That policy is not a dial
 * position: the window's level cannot lower it, and the normal-mode capability table - which
 * exists to keep *monitoring* out of normal mode - does not apply to a privacy feature the
 * operator asked for on purpose.
 */
export function shouldCancelTrackingUrl(
  url: string,
  documentUrl?: string | null,
  policy?: ProtectionPolicy
): boolean {
  if (policy) return protectionBlocksUrl(url, documentUrl ?? null, policy)
  if (!shouldBlockTrackers()) return false
  return protectionBlocksUrl(url, documentUrl)
}

/**
 * The session the viewports are running on right now.
 *
 * Mirrors the renderer's partition choice - extreme defense wins, then ghost, then the active
 * profile - so a per-site action lands in the session the page is actually using.
 *
 * A private tab is the exception the caller has to name: its partition belongs to that tab
 * alone, so `partition` is passed in rather than derived from window-wide state.
 */
export function activeViewportSession(partition?: string | null): Session {
  if (partition) {
    if (!isKnownViewportPartition(partition)) {
      throw new Error('That session partition is not owned by a DevLens web view.')
    }
    // Persistent partitions keep their cache; the in-memory ones (ghost, defense, private) do not.
    return session.fromPartition(partition, { cache: partition.startsWith('persist:') })
  }
  if (isWimhActive()) return session.fromPartition(WIMH_PARTITION, { cache: false })
  if (ghostState.active) return session.fromPartition(GHOST_PARTITION, { cache: false })
  return session.fromPartition(activeProfilePartition(), { cache: true })
}

function isKnownViewportPartition(partition: string): boolean {
  if (partition.length === 0 || partition.length > 160) return false
  return (
    partition === activeProfilePartition() ||
    partition === GHOST_PARTITION ||
    partition === WIMH_PARTITION ||
    isPrivateTabPartition(partition)
  )
}

/**
 * Clears one site's cookies and storage, leaving every other origin alone.
 *
 * This is the "forget this site" action in the site panel: the same partitions keep working, the
 * operator stays logged in everywhere else, and nothing outside that origin is touched.
 */
export async function clearSiteData(
  url: string,
  /** The partition the page is actually on; omit for the window's own session. */
  partition?: string | null
): Promise<{ ok: boolean; cleared: string[]; origin: string; error: string | null }> {
  let origin = ''
  try {
    origin = new URL(url).origin
  } catch {
    return { ok: false, cleared: [], origin: '', error: 'that address has no origin to clear' }
  }
  if (origin === 'null' || origin.startsWith('file:')) {
    return { ok: false, cleared: [], origin, error: 'only web origins hold site data' }
  }

  try {
    const ses = activeViewportSession(partition)
    const cleared = ['cookies', 'storage']
    await ses.clearStorageData({
      origin,
      storages: [
        'cookies',
        'filesystem',
        'indexdb',
        'localstorage',
        'shadercache',
        'serviceworkers',
        'cachestorage'
      ]
    })
    return { ok: true, cleared, origin, error: null }
  } catch (error) {
    return {
      ok: false,
      cleared: [],
      origin,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/** Clears HTTP cache without touching cookies, auth or site storage. */
export async function clearViewportCache(
  partition?: string | null
): Promise<{ ok: boolean; error: string | null }> {
  try {
    await activeViewportSession(partition).clearCache()
    return { ok: true, error: null }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export function noteGhostBlocked(): GhostSessionState {
  ghostState = { ...ghostState, blockedRequests: ghostState.blockedRequests + 1 }
  notify(ghostState)
  return ghostState
}

/**
 * The cookies one origin holds, read from the session the page is actually on.
 *
 * A cookie belongs to a session rather than to a document, so the renderer cannot see it and the
 * guest could only see its own http-only-less half: this is a main-process question, and the
 * partition is passed in because a profile, a ghost session and a private tab each have their own.
 * Values are truncated - the inspector needs to recognise a cookie, not to become a token store.
 */
export async function listCookies(url: string, partition?: string | null): Promise<CookieRecord[]> {
  const ses = activeViewportSession(partition)
  const cookies = await ses.cookies.get({ url })
  return cookies.map((cookie) => ({
    name: cookie.name,
    value: (cookie.value ?? '').slice(0, 300),
    domain: cookie.domain ?? '',
    path: cookie.path ?? '/',
    secure: cookie.secure === true,
    httpOnly: cookie.httpOnly === true,
    session: cookie.session === true,
    expires: typeof cookie.expirationDate === 'number' ? cookie.expirationDate : null,
    sameSite: cookie.sameSite ?? 'unspecified'
  }))
}

/** Forgets one cookie by name, in the session that holds it. */
export async function removeCookie(input: {
  url: string
  name: string
  partition?: string | null
}): Promise<boolean> {
  const ses = activeViewportSession(input.partition)
  await ses.cookies.remove(input.url, input.name)
  return true
}

/**
 * Hardens a session: no permissions, no downloads, no popups. Applied to the ghost and
 * sandbox profiles where "the page asked for something" should never be granted silently.
 */
export function hardenSession(ses: Session, label: string): void {
  ses.setUserAgent(desktopChromeUserAgent())
  if (hardenedSessions.has(ses)) return
  hardenedSessions.add(ses)
  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
  ses.setDevicePermissionHandler(() => false)
  /**
   * Every request on this partition carries a Chrome UA, including the ones a popup makes.
   *
   * Setting it on the session (rather than per `webContents`) is what makes an OAuth flow work:
   * the provider's page, the consent frame and the redirect back to the site are three different
   * `webContents`, and a per-view UA reaches only the first. `app.userAgentFallback` covers the
   * sessions this function does not touch; this covers the ones it does, explicitly.
   */
  ses.on('will-download', (event) => {
    event.preventDefault()
    console.info(`[devlens] ${label} blocked a download`)
  })
}

/**
 * Safe-by-default permission policy for the ordinary browsing session.
 *
 * Electron must never be left to imply consent for camera, microphone, location,
 * notifications, clipboard reads or hardware devices. Harmless capabilities are granted
 * immediately; the rest need an explicit native confirmation naming the origin, and the
 * device protocols that are hardest to audit stay denied.
 */
const grantedPermissions = new WeakMap<Session, Set<string>>()
const pendingPermissionPrompts = new WeakMap<Session, Set<string>>()

export function guardStandardPermissions(ses: Session): void {
  const granted = grantedPermissions.get(ses) ?? new Set<string>()
  const pending = pendingPermissionPrompts.get(ses) ?? new Set<string>()
  grantedPermissions.set(ses, granted)
  pendingPermissionPrompts.set(ses, pending)

  ses.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    const origin = normalizePermissionOrigin(requestingOrigin)
    return Boolean(
      origin &&
      (AUTOMATIC_PERMISSIONS.has(permission) || granted.has(permissionKey(origin, permission)))
    )
  })

  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    const origin = normalizePermissionOrigin(details.requestingUrl)
    if (!origin || contents.isDestroyed() || !ASKED_PERMISSIONS.has(permission)) {
      callback(false)
      return
    }
    if (AUTOMATIC_PERMISSIONS.has(permission)) {
      callback(true)
      return
    }

    const key = permissionKey(origin, permission)
    if (granted.has(key) || pending.has(key)) {
      callback(granted.has(key))
      return
    }
    pending.add(key)
    const owner = BrowserWindow.fromWebContents(contents.hostWebContents ?? contents)
    const options: Electron.MessageBoxOptions = {
      type: 'question',
      title: 'Allow site permission?',
      message: `Allow “${permission}” for ${origin}?`,
      detail:
        'Only allow this when you trust the site and are actively testing that capability. ' +
        'The grant lasts until DevLens closes.',
      buttons: ['Block', 'Allow'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    }
    const prompt = owner
      ? dialog.showMessageBox(owner, options)
      : dialog.showMessageBox(options)
    void prompt
      .then((result) => {
        const allowed = result.response === 1
        if (allowed && granted.size < 200) granted.add(key)
        if (!contents.isDestroyed()) callback(allowed)
      })
      .catch(() => {
        if (!contents.isDestroyed()) callback(false)
      })
      .finally(() => pending.delete(key))
  })

  // HID, serial, USB and file-system-access requests remain unavailable in the standard
  // browser surface even if a related Electron permission string is added in a future version.
  ses.setDevicePermissionHandler(() => false)
}

const AUTOMATIC_PERMISSIONS = new Set([
  'fullscreen',
  'clipboard-sanitized-write'
])

const ASKED_PERMISSIONS = new Set([
  ...AUTOMATIC_PERMISSIONS,
  'media',
  'geolocation',
  'notifications',
  'clipboard-read',
  'pointerLock',
  'keyboardLock',
  'idle-detection'
])

function permissionKey(origin: string, permission: string): string {
  return `${origin}\u0000${permission}`
}

function normalizePermissionOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

/**
 * Query browser permissions for a given origin.
 *
 * Returns the permission entries tracked by guardStandardPermissions,
 * plus the standard set of known permissions with their current state.
 */
export function querySitePermissions(url: string): PermissionEntry[] {
  const origin = normalizePermissionOrigin(url)
  if (!origin) return []

  // Map Electron permission strings to user-friendly labels
  const PERMISSION_LABELS: Record<string, string> = {
    'media': 'Camera & Microphone',
    'geolocation': 'Location',
    'notifications': 'Notifications',
    'clipboard-read': 'Clipboard Read',
    'pointerLock': 'Pointer Lock',
    'keyboardLock': 'Keyboard Lock',
    'idle-detection': 'Idle Detection',
    'fullscreen': 'Fullscreen',
    'clipboard-sanitized-write': 'Clipboard Write'
  }

  // Find the session for this URL and query granted permissions
  const ses = activeViewportSession()
  const granted = grantedPermissions.get(ses) ?? new Set<string>()

  // Build entries for all tracked permissions
  const results: PermissionEntry[] = []
  for (const perm of ASKED_PERMISSIONS) {
    const key = permissionKey(origin, perm)
    const isGranted = granted.has(key) || AUTOMATIC_PERMISSIONS.has(perm)
    results.push({
      permission: perm,
      granted: isGranted,
      label: PERMISSION_LABELS[perm] ?? perm
    })
  }

  return results
}

export async function enterGhost(): Promise<GhostSessionState> {
  const ses = session.fromPartition(GHOST_PARTITION, { cache: false })
  hardenSession(ses, 'ghost mode')
  await ses.clearStorageData()
  await ses.clearCache()
  rotateBrowserFingerprint(ses, 'ghost')
  ghostState = {
    active: true,
    partition: GHOST_PARTITION,
    blockedRequests: 0,
    enteredAt: Date.now()
  }
  notify(ghostState)
  return ghostStateNow()
}

export async function exitGhost(): Promise<GhostSessionState> {
  const ses = session.fromPartition(GHOST_PARTITION, { cache: false })
  clearBrowserFingerprint(ses)
  await ses.clearStorageData()
  await ses.clearCache()
  ghostState = { active: false, partition: GHOST_PARTITION, blockedRequests: 0, enteredAt: null }
  notify(ghostState)
  return ghostStateNow()
}

/**
 * Wipes cache/storage/auth for one profile; used by `:clear-cache`.
 *
 * A private tab passes its own partition, because `private` names a *kind* of session rather
 * than one fixed one - there is a partition per tab. The partition is checked against the
 * private prefix before it is cleared, so a bad id can never turn "clear this tab's cache" into
 * "clear whatever partition this string happens to name".
 */
export async function clearProfileData(
  profile: SessionProfileId | 'sandbox',
  /** The partition of the profile that is actually mounted, for `standard`. */
  activePartition?: string
): Promise<string[]> {
  const partition =
    profile === 'ghost'
      ? GHOST_PARTITION
      : profile === 'wimh'
        ? 'devlens-wimh'
        : profile === 'sandbox'
          ? SANDBOX_PARTITION
          : profile === 'private'
            ? (activePartition && isPrivateTabPartition(activePartition) ? activePartition : null)
            : (activePartition ?? null)
  if (profile === 'private' && !partition) return []
  // In-memory partitions must keep cache disabled; persistent ones keep their cache.
  const ses = partition
    ? session.fromPartition(partition, { cache: partition.startsWith('persist:') })
    : session.defaultSession
  await ses.clearStorageData()
  await ses.clearCache()
  await ses.clearAuthCache()
  return ['cache', 'cookies', 'storage', 'auth']
}

/**
 * Opens the target in a bare, isolated window.
 *
 * There is no preload and no bridge in here: the window is just Chromium with a hardened,
 * in-memory session, which is exactly what makes it a useful place to look at something
 * suspicious without letting it near the DevLens session.
 */
export function openSandboxWindow(
  url: string,
  parent?: BrowserWindow | null,
  options?: { preview?: boolean }
): { ok: boolean; error: string | null } {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { ok: false, error: `The sandbox only opens http(s) targets, got ${parsed.protocol}` }
    }

    const ses = session.fromPartition(SANDBOX_PARTITION, { cache: false })
    hardenSession(ses, 'sandbox')

    const window = new BrowserWindow({
      width: options?.preview ? 720 : 1180,
      height: options?.preview ? 540 : 820,
      backgroundColor: '#0b0d10',
      autoHideMenuBar: true,
      title: `${options?.preview ? 'Link preview' : 'DevLens sandbox'} - ${parsed.host}`,
      ...(parent ? { parent } : {}),
      webPreferences: {
        partition: SANDBOX_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webviewTag: false,
        webSecurity: true,
        spellcheck: false
      }
    })

    window.webContents.setWindowOpenHandler(({ url: target }) => {
      if (target.startsWith('http:') || target.startsWith('https:')) void shell.openExternal(target)
      return { action: 'deny' }
    })
    window.webContents.on('will-navigate', (event, target) => {
      if (!/^https?:/i.test(target)) event.preventDefault()
    })

    void window.loadURL(parsed.toString())
    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
