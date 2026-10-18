import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  session,
  webContents,
  type WebContents
} from 'electron'
import { IPC } from '../shared/ipc'
import type {
  AiAskRequest,
  AiStreamEvent,
  BookmarkDropPosition,
  BookmarkEntry,
  BookmarkSnapshot,
  BootstrapPayload,
  BrowserProfile,
  CookieRecord,
  GhostSessionState,
  GuestRegistration,
  HistoryEntry,
  InspectionState,
  InterceptorRule,
  LocalServerScan,
  ModeState,
  OpenInIdeRequest,
  OpenInIdeResult,
  PageCommandKind,
  ProfileAvatar,
  ProfileSettings,
  ProtectionState,
  RepeaterRequest,
  RepeaterResponse,
  ResumeRequestPayload,
  SaveTextRequest,
  SaveTextResult,
  SessionProfileId,
  WimhState,
  WorkspaceEntry
} from '../shared/types'
import { isProtectionLevel, type ProtectionLevel } from '../shared/protection'
import { abort as abortAi, ask as askAi, describeProvider } from './ai'
import { loadConfig } from './config'
import { instrumentGuest, registerGuest, setEmitter } from './guests'
import { flushHistory, historyAdd, historyClear, historyList } from './history'
import {
  bookmarkSnapshot,
  clipboardAction,
  createFolder,
  createSeparator,
  exportBookmarks,
  flushBookmarks,
  importBookmarks,
  listBookmarks,
  moveNode,
  removeBookmark,
  removeNode,
  renameNode,
  saveBookmark,
  setBookmarkOptions,
  toggleBookmark
} from './bookmarks'
import {
  faviconFor,
  faviconFromDomCandidates,
  loadFaviconSnapshot,
  saveFaviconSnapshot
} from './favicon'
import { openInIde } from './ide'
import { scanLocalServers } from './local-servers'
import {
  configureMode,
  inspectionStateNow,
  isAiEnabled,
  modeStateNow,
  setInspectionLease,
  setMode
} from './mode'
import {
  configureProtection,
  protectionStateNow,
  setProtectionLevel,
  setSiteAllowed
} from './protection'
import {
  activeProfileId,
  activeProfilePartition,
  askOnStartupNow,
  configureProfiles,
  createProfile,
  deleteProfile,
  flushProfileRegistry,
  listProfiles,
  markInstrumented,
  setAskOnStartup,
  switchProfile
} from './profiles'
import {
  clearCaptures,
  configureInterceptor,
  dropHeld,
  instrumentInterceptor,
  interceptorSnapshot,
  releaseAllHeld,
  resumeHeld,
  sendRepeater,
  setEnabled,
  setPauseAll,
  setRules
} from './interceptor'
import { saveTextFile, writeClipboard } from './output'
import { flushPreferences, preferencesNow, setPreferences } from './preferences'
import type { ProfilePreferences } from '../shared/preferences'
import type { OmniboxSettings } from '../shared/omnibox-settings'
import {
  closePrivateTab,
  configurePrivateTabs,
  notePrivateHistoryBlocked,
  openPrivateWindow,
  openPrivateTab,
  privateTabsNow
} from './private-tabs'
import { privateTabPolicy, type PrivateTabState } from '../shared/private-tab'
import {
  GHOST_PARTITION,
  clearProfileData,
  clearSiteData,
  configureSessions,
  enterGhost,
  exitGhost,
  ghostStateNow,
  hardenSession,
  listCookies,
  removeCookie,
  openSandboxWindow
} from './sessions'
import {
  WIMH_PARTITION,
  classifyClipboard as classifyClipboardText,
  configureWimh,
  enforceRamOnly,
  guardClipboardWrite,
  isWimhActive,
  noteHistoryBlocked,
  notePasteBlocked,
  protectWindow,
  scrubNow,
  setClipboardTtl,
  setWimhEnabled,
  wimhStateNow
} from './wimh'
import {
  activeWorkspace,
  addWorkspace,
  listWorkspaces,
  pickWorkspace,
  removeWorkspace,
  setActiveWorkspace
} from './workspaces'
import { applyModeMenu, createShellWindow, isGuestContents } from './window'
import { cleanUserAgent } from './user-agent'

const config = loadConfig()

let shellWindow: BrowserWindow | null = null

function sendToShell(channel: string, payload: unknown): void {
  if (shellWindow && !shellWindow.isDestroyed()) {
    shellWindow.webContents.send(channel, payload)
  }
}

function registerIpcHandlers(): void {
  // renderer -> main: everything the UI needs before it can render a <webview>.
  ipcMain.handle(IPC.getBootstrap, (): BootstrapPayload => {
    return {
      // The guest bridge lives next to the shell bridge in out/preload.
      guestPreloadUrl: pathToFileURL(join(__dirname, '../preload/webview.js')).toString(),
      partition: config.partition,
      homeUrl: config.homeUrl,
      // The dashboard is the start surface unless a page was configured for the viewports.
      startOnDashboard: config.ntp.openOnStart || !config.homeUrl,
      mobile: config.mobile,
      // The active workspace can be switched from the dashboard, so resolve it per boot.
      workspaceRoot: activeWorkspace(config.workspaceRoot),
      ide: {
        scheme: config.ideScheme,
        entryFile: config.entryFile,
        entryLine: config.entryLine
      },
      reportOutputDir: config.reportOutputDir,
      ghostPartition: GHOST_PARTITION,
      wimhPartition: WIMH_PARTITION,
      mode: config.mode,
      protection: config.protection,
      profilePartition: activeProfilePartition(),
      /**
       * The startup identity prompt. `DEVLENS_PROFILE_ASK=0` opts a scripted run out of it;
       * otherwise a registry with a single profile has nothing to choose, so DevLens goes
       * straight in and the prompt appears as soon as there is more than one identity.
       */
      profileAsk:
        profilePromptEnabled(config.profileAsk) && askOnStartupNow() && listProfiles().length > 1,
      profileId: activeProfileId(),
      searchEngine: config.omnibox.searchEngine,
      historyLimit: config.omnibox.historyLimit,
      ntp: config.ntp,
      configPath: config.configPath
    }
  })

  // renderer -> main: guest id <-> viewport id. Main needs this to tag console
  // messages and network traffic with the viewport they came from.
  ipcMain.on(IPC.registerGuest, (_event, registration: GuestRegistration) => {
    registerGuest(registration)
  })

  // Ctrl+W on the last tab: the renderer asks, main closes, and only that window is affected.
  ipcMain.on(IPC.windowClose, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  // renderer -> main: "Open in VS Code" / click-to-source from the log panel.
  ipcMain.handle(IPC.openInIde, async (_event, request: OpenInIdeRequest): Promise<OpenInIdeResult> => {
    // Click-to-source always resolves inside whichever workspace is active.
    return openInIde(request, config, activeWorkspace(config.workspaceRoot))
  })

  /* ---------------- AI debugger ---------------- */

  ipcMain.handle(IPC.aiProviderInfo, () => describeProvider(config.ai))

  // The completion itself runs to completion in the background; the renderer follows it
  // through the aiStream channel, which is what makes the transcript stream live.
  ipcMain.handle(IPC.aiAsk, (_event, request: AiAskRequest) => {
    const safe: AiAskRequest = {
      prompt: String(request?.prompt ?? '').slice(0, 8000),
      mode: request?.mode ?? 'Balanced',
      viewport: String(request?.viewport ?? 'unknown'),
      chips: Array.isArray(request?.chips)
        ? request.chips.slice(0, 12).map((chip) => ({
            id: String(chip?.id ?? 'chip'),
            label: String(chip?.label ?? 'context'),
            body: String(chip?.body ?? '')
          }))
        : []
    }
    // The AI debugger is part of the developer workspace, so normal mode refuses to send.
    if (!isAiEnabled()) {
      const streamId = `ai-blocked-${Date.now()}`
      sendToShell(IPC.aiStream, {
        streamId,
        type: 'error',
        error: 'The AI debugger is only available in dev mode. Switch modes to use it.'
      } satisfies AiStreamEvent)
      return { streamId, provider: config.ai.provider, model: config.ai.model }
    }
    return askAi(safe, config.ai, (event: AiStreamEvent) => sendToShell(IPC.aiStream, event))
  })

  ipcMain.on(IPC.aiAbort, (_event, streamId: string) => {
    abortAi(String(streamId))
  })

  /* ---------------- Interceptor and repeater ---------------- */

  ipcMain.handle(IPC.interceptorGetState, () => interceptorSnapshot())

  ipcMain.handle(IPC.interceptorSetEnabled, (_event, enabled: boolean) => setEnabled(Boolean(enabled)))

  ipcMain.handle(IPC.interceptorSetPauseAll, (_event, pauseAll: boolean) => setPauseAll(Boolean(pauseAll)))

  ipcMain.handle(IPC.interceptorSetRules, (_event, rules: InterceptorRule[]) =>
    setRules(Array.isArray(rules) ? rules.slice(0, 200) : [])
  )

  // Held requests are released by id; the header list is optional and replaces whatever
  // the page originally sent.
  ipcMain.on(IPC.interceptorResume, (_event, payload: ResumeRequestPayload) => {
    if (payload?.id) resumeHeld({ id: String(payload.id), headers: payload.headers })
  })

  ipcMain.on(IPC.interceptorDrop, (_event, id: string) => {
    if (id) dropHeld(String(id))
  })

  ipcMain.handle(IPC.interceptorClear, () => {
    clearCaptures()
    return interceptorSnapshot()
  })

  // The repeater sends the request from the main process, which is why it can carry a
  // body: webRequest can read payloads but never rewrite them mid-flight.
  ipcMain.handle(IPC.repeaterSend, async (_event, request: RepeaterRequest): Promise<RepeaterResponse> => {
    return sendRepeater({
      method: String(request?.method ?? 'GET'),
      url: String(request?.url ?? ''),
      headers: Array.isArray(request?.headers) ? request.headers : [],
      body: String(request?.body ?? '')
    })
  })

  /* ---------------- Output ---------------- */

  ipcMain.handle(IPC.saveTextFile, async (_event, request: SaveTextRequest): Promise<SaveTextResult> => {
    return saveTextFile(
      {
        filename: String(request?.filename ?? 'devlens-export.txt'),
        content: String(request?.content ?? ''),
        title: String(request?.title ?? 'Save DevLens export')
      },
      config
    )
  })

  // Every DevLens clipboard write goes past the sentinel while extreme mode is on.
  ipcMain.handle(IPC.clipboardWrite, (_event, text: string) => {
    const value = String(text ?? '')
    guardClipboardWrite(value, 'DevLens UI')
    return writeClipboard(value)
  })

  /**
   * Read the clipboard, and run a page command in a guest.
   *
   * Both exist for one reason: a context menu must not offer a row that cannot work. Paste is only
   * worth showing when the clipboard has something in it, and the read has to happen before the
   * menu is drawn - Electron's clipboard is synchronous, so this is a round trip and nothing more.
   *
   * The page commands are the guest's own editing and navigation commands, executed here rather
   * than in the page: `document.execCommand('paste')` is refused in web content, and a page must
   * not be able to run a command the operator did not pick.
   */
  /**
   * Electron's clipboard read is asynchronous in this version (it mirrors the W3C API), so the
   * shell awaits it *before* it draws the menu - which is the point: a Paste row that cannot paste
   * never exists, not even for a frame. An unreadable clipboard is "empty", because a menu that
   * offers Paste on a guess is exactly the greyed-out row this menu does not have.
   */
  ipcMain.handle(IPC.clipboardRead, async (): Promise<string> => {
    try {
      return await clipboard.readText()
    } catch {
      return ''
    }
  })

  ipcMain.handle(
    IPC.pageCommand,
    (_event, input?: { webContentsId?: number; command?: PageCommandKind }): boolean => {
      const target = input?.webContentsId ? webContents.fromId(input.webContentsId) : null
      if (!target || target.isDestroyed()) return false
      switch (input?.command) {
        case 'copy':
          target.copy()
          return true
        case 'cut':
          target.cut()
          return true
        case 'paste':
          target.paste()
          return true
        case 'select-all':
          target.selectAll()
          return true
        case 'reload':
          target.reload()
          return true
        case 'back':
          target.navigationHistory.canGoBack() && target.navigationHistory.goBack()
          return true
        case 'forward':
          target.navigationHistory.canGoForward() && target.navigationHistory.goForward()
          return true
        case 'print':
          target.print({ silent: false, printBackground: true })
          return true
        case 'zoom-in':
          target.setZoomLevel(Math.min(target.getZoomLevel() + 0.5, 5))
          return true
        case 'zoom-out':
          target.setZoomLevel(Math.max(target.getZoomLevel() - 0.5, -5))
          return true
        case 'zoom-reset':
          target.setZoomLevel(0)
          return true
        default:
          return false
      }
    }
  )

  /** Read a guest's zoom, in percent, for the menu's zoom row. 0 means 100%. */
  ipcMain.handle(IPC.pageZoom, (_event, webContentsId?: number): number => {
    const target = webContentsId ? webContents.fromId(webContentsId) : null
    if (!target || target.isDestroyed()) return 0
    return Math.round((1 + target.getZoomLevel()) * 100)
  })

  /* ---------------- Omnibox ---------------- */

  ipcMain.handle(IPC.historyList, (_event, limit?: number): HistoryEntry[] => {
    const requested = typeof limit === 'number' && limit > 0 ? limit : 40
    return historyList(Math.min(requested, config.omnibox.historyLimit))
  })

  ipcMain.on(
    IPC.historyAdd,
    (_event, entry: { url?: string; title?: string; private?: boolean; tabId?: string }) => {
    if (!entry?.url) return
    /**
     * A private tab's visits are never written down - not to disk and not to the in-memory
     * list, which feeds the omnibox. The renderer does not send these at all; this is the guard
     * behind that, so a missed call site cannot turn into a stored page.
     */
    if (entry.private) {
      notePrivateHistoryBlocked(entry.tabId ? String(entry.tabId) : null)
      return
    }
    // Extreme mode is RAM only: nothing is written down, not even here.
    if (isWimhActive()) {
      noteHistoryBlocked(String(entry.url))
      return
    }
    historyAdd({ url: String(entry.url), title: entry.title ? String(entry.title) : undefined })
    }
  )

  ipcMain.handle(IPC.historyClear, () => {
    historyClear()
  })

  /** Bookmarks are local and tiny; the renderer ranks them together with history. */
  ipcMain.handle(IPC.bookmarksList, (): BookmarkEntry[] => listBookmarks())

  /**
   * Every bookmark mutation answers with the whole snapshot and broadcasts it.
   *
   * One payload carries the flat list the omnibox ranks, the tree the bar draws and the bar's
   * two preferences, so a renderer that missed an event cannot end up showing a bar that
   * disagrees with the store.
   */
  const broadcastBookmarks = (snapshot: BookmarkSnapshot): BookmarkSnapshot => {
    sendToShell(IPC.bookmarksChanged, snapshot)
    return snapshot
  }

  ipcMain.handle(IPC.bookmarksSnapshot, (): BookmarkSnapshot => bookmarkSnapshot())

  // Tab-strip icons: fetched in this process, handed to the renderer as a data URL.
  ipcMain.handle(IPC.faviconGet, (_event, pageUrl: string) => faviconFor(String(pageUrl ?? '')))
  // DOM-candidate path: renderer has read the page's `link[rel*='icon']` hrefs; main resolves
  // and fetches the winner so the CSP `img-src` never has to open up.
  ipcMain.handle(
    IPC.faviconExtract,
    (_event, pageUrl: string, hrefs: string[] | null) =>
      faviconFromDomCandidates(String(pageUrl ?? ''), Array.isArray(hrefs) ? hrefs : [])
  )

  ipcMain.handle(
    IPC.bookmarksToggle,
    (_event, entry: { url?: string; title?: string }): BookmarkSnapshot =>
      broadcastBookmarks(toggleBookmark({ url: String(entry?.url ?? ''), title: entry?.title }))
  )

  // The add-bookmark editor: the operator picked a name and a place, so both are stored.
  ipcMain.handle(
    IPC.bookmarksSave,
    (
      _event,
      entry: { url?: string; title?: string; location?: string }
    ): BookmarkSnapshot =>
      broadcastBookmarks(
        saveBookmark({
          url: String(entry?.url ?? ''),
          title: entry?.title,
          location: entry?.location
        })
      )
  )

  ipcMain.handle(IPC.bookmarksRemove, (_event, url: string): BookmarkSnapshot =>
    broadcastBookmarks(removeBookmark(String(url ?? '')))
  )

  /* ---------------- the bookmarks bar ---------------- */

  ipcMain.handle(
    IPC.bookmarksCreateFolder,
    (_event, input: { title?: string; location?: string }): BookmarkSnapshot =>
      broadcastBookmarks(
        createFolder({ title: input?.title ?? '', location: input?.location ?? 'toolbar' })
      )
  )

  ipcMain.handle(
    IPC.bookmarksCreateSeparator,
    (_event, input: { location?: string }): BookmarkSnapshot =>
      broadcastBookmarks(createSeparator({ location: input?.location ?? 'toolbar' }))
  )

  ipcMain.handle(
    IPC.bookmarksRenameNode,
    (_event, input: { id?: string; title?: string }): BookmarkSnapshot =>
      broadcastBookmarks(renameNode(String(input?.id ?? ''), String(input?.title ?? '')))
  )

  ipcMain.handle(IPC.bookmarksRemoveNode, (_event, id: string): BookmarkSnapshot =>
    broadcastBookmarks(removeNode(String(id ?? '')))
  )

  ipcMain.handle(
    IPC.bookmarksMoveNode,
    (_event, input: { id?: string; targetId?: string | null; position?: BookmarkDropPosition }): BookmarkSnapshot =>
      broadcastBookmarks(
        moveNode({
          id: String(input?.id ?? ''),
          targetId: input?.targetId ? String(input.targetId) : null,
          position: input?.position
        })
      )
  )

  ipcMain.handle(
    IPC.bookmarksClipboard,
    async (
      _event,
      input: { action?: 'copy' | 'cut' | 'paste'; id?: string; location?: string }
    ): Promise<{ snapshot: BookmarkSnapshot; message: string }> => {
      const action = input?.action === 'cut' || input?.action === 'copy' ? input.action : 'paste'
      const result = await clipboardAction({
        action,
        id: input?.id ? String(input.id) : undefined,
        location: input?.location
      })
      // A copy also puts the address on the system clipboard, which is what makes it useful
      // outside the browser; the paste direction reads that same clipboard when DevLens's own
      // clipboard is empty.
      if (result.text) await clipboard.writeText(result.text)
      return { snapshot: broadcastBookmarks(result.snapshot), message: result.message }
    }
  )

  ipcMain.handle(
    IPC.bookmarksSetOptions,
    (_event, input: { toolbarVisible?: boolean; showOtherBookmarks?: boolean }): BookmarkSnapshot =>
      broadcastBookmarks(setBookmarkOptions(input ?? {}))
  )

  /**
   * "Open in New Window" / "Open in New Private Window".
   *
   * Both are separate operating-system windows, which is what the entries promise. The plain one
   * is the isolated window DevLens already has (no bridge, in-memory session); the private one
   * runs on a throwaway partition with the max-protection filter attached and is wiped when it
   * closes, exactly like a private tab.
   */
  ipcMain.handle(
    IPC.bookmarksOpenWindow,
    async (
      _event,
      input: { url?: string; private?: boolean }
    ): Promise<{ ok: boolean; error: string | null }> => {
      const url = String(input?.url ?? '')
      if (!url) return { ok: false, error: 'no address to open' }
      return input?.private
        ? openPrivateWindow(url)
        : openSandboxWindow(url, shellWindow)
    }
  )

  /**
   * Import and export.
   *
   * Both open a native dialog, so both are async and both can be cancelled - a cancelled dialog
   * is not an error, and the renderer is told so it can stay quiet about it.
   */
  ipcMain.handle(
    IPC.bookmarksImport,
    async (_event, input: { location?: string; file?: string }) => {
      const result = await importBookmarks({
        location: input?.location,
        file: input?.file ? String(input.file) : undefined,
        parent: shellWindow
      })
      if (result.ok) broadcastBookmarks(result.snapshot)
      return {
        ok: result.ok,
        file: result.file,
        imported: result.imported,
        skipped: result.skipped,
        snapshot: result.snapshot,
        error: result.error
      }
    }
  )

  ipcMain.handle(IPC.bookmarksExport, (_event, input?: { file?: string }) =>
    exportBookmarks({ file: input?.file ? String(input.file) : undefined, parent: shellWindow })
  )

  /* ---------------- per-profile preferences ---------------- */

  const broadcastPreferences = (next: ProfilePreferences): ProfilePreferences => {
    sendToShell(IPC.preferencesChanged, next)
    // The control panel listens to its own channel, so the two views of one store never disagree.
    sendToShell(IPC.omniboxSettingsChanged, next.omnibox)
    return next
  }

  ipcMain.handle(IPC.preferencesState, (): ProfilePreferences => preferencesNow())

  ipcMain.handle(
    IPC.preferencesSet,
    (_event, patch: Partial<ProfilePreferences>): ProfilePreferences =>
      broadcastPreferences(setPreferences(patch ?? {}))
  )

  /* The omnibox control panel, addressed by its own route: same store, one name per page. */
  ipcMain.handle(IPC.omniboxSettingsGet, (): OmniboxSettings => preferencesNow().omnibox)

  ipcMain.handle(
    IPC.omniboxSettingsSet,
    (_event, settings: OmniboxSettings): OmniboxSettings =>
      broadcastPreferences(setPreferences({ omnibox: settings })).omnibox
  )

  ipcMain.handle(IPC.ghostState, (): GhostSessionState => ghostStateNow())

  ipcMain.handle(IPC.ghostEnter, (): Promise<GhostSessionState> => enterGhost())

  ipcMain.handle(IPC.ghostExit, (): Promise<GhostSessionState> => exitGhost())

  ipcMain.handle(
    IPC.sessionClearData,
    async (_event, input?: { profile?: SessionProfileId; partition?: string }) => {
      const requested = input?.profile
      const resolved =
        requested === 'ghost' || requested === 'wimh' || requested === 'private' ? requested : 'standard'
      // A private tab names its own partition; everything else falls back to the mounted
      // profile, which is what "standard" means here.
      const cleared = await clearProfileData(
        resolved,
        resolved === 'private' ? String(input?.partition ?? '') : activeProfilePartition()
      )
      return { ok: true, cleared }
    }
  )

  ipcMain.handle(IPC.sandboxOpen, (_event, url: string) =>
    openSandboxWindow(String(url ?? ''), shellWindow)
  )

  // "Forget this site": one origin, not the whole profile - in the session the page is on.
  ipcMain.handle(
    IPC.sessionClearSite,
    (_event, input: { url?: string; partition?: string } | string) => {
      const url = typeof input === 'string' ? input : String(input?.url ?? '')
      const partition = typeof input === 'string' ? null : (input?.partition ?? null)
      return clearSiteData(url, partition)
    }
  )

  /**
   * The cookie side of the storage inspector.
   *
   * The partition travels with the request because the page in front may be on the profile's
   * session, a ghost session or a private tab's own - and reading the wrong one would be showing
   * cookies the operator is not looking at.
   */
  ipcMain.handle(
    IPC.cookiesList,
    (_event, input: { url?: string; partition?: string }): Promise<CookieRecord[]> =>
      listCookies(String(input?.url ?? ''), input?.partition ?? null)
  )

  ipcMain.handle(
    IPC.cookiesRemove,
    (_event, input: { url?: string; name?: string; partition?: string }): Promise<boolean> =>
      removeCookie({
        url: String(input?.url ?? ''),
        name: String(input?.name ?? ''),
        partition: input?.partition ?? null
      })
  )

  /* ---------------- max-protection private tabs ---------------- */

  /**
   * Creates the session a private tab will run on.
   *
   * It is created here, before the renderer mounts the tab's `<webview>`, so the tab's very
   * first request already goes through the max-protection filter: no window of opportunity
   * where the page loads with the profile's cookies and the window's level.
   */
  ipcMain.handle(IPC.privateTabOpen, (_event, tabId: string): Promise<PrivateTabState> =>
    openPrivateTab(String(tabId ?? ''))
  )

  ipcMain.handle(IPC.privateTabClose, (_event, tabId: string): Promise<PrivateTabState | null> =>
    closePrivateTab(String(tabId ?? ''))
  )

  ipcMain.handle(IPC.privateTabsState, (): PrivateTabState[] => privateTabsNow())

  /* ---------------- WImH extreme defense mode ---------------- */

  ipcMain.handle(IPC.wimhState, (): WimhState => wimhStateNow())

  ipcMain.handle(IPC.wimhSetEnabled, (_event, enabled: boolean): Promise<WimhState> =>
    setWimhEnabled(Boolean(enabled))
  )

  ipcMain.handle(IPC.wimhSetClipboardTtl, (_event, ms: number): WimhState =>
    setClipboardTtl(Number(ms) || config.wimh.clipboardClearAfterMs)
  )

  ipcMain.handle(IPC.wimhScrub, (): WimhState => {
    scrubNow('operator requested a scrub')
    return wimhStateNow()
  })

  // The renderer asks before it lets anything off the clipboard into a field.
  ipcMain.handle(IPC.wimhCheckClipboard, (_event, text: string) =>
    classifyClipboardText(String(text ?? ''))
  )

  ipcMain.handle(IPC.wimhNotePasteBlocked, (_event, reason: string): WimhState => {
    notePasteBlocked(String(reason ?? 'credential pattern'))
    return wimhStateNow()
  })

  /* ---------------- on-demand inspection lease ---------------- */

  ipcMain.handle(IPC.inspectionState, (): InspectionState => inspectionStateNow())

  // The renderer reports the overlay opening or closing. In normal mode this is the only
  // switch that arms observation, and closing it drops everything the lease collected.
  ipcMain.handle(IPC.inspectionSetOpen, (_event, open: boolean): InspectionState =>
    setInspectionLease(Boolean(open))
  )

  /* ---------------- protection levels ---------------- */

  ipcMain.handle(IPC.protectionGetState, (): ProtectionState => protectionStateNow())

  // Switching a level applies to the live sessions: the request filter reads the policy on
  // every request, so nothing has to be reloaded and no restart is involved.
  ipcMain.handle(IPC.protectionSetLevel, (_event, level: ProtectionLevel): Promise<ProtectionState> =>
    setProtectionLevel(isProtectionLevel(level) ? level : 'standard')
  )

  // The site panel's per-site switch: the narrowest protection control there is.
  ipcMain.handle(
    IPC.protectionSetSiteAllowed,
    (_event, payload: { site?: string; allowed?: boolean }): ProtectionState =>
      setSiteAllowed(String(payload?.site ?? ''), payload?.allowed !== false)
  )

  /* ---------------- New tab dashboard ---------------- */

  ipcMain.handle(IPC.localServersScan, (): Promise<LocalServerScan> =>
    scanLocalServers(config.ntp.servers)
  )

  ipcMain.handle(IPC.workspacesList, (): WorkspaceEntry[] => listWorkspaces(config.workspaceRoot))

  ipcMain.handle(IPC.workspacesAdd, (_event, path: string): WorkspaceEntry[] =>
    addWorkspace(String(path ?? ''), config.workspaceRoot)
  )

  ipcMain.handle(IPC.workspacesPick, (): Promise<WorkspaceEntry[]> =>
    pickWorkspace(config.workspaceRoot, shellWindow)
  )

  ipcMain.handle(IPC.workspacesRemove, (_event, path: string): WorkspaceEntry[] =>
    removeWorkspace(String(path ?? ''), config.workspaceRoot)
  )

  ipcMain.handle(IPC.workspacesSetActive, (_event, path: string): WorkspaceEntry[] =>
    setActiveWorkspace(String(path ?? ''), config.workspaceRoot)
  )

  /* ---------------- workspace mode and profiles ---------------- */

  ipcMain.handle(IPC.modeState, (): ModeState => modeStateNow())

  ipcMain.handle(IPC.modeSet, (_event, mode: 'normal' | 'dev'): ModeState =>
    setMode(mode === 'normal' ? 'normal' : 'dev')
  )

  // Every profile mutation is broadcast: the main process owns the active identity, so the
  // renderer follows it rather than tracking its own copy.
  const broadcastProfiles = (list: BrowserProfile[]): BrowserProfile[] => {
    sendToShell(IPC.profilesChanged, list)
    return list
  }

  ipcMain.handle(IPC.profilesList, (): BrowserProfile[] => listProfiles())

  ipcMain.handle(
    IPC.profilesCreate,
    (_event, entry: string | { name?: string; avatar?: ProfileAvatar }): BrowserProfile[] =>
      broadcastProfiles(createProfile(entry))
  )

  ipcMain.handle(IPC.profilesSettings, (): ProfileSettings => ({
    askOnStartup: askOnStartupNow()
  }))

  ipcMain.handle(IPC.profilesSetAskOnStartup, (_event, ask: boolean): ProfileSettings => ({
    askOnStartup: setAskOnStartup(ask !== false)
  }))

  ipcMain.handle(IPC.profilesSwitch, (_event, id: string): BrowserProfile[] => {
    // Queued writes belong to the profile that is still active: land them before the swap so a
    // page visited a moment ago cannot end up in the next identity's files.
    flushHistory()
    flushBookmarks()
    flushPreferences()
    const next = switchProfile(String(id ?? ''))
    // A profile that is being used for the first time needs the same capture hooks as the
    // others, otherwise its traffic would be invisible to the interceptor panel.
    const profile = next.find((entry) => entry.active)
    if (profile && markInstrumented(profile.partition)) {
      instrumentInterceptor(session.fromPartition(profile.partition, { cache: true }), 'standard')
    }
    return broadcastProfiles(next)
  })

  ipcMain.handle(IPC.profilesDelete, async (_event, id: string): Promise<BrowserProfile[]> =>
    broadcastProfiles(await deleteProfile(String(id ?? '')))
  )
}

/** `DEVLENS_PROFILE_ASK=0` (or false/no/off) suppresses the startup identity prompt. */
function profilePromptEnabled(value: string): boolean {
  return !/^(0|false|no|off)$/i.test(value.trim())
}

function wireGuestInstrumentation(): void {
  // Every <webview> guest shows up here as soon as Electron creates it.
  app.on('web-contents-created', (_event, contents: WebContents) => {
    if (!isGuestContents(contents.getType())) return
    instrumentGuest(contents)
  })
}

function boot(): void {
  // Seed the icon cache from the last run's snapshot, so pinned tabs have their logos before
  // the first `faviconFor` fires.
  loadFaviconSnapshot()

  /**
   * A Chrome UA for everything this app loads.
   *
   * Electron's default advertises `Electron/x.y.z` and the app's own token, and Google's sign-in
   * reads either as "embedded browser" and refuses to continue - the symptom is a spinner that
   * never resolves. Stripping the two product tokens keeps the platform and Chromium numbers that
   * are true about this runtime and removes only the ones that are not. The hardened partitions
   * set the same value explicitly; this is the fallback for every other session and webContents.
   */
  app.userAgentFallback = cleanUserAgent(app.userAgentFallback)

  shellWindow = createShellWindow()
  setEmitter(sendToShell)

  /*
   * One session hook set covers both viewports: they share a partition.
   *
   * The partition is the *active profile's*, which is only the configured one on a fresh
   * install. Instrumenting the configured partition instead would leave a session that starts
   * on a profile with no hooks at all - no tracker blocking, no capture, no rules - which is
   * exactly what "switch profile, quit, relaunch" used to do.
   */
  const startPartition = activeProfilePartition()
  const guestSession = session.fromPartition(startPartition, { cache: true })
  configureInterceptor(config.interceptor, sendToShell)
  instrumentInterceptor(guestSession, 'standard')
  markInstrumented(startPartition)

  // Ghost mode is a separate in-memory partition, but it gets the same capture and rules
  // plus tracker blocking, so the interceptor panel keeps working while it is active.
  configureSessions(config.ghostBlockTrackers, (state) => sendToShell(IPC.ghostChanged, state))
  instrumentInterceptor(session.fromPartition(GHOST_PARTITION, { cache: false }), 'ghost')

  // Extreme defense mode: RAM-only session, capture kept, plus the defense subsystems.
  configureWimh({
    windowProvider: () => BrowserWindow.getAllWindows(),
    clipboardClearAfterMs: config.wimh.clipboardClearAfterMs,
    scrubAfterMs: config.wimh.scrubAfterMs,
    guardClipboard: config.wimh.guardClipboard,
    blockPastes: config.wimh.blockPastes,
    onChanged: (state) => sendToShell(IPC.wimhChanged, state)
  })
  const wimhSession = session.fromPartition(WIMH_PARTITION, { cache: false })
  enforceRamOnly(wimhSession)
  instrumentInterceptor(wimhSession, 'wimh')

  /**
   * Max-protection private tabs.
   *
   * Each one gets the interceptor with a *fixed* policy attached, so its session enforces Level
   * 3 - aggressive blocking, DNT/Sec-GPC, client-hint stripping, cross-site referer trimming -
   * without touching the window's own dial or any other tab's session.
   */
  configurePrivateTabs({
    instrument: (ses, tabId) =>
      instrumentInterceptor(ses, 'private', { policy: privateTabPolicy(), privateTabId: tabId }),
    onChanged: (tabs) => sendToShell(IPC.privateTabsChanged, tabs)
  })

  // The workspace mode is main-process truth: it decides what this process collects and
  // rewrites, so a renderer bug cannot turn a clean normal session into a monitored one.
  configureProfiles({
    defaultPartition: config.partition,
    knownPartitions: [config.partition, GHOST_PARTITION, WIMH_PARTITION]
  })
  configureMode({
    initial: config.mode,
    onChanged: (state) => {
      sendToShell(IPC.modeChanged, state)
      // The menu carries the DevTools accelerator, so it follows the mode too.
      applyModeMenu(state.mode)
    },
    // Leaving dev mode releases anything the operator was holding: the interceptor goes
    // quiet, so a held request would otherwise wait for an answer that cannot arrive.
    onLeaveDev: () => releaseAllHeld(),
    onInspectionChanged: (state) => sendToShell(IPC.inspectionChanged, state),
    // Closing the overlay must leave no memory of what it observed behind.
    onLeaseRevoked: () => clearCaptures()
  })

  // The protection dial is pure local state: which hosts are cancelled, which headers are
  // hardened, and whether the viewports run on the in-memory defense session.
  configureProtection({
    initial: config.protection,
    onChanged: (state) => sendToShell(IPC.protectionChanged, state)
  })
  hardenSession(wimhSession, 'WImH mode')

  registerIpcHandlers()
  wireGuestInstrumentation()

  // Enforce the configured starting level (an extreme level engages the defense session), and
  // let `wimh.startActive` keep it on afterwards - neither path fights over the partition.
  void setProtectionLevel(config.protection)
  if (config.wimh.startActive) void setWimhEnabled(true)
  protectWindow(shellWindow)
  applyModeMenu(config.mode)

  shellWindow.on('closed', () => {
    shellWindow = null
  })

  /**
   * The stores debounce their writes; quitting straight after a change would drop the last one.
   * Everything that is queued is landed while the process is still alive.
   */
  app.on('before-quit', () => {
    flushProfileRegistry()
    flushHistory()
    flushBookmarks()
    flushPreferences()
    saveFaviconSnapshot()
  })
}

app.whenReady().then(boot)

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) boot()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
