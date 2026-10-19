import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { DevLensApi, Unsubscribe } from '../shared/api'
import type {
  AiAskRequest,
  AiAskResult,
  AiProviderInfo,
  AiStreamEvent,
  BootstrapPayload,
  BookmarkEntry,
  BookmarkLocation,
  BookmarkSnapshot,
  BookmarkDropPosition,
  CookieRecord,
  BrowserProfile,
  ConsoleLogEntry,
  GuestRegistration,
  GuestStatusEvent,
  GhostSessionState,
  HistoryEntry,
  ClipboardVerdict,
  PageCommandKind,
  InspectionState,
  LocalServerScan,
  ModeState,
  ProfileAvatar,
  ProfileSettings,
  ProtectionState,
  WimhState,
  WorkspaceEntry,
  InterceptorRule,
  InterceptorSnapshot,
  NetworkEntry,
  OpenInIdeRequest,
  OpenInIdeResult,
  RepeaterRequest,
  RepeaterResponse,
  RequestEvent,
  ResumeRequestPayload,
  SaveTextRequest,
  SaveTextResult,
  SessionProfileId
} from '../shared/types'
import type { ProtectionLevel } from '../shared/protection'
import type { PrivateTabState } from '../shared/private-tab'
import type { ProfilePreferences } from '../shared/preferences'
import type { OmniboxSettings } from '../shared/omnibox-settings'
import type {
  LaunchpadSession,
  LaunchpadSystemState,
  LaunchpadWeather
} from '../shared/launchpad'
import type { ProfileDiskUsage, ShieldRules } from '../shared/privacy'
import type { AppIconStyle, ContentThemeMode } from '../shared/appearance'
import type { LanguagePreferences } from '../shared/languages'

function subscribe<T>(channel: string, listener: (payload: T) => void): Unsubscribe {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

/**
 * The only surface the renderer can touch. No `ipcRenderer`, no Node: one entry per
 * operation the UI needs, each mapped to a single explicit channel.
 */
const api: DevLensApi = {
  /** Boot data: guest preload URL, partition, home URL and the IDE target. */
  getBootstrap: (): Promise<BootstrapPayload> => ipcRenderer.invoke(IPC.getBootstrap),

  /** Tell main which viewport a guest id belongs to (called on webview `did-attach`). */
  registerGuest: (registration: GuestRegistration): void =>
    ipcRenderer.send(IPC.registerGuest, registration),

  /** Closes this window: the renderer's Ctrl/Cmd+W with a single tab left. */
  windowClose: (): void => ipcRenderer.send(IPC.windowClose),

  /** Open a file (optionally at a line) in the configured editor via its URI scheme. */
  openInIde: (request: OpenInIdeRequest): Promise<OpenInIdeResult> =>
    ipcRenderer.invoke(IPC.openInIde, request),

  /** Console messages captured from the guests by the main process. */
  onConsoleLog: (listener: (entry: ConsoleLogEntry) => void): Unsubscribe =>
    subscribe(IPC.consoleLog, listener),

  /** Failed / non-2xx requests captured from the guests by the main process. */
  onNetworkEntry: (listener: (entry: NetworkEntry) => void): Unsubscribe =>
    subscribe(IPC.networkEntry, listener),

  /** Navigation lifecycle of a guest (loading / ready / failed). */
  onGuestStatus: (listener: (event: GuestStatusEvent) => void): Unsubscribe =>
    subscribe(IPC.guestStatus, listener),

  /* ---------------- AI debugger ---------------- */

  aiProviderInfo: (): Promise<AiProviderInfo> => ipcRenderer.invoke(IPC.aiProviderInfo),

  /** Starts a completion and returns its stream id; tokens arrive on `onAiStream`. */
  aiAsk: (request: AiAskRequest): Promise<AiAskResult> => ipcRenderer.invoke(IPC.aiAsk, request),

  aiAbort: (streamId: string): void => ipcRenderer.send(IPC.aiAbort, streamId),

  onAiStream: (listener: (event: AiStreamEvent) => void): Unsubscribe =>
    subscribe(IPC.aiStream, listener),

  /* ---------------- Interceptor and repeater ---------------- */

  interceptorState: (): Promise<InterceptorSnapshot> => ipcRenderer.invoke(IPC.interceptorGetState),

  interceptorSetEnabled: (enabled: boolean): Promise<InterceptorSnapshot> =>
    ipcRenderer.invoke(IPC.interceptorSetEnabled, enabled),

  interceptorSetPauseAll: (pauseAll: boolean): Promise<InterceptorSnapshot> =>
    ipcRenderer.invoke(IPC.interceptorSetPauseAll, pauseAll),

  interceptorSetRules: (rules: InterceptorRule[]): Promise<InterceptorSnapshot> =>
    ipcRenderer.invoke(IPC.interceptorSetRules, rules),

  /** Releases a held request. Headers replace the originals when provided. */
  interceptorResume: (payload: ResumeRequestPayload): void =>
    ipcRenderer.send(IPC.interceptorResume, payload),

  /** Fails a held request on purpose. */
  interceptorDrop: (id: string): void => ipcRenderer.send(IPC.interceptorDrop, id),

  interceptorClear: (): Promise<InterceptorSnapshot> => ipcRenderer.invoke(IPC.interceptorClear),

  onInterceptorEvents: (listener: (events: RequestEvent[]) => void): Unsubscribe =>
    subscribe(IPC.interceptorEvents, listener),

  onInterceptorState: (listener: (snapshot: InterceptorSnapshot) => void): Unsubscribe =>
    subscribe(IPC.interceptorStateChanged, listener),

  repeaterSend: (request: RepeaterRequest): Promise<RepeaterResponse> =>
    ipcRenderer.invoke(IPC.repeaterSend, request),

  /* ---------------- Output ---------------- */

  saveTextFile: (request: SaveTextRequest): Promise<SaveTextResult> =>
    ipcRenderer.invoke(IPC.saveTextFile, request),

  clipboardWrite: (text: string): Promise<boolean> => ipcRenderer.invoke(IPC.clipboardWrite, text),
  clipboardRead: (): Promise<string> => ipcRenderer.invoke(IPC.clipboardRead),
  /** Runs a page command in a guest, addressed by its webContents id. */
  pageCommand: (input: { webContentsId: number; command: PageCommandKind }): Promise<boolean> =>
    ipcRenderer.invoke(IPC.pageCommand, input),
  pageZoom: (webContentsId: number): Promise<number> =>
    ipcRenderer.invoke(IPC.pageZoom, webContentsId),
  pageZoomBy: (webContentsId: number, delta: number): Promise<number> =>
    ipcRenderer.invoke(IPC.pageZoomBy, webContentsId, delta),
  pageZoomSet: (webContentsId: number, percent: number): Promise<number> =>
    ipcRenderer.invoke(IPC.pageZoomSet, webContentsId, percent),
  onFindInPageRequested: (
    listener: (request: { webContentsId: number }) => void
  ): Unsubscribe => subscribe(IPC.findInPageRequested, listener),

  /* ---------------- Omnibox ---------------- */

  historyList: (limit?: number): Promise<HistoryEntry[]> => ipcRenderer.invoke(IPC.historyList, limit),

  historyAdd: (entry: { url: string; title: string; private?: boolean; tabId?: string }): void =>
    ipcRenderer.send(IPC.historyAdd, entry),

  historyClear: (): Promise<void> => ipcRenderer.invoke(IPC.historyClear),
  historyPrune: (days: number): Promise<number> => ipcRenderer.invoke(IPC.historyPrune, days),

  /** Saved pages: local only, ranked together with history in the omnibox. */
  bookmarksList: (): Promise<BookmarkEntry[]> => ipcRenderer.invoke(IPC.bookmarksList),
  bookmarksSnapshot: (): Promise<BookmarkSnapshot> => ipcRenderer.invoke(IPC.bookmarksSnapshot),
  bookmarksToggle: (entry: { url: string; title: string }): Promise<BookmarkSnapshot> =>
    ipcRenderer.invoke(IPC.bookmarksToggle, entry),
  bookmarksSave: (entry: {
    url: string
    title: string
    location: BookmarkLocation | string
  }): Promise<BookmarkSnapshot> => ipcRenderer.invoke(IPC.bookmarksSave, entry),
  bookmarksRemove: (url: string): Promise<BookmarkSnapshot> =>
    ipcRenderer.invoke(IPC.bookmarksRemove, url),
  onBookmarksChanged: (listener: (snapshot: BookmarkSnapshot) => void): Unsubscribe =>
    subscribe(IPC.bookmarksChanged, listener),

  /* ---------------- the bookmarks bar ---------------- */

  bookmarksCreateFolder: (input: { title: string; location?: string }): Promise<BookmarkSnapshot> =>
    ipcRenderer.invoke(IPC.bookmarksCreateFolder, input),
  bookmarksCreateSeparator: (input?: { location?: string }): Promise<BookmarkSnapshot> =>
    ipcRenderer.invoke(IPC.bookmarksCreateSeparator, input ?? {}),
  bookmarksRenameNode: (input: { id: string; title: string }): Promise<BookmarkSnapshot> =>
    ipcRenderer.invoke(IPC.bookmarksRenameNode, input),
  bookmarksRemoveNode: (id: string): Promise<BookmarkSnapshot> =>
    ipcRenderer.invoke(IPC.bookmarksRemoveNode, id),
  bookmarksMoveNode: (input: {
    id: string
    targetId?: string | null
    position?: BookmarkDropPosition
  }): Promise<BookmarkSnapshot> => ipcRenderer.invoke(IPC.bookmarksMoveNode, input),
  bookmarksClipboard: (input: {
    action: 'copy' | 'cut' | 'paste'
    id?: string
    location?: string
  }): Promise<{ snapshot: BookmarkSnapshot; message: string }> =>
    ipcRenderer.invoke(IPC.bookmarksClipboard, input),
  bookmarksSetOptions: (input: {
    toolbarVisible?: boolean
    showOtherBookmarks?: boolean
  }): Promise<BookmarkSnapshot> => ipcRenderer.invoke(IPC.bookmarksSetOptions, input),
  bookmarksOpenWindow: (input: {
    url: string
    private?: boolean
  }): Promise<{ ok: boolean; error: string | null }> =>
    ipcRenderer.invoke(IPC.bookmarksOpenWindow, input),
  bookmarksImport: (input?: { location?: string; file?: string }): Promise<{
    ok: boolean
    file: string | null
    imported: number
    skipped: number
    snapshot: BookmarkSnapshot
    error: string | null
  }> => ipcRenderer.invoke(IPC.bookmarksImport, input ?? {}),
  bookmarksExport: (input?: { file?: string }): Promise<{
    ok: boolean
    file: string | null
    format: 'html' | 'json' | null
    count: number
    error: string | null
  }> => ipcRenderer.invoke(IPC.bookmarksExport, input ?? {}),

  /* ---------------- per-profile preferences ---------------- */

  preferencesState: (): Promise<ProfilePreferences> => ipcRenderer.invoke(IPC.preferencesState),
  preferencesSet: (patch: Partial<ProfilePreferences>): Promise<ProfilePreferences> =>
    ipcRenderer.invoke(IPC.preferencesSet, patch),
  onPreferencesChanged: (listener: (preferences: ProfilePreferences) => void): Unsubscribe =>
    subscribe(IPC.preferencesChanged, listener),
  protectionSetShieldRules: (rules: ShieldRules): Promise<ProtectionState> =>
    ipcRenderer.invoke(IPC.protectionSetShieldRules, rules),
  privacyApplyNetwork: (input: {
    dnsMode: 'system' | 'secure' | 'off'
  }): Promise<{ dnsMode: string }> => ipcRenderer.invoke(IPC.privacyApplyNetwork, input),
  privacyDiskUsage: (): Promise<ProfileDiskUsage> => ipcRenderer.invoke(IPC.privacyDiskUsage),
  appearanceApplyTheme: (mode: ContentThemeMode): Promise<ContentThemeMode> =>
    ipcRenderer.invoke(IPC.appearanceApplyTheme, mode),
  appearanceSetAppIcon: (style: AppIconStyle): Promise<AppIconStyle> =>
    ipcRenderer.invoke(IPC.appearanceSetAppIcon, style),
  languagesApply: (
    input: Pick<LanguagePreferences, 'spellCheck' | 'spellCheckLanguages'>
  ): Promise<{ spellCheck: boolean; spellCheckLanguages: string[] }> =>
    ipcRenderer.invoke(IPC.languagesApply, input),
  launchpadSystemState: (): Promise<LaunchpadSystemState> =>
    ipcRenderer.invoke(IPC.launchpadSystemState),
  launchpadSetDefaultBrowser: (): Promise<LaunchpadSystemState> =>
    ipcRenderer.invoke(IPC.launchpadSetDefaultBrowser),
  launchpadSetLaunchAtLogin: (enabled: boolean): Promise<LaunchpadSystemState> =>
    ipcRenderer.invoke(IPC.launchpadSetLaunchAtLogin, enabled),
  launchpadSaveSession: (session: LaunchpadSession): Promise<LaunchpadSession> =>
    ipcRenderer.invoke(IPC.launchpadSaveSession, session),
  launchpadPickWallpaper: (): Promise<{
    ok: boolean
    dataUrl: string | null
    error: string | null
  }> => ipcRenderer.invoke(IPC.launchpadPickWallpaper),
  launchpadWeather: (place: string): Promise<LaunchpadWeather> =>
    ipcRenderer.invoke(IPC.launchpadWeather, place),

  /* The omnibox control panel: the same store, addressed by the page's own route. */
  omniboxSettingsGet: (): Promise<OmniboxSettings> => ipcRenderer.invoke(IPC.omniboxSettingsGet),
  omniboxSettingsSet: (settings: OmniboxSettings): Promise<OmniboxSettings> =>
    ipcRenderer.invoke(IPC.omniboxSettingsSet, settings),
  onOmniboxSettingsChanged: (listener: (settings: OmniboxSettings) => void): Unsubscribe =>
    subscribe(IPC.omniboxSettingsChanged, listener),

  /**
   * A guest asked for a new tab (`target=_blank`, ctrl-click, middle-click).
   *
   * Main sees the request on the guest's `setWindowOpenHandler` and cannot open a tab itself - the
   * tab strip belongs to the renderer - so it forwards the URL here.
   */
  onGuestOpenTab: (listener: (request: { url: string; partition?: string }) => void): Unsubscribe =>
    subscribe(IPC.guestOpenTab, listener),

  /** The site's own icon, fetched by main and returned as a data URL. */
  faviconGet: (pageUrl: string): Promise<{ dataUrl: string | null; source: string | null }> =>
    ipcRenderer.invoke(IPC.faviconGet, pageUrl),

  /**
   * DOM-candidate icon: the page's `link[rel*='icon']` hrefs, resolved and fetched by main.
   * Used when the plain `/favicon.ico` request came back empty.
   */
  faviconExtract: (
    pageUrl: string,
    hrefs: string[]
  ): Promise<{ dataUrl: string | null; source: string | null }> =>
    ipcRenderer.invoke(IPC.faviconExtract, pageUrl, hrefs),

  /** Ghost mode: isolated in-memory session with trackers blocked. */
  ghostState: (): Promise<GhostSessionState> => ipcRenderer.invoke(IPC.ghostState),
  ghostEnter: (target?: string): Promise<GhostSessionState> =>
    ipcRenderer.invoke(IPC.ghostEnter, target),
  ghostExit: (): Promise<GhostSessionState> => ipcRenderer.invoke(IPC.ghostExit),
  onGhostChanged: (listener: (state: GhostSessionState) => void): Unsubscribe =>
    subscribe(IPC.ghostChanged, listener),

  /** `:clear-cache` - wipes cache, cookies and storage for a profile. */
  sessionClearData: (
    profile?: SessionProfileId,
    partition?: string
  ): Promise<{ ok: boolean; cleared: string[] }> =>
    ipcRenderer.invoke(IPC.sessionClearData, { profile, partition }),

  /** "Forget this site": cookies and storage for one origin. */
  sessionClearSite: (
    url: string,
    partition?: string
  ): Promise<{ ok: boolean; cleared: string[]; origin: string; error: string | null }> =>
    ipcRenderer.invoke(IPC.sessionClearSite, { url, partition }),

  /** `:sandbox` - opens the target in a bare, isolated window. */
  openSandbox: (url: string): Promise<{ ok: boolean; error: string | null }> =>
    ipcRenderer.invoke(IPC.sandboxOpen, url),

  /** The storage inspector: cookies for one origin, in the session the page is on. */
  cookiesList: (input: { url: string; partition?: string }): Promise<CookieRecord[]> =>
    ipcRenderer.invoke(IPC.cookiesList, input),
  cookiesRemove: (input: { url: string; name: string; partition?: string }): Promise<boolean> =>
    ipcRenderer.invoke(IPC.cookiesRemove, input),

  /* ---------------- max-protection private tabs ---------------- */

  /** Registers a tab's own in-memory session; called before its viewport is mounted. */
  privateTabOpen: (tabId: string): Promise<PrivateTabState> =>
    ipcRenderer.invoke(IPC.privateTabOpen, tabId),

  /** Wipes that session and drops the registry entry when the tab closes. */
  privateTabClose: (tabId: string): Promise<PrivateTabState | null> =>
    ipcRenderer.invoke(IPC.privateTabClose, tabId),

  privateTabs: (): Promise<PrivateTabState[]> => ipcRenderer.invoke(IPC.privateTabsState),

  onPrivateTabsChanged: (listener: (tabs: PrivateTabState[]) => void): Unsubscribe =>
    subscribe(IPC.privateTabsChanged, listener),

  /* ---------------- WImH extreme defense mode ---------------- */

  wimhState: (): Promise<WimhState> => ipcRenderer.invoke(IPC.wimhState),
  wimhSetEnabled: (enabled: boolean): Promise<WimhState> =>
    ipcRenderer.invoke(IPC.wimhSetEnabled, enabled),
  wimhSetClipboardTtl: (ms: number): Promise<WimhState> =>
    ipcRenderer.invoke(IPC.wimhSetClipboardTtl, ms),
  wimhScrub: (): Promise<WimhState> => ipcRenderer.invoke(IPC.wimhScrub),
  /** Classifies clipboard text before the omnibox is allowed to accept a paste. */
  wimhCheckClipboard: (text: string): Promise<ClipboardVerdict> =>
    ipcRenderer.invoke(IPC.wimhCheckClipboard, text),
  wimhNotePasteBlocked: (reason: string): Promise<WimhState> =>
    ipcRenderer.invoke(IPC.wimhNotePasteBlocked, reason),
  onWimhChanged: (listener: (state: WimhState) => void): Unsubscribe =>
    subscribe(IPC.wimhChanged, listener),

  /* ---------------- on-demand inspection lease ---------------- */

  /** Reports the WImH overlay opening or closing; main arms capture only while it is open. */
  inspectionState: (): Promise<InspectionState> => ipcRenderer.invoke(IPC.inspectionState),
  inspectionSetOpen: (open: boolean): Promise<InspectionState> =>
    ipcRenderer.invoke(IPC.inspectionSetOpen, open),
  onInspectionChanged: (listener: (state: InspectionState) => void): Unsubscribe =>
    subscribe(IPC.inspectionChanged, listener),

  /* ---------------- protection levels ---------------- */

  /** The active level plus what the engine has actually done with it. */
  protectionState: (): Promise<ProtectionState> => ipcRenderer.invoke(IPC.protectionGetState),
  protectionSetLevel: (level: ProtectionLevel): Promise<ProtectionState> =>
    ipcRenderer.invoke(IPC.protectionSetLevel, level),
  protectionSetSiteAllowed: (site: string, allowed: boolean): Promise<ProtectionState> =>
    ipcRenderer.invoke(IPC.protectionSetSiteAllowed, { site, allowed }),
  onProtectionChanged: (listener: (state: ProtectionState) => void): Unsubscribe =>
    subscribe(IPC.protectionChanged, listener),

  /* ---------------- New tab dashboard ---------------- */

  /** Probes well known local dev ports and reports what answered. */
  scanLocalServers: (): Promise<LocalServerScan> => ipcRenderer.invoke(IPC.localServersScan),
  workspacesList: (): Promise<WorkspaceEntry[]> => ipcRenderer.invoke(IPC.workspacesList),
  workspacesAdd: (path: string): Promise<WorkspaceEntry[]> =>
    ipcRenderer.invoke(IPC.workspacesAdd, path),
  workspacesPick: (): Promise<WorkspaceEntry[]> => ipcRenderer.invoke(IPC.workspacesPick),
  workspacesRemove: (path: string): Promise<WorkspaceEntry[]> =>
    ipcRenderer.invoke(IPC.workspacesRemove, path),
  workspacesSetActive: (path: string): Promise<WorkspaceEntry[]> =>
    ipcRenderer.invoke(IPC.workspacesSetActive, path),

  /* ---------------- workspace mode and profiles ---------------- */

  /** Main-process truth for the active mode and what it enforces. */
  modeState: (): Promise<ModeState> => ipcRenderer.invoke(IPC.modeState),
  modeSet: (mode: 'normal' | 'dev'): Promise<ModeState> => ipcRenderer.invoke(IPC.modeSet, mode),
  onModeChanged: (listener: (state: ModeState) => void): Unsubscribe =>
    subscribe(IPC.modeChanged, listener),

  /** Profiles each own a persistent partition: cookies and storage stay separate. */
  profilesList: (): Promise<BrowserProfile[]> => ipcRenderer.invoke(IPC.profilesList),
  profilesCreate: (
    name: string | { name: string; avatar?: ProfileAvatar }
  ): Promise<BrowserProfile[]> => ipcRenderer.invoke(IPC.profilesCreate, name),
  profilesSwitch: (id: string): Promise<BrowserProfile[]> =>
    ipcRenderer.invoke(IPC.profilesSwitch, id),
  profilesDelete: (id: string): Promise<BrowserProfile[]> =>
    ipcRenderer.invoke(IPC.profilesDelete, id),
  onProfilesChanged: (listener: (profiles: BrowserProfile[]) => void): Unsubscribe =>
    subscribe(IPC.profilesChanged, listener),
  profilesSettings: (): Promise<ProfileSettings> => ipcRenderer.invoke(IPC.profilesSettings),
  profilesSetAskOnStartup: (ask: boolean): Promise<ProfileSettings> =>
    ipcRenderer.invoke(IPC.profilesSetAskOnStartup, ask)
}

contextBridge.exposeInMainWorld('devlens', api)
