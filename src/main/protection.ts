import {
  protectionPolicy,
  type ProtectionLevel,
  type ProtectionPolicy
} from '../shared/protection'
import type { ProtectionState } from '../shared/types'
import type { ShieldRules } from '../shared/privacy'
import { trackedHostTier } from './tracker-list'
import { isWimhActive, setWimhEnabled } from './wimh'

/**
 * Protection engine.
 *
 * The level decides three things and nothing else: which hosts get cancelled before they leave
 * the machine, whether outgoing headers are hardened, and whether the viewports run on the
 * in-memory defense session. There is no reporting path, no allowlist of "trusted" collectors
 * and no network call anywhere in this module - switching levels is a purely local decision.
 *
 * The level is per-session state on purpose. A browser that stores a privacy preference is a
 * browser that leaks one, and keeping it in memory also means a stale setting can never follow
 * a profile around.
 */

let level: ProtectionLevel = 'standard'
let changedAt = Date.now()
let notify: (state: ProtectionState) => void = () => {}
let blockedRequests = 0
let scrubbedHeaders = 0
let trimmedReferers = 0
/** True when *this* level switch turned the RAM-only session on, so leaving can turn it off. */
let ramOnlyFromLevel = false
let shieldRules: ShieldRules = {
  crossSiteTrackers: true,
  fingerprinters: false,
  cryptominers: true,
  sendDnt: true
}

/**
 * Per-site exemptions, session only.
 *
 * The site panel can pause cancellation for the page in front of the operator - a checkout that
 * insists on a tracker, or a site being debugged. It is the narrowest switch there is: other
 * sites keep the level's protection, the header policy and the RAM-only session are untouched,
 * and nothing is written to disk, so a restart forgets every exemption.
 */
const allowedSites = new Set<string>()
const ALLOWED_SITE_LIMIT = 50

/** Host of a URL, or of a bare host typed straight in. */
export function siteHostOf(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    return parsed.host || null
  } catch {
    return null
  }
}

export function isSiteAllowed(site: string): boolean {
  const host = siteHostOf(site)
  return host ? allowedSites.has(host) : false
}

/** Pauses or resumes cancellation for one site, and tells the shell what changed. */
export function setSiteAllowed(site: string, allowed: boolean): ProtectionState {
  const host = siteHostOf(site)
  if (host) {
    if (allowed) {
      allowedSites.add(host)
      if (allowedSites.size > ALLOWED_SITE_LIMIT) {
        const oldest = allowedSites.values().next().value
        if (oldest) allowedSites.delete(oldest)
      }
    } else {
      allowedSites.delete(host)
    }
  }
  const state = protectionStateNow()
  notify(state)
  return state
}

export function configureProtection(input: {
  initial: ProtectionLevel
  onChanged: (state: ProtectionState) => void
}): void {
  level = input.initial
  changedAt = Date.now()
  notify = input.onChanged
}

export function currentProtection(): ProtectionLevel {
  return level
}

export function protectionLevelNow(): ProtectionLevel {
  return level
}

export function protectionPolicyNow(): ProtectionPolicy {
  const base = protectionPolicy(level)
  return {
    ...base,
    aggressiveBlocklist:
      base.aggressiveBlocklist && (shieldRules.crossSiteTrackers || shieldRules.cryptominers),
    privacyHeaders: base.privacyHeaders && (shieldRules.fingerprinters || shieldRules.sendDnt),
    trimCrossSiteReferer: base.trimCrossSiteReferer && shieldRules.crossSiteTrackers
  }
}

export function setShieldRules(next: Partial<ShieldRules>): ProtectionState {
  shieldRules = {
    crossSiteTrackers: next.crossSiteTrackers !== false,
    fingerprinters: next.fingerprinters === true,
    cryptominers: next.cryptominers !== false,
    sendDnt: next.sendDnt !== false
  }
  const state = protectionStateNow()
  notify(state)
  return state
}

function resetCounters(): void {
  blockedRequests = 0
  scrubbedHeaders = 0
  trimmedReferers = 0
}

export function protectionStateNow(): ProtectionState {
  return {
    level,
    policy: protectionPolicyNow(),
    blockedRequests,
    scrubbedHeaders,
    trimmedReferers,
    ramOnlySession: isWimhActive(),
    allowedSites: [...allowedSites],
    changedAt
  }
}

/**
 * Applies a level to the running sessions. No restart, no reload: the request filter reads the
 * policy per request, and only `extreme` has a side effect, because its isolation is a session
 * property rather than a header one.
 *
 * Changes are serialized. Extreme engages a whole session (which takes a moment to wipe and
 * swap) while Standard only drops a header, so without a queue a fast "leave extreme" could
 * finish before the "enter extreme" it was meant to undo - and the browser would end up
 * reporting one level while running another.
 */
let queue: Promise<unknown> = Promise.resolve()

export function setProtectionLevel(next: ProtectionLevel): Promise<ProtectionState> {
  const applied = queue.then(() => applyLevel(next))
  // A failed step must not wedge the queue for every later one.
  queue = applied.catch(() => undefined)
  return applied
}

async function applyLevel(next: ProtectionLevel): Promise<ProtectionState> {
  const changed = next !== level
  level = next
  if (changed) {
    changedAt = Date.now()
    resetCounters()
  }

  // Re-applied even when the level did not change, so the boot path can enforce the configured
  // starting level without a special case.
  await applyRamOnly(protectionPolicy(level))

  const state = protectionStateNow()
  if (changed) notify(state)
  return state
}

/** Extreme runs on the in-memory defense session; anything below it gives the session back. */
async function applyRamOnly(policy: ProtectionPolicy): Promise<void> {
  if (policy.ramOnlySession) {
    // Extreme: the viewports move onto the RAM-only defense session (cookie downgrade, no
    // history writes, no cache on disk).
    if (!isWimhActive()) ramOnlyFromLevel = true
    await setWimhEnabled(true)
    return
  }
  // Leaving extreme releases the session it engaged, unless the operator had it on already.
  if (ramOnlyFromLevel) {
    ramOnlyFromLevel = false
    await setWimhEnabled(false)
  }
}

/**
 * True when the active level wants this URL cancelled.
 *
 * Called on every request, so it does the cheap host parse first and only walks the aggressive
 * list when the level actually asks for it.
 *
 * `policy` overrides the dial for one session. A private tab passes the Extreme policy here:
 * the window is still on whatever level the operator picked, and the tab is still on Level 3,
 * which is the whole point of a tab-level mode.
 */
export function protectionBlocksUrl(
  url: string,
  documentUrl?: string | null,
  policy: ProtectionPolicy = protectionPolicyNow()
): boolean {
  if (!policy.blockTrackers) return false

  // A site the operator exempted is left alone - including the trackers it loads itself.
  const pageHost = documentUrl ? siteHostOf(documentUrl) : null
  if (pageHost && allowedSites.has(pageHost)) return false

  let host = ''
  try {
    host = new URL(url).host
  } catch {
    return false
  }

  const tier = trackedHostTier(host)
  if (!tier) return false
  return tier === 'base' || policy.aggressiveBlocklist
}

/** Counters, so the menu can show that the level is doing something rather than just claiming it. */
export function noteProtectionBlocked(): void {
  blockedRequests += 1
  scheduleNotify()
}

export function noteProtectionHeaders(count: number): void {
  if (count <= 0) return
  scrubbedHeaders += count
  scheduleNotify()
}

export function noteProtectionRefererTrimmed(): void {
  trimmedReferers += 1
  scheduleNotify()
}

/**
 * Counters move per request, so they are pushed on a short debounce instead of per hit. The
 * update is one IPC message with numbers - nothing leaves the machine.
 */
let notifyTimer: NodeJS.Timeout | null = null

function scheduleNotify(): void {
  if (notifyTimer) return
  notifyTimer = setTimeout(() => {
    notifyTimer = null
    notify(protectionStateNow())
  }, 400)
}

/* ------------------------------------------------------------------ *
 * Header hardening
 * ------------------------------------------------------------------ */

/** Headers that let a site fingerprint the machine before a byte of the page arrives. */
const FINGERPRINT_HEADERS = [
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'sec-ch-ua-arch',
  'sec-ch-ua-model',
  'sec-ch-ua-full-version',
  'sec-ch-ua-full-version-list'
]

export interface HeaderOutcome {
  headers: Record<string, string>
  changed: number
  trimmedReferer: boolean
}

/**
 * Applies the level's header policy to one outgoing request.
 *
 * Strict and Extreme send the opt-out signals, drop the client hints that fingerprint a
 * device, and cut a cross-site referrer back to its origin. Everything is decided from the two
 * URLs in hand - no lookup, no cache, no network.
 */
export function applyProtectionHeaders(
  headers: Record<string, string | string[]>,
  requestUrl: string,
  documentUrl: string | null,
  /** See `protectionBlocksUrl`: one session can run a policy of its own. */
  policy: ProtectionPolicy = protectionPolicyNow()
): HeaderOutcome {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers)) {
    out[name] = Array.isArray(value) ? value.join(', ') : String(value)
  }
  if (!policy.privacyHeaders && !policy.trimCrossSiteReferer) {
    return { headers: out, changed: 0, trimmedReferer: false }
  }

  let changed = 0
  const set = (name: string, value: string): void => {
    const existing = Object.keys(out).find((key) => key.toLowerCase() === name)
    if (existing && out[existing] === value) return
    if (existing) delete out[existing]
    out[name] = value
    changed += 1
  }

  if (policy.privacyHeaders) {
    // The two published opt-out signals. Neither is a network call: they are just headers.
    set('DNT', '1')
    set('Sec-GPC', '1')
    for (const name of FINGERPRINT_HEADERS) {
      const existing = Object.keys(out).find((key) => key.toLowerCase() === name)
      if (existing) {
        delete out[existing]
        changed += 1
      }
    }
  }

  let trimmedReferer = false
  if (policy.trimCrossSiteReferer && documentUrl) {
    const refererKey = Object.keys(out).find((key) => key.toLowerCase() === 'referer')
    if (refererKey) {
      const trimmed = trimReferer(out[refererKey], requestUrl, documentUrl)
      if (trimmed && trimmed !== out[refererKey]) {
        out[refererKey] = trimmed
        changed += 1
        trimmedReferer = true
      }
    }
  }

  return { headers: out, changed, trimmedReferer }
}

/**
 * Cross-site referrers drop their path and query. Same-site ones are left alone, because a
 * first-party page legitimately uses them and trimming there only breaks navigation.
 */
function trimReferer(referer: string, requestUrl: string, documentUrl: string): string | null {
  try {
    const target = new URL(requestUrl)
    const document = new URL(documentUrl)
    const refererUrl = new URL(referer)
    if (sameSite(target.host, document.host)) return null
    if (refererUrl.pathname === '/' && !refererUrl.search) return null
    return `${refererUrl.protocol}//${refererUrl.host}/`
  } catch {
    return null
  }
}

/** Loose same-site test: an exact host, or one host nested under the other. */
function sameSite(a: string, b: string): boolean {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`)
}
