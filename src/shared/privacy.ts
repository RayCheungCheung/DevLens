/** Persistent DevLens Shield and privacy settings for one profile. */

export type ShieldMode = 'standard' | 'strict'
export type HistoryRetentionMode = 'always' | 'custom' | 'incognito'
export type DnsMode = 'system' | 'secure' | 'off'

export interface PrivacyPreferences {
  shieldMode: ShieldMode
  blockCrossSiteTrackers: boolean
  blockFingerprinters: boolean
  blockCryptominers: boolean
  networkTunnelEnabled: boolean
  dataLimitGb: number
  dataUsedGb: number
  historyRetention: HistoryRetentionMode
  retentionDays: number
  sendDnt: boolean
  dnsMode: DnsMode
  httpsOnly: boolean
  siteExceptions: string[]
}

export interface ProfileDiskUsage {
  bytes: number
  files: number
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
  historyRetention: 'always',
  retentionDays: 90,
  sendDnt: true,
  dnsMode: 'secure',
  httpsOnly: true,
  siteExceptions: []
}
