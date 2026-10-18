import { useEffect, useState } from 'react'

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
const cache = new Map<string, string | null>()
/** Origins already requested, so a render pass cannot queue the same fetch twice. */
const inFlight = new Set<string>()

function originOf(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null
  } catch {
    return null
  }
}

export function useFavicons(urls: string[]): Record<string, string | null> {
  const [icons, setIcons] = useState<Record<string, string | null>>(() => {
    const seed: Record<string, string | null> = {}
    for (const url of urls) {
      const origin = originOf(url)
      if (origin && cache.has(origin)) seed[origin] = cache.get(origin) ?? null
    }
    return seed
  })

  useEffect(() => {
    const wanted = new Set<string>()
    for (const url of urls) {
      const origin = originOf(url)
      if (origin && !cache.has(origin)) wanted.add(origin)
    }
    const pending = [...wanted].filter((origin) => !inFlight.has(origin))
    if (pending.length === 0) return
    for (const origin of pending) inFlight.add(origin)

    let cancelled = false
    void (async () => {
      for (const origin of pending) {
        const result = await window.devlens.faviconGet(`${origin}/`).catch(() => null)
        const dataUrl = result?.dataUrl ?? null
        cache.set(origin, dataUrl)
        inFlight.delete(origin)
        if (cancelled) continue
        setIcons((current) => ({ ...current, [origin]: dataUrl }))
      }
    })()

    return () => {
      cancelled = true
    }
    // The list is rebuilt from the same sources on every render, so the joined form is a stable
    // dependency where the array itself is not.
  }, [urls.join('|')])

  return icons
}

/** The icon for a URL, or undefined while it is still being resolved. */
export function iconFor(icons: Record<string, string | null>, url: string): string | null {
  const origin = originOf(url)
  if (!origin) return null
  return icons[origin] ?? null
}
