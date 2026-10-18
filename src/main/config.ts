import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { app } from 'electron'
import { AI_PROVIDER_DEFAULTS, DEFAULT_CONFIG, type DevLensConfig, type ResolvedConfig } from '../shared/config'
import type { AiProviderId } from '../shared/types'
import { resolveProtectionLevel, type ProtectionLevel } from '../shared/protection'

const CONFIG_FILE = 'devlens.config.json'

/**
 * Loads `devlens.config.json` from the app directory (or the working directory),
 * merges it over the defaults and resolves every path to an absolute one.
 *
 * Environment overrides (handy for CI / scripted runs):
 *   DEVLENS_HOME_URL, DEVLENS_WORKSPACE_ROOT, DEVLENS_IDE_SCHEME,
 *   DEVLENS_AI_PROVIDER, DEVLENS_AI_MODEL, DEVLENS_AI_BASE_URL, DEVLENS_AI_API_KEY,
 *   DEVLENS_REPORT_DIR, DEVLENS_INTERCEPT, DEVLENS_PROTECTION
 */
export function loadConfig(): ResolvedConfig {
  const configPath = findConfigFile()
  const fileConfig = configPath ? readConfigFile(configPath) : {}
  const baseDir = configPath ? dirname(configPath) : process.cwd()

  const workspaceRoot = resolveWorkspaceRoot(
    process.env.DEVLENS_WORKSPACE_ROOT ?? fileConfig.workspaceRoot,
    baseDir
  )

  return {
    workspaceRoot,
    entryFile: resolve(workspaceRoot, fileConfig.ide?.entryFile ?? DEFAULT_CONFIG.ide.entryFile),
    entryLine: fileConfig.ide?.entryLine ?? DEFAULT_CONFIG.ide.entryLine,
    ideScheme:
      nonEmpty(process.env.DEVLENS_IDE_SCHEME, fileConfig.ide?.scheme) ?? DEFAULT_CONFIG.ide.scheme,
    // No hardcoded landing page: without an explicit URL DevLens starts on the dashboard.
    homeUrl: nonEmpty(process.env.DEVLENS_HOME_URL, fileConfig.homeUrl) ?? null,
    partition: nonEmpty(fileConfig.partition) ?? DEFAULT_CONFIG.partition,
    mobile: {
      width: fileConfig.mobile?.width ?? DEFAULT_CONFIG.mobile.width,
      height: fileConfig.mobile?.height ?? DEFAULT_CONFIG.mobile.height
    },
    configPath,
    ai: resolveAi(fileConfig.ai),
    interceptor: {
      enabled:
        readBoolean(process.env.DEVLENS_INTERCEPT) ?? fileConfig.interceptor?.enabled ?? DEFAULT_CONFIG.interceptor.enabled,
      pauseTimeoutMs: fileConfig.interceptor?.pauseTimeoutMs ?? DEFAULT_CONFIG.interceptor.pauseTimeoutMs,
      maxPaused: fileConfig.interceptor?.maxPaused ?? DEFAULT_CONFIG.interceptor.maxPaused,
      bufferSize: fileConfig.interceptor?.bufferSize ?? DEFAULT_CONFIG.interceptor.bufferSize
    },
    reportOutputDir: nonEmpty(process.env.DEVLENS_REPORT_DIR, fileConfig.report?.outputDir) ?? null,
    omnibox: {
      searchEngine: resolveSearchEngine(
        process.env.DEVLENS_SEARCH_ENGINE ?? fileConfig.omnibox?.searchEngine
      ),
      historyLimit: fileConfig.omnibox?.historyLimit ?? DEFAULT_CONFIG.omnibox.historyLimit
    },
    ghostBlockTrackers:
      readBoolean(process.env.DEVLENS_GHOST_BLOCK_TRACKERS) ??
      fileConfig.ghost?.blockTrackers ??
      DEFAULT_CONFIG.ghost.blockTrackers,
    wimh: {
      startActive:
        readBoolean(process.env.DEVLENS_WIMH) ?? fileConfig.wimh?.startActive ?? DEFAULT_CONFIG.wimh.startActive,
      contentProtection: fileConfig.wimh?.contentProtection ?? DEFAULT_CONFIG.wimh.contentProtection,
      scrubAfterMs: fileConfig.wimh?.scrubAfterMs ?? DEFAULT_CONFIG.wimh.scrubAfterMs,
      clipboardClearAfterMs: readNumber(process.env.DEVLENS_CLIPBOARD_TTL_MS) ??
        fileConfig.wimh?.clipboard?.clearAfterMs ??
        DEFAULT_CONFIG.wimh.clipboard.clearAfterMs,
      guardClipboard: fileConfig.wimh?.clipboard?.guardWrites ?? DEFAULT_CONFIG.wimh.clipboard.guardWrites,
      blockPastes: fileConfig.wimh?.clipboard?.blockPastes ?? DEFAULT_CONFIG.wimh.clipboard.blockPastes
    },
    ntp: {
      servers: Array.isArray(fileConfig.ntp?.servers)
        ? fileConfig.ntp.servers.filter((entry) => entry?.url).slice(0, 12)
        : DEFAULT_CONFIG.ntp.servers,
      openOnStart:
        readBoolean(process.env.DEVLENS_NTP_ON_START) ?? fileConfig.ntp?.openOnStart ?? DEFAULT_CONFIG.ntp.openOnStart
    },
    mode: resolveMode(process.env.DEVLENS_MODE ?? fileConfig.mode?.default),
    protection: resolveProtection(
      process.env.DEVLENS_PROTECTION ?? fileConfig.protection?.level
    ),
    /**
     * Startup identity prompt. On by default; `DEVLENS_PROFILE_ASK=0` turns it off for scripted
     * runs, and the shell also skips it when the registry holds a single profile, because then
     * there is nothing to choose.
     */
    profileAsk:
      nonEmpty(
        process.env.DEVLENS_PROFILE_ASK,
        fileConfig.profile?.askOnStartup === false ? 'off' : undefined
      ) ?? 'on'
  }
}

/**
 * Starting protection level.
 *
 * Config and env only pick where the session begins - the level itself is never persisted, so
 * nothing about a profile's privacy posture is written to disk.
 */
function resolveProtection(value: string | undefined): ProtectionLevel {
  return resolveProtectionLevel(value)
}

function resolveMode(value: string | undefined): 'normal' | 'dev' {
  if (value?.toLowerCase() === 'normal') return 'normal'
  if (value?.toLowerCase() === 'dev') return 'dev'
  return DEFAULT_CONFIG.mode.default
}

function readNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function resolveSearchEngine(value: string | undefined): 'google' | 'brave' | 'duckduckgo' {
  const known = ['google', 'brave', 'duckduckgo'] as const
  const match = known.find((engine) => engine === value?.toLowerCase())
  return match ?? (DEFAULT_CONFIG.omnibox.searchEngine as 'google' | 'brave' | 'duckduckgo')
}

function resolveAi(configured: DevLensConfig['ai']): ResolvedConfig['ai'] {
  const provider = (nonEmpty(process.env.DEVLENS_AI_PROVIDER, configured?.provider) ??
    DEFAULT_CONFIG.ai.provider) as AiProviderId
  const known: AiProviderId = provider in AI_PROVIDER_DEFAULTS ? provider : 'mock'
  const defaults = AI_PROVIDER_DEFAULTS[known]
  const apiKeyEnv = configured?.apiKeyEnv ?? DEFAULT_CONFIG.ai.apiKeyEnv

  return {
    provider: known,
    model: nonEmpty(process.env.DEVLENS_AI_MODEL, configured?.model) ?? defaults.model,
    baseUrl: nonEmpty(process.env.DEVLENS_AI_BASE_URL, configured?.baseUrl) ?? defaults.baseUrl,
    apiKeyEnv,
    apiKey: nonEmpty(process.env.DEVLENS_AI_API_KEY, process.env[apiKeyEnv]) ?? null,
    temperature: configured?.temperature ?? DEFAULT_CONFIG.ai.temperature,
    maxTokens: configured?.maxTokens ?? DEFAULT_CONFIG.ai.maxTokens
  }
}

/** Treats blank config values as "not configured" so defaults still apply. */
function nonEmpty(...values: (string | undefined | null)[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return undefined
}

function readBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined
  if (/^(1|true|yes|on)$/i.test(value)) return true
  if (/^(0|false|no|off)$/i.test(value)) return false
  return undefined
}

function findConfigFile(): string | null {
  const candidates = [join(app.getAppPath(), CONFIG_FILE), join(process.cwd(), CONFIG_FILE)]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function readConfigFile(configPath: string): DevLensConfig {
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8')) as DevLensConfig
  } catch (error) {
    console.error(`[devlens] could not parse ${configPath}`, error)
    return {}
  }
}

function resolveWorkspaceRoot(configured: string | undefined, baseDir: string): string {
  if (!configured) return app.getAppPath()
  return isAbsolute(configured) ? resolve(configured) : resolve(baseDir, configured)
}
