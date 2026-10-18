import { mkdir, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { app, clipboard, dialog } from 'electron'
import type { ResolvedConfig } from '../shared/config'
import type { SaveTextRequest, SaveTextResult } from '../shared/types'

/** Keeps a user supplied name usable as a file name. */
function safeName(filename: string): string {
  const cleaned = basename(filename).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim()
  return cleaned.length > 0 ? cleaned : 'devlens-export.txt'
}

/**
 * Writes a text artifact.
 *
 * When `report.outputDir` (or DEVLENS_REPORT_DIR) is set the file is written straight
 * there - useful for scripted runs and CI - otherwise the operator picks a location.
 */
export async function saveTextFile(
  request: SaveTextRequest,
  config: ResolvedConfig
): Promise<SaveTextResult> {
  const filename = safeName(request.filename)

  try {
    if (config.reportOutputDir) {
      await mkdir(config.reportOutputDir, { recursive: true })
      const target = join(config.reportOutputDir, filename)
      await writeFile(target, request.content, 'utf-8')
      return { ok: true, path: target, error: null, cancelled: false }
    }

    const result = await dialog.showSaveDialog({
      title: request.title,
      defaultPath: join(app.getPath('documents'), filename),
      filters: filtersFor(extname(filename))
    })

    if (result.canceled || !result.filePath) {
      return { ok: false, path: null, error: null, cancelled: true }
    }

    await writeFile(result.filePath, request.content, 'utf-8')
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

/** Electron's clipboard API is promise based, so the caller awaits the actual write. */
export async function writeClipboard(text: string): Promise<boolean> {
  await clipboard.writeText(text)
  return true
}

function filtersFor(extension: string): { name: string; extensions: string[] }[] {
  switch (extension.toLowerCase()) {
    case '.json':
      return [{ name: 'JSON', extensions: ['json'] }]
    case '.md':
      return [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
    case '.css':
      return [{ name: 'Stylesheet', extensions: ['css'] }]
    default:
      return [{ name: 'All files', extensions: ['*'] }]
  }
}
