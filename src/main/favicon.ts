/**
 * Site icons for the tab strip.
 *
 * The shell asks the origin for its `/favicon.ico` and hands the bytes back as a data URL, so the
 * chip renders a real image without the renderer ever talking to the network: the CSP stays as it
 * is (`img-src` allows `data:`), nothing is requested from a third-party icon service, and the
 * bytes live in this process's memory only, for the length of the session.
 *
 * Sites that do not serve `/favicon.ico` simply get no answer, and the chip falls back to the
 * site's initial - which is the honest outcome rather than a logo invented on their behalf.
 */

const TIMEOUT_MS = 3500
/** Anything larger than this is not a tab icon. */
const MAX_BYTES = 96 * 1024
const CACHE_LIMIT = 200

/** origin -> data URL, or null when the site has no usable icon. */
const cache = new Map<string, string | null>()

export interface FaviconResult {
  dataUrl: string | null
  /** Where it came from, for diagnostics. */
  source: string | null
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

/** Called when a tab closes, so the cache never grows with dead origins. */
export function forgetFavicon(pageUrl: string): void {
  const origin = originOf(pageUrl)
  if (origin) cache.delete(origin)
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
