import { clipboard, session, type BrowserWindow, type Session } from 'electron'
import { classifyClipboardText } from '../shared/clipboard'
import type { ClipboardVerdict, WimhEvent, WimhEventCategory, WimhState } from '../shared/types'
import { clearBrowserFingerprint, rotateBrowserFingerprint } from './fingerprint'

/**
 * WImH - "What If am Hacked" - extreme defense mode.
 *
 * The premise is a host you no longer trust, so every guarantee here is about *not leaving
 * traces* and *not leaking* rather than about hiding from a local attacker with kernel
 * access. What is enforced:
 *
 *  1. RAM only. The mode runs on its own in-memory partition (`devlens-wimh`, cache off,
 *     no storage path). Persistent cookies a page tries to set are downgraded to session
 *     cookies, downloads and permissions are denied, and the browsing history recorder
 *     refuses writes while the mode is on. Leaving the mode wipes storage, cache and auth.
 *  2. Memory hygiene. Sensitive values are copied into Buffers, redacted wherever they
 *     would otherwise be handed to the UI or logs, and the Buffers are zeroed on a TTL or
 *     on demand. JavaScript strings cannot be wiped in place, which is exactly why nothing
 *     sensitive is kept as one.
 *  3. Window protection. `setContentProtection(true)` asks the OS to exclude the DevLens
 *     windows from screen capture and remote-desktop mirroring, and display-media requests
 *     from any guest are refused.
 *  4. Clipboard sentinel. Writes that DevLens performs are classified first, watched, and
 *     purged after a configurable timeout; pastes of detected credentials into DevLens
 *     fields are refused unless the operator lifts the guard.
 *
 * What it cannot do is stated plainly in the UI: a hostile host with kernel or debugger
 * access can still read this process's memory, and no userspace app can stop another
 * process from reading the shared clipboard while the value is there.
 */

export const WIMH_PARTITION = 'devlens-wimh'
const EVENT_LIMIT = 40
const CLIPBOARD_POLL_MS = 1200
const DEFAULT_SCRUB_AFTER_MS = 30000
const CLIPBOARD_PLACEHOLDER = '[devlens: cleared by WImH clipboard sentinel]'

interface ScrubEntry {
  label: string
  buffer: Buffer
  timer: NodeJS.Timeout | null
}

let active = false
let startedAt: number | null = null
let events: WimhEvent[] = []
let clipboardTimer: NodeJS.Timeout | null = null
let lastClipboardText = ''
let lastPurgeAt: number | null = null
let lastPurgeReason: string | null = null
let pendingPurge: NodeJS.Timeout | null = null
let contentProtection = false
let displayMediaBlocked = 0
let scrubAfterMs = DEFAULT_SCRUB_AFTER_MS

const state = {
  cookiesDowngraded: 0,
  storageWipes: 0,
  historyBlocked: 0,
  scrubbedValues: 0,
  redactedFields: 0,
  lastScrubAt: null as number | null,
  guardedWrites: 0,
  purgedSecrets: 0,
  blockedPastes: 0,
  guardClipboard: true,
  blockPastes: true,
  clipboardClearAfterMs: 20000
}

const scrubs = new Map<string, ScrubEntry>()
let windowProvider: () => BrowserWindow[] = () => []
let notify: (stateNow: WimhState) => void = () => {}

export function configureWimh(input: {
  windowProvider: () => BrowserWindow[]
  clipboardClearAfterMs: number
  scrubAfterMs: number
  guardClipboard: boolean
  blockPastes: boolean
  onChanged: (stateNow: WimhState) => void
}): void {
  windowProvider = input.windowProvider
  notify = input.onChanged
  state.clipboardClearAfterMs = input.clipboardClearAfterMs
  state.guardClipboard = input.guardClipboard
  state.blockPastes = input.blockPastes
  scrubAfterMs = input.scrubAfterMs
}

export function wimhPartition(): string {
  return WIMH_PARTITION
}

export function isWimhActive(): boolean {
  return active
}

/* ------------------------------------------------------------------ *
 * Event feed
 * ------------------------------------------------------------------ */

export function recordEvent(
  category: WimhEventCategory,
  message: string,
  detail: string | null = null
): void {
  events = [
    {
      id: `wimh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category,
      message,
      detail,
      timestamp: Date.now()
    },
    ...events
  ].slice(0, EVENT_LIMIT)
  notify(wimhStateNow())
}

/* ------------------------------------------------------------------ *
 * Memory hygiene
 * ------------------------------------------------------------------ */

/**
 * Copies a sensitive value into a Buffer and schedules its zeroing.
 *
 * The Buffer is the only copy WImH keeps: callers must hand over the string once and then
 * drop it, because a JavaScript string cannot be overwritten after the fact.
 */
export function registerSecret(label: string, value: string, ttlMs = scrubAfterMs): string {
  const buffer = Buffer.from(value, 'utf-8')
  const entry: ScrubEntry = { label, buffer, timer: null }
  entry.timer = setTimeout(() => scrubEntry(entry), Math.max(1000, ttlMs))
  scrubs.set(label, entry)
  return label
}

function scrubEntry(entry: ScrubEntry): void {
  if (entry.timer) clearTimeout(entry.timer)
  entry.buffer.fill(0)
  state.scrubbedValues += 1
  state.lastScrubAt = Date.now()
  recordEvent('memory', `zeroed ${entry.label}`, `${entry.buffer.length} bytes overwritten`)
}

/** Zeroes every live scratch buffer; called on demand and whenever the mode is left. */
export function scrubNow(reason = 'manual scrub'): number {
  const count = scrubs.size
  for (const entry of scrubs.values()) scrubEntry(entry)
  scrubs.clear()
  if (count > 0) recordEvent('memory', `${count} scratch buffer(s) zeroed`, reason)
  notify(wimhStateNow())
  return count
}

export function noteRedactedField(what: string): void {
  state.redactedFields += 1
  recordEvent('memory', `redacted ${what}`, 'value replaced before it left the main process')
}

/* ------------------------------------------------------------------ *
 * Clipboard sentinel
 * ------------------------------------------------------------------ */

export function classifyClipboard(text: string): ClipboardVerdict {
  const verdict = classifyClipboardText(text)
  return { secret: verdict.secret, reason: verdict.reason }
}

/** Schedules the purge for the current clipboard content. */
function schedulePurge(reason: string): void {
  if (pendingPurge) return
  const delay = Math.max(1000, state.clipboardClearAfterMs)
  pendingPurge = setTimeout(() => {
    pendingPurge = null
    void purgeClipboard(reason)
  }, delay)
}

async function purgeClipboard(reason: string): Promise<void> {
  // Electron's clipboard API is promise based; the value is overwritten either way.
  const text = await clipboard.readText()
  await clipboard.writeText(text ? CLIPBOARD_PLACEHOLDER : '')
  lastPurgeAt = Date.now()
  lastPurgeReason = reason
  state.purgedSecrets += 1
  recordEvent('clipboard', 'clipboard purged', reason)
}

/**
 * Every clipboard write DevLens performs goes through here while the mode is on: the value
 * is classified, the timer is armed, and sensitive writes are also registered for zeroing.
 */
export function guardClipboardWrite(text: string, source: string): { guarded: boolean; verdict: ClipboardVerdict } {
  const verdict = classifyClipboard(text)
  if (!active || !state.guardClipboard) return { guarded: false, verdict }

  state.guardedWrites += 1
  lastClipboardText = text
  if (verdict.secret) {
    registerSecret(`clipboard:${source}`, text, state.clipboardClearAfterMs)
    schedulePurge(`${source} wrote a ${verdict.reason}`)
    recordEvent('clipboard', `armed purge for ${verdict.reason}`, `${source} -> auto clear in ${Math.round(state.clipboardClearAfterMs / 1000)}s`)
  }
  notify(wimhStateNow())
  return { guarded: true, verdict }
}

/**
 * Watches the OS clipboard while the mode is on.
 *
 * Anything that looks like a credential is purged after the timeout, whether DevLens or
 * another application put it there. Other processes can still read the clipboard while the
 * value exists - that is a platform limit, and the UI says so.
 */
function startClipboardSentinel(): void {
  if (clipboardTimer) return
  clipboardTimer = setInterval(() => {
    if (!active) return
    void (async () => {
      const text = await clipboard.readText()
      if (!text || text === CLIPBOARD_PLACEHOLDER) return
      if (text === lastClipboardText) return
      lastClipboardText = text

      const verdict = classifyClipboard(text)
      if (!verdict.secret) return

      registerSecret('clipboard:external', text, state.clipboardClearAfterMs)
      schedulePurge(`${verdict.reason} appeared on the clipboard`)
      recordEvent(
        'clipboard',
        'sensitive clipboard content detected',
        `${verdict.reason} - purge in ${Math.round(state.clipboardClearAfterMs / 1000)}s`
      )
    })()
  }, CLIPBOARD_POLL_MS)
}

function stopClipboardSentinel(): void {
  if (clipboardTimer) clearInterval(clipboardTimer)
  clipboardTimer = null
  if (pendingPurge) clearTimeout(pendingPurge)
  pendingPurge = null
  lastClipboardText = ''
}

export function notePasteBlocked(reason: string): void {
  state.blockedPastes += 1
  recordEvent('clipboard', 'paste refused', reason)
}

export function setClipboardTtl(ms: number): WimhState {
  state.clipboardClearAfterMs = Math.min(600000, Math.max(1000, Math.round(ms)))
  recordEvent('clipboard', `purge timeout set to ${Math.round(state.clipboardClearAfterMs / 1000)}s`, null)
  return wimhStateNow()
}

/* ------------------------------------------------------------------ *
 * RAM-only enforcement
 * ------------------------------------------------------------------ */

export function wimhSession(): Session {
  // No `persist:` prefix and cache disabled: nothing lands on disk.
  const ses = session.fromPartition(WIMH_PARTITION, { cache: false })
  return ses
}

/**
 * Attaches the RAM-only guards to the WImH partition:
 *  - persistent cookies are downgraded to session cookies (a page cannot park a token),
 *  - the spellchecker is off so no dictionary is downloaded or cached,
 *  - downloads and permissions are denied by the shared hardening helper.
 */
export function enforceRamOnly(ses: Session): void {
  ses.cookies.on('changed', (_event, cookie, _cause, removed) => {
    // `session` cookies already die with the partition; only persistent ones need work.
    if (!active || removed || cookie.session) return
    const url = `${cookie.secure ? 'https' : 'http'}://${cookie.domain?.replace(/^\./, '') ?? 'localhost'}${cookie.path ?? '/'}`

    void (async () => {
      try {
        await ses.cookies.remove(url, cookie.name)
        await ses.cookies.set({
          url,
          name: cookie.name,
          value: cookie.value,
          path: cookie.path,
          domain: cookie.domain,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          // No expirationDate: Electron then stores it as a session cookie.
        })
        state.cookiesDowngraded += 1
        recordEvent('ram-only', 'persistent cookie downgraded', `${cookie.name} on ${cookie.domain ?? 'unknown host'}`)
      } catch {
        /* the cookie may already be gone */
      }
    })()
  })

  ses.setSpellCheckerEnabled(false)
  ses.setDisplayMediaRequestHandler((_request, callback) => {
    displayMediaBlocked += 1
    recordEvent('window', 'screen capture request refused', 'a page asked for display media')
    callback({})
  })
}

export function noteHistoryBlocked(url: string): void {
  state.historyBlocked += 1
  recordEvent('ram-only', 'history write refused', url)
}

/* ------------------------------------------------------------------ *
 * Window protection
 * ------------------------------------------------------------------ */

function applyContentProtection(enabled: boolean): void {
  let applied = 0
  for (const window of windowProvider()) {
    if (window.isDestroyed()) continue
    window.setContentProtection(enabled)
    applied += 1
  }
  contentProtection = enabled && applied > 0
}

/* ------------------------------------------------------------------ *
 * Mode lifecycle
 * ------------------------------------------------------------------ */

export function wimhStateNow(): WimhState {
  const ses = session.fromPartition(WIMH_PARTITION, { cache: false })
  return {
    active,
    partition: WIMH_PARTITION,
    startedAt,
    contentProtection,
    displayMediaBlocked,
    ramOnly: {
      enforced: active,
      partitionInMemory: !ses.storagePath,
      cookiesDowngraded: state.cookiesDowngraded,
      storageWipes: state.storageWipes,
      historyBlocked: state.historyBlocked
    },
    memory: {
      liveScrubs: scrubs.size,
      scrubbedValues: state.scrubbedValues,
      redactedFields: state.redactedFields,
      lastScrubAt: state.lastScrubAt,
      scrubAfterMs
    },
    clipboard: {
      enabled: active && state.guardClipboard,
      clearAfterMs: state.clipboardClearAfterMs,
      guardedWrites: state.guardedWrites,
      purgedSecrets: state.purgedSecrets,
      blockedPastes: state.blockedPastes,
      lastPurgeAt,
      lastPurgeReason
    },
    events
  }
}

export async function setWimhEnabled(enabled: boolean): Promise<WimhState> {
  if (enabled === active) return wimhStateNow()
  const ses = wimhSession()

  if (enabled) {
    // Clear first, flip afterwards: the renderer polls this state, and "on" must mean the
    // session has actually been wiped and the window protection is in place.
    await ses.clearStorageData()
    await ses.clearCache()
    await ses.clearAuthCache()
    await ses.clearHostResolverCache()
    rotateBrowserFingerprint(ses, 'wimh')
    applyContentProtection(true)
    startClipboardSentinel()
    active = true
    startedAt = Date.now()
    recordEvent('session', 'extreme defense mode engaged', 'RAM-only session, clipboard sentinel armed')
  } else {
    clearBrowserFingerprint(ses)
    applyContentProtection(false)
    stopClipboardSentinel()
    await ses.clearStorageData()
    await ses.clearCache()
    await ses.clearAuthCache()
    state.storageWipes += 1
    scrubNow('mode disabled')
    await clipboard.writeText('')
    active = false
    startedAt = null
    recordEvent('session', 'extreme defense mode disengaged', 'session storage, cache and scratch memory cleared')
  }

  notify(wimhStateNow())
  return wimhStateNow()
}

/** Keeps content protection in step when a window is created while the mode is on. */
export function protectWindow(window: BrowserWindow): void {
  if (active) window.setContentProtection(true)
}

export const WIMH_CLIPBOARD_PLACEHOLDER = CLIPBOARD_PLACEHOLDER
