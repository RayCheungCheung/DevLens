import { mkdir, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { app, BrowserWindow, clipboard, ClipboardItem, dialog, webContents } from 'electron'
import type { ResolvedConfig } from '../shared/config'
import type {
  RemoteFileRequest,
  RemoteImageResult,
  PageCaptureRequest,
  SaveTextResult
} from '../shared/types'
import { fetchRemoteResource } from './safe-fetch'

const MAX_BYTES = 80 * 1024 * 1024

function safeMime(value: string): string {
  const normalized = value.trim().toLowerCase()
  return /^[a-z0-9!#$&^_.+*-]+\/[a-z0-9!#$&^_.+*-]+$/.test(normalized)
    ? normalized
    : 'application/octet-stream'
}

function safeName(filename: string): string {
  let cleaned = basename(filename)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .trim()
    .replace(/[. ]+$/, '')
  if (!cleaned || cleaned === '.' || cleaned === '..') cleaned = 'devlens-download'
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(cleaned)) {
    cleaned = `_${cleaned}`
  }
  return cleaned
}

function filtersFor(extension: string): { name: string; extensions: string[] }[] {
  switch (extension.toLowerCase()) {
    case '.png':
      return [{ name: 'PNG image', extensions: ['png'] }]
    case '.jpg':
    case '.jpeg':
      return [{ name: 'JPEG image', extensions: ['jpg', 'jpeg'] }]
    case '.gif':
      return [{ name: 'GIF image', extensions: ['gif'] }]
    case '.webp':
      return [{ name: 'WebP image', extensions: ['webp'] }]
    case '.svg':
      return [{ name: 'SVG image', extensions: ['svg'] }]
    case '.pdf':
      return [{ name: 'PDF document', extensions: ['pdf'] }]
    case '.html':
    case '.htm':
      return [{ name: 'HTML document', extensions: ['html', 'htm'] }]
    default:
      return [{ name: 'All files', extensions: ['*'] }]
  }
}

async function remoteBytes(url: string): Promise<{ bytes: Buffer; mime: string }> {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',')
    if (comma < 0) throw new Error('The data URL is malformed.')
    const header = url.slice(5, comma)
    const payload = url.slice(comma + 1)
    const mime = safeMime(header.split(';')[0] ?? '')
    const estimatedBytes = header.includes(';base64')
      ? Math.floor((payload.length * 3) / 4)
      : payload.length
    if (estimatedBytes > MAX_BYTES) throw new Error('The link is larger than 80 MB.')
    const bytes = header.includes(';base64')
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf-8')
    if (bytes.byteLength > MAX_BYTES) throw new Error('The link is larger than 80 MB.')
    return { bytes, mime }
  }

  /**
   * Saving an image or link is a deliberate user action and may legitimately reach a
   * LAN-hosted asset. Private targets are therefore allowed here, but metadata addresses
   * and redirects into them remain blocked by the shared network policy.
   */
  const asset = await fetchRemoteResource(url, {
    allowPrivateNetwork: true,
    maxBytes: MAX_BYTES,
    timeoutMs: 30_000,
    accept: 'image/*,application/pdf,text/plain,application/octet-stream;q=0.8,*/*;q=0.5'
  })
  return { bytes: asset.bytes, mime: safeMime(asset.mime) }
}

export async function saveRemoteFile(
  request: RemoteFileRequest,
  config: ResolvedConfig
): Promise<SaveTextResult> {
  try {
    const asset = await remoteBytes(String(request?.url ?? ''))
    const filename = safeName(String(request?.filename ?? 'devlens-download'))
    return saveBytes(asset.bytes, filename, request.title || 'Save from DevLens', config)
  } catch (error) {
    return {
      ok: false,
      path: null,
      error: error instanceof Error ? error.message : String(error),
      cancelled: false
    }
  }
}

async function saveBytes(
  bytes: Buffer,
  filename: string,
  title: string,
  config: ResolvedConfig
): Promise<SaveTextResult> {
  if (config.reportOutputDir) {
    await mkdir(config.reportOutputDir, { recursive: true })
    const target = join(config.reportOutputDir, filename)
    await writeFile(target, bytes)
    return { ok: true, path: target, error: null, cancelled: false }
  }
  const result = await dialog.showSaveDialog({
    title,
    defaultPath: join(app.getPath('documents'), filename),
    filters: filtersFor(extname(filename))
  })
  if (result.canceled || !result.filePath) {
    return { ok: false, path: null, error: null, cancelled: true }
  }
  await writeFile(result.filePath, bytes)
  return { ok: true, path: result.filePath, error: null, cancelled: false }
}

export async function savePageCapture(
  request: PageCaptureRequest,
  config: ResolvedConfig
): Promise<SaveTextResult> {
  try {
    const target = request?.webContentsId ? webContents.fromId(request.webContentsId) : null
    if (!target || target.isDestroyed()) {
      return { ok: false, path: null, error: 'That page is no longer open.', cancelled: false }
    }
    const image = await target.capturePage()
    const safeTitle = safeName(String(request.title ?? 'devlens-capture'))
      .replace(/\.(html?|pdf|png|jpe?g)$/i, '')
      .replace(/[. ]+$/, '')
    return saveBytes(
      image.toPNG(),
      `${safeTitle || 'devlens-capture'}.png`,
      'Save page screenshot',
      config
    )
  } catch (error) {
    return {
      ok: false,
      path: null,
      error: error instanceof Error ? error.message : String(error),
      cancelled: false
    }
  }
}

export function openSourceWindow(source: string, pageUrl: string): { ok: boolean; error: string | null } {
  try {
    if (source.length > 8_000_000) {
      return { ok: false, error: 'The page source is larger than 8 MB.' }
    }
    const escaped = source
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const html =
      '<!doctype html><meta charset="utf-8">' +
      '<title>Page source</title>' +
      '<style>body{margin:0;background:#0b0d10;color:#dbe4f0;font:13px/1.6 Consolas,monospace}' +
      'header{position:sticky;top:0;padding:10px 16px;background:#12161d;border-bottom:1px solid #29303a;color:#8b9bb1}' +
      'pre{margin:0;padding:18px;white-space:pre-wrap;word-break:break-word}</style>' +
      `<header>${pageUrl.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</header><pre>${escaped}</pre>`
    const window = new BrowserWindow({
      width: 1040,
      height: 780,
      backgroundColor: '#0b0d10',
      autoHideMenuBar: true,
      title: `Page source - ${pageUrl}`,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webviewTag: false,
        webSecurity: true
      }
    })
    void window.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`)
    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function readRemoteImage(url: string): Promise<RemoteImageResult> {
  try {
    const asset = await remoteBytes(String(url ?? ''))
    if (!asset.mime.startsWith('image/')) {
      throw new Error(`That link is ${asset.mime}, not an image.`)
    }
    return {
      ok: true,
      dataUri: `data:${asset.mime};base64,${asset.bytes.toString('base64')}`,
      error: null
    }
  } catch (error) {
    return {
      ok: false,
      dataUri: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function copyRemoteImage(url: string): Promise<{ ok: boolean; error: string | null }> {
  const result = await readRemoteImage(url)
  if (!result.ok || !result.dataUri) return { ok: false, error: result.error }
  try {
    const blob = await (await fetch(result.dataUri)).blob()
    await clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    return { ok: true, error: null }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'The image could not be copied.'
    }
  }
}
