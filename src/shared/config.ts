import type { AiProviderId } from './types'
import type { ProtectionLevel } from './protection'

/** Shape of `devlens.config.json` (all keys optional, defaults below). */
export interface DevLensConfig {
  /** Root of the project you are previewing. Relative paths resolve against the config file. */
  workspaceRoot?: string
  /**
   * Optional start page for both viewports. There is deliberately no default: with no URL
   * configured DevLens opens the new tab dashboard instead of loading a page nobody asked for.
   */
  homeUrl?: string | null
  /** Electron session partition used by both <webview>s. */
  partition?: string
  mobile?: {
    width?: number
    height?: number
  }
  ide?: {
    /** URI scheme used by "Open in VS Code": vscode, cursor, vscodium, ... */
    scheme?: string
    /** File opened by the toolbar button, relative to workspaceRoot. */
    entryFile?: string
    entryLine?: number
  }
  ai?: {
    provider?: AiProviderId
    model?: string
    /** OpenAI compatible base URL, or the Ollama host. */
    baseUrl?: string
    /** Name of the environment variable that holds the API key. */
    apiKeyEnv?: string
    temperature?: number
    maxTokens?: number
  }
  interceptor?: {
    /** Start capturing and applying rules immediately. */
    enabled?: boolean
    /** How long a held request waits for the operator before it continues. */
    pauseTimeoutMs?: number
    maxPaused?: number
    bufferSize?: number
  }
  report?: {
    /** When set, reports are written here instead of opening a save dialog. */
    outputDir?: string
  }
  omnibox?: {
    /** Engine used when bare input is a query rather than an address. */
    searchEngine?: 'google' | 'brave' | 'duckduckgo'
    /** How many visited pages to keep for suggestions. */
    historyLimit?: number
  }
  ghost?: {
    /** Block known tracker hosts while ghost mode is active. */
    blockTrackers?: boolean
  }
  protection?: {
    /**
     * Protection level DevLens starts in: `standard`, `strict` or `extreme`.
     *
     * The level is a per-session dial - it is deliberately never written to disk, so a profile
     * carries no security preference with it. Config and env set the starting point only.
     */
    level?: 'standard' | 'strict' | 'extreme'
  }
  wimh?: {
    /** Start with extreme defense mode already engaged. */
    startActive?: boolean
    /** Exclude the DevLens windows from screen capture / remote desktop mirroring. */
    contentProtection?: boolean
    /** How long a registered scratch buffer lives before it is zeroed. */
    scrubAfterMs?: number
    clipboard?: {
      /** Purge delay for sensitive clipboard content. */
      clearAfterMs?: number
      /** Classify and arm a purge for every write DevLens performs. */
      guardWrites?: boolean
      /** Refuse pastes of detected credentials into DevLens fields. */
      blockPastes?: boolean
    }
  }
  ntp?: {
    /** Servers pinned to the top of the dashboard grid. */
    servers?: { label: string; url: string }[]
    /** Open the dashboard instead of the home URL on launch. */
    openOnStart?: boolean
  }
  profile?: {
    /** Ask "who is using DevLens?" on startup. On by default. */
    askOnStartup?: boolean
  }
  mode?: {
    /** Which workspace mode DevLens starts in. */
    default?: 'normal' | 'dev'
  }
}

/** Fully resolved AI provider settings. */
export interface ResolvedAiConfig {
  provider: AiProviderId
  model: string
  baseUrl: string | null
  apiKeyEnv: string
  apiKey: string | null
  temperature: number
  maxTokens: number
}

export interface ResolvedInterceptorConfig {
  enabled: boolean
  pauseTimeoutMs: number
  maxPaused: number
  bufferSize: number
}

export interface ResolvedWimhConfig {
  startActive: boolean
  contentProtection: boolean
  scrubAfterMs: number
  clipboardClearAfterMs: number
  guardClipboard: boolean
  blockPastes: boolean
}

export interface ResolvedNtpConfig {
  servers: { label: string; url: string }[]
  openOnStart: boolean
}

/** Fully resolved config handed to the renderer. */
export interface ResolvedConfig {
  workspaceRoot: string
  entryFile: string
  entryLine: number
  ideScheme: string
  /** null means "start on the dashboard". */
  homeUrl: string | null
  partition: string
  mobile: { width: number; height: number }
  configPath: string | null
  ai: ResolvedAiConfig
  interceptor: ResolvedInterceptorConfig
  reportOutputDir: string | null
  omnibox: { searchEngine: 'google' | 'brave' | 'duckduckgo'; historyLimit: number }
  ghostBlockTrackers: boolean
  protection: ProtectionLevel
  /** Raw startup-prompt setting; `off`/`0`/`false` disables the identity prompt. */
  profileAsk: string
  wimh: ResolvedWimhConfig
  ntp: ResolvedNtpConfig
  mode: 'normal' | 'dev'
}

/**
 * The mobile emulator's device matrix.
 *
 * Two numbers matter for a device preview and they are not the same number: the *resolution* the
 * panel is sold with, and the *CSS viewport* the page is laid out in. They are related by the
 * device pixel ratio, so the table stores the resolution and the DPR - exactly the two figures a
 * device database publishes - and `deviceViewport()` derives the third. Storing the CSS size
 * instead would quietly lose the DPR, and storing only the CSS size is how an emulator ends up
 * rendering a 1350px-wide Surface Duo at 1350 CSS pixels.
 *
 * Foldables carry `states`: the same physical device, addressed in the layout it is currently
 * being emulated in. That is what makes "flip the phone" one click instead of a second entry in
 * the list that nobody remembers to pick.
 */

export type DeviceFamily = 'apple' | 'android' | 'foldable' | 'custom'

/** Which layout a foldable is being emulated in. */
export type DeviceFoldState = 'main' | 'cover' | 'dual'

export interface DeviceResolution {
  width: number
  height: number
}

export interface DeviceState {
  id: DeviceFoldState
  label: string
  resolution: DeviceResolution
  dpr: number
  /**
   * True when the two halves are separated by a physical hinge.
   *
   * The frame draws the seam and hands the guest a fold hint; a page that wants to lay itself out
   * around the gap can read it instead of guessing from the width.
   */
  hinge?: boolean
}

export interface DeviceProfile {
  id: string
  label: string
  family: DeviceFamily
  resolution: DeviceResolution
  dpr: number
  /** Foldables and dual-screen devices only, in the order the toggle offers them. */
  states?: DeviceState[]
}

const device = (
  id: string,
  label: string,
  family: DeviceFamily,
  width: number,
  height: number,
  dpr: number
): DeviceProfile => ({ id, label, family, resolution: { width, height }, dpr })

const foldable = (id: string, label: string, states: DeviceState[]): DeviceProfile => ({
  id,
  label,
  family: 'foldable',
  resolution: states[0].resolution,
  dpr: states[0].dpr,
  states
})

export const MOBILE_DEVICES: DeviceProfile[] = [
  /* Apple ------------------------------------------------------------- */
  device('iphone-16-pro-max', 'iPhone 16 Pro Max', 'apple', 1320, 2868, 3),
  device('iphone-16-pro', 'iPhone 16 Pro', 'apple', 1206, 2622, 3),
  device('iphone-16', 'iPhone 16', 'apple', 1179, 2556, 3),
  device('iphone-15', 'iPhone 15', 'apple', 1179, 2556, 3),
  device('iphone-14', 'iPhone 14', 'apple', 1170, 2532, 3),
  device('iphone-13', 'iPhone 13', 'apple', 1170, 2532, 3),
  /* 375x812 CSS: the compact phone geometry the emulator has always started on. */
  device('iphone-13-mini', 'iPhone 13 mini', 'apple', 1125, 2436, 3),
  device('iphone-se', 'iPhone SE', 'apple', 750, 1334, 2),
  device('ipad-pro-13', 'iPad Pro 13"', 'apple', 2064, 2752, 2),
  device('ipad-air', 'iPad Air', 'apple', 1640, 2360, 2),
  device('ipad-mini', 'iPad mini', 'apple', 1488, 2266, 2),

  /* Android ----------------------------------------------------------- */
  device('galaxy-s24-ultra', 'Galaxy S24 Ultra', 'android', 1440, 3120, 3.5),
  device('galaxy-s23-ultra', 'Galaxy S23 Ultra', 'android', 1440, 3088, 3.5),
  device('pixel-9-pro', 'Pixel 9 Pro', 'android', 1280, 2856, 3),
  device('pixel-8-pro', 'Pixel 8 Pro', 'android', 1344, 2992, 3),
  device('xiaomi-14-pro', 'Xiaomi 14 Pro', 'android', 1440, 3200, 3),
  device('xiaomi-13-pro', 'Xiaomi 13 Pro', 'android', 1440, 3200, 3),

  /* Foldables and dual-screen ----------------------------------------- */
  foldable('surface-duo', 'Microsoft Surface Duo', [
    {
      id: 'main',
      label: 'Single Screen',
      resolution: { width: 1350, height: 1800 },
      dpr: 2.5
    },
    {
      id: 'dual',
      label: 'Dual Screen',
      resolution: { width: 2700, height: 1800 },
      dpr: 2.5,
      hinge: true
    }
  ]),
  foldable('surface-duo-2', 'Microsoft Surface Duo 2', [
    {
      id: 'main',
      label: 'Single Screen',
      resolution: { width: 1344, height: 1892 },
      dpr: 2.5
    },
    {
      id: 'dual',
      label: 'Dual Screen',
      resolution: { width: 2688, height: 1892 },
      dpr: 2.5,
      hinge: true
    }
  ]),
  foldable('galaxy-z-flip-6', 'Galaxy Z Flip 6', [
    {
      id: 'main',
      label: 'Main Display',
      resolution: { width: 1080, height: 2640 },
      dpr: 3
    },
    {
      id: 'cover',
      label: 'Cover Screen',
      resolution: { width: 720, height: 748 },
      dpr: 3
    }
  ]),
  foldable('galaxy-z-flip-5', 'Galaxy Z Flip 5', [
    {
      id: 'main',
      label: 'Main Display',
      resolution: { width: 1080, height: 2640 },
      dpr: 3
    },
    {
      id: 'cover',
      label: 'Cover Screen',
      resolution: { width: 720, height: 748 },
      dpr: 3
    }
  ]),
  foldable('galaxy-z-flip-4', 'Galaxy Z Flip 4', [
    {
      id: 'main',
      label: 'Main Display',
      resolution: { width: 1080, height: 2640 },
      dpr: 3
    },
    {
      id: 'cover',
      label: 'Cover Screen',
      resolution: { width: 260, height: 512 },
      dpr: 1
    }
  ]),
  foldable('galaxy-z-fold-6', 'Galaxy Z Fold 6', [
    {
      id: 'cover',
      label: 'Cover Screen',
      resolution: { width: 968, height: 2376 },
      dpr: 2.625
    },
    {
      id: 'main',
      label: 'Main Display',
      resolution: { width: 1856, height: 2160 },
      dpr: 2.625
    }
  ]),
  foldable('galaxy-z-fold-5', 'Galaxy Z Fold 5', [
    {
      id: 'cover',
      label: 'Cover Screen',
      resolution: { width: 904, height: 2316 },
      dpr: 2.625
    },
    {
      id: 'main',
      label: 'Main Display',
      resolution: { width: 1812, height: 2176 },
      dpr: 2.625
    }
  ]),
  foldable('galaxy-z-fold-4', 'Galaxy Z Fold 4', [
    {
      id: 'cover',
      label: 'Cover Screen',
      resolution: { width: 904, height: 2316 },
      dpr: 2.625
    },
    {
      id: 'main',
      label: 'Main Display',
      resolution: { width: 1812, height: 2176 },
      dpr: 2.625
    }
  ]),
  foldable('pixel-fold', 'Pixel Fold', [
    {
      id: 'cover',
      label: 'Cover Screen',
      resolution: { width: 1080, height: 2092 },
      dpr: 2.5
    },
    {
      id: 'main',
      label: 'Main Display',
      resolution: { width: 1840, height: 2208 },
      dpr: 2.5
    }
  ])
]

/** The families, in the order the picker lists them. */
export const DEVICE_FAMILIES: { id: DeviceFamily; label: string }[] = [
  { id: 'apple', label: 'Apple' },
  { id: 'android', label: 'Android' },
  { id: 'foldable', label: 'Foldables & dual-screen' },
  { id: 'custom', label: 'Custom' }
]

/** The layout a device is currently emulated in: its first state, or the one asked for. */
export function deviceState(profile: DeviceProfile, wanted?: DeviceFoldState): DeviceState {
  const states = profile.states ?? []
  if (states.length === 0) {
    return {
      id: 'main',
      label: 'Screen',
      resolution: profile.resolution,
      dpr: profile.dpr
    }
  }
  return states.find((state) => state.id === wanted) ?? states[0]
}

/**
 * The CSS viewport a page actually gets, from the resolution and the DPR.
 *
 * Rounded to a tenth of a pixel: a fractional CSS size is real (an iPad mini is 744x1133 at DPR 2,
 * and a Galaxy Fold's inner screen does not divide evenly), but a preview does not need more
 * precision than that, and the frame's own scale maths stays readable.
 */
export function deviceViewport(
  profile: DeviceProfile,
  wanted?: DeviceFoldState
): { width: number; height: number; dpr: number; state: DeviceState } {
  const state = deviceState(profile, wanted)
  const round = (value: number): number => Math.round(value * 10) / 10
  return {
    width: round(state.resolution.width / state.dpr),
    height: round(state.resolution.height / state.dpr),
    dpr: state.dpr,
    state
  }
}

/** The custom preset is a device like any other, so the frame does not special-case it. */
export function customDevice(width: number, height: number, label = 'Custom'): DeviceProfile {
  return {
    id: 'custom',
    label,
    family: 'custom',
    resolution: { width, height },
    dpr: 1
  }
}

export const DESKTOP_WIDTHS = [1440, 1280, 1024] as const

export const DEFAULT_CONFIG = {
  /** No landing page: the dashboard is the start surface. */
  homeUrl: null as string | null,
  partition: 'persist:devlens-viewport',
  mobile: { width: 375, height: 812 },
  ide: { scheme: 'vscode', entryFile: 'src/renderer/src/App.tsx', entryLine: 1 },
  ai: {
    provider: 'mock' as AiProviderId,
    model: '',
    baseUrl: '',
    apiKeyEnv: 'OPENAI_API_KEY',
    temperature: 0.2,
    maxTokens: 900
  },
  interceptor: {
    enabled: true,
    pauseTimeoutMs: 20000,
    maxPaused: 25,
    bufferSize: 500
  },
  omnibox: {
    searchEngine: 'duckduckgo' as 'google' | 'brave' | 'duckduckgo',
    historyLimit: 200
  },
  ghost: {
    blockTrackers: true
  },
  /** Privacy dial. Standard keeps the tracker blocklist on and leaves everything else alone. */
  protection: {
    level: 'standard' as ProtectionLevel
  },
  wimh: {
    startActive: false,
    contentProtection: true,
    scrubAfterMs: 30000,
    clipboard: {
      clearAfterMs: 20000,
      guardWrites: true,
      blockPastes: true
    }
  },
  ntp: {
    servers: [] as { label: string; url: string }[],
    openOnStart: false
  },
  mode: {
    default: 'dev' as 'normal' | 'dev'
  }
} as const

/** Provider defaults applied when the config file leaves them out. */
export const AI_PROVIDER_DEFAULTS: Record<AiProviderId, { model: string; baseUrl: string | null }> = {
  mock: { model: 'devlens-mock', baseUrl: null },
  openai: { model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
  ollama: { model: 'llama3.2', baseUrl: 'http://127.0.0.1:11434' }
}
