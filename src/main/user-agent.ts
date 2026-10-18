/**
 * The User-Agent the pages see.
 *
 * Electron's default carries two signatures that identity providers read as "this is an embedded
 * browser, not a browser": an `Electron/x.y.z` token and the app's own `devlens/x.y.z`. Google's
 * sign-in flow is the strictest about it - it detects them and refuses to complete, which from the
 * outside looks like a spinner that never resolves. A normal Chrome UA is the honest description of
 * what the page is actually running in: Chromium, with a Chrome version number.
 *
 * `cleanUserAgent` keeps the platform and Chromium tokens the default carried (they are true, and
 * sites use them for feature detection) and removes only the two product tokens, so this is a
 * *strip*, not a fabricated string. `desktopChromeUserAgent` is the fallback for when there is no
 * default to strip.
 */

/** The token pattern both signatures share: `name/1.2.3`, case-insensitive. */
const PRODUCT_SIGNATURE = /\s*(?:Electron|DevLens|devlens|electron)\/[\d.]+/g

/** Removes Electron's own product tokens from a UA string without touching anything else. */
export function cleanUserAgent(userAgent: string): string {
  const cleaned = userAgent.replace(PRODUCT_SIGNATURE, '').replace(/\s{2,}/g, ' ').trim()
  // A UA that still admits to being Electron is worse than no UA at all: fall back to Chrome.
  return /\bElectron\b/i.test(cleaned) || !/\bChrome\//.test(cleaned)
    ? desktopChromeUserAgent()
    : cleaned
}

/** A plain desktop Chrome UA for this machine's Chromium. */
export function desktopChromeUserAgent(): string {
  const platform =
    process.platform === 'darwin'
      ? 'Macintosh; Intel Mac OS X 10_15_7'
      : process.platform === 'win32'
        ? 'Windows NT 10.0; Win64; x64'
        : 'X11; Linux x86_64'
  const chrome = process.versions.chrome ?? '140.0.0.0'
  return (
    `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) ` +
    `Chrome/${chrome} Safari/537.36`
  )
}
