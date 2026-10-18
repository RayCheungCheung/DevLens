/**
 * Types shared by the main process, the preload bridges and the React renderer.
 * Everything here must stay dependency-free so it can be bundled in all three targets.
 */

import type { ProtectionLevel, ProtectionPolicy } from './protection'

export type ViewportId = 'mobile' | 'desktop'

export type ViewportPhase = 'idle' | 'loading' | 'ready' | 'failed'

export type ConsoleLevel = 'debug' | 'info' | 'log' | 'warn' | 'error'

export type LogKind = 'console' | 'network'

/** One line in the "Console & Network" panel. */
export interface ConsoleLogEntry {
  kind: 'console'
  id: string
  guestId: number
  viewId: ViewportId
  level: ConsoleLevel
  message: string
  /** URL of the script that produced the message (empty for injected scripts). */
  sourceUrl: string
  line: number
  timestamp: number
}

/** One failed / non-2xx request in the "Console & Network" panel. */
export interface NetworkEntry {
  kind: 'network'
  id: string
  guestId: number
  viewId: ViewportId
  method: string
  url: string
  resourceType: string
  statusCode: number | null
  error: string | null
  durationMs: number | null
  timestamp: number
}

export type LogEntry = ConsoleLogEntry | NetworkEntry

/** Sent by the renderer once a <webview> is attached, so main can tag its traffic. */
export interface GuestRegistration {
  viewId: ViewportId
  guestId: number
  /**
   * The partition the guest is actually on.
   *
   * Main cannot read it back from a `WebContents` - a `Session` does not expose its own name - and
   * it needs it for exactly one thing: a popup this guest opens has to be created *on the same
   * partition*. Without it a sign-in popup lands on the default session, which has none of the
   * cookies the page just set, and the flow ends in a 401 that looks like a redirect bug.
   */
  partition?: string
}

export interface GuestStatusEvent {
  viewId: ViewportId
  guestId: number
  phase: ViewportPhase
  url: string | null
  title: string | null
  errorCode: number | null
  errorDescription: string | null
  timestamp: number
}

/** Everything the renderer needs to boot: file paths, IDE target and the home URL. */
export interface BootstrapPayload {
  /** file:// URL of the preload script injected into every <webview>. */
  guestPreloadUrl: string
  /** Electron partition shared by both viewports (also used for request interception). */
  partition: string
  /** Configured start page, or null when DevLens should open the dashboard. */
  homeUrl: string | null
  /** True when the shell should present the dashboard first. */
  startOnDashboard: boolean
  mobile: { width: number; height: number }
  workspaceRoot: string
  ide: {
    scheme: string
    entryFile: string
    entryLine: number
  }
  /** Where text exports are written without a dialog, when configured. */
  reportOutputDir: string | null
  /** In-memory partition used by ghost mode; swapped in when `*` is used. */
  ghostPartition: string
  /** In-memory partition used by extreme defense mode. */
  wimhPartition: string
  /** Engine used when omnibox input is a query rather than an address. */
  searchEngine: 'google' | 'brave' | 'duckduckgo'
  /** How many visited pages to keep for suggestions. */
  historyLimit: number
  /** Workspace mode DevLens booted in. */
  mode: 'normal' | 'dev'
  /** Protection level the engine starts with (levels are per-session, never persisted). */
  protection: ProtectionLevel
  /** True when the shell should ask "who is using DevLens?" before showing the browser. */
  profileAsk: boolean
  /** Id of the profile the session starts on. */
  profileId: string
  /** Partition of the active browser profile. */
  profilePartition: string
  /** New tab dashboard configuration. */
  ntp: {
    servers: { label: string; url: string }[]
    openOnStart: boolean
  }
  configPath: string | null
}

/** "Open in IDE" request: either an explicit file path or a source URL from the log panel. */
export interface OpenInIdeRequest {
  filePath?: string
  sourceUrl?: string
  line?: number
}

export interface OpenInIdeResult {
  ok: boolean
  uri: string | null
  resolvedPath: string | null
  error: string | null
}

/** Scroll telemetry pushed from a guest viewport to the shell (see src/preload/webview.ts). */
export interface ScrollSyncMessage {
  /** scrollTop / (scrollHeight - innerHeight), clamped to 0..1. */
  ratio: number
  scrollTop: number
  scrollHeight: number
  innerHeight: number
}

/* ------------------------------------------------------------------ *
 * AI debugger
 * ------------------------------------------------------------------ */

export type AiProviderId = 'mock' | 'openai' | 'ollama'

export type AiReasoningMode = 'Fast' | 'Balanced' | 'Deep'

/** Everything the UI needs to describe the configured provider. */
export interface AiProviderInfo {
  provider: AiProviderId
  model: string
  baseUrl: string | null
  /** False when the provider needs an API key that is not present in the environment. */
  configured: boolean
  detail: string
}

/** A context attachment added to a prompt (console digest, recon summary, ...). */
export interface AiContextChip {
  id: string
  label: string
  body: string
}

export interface AiAskRequest {
  prompt: string
  chips: AiContextChip[]
  mode: AiReasoningMode
  /** Short description of the active viewport, e.g. "mobile 375x812". */
  viewport: string
}

export interface AiAskResult {
  streamId: string
  provider: AiProviderId
  model: string
}

/** Streamed over IPC while a completion is running. */
export interface AiStreamEvent {
  streamId: string
  type: 'start' | 'delta' | 'done' | 'error'
  text?: string
  error?: string
  provider?: AiProviderId
  model?: string
}

/* ------------------------------------------------------------------ *
 * HTTP interceptor and repeater
 * ------------------------------------------------------------------ */

export type InterceptorRuleKind = 'block' | 'set-header' | 'remove-header' | 'redirect' | 'pause'

/**
 * Rules are evaluated for every guest request. `pattern` matches the full URL:
 * a value containing `*` is treated as a glob, anything else as a substring.
 */
export interface InterceptorRule {
  id: string
  kind: InterceptorRuleKind
  pattern: string
  enabled: boolean
  /** `set-header` / `remove-header` */
  header?: string
  value?: string
  /** `redirect` */
  target?: string
  note?: string
  /** Matches seen since the rule was created. */
  hits: number
}

export interface InterceptorState {
  enabled: boolean
  /** Hold every guest request until the operator answers, not just rule matches. */
  pauseAll: boolean
  pausedCount: number
  capturedCount: number
  maxPaused: number
  pauseTimeoutMs: number
}

/** State plus rules: one round trip is enough for the panel to render itself. */
export interface InterceptorSnapshot {
  state: InterceptorState
  rules: InterceptorRule[]
}

export interface HeaderPair {
  name: string
  value: string
}

export interface CapturedRequest {
  id: string
  viewId: ViewportId | null
  url: string
  method: string
  resourceType: string
  startedAt: number
  statusCode: number | null
  error: string | null
  durationMs: number | null
  /** Rule id that cancelled the request, when a block rule matched. */
  blockedByRule: string | null
  /** Header names rewritten by rules. */
  modifiedHeaders: string[]
  paused: boolean
  headers: HeaderPair[]
  bodyPreview: string | null
  bodyTruncated: boolean
  hasBody: boolean
}

/** A request the operator is holding before it is sent. */
export interface PausedRequest {
  id: string
  viewId: ViewportId | null
  url: string
  method: string
  resourceType: string
  headers: HeaderPair[]
  bodyPreview: string | null
  startedAt: number
  expiresAt: number
}

export type RequestEvent =
  | { type: 'start'; request: CapturedRequest }
  | { type: 'update'; request: CapturedRequest }
  | { type: 'paused'; paused: PausedRequest }
  | { type: 'resumed'; id: string; resolution: 'continued' | 'dropped' | 'timeout' | 'disabled' }
  /** Rule hit counters, so the panel can show live usage without losing local edits. */
  | { type: 'rules'; rules: InterceptorRule[] }

export interface ResumeRequestPayload {
  id: string
  /** Replacement header list; omit to continue with the original headers. */
  headers?: HeaderPair[]
}

export interface RepeaterRequest {
  method: string
  url: string
  headers: HeaderPair[]
  body: string
}

export interface RepeaterResponse {
  ok: boolean
  status: number | null
  statusText: string
  url: string
  durationMs: number
  headers: HeaderPair[]
  body: string
  truncated: boolean
  error: string | null
}

/* ------------------------------------------------------------------ *
 * Design mode, file export and recon report
 * ------------------------------------------------------------------ */

export interface SaveTextRequest {
  /** Suggested file name, extension included. */
  filename: string
  content: string
  /** Shown in the save dialog title, e.g. "DevLens recon report". */
  title: string
}

export interface SaveTextResult {
  ok: boolean
  path: string | null
  error: string | null
  cancelled: boolean
}

export type ReportFormat = 'markdown' | 'json'

/* ------------------------------------------------------------------ *
 * Omnibox, history and session profiles
 * ------------------------------------------------------------------ */

/**
 * Session families a renderer can name when it asks for something to be cleared.
 *
 * `private` is the one that is not a single fixed partition: every max-protection tab owns one,
 * so the caller has to pass the partition it means along with the id.
 */
export type SessionProfileId = 'standard' | 'ghost' | 'wimh' | 'private'

export interface HistoryEntry {
  url: string
  title: string
  visitCount: number
  lastVisitedAt: number
}

/**
 * Where a bookmark lives. The toolbar is the strip under the address bar; the menu and "other"
 * are the places Firefox keeps the rest, and they rank in the omnibox just the same.
 */
export type BookmarkLocation = 'toolbar' | 'menu' | 'other'

/**
 * One cookie, as the storage inspector shows it.
 *
 * The value is truncated on the way out of the main process: an inspector is for names, flags and
 * shapes, and a four-kilobyte session token does not belong in a list row - nor in a renderer's
 * memory when it does not have to be there.
 */
export interface CookieRecord {
  name: string
  value: string
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  session: boolean
  /** Unix seconds, or null for a cookie that dies with the session. */
  expires: number | null
  sameSite: string
}

/** A locally saved page. Bookmarks never leave the machine. */
export interface BookmarkEntry {
  url: string
  title: string
  addedAt: number
  location: BookmarkLocation
  /**
   * The folder it sits in, when it is not filed directly on the root.
   *
   * `location` stays the root ('toolbar', 'menu', 'other') because that is what everything else
   * asks - the omnibox ranking, the star, the "which of the three places" question in the editor.
   * The folder is the extra detail the toolbar needs to draw the item where it was put.
   */
  folderId?: string | null
}

/** One node on the bookmarks bar, or inside a folder on it. */
export type BookmarkNodeKind = 'bookmark' | 'folder' | 'separator'

export interface BookmarkNode {
  id: string
  kind: BookmarkNodeKind
  addedAt: number
  /** Links only. */
  url?: string
  /** Links and folders. A separator has no name. */
  title?: string
  /** Folders only, in display order. */
  children?: BookmarkNode[]
}

/**
 * The three places a bookmark can live, each an ordered list.
 *
 * Order is the array order - dragging an item rewrites the array - so "the persistent order" is
 * not a separate list that could disagree with what is on screen.
 */
export interface BookmarkTree {
  toolbar: BookmarkNode[]
  menu: BookmarkNode[]
  other: BookmarkNode[]
}

/** Bar preferences, stored with the bookmarks so they survive a restart. */
export interface BookmarkOptions {
  /** Show the toolbar even when it holds nothing, the way Firefox's setting does. */
  toolbarVisible: boolean
  /** Show the "Other bookmarks" chip at the right end of the bar. */
  showOtherBookmarks: boolean
}

/**
 * One answer to "what do the bookmarks look like".
 *
 * Every mutation returns the whole snapshot and every change event carries it, so the flat list
 * the omnibox ranks and the tree the bar draws can never be two versions of the truth.
 */
export interface BookmarkSnapshot {
  /**
   * Bumped by every mutation.
   *
   * A mutation both answers its caller and broadcasts, and the two can arrive out of order; the
   * renderer keeps the highest revision it has seen and drops anything older, so a late reply
   * cannot undo a change that has already landed.
   */
  revision: number
  entries: BookmarkEntry[]
  tree: BookmarkTree
  options: BookmarkOptions
}

/** Where a dragged node is being dropped, relative to the node under the pointer. */
export type BookmarkDropPosition = 'before' | 'after' | 'inside'

/** Ghost mode: an in-memory session with trackers blocked and storage wiped on entry. */
export interface GhostSessionState {
  active: boolean
  partition: string
  blockedRequests: number
  enteredAt: number | null
}

/** `& <selector>` - one matched element in the active viewport. */
export interface FindHit {
  tag: string
  id: string
  classes: string[]
  /** Nearest React component name, when the element carries a fiber. */
  component: string | null
  text: string
}

export interface FindResult {
  viewId: ViewportId
  selector: string
  matches: number
  hits: FindHit[]
  error: string | null
}

/**
 * What was under a right-click in a page.
 *
 * The guest inspects its own DOM at the moment of the click - synchronously, before the shell is
 * told anything - and reports only facts: what is selected, whether the target is editable, the
 * link or the media the pointer landed on. The shell decides which rows that implies; the page
 * never proposes menu items, because a page that could name a shell command could also lie about
 * what it was.
 */
export interface PageContextMenuPayload {
  viewId: ViewportId
  x: number
  y: number
  /** `window.getSelection().toString()`, trimmed by the shell. */
  selection: string
  /** True when the target is or is inside an editable element. */
  editable: boolean
  /** The resolved URL of the nearest `<a href>`, if the click landed in one. */
  linkUrl: string | null
  /** The resolved `src` of the nearest media element, if the click landed on one. */
  mediaUrl: string | null
  /** `img` / `video` / `audio`, or null. */
  mediaKind: string | null
}

/** Page commands the shell's context menu can ask main to run in a guest. */
export type PageCommandKind =
  | 'copy'
  | 'cut'
  | 'paste'
  | 'select-all'
  | 'reload'
  | 'back'
  | 'forward'

/* ------------------------------------------------------------------ *
 * WImH extreme defense mode
 * ------------------------------------------------------------------ */

export type WimhEventCategory = 'ram-only' | 'memory' | 'window' | 'clipboard' | 'session'

export interface WimhEvent {
  id: string
  category: WimhEventCategory
  message: string
  detail: string | null
  timestamp: number
}

export interface WimhState {
  active: boolean
  /** In-memory partition used while the mode is on. */
  partition: string
  startedAt: number | null
  /** OS level capture protection on the DevLens windows. */
  contentProtection: boolean
  displayMediaBlocked: number
  ramOnly: {
    enforced: boolean
    partitionInMemory: boolean
    cookiesDowngraded: number
    storageWipes: number
    historyBlocked: number
  }
  memory: {
    liveScrubs: number
    scrubbedValues: number
    redactedFields: number
    lastScrubAt: number | null
    scrubAfterMs: number
  }
  clipboard: {
    enabled: boolean
    clearAfterMs: number
    guardedWrites: number
    purgedSecrets: number
    blockedPastes: number
    lastPurgeAt: number | null
    lastPurgeReason: string | null
  }
  events: WimhEvent[]
}

export interface ClipboardVerdict {
  secret: boolean
  reason: string
}

/**
 * Protection level state.
 *
 * `policy` is what the selected level asks for; the counters and `ramOnlySession` are what the
 * engine has actually done since the last switch, so the UI never has to claim something it
 * cannot show. No counter here ever leaves the machine.
 */
export interface ProtectionState {
  level: ProtectionLevel
  policy: ProtectionPolicy
  /** Requests cancelled by the level's blocklist since it was selected. */
  blockedRequests: number
  /** Requests whose headers the level rewrote. */
  scrubbedHeaders: number
  /** Cross-site referrers cut back to their origin. */
  trimmedReferers: number
  /** True while the viewports are actually on the in-memory defense session. */
  ramOnlySession: boolean
  /**
   * Hosts the operator has exempted for this session, one at a time from the site panel. An
   * exemption pauses cancellation for that site only; the level, the headers and the RAM-only
   * session are untouched, and nothing is written to disk.
   */
  allowedSites: string[]
  changedAt: number
}

/**
 * On-demand inspection lease.
 *
 * Normal mode has the monitoring pipeline switched off in the main process. The WImH overlay
 * is the one surface that may borrow it back: while the operator has the overlay open, this
 * process is allowed to observe traffic for it, and the moment the overlay closes the
 * observation stops and everything it held is dropped. Dev mode does not need a lease - it
 * observes for the whole session - which is why `source` distinguishes the two.
 */
export interface InspectionState {
  /** The overlay is open in the renderer. */
  open: boolean
  /** This process is currently observing traffic for the overlay. */
  capturing: boolean
  /** Where the permission comes from: the mode itself, the on-demand lease, or nowhere. */
  source: 'dev' | 'lease' | 'off'
  /** Requests observed during the current lease. Zeroed when the lease ends. */
  capturedCount: number
  /** Console lines observed during the current lease. Zeroed when the lease ends. */
  consoleCount: number
  grantedAt: number | null
}

/* ------------------------------------------------------------------ *
 * New tab dashboard
 * ------------------------------------------------------------------ */

export interface LocalServer {
  url: string
  host: string
  port: number
  label: string
  /** Value of the Server header, or the service a well known port usually serves. */
  service: string | null
  status: number | null
  reachable: boolean
  title: string | null
  source: 'probe' | 'config' | 'history' | 'pinned'
  pinned: boolean
}

export interface LocalServerScan {
  scannedAt: number
  probed: number
  servers: LocalServer[]
}

export interface WorkspaceEntry {
  path: string
  name: string
  packageName: string | null
  framework: string | null
  lastOpenedAt: number
  active: boolean
}

/* ------------------------------------------------------------------ *
 * Workspace mode and browser profiles
 * ------------------------------------------------------------------ */

/** Main-process truth for the active mode, mirrored into the renderer. */
export interface ModeState {
  mode: 'normal' | 'dev'
  switchedAt: number
  /** Enforcement snapshot, so the UI can explain what is actually off. */
  enforced: {
    monitoring: boolean
    rules: boolean
    authoring: boolean
    ai: boolean
    trackerBlocking: boolean
  }
}

/**
 * A browser profile: its own persistent partition, so cookies, localStorage, IndexedDB and
 * sessions never mix between identities.
 */
export interface BrowserProfile {
  id: string
  name: string
  /** Electron partition string, e.g. `persist:devlens-profile-work`. */
  partition: string
  createdAt: number
  lastUsedAt: number
  active: boolean
  /** False for the built-in profile, which cannot be deleted. */
  removable: boolean
  /** Avatar glyph, chosen when the profile is created. Rendered from the icon set, never fetched. */
  avatar?: ProfileAvatar
}

/** Avatar glyphs a profile can carry. */
export type ProfileAvatar = 'user' | 'briefcase' | 'laptop' | 'flask' | 'shield' | 'ghost' | 'star'

/** Identity settings that are not per profile: currently just the startup prompt. */
export interface ProfileSettings {
  askOnStartup: boolean
}
