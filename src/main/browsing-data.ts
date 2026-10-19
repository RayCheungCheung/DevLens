import { session, type Session } from 'electron'
import type {
  ClearBrowsingDataRequest,
  ClearBrowsingDataResult,
  PrivacyPreferences,
  RetentionPeriod
} from '../shared/privacy'
import { activeProfilePartition } from './profiles'
import { preferencesNow, setPreferences } from './preferences'
import { flushHistory, historyClear, historyKeepOrigins, historyPrune } from './history'

const DAY_MS = 24 * 60 * 60 * 1000
const STORAGE_TYPES = [
  'localStorage',
  'indexedDB',
  'serviceWorkers',
  'fileSystems',
  'webSQL'
] as const

function activeSession(): Session {
  return session.fromPartition(activeProfilePartition(), { cache: true })
}

function originsFor(hosts: string[]): string[] {
  const origins = new Set<string>()
  for (const raw of hosts) {
    try {
      const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
      const parsed = new URL(withScheme)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue
      origins.add(`https://${parsed.host}`)
      origins.add(`http://${parsed.host}`)
    } catch {
      /* an invalid exception protects nothing */
    }
  }
  return [...origins]
}

function exceptionOrigins(): string[] {
  return originsFor(preferencesNow().privacy.browsingDataExceptions)
}

function pinnedOrigins(): string[] {
  const pinned = preferencesNow().launchpad.session.tabs.filter((tab) => tab.pinned === true)
  return originsFor(
    pinned.flatMap((tab) => {
      try {
        return [new URL(tab.url).origin]
      } catch {
        return []
      }
    })
  )
}

async function clearStorageExcept(ses: Session, excludeOrigins: string[]): Promise<void> {
  if (excludeOrigins.length) {
    await ses.clearData({
      dataTypes: [...STORAGE_TYPES],
      excludeOrigins,
      originMatchingMode: 'origin-in-all-contexts'
    })
  } else {
    await ses.clearData({ dataTypes: [...STORAGE_TYPES] })
  }
}

async function clearCookiesExcept(ses: Session, excludeOrigins: string[]): Promise<void> {
  const keepHosts = new Set(
    excludeOrigins.flatMap((origin) => {
      try {
        return [new URL(origin).hostname.toLowerCase()]
      } catch {
        return []
      }
    })
  )
  const keep = (host: string): boolean =>
    [...keepHosts].some((kept) => host === kept || host.endsWith(`.${kept}`))
  for (const cookie of await ses.cookies.get({})) {
    const host = (cookie.domain ?? '').replace(/^\./, '').toLowerCase()
    if (!host || keep(host)) continue
    const url = `${cookie.secure ? 'https' : 'http'}://${host}${cookie.path || '/'}`
    await ses.cookies.remove(url, cookie.name).catch(() => undefined)
  }
}

export async function clearBrowsingData(
  request: ClearBrowsingDataRequest
): Promise<ClearBrowsingDataResult> {
  const ses = activeSession()
  const cleared: string[] = []
  try {
    const exceptions = exceptionOrigins()
    if (request.cookies) {
      await clearCookiesExcept(ses, exceptions)
      cleared.push('cookies')
    }
    if (request.storage) {
      await clearStorageExcept(ses, exceptions)
      cleared.push('storage')
    }
    if (request.cache) {
      await ses.clearCache()
      cleared.push('cache')
    }
    if (request.history) {
      historyClear()
      flushHistory()
      cleared.push('history')
    }
    return { ok: true, cleared, error: null }
  } catch (error) {
    return {
      ok: false,
      cleared,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

function periodDays(period: RetentionPeriod): number | null {
  if (period === '7d') return 7
  if (period === '30d') return 30
  if (period === '90d') return 90
  return null
}

function due(lastCleanupAt: number, period: RetentionPeriod): boolean {
  const days = periodDays(period)
  return days !== null && Date.now() - lastCleanupAt >= days * DAY_MS
}

/** Runs age-based cleanup at launch and periodically while DevLens is open. */
export async function runRetentionCleanup(): Promise<void> {
  const privacy = preferencesNow().privacy
  const patch: Partial<PrivacyPreferences> = {}
  try {
    if (privacy.historyPolicy === 'never') {
      historyClear()
    } else {
      const historyDays = periodDays(privacy.historyExpiry)
      if (historyDays !== null) historyPrune(historyDays)
    }
    if (due(privacy.lastCookieCleanupAt, privacy.cookieExpiry)) {
      const ses = activeSession()
      await clearCookiesExcept(ses, exceptionOrigins())
      await clearStorageExcept(ses, exceptionOrigins())
      patch.lastCookieCleanupAt = Date.now()
    }
    if (due(privacy.lastCacheCleanupAt, privacy.cacheExpiry)) {
      await activeSession().clearCache()
      patch.lastCacheCleanupAt = Date.now()
    }
    if (Object.keys(patch).length > 0) {
      setPreferences({ privacy: { ...privacy, ...patch } })
    }
    flushHistory()
  } catch (error) {
    console.warn('[devlens] retention cleanup failed', error)
  }
}

/** Work that must finish before Electron is allowed to close. */
export async function cleanupOnExit(): Promise<void> {
  const privacy = preferencesNow().privacy
  const ses = activeSession()
  try {
    if (privacy.historyPolicy === 'pinned') {
      const keep = pinnedOrigins()
      await clearCookiesExcept(ses, keep)
      await clearStorageExcept(ses, keep)
      historyKeepOrigins(keep)
    }
    if (privacy.autoClearOnExit || privacy.cookieExpiry === 'on-close') {
      const exceptions = exceptionOrigins()
      await clearCookiesExcept(ses, exceptions)
      await clearStorageExcept(ses, exceptions)
    }
    if (privacy.cacheExpiry === 'on-close') await ses.clearCache()
    if (privacy.historyExpiry === 'on-close' || privacy.historyPolicy === 'never') {
      historyClear()
    }
    flushHistory()
  } catch (error) {
    console.warn('[devlens] exit cleanup failed', error)
  }
}

export function needsExitCleanup(): boolean {
  const privacy = preferencesNow().privacy
  return (
    privacy.autoClearOnExit ||
    privacy.historyPolicy === 'pinned' ||
    privacy.historyPolicy === 'never' ||
    privacy.cookieExpiry === 'on-close' ||
    privacy.cacheExpiry === 'on-close' ||
    privacy.historyExpiry === 'on-close'
  )
}
