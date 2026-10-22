import { randomBytes, randomInt } from 'node:crypto'
import type { Session, WebContents } from 'electron'
import type { BrowserFingerprintProfile } from '../shared/types'

type FingerprintMode = BrowserFingerprintProfile['mode']

const SCREENS = [
  { width: 1920, height: 1080 },
  { width: 2048, height: 1152 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 }
] as const

const LANGUAGES = [
  ['en-US', 'en'],
  ['zh-TW', 'zh', 'en-US'],
  ['zh-HK', 'zh', 'en-US'],
  ['ja-JP', 'ja', 'en-US'],
  ['de-DE', 'de', 'en-US'],
  ['en-GB', 'en']
] as const

const GPUS = [
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' }
] as const

const profiles = new WeakMap<Session, BrowserFingerprintProfile>()

function sample<T>(values: readonly T[]): T {
  return values[randomInt(values.length)]
}

/**
 * Creates a fresh, internally consistent profile. This is not an attempt to guarantee anonymity:
 * it limits cross-session linkage while leaving enough normal behaviour for web applications.
 */
function createProfile(mode: FingerprintMode): BrowserFingerprintProfile {
  const screen = sample(SCREENS)
  const gpu = sample(GPUS)
  return {
    mode,
    seed: randomBytes(16).toString('hex'),
    hardwareConcurrency: sample([4, 6, 8, 12, 16]),
    deviceMemory: sample([4, 8, 16]),
    screenWidth: screen.width,
    screenHeight: screen.height,
    colorDepth: 24,
    languages: [...sample(LANGUAGES)],
    gpuVendor: gpu.vendor,
    gpuRenderer: gpu.renderer,
    canvasNoise: 1,
    audioNoise: 0.00000005
  }
}

export function rotateBrowserFingerprint(
  ses: Session,
  mode: FingerprintMode
): BrowserFingerprintProfile {
  const profile = createProfile(mode)
  profiles.set(ses, profile)
  return profile
}

export function clearBrowserFingerprint(ses: Session): void {
  profiles.delete(ses)
}

/**
 * The sync IPC lookup comes from the guest preload, whose `contents.session` is the authoritative
 * session identity. There is no need to trust a partition string supplied by page-controlled UI.
 */
export function fingerprintForContents(contents: WebContents): BrowserFingerprintProfile | null {
  return profiles.get(contents.session) ?? null
}
