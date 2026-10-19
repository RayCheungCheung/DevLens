import { BrowserWindow, session, shell, type Session } from 'electron'
import {
  privateTabPartition,
  privateTabPolicy,
  PRIVATE_TAB_LEVEL,
  type PrivateTabState
} from '../shared/private-tab'
import { hardenSession } from './sessions'
import { enforceRamOnly } from './wimh'
import { attachDownloadSession, cleanupPrivateDownloadHistory } from './downloads'

/**
 * Private tab sessions.
 *
 * One in-memory partition per tab, created when the tab opens and wiped when it closes. The
 * registry is the main process's record that a tab is running at maximum protection: the
 * renderer drives the picture, but the *session* - the part that decides whether a tracker
 * leaves the machine - is owned here.
 *
 * Why the tab id is the key rather than the guest id: the guest is recreated on every
 * navigation and frame remount, while the partition has to outlive all of that to stay the same
 * session. The renderer's tab is the thing the operator opens and closes, so it is the thing
 * the session is bound to.
 *
 * The request pipeline is attached through `instrument`, injected at boot, because the
 * interceptor already knows how to harden a session and this module should not depend on it -
 * the counters it needs back are the only part that has to travel, and they travel as calls.
 */

export interface PrivateTabDeps {
  /** Wires the request pipeline onto a private tab's own session, with its fixed policy. */
  instrument: (ses: Session, tabId: string) => void
  /** Lets the shell repaint its chips and its pill. */
  onChanged: (tabs: PrivateTabState[]) => void
}

const tabs = new Map<string, PrivateTabState>()

let deps: PrivateTabDeps = { instrument: () => {}, onChanged: () => {} }

export function configurePrivateTabs(next: PrivateTabDeps): void {
  deps = next
}

/** A copy, so a caller cannot reach into the registry through the object it was given. */
function clone(state: PrivateTabState): PrivateTabState {
  return { ...state, policy: { ...state.policy } }
}

export function privateTabsNow(): PrivateTabState[] {
  return [...tabs.values()].map(clone)
}

export function privateTabNow(tabId: string): PrivateTabState | null {
  const state = tabs.get(tabId)
  return state ? clone(state) : null
}

export function isPrivateTabOpen(tabId: string): boolean {
  return tabs.has(tabId)
}

/**
 * Opens (or re-opens) one private tab.
 *
 * The session starts empty on purpose: clearing before the first request means a tab that is
 * closed and reopened cannot inherit a cookie from the tab that used the same id earlier in the
 * session. Downloads and permissions are refused outright, and the RAM-only guards turn the
 * spellchecker off and refuse screen capture.
 *
 * The cookie *downgrade* the defense session performs is deliberately not repeated here: it
 * exists to stop a page parking a token on a session that outlives the tab, and this partition
 * cannot outlive the tab - it has no `persist:` prefix, so even a cookie with an expiry date is
 * only ever in memory, and `closePrivateTab` empties it anyway. The partition is the guarantee.
 */
export async function openPrivateTab(tabId: string): Promise<PrivateTabState> {
  const existing = tabs.get(tabId)
  if (existing) return clone(existing)

  const partition = privateTabPartition(tabId)
  const ses = session.fromPartition(partition, { cache: false })
  hardenSession(ses, `private tab ${tabId}`)
  attachDownloadSession(ses, true)
  enforceRamOnly(ses)
  deps.instrument(ses, tabId)

  await ses.clearStorageData()
  await ses.clearCache()
  await ses.clearAuthCache()

  const state: PrivateTabState = {
    tabId,
    partition,
    level: PRIVATE_TAB_LEVEL,
    policy: privateTabPolicy(),
    enteredAt: Date.now(),
    blockedRequests: 0,
    scrubbedHeaders: 0,
    historyBlocked: 0,
    wipedAt: null
  }
  tabs.set(tabId, state)
  deps.onChanged(privateTabsNow())
  return clone(state)
}

/**
 * Closes one private tab and destroys everything it kept in memory.
 *
 * Chromium cannot unload a session object, so "destroyed" means every store behind it is
 * emptied and the partition is no longer reachable: cookies, local storage, IndexedDB, service
 * workers, cache storage, the code cache, the HTTP cache and the auth cache. Because the
 * partition is in-memory in the first place, there is no disk copy left to argue about.
 */
export async function closePrivateTab(tabId: string): Promise<PrivateTabState | null> {
  const state = tabs.get(tabId)
  if (!state) return null

  tabs.delete(tabId)
  const ses = session.fromPartition(state.partition, { cache: false })
  await cleanupPrivateDownloadHistory(ses)
  await wipePrivateSession(ses)
  deps.onChanged(privateTabsNow())
  return { ...clone(state), wipedAt: Date.now() }
}

/** Empties every store the private session owns. Shared with the `:clear-cache` path. */
export async function wipePrivateSession(ses: Session): Promise<string[]> {
  const cleared: string[] = []
  try {
    await ses.clearStorageData()
    cleared.push('storage')
  } catch {
    /* a session with nothing to clear is not a failure */
  }
  await ses.clearCache().then(
    () => cleared.push('cache'),
    () => undefined
  )
  await ses.clearAuthCache().then(
    () => cleared.push('auth'),
    () => undefined
  )
  // Host lookups are memory too, and a lookup is a record of where the tab went.
  await ses.clearHostResolverCache().then(
    () => cleared.push('dns'),
    () => undefined
  )
  return cleared
}

/* ------------------------------------------------------------------ *
 * Counters the request pipeline reports back
 * ------------------------------------------------------------------ */

export function notePrivateBlocked(tabId: string, count = 1): void {
  const state = tabs.get(tabId)
  if (!state) return
  state.blockedRequests += count
  deps.onChanged(privateTabsNow())
}

export function notePrivateHeaders(tabId: string, count: number): void {
  if (count <= 0) return
  const state = tabs.get(tabId)
  if (!state) return
  state.scrubbedHeaders += count
  deps.onChanged(privateTabsNow())
}

/**
 * A visit this tab refused to write to `history.ts`.
 *
 * Counted rather than logged: the point of the counter is that the refusal is visible in the
 * UI, and "which page was it" is exactly the thing nobody should be able to ask afterwards.
 */
export function notePrivateHistoryBlocked(tabId: string | null | undefined): void {
  if (!tabId) return
  const state = tabs.get(tabId)
  if (!state) return
  state.historyBlocked += 1
  deps.onChanged(privateTabsNow())
}

/* ------------------------------------------------------------------ *
 * Private windows
 * ------------------------------------------------------------------ */

let windowSeq = 0

/**
 * Opens an address in its own window on a throwaway max-protection session.
 *
 * A window rather than a tab, because that is what the bookmark menu offers. It reuses the whole
 * private-tab path - the same in-memory partition, the same enforced Level 3 filter, the same
 * wipe - by registering the window under its own id, so the session code has exactly one shape to
 * know about. The id is namespaced so it can never collide with a tab's: nothing in the shell
 * looks a window up by tab id, and the registry entry is plainly there for the session and its
 * counters.
 */
export async function openPrivateWindow(
  url: string
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { ok: false, error: `a private window only opens http(s) targets, got ${parsed.protocol}` }
    }

    windowSeq += 1
    const id = `private-window-${windowSeq}`
    const state = await openPrivateTab(id)

    const window = new BrowserWindow({
      width: 1180,
      height: 820,
      backgroundColor: '#0b0d10',
      autoHideMenuBar: true,
      title: `DevLens private window - ${parsed.host}`,
      webPreferences: {
        partition: state.partition,
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

    // Closing the window is the end of the session: the partition is wiped and forgotten, the
    // same promise the last tab of a private session keeps.
    window.on('closed', () => {
      void closePrivateTab(id)
    })

    void window.loadURL(parsed.toString())
    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
