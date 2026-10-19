export type FileHandlerAction = 'open' | 'save' | 'ask' | 'system'
export type UnhandledFileAction = 'save' | 'ask'

export interface DownloadPreferences {
  /** Empty means the operating system's Downloads folder. */
  directory: string
  promptBeforeDownload: boolean
  deletePrivateHistoryOnClose: boolean
  handlers: Record<string, FileHandlerAction>
  unhandledAction: UnhandledFileAction
}

/** A handler patch is merged in main; null removes a custom entry. */
export type DownloadPreferencesPatch = Partial<Omit<DownloadPreferences, 'handlers'>> & {
  handlers?: Record<string, FileHandlerAction | null>
}

export const FILE_HANDLER_ACTIONS: { value: FileHandlerAction; label: string }[] = [
  { value: 'open', label: 'Open in DevLens' },
  { value: 'save', label: 'Save File' },
  { value: 'ask', label: 'Always ask' },
  { value: 'system', label: 'Use System App' }
]

export const BUILTIN_CONTENT_TYPES = [
  { type: 'image/avif', label: 'AVIF' },
  { type: 'application/xml', label: 'XML' },
  { type: 'text/xml', label: 'XML (text)' },
  { type: 'application/pdf', label: 'PDF' },
  { type: 'image/svg+xml', label: 'SVG' },
  { type: 'image/webp', label: 'WebP' },
  { type: 'mailto', label: 'mailto' },
  { type: 'zoommtg', label: 'zoommtg' },
  { type: 'ms-windows-store', label: 'ms-windows-store' }
] as const

const BUILTIN_VIEW_TYPES = new Set([
  'image/avif', 'image/webp', 'image/svg+xml', 'image/png', 'image/jpeg', 'image/gif',
  'image/bmp', 'image/x-icon', 'application/pdf', 'application/xml', 'text/xml', 'text/plain'
])
const RESERVED_PROTOCOLS = new Set([
  'http', 'https', 'file', 'about', 'blob', 'data', 'javascript', 'vbscript',
  'devlens', 'chrome', 'chrome-extension', 'devtools', 'view-source',
  'shell', 'powershell', 'cmd', 'ms-msdt'
])

export const DEFAULT_DOWNLOAD_PREFERENCES: DownloadPreferences = {
  directory: '',
  promptBeforeDownload: false,
  deletePrivateHistoryOnClose: true,
  handlers: Object.fromEntries(BUILTIN_CONTENT_TYPES.map(({ type }) => [type, type.includes('/') ? 'open' : 'ask'])),
  unhandledAction: 'save'
}

/** A content type is either one concrete MIME type or an external protocol scheme. */
export function normalizeContentType(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 160) return null
  const type = value.trim().toLowerCase().replace(/:$/, '')
  if (/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(type)) return type
  if (/^[a-z][a-z0-9+.-]*$/.test(type) && !RESERVED_PROTOCOLS.has(type)) return type
  return null
}

export function supportsBuiltinViewer(type: string): boolean {
  return BUILTIN_VIEW_TYPES.has(type)
}

export function actionsForContentType(type: string): typeof FILE_HANDLER_ACTIONS {
  if (!type.includes('/')) return FILE_HANDLER_ACTIONS.filter(({ value }) => value === 'ask' || value === 'system')
  return FILE_HANDLER_ACTIONS.filter(({ value }) => value !== 'open' || supportsBuiltinViewer(type))
}

export function sanitizeDownloadPreferences(input: unknown): DownloadPreferences {
  const raw = input && typeof input === 'object' ? input as Partial<DownloadPreferences> : {}
  const handlers = { ...DEFAULT_DOWNLOAD_PREFERENCES.handlers }
  if (raw.handlers && typeof raw.handlers === 'object' && !Array.isArray(raw.handlers)) {
    for (const [key, action] of Object.entries(raw.handlers).slice(0, 100)) {
      const type = normalizeContentType(key)
      if (!type) continue
      if (!Object.hasOwn(handlers, type) && Object.keys(handlers).length >= 100) continue
      const validAction = actionsForContentType(type).some(({ value }) => value === action)
      if (validAction) handlers[type] = action
    }
  }
  return {
    directory: typeof raw.directory === 'string' && !/[\x00-\x1f]/.test(raw.directory)
      ? raw.directory.trim().slice(0, 4096) : '',
    promptBeforeDownload: raw.promptBeforeDownload === true,
    deletePrivateHistoryOnClose: raw.deletePrivateHistoryOnClose !== false,
    handlers,
    unhandledAction: raw.unhandledAction === 'ask' ? 'ask' : 'save'
  }
}

export function mergeDownloadPreferences(current: DownloadPreferences, patch: DownloadPreferencesPatch): DownloadPreferences {
  const handlers: Record<string, FileHandlerAction | null> = { ...current.handlers }
  if (patch.handlers && typeof patch.handlers === 'object' && !Array.isArray(patch.handlers)) {
    for (const [type, action] of Object.entries(patch.handlers).slice(0, 100)) {
      if (action === null) delete handlers[type]
      else handlers[type] = action
    }
  }
  return sanitizeDownloadPreferences({ ...current, ...patch, handlers })
}

export function handlerForMime(preferences: DownloadPreferences, mime: string): FileHandlerAction {
  const type = mime.split(';', 1)[0].trim().toLowerCase()
  return Object.hasOwn(preferences.handlers, type) ? preferences.handlers[type] : preferences.unhandledAction
}

/** Header changes apply to documents only, never scripts, images, fetches or error pages. */
export function contentDispositionFor(
  preferences: DownloadPreferences,
  mime: string,
  resourceType: string,
  statusCode: number
): 'inline' | 'attachment' | null {
  if (resourceType !== 'mainFrame' || (statusCode !== 200 && statusCode !== 206)) return null
  const type = mime.split(';', 1)[0].trim().toLowerCase()
  if (!Object.hasOwn(preferences.handlers, type)) return null
  return preferences.handlers[type] === 'open' && supportsBuiltinViewer(type) ? 'inline' : 'attachment'
}

/** Keep remote filenames within the selected directory on both Windows and POSIX. */
export function safeDownloadFilename(filename: string): string {
  let name = filename.split(/[\\/]/).pop()?.replace(/[<>:"|?*\x00-\x1f]/g, '_').slice(0, 200).replace(/[. ]+$/, '') || 'download'
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)) name = `_${name}`
  return name
}
