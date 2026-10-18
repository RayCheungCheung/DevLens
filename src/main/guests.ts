import { BrowserWindow, type WebContents } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  ConsoleLevel,
  ConsoleLogEntry,
  GuestRegistration,
  GuestStatusEvent,
  NetworkEntry,
  ViewportId,
  ViewportPhase
} from '../shared/types'
import { isMonitoringEnabled, noteLeaseConsole } from './mode'

type Emit = (channel: string, payload: unknown) => void

/** guest webContents id -> viewport id, filled in by the renderer at `did-attach`. */
const guestViewIds = new Map<number, ViewportId>()
/**
 * guest webContents id -> the partition it is on.
 *
 * The renderer knows this (it sets the `partition` attribute) and main cannot derive it, so it is
 * sent once at attach. Every window the guest opens is created on this partition: a popup on the
 * default session shares no cookies with the page that opened it, which is a 401 on the callback
 * and, in a private tab, a session leak in the other direction.
 */
const guestPartitions = new Map<number, string>()

export function setEmitter(emit: Emit): void {
  emitter = emit
}

let emitter: Emit = () => {}

/** The renderer owns the guest ids, so it tells us which viewport a guest belongs to. */
export function registerGuest(registration: GuestRegistration): void {
  guestViewIds.set(registration.guestId, registration.viewId)
  if (registration.partition) guestPartitions.set(registration.guestId, registration.partition)
  emitStatus(registration.guestId, registration.viewId, 'idle')
}

export function forgetGuest(guestId: number): void {
  guestViewIds.delete(guestId)
  guestPartitions.delete(guestId)
}

export function knownGuests(): Map<number, ViewportId> {
  return guestViewIds
}

/** Which viewport owns a guest. Used to tag console output and network traffic. */
export function viewIdForGuest(guestId?: number): ViewportId | null {
  if (typeof guestId !== 'number') return null
  return guestViewIds.get(guestId) ?? null
}

/**
 * Failure entries for the Console & Network panel. The interceptor owns the session
 * hooks now, so it feeds this stream; keeping the helper here means the panel contract
 * stays in one place.
 */
export function emitNetworkEntry(entry: NetworkEntry): void {
  emitter(IPC.networkEntry, entry)
}

/** Schemes a page inside a guest may navigate to. Everything else is not a web navigation. */
const NAVIGABLE = /^(https?|file|about|blob|data):/i

/** Schemes a popup may open. `about:blank` is the first hop of several OAuth SDKs. */
function isOpenable(url: string): boolean {
  return url === 'about:blank' || /^https?:/i.test(url)
}

/**
 * The window options for a sign-in popup.
 *
 * An OAuth popup is not a tab: the flow ends by calling `window.opener.postMessage(...)`, so it has
 * to be a real child window of the page that opened it. Opening it as a tab would break the
 * handshake and leave the site spinning - which is the freeze this fixes - and dropping it leaves
 * the operator with a button that does nothing. It gets the guest's own session, so the cookies
 * the provider sets are the cookies the redirect back to the site will see.
 */
function popupWindowOptions(partition: string | undefined): Electron.BrowserWindowConstructorOptions {
  return {
    width: 520,
    height: 700,
    minWidth: 360,
    minHeight: 480,
    autoHideMenuBar: true,
    title: 'DevLens - sign in',
    backgroundColor: '#0b0d10',
    webPreferences: {
      /* The same session as the page that opened it: cookies, storage, and the redirect back. */
      ...(partition ? { partition } : {}),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false
    }
  }
}

/**
 * A popup can open further popups (some identity providers do), and it must not be able to
 * navigate itself into a local scheme or into the shell's own pages.
 */
function hardenPopup(window: BrowserWindow, partition: string | undefined): void {
  window.webContents.setWindowOpenHandler(({ url }) =>
    isOpenable(url)
      ? { action: 'allow', overrideBrowserWindowOptions: popupWindowOptions(partition) }
      : { action: 'deny' }
  )
  window.webContents.on('will-navigate', (event, target) => {
    if (!NAVIGABLE.test(target)) event.preventDefault()
  })
}

/**
 * Per-guest instrumentation. Attached the moment Electron creates a webview
 * webContents, i.e. before the page has a chance to log anything.
 */
export function instrumentGuest(contents: WebContents): void {
  const guestId = contents.id
  /** Read at the moment of the request: the guest is registered long before it can open anything. */
  const partitionOf = (): string | undefined => guestPartitions.get(guestId)

  /**
   * `window.open` - the sign-in popup case.
   *
   * A `new-window` disposition is a popup with a name and features: that is an OAuth window, and
   * it is allowed as a real child window so the opener handshake survives. A tab disposition
   * (`target=_blank`, middle-click, ctrl-click) is a request for a *tab* in this browser, so the
   * shell is asked to open one; denying it here and opening it there is what keeps a link from
   * becoming a stray 520x700 window.
   */
  contents.setWindowOpenHandler(({ url, disposition }) => {
    if (!isOpenable(url)) return { action: 'deny' }
    if (disposition === 'new-window' || disposition === 'other') {
      return { action: 'allow', overrideBrowserWindowOptions: popupWindowOptions(partitionOf()) }
    }
    /**
     * A new tab is a new *view*, but not a new session: it opens on the partition the guest is on,
     * so a sub-system that authenticates by cookie sees the cookie it just set.
     */
    if (url !== 'about:blank') emitter(IPC.guestOpenTab, { url, partition: partitionOf() })
    return { action: 'deny' }
  })

  contents.on('did-create-window', (window) => {
    hardenPopup(window, partitionOf())
  })

  /**
   * Navigation guard: protocols only.
   *
   * Cross-origin redirects are the *normal* shape of an OAuth/SAML flow - the page leaves for the
   * provider and comes back to the site's callback - so nothing here looks at the origin. The only
   * thing refused is a navigation into a scheme a page should not be able to drive (the shell's
   * `devlens:` pages, `javascript:`, arbitrary protocol handlers).
   */
  contents.on('will-navigate', (event, target) => {
    if (!NAVIGABLE.test(target)) event.preventDefault()
  })

  // Electron hands the payload over on the event object itself; the trailing
  // positional arguments are deprecated, so read `details` and normalise its level.
  contents.on('console-message', (details) => {
    // Normal mode is not a monitored browser: nothing is collected, console included.
    if (!isMonitoringEnabled()) return
    const viewId = guestViewIds.get(guestId)
    if (!viewId) return
    noteLeaseConsole()
    pushConsole({
      kind: 'console',
      id: `${guestId}:${Date.now()}:${Math.random().toString(16).slice(2, 8)}`,
      guestId,
      viewId,
      level: toLevel(details.level),
      message: details.message,
      sourceUrl: details.sourceId,
      line: details.lineNumber,
      timestamp: Date.now()
    })
  })

  contents.on('did-start-loading', () => emitStatus(guestId, guestViewIds.get(guestId), 'loading'))
  contents.on('did-finish-load', () => emitStatus(guestId, guestViewIds.get(guestId), 'ready'))
  contents.on('did-navigate', (_event, url) => emitStatus(guestId, guestViewIds.get(guestId), 'ready', url))

  /**
   * Redirects, reported as they happen.
   *
   * `did-navigate` fires once, at the end of the chain; an OAuth round trip can spend a second
   * inside it. Reporting the start and each hop keeps the address bar and the loading state honest
   * while it does, instead of showing the old URL and looking frozen.
   */
  contents.on('did-start-navigation', (details) => {
    if (!details.isMainFrame) return
    emitStatus(guestId, guestViewIds.get(guestId), 'loading', details.url)
  })
  contents.on('will-redirect', (details) => {
    if (!details.isMainFrame) return
    emitStatus(guestId, guestViewIds.get(guestId), 'loading', details.url)
  })

  /**
   * Ctrl + the mouse wheel zooms the guest in real time: wheel up zooms in, wheel out.
   *
   * The shell's DOM never sees the wheel - it lands in the guest's web contents - so this lives
   * in the main process where the zoom state actually is. The clamp matches the menu's zoom, and
   * `before-input-event` + preventDefault stops the guest's own pinch/zoom from also firing.
   */
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'mouseWheel' || !input.control) return
    event.preventDefault()
    const step = input.wheelDeltaY > 0 ? 0.1 : -0.1
    const next = Math.max(-5, Math.min(5, contents.getZoomLevel() + step))
    contents.setZoomLevel(next)
  })

  contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    // -3 == ERR_ABORTED, which fires for every cancelled navigation and is pure noise.
    if (!isMainFrame || errorCode === -3) return
    emitStatus(guestId, guestViewIds.get(guestId), 'failed', validatedURL, null, errorCode, errorDescription)
  })
}

function pushConsole(entry: ConsoleLogEntry): void {
  emitter(IPC.consoleLog, entry)
}

function emitStatus(
  guestId: number,
  viewId: ViewportId | undefined,
  phase: ViewportPhase,
  url?: string,
  title?: string | null,
  errorCode: number | null = null,
  errorDescription: string | null = null
): void {
  if (!viewId) return
  const payload: GuestStatusEvent = {
    viewId,
    guestId,
    phase,
    url: url ?? null,
    title: title ?? null,
    errorCode,
    errorDescription,
    timestamp: Date.now()
  }
  emitter(IPC.guestStatus, payload)
}

function toLevel(level: ConsoleLevel | string | number): ConsoleLevel {
  if (typeof level === 'number') {
    // Legacy numeric levels: 0 verbose, 1 info, 2 warning, 3 error.
    if (level >= 3) return 'error'
    if (level === 2) return 'warn'
    if (level === 1) return 'info'
    return 'debug'
  }
  switch (level) {
    case 'error':
      return 'error'
    case 'warning':
      return 'warn'
    case 'info':
      return 'info'
    default:
      return 'log'
  }
}
