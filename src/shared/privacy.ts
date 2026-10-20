/** Persistent DevLens Shield and privacy settings for one profile. */

export type ShieldMode = 'standard' | 'strict'
export type HistoryPolicy =
  | 'remember'
  | 'never'
  | 'pinned'
  | 'pinned-bookmarks'
  | 'pinned-exceptions'
  | 'pinned-bookmarks-exceptions'
export type RetentionPeriod = 'forever' | '7d' | '30d' | '90d' | 'on-close'
export type DnsMode = 'system' | 'secure' | 'off'

export interface PrivacyPreferences {
  shieldMode: ShieldMode
  blockCrossSiteTrackers: boolean
  blockFingerprinters: boolean
  blockCryptominers: boolean
  networkTunnelEnabled: boolean
  dataLimitGb: number
  dataUsedGb: number
  autoClearOnExit: boolean
  historyPolicy: HistoryPolicy
  cookieExpiry: RetentionPeriod
  historyExpiry: RetentionPeriod
  cacheExpiry: RetentionPeriod
  lastCookieCleanupAt: number
  lastCacheCleanupAt: number
  sendDnt: boolean
  dnsMode: DnsMode
  httpsOnly: boolean
  siteExceptions: string[]
  /** Sites retained when browsing data is cleared or expiration cleanup runs. */
  browsingDataExceptions: string[]
}

export interface ClearBrowsingDataRequest {
  cookies: boolean
  cache: boolean
  history: boolean
  storage: boolean
}

export interface ClearBrowsingDataResult {
  ok: boolean
  cleared: string[]
  error: string | null
}

export interface ProfileDiskUsage {
  bytes: number
  files: number
  cacheBytes?: number
}

export interface ShieldRules {
  crossSiteTrackers: boolean
  fingerprinters: boolean
  cryptominers: boolean
  sendDnt: boolean
}

export const DEFAULT_PRIVACY_PREFERENCES: PrivacyPreferences = {
  shieldMode: 'standard',
  blockCrossSiteTrackers: true,
  blockFingerprinters: false,
  blockCryptominers: true,
  networkTunnelEnabled: false,
  dataLimitGb: 10,
  dataUsedGb: 0,
  autoClearOnExit: false,
  historyPolicy: 'remember',
  cookieExpiry: 'forever',
  historyExpiry: 'forever',
  cacheExpiry: '30d',
  lastCookieCleanupAt: 0,
  lastCacheCleanupAt: 0,
  sendDnt: true,
  dnsMode: 'secure',
  httpsOnly: true,
  siteExceptions: [],
  browsingDataExceptions: []
}
