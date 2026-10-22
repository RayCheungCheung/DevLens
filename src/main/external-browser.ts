import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { shell } from 'electron'

/**
 * Opens a URL in a real browser rather than the operating system's default app.
 *
 * DevLens can be the default browser. In that case `shell.openExternal('https://...')` launches
 * DevLens again, which is especially bad for Google authentication: the new page is still an
 * embedded Chromium surface and Google rejects it. Known browser executables are tried first on
 * Windows; other platforms retain the native default-browser path.
 */
export async function openExternalBrowser(url: string): Promise<boolean> {
  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
    const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
    const localAppData = process.env.LOCALAPPDATA ?? ''
    const candidates = [
      join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(programFiles, 'Mozilla Firefox', 'firefox.exe'),
      join(
        localAppData,
        'BraveSoftware',
        'Brave-Browser',
        'Application',
        'brave.exe'
      )
    ]

    for (const executable of candidates) {
      if (!executable || !existsSync(executable)) continue
      try {
        const child = spawn(executable, [url], {
          detached: true,
          stdio: 'ignore',
          windowsHide: false
        })
        child.unref()
        return true
      } catch {
        // Try the next installed browser; the native handler is the final fallback.
      }
    }
  }

  try {
    await shell.openExternal(url)
    return true
  } catch {
    return false
  }
}
