/** Turns whatever the user typed into a URL we can hand to a <webview>. */
export function normalizeAddress(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  // Already has a scheme (http:, https:, file:, about:, ...).
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) && !/^[a-zA-Z]:\\/.test(value)) {
    return value
  }

  // localhost, 127.0.0.1, 10.0.0.5:3000 without a scheme -> plain HTTP.
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i.test(value) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(value)) {
    return `http://${value}`
  }

  // Anything with a space is a search, not a host.
  if (/\s/.test(value)) {
    return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`
  }

  // A local path becomes a file URL so single-file prototypes can be previewed too.
  if (/^[a-zA-Z]:\\/.test(value)) {
    return `file:///${value.replace(/\\/g, '/')}`
  }

  return `https://${value}`
}

/** Last path segment, used to keep log rows readable. */
export function shortenUrl(url: string, max = 64): string {
  const cleaned = url.replace(/^https?:\/\//, '')
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}...` : cleaned
}

/** Host of a URL, or an empty string for the new tab page. */
export function hostOf(url: string | null): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'file:' ? 'local file' : parsed.host
  } catch {
    return url
  }
}
