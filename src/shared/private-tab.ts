/**
 * Tab-level maximum protection.
 *
 * A private tab is one tab that runs at Level 3 while the rest of the window keeps whatever
 * dial position the operator chose. It is deliberately *not* a mode: nothing about the window
 * changes, the other tabs keep their partition, their history and their protection level, and
 * there is no window-wide side effect to undo afterwards.
 *
 * Three things make it a private tab rather than a relabelled one, and all three live here so
 * the main process, the tab strip and the toolbar cannot disagree about what it means:
 *
 *  - **Its own session.** The tab runs on `ghost-incognito-<tabId>` - an in-memory partition
 *    that is created empty, hardened, and wiped when the tab closes. No other tab shares it,
 *    which is what makes closing the tab the end of the data rather than a cleanup step.
 *  - **Maximum protection, not a dial position.** The policy is the Extreme one, applied
 *    through the session's own request filter, so it holds even while the window is on
 *    Standard - and it cannot be lowered from the toolbar, because "private" would then be a
 *    promise the badge could quietly retract.
 *  - **Nothing is written down.** A visit in a private tab never reaches `history.ts`, so it
 *    cannot show up in the omnibox suggestions of any profile.
 */

import { protectionPolicy, type ProtectionLevel, type ProtectionPolicy } from './protection'
import type { ProtectionState } from './types'

/**
 * Partition prefix. The name says what it is: a throwaway, in-memory session for one tab.
 * Electron treats any partition without the `persist:` prefix as memory-only.
 */
export const PRIVATE_TAB_PARTITION_PREFIX = 'ghost-incognito-'

/** The level a private tab enforces. Level 3 of the dial, spelled once. */
export const PRIVATE_TAB_LEVEL: ProtectionLevel = 'extreme'

/** Shortcut that opens one from anywhere, in either mode. */
export const PRIVATE_TAB_SHORTCUT_LABEL = 'Ctrl/Cmd+Shift+P'

/** How long the `+` button has to be held before it offers the private tab. */
export const PRIVATE_TAB_LONG_PRESS_MS = 300

/** Name of the tab-level mode, used verbatim in the badge, the pill and the menu. */
export const PRIVATE_TAB_LABEL = 'Private (Max Protection)'

/** One line the UI shows to explain what is being enforced while such a tab is focused. */
export const PRIVATE_TAB_SUMMARY =
  'This tab only: Level 3 blocking, hardened headers, RAM-only session, no history.'

/**
 * The partition one private tab owns.
 *
 * Derived from the tab id, so the renderer's `<webview partition>` and the main process's
 * session are the same string without a round trip having to agree on anything. The id is
 * sanitised because a partition name ends up in Electron's internal paths.
 */
export function privateTabPartition(tabId: string): string {
  return `${PRIVATE_TAB_PARTITION_PREFIX}${tabId.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

export function isPrivateTabPartition(partition: string): boolean {
  return partition.startsWith(PRIVATE_TAB_PARTITION_PREFIX)
}

/** The tab id inside a partition name, for the sessions that only have the partition. */
export function privateTabIdOf(partition: string): string | null {
  return isPrivateTabPartition(partition) ? partition.slice(PRIVATE_TAB_PARTITION_PREFIX.length) : null
}

/**
 * The policy a private tab enforces, whatever the window is set to.
 *
 * A copy per call: the engines that consume it never mutate it, and sharing one object would
 * make a future "tweak one field" bug apply to every private tab at once.
 */
export function privateTabPolicy(): ProtectionPolicy {
  return protectionPolicy(PRIVATE_TAB_LEVEL)
}

/** Live state of one private tab, as the shell's UI and the test harness read it. */
export interface PrivateTabState {
  tabId: string
  partition: string
  /** Always `extreme`: the level this tab enforces on itself. */
  level: ProtectionLevel
  policy: ProtectionPolicy
  enteredAt: number
  /** Requests this tab's session cancelled before they left the machine. */
  blockedRequests: number
  /** Header sets this tab's session rewrote (DNT / Sec-GPC / client hints / referer). */
  scrubbedHeaders: number
  /** Visits this tab refused to write to `history.ts`. */
  historyBlocked: number
  /** Set on the record returned by `close`, once the session has been wiped. */
  wipedAt: number | null
}

/**
 * What the protection badge shows while a private tab is focused.
 *
 * The badge is normally a mirror of the engine. For a private tab it mirrors the *tab*
 * instead, because the engine's own level is the window's business and this badge is on the
 * tab's page: it says Level 3 and it counts this tab's cancellations, so the two numbers on
 * screen describe the thing the operator is actually looking at.
 */
export function privateProtectionView(
  base: ProtectionState,
  tab: PrivateTabState | null | undefined
): ProtectionState {
  if (!tab) return base
  return {
    ...base,
    level: PRIVATE_TAB_LEVEL,
    policy: privateTabPolicy(),
    blockedRequests: tab.blockedRequests,
    scrubbedHeaders: tab.scrubbedHeaders,
    trimmedReferers: base.trimmedReferers,
    ramOnlySession: true,
    /* Per-site exemptions are the window's, and they may not soften this tab. */
    allowedSites: [],
    changedAt: tab.enteredAt
  }
}
