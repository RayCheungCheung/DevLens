/**
 * Single source of truth for IPC channel names.
 * Imported by the main process, both preload bridges and the renderer so a typo
 * can never silently break a channel.
 */
export const IPC = {
  /** renderer -> main (invoke): boot data (paths, partition, home URL, IDE target). */
  getBootstrap: 'devlens:bootstrap',
  /** renderer -> main (send): "this guest id belongs to this viewport". */
  registerGuest: 'devlens:guest:register',
  /** renderer -> main (send): close the shell window (Ctrl+W on the last tab). */
  windowClose: 'devlens:window:close',
  /** renderer -> main (invoke): open a file/line in the configured editor. */
  openInIde: 'devlens:ide:open',
  /** renderer -> main (invoke): installed editors detected from OS URI handlers. */
  ideList: 'devlens:ide:list',
  /** main -> renderer: a console message captured from a guest. */
  consoleLog: 'devlens:log:console',
  /** main -> renderer: a failed / non-2xx request captured from a guest. */
  networkEntry: 'devlens:log:network',
  /** main -> renderer: guest navigation lifecycle (loading / ready / failed). */
  guestStatus: 'devlens:guest:status',
  /** guest -> renderer (sendToHost): scroll position of a viewport. */
  viewportScroll: 'devlens:viewport:scroll',
  /** renderer -> guest (webview.send): apply a scroll position coming from the twin viewport. */
  viewportApplyScroll: 'devlens:viewport:apply-scroll',
  /** renderer -> guest (webview.send): toggle document.designMode inside the guest. */
  viewportDesignMode: 'devlens:viewport:design-mode',

  /* AI debugger ------------------------------------------------------ */
  /** renderer -> main (invoke): provider, model and configuration status. */
  aiProviderInfo: 'devlens:ai:provider',
  /** renderer -> main (invoke): start a completion, returns the stream id. */
  aiAsk: 'devlens:ai:ask',
  /** renderer -> main (send): cancel a running completion. */
  aiAbort: 'devlens:ai:abort',
  /** main -> renderer: streamed completion tokens and terminal states. */
  aiStream: 'devlens:ai:stream',
  /** renderer -> main (invoke): top-level sign-in window sharing an AI partition. */
  aiOpenSignInWindow: 'devlens:ai:open-sign-in-window',

  /* HTTP interceptor and repeater ------------------------------------ */
  /** renderer -> main (invoke): current interceptor state. */
  interceptorGetState: 'devlens:interceptor:get-state',
  /** renderer -> main (invoke): enable/disable request interception. */
  interceptorSetEnabled: 'devlens:interceptor:set-enabled',
  /** renderer -> main (invoke): hold every request, not only rule matches. */
  interceptorSetPauseAll: 'devlens:interceptor:set-pause-all',
  /** renderer -> main (invoke): replace the rule set. */
  interceptorSetRules: 'devlens:interceptor:set-rules',
  /** main -> renderer: batched request lifecycle events. */
  interceptorEvents: 'devlens:interceptor:events',
  /** main -> renderer: interceptor counters changed (paused queue, captures). */
  interceptorStateChanged: 'devlens:interceptor:state-changed',
  /** renderer -> main (send): continue a held request, optionally with edited headers. */
  interceptorResume: 'devlens:interceptor:resume',
  /** renderer -> main (send): fail a held request. */
  interceptorDrop: 'devlens:interceptor:drop',
  /** renderer -> main (invoke): forget every captured request. */
  interceptorClear: 'devlens:interceptor:clear',
  /** renderer -> main (invoke): replay a request with a custom payload. */
  repeaterSend: 'devlens:interceptor:repeater',

  /* Output ----------------------------------------------------------- */
  /** renderer -> main (invoke): write a text file (report, CSS export, ...). */
  saveTextFile: 'devlens:file:save',
  /** renderer -> main (invoke): copy text to the system clipboard. */
  clipboardWrite: 'devlens:clipboard:write',
  /** renderer -> main (invoke): read the system clipboard, so Paste is only offered when it can work. */
  clipboardRead: 'devlens:clipboard:read',
  /** renderer -> main (invoke): run a page command the shell's context menu asked for. */
  pageCommand: 'devlens:page:command',
  /** renderer -> main (invoke): the current zoom level of a guest, for the menu's zoom row. */
  pageZoom: 'devlens:page:zoom',
  /** renderer -> main (invoke): nudge a guest's logarithmic zoom level. */
  pageZoomBy: 'devlens:page:zoom-by',
  /** renderer -> main (invoke): set a guest's zoom as a percentage. */
  pageZoomSet: 'devlens:page:zoom-set',
  /** guest -> renderer: Ctrl/Cmd+F was pressed while a page owned focus. */
  findInPageRequested: 'devlens:find:requested',
  /** guest -> renderer: Ctrl/Cmd+R or F5 should reload both viewports. */
  reloadViewportsRequested: 'devlens:viewports:reload-requested',

  /* Omnibox ----------------------------------------------------------- */
  /** renderer -> main (invoke): recent visited pages for suggestions. */
  historyList: 'devlens:history:list',
  /** renderer -> main (send): remember a navigation. */
  historyAdd: 'devlens:history:add',
  /** renderer -> main (invoke): forget every visited page. */
  historyClear: 'devlens:history:clear',
  /** renderer -> main (invoke): prune visits outside a custom retention window. */
  historyPrune: 'devlens:history:prune',
  /** renderer -> main (invoke): saved pages, for ranking and the dashboard. */
  bookmarksList: 'devlens:bookmarks:list',
  /** renderer -> main (invoke): add or remove a bookmark, returns the new list. */
  bookmarksToggle: 'devlens:bookmarks:toggle',
  /** renderer -> main (invoke): save or update a bookmark with a name and a location. */
  bookmarksSave: 'devlens:bookmarks:save',
  /** renderer -> main (invoke): forget one bookmark. */
  bookmarksRemove: 'devlens:bookmarks:remove',
  /** main -> renderer: the bookmark set changed. */
  bookmarksChanged: 'devlens:bookmarks:changed',
  /** renderer -> main (invoke): the whole store: links, bar tree and bar preferences. */
  bookmarksSnapshot: 'devlens:bookmarks:snapshot',
  /** renderer -> main (invoke): add a folder to the bar, a root or another folder. */
  bookmarksCreateFolder: 'devlens:bookmarks:create-folder',
  /** renderer -> main (invoke): add a divider. */
  bookmarksCreateSeparator: 'devlens:bookmarks:create-separator',
  /** renderer -> main (invoke): rename a folder (links are renamed through save). */
  bookmarksRenameNode: 'devlens:bookmarks:rename-node',
  /** renderer -> main (invoke): forget one node, folder contents included. */
  bookmarksRemoveNode: 'devlens:bookmarks:remove-node',
  /** renderer -> main (invoke): reorder or re-file a node (drag and drop). */
  bookmarksMoveNode: 'devlens:bookmarks:move-node',
  /** renderer -> main (invoke): cut, copy or paste, including the system clipboard fallback. */
  bookmarksClipboard: 'devlens:bookmarks:clipboard',
  /** renderer -> main (invoke): show or hide the bar, and the other-bookmarks chip. */
  bookmarksSetOptions: 'devlens:bookmarks:set-options',
  /** renderer -> main (invoke): this profile's small preferences. */
  preferencesState: 'devlens:preferences:state',
  /** renderer -> main (invoke): change one of them. */
  preferencesSet: 'devlens:preferences:set',
  /** main -> renderer: a preference changed. */
  preferencesChanged: 'devlens:preferences:changed',
  /** renderer -> main (invoke): system default-browser and login-item status. */
  launchpadSystemState: 'devlens:launchpad:system-state',
  /** renderer -> main (invoke): ask the OS to make DevLens the default browser. */
  launchpadSetDefaultBrowser: 'devlens:launchpad:set-default-browser',
  /** renderer -> main (invoke): enable or disable launch at login. */
  launchpadSetLaunchAtLogin: 'devlens:launchpad:set-launch-at-login',
  /** renderer -> main (invoke): save the restorable tab session without broadcasting a preference change. */
  launchpadSaveSession: 'devlens:launchpad:save-session',
  /** renderer -> main (invoke): choose a local image and return it as a data URL. */
  launchpadPickWallpaper: 'devlens:launchpad:pick-wallpaper',
  /** renderer -> main (invoke): local weather lookup through the main process. */
  launchpadWeather: 'devlens:launchpad:weather',

  /**
   * The omnibox store shown by `devlens:settings/search`.
   *
   * It reads and writes the same per-profile preference file as `preferences*`; the separate
   * channel is the page's own address, so the route, the button that opens it and the panel that
   * answers it all name one thing.
   */
  omniboxSettingsGet: 'devlens:settings/omnibox',
  omniboxSettingsSet: 'devlens:settings/omnibox:set',
  omniboxSettingsChanged: 'devlens:settings/omnibox:changed',
  /**
   * The About page's system info, shown by `devlens:settings/about`. It reads the same per-profile
   * preference file for the operator's update channel and strategy, and collects version/OS facts
   * that only the main process can see.
   */
  aboutInfo: 'devlens:settings/about',
  downloadsDefaultDirectory: 'devlens:downloads:default-directory',
  downloadsPickDirectory: 'devlens:downloads:pick-directory',
  /** renderer -> main (invoke): open an address in a separate window. */
  bookmarksOpenWindow: 'devlens:bookmarks:open-window',
  /** renderer -> main (invoke): pick a bookmark file and merge it into the tree. */
  bookmarksImport: 'devlens:bookmarks:import',
  /** renderer -> main (invoke): write the whole tree to a file the operator picks. */
  bookmarksExport: 'devlens:bookmarks:export',
  /** renderer -> guest (webview.send): highlight DOM matches for `& <selector>`. */
  viewportFind: 'devlens:viewport:find',
  /** guest -> renderer (sendToHost): what was under a right-click. */
  viewportContextMenu: 'devlens:viewport:context-menu',
  /** main -> renderer: a guest asked for a new tab (`target=_blank`, ctrl-click). */
  guestOpenTab: 'devlens:guest:open-tab',
  /** renderer -> guest (webview.send): the emulated fold state and its hinge width. */
  viewportFold: 'devlens:viewport:fold',
  /** guest -> renderer (sendToHost): what the finder matched. */
  viewportFindResult: 'devlens:viewport:find-result',
  /** renderer -> guest (webview.send): text search for the built-in Find Bar. */
  viewportTextFind: 'devlens:viewport:text-find',
  /** guest -> renderer (sendToHost): text-search count and active match. */
  viewportTextFindResult: 'devlens:viewport:text-find-result',
  /** guest -> renderer (sendToHost): Ctrl/Cmd + wheel, forwarded for live page zoom. */
  viewportZoomWheelResult: 'devlens:viewport:zoom-wheel-result',
  /** renderer -> main (invoke): the site's icon, returned as a data URL. */
  faviconGet: 'devlens:favicon:get',
  /**
   * renderer -> main (invoke): icon from the page's own `link[rel*='icon']` hrefs, returned as
   * a data URL. A renderer-side DOM read feeds the hrefs; main filters and fetches the winner.
   */
  faviconExtract: 'devlens:favicon:extract',
  /** renderer -> main (invoke): enter the isolated ghost session. */
  ghostEnter: 'devlens:ghost:enter',
  /** renderer -> main (invoke): leave the ghost session. */
  ghostExit: 'devlens:ghost:exit',
  /** renderer -> main (invoke): current ghost session state. */
  ghostState: 'devlens:ghost:state',
  /** main -> renderer: ghost session counters changed. */
  ghostChanged: 'devlens:ghost:changed',
  /** renderer -> main (invoke): wipe cache and storage for a profile. */
  sessionClearData: 'devlens:session:clear-data',
  /** renderer -> main (invoke): wipe cookies and storage for one origin only. */
  sessionClearSite: 'devlens:session:clear-site',
  /** renderer -> main (invoke): the cookies one origin holds, for the storage inspector. */
  cookiesList: 'devlens:cookies:list',
  /** renderer -> main (invoke): forget one cookie by name. */
  cookiesRemove: 'devlens:cookies:remove',
  /** renderer -> main (invoke): open a sandboxed window for a URL. */
  sandboxOpen: 'devlens:sandbox:open',

  /* Max-protection private tabs --------------------------------------- */
  /** renderer -> main (invoke): create the session for one private tab. */
  privateTabOpen: 'devlens:private-tab:open',
  /** renderer -> main (invoke): wipe and release one private tab's session. */
  privateTabClose: 'devlens:private-tab:close',
  /** renderer -> main (invoke): every open private tab and its counters. */
  privateTabsState: 'devlens:private-tab:state',
  /** main -> renderer: a private tab opened, closed or counted something. */
  privateTabsChanged: 'devlens:private-tab:changed',

  /* WImH extreme defense mode ----------------------------------------- */
  /** renderer -> main (invoke): current defense state and event feed. */
  wimhState: 'devlens:wimh:state',
  /** renderer -> main (invoke): enter or leave the mode. */
  wimhSetEnabled: 'devlens:wimh:set-enabled',
  /** renderer -> main (invoke): tune the clipboard sentinel timeout. */
  wimhSetClipboardTtl: 'devlens:wimh:set-clipboard-ttl',
  /** renderer -> main (invoke): zero every registered scratch buffer now. */
  wimhScrub: 'devlens:wimh:scrub',
  /** renderer -> main (invoke): classify clipboard text before it is pasted. */
  wimhCheckClipboard: 'devlens:wimh:check-clipboard',
  /** renderer -> main (invoke): record that a protected paste was refused. */
  wimhNotePasteBlocked: 'devlens:wimh:note-paste-blocked',
  /** main -> renderer: defense state changed. */
  wimhChanged: 'devlens:wimh:changed',
  /** renderer -> main (invoke): open/close the on-demand WImH overlay. */
  inspectionSetOpen: 'devlens:inspection:set-open',
  /** renderer -> main (invoke): whether this process is observing, and from where. */
  inspectionState: 'devlens:inspection:state',
  /** main -> renderer: the inspection lease was granted, revoked or its counters moved. */
  inspectionChanged: 'devlens:inspection:changed',

  /* Protection levels ------------------------------------------------ */
  /** renderer -> main (invoke): the active level, its policy and its counters. */
  protectionGetState: 'devlens:protection:get-state',
  /** renderer -> main (invoke): switch level; applies to the live sessions immediately. */
  protectionSetLevel: 'devlens:protection:set-level',
  /** renderer -> main (invoke): pause or resume cancellation for one site, this session only. */
  protectionSetSiteAllowed: 'devlens:protection:set-site-allowed',
  /** renderer -> main (invoke): apply the profile's granular Shield rules. */
  protectionSetShieldRules: 'devlens:protection:set-shield-rules',
  /** main -> renderer: the level or its counters changed. */
  protectionChanged: 'devlens:protection:changed',
  /** renderer -> main (invoke): apply DoH mode. */
  privacyApplyNetwork: 'devlens:privacy:apply-network',
  /** renderer -> main (invoke): actual disk usage of this profile. */
  privacyDiskUsage: 'devlens:privacy:disk-usage',
  privacyClearBrowsingData: 'devlens:privacy:clear-browsing-data',
  privacyRunRetentionCleanup: 'devlens:privacy:run-retention-cleanup',
  /** renderer -> main (invoke): apply website light/dark/system preference. */
  appearanceApplyTheme: 'devlens:appearance:apply-theme',
  /** renderer -> main (invoke): apply a generated taskbar/Dock icon style. */
  appearanceSetAppIcon: 'devlens:appearance:set-app-icon',
  /** renderer -> main (invoke): apply spell-check settings to the active profile session. */
  languagesApply: 'devlens:languages:apply',

  /* New tab dashboard ------------------------------------------------ */
  /** renderer -> main (invoke): probe well known local dev ports. */
  localServersScan: 'devlens:ntp:servers',
  /** renderer -> main (invoke): recent workspaces. */
  workspacesList: 'devlens:ntp:workspaces',
  /** renderer -> main (invoke): add a workspace by path. */
  workspacesAdd: 'devlens:ntp:workspaces:add',
  /** renderer -> main (invoke): pick a workspace folder. */
  workspacesPick: 'devlens:ntp:workspaces:pick',
  /** renderer -> main (invoke): forget a workspace. */
  workspacesRemove: 'devlens:ntp:workspaces:remove',
  /** renderer -> main (invoke): make a workspace the click-to-source root. */
  workspacesSetActive: 'devlens:ntp:workspaces:active',

  /* Workspace mode and profiles --------------------------------------- */
  /** renderer -> main (invoke): current mode and what it enforces. */
  modeState: 'devlens:mode:state',
  /** renderer -> main (invoke): switch between normal and dev. */
  modeSet: 'devlens:mode:set',
  /** main -> renderer: the mode changed. */
  modeChanged: 'devlens:mode:changed',
  /** shell -> guest (webview.send): the guest refuses dev-only capabilities when locked. */
  viewportMode: 'devlens:viewport:mode',
  /** renderer -> main (invoke): every known profile. */
  profilesList: 'devlens:profiles:list',
  /** renderer -> main (invoke): create a profile and optionally switch to it. */
  profilesCreate: 'devlens:profiles:create',
  /** renderer -> main (invoke): switch the active profile. */
  profilesSwitch: 'devlens:profiles:switch',
  /** renderer -> main (invoke): delete a profile and wipe its storage. */
  profilesDelete: 'devlens:profiles:delete',
  /** main -> renderer: the profile list or the active profile changed. */
  profilesChanged: 'devlens:profiles:changed',
  /** renderer -> main (invoke): identity settings that are not per profile. */
  profilesSettings: 'devlens:profiles:settings',
  /** renderer -> main (invoke): toggle the "always ask on startup" prompt. */
  profilesSetAskOnStartup: 'devlens:profiles:set-ask-on-startup'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
