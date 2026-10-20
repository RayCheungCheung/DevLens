import type {
  AiAskRequest,
  AiAskResult,
  AiProviderInfo,
  AiSignInWindowRequest,
  AiSignInWindowResult,
  AiStreamEvent,
  AboutInfo,
  BootstrapPayload,
  BookmarkEntry,
  BookmarkLocation,
  BookmarkSnapshot,
  BookmarkDropPosition,
  BrowserProfile,
  ClipboardVerdict,
  ConsoleLogEntry,
  CookieRecord,
  GhostSessionState,
  GuestRegistration,
  GuestStatusEvent,
  HistoryEntry,
  InspectionState,
  LocalServerScan,
  ModeState,
  InterceptorRule,
  InterceptorSnapshot,
  NetworkEntry,
  OpenInIdeRequest,
  OpenInIdeResult,
  PageCommandKind,
  PageCaptureRequest,
  ProfileAvatar,
  ProfileSettings,
  ProtectionState,
  RepeaterRequest,
  RepeaterResponse,
  RemoteFileRequest,
  RemoteImageResult,
  GuestInspectRequest,
  GuestInspectResult,
  RequestEvent,
  ResumeRequestPayload,
  SaveTextRequest,
  SaveTextResult,
  SessionProfileId,
  WimhState,
  WorkspaceEntry
} from './types'
import type { ProtectionLevel } from './protection'
import type { PrivateTabState } from './private-tab'
import type { ProfilePreferences, ProfilePreferencesPatch } from './preferences'
import type { OmniboxSettings } from './omnibox-settings'
import type {
  LaunchpadSession,
  LaunchpadSystemState,
  LaunchpadWeather
} from './launchpad'
import type {
  ClearBrowsingDataRequest,
  ClearBrowsingDataResult,
  ProfileDiskUsage,
  ShieldRules
} from './privacy'
import type { AppIconStyle, ContentThemeMode } from './appearance'
import type { LanguagePreferences } from './languages'
import type { IdeOption } from './ide'

export type Unsubscribe = () => void

/**
 * Contract for `window.devlens`, implemented in src/preload/index.ts and consumed by
 * the renderer. Declaring it here keeps both sides honest: the preload must satisfy the
 * interface and the UI gets full typing without importing Electron.
 */
export interface DevLensApi {
  getBootstrap(): Promise<BootstrapPayload>
  registerGuest(registration: GuestRegistration): void
  /** Closes the window: Ctrl/Cmd+W with a single tab left. */
  windowClose(): void
  openInIde(request: OpenInIdeRequest): Promise<OpenInIdeResult>
  ideList(): Promise<IdeOption[]>
  onConsoleLog(listener: (entry: ConsoleLogEntry) => void): Unsubscribe
  onNetworkEntry(listener: (entry: NetworkEntry) => void): Unsubscribe
  onGuestStatus(listener: (event: GuestStatusEvent) => void): Unsubscribe

  /* AI debugger */
  aiProviderInfo(): Promise<AiProviderInfo>
  aiAsk(request: AiAskRequest): Promise<AiAskResult>
  aiAbort(streamId: string): void
  onAiStream(listener: (event: AiStreamEvent) => void): Unsubscribe
  /** Opens a top-level provider sign-in window sharing the AI panel's partition. */
  aiOpenSignInWindow(request: AiSignInWindowRequest): Promise<AiSignInWindowResult>

  /* Interceptor and repeater */
  interceptorState(): Promise<InterceptorSnapshot>
  interceptorSetEnabled(enabled: boolean): Promise<InterceptorSnapshot>
  interceptorSetPauseAll(pauseAll: boolean): Promise<InterceptorSnapshot>
  interceptorSetRules(rules: InterceptorRule[]): Promise<InterceptorSnapshot>
  interceptorResume(payload: ResumeRequestPayload): void
  interceptorDrop(id: string): void
  interceptorClear(): Promise<InterceptorSnapshot>
  onInterceptorEvents(listener: (events: RequestEvent[]) => void): Unsubscribe
  onInterceptorState(listener: (snapshot: InterceptorSnapshot) => void): Unsubscribe
  repeaterSend(request: RepeaterRequest): Promise<RepeaterResponse>

  /* Output */
  saveTextFile(request: SaveTextRequest): Promise<SaveTextResult>
  clipboardWrite(text: string): Promise<boolean>
  /** The system clipboard's text, so Paste is only offered when it would actually paste. */
  clipboardRead(): Promise<string>
  /**
   * Runs a page command in a guest (copy, cut, paste, select all, reload, back, forward).
   *
   * The shell's context menu asks for the *command*, and main performs it on the guest: a page
   * cannot be trusted to paste into itself, and `document.execCommand('paste')` is refused in web
   * content anyway. The frame is addressed by its webContents id, which the shell already tracks
   * per viewport.
   */
  pageCommand(input: { webContentsId: number; command: PageCommandKind }): Promise<boolean>
  /** Opens DevTools at a guest point, or returns accessible role/name facts for that point. */
  guestInspect(input: GuestInspectRequest): Promise<GuestInspectResult>
  /** Downloads a link or image target and writes it through the native Save dialog. */
  remoteFileSave(request: RemoteFileRequest): Promise<SaveTextResult>
  /** Fetches an image target and returns it as a data URI for clipboard use. */
  remoteImageRead(url: string): Promise<RemoteImageResult>
  /** Copies a fetched image to the native image clipboard. */
  remoteImageCopy(url: string): Promise<{ ok: boolean; error: string | null }>
  /** Captures the visible guest page and saves it as a PNG. */
  pageCapture(request: PageCaptureRequest): Promise<SaveTextResult>
  /** Reads the guest DOM HTML and opens it in a dedicated source window. */
  pageViewSource(webContentsId: number): Promise<{ ok: boolean; error: string | null }>
  /** The guest's current zoom, as a whole percentage; 100 means default. */
  pageZoom(webContentsId: number): Promise<number>
  /** Nudges the guest's logarithmic zoom level and returns the resulting percentage. */
  pageZoomBy(webContentsId: number, delta: number): Promise<number>
  /** Sets the guest's zoom from a whole percentage and returns the value actually applied. */
  pageZoomSet(webContentsId: number, percent: number): Promise<number>
  /** A guest pressed Ctrl/Cmd+F while its page owned focus. */
  onFindInPageRequested(
    listener: (request: { webContentsId: number }) => void
  ): Unsubscribe
  onReloadViewportsRequested(listener: () => void): Unsubscribe

  /* Omnibox */
  historyList(limit?: number): Promise<HistoryEntry[]>
  /**
   * Remembers a visit. `private` marks a visit from a maximum-protection tab: main refuses to
   * store it, which is what keeps a private page out of every profile's suggestions.
   */
  historyAdd(entry: { url: string; title: string; private?: boolean; tabId?: string }): void
  historyClear(): Promise<void>
  /** Keeps only visits inside the selected number of days and returns the remaining count. */
  historyPrune(days: number): Promise<number>
  bookmarksList(): Promise<BookmarkEntry[]>
  /** The whole store: the flat list, the bar tree and the bar's preferences. */
  bookmarksSnapshot(): Promise<BookmarkSnapshot>
  bookmarksToggle(entry: { url: string; title: string }): Promise<BookmarkSnapshot>
  /** Saves or updates a bookmark with the name and location the editor collected. */
  bookmarksSave(entry: {
    url: string
    title: string
    /** One of the three roots, or a folder's id. */
    location: BookmarkLocation | string
  }): Promise<BookmarkSnapshot>
  /** Forgets one bookmark. */
  bookmarksRemove(url: string): Promise<BookmarkSnapshot>
  onBookmarksChanged(listener: (snapshot: BookmarkSnapshot) => void): Unsubscribe

  /* The bookmarks bar */
  /** Adds a folder to the bar, a root, or another folder. */
  bookmarksCreateFolder(input: { title: string; location?: string }): Promise<BookmarkSnapshot>
  /** Adds a divider. */
  bookmarksCreateSeparator(input?: { location?: string }): Promise<BookmarkSnapshot>
  /** Renames a folder; links are renamed through `bookmarksSave`. */
  bookmarksRenameNode(input: { id: string; title: string }): Promise<BookmarkSnapshot>
  /** Forgets one node, a folder's contents included. */
  bookmarksRemoveNode(id: string): Promise<BookmarkSnapshot>
  /** Reorders or re-files a node: the drop end of a drag. */
  bookmarksMoveNode(input: {
    id: string
    targetId?: string | null
    position?: BookmarkDropPosition
  }): Promise<BookmarkSnapshot>
  /** Cut, copy and paste, with the system clipboard as the paste fallback. */
  bookmarksClipboard(input: {
    action: 'copy' | 'cut' | 'paste'
    id?: string
    location?: string
  }): Promise<{ snapshot: BookmarkSnapshot; message: string }>
  bookmarksSetOptions(input: {
    toolbarVisible?: boolean
    showOtherBookmarks?: boolean
  }): Promise<BookmarkSnapshot>
  /** Opens an address in a separate window; `private` gives it its own wiped session. */
  bookmarksOpenWindow(input: {
    url: string
    private?: boolean
    preview?: boolean
  }): Promise<{ ok: boolean; error: string | null }>
  /**
   * Picks a bookmark file and merges it in.
   *
   * Netscape HTML (what every browser exports) and DevLens JSON are both read; `location` is a
   * root id or a folder id, so an import can land inside a folder. `imported` counts what was
   * added and `skipped` what was already saved.
   */
  bookmarksImport(input?: { location?: string; file?: string }): Promise<{
    ok: boolean
    file: string | null
    imported: number
    skipped: number
    snapshot: BookmarkSnapshot
    error: string | null
  }>
  /** Writes the whole profile's bookmarks out; the extension decides the format. */
  bookmarksExport(input?: { file?: string }): Promise<{
    ok: boolean
    file: string | null
    format: 'html' | 'json' | null
    count: number
    error: string | null
  }>

  /* Per-profile preferences */
  /** This profile's small preferences, e.g. which AI assistant it opens on. */
  preferencesState(): Promise<ProfilePreferences>
  preferencesSet(patch: ProfilePreferencesPatch): Promise<ProfilePreferences>
  onPreferencesChanged(listener: (preferences: ProfilePreferences) => void): Unsubscribe
  protectionSetShieldRules(rules: ShieldRules): Promise<ProtectionState>
  privacyApplyNetwork(input: {
    dnsMode: 'system' | 'secure' | 'off'
  }): Promise<{ dnsMode: string }>
  privacyDiskUsage(): Promise<ProfileDiskUsage>
  privacyClearBrowsingData(request: ClearBrowsingDataRequest): Promise<ClearBrowsingDataResult>
  privacyRunRetentionCleanup(): Promise<boolean>
  appearanceApplyTheme(mode: ContentThemeMode): Promise<ContentThemeMode>
  appearanceSetAppIcon(style: AppIconStyle): Promise<AppIconStyle>
  languagesApply(input: Pick<LanguagePreferences, 'spellCheck' | 'spellCheckLanguages'>): Promise<{
    spellCheck: boolean
    spellCheckLanguages: string[]
  }>
  /** OS integration shown by `devlens:settings/home`. */
  launchpadSystemState(): Promise<LaunchpadSystemState>
  launchpadSetDefaultBrowser(): Promise<LaunchpadSystemState>
  launchpadSetLaunchAtLogin(enabled: boolean): Promise<LaunchpadSystemState>
  /** Persists the restorable tab list in the profile's preference store. */
  launchpadSaveSession(session: LaunchpadSession): Promise<LaunchpadSession>
  /** Opens an image picker and returns a bounded data URL for the Launchpad wallpaper. */
  launchpadPickWallpaper(): Promise<{
    ok: boolean
    dataUrl: string | null
    error: string | null
  }>
  launchpadWeather(place: string): Promise<LaunchpadWeather>
  /**
   * The omnibox store used by `devlens:settings/search`: the same per-profile preferences the
   * general settings page reaches.
   */
  omniboxSettingsGet(): Promise<OmniboxSettings>
  omniboxSettingsSet(settings: OmniboxSettings): Promise<OmniboxSettings>
  onOmniboxSettingsChanged(listener: (settings: OmniboxSettings) => void): Unsubscribe
  /**
   * System and version information for `devlens:settings/about`: the app, Electron, Node and
   * Chromium versions, the OS and architecture, and the update service status.
   */
  aboutInfo(): Promise<AboutInfo>
  downloadsDefaultDirectory(): Promise<string>
  /** Select and save a folder for the profile that opened the native picker. */
  downloadsPickDirectory(): Promise<boolean>
  /**
   * A guest asked for a new tab (`target=_blank`, ctrl-click): main forwards the URL and the shell
   * opens it in the strip, because the tab strip is the renderer's.
   */
  onGuestOpenTab(listener: (request: { url: string; partition?: string }) => void): Unsubscribe
  ghostState(): Promise<GhostSessionState>
  ghostEnter(target?: string): Promise<GhostSessionState>
  ghostExit(): Promise<GhostSessionState>
  onGhostChanged(listener: (state: GhostSessionState) => void): Unsubscribe
  /**
   * Wipes a profile's cache and storage. A private tab passes its own partition, because there
   * is one per tab.
   */
  sessionClearData(
    profile?: SessionProfileId,
    partition?: string
  ): Promise<{ ok: boolean; cleared: string[] }>
  /** Forgets one site: cookies and storage for that origin only. */
  sessionClearSite(
    url: string,
    partition?: string
  ): Promise<{ ok: boolean; cleared: string[]; origin: string; error: string | null }>
  /** The cookies one origin holds, read from the session the page is actually on. */
  cookiesList(input: { url: string; partition?: string }): Promise<CookieRecord[]>
  /** Forgets one cookie by name. */
  cookiesRemove(input: { url: string; name: string; partition?: string }): Promise<boolean>
  /** The site's own icon, fetched in the main process and returned as a data URL. */
  faviconGet(pageUrl: string): Promise<{ dataUrl: string | null; source: string | null }>
  /**
   * DOM-candidate icon: the page's `link[rel*='icon']` hrefs, resolved and fetched in the main
   * process. Used when the plain `/favicon.ico` request came back empty.
   */
  faviconExtract(pageUrl: string, hrefs: string[]): Promise<{ dataUrl: string | null; source: string | null }>
  openSandbox(url: string): Promise<{ ok: boolean; error: string | null }>

  /* Max-protection private tabs */
  /** Creates the tab's own in-memory session before its first request. */
  privateTabOpen(tabId: string): Promise<PrivateTabState>
  /** Wipes that session and forgets the tab. */
  privateTabClose(tabId: string): Promise<PrivateTabState | null>
  privateTabs(): Promise<PrivateTabState[]>
  onPrivateTabsChanged(listener: (tabs: PrivateTabState[]) => void): Unsubscribe

  /* WImH extreme defense mode */
  wimhState(): Promise<WimhState>
  wimhSetEnabled(enabled: boolean): Promise<WimhState>
  wimhSetClipboardTtl(ms: number): Promise<WimhState>
  wimhScrub(): Promise<WimhState>
  wimhCheckClipboard(text: string): Promise<ClipboardVerdict>
  wimhNotePasteBlocked(reason: string): Promise<WimhState>
  onWimhChanged(listener: (state: WimhState) => void): Unsubscribe

  /* On-demand inspection lease (WImH overlay) */
  inspectionState(): Promise<InspectionState>
  inspectionSetOpen(open: boolean): Promise<InspectionState>
  onInspectionChanged(listener: (state: InspectionState) => void): Unsubscribe

  /* Protection levels */
  protectionState(): Promise<ProtectionState>
  protectionSetLevel(level: ProtectionLevel): Promise<ProtectionState>
  /** Pauses (or resumes) tracking cancellation for one site, for this session. */
  protectionSetSiteAllowed(site: string, allowed: boolean): Promise<ProtectionState>
  onProtectionChanged(listener: (state: ProtectionState) => void): Unsubscribe

  /* New tab dashboard */
  scanLocalServers(): Promise<LocalServerScan>
  workspacesList(): Promise<WorkspaceEntry[]>
  workspacesAdd(path: string): Promise<WorkspaceEntry[]>
  workspacesPick(): Promise<WorkspaceEntry[]>
  workspacesRemove(path: string): Promise<WorkspaceEntry[]>
  workspacesSetActive(path: string): Promise<WorkspaceEntry[]>

  /* Workspace mode and profiles */
  modeState(): Promise<ModeState>
  modeSet(mode: 'normal' | 'dev'): Promise<ModeState>
  onModeChanged(listener: (state: ModeState) => void): Unsubscribe
  profilesList(): Promise<BrowserProfile[]>
  profilesCreate(name: string | { name: string; avatar?: ProfileAvatar }): Promise<BrowserProfile[]>
  profilesSwitch(id: string): Promise<BrowserProfile[]>
  profilesDelete(id: string): Promise<BrowserProfile[]>
  onProfilesChanged(listener: (profiles: BrowserProfile[]) => void): Unsubscribe
  /** Identity settings, currently the startup prompt. */
  profilesSettings(): Promise<ProfileSettings>
  profilesSetAskOnStartup(ask: boolean): Promise<ProfileSettings>
}
