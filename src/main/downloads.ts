import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { extname, isAbsolute, join } from 'node:path'
import { app, BrowserWindow, dialog, shell, webContents, type Session, type WebContents } from 'electron'
import {
  contentDispositionFor,
  handlerForMime,
  normalizeContentType,
  safeDownloadFilename,
  sanitizeDownloadPreferences,
  supportsBuiltinViewer,
  type DownloadPreferences,
  type FileHandlerAction
} from '../shared/downloads'
import { activeProfileId } from './profiles'
import { preferencesNow } from './preferences'
import { profileFile } from './storage'

interface DownloadContext {
  profileId: string
  preferencesFile: string
  privateSession: boolean
}

const contexts = new WeakMap<Session, DownloadContext>()
const reservedPaths = new Set<string>()
const protocolPrompts = new WeakSet<WebContents>()
const viewerRequests = new WeakMap<WebContents, { url: string; mime: string }>()

function settingsFor(context: DownloadContext): DownloadPreferences {
  if (context.profileId === activeProfileId()) return preferencesNow().downloads
  // A transfer can finish after a profile switch. Always use the originating profile's file.
  try {
    const saved = JSON.parse(readFileSync(context.preferencesFile, 'utf8')) as { downloads?: unknown }
    return sanitizeDownloadPreferences(saved.downloads)
  } catch {
    return sanitizeDownloadPreferences(undefined)
  }
}

function owner(contents: WebContents): BrowserWindow | null {
  return BrowserWindow.fromWebContents(contents.hostWebContents ?? contents)
}

function messageBoxSync(contents: WebContents, options: Electron.MessageBoxSyncOptions): number {
  const window = owner(contents)
  return window ? dialog.showMessageBoxSync(window, options) : dialog.showMessageBoxSync(options)
}

function uniqueSavePath(directory: string, filename: string): string {
  const extension = extname(filename)
  const stem = filename.slice(0, filename.length - extension.length)
  for (let index = 0; index < 10000; index++) {
    const path = join(directory, index ? `${stem} (${index})${extension}` : filename)
    if (!existsSync(path) && !reservedPaths.has(path.toLowerCase())) {
      reservedPaths.add(path.toLowerCase())
      return path
    }
  }
  throw new Error('Could not find an unused filename. Choose another download folder.')
}

/** Hooks each normal profile once. Private sessions only register their owner for cleanup. */
export function attachDownloadSession(ses: Session, privateSession = false): void {
  if (contexts.has(ses)) return
  const context: DownloadContext = {
    profileId: activeProfileId(),
    preferencesFile: profileFile('preferences.json'),
    privateSession
  }
  contexts.set(ses, context)
  if (privateSession) return

  // Keep this separate from the interceptor's request/header hooks; there is one listener per
  // webRequest event in Electron. Only top-level documents are content-handler candidates.
  ses.webRequest.onHeadersReceived({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    try {
      if (details.resourceType !== 'mainFrame' || (details.statusCode !== 200 && details.statusCode !== 206)) {
        callback({}); return
      }
      const headers = details.responseHeaders ?? {}
      const mimeKey = Object.keys(headers).find((name) => name.toLowerCase() === 'content-type')
      const contents = details.webContents ?? (details.webContentsId === undefined ? null : webContents.fromId(details.webContentsId))
      const viewer = contents ? viewerRequests.get(contents) : undefined
      const viewing = viewer?.url === details.url && details.resourceType === 'mainFrame'
      const disposition = viewing ? 'inline' : contentDispositionFor(settingsFor(context), mimeKey ? headers[mimeKey][0] ?? '' : '', details.resourceType, details.statusCode)
      if (!disposition) { callback({}); return }
      const responseHeaders = { ...headers }
      const key = Object.keys(headers).find((name) => name.toLowerCase() === 'content-disposition')
      if (key) {
        // Preserve filename / filename* parameters supplied by the server.
        responseHeaders[key] = headers[key].map((value) => value.replace(/^[^;]*/, disposition))
      } else if (disposition === 'attachment') {
        responseHeaders['Content-Disposition'] = ['attachment']
      }
      callback({ responseHeaders })
    } catch (error) {
      console.warn('[devlens] content handler could not inspect response', error)
      callback({})
    }
  })

  ses.on('will-download', (event, item, contents) => {
    if (event.defaultPrevented) return
    let reserved: string | null = null
    const releasePath = (): void => {
      if (reserved) reservedPaths.delete(reserved.toLowerCase())
    }
    try {
      const settings = settingsFor(context)
      const mime = item.getMimeType().split(';', 1)[0].trim().toLowerCase()
      const url = item.getURL()
      const filename = safeDownloadFilename(item.getFilename())
      let action: FileHandlerAction = handlerForMime(settings, mime)
      if (action === 'ask') {
        const actions: FileHandlerAction[] = supportsBuiltinViewer(mime)
          ? ['open', 'save', 'system'] : ['save', 'system']
        const buttons = actions.map((value) => value === 'open' ? 'Open in DevLens' : value === 'save' ? 'Save File' : 'Use System App')
        const choice = messageBoxSync(contents, {
          type: 'question', title: 'Open or save file?', message: filename,
          detail: `Content type: ${mime || 'unknown'}\nChoose how DevLens handles this download.`,
          buttons: [...buttons, 'Cancel'], defaultId: actions.indexOf('save'), cancelId: buttons.length,
          noLink: true
        })
        if (!actions[choice]) { event.preventDefault(); return }
        action = actions[choice]
      }

      if (action === 'open' && supportsBuiltinViewer(mime)) {
        event.preventDefault()
        if (!contents.isDestroyed() && /^(https?|blob|data):/i.test(url)) {
          const request = { url, mime }
          viewerRequests.set(contents, request)
          void contents.loadURL(url)
            .catch((error) => console.warn('[devlens] viewer could not open file', error))
            .finally(() => { if (viewerRequests.get(contents) === request) viewerRequests.delete(contents) })
        }
        return
      }

      const directory = settings.directory && isAbsolute(settings.directory) ? settings.directory : app.getPath('downloads')
      if (settings.promptBeforeDownload) {
        // Electron owns this Save As dialog, including cancellation and overwrite confirmation.
        item.setSaveDialogOptions({ title: 'Save file', defaultPath: join(directory, filename) })
      } else {
        try {
          mkdirSync(directory, { recursive: true })
          reserved = uniqueSavePath(directory, filename)
          item.setSavePath(reserved)
        } catch {
          releasePath()
          reserved = null
          item.setSaveDialogOptions({ title: 'Choose another download location', defaultPath: join(app.getPath('downloads'), filename) })
        }
      }

      item.once('done', (_doneEvent, state) => {
        releasePath()
        if (state !== 'completed' || action !== 'system' || contents.isDestroyed()) return
        if (context.profileId !== activeProfileId()) return
        const path = item.getSavePath()
        void confirmSystemFile(contents, path, context.profileId).catch((error) => console.warn('[devlens] system app could not open file', error))
      })
    } catch (error) {
      releasePath()
      event.preventDefault()
      console.warn('[devlens] download could not be configured', error)
    }
  })
}

async function confirmSystemFile(contents: WebContents, path: string, profileId: string): Promise<void> {
  const options: Electron.MessageBoxOptions = {
    type: 'question', title: 'Open downloaded file', message: 'Open this file with the system default app?',
    detail: path, buttons: ['Open File', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true
  }
  const window = owner(contents)
  const result = window ? await dialog.showMessageBox(window, options) : await dialog.showMessageBox(options)
  if (result.response !== 0 || contents.isDestroyed() || profileId !== activeProfileId()) return
  const error = await shell.openPath(path)
  if (error) dialog.showErrorBox('Could not open downloaded file', error)
}

/** External schemes only launch after a native confirmation showing the source and target. */
export async function handleExternalProtocol(contents: WebContents, url: string): Promise<void> {
  const context = contexts.get(contents.session)
  if (!context || context.privateSession || context.profileId !== activeProfileId()) return
  if (contents.isDestroyed() || protocolPrompts.has(contents) || /[\x00-\x1f]/.test(url) || url.length > 8192) return
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(url)
  const type = match ? normalizeContentType(match[1]) : null
  if (!type) return
  const settings = settingsFor(context)
  if (!Object.hasOwn(settings.handlers, type)) return
  const action = settings.handlers[type]
  if (action !== 'ask' && action !== 'system') return
  protocolPrompts.add(contents)
  try {
    const options: Electron.MessageBoxOptions = {
      type: 'question', title: 'Open external protocol', message: `Open ${type}: with the system default app?`,
      detail: `Requested by: ${contents.getURL()}\n\n${url}`,
      buttons: ['Use System App', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true
    }
    const window = owner(contents)
    const result = window ? await dialog.showMessageBox(window, options) : await dialog.showMessageBox(options)
    if (result.response === 0 && !contents.isDestroyed() && context.profileId === activeProfileId()) await shell.openExternal(url)
  } catch (error) {
    console.warn('[devlens] external protocol could not be opened', error)
  } finally {
    protocolPrompts.delete(contents)
  }
}

/** Chromium's download-history remover deletes records, never the downloaded files. */
export async function cleanupPrivateDownloadHistory(ses: Session): Promise<void> {
  const context = contexts.get(ses)
  if (!context?.privateSession || !settingsFor(context).deletePrivateHistoryOnClose) return
  await ses.clearData({ dataTypes: ['downloads'] }).catch((error) => {
    console.warn('[devlens] private download history cleanup failed', error)
  })
}
