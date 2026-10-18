import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isAbsolute, normalize, relative, resolve } from 'node:path'
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
  workspaceRoot: string = config.workspaceRoot
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

  const uri = buildEditorUri(config.ideScheme, target.filePath, target.line)
  try {
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
    return { filePath: absolute, line: request.line ?? null }
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
      return { filePath: normalize(fileURLToPath(parsed)), line }
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

  const relativePath = decodeURIComponent(parsed.pathname).replace(/^\/+/, '')

  // Dev servers round-trip through directories: `/` or `/app/` serve `index.html`.
  const candidates = relativePath === '' || relativePath.endsWith('/')
    ? [`${relativePath}index.html`, relativePath]
    : [relativePath, `${relativePath}/index.html`]

  for (const candidatePath of candidates) {
    const candidate = resolve(workspaceRoot, candidatePath)
    // Never let a source URL escape the workspace root.
    if (relative(workspaceRoot, candidate).startsWith('..')) continue
    if (existsSync(candidate)) return { filePath: candidate, line }
  }

  return null
}

function buildEditorUri(scheme: string, filePath: string, line: number | null): string {
  const posixPath = filePath.replace(/\\/g, '/')
  const suffix = line && line > 0 ? `:${line}` : ''
  return `${scheme}://file/${posixPath}${suffix}`
}

