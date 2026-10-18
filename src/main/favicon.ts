import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'

/**
 * Site icons for the tab strip.
 *
 * The shell fetches the site's icon and hands the bytes back as a data URL, so the chip renders a
 * real image without the renderer ever talking to the network: the CSP stays as it is (`img-src`
 * allows `data:`), nothing is requested from a third-party icon service, and the bytes live in
 * this process's memory only, for the length of the session.
 *
 * Resolution is two-stage:
 *   1. Ask the origin for `/favicon.ico`. This is what the browser itself falls back to, and it
 *      covers the majority of sites with a single, well-known request.
 *   2. When that comes back empty, the renderer asks the page's own DOM for its
 *      `link[rel*='icon']` candidates and hands the list back here; we resolve each against the
 *      page URL, keep only the http(s) ones, pick the most-likely-to-be-a-real-icon entry, and
 *      fetch it. `javascript:` and other non-`http(s)` URLs are filtered out, so the caller
 *      cannot drag a script onto the wire.
 */

const TIMEOUT_MS = 3500
/** Anything larger than this is not a tab icon. */
const MAX_BYTES = 96 * 1024
const CACHE_LIMIT = 200

/** origin -> data URL, or null when the site has no usable icon. */
const cache = new Map<string, string | null>()

/**
 * Disk snapshot of the icon cache.
 *
 * The in-memory Map already survives an in-app refresh and tab switching (the main process stays
 * alive). This snapshot extends that to a full app restart: on boot the cache is seeded from a
 * JSON file under the user-data dir, and on quit the current cache is written back. Best-effort -
 * any read/write failure is swallowed so a bad file can never block the app from starting.
 */
const SNAPSHOT_FILE = 'devlens-favicon-snapshot.json'
let snapshotLoadedOnce = false

export interface FaviconResult {
  dataUrl: string | null
  /** Where it came from, for diagnostics. */
  source: string | null
}

/**
 * Read the persisted cache (if any) into memory. Idempotent: a second call is a no-op. Safe to run
 * before the first `faviconFor`, so a boot-time call seeds the strip's icons without re-fetching.
 */
export function loadFaviconSnapshot(): void {
  if (snapshotLoadedOnce) return
  snapshotLoadedOnce = true
  try {
    if (!app.isReady) return
    const path = join(app.getPath('userData'), SNAPSHOT_FILE)
    if (!existsSync(path)) return
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string | null>
    if (raw && typeof raw === 'object') {
      for (const [origin, dataUrl] of Object.entries(raw)) {
        // Persist only real icons; a null entry is just "no icon", not worth restoring.
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) cache.set(origin, dataUrl)
      }
    }
  } catch {
    // A corrupt snapshot is not fatal: start empty and overwrite it on quit.
  }
}

/** Write the current cache to disk. Called on quit so the next launch starts warm. */
export function saveFaviconSnapshot(): void {
  try {
    if (!app.isReady) return
    const out: Record<string, string> = {}
    for (const [origin, dataUrl] of cache) {
      if (typeof dataUrl === 'string') out[origin] = dataUrl
    }
    const path = join(app.getPath('userData'), SNAPSHOT_FILE)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(out))
  } catch {
    // Persisting is a convenience, not a requirement; a failed write just loses the warm start.
  }
}

export async function faviconFor(pageUrl: string): Promise<FaviconResult> {
  const origin = originOf(pageUrl)
  if (!origin) return { dataUrl: null, source: null }

  if (cache.has(origin)) return { dataUrl: cache.get(origin) ?? null, source: null }

  const source = `${origin}/favicon.ico`
  const dataUrl = await fetchIcon(source)
  remember(origin, dataUrl)
  return { dataUrl, source: dataUrl ? source : null }
}

/**
 * DOM-candidate path. The renderer has already read the page's `link[rel*='icon']` hrefs; this
 * resolves them against `pageUrl`, keeps only the http(s) ones, ranks them, and fetches the best
 * hit. The key is the origin, so a second tab on the same host reuses the result.
 *
 * Returns the same shape as `faviconFor`, so callers can use either result interchangeably.
 */
export async function faviconFromDomCandidates(
  pageUrl: string,
  hrefs: readonly string[]
): Promise<FaviconResult> {
  const origin = originOf(pageUrl)
  if (!origin) return { dataUrl: null, source: null }

  // A previous *hit* (a real data URL, from /favicon.ico or a DOM candidate) already answers
  // this origin; reuse it. A cached null only means /favicon.ico came back empty - the DOM
  // candidates may still carry a real icon, so fall through and try them.
  const cached = cache.has(origin) ? (cache.get(origin) ?? null) : undefined
  if (cached) return { dataUrl: cached, source: null }

  const candidates = rankIconHrefs(hrefs, pageUrl)
  let source: string | null = null
  let dataUrl: string | null = null
  for (const url of candidates) {
    dataUrl = await fetchIcon(url)
    if (dataUrl) {
      source = url
      break
    }
  }
  remember(origin, dataUrl)
  return { dataUrl, source }
}

/** Called when a tab closes, so the cache never grows with dead origins. */
export function forgetFavicon(pageUrl: string): void {
  const origin = originOf(pageUrl)
  if (origin) cache.delete(origin)
}

/**
 * Resolve and rank the page's `link[rel*='icon']` hrefs.
 *
 * Rules, in priority order:
 *   1. Only http(s) URLs survive. `javascript:`, `data:`, `about:`, and other non-network
 *      schemes are dropped - a `javascript:` href would execute in the guest, not fetch an icon.
 *   2. Absolute URLs are kept as-is; relative ones are resolved against `pageUrl`.
 *   3. Higher-scored entries come first; see `iconScore` for the ranking.
 *   4. De-duplicated and capped, so a page that declares every size ever still costs a handful
 *      of fetches, not a hundred.
 */
export function rankIconHrefs(hrefs: readonly string[], pageUrl: string): string[] {
  const resolved = new Map<string, number>()
  for (const raw of hrefs) {
    if (typeof raw !== 'string' || raw.trim() === '') continue
    let url: URL
    try {
      // `new URL(raw, pageUrl)` handles both absolute and relative hrefs in one branch.
      url = new URL(raw, pageUrl)
    } catch {
      continue
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
    const score = iconScore(url)
    if (resolved.has(url.href)) {
      resolved.set(url.href, Math.max(resolved.get(url.href) ?? 0, score))
    } else {
      resolved.set(url.href, score)
    }
  }
  return [...resolved.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([url]) => url)
}

/**
 * Higher means "try first".
 *
 * The score rewards real image extensions, then a named size (so a 192x192 PNG beats a 16x16
 * one), then `apple-touch-icon` / `manifest` as strong hints even when the extension is odd.
 */
function iconScore(url: URL): number {
  let score = 0
  const path = `${url.pathname}${url.search}`.toLowerCase()

  if (path.endsWith('.svg')) score += 40
  else if (path.endsWith('.png') || path.endsWith('.webp')) score += 30
  else if (path.endsWith('.ico')) score += 20
  else if (path.includes('icon')) score += 10

  // Named-size hint: `192`, `512`, `32` etc. Bigger wins within the same extension.
  const sizeMatch = /(\d{2,4})x(\d{2,4})/.exec(path)
  if (sizeMatch) {
    const width = parseInt(sizeMatch[1], 10)
    if (width >= 32) score += 5
    if (width >= 96) score += 5
    if (width >= 256) score += 5
  }

  if (path.includes('apple-touch-icon')) score += 25
  else if (path.includes('manifest')) score += 5

  return score
}

function remember(origin: string, dataUrl: string | null): void {
  cache.set(origin, dataUrl)
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

function originOf(pageUrl: string): string | null {
  try {
    const parsed = new URL(pageUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.origin
  } catch {
    return null
  }
}

async function fetchIcon(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    if (!response.ok) return null

    const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    // Some servers answer with text/html for a missing icon; those are not images.
    if (type && !type.startsWith('image/')) return null

    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null

    return `data:${type || 'image/x-icon'};base64,${bytes.toString('base64')}`
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
