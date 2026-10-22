import { webContents, type Session } from 'electron'
import { IPC } from '../shared/ipc'
import type { ResolvedInterceptorConfig } from '../shared/config'
import type {
  CapturedRequest,
  HeaderPair,
  InterceptorRule,
  InterceptorSnapshot,
  InterceptorState,
  NetworkEntry,
  PausedRequest,
  RepeaterRequest,
  RepeaterResponse,
  RequestEvent,
  ResumeRequestPayload
} from '../shared/types'
import type { SessionProfileId } from '../shared/types'
import { emitNetworkEntry, viewIdForGuest } from './guests'
import { noteGhostBlocked, shouldCancelTrackingUrl } from './sessions'
import {
  applyProtectionHeaders,
  noteProtectionBlocked,
  noteProtectionHeaders,
  noteProtectionRefererTrimmed
} from './protection'
import { SENSITIVE_HEADERS, classifyClipboardText, redactUrlSecrets } from '../shared/clipboard'
import { isWimhActive, noteRedactedField, registerSecret } from './wimh'
import { areRulesEnabled, clearLeaseCounters, isMonitoringEnabled, noteLeaseRequest } from './mode'
import { notePrivateBlocked, notePrivateHeaders } from './private-tabs'
import { desktopChromeUserAgent } from './user-agent'
import type { ProtectionPolicy } from '../shared/protection'

/**
 * HTTP interceptor.
 *
 * Electron's session webRequest API is the interception surface:
 *   onBeforeRequest      - read the body, apply block/redirect rules
 *   onBeforeSendHeaders  - rewrite headers, or hold the request for the operator
 *   onCompleted/Error    - close the record, feed the failure log
 *
 * The callback of onBeforeSendHeaders may be kept for as long as we like, which is what
 * makes a real pause/resume flow possible without CDP: the network stack simply waits.
 * Browsers do not expose in-flight request bodies for rewriting, so payload edits live in
 * the Repeater, which sends the request itself.
 */

const REQUEST_FILTER = { urls: ['http://*/*', 'https://*/*'] }
const BODY_PREVIEW_CHARS = 2048
const FLUSH_INTERVAL_MS = 150
const MAX_BATCH = 60
const REPEATER_TIMEOUT_MS = 30000
const REPEATER_MAX_BODY = 200_000
const REPEATER_MAX_REQUEST_BODY = 2_000_000
const REPEATER_MAX_URL = 8192
const REPEATER_MAX_HEADERS = 200

/** Headers a fetch() implementation must own; forwarding them breaks the request. */
const MANAGED_HEADERS = new Set([
  'content-length',
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-connection',
  'te',
  'trailer'
])

type Emit = (channel: string, payload: unknown) => void

/**
 * Counters belong to whoever made the decision.
 *
 * A private tab's session enforces Level 3 while the window may be on Standard, so its
 * cancellations are counted on the tab. Adding them to the window's totals as well would make
 * the toolbar claim a level it is not running.
 */
function countBlocked(options: InterceptorSessionOptions): void {
  if (options.privateTabId) {
    notePrivateBlocked(options.privateTabId)
    return
  }
  noteGhostBlocked()
  noteProtectionBlocked()
}

/** The same rule for header rewrites. */
function countHeaders(options: InterceptorSessionOptions, count: number): void {
  if (count <= 0) return
  if (options.privateTabId) notePrivateHeaders(options.privateTabId, count)
  else noteProtectionHeaders(count)
}

interface Hold {
  resolve: (response: { cancel?: boolean; requestHeaders?: Record<string, string | string[]> }) => void
  timer: NodeJS.Timeout
  original: HeaderPair[]
  startedAt: number
}

const records = new Map<string, CapturedRequest>()
const holds = new Map<string, Hold>()
const dirtyRules = new Set<string>()

let emit: Emit = () => {}
let limits: ResolvedInterceptorConfig = {
  enabled: true,
  pauseTimeoutMs: 20000,
  maxPaused: 25,
  bufferSize: 500
}

let enabled = true
let pauseAll = false
let rules: InterceptorRule[] = []
let capturedCount = 0

let pending: RequestEvent[] = []
let flushTimer: NodeJS.Timeout | null = null

export function configureInterceptor(config: ResolvedInterceptorConfig, emitter: Emit): void {
  limits = config
  enabled = config.enabled
  emit = emitter
}

/* ------------------------------------------------------------------ *
 * Public control surface (IPC handlers call into this)
 * ------------------------------------------------------------------ */

export function interceptorState(): InterceptorState {
  return {
    enabled,
    pauseAll,
    pausedCount: holds.size,
    capturedCount,
    maxPaused: limits.maxPaused,
    pauseTimeoutMs: limits.pauseTimeoutMs
  }
}

export function interceptorSnapshot(): InterceptorSnapshot {
  return { state: interceptorState(), rules }
}

export function setEnabled(next: boolean): InterceptorSnapshot {
  enabled = next
  // Never leave the page hanging when interception is switched off.
  if (!next) releaseAll('disabled')
  broadcastState()
  return interceptorSnapshot()
}

export function setPauseAll(next: boolean): InterceptorSnapshot {
  pauseAll = next
  if (!next) releaseAll('continued')
  broadcastState()
  return interceptorSnapshot()
}

export function setRules(next: InterceptorRule[]): InterceptorSnapshot {
  // The panel sends back what it displays, which can lag behind the hit counters. Keeping
  // the counters from the current set means editing a rule never resets its usage.
  const previousHits = new Map(rules.map((rule) => [rule.id, rule.hits]))
  rules = next.map((rule) =>
    sanitiseRule({ ...rule, hits: previousHits.get(rule.id) ?? rule.hits ?? 0 })
  )
  dirtyRules.clear()
  broadcastState()
  return interceptorSnapshot()
}

export function resumeHeld(payload: ResumeRequestPayload): void {
  const headers = payload.headers ? cleanHeaders(payload.headers) : undefined
  settle(payload.id, 'continued', headers)
}

export function dropHeld(id: string): void {
  settle(id, 'dropped')
}

export function clearCaptures(): void {
  records.clear()
  capturedCount = 0
  pending = pending.filter((event) => event.type === 'paused' || event.type === 'resumed')
  // The overlay's own counters follow the records out.
  clearLeaseCounters()
  broadcastState()
}

/** Releases every held request; used when dev mode is left so nothing waits on the operator. */
export function releaseAllHeld(): void {
  for (const id of [...holds.keys()]) settle(id, 'disabled')
}

/* ------------------------------------------------------------------ *
 * Session instrumentation
 * ------------------------------------------------------------------ */

export interface InterceptorSessionOptions {
  /**
   * A policy that belongs to this session rather than to the window.
   *
   * A private tab runs at Level 3 while the window may be on Standard, and the window's dial
   * must not be able to lower it - so the policy travels with the session hooks instead of
   * being read from the engine on every request.
   */
  policy?: ProtectionPolicy
  /** Counters for a private tab are kept per tab, so the pill can show that tab's numbers. */
  privateTabId?: string
}

export function instrumentInterceptor(
  ses: Session,
  profile: SessionProfileId = 'standard',
  options: InterceptorSessionOptions = {}
): void {
  ses.webRequest.onBeforeRequest(REQUEST_FILTER, (details, callback) => {
    // The interception layer must never be able to hang a page or take the app down: on
    // any failure the request is simply allowed through untouched.
    try {
      handleBeforeRequest(details, callback, profile, options)
    } catch (error) {
      console.error('[devlens] interceptor beforeRequest failed', error)
      callback({})
    }
  })

  ses.webRequest.onBeforeSendHeaders(REQUEST_FILTER, (details, callback) => {
    try {
      applyIdentityProviderUserAgent(details)
      handleBeforeSendHeaders(details, callback, options)
    } catch (error) {
      console.error('[devlens] interceptor beforeSendHeaders failed', error)
      callback({ requestHeaders: details.requestHeaders })
    }
  })


  ses.webRequest.onHeadersReceived(REQUEST_FILTER, (details, callback) => {

    try {
      const record = records.get(String(details.id))
      if (record) {
        const headers = toPairs(details.responseHeaders ?? {})
        record.responseHeaders = headers
        record.mimeType =
          headers
            .find((header) => header.name.toLowerCase() === 'content-type')
            ?.value.split(';')[0]
            ?.trim() || null
        queue({ type: 'update', request: record })
      }
    } catch (error) {
      console.error('[devlens] interceptor headersReceived failed', error)
    }
    callback({})
  })

  ses.webRequest.onCompleted(REQUEST_FILTER, (details) => {
    try {
      const record = records.get(String(details.id))
      if (record) finish(record, details.statusCode, null, details)
    } catch (error) {
      console.error('[devlens] interceptor completed failed', error)
    }
  })

  ses.webRequest.onErrorOccurred(REQUEST_FILTER, (details) => {
    try {
      const record = records.get(String(details.id))
      if (record) finish(record, null, details.error)
    } catch (error) {
      console.error('[devlens] interceptor errorOccurred failed', error)
    }
  })
}

function handleBeforeRequest(
  details: Electron.OnBeforeRequestListenerDetails,
  callback: (response: Electron.CallbackResponse) => void,
  profile: SessionProfileId,
  options: InterceptorSessionOptions
): void {
  // Only guests are in scope: the shell's own requests stay invisible and untouched.
  const viewId = viewIdForGuest(details.webContentsId)
  if (!viewId) {
    callback({})
    return
  }

  const id = String(details.id)
  const body = readBody(details.uploadData)
  const extreme = isWimhActive()
  const capturedUrl = extreme ? redactUrlSecrets(details.url) : { url: details.url, redacted: [] }

  if (extreme && capturedUrl.redacted.length > 0) {
    // The live request keeps its secrets; only the capture is rewritten.
    registerSecret(`url:${id}`, details.url)
    noteRedactedField(`query parameter(s) ${capturedUrl.redacted.join(', ')}`)
  }

  const record: CapturedRequest = {
    id,
    viewId,
    url: capturedUrl.url,
    method: details.method,
    resourceType: details.resourceType,
    startedAt: Date.now(),
    statusCode: null,
    error: null,
    durationMs: null,
    blockedByRule: null,
    modifiedHeaders: [],
    paused: false,
    headers: [],
    responseHeaders: [],
    bodyPreview: extreme ? redactBodyPreview(id, body.preview) : body.preview,
    bodyTruncated: body.truncated,
    hasBody: body.has,
    mimeType: null,
    fromCache: false,
    remoteAddress: null
  }

  // Normal mode does not watch: no record, no rules, the request goes out as the page sent
  // it. Tracker blocking still applies, because that is privacy rather than monitoring.
  if (!isMonitoringEnabled()) {
    // Tracker blocking is privacy, not monitoring: it stays on in normal mode, the capability
    // table decides whether it applies at all, and the protection level decides how far it goes.
    // The page a request comes from matters too: a site the operator exempted is left alone.
    if (shouldCancelTrackingUrl(details.url, documentUrlFor(details.webContentsId), options.policy)) {
      countBlocked(options)
      callback({ cancel: true })
      return
    }
    callback({})
    return
  }

  remember(record)
  capturedCount += 1
  // While the WImH overlay holds a lease it counts what it observed, and nothing more.
  noteLeaseRequest()

  // Ghost mode blocks trackers before any rule runs, and reports them as its own category
  // rather than as console failures: a page with twenty analytics calls should not bury the
  // operator's own errors.
  if (
    (profile === 'ghost' || profile === 'wimh' || options.policy) &&
    shouldCancelTrackingUrl(record.url, documentUrlFor(details.webContentsId), options.policy)
  ) {
    countBlocked(options)
    record.blockedByRule = options.policy ? 'private' : 'ghost'
    record.error = options.policy ? 'blocked by max protection (private tab)' : 'blocked by ghost mode'
    record.statusCode = null
    record.durationMs = 0
    records.delete(record.id)
    queue({ type: 'update', request: record })
    callback({ cancel: true })
    return
  }

  if (!enabled || !areRulesEnabled()) {
    callback({})
    return
  }

  const blockRule = firstMatching('block', record.url)
  if (blockRule) {
    blockRule.hits += 1
    dirtyRules.add(blockRule.id)
    record.blockedByRule = blockRule.id
    record.error = `blocked by rule ${blockRule.id}`
    finish(record, null, record.error)
    callback({ cancel: true })
    return
  }

  const redirectRule = firstMatching('redirect', record.url)
  if (redirectRule?.target) {
    redirectRule.hits += 1
    dirtyRules.add(redirectRule.id)
    record.modifiedHeaders = [...record.modifiedHeaders, `redirect -> ${redirectRule.target}`]
    queue({ type: 'update', request: record })
    callback({ redirectURL: redirectRule.target })
    return
  }

  callback({})
}

function handleBeforeSendHeaders(
  details: Electron.OnBeforeSendHeadersListenerDetails,
  callback: (response: Electron.BeforeSendResponse) => void,
  options: InterceptorSessionOptions
): void {
  const id = String(details.id)
  const record = records.get(id)

  // Header hardening is a privacy control, not a monitoring one, so it runs whether or not the
  // request is being captured - normal mode included. Shell traffic is never touched.
  if (!record) {
    const guestId = details.webContentsId
    const viewId = guestId === undefined ? null : viewIdForGuest(guestId)
    if (viewId) {
      const documentUrl = documentUrlFor(guestId)
      const hardened = applyProtectionHeaders(
        details.requestHeaders,
        details.url,
        documentUrl,
        options.policy
      )
      if (hardened.changed > 0) {
        countHeaders(options, hardened.changed)
        if (hardened.trimmedReferer) noteProtectionRefererTrimmed()
        callback({ requestHeaders: hardened.headers })
        return
      }
    }
    callback({})
    return
  }

  let headers = toPairs(details.requestHeaders)
  // Rules only run in dev mode; the capture itself is redacted only in extreme mode.
  if (enabled && areRulesEnabled()) headers = applyHeaderRules(record, headers).headers
  /**
   * A session-level policy is enforced even while the panel is recording.
   *
   * Dev mode deliberately leaves the profile's traffic alone so what you see is what the page
   * does. A private tab is not a capture setting though: it promises the tab's headers are
   * hardened, so the policy is applied on top of the rules and the capture shows what actually
   * went out.
   */
  if (options.policy) {
    const hardened = applyProtectionHeaders(
      toHeaderRecord(headers),
      details.url,
      documentUrlFor(details.webContentsId),
      options.policy
    )
    if (hardened.changed > 0) {
      headers = toPairs(hardened.headers)
      countHeaders(options, hardened.changed)
      if (hardened.trimmedReferer) noteProtectionRefererTrimmed()
    }
  }
  // The capture can be redacted; the request that goes out must not be.
  record.headers = isWimhActive() ? redactCaptureHeaders(id, headers) : headers

  const shouldHold =
    enabled && areRulesEnabled() && (pauseAll || Boolean(firstMatching('pause', record.url)))
  if (shouldHold && holds.size < limits.maxPaused) {
    hold(id, record, callback, headers)
    return
  }

  queue({ type: 'start', request: record })
  callback({ requestHeaders: toHeaderRecord(headers) })
}

/**
 * Force the desktop Chrome UA on every request that reaches an identity provider.
 *
 * Electron's `webRequest` allows a single listener per event, so this is folded into the session's
 * `onBeforeSendHeaders` rather than a second registration: when the URL is a provider host and the
 * incoming UA still admits to being an Electron build, the header is replaced before the normal
 * pipeline runs, so the provider never sees the `Electron` token that triggers its "Couldn't sign
 * you in" refusal. A request that already carries a clean UA is left untouched.
 */
function applyIdentityProviderUserAgent(
  details: Electron.OnBeforeSendHeadersListenerDetails
): void {
  let host = ''
  try {
    host = new URL(details.url).hostname
  } catch {
    return
  }
  const isIdentityProvider =
    host === 'accounts.google.com' ||
    (host.endsWith('.google.com') && host !== 'google.com') ||
    host.endsWith('.googleusercontent.com')
  if (!isIdentityProvider) return

  const incoming = details.requestHeaders['User-Agent'] ?? details.requestHeaders['user-agent']
  if (incoming !== undefined && !/\bElectron\b/i.test(String(incoming))) return
  details.requestHeaders['User-Agent'] = desktopChromeUserAgent()
}

/** The document a request is being made from, used only to decide what counts as cross-site. */
function documentUrlFor(webContentsId: number | undefined): string | null {
  try {
    if (webContentsId === undefined) return null
    const contents = webContents.fromId(webContentsId)
    return contents && !contents.isDestroyed() ? contents.getURL() || null : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ *
 * Pause / resume
 * ------------------------------------------------------------------ */

function hold(
  id: string,
  record: CapturedRequest,
  callback: (response: { cancel?: boolean; requestHeaders?: Record<string, string | string[]> }) => void,
  liveHeaders: HeaderPair[]
): void {
  const expiresAt = Date.now() + limits.pauseTimeoutMs
  const timer = setTimeout(() => settle(id, 'timeout'), limits.pauseTimeoutMs)

  holds.set(id, { resolve: callback, timer, original: liveHeaders, startedAt: record.startedAt })
  record.paused = true

  const paused: PausedRequest = {
    id,
    viewId: record.viewId,
    url: record.url,
    method: record.method,
    resourceType: record.resourceType,
    headers: record.headers,
    bodyPreview: record.bodyPreview,
    startedAt: record.startedAt,
    expiresAt
  }

  queue({ type: 'start', request: record })
  queue({ type: 'paused', paused })
  broadcastState()
}

function settle(
  id: string,
  resolution: 'continued' | 'dropped' | 'timeout' | 'disabled',
  headers?: HeaderPair[]
): void {
  const hold = holds.get(id)
  if (!hold) return

  clearTimeout(hold.timer)
  holds.delete(id)

  const record = records.get(id)
  if (record) {
    record.paused = false
    if (headers) record.headers = headers
  }

  try {
    if (resolution === 'dropped') {
      if (record) {
        record.error = 'dropped by operator'
        record.modifiedHeaders = [...record.modifiedHeaders, 'dropped']
      }
      hold.resolve({ cancel: true })
    } else if (resolution === 'timeout') {
      if (record) record.modifiedHeaders = [...record.modifiedHeaders, 'auto-resumed (timeout)']
      hold.resolve({ requestHeaders: toHeaderRecord(hold.original) })
    } else {
      hold.resolve({ requestHeaders: toHeaderRecord(headers ?? hold.original) })
    }
  } catch (error) {
    // The request can already be gone (navigation, cancel, shutdown).
    console.warn('[devlens] could not resolve a held request', error)
  }

  if (record && resolution !== 'continued') queue({ type: 'update', request: record })
  if (resolution !== 'dropped' && record) {
    // A resumed request still needs its `start` event if the panel never saw it.
    queue({ type: 'start', request: record })
  }
  queue({ type: 'resumed', id, resolution })
  broadcastState()
}

function releaseAll(resolution: 'continued' | 'disabled'): void {
  for (const id of [...holds.keys()]) settle(id, resolution)
}

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

function firstMatching(kind: InterceptorRule['kind'], url: string): InterceptorRule | null {
  for (const rule of rules) {
    if (!rule.enabled || rule.kind !== kind) continue
    if (matchesPattern(rule.pattern, url)) return rule
  }
  return null
}

function applyHeaderRules(
  record: CapturedRequest,
  headers: HeaderPair[]
): { headers: HeaderPair[] } {
  let next = headers
  const touched: string[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue
    if (rule.kind !== 'set-header' && rule.kind !== 'remove-header') continue
    if (!rule.header || !matchesPattern(rule.pattern, record.url)) continue

    rule.hits += 1
    dirtyRules.add(rule.id)
    const name = rule.header.trim()
    if (!name) continue
    touched.push(name)

    next =
      rule.kind === 'set-header'
        ? upsertHeader(next, name, rule.value ?? '')
        : next.filter((pair) => pair.name.toLowerCase() !== name.toLowerCase())
  }

  if (touched.length > 0) {
    record.modifiedHeaders = [...new Set([...record.modifiedHeaders, ...touched])]
  }
  return { headers: next }
}

/**
 * A pattern containing `*` is a glob (matched anywhere in the URL), anything else is a
 * case-insensitive substring. That covers both "every request to this host" and
 * "this one query string" without making operators write regexes.
 */
export function matchesPattern(pattern: string, url: string): boolean {
  const trimmed = (pattern ?? '').trim()
  if (!trimmed) return false

  if (trimmed.includes('*')) {
    const escaped = trimmed.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    try {
      return new RegExp(escaped, 'i').test(url)
    } catch {
      return false
    }
  }
  return url.toLowerCase().includes(trimmed.toLowerCase())
}

/** Keeps only the fields the rule kind actually uses, so nothing leaks into the report. */
function sanitiseRule(rule: InterceptorRule): InterceptorRule {
  const headerKind = rule.kind === 'set-header' || rule.kind === 'remove-header'
  return {
    id:
      typeof rule.id === 'string' && rule.id
        ? rule.id.slice(0, 100)
        : `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: rule.kind,
    pattern: String(rule.pattern ?? '').slice(0, 2000),
    enabled: rule.enabled !== false,
    header: headerKind ? String(rule.header ?? '').slice(0, 200) : undefined,
    value: rule.kind === 'set-header' ? String(rule.value ?? '').slice(0, 8192) : undefined,
    target: rule.kind === 'redirect' ? String(rule.target ?? '').slice(0, REPEATER_MAX_URL) : undefined,
    note: typeof rule.note === 'string' ? rule.note.slice(0, 500) : rule.note,
    hits: rule.hits ?? 0
  }
}

/* ------------------------------------------------------------------ *
 * Repeater
 * ------------------------------------------------------------------ */

export async function sendRepeater(request: RepeaterRequest): Promise<RepeaterResponse> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REPEATER_TIMEOUT_MS)

  try {
    if (request.url.length > REPEATER_MAX_URL) throw new Error('The request URL is too long.')
    if (request.body.length > REPEATER_MAX_REQUEST_BODY) {
      throw new Error('The repeater body is larger than 2 MB.')
    }
    const url = new URL(request.url)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${url.protocol}`)
    }

    const method = (request.method || 'GET').toUpperCase()
    const headers = new Headers()
    for (const pair of cleanHeaders(request.headers)) {
      const name = pair.name.toLowerCase()
      if (MANAGED_HEADERS.has(name) || name.startsWith(':')) continue
      headers.set(pair.name, pair.value)
    }

    const canSendBody = !['GET', 'HEAD'].includes(method)
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: canSendBody && request.body.length > 0 ? request.body : undefined,
      signal: controller.signal,
      redirect: 'follow'
    })

    const { text, truncated } = await readTextLimited(response, REPEATER_MAX_BODY)
    return {
      ok: true,
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      durationMs: Date.now() - started,
      headers: [...response.headers.entries()].map(([name, value]) => ({ name, value })),
      body: text,
      truncated,
      error: null
    }
  } catch (error) {
    return {
      ok: false,
      status: null,
      statusText: '',
      url: request.url,
      durationMs: Date.now() - started,
      headers: [],
      body: '',
      truncated: false,
      error: describeError(error)
    }
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ *
 * Capture bookkeeping and event batching
 * ------------------------------------------------------------------ */

function remember(record: CapturedRequest): void {
  records.set(record.id, record)
  while (records.size > limits.bufferSize) {
    const oldest = records.keys().next()
    if (oldest.done) break
    records.delete(oldest.value)
  }
}

function finish(
  record: CapturedRequest,
  statusCode: number | null,
  error: string | null,
  details?: Electron.OnCompletedListenerDetails
): void {
  record.statusCode = statusCode
  record.error = error
  record.durationMs = Date.now() - record.startedAt
  if (details) {
    if (details.responseHeaders) {
      record.responseHeaders = toPairs(details.responseHeaders)
      record.mimeType =
        record.responseHeaders
          .find((header) => header.name.toLowerCase() === 'content-type')
          ?.value.split(';')[0]
          ?.trim() || null
    }
    record.fromCache = details.fromCache === true
  }
  records.delete(record.id)

  queue({ type: 'update', request: record })

  const failed = Boolean(error) || (statusCode !== null && statusCode >= 400)
  if (!failed) return

  const entry: NetworkEntry = {
    kind: 'network',
    id: record.id,
    guestId: -1,
    viewId: record.viewId ?? 'desktop',
    method: record.method,
    url: record.url,
    resourceType: record.resourceType,
    statusCode,
    error,
    durationMs: record.durationMs,
    timestamp: Date.now()
  }
  emitNetworkEntry(entry)
}

function queue(event: RequestEvent): void {
  pending.push(event)
  if (pending.length >= MAX_BATCH) {
    flush()
    return
  }
  if (flushTimer) return
  flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS)
}

/**
 * Requests arrive in bursts; sending one IPC message per lifecycle step would drown the
 * renderer on a busy page, so events are batched on a short timer.
 */
function flush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (pending.length === 0) return

  if (dirtyRules.size > 0) {
    pending.push({ type: 'rules', rules })
    dirtyRules.clear()
  }

  const batch = pending
  pending = []
  emit(IPC.interceptorEvents, batch)
}

function broadcastState(): void {
  emit(IPC.interceptorStateChanged, interceptorSnapshot())
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

interface UploadedBody {
  preview: string | null
  truncated: boolean
  has: boolean
}

function readBody(uploadData: Electron.UploadData[] | undefined): UploadedBody {
  const items = uploadData ?? []
  if (items.length === 0) return { preview: null, truncated: false, has: false }

  const parts: string[] = []
  let truncated = false

  for (const item of items) {
    const bytes = item.bytes as Buffer | undefined
    if (bytes && bytes.length > 0) {
      const text = Buffer.from(bytes).toString('utf-8')
      if (text.length > BODY_PREVIEW_CHARS) {
        parts.push(`${text.slice(0, BODY_PREVIEW_CHARS)}\n... (truncated)`)
        truncated = true
      } else {
        parts.push(text)
      }
      continue
    }
    const file = (item as { file?: string }).file
    if (file) {
      parts.push(`<file upload: ${file}>`)
      continue
    }
    if (item.blobUUID) parts.push('<blob upload>')
  }

  return { preview: parts.length > 0 ? parts.join('\n') : null, truncated, has: true }
}

function toPairs(headers: Record<string, string | string[]>): HeaderPair[] {
  return Object.entries(headers).map(([name, value]) => ({
    name,
    value: Array.isArray(value) ? value.join(', ') : String(value)
  }))
}

function toHeaderRecord(headers: HeaderPair[]): Record<string, string> {
  const record: Record<string, string> = {}
  for (const pair of headers) {
    const name = pair.name.trim()
    if (!name) continue
    record[name] = pair.value
  }
  return record
}

function cleanHeaders(headers: HeaderPair[]): HeaderPair[] {
  return headers
    .slice(0, REPEATER_MAX_HEADERS)
    .map((pair) => ({
      name: String(pair?.name ?? '').trim().slice(0, 200),
      value: String(pair?.value ?? '').slice(0, 8192)
    }))
    .filter((pair) => pair.name.length > 0)
}

async function readTextLimited(
  response: Response,
  maxBytes: number
): Promise<{ text: string; truncated: boolean }> {
  const reader = response.body?.getReader()
  if (!reader) return { text: '', truncated: false }
  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      const remaining = maxBytes - total
      if (value.byteLength > remaining) {
        if (remaining > 0) chunks.push(value.subarray(0, remaining))
        truncated = true
        await reader.cancel().catch(() => undefined)
        break
      }
      chunks.push(value)
      total += value.byteLength
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
  return { text: new TextDecoder().decode(bytes), truncated }
}

function upsertHeader(headers: HeaderPair[], name: string, value: string): HeaderPair[] {
  const lower = name.toLowerCase()
  const index = headers.findIndex((pair) => pair.name.toLowerCase() === lower)
  if (index < 0) return [...headers, { name, value }]
  const next = [...headers]
  next[index] = { name, value }
  return next
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return `Request aborted after ${REPEATER_TIMEOUT_MS / 1000}s`
    return error.cause ? `${error.message} (${String(error.cause)})` : error.message
  }
  return String(error)
}

/**
 * WImH capture hygiene: credential-shaped values are replaced before they can reach the UI,
 * the recon report or an AI prompt, and the originals are registered for zeroing.
 */
function redactCaptureHeaders(id: string, headers: HeaderPair[]): HeaderPair[] {
  return headers.map((pair) => {
    if (!SENSITIVE_HEADERS.includes(pair.name.toLowerCase()) || pair.value.length === 0) return pair
    registerSecret(`header:${id}:${pair.name.toLowerCase()}`, pair.value)
    noteRedactedField(`header ${pair.name}`)
    return { name: pair.name, value: `<redacted: ${pair.value.length} chars>` }
  })
}

function redactBodyPreview(id: string, preview: string | null): string | null {
  if (!preview) return preview
  const verdict = classifyClipboardText(preview)
  if (!verdict.secret) return preview
  registerSecret(`body:${id}`, preview)
  noteRedactedField(`request body (${verdict.reason})`)
  return `<redacted: ${verdict.reason}, ${preview.length} chars>`
}
