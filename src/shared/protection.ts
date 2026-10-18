/**
 * Protection levels.
 *
 * The levels are a *client side* dial. They change how aggressively DevLens cancels tracking
 * requests, hardens outgoing headers and isolates the browsing session - and they change
 * nothing else. There is no telemetry tier, no "send diagnostics" tier and no cloud lookup
 * behind any of them: every level is 100% local-first, and the promise in
 * `LOCAL_ONLY_GUARANTEE` is the same string the UI shows, so the two cannot drift apart.
 *
 * The table lives in shared code because the main process enforces it and the renderer
 * explains it; neither side gets to invent its own idea of what "strict" means.
 */

export type ProtectionLevel = 'standard' | 'strict' | 'extreme'

export const PROTECTION_LEVELS: readonly ProtectionLevel[] = ['standard', 'strict', 'extreme']

export interface ProtectionDescriptor {
  id: ProtectionLevel
  /** Full name used inside the menu. */
  label: string
  /** Short name used in the toolbar badge. */
  short: string
  /** One line explaining the trade-off. */
  summary: string
  /** What the level actually changes, in the order it applies. */
  details: string[]
}

export const PROTECTION_DESCRIPTORS: Record<ProtectionLevel, ProtectionDescriptor> = {
  standard: {
    id: 'standard',
    label: 'Standard Defense',
    short: 'Standard',
    summary: 'Standard ad and tracker blocking, built for maximum site compatibility.',
    details: [
      'Known ad, analytics and session-recorder hosts are cancelled before they leave',
      'Page scripts, storage and headers are left exactly as the site wrote them'
    ]
  },
  strict: {
    id: 'strict',
    label: 'Strict Privacy',
    short: 'Strict',
    summary: 'Enhanced blocking plus fingerprint hardening.',
    details: [
      'Aggressive list: beacons, tracking pixels, ad exchanges and product telemetry',
      'Cross-site referrers are trimmed and Do Not Track / Global Privacy Control are sent'
    ]
  },
  extreme: {
    id: 'extreme',
    label: 'Extreme Defense',
    short: 'Extreme',
    summary: 'Full script isolation with the maximum blocking DevLens can apply.',
    details: [
      'Everything in Strict, plus the RAM-only defense session for both viewports',
      'Nothing is written down: no history, cache or persistent cookies for the session'
    ]
  }
}

/**
 * The promise every level keeps. Rendered verbatim in the menu, and there is exactly one
 * copy of it in the codebase.
 */
export const LOCAL_ONLY_GUARANTEE =
  'All modes guarantee 100% local-first privacy. Zero data is ever sent to external servers.'

/** What the engine actually switches on for a level. */
export interface ProtectionPolicy {
  /** Cancel traffic to known ad, analytics and session-recorder hosts. */
  blockTrackers: boolean
  /** Extend that list to beacons, pixels, ad exchanges and product telemetry. */
  aggressiveBlocklist: boolean
  /** Send Do Not Track and Global Privacy Control, and drop the client hints that fingerprint. */
  privacyHeaders: boolean
  /** Cut a cross-site referrer back to its origin so it cannot leak the page you came from. */
  trimCrossSiteReferer: boolean
  /** Run the viewports on the in-memory defense session: no history, no cookie persistence. */
  ramOnlySession: boolean
}

const POLICIES: Record<ProtectionLevel, ProtectionPolicy> = {
  standard: {
    blockTrackers: true,
    aggressiveBlocklist: false,
    privacyHeaders: false,
    trimCrossSiteReferer: false,
    ramOnlySession: false
  },
  strict: {
    blockTrackers: true,
    aggressiveBlocklist: true,
    privacyHeaders: true,
    trimCrossSiteReferer: true,
    ramOnlySession: false
  },
  extreme: {
    blockTrackers: true,
    aggressiveBlocklist: true,
    privacyHeaders: true,
    trimCrossSiteReferer: true,
    ramOnlySession: true
  }
}

export function protectionPolicy(level: ProtectionLevel): ProtectionPolicy {
  return { ...POLICIES[level] }
}

export function protectionDescriptor(level: ProtectionLevel): ProtectionDescriptor {
  return PROTECTION_DESCRIPTORS[level]
}

export function isProtectionLevel(value: unknown): value is ProtectionLevel {
  return typeof value === 'string' && (PROTECTION_LEVELS as readonly string[]).includes(value)
}

/** Parses config/env input, falling back to Standard rather than guessing. */
export function resolveProtectionLevel(value: string | undefined | null): ProtectionLevel {
  const normalised = value?.trim().toLowerCase()
  return isProtectionLevel(normalised) ? normalised : 'standard'
}
