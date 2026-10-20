import { mkdir, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { app, clipboard, ClipboardItem, dialog } from 'electron'
import type { ResolvedConfig } from '../shared/config'
import type {
  RemoteFileRequest,
  RemoteImageResult,
  SaveTextResult
} from '../shared/types'

const MAX_BYTES = 80 * 1024 * 1024

function safeName(filename: string): string {
  const cleaned = basename(filename).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim()
  return cleaned || 'devlens-download'
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
    const header = url.slice(5, comma)
    const payload = url.slice(comma + 1)
    const mime = header.split(';')[0] || 'application/octet-stream'
    const bytes = header.includes(';base64')
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf-8')
    if (bytes.byteLength > MAX_BYTES) throw new Error('The link is larger than 80 MB.')
    return { bytes, mime }
  }

  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported link protocol: ${parsed.protocol}`)
  }
  const response = await fetch(parsed, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) throw new Error(`The server returned ${response.status}.`)
  const length = Number(response.headers.get('content-length'))
  if (Number.isFinite(length) && length > MAX_BYTES) {
    throw new Error('The link is larger than 80 MB.')
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.byteLength > MAX_BYTES) throw new Error('The link is larger than 80 MB.')
  return {
    bytes,
    mime: response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream'
  }
}

export async function saveRemoteFile(
  request: RemoteFileRequest,
  config: ResolvedConfig
): Promise<SaveTextResult> {
  try {
    const asset = await remoteBytes(String(request?.url ?? ''))
    const filename = safeName(String(request?.filename ?? 'devlens-download'))
    if (config.reportOutputDir) {
      await mkdir(config.reportOutputDir, { recursive: true })
      const target = join(config.reportOutputDir, filename)
      await writeFile(target, asset.bytes)
      return { ok: true, path: target, error: null, cancelled: false }
    }
    const result = await dialog.showSaveDialog({
      title: request.title || 'Save from DevLens',
      defaultPath: join(app.getPath('documents'), filename),
      filters: filtersFor(extname(filename))
    })
    if (result.canceled || !result.filePath) {
      return { ok: false, path: null, error: null, cancelled: true }
    }
    await writeFile(result.filePath, asset.bytes)
    return { ok: true, path: result.filePath, error: null, cancelled: false }
  } catch (error) {
    return {
      ok: false,
      path: null,
      error: error instanceof Error ? error.message : String(error),
      cancelled: false
    }
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
