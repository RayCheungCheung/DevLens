import { capabilitiesFor, type ModeCapabilities, type WorkspaceMode } from '../shared/mode'
import type { InspectionState, ModeState } from '../shared/types'

/**
 * Workspace mode enforcer.
 *
 * The mode is main-process state, and the capabilities table decides what this process
 * actually does: in normal mode the monitoring pipeline is never fed, rules are never
 * applied and AI prompts are refused. Hiding the panels in the UI is not enough on its own -
 * a renderer bug must not be able to turn a "clean" browser into a monitored one.
 */

let mode: WorkspaceMode = 'dev'
let switchedAt = Date.now()
let notify: (state: ModeState) => void = () => {}
let onLeaveDev: () => void = () => {}
let notifyInspection: (state: InspectionState) => void = () => {}
let onLeaseRevoked: () => void = () => {}

/**
 * On-demand inspection lease.
 *
 * Normal mode keeps the monitoring pipeline off, but the WImH overlay may borrow it back
 * while the operator has the panel open. The lease is the only way observation starts in
 * normal mode, it is granted by an explicit renderer call, and revoking it drops whatever was
 * observed so a closed panel leaves nothing behind in memory.
 */
let leaseOpen = false
let leaseGrantedAt: number | null = null
let leaseCaptured = 0
let leaseConsole = 0

export function configureMode(input: {
  initial: WorkspaceMode
  onChanged: (state: ModeState) => void
  /** Called before leaving dev mode, so held requests are released instead of hanging. */
  onLeaveDev: () => void
  /** Called when the lease changes, so the shell can show capture as on or off. */
  onInspectionChanged?: (state: InspectionState) => void
  /** Called when the lease ends, so this process can forget what it observed. */
  onLeaseRevoked?: () => void
}): void {
  mode = input.initial
  switchedAt = Date.now()
  notify = input.onChanged
  onLeaveDev = input.onLeaveDev
  notifyInspection = input.onInspectionChanged ?? (() => {})
  onLeaseRevoked = input.onLeaseRevoked ?? (() => {})
}

export function currentMode(): WorkspaceMode {
  return mode
}

export function capabilities(): ModeCapabilities {
  return capabilitiesFor(mode)
}

export function isDevMode(): boolean {
  return mode === 'dev'
}

/**
 * Console messages and request records are collected in dev mode, or in normal mode while the
 * operator has explicitly opened the WImH overlay.
 */
export function isMonitoringEnabled(): boolean {
  return capabilities().monitoring || leaseOpen
}

/** Block/header/hold rules only run in dev mode. */
export function areRulesEnabled(): boolean {
  return capabilities().rules
}

export function isAuthoringEnabled(): boolean {
  return capabilities().authoring
}

export function isAiEnabled(): boolean {
  return capabilities().ai
}

/**
 * Normal mode keeps the tracker blocklist on even though the defense panels are closed:
 * "max privacy" should not depend on remembering to open a panel.
 */
export function forcesTrackerBlocking(): boolean {
  return capabilities().trackerBlocking
}

export function modeStateNow(): ModeState {
  const caps = capabilitiesFor(mode)
  return {
    mode,
    switchedAt,
    enforced: {
      // Fresh from the table on purpose: the lease is on-demand, not part of the mode.
      monitoring: caps.monitoring || leaseOpen,
      rules: caps.rules,
      authoring: caps.authoring,
      ai: caps.ai,
      trackerBlocking: caps.trackerBlocking
    }
  }
}

/* ------------------------------------------------------------------ *
 * On-demand inspection lease
 * ------------------------------------------------------------------ */

export function inspectionStateNow(): InspectionState {
  const leaseActive = leaseOpen && !capabilitiesFor(mode).monitoring
  return {
    open: leaseOpen,
    capturing: isMonitoringEnabled(),
    source: capabilitiesFor(mode).monitoring ? 'dev' : leaseActive ? 'lease' : 'off',
    capturedCount: leaseActive ? leaseCaptured : 0,
    consoleCount: leaseActive ? leaseConsole : 0,
    grantedAt: leaseActive ? leaseGrantedAt : null
  }
}

/**
 * Opens or closes the overlay's observation window.
 *
 * Dev mode does not need it (capture is already on for the session), so there it only records
 * that the panel is visible. In normal mode it is the switch that arms and disarms capture.
 */
export function setInspectionLease(open: boolean): InspectionState {
  if (open === leaseOpen) return inspectionStateNow()
  leaseOpen = open

  if (open) {
    leaseCaptured = 0
    leaseConsole = 0
    leaseGrantedAt = Date.now()
  } else {
    // Dev mode observes regardless of the lease, so closing the panel there must not throw
    // away what the session collected. Only an on-demand window owns what it observed.
    if (!capabilitiesFor(mode).monitoring) onLeaseRevoked()
    leaseCaptured = 0
    leaseConsole = 0
    leaseGrantedAt = null
  }

  const state = inspectionStateNow()
  notifyInspection(state)
  return state
}

/** Counted while the lease is on, so the overlay can show what it observed and no more. */
export function noteLeaseRequest(): void {
  if (!leaseOpen) return
  leaseCaptured += 1
  notifyInspection(inspectionStateNow())
}

export function noteLeaseConsole(): void {
  if (!leaseOpen) return
  leaseConsole += 1
  notifyInspection(inspectionStateNow())
}

/** Called when the captures are dropped, so the overlay's counters match what is left. */
export function clearLeaseCounters(): void {
  if (!leaseOpen) return
  leaseCaptured = 0
  leaseConsole = 0
  notifyInspection(inspectionStateNow())
}

export function setMode(next: WorkspaceMode): ModeState {
  if (next === mode) return modeStateNow()

  // Anything the operator is holding must be released before the interceptor goes quiet,
  // otherwise the page would wait for an answer that can no longer come.
  if (mode === 'dev' && next !== 'dev') onLeaveDev()

  mode = next
  switchedAt = Date.now()
  const state = modeStateNow()
  notify(state)
  // The lease survives a mode switch, but what it means changes, so re-announce it.
  notifyInspection(inspectionStateNow())
  return state
}

/** Used by the config loader before the window exists. */
export function primeMode(initial: WorkspaceMode): void {
  mode = initial
  switchedAt = Date.now()
}
