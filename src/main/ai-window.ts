import { BrowserWindow, session } from 'electron'
import { AI_SITES, isAiSiteId } from '../shared/ai-sites'
import type { AiSignInWindowRequest, AiSignInWindowResult } from '../shared/types'
import { desktopChromeUserAgent } from './user-agent'

const windows = new Map<string, BrowserWindow>()

/**
 * A top-level sign-in window for an AI provider.
 *
 * Google refuses OAuth inside an embedded webview even when the User-Agent is clean. A normal
 * BrowserWindow is accepted, and because it uses the exact same persistent partition as the AI
 * panel, cookies set there are immediately available when the panel is reloaded.
 */
export function openAiSignInWindow(
  request: AiSignInWindowRequest
): AiSignInWindowResult {
  const provider = String(request?.provider ?? '')
  const partition = String(request?.partition ?? '')
  if (!isAiSiteId(provider)) {
    return { ok: false, error: 'Unknown AI provider.' }
  }
  if (
    !partition.startsWith('persist:devlens-ai-') ||
    !partition.endsWith(`-${provider}`)
  ) {
    return { ok: false, error: 'The AI session partition is not valid.' }
  }

  const existing = windows.get(partition)
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore()
    existing.show()
    existing.focus()
    return { ok: true }
  }

  const site = AI_SITES.find((entry) => entry.id === provider)
  if (!site) return { ok: false, error: 'Unknown AI provider.' }

  const userAgent = desktopChromeUserAgent()
  const ses = session.fromPartition(partition, { cache: true })
  ses.setUserAgent(userAgent)

  const window = new BrowserWindow({
    width: 560,
    height: 780,
    minWidth: 420,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#08090c',
    title: `Sign in to ${site.label}`,
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    }
  })
  window.webContents.setUserAgent(userAgent)
  window.setMenuBarVisibility(false)
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      return { action: 'deny' }
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        parent: window,
        width: 560,
        height: 780,
        autoHideMenuBar: true,
        webPreferences: {
          partition,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webviewTag: false
        }
      }
    }
  })
  window.webContents.on('did-create-window', (child) => {
    child.webContents.setUserAgent(userAgent)
    child.setMenuBarVisibility(false)
  })
  window.once('ready-to-show', () => window.show())
  window.on('closed', () => windows.delete(partition))
  windows.set(partition, window)
  void window.loadURL(site.url).catch(() => undefined)
  return { ok: true }
}
