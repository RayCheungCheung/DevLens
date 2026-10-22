import { existsSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isAbsolute, normalize, relative, resolve, sep } from 'node:path'
import { shell } from 'electron'
import type { OpenInIdeRequest, OpenInIdeResult } from '../shared/types'
import type { ResolvedConfig } from '../shared/config'

/**
 * "Open in IDE" (click-to-source).
 *
 * Two entry points, one implementation:
 *  1. The toolbar button passes the configured entry file.
 *  2. Clicking a log entry passes the URL the message came from, which is mapped back
 *     to a file on disk when the preview is served by a local dev server.
 *
 * The editor is reached through its URI scheme handler (`vscode://file/<abs path>:<line>`),
 * which is how every VS Code compatible editor registers itself on the OS.
 */
export async function openInIde(
  request: OpenInIdeRequest,
  config: ResolvedConfig,
  /** Overrides `config.workspaceRoot` so the dashboard can switch projects at runtime. */
  workspaceRoot: string = config.workspaceRoot,
  scheme: string = config.ideScheme
): Promise<OpenInIdeResult> {
  const target = resolveTarget(request, workspaceRoot)
  if (!target) {
    return {
      ok: false,
      uri: null,
      resolvedPath: null,
      error: 'Nothing to open: no file path could be resolved from the request.'
    }
  }

  let uri: string | null = null
  try {
    uri = buildEditorUri(scheme, target.filePath, target.line)
    await shell.openExternal(uri)
    return { ok: true, uri, resolvedPath: target.filePath, error: null }
  } catch (error) {
    return {
      ok: false,
      uri,
      resolvedPath: target.filePath,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

interface ResolvedTarget {
  filePath: string
  line: number | null
}

function resolveTarget(
  request: OpenInIdeRequest,
  workspaceRoot: string
): ResolvedTarget | null {
  if (request.filePath) {
    const absolute = isAbsolute(request.filePath)
      ? normalize(request.filePath)
      : resolve(workspaceRoot, request.filePath)
    const filePath = existingFileInWorkspace(absolute, workspaceRoot)
    return filePath ? { filePath, line: normalizeLine(request.line) } : null
  }

  if (request.sourceUrl) {
    return resolveSourceUrl(request.sourceUrl, request.line ?? null, workspaceRoot)
  }

  return null
}

/**
 * Maps a remote URL back to a local file:
 *  - `file:///...`            -> the file itself
 *  - `http://localhost:5173/x` -> <workspaceRoot>/x
 *  - anything else            -> null (we cannot know where the bundle came from)
 */
function resolveSourceUrl(
  sourceUrl: string,
  line: number | null,
  workspaceRoot: string
): ResolvedTarget | null {
  let parsed: URL
  try {
    parsed = new URL(sourceUrl)
  } catch {
    return null
  }

  if (parsed.protocol === 'file:') {
    try {
      const filePath = existingFileInWorkspace(normalize(fileURLToPath(parsed)), workspaceRoot)
      return filePath ? { filePath, line: normalizeLine(line) } : null
    } catch {
      return null
    }
  }

  const isLocalHost =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '[::1]' ||
    parsed.hostname === '0.0.0.0'

  if (!isLocalHost) return null

  let relativePath = ''
  try {
    relativePath = decodeURIComponent(parsed.pathname).replace(/^\/+/, '')
  } catch {
    return null
  }

  // Dev servers round-trip through directories: `/` or `/app/` serve `index.html`.
  const candidates = relativePath === '' || relativePath.endsWith('/')
    ? [`${relativePath}index.html`, relativePath]
    : [relativePath, `${relativePath}/index.html`]

  for (const candidatePath of candidates) {
    const candidate = resolve(workspaceRoot, candidatePath)
    const filePath = existingFileInWorkspace(candidate, workspaceRoot)
    if (filePath) return { filePath, line: normalizeLine(line) }
  }

  return null
}

function buildEditorUri(scheme: string, filePath: string, line: number | null): string {
  if (
    !/^[a-z][a-z0-9+.-]*$/i.test(scheme) ||
    /^(javascript|vbscript|data|file|http|https|devlens|shell|cmd|powershell|ms-msdt)$/i.test(scheme)
  ) {
    throw new Error('The configured editor URI scheme is invalid.')
  }
  const posixPath = filePath
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => encodeURIComponent(segment).replace(/%3A/gi, ':'))
    .join('/')
  const suffix = line && line > 0 ? `:${line}` : ''
  return `${scheme}://file/${posixPath}${suffix}`
}

/**
 * Resolve symlinks and require the final file to remain under this workspace. This is
 * intentionally applied to both direct paths and file URLs, so a logged source URL cannot
 * turn click-to-source into a request to launch an arbitrary local file in an editor.
 */
function existingFileInWorkspace(candidate: string, workspaceRoot: string): string | null {
  if (!existsSync(candidate)) return null
  try {
    const root = realpathSync.native(workspaceRoot)
    const target = realpathSync.native(candidate)
    const rel = relative(root, target)
    if (rel === '') return target
    if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) return null
    return target
  } catch {
    return null
  }
}

function normalizeLine(value: unknown): number | null {
  const line = Math.trunc(Number(value))
  return Number.isFinite(line) && line > 0 ? Math.min(line, 10_000_000) : null
}

