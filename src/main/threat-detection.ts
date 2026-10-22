/**
 * Threat detection engine for WImH extreme protection mode.
 *
 * Watches mouse movement entropy and input trustworthiness to detect potential
 * remote-desktop injection, automated takeovers, or screen-capture attempts.
 * When a threat is confirmed, the engine fires an alert that triggers the
 * ProtectiveShield overlay in the renderer.
 *
 * The analyzer works on a rolling window of mouse samples. Human movement carries
 * micro-jitter - small random variations in angle and velocity - while synthetic
 * input (remote desktop, automation scripts) tends toward unnaturally smooth
 * trajectories or uniform jitter patterns.
 */

import type { ThreatAlert, ThreatState } from '../shared/types'

// --- Configuration -----------------------------------------------------------

/** How many recent mouse samples to keep for entropy analysis. */
const SAMPLE_WINDOW = 60

/** Minimum samples before the analyzer will produce a verdict. */
const MIN_SAMPLES = 20

/**
 * Entropy threshold below which movement is considered synthetic (too smooth).
 * Human movement typically has angle entropy > 0.3; synthetic < 0.15.
 */
const ENTROPY_THRESHOLD_LOW = 0.15

/**
 * Entropy threshold above which movement is considered synthetic (too chaotic).
 * Values above 0.85 with uniform distribution suggest a script.
 */
const ENTROPY_THRESHOLD_HIGH = 0.85

/** How many consecutive low-entropy windows before firing an alert. */
const CONSECUTIVE_LOW_COUNT = 3

/** How long (ms) after dismissal before the analyzer can alert again. */
const ALERT_COOLDOWN_MS = 15000

// --- Types -------------------------------------------------------------------

interface MouseSample {
  x: number
  y: number
  timestamp: number
}

interface AngleSample {
  /** Angle change between consecutive movement vectors, in radians [-PI, PI]. */
  deltaAngle: number
  /** Instantaneous velocity (pixels per ms). */
  velocity: number
  timestamp: number
}

// --- State -------------------------------------------------------------------

let samples: MouseSample[] = []
let angleSamples: AngleSample[] = []
let consecutiveLow = 0
let consecutiveHigh = 0
let lastAlertAt = 0
let lastTrustedViolationAt = 0
let locked = false
let activeAlert: ThreatAlert | null = null
let enabled = false

let notifyAlert: (alert: ThreatAlert) => void = () => {}

// --- Public API --------------------------------------------------------------

export interface ThreatDetectionConfig {
  onAlert: (alert: ThreatAlert) => void
}

export function configureThreatDetection(config: ThreatDetectionConfig): void {
  notifyAlert = config.onAlert
}

export function enableThreatDetection(): void {
  enabled = true
  reset()
}

export function disableThreatDetection(): void {
  enabled = false
  reset()
  dismissAlert()
}

export function threatStateNow(): ThreatState {
  return {
    alert: activeAlert,
    locked,
    reason: activeAlert
      ? `DevLens detected ${describeThreat(activeAlert.kind)} and locked the surface to protect your session.`
      : ''
  }
}

/**
 * Called when the operator dismisses the protective shield.
 * The shield unlocks and the cooldown prevents immediate re-triggering.
 */
export function dismissAlert(): ThreatState {
  locked = false
  activeAlert = null
  consecutiveLow = 0
  consecutiveHigh = 0
  lastAlertAt = Date.now()
  return threatStateNow()
}

// --- Input sampling ----------------------------------------------------------

/**
 * Feed a raw mouse position sample to the analyzer.
 *
 * Call this from the preload on every mousemove event. The analyzer converts
 * positions into angle deltas and velocities, then computes entropy.
 */
export function feedMouseSample(x: number, y: number, timestamp: number): void {
  if (!enabled) return

  const sample: MouseSample = { x, y, timestamp }
  samples.push(sample)

  // Keep the window bounded.
  while (samples.length > SAMPLE_WINDOW) samples.shift()

  // Compute angle delta from the previous sample.
  if (samples.length >= 2) {
    const prev = samples[samples.length - 2]
    const curr = samples[samples.length - 1]
    const dt = curr.timestamp - prev.timestamp
    if (dt <= 0) return

    const dx = curr.x - prev.x
    const dy = curr.y - prev.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Skip stationary samples (no movement, no direction).
    if (dist < 0.5) return

    const velocity = dist / dt

    // Compute angle delta only when we have at least two prior vectors.
    if (angleSamples.length > 0) {
      const prevAngle = Math.atan2(
        curr.y - (samples[samples.length - 3]?.y ?? prev.y),
        curr.x - (samples[samples.length - 3]?.x ?? prev.x)
      )
      const currAngle = Math.atan2(dy, dx)
      let delta = currAngle - prevAngle
      // Wrap to [-PI, PI].
      while (delta > Math.PI) delta -= 2 * Math.PI
      while (delta < -Math.PI) delta += 2 * Math.PI

      angleSamples.push({ deltaAngle: delta, velocity, timestamp })
      while (angleSamples.length > SAMPLE_WINDOW) angleSamples.shift()
    } else {
      // Prime the first angle sample with zero delta.
      angleSamples.push({ deltaAngle: 0, velocity, timestamp })
    }
  }

  // Run analysis when we have enough samples.
  if (angleSamples.length >= MIN_SAMPLES) analyzeEntropy()
}

/**
 * Called when the preload detects a non-trusted input event (isTrusted === false).
 * A single violation is suspicious but not conclusive; two within a short window
 * triggers an alert.
 */
export function noteUntrustedEvent(kind: string): void {
  if (!enabled) return

  const now = Date.now()
  if (now - lastTrustedViolationAt < 3000) {
    // Second untrusted event within 3 seconds - likely an automated takeover.
    fireAlert({
      kind: 'input-anomaly',
      message: 'Synthetic input detected',
      detail: `Multiple non-trusted ${kind} events - possible automated control`,
      severity: 'critical',
      timestamp: now
    })
    lastTrustedViolationAt = 0
  } else {
    lastTrustedViolationAt = now
  }
}

/**
 * Called when the preload detects a screen-capture API request from a guest page.
 * While WImH already blocks display media requests at the session level, this
 * catches attempts that get past the handler or come from the shell.
 */
export function noteScreenCaptureAttempt(source: string): void {
  if (!enabled) return

  fireAlert({
    kind: 'screenshot-detected',
    message: 'Screen capture attempt blocked',
    detail: `${source} tried to capture the screen - DevLens is protecting you`,
    severity: 'critical',
    timestamp: Date.now()
  })
}

// --- Entropy analysis --------------------------------------------------------

function analyzeEntropy(): void {
  if (angleSamples.length < MIN_SAMPLES) return

  // Use the most recent MIN_SAMPLES entries.
  const recent = angleSamples.slice(-MIN_SAMPLES)
  const deltas = recent.map((s) => s.deltaAngle)

  // Compute Shannon entropy of the angle deltas, binned into 8 buckets.
  const entropy = computeAngleEntropy(deltas)

  // Check for velocity uniformity - another sign of synthetic input.
  const velocities = recent.map((s) => s.velocity)
  const velocityVariance = computeVariance(velocities, computeMean(velocities))

  // Human movement: entropy is moderate, velocity has natural variance.
  // Synthetic: entropy is very low (straight-line interpolation) or very high (random script).
  // Also check for constant-velocity movement (zero variance).

  if (entropy < ENTROPY_THRESHOLD_LOW || (velocityVariance < 0.001 && velocities.length > 30)) {
    consecutiveLow += 1
    consecutiveHigh = 0

    if (consecutiveLow >= CONSECUTIVE_LOW_COUNT) {
      fireAlert({
        kind: 'remote-control',
        message: 'Unnatural mouse movement detected',
        detail:
          entropy < 0.05
            ? 'Movement trajectory is too linear - possible remote desktop injection'
            : 'Constant-velocity mouse pattern - possible automated control',
        severity: 'warning',
        timestamp: Date.now()
      })
      consecutiveLow = 0
    }
  } else if (entropy > ENTROPY_THRESHOLD_HIGH) {
    consecutiveHigh += 1
    consecutiveLow = 0

    if (consecutiveHigh >= CONSECUTIVE_LOW_COUNT) {
      fireAlert({
        kind: 'remote-control',
        message: 'Erratic mouse movement detected',
        detail: 'Movement shows uniform-random jitter pattern - possible scripted control',
        severity: 'critical',
        timestamp: Date.now()
      })
      consecutiveHigh = 0
    }
  } else {
    // Normal human movement - reset counters.
    consecutiveLow = Math.max(0, consecutiveLow - 1)
    consecutiveHigh = Math.max(0, consecutiveHigh - 1)
  }
}

// --- Math helpers ------------------------------------------------------------

function computeAngleEntropy(deltas: number[]): number {
  const BINS = 8
  const counts = new Array<number>(BINS).fill(0)
  const binWidth = (2 * Math.PI) / BINS

  for (const delta of deltas) {
    // Map [-PI, PI] to [0, BINS-1].
    let bin = Math.floor((delta + Math.PI) / binWidth)
    if (bin < 0) bin = 0
    if (bin >= BINS) bin = BINS - 1
    counts[bin] += 1
  }

  const n = deltas.length
  let entropy = 0
  for (const count of counts) {
    if (count === 0) continue
    const p = count / n
    entropy -= p * Math.log2(p)
  }

  // Normalize to [0, 1] against max entropy for this bin count.
  return entropy / Math.log2(BINS)
}

function computeMean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function computeVariance(values: number[], mean: number): number {
  if (values.length <= 1) return 0
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1)
}

// --- Alert lifecycle ---------------------------------------------------------

function fireAlert(alert: ThreatAlert): void {
  const now = Date.now()

  // Cooldown: don't spam alerts.
  if (now - lastAlertAt < ALERT_COOLDOWN_MS) return

  activeAlert = alert
  locked = true
  lastAlertAt = now
  notifyAlert(alert)
}

function reset(): void {
  samples = []
  angleSamples = []
  consecutiveLow = 0
  consecutiveHigh = 0
  lastTrustedViolationAt = 0
}

function describeThreat(kind: string): string {
  switch (kind) {
    case 'remote-control':
      return 'potential remote control or automated input'
    case 'screenshot-detected':
      return 'a screen capture attempt'
    case 'input-anomaly':
      return 'synthetic (non-human) input events'
    default:
      return 'suspicious activity'
  }
}
