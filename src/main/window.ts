import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, Menu, shell } from 'electron'
import type { WorkspaceMode } from '../shared/mode'

/** Set by electron-vite while the Vite dev server is running. */
const RENDERER_DEV_URL = process.env.ELECTRON_RENDERER_URL

export function createShellWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1680,
    height: 1020,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#08090c',
    /**
     * No native title bar.
     *
     * The OS bar was the last place the application name appeared, and it cost a row of pixels
     * above the tab strip for a label the window does not need. The window keeps its title -
     * taskbar, window switcher and screen readers still read "DevLens" - while the chrome the
     * operator sees starts at the tabs.
     *
     * Windows and Linux keep their own minimise/maximise/close buttons through
     * `titleBarOverlay`, drawn over the tab strip's empty right-hand side. macOS keeps its
     * traffic lights, inset into the same strip. The renderer marks that strip as the drag
     * region (`.nova-drag`), so the window still moves exactly like a native one.
     */
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const }
      : {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: { color: '#06070a', symbolColor: '#b6bfcd', height: 34 }
        }),
    title: 'DevLens',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // The shell is the only renderer allowed to embed guests.
      webviewTag: true,
      spellcheck: false
    }
  })

  window.once('ready-to-show', () => window.show())
  hardenShell(window)

  if (RENDERER_DEV_URL) {
    void window.loadURL(RENDERER_DEV_URL)
  } else {
    void window.loadURL(pathToFileURL(join(__dirname, '../renderer/index.html')).toString())
  }

  return window
}

/**
 * The shell UI never navigates away and never opens windows: external links go to the
 * user's browser, and anything trying to load inside the shell is blocked.
 */
function hardenShell(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  // Guests are created by the shell, but their security settings are enforced here in
  // the main process so a compromised renderer cannot weaken them.
  window.webContents.on('will-attach-webview', (_event, webPreferences, params) => {
    delete webPreferences.nodeIntegration
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.webSecurity = true

    const src = params.src ?? ''
    const allowed =
      src === '' || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('file://')
    if (!allowed) params.src = 'about:blank'

    // Keep our instrumentation hook while dropping anything unexpected.
    if (params.preload && !params.preload.endsWith('webview.js')) {
      delete params.preload
    }
  })
}

/** True when a guest webContents belongs to our instrumentation scope. */
export function isGuestContents(type: string): boolean {
  return type === 'webview'
}

/**
 * Menu per mode.
 *
 * The accelerator on "Toggle Developer Tools" is a real way into the developer area, and it
 * lives in the application menu rather than in the renderer, so normal mode gets a menu with
 * no View role at all. Edit and Window stay: copy, paste and window controls are browsing.
 */
export function applyModeMenu(mode: WorkspaceMode): void {
  /**
   * The Window role's default submenu carries "Close" with `CmdOrCtrl+W`, and a menu accelerator
   * wins before the renderer sees the key - so pressing Ctrl+W to close a tab closed the whole
   * browser instead. The accelerator is left out and the tab strip owns the key; the window can
   * still be closed from the title bar, the taskbar or Ctrl+Shift+W-less means like Alt+F4.
   */
  const windowMenu: Electron.MenuItemConstructorOptions = {
    label: 'Window',
    submenu: [{ role: 'minimize' }, { role: 'zoom' }]
  }

  /**
   * View tools without Electron's default Reload/Force Reload accelerators. Ctrl+R and F5 belong
   * to the active guest page; keeping the menu accelerator here would reload the shell, replay
   * bootstrap and potentially reopen the profile gate.
   */
  const viewMenu: Electron.MenuItemConstructorOptions = {
    label: 'View',
    submenu: [
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }

  const template: Electron.MenuItemConstructorOptions[] =
    mode === 'normal'
      ? [{ role: 'editMenu' }, windowMenu]
      : [{ role: 'editMenu' }, viewMenu, windowMenu]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
