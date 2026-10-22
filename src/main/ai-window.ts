import { AI_SITES, isAiSiteId } from '../shared/ai-sites'
import type { AiSignInWindowRequest, AiSignInWindowResult } from '../shared/types'
import { openExternalBrowser } from './external-browser'

/**
 * Opens an AI provider in the system browser.
 *
 * Google refuses account authentication in embedded Chromium. A top-level Electron
 * BrowserWindow is still Chromium and is rejected as well, so opening another app window only
 * repeats the same dead end. The supported boundary is the user's real browser; it cannot copy
 * its encrypted cookie store back into DevLens's isolated webview partition.
 */
export async function openAiSignInWindow(
  request: AiSignInWindowRequest
): Promise<AiSignInWindowResult> {
  const provider = String(request?.provider ?? '')
  const partition = String(request?.partition ?? '')
  if (!isAiSiteId(provider)) {
    return { ok: false, error: 'Unknown AI provider.' }
  }
  if (
    !partition.startsWith('persist:devlens-ai-') ||
    !partition.endsWith(`-${provider}`)
  ) {
    return { ok: false, error: 'The AI session partition is not valid.' }
  }

  const site = AI_SITES.find((entry) => entry.id === provider)
  if (!site) return { ok: false, error: 'Unknown AI provider.' }

  const opened = await openExternalBrowser(site.url)
  return opened
    ? { ok: true, external: true }
    : { ok: false, external: true, error: 'No installed browser accepted the request.' }
}
