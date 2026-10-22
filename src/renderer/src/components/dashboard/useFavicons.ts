import { useEffect, useRef, useState } from 'react'

/**
 * Site icons for the dashboard's shortcut tiles.
 *
 * The same pipeline the tab strip uses: the main process fetches the origin's `/favicon.ico` and
 * hands back a data URL, so the renderer never talks to the network and the shell's CSP keeps
 * `img-src` closed to everything but `data:` and the two brand-image hosts.
 *
 * The cache is module scope rather than component scope because the dashboard remounts every time
 * a tab returns to it, and re-asking for the same eight icons each time would be pure waste. It is
 * a session cache: origins are remembered, nothing is written down.
 */
const cache = new Map<string, string>()
/** Origins already requested, so a render pass cannot queue the same fetch twice. */
const inFlight = new Set<string>()
const MAX_ATTEMPTS = 2

function originOf(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null
  } catch {
    return null
  }
}

export function useFavicons(urls: string[]): Record<string, string | null> {
  const [retryTick, setRetryTick] = useState(0)
  const attempts = useRef(new Map<string, number>())
  const [icons, setIcons] = useState<Record<string, string | null>>(() => {
    const seed: Record<string, string | null> = {}
    for (const url of urls) {
      const origin = originOf(url)
      if (origin && cache.has(origin)) seed[origin] = cache.get(origin) ?? null
    }
    return seed
  })

  useEffect(
    () =>
      window.devlens.onFaviconUpdated((event) => {
        const origin = originOf(event.pageUrl)
        if (!origin) return
        if (!event.dataUrl) return
        cache.set(origin, event.dataUrl)
        attempts.current.delete(origin)
        setIcons((current) =>
          current[origin] === event.dataUrl
            ? current
            : { ...current, [origin]: event.dataUrl }
        )
      }),
    []
  )

  useEffect(() => {
    const wanted = new Set<string>()
    for (const url of urls) {
      const origin = originOf(url)
      if (
        origin &&
        !cache.has(origin) &&
        (attempts.current.get(origin) ?? 0) < MAX_ATTEMPTS
      ) {
        wanted.add(origin)
      }
    }
    const pending = [...wanted].filter((origin) => !inFlight.has(origin))
    if (pending.length === 0) return
    let retryTimer: number | null = null
    for (const origin of pending) {
      inFlight.add(origin)
      attempts.current.set(origin, (attempts.current.get(origin) ?? 0) + 1)
    }

    let cancelled = false
    void (async () => {
      for (const origin of pending) {
        const result = await window.devlens.faviconGet(`${origin}/`).catch(() => null)
        const dataUrl = result?.dataUrl ?? null
        if (dataUrl) {
          cache.set(origin, dataUrl)
          attempts.current.delete(origin)
        }
        inFlight.delete(origin)
        if (!cancelled) {
          setIcons((current) => ({ ...current, [origin]: dataUrl }))
        }
        if (!dataUrl && (attempts.current.get(origin) ?? 0) < MAX_ATTEMPTS) {
          retryTimer ??= window.setTimeout(() => setRetryTick((value) => value + 1), 1200)
        }
      }
    })()

    return () => {
      cancelled = true
      if (retryTimer !== null) window.clearTimeout(retryTimer)
    }
    // The list is rebuilt from the same sources on every render, so the joined form is a stable
    // dependency where the array itself is not.
  }, [retryTick, urls.join('|')])

  return icons
}

/** The icon for a URL, or undefined while it is still being resolved. */
export function iconFor(icons: Record<string, string | null>, url: string): string | null {
  const origin = originOf(url)
  if (!origin) return null
  return icons[origin] ?? null
}
