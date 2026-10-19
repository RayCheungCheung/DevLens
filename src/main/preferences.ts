import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { DEFAULT_AI_SITE, isAiSiteId } from '../shared/ai-sites'
import {
  cloneOmniboxSettings,
  DEFAULT_OMNIBOX_SETTINGS,
  resolveDefaultEngine,
  sanitizeOmniboxEntries,
  type OmniboxSettings,
  type OmniboxSources
} from '../shared/omnibox-settings'
import {
  DEFAULT_PREFERENCES,
  DEFAULT_MOBILE_SETTINGS,
  DEFAULT_TOOLBAR_LAYOUT,
  type BrowserPreferences,
  type ProfilePreferences,
  type MobileSettings,
  type ToolbarLayout
} from '../shared/preferences'
import {
  DEFAULT_LAUNCHPAD_PREFERENCES,
  type LaunchTarget,
  type LaunchpadPreferences,
  type LaunchpadSession
} from '../shared/launchpad'
import {
  DEFAULT_PRIVACY_PREFERENCES,
  type PrivacyPreferences
} from '../shared/privacy'
import {
  DEFAULT_APPEARANCE_PREFERENCES,
  type AppearancePreferences
} from '../shared/appearance'
import { DEFAULT_TABS_PREFERENCES, type TabsPreferences } from '../shared/tabs'
import {
  DEFAULT_LANGUAGE_PREFERENCES,
  type LanguagePreferences
} from '../shared/languages'
import { activeProfileId } from './profiles'
import { profileFile } from './storage'

/**
 * Small per-profile preferences.
 *
 * One file next to the profile's history and bookmarks, because an identity is the thing that
 * owns a preference: the AI assistant someone chose in "Work" is not the one they chose in
 * "Personal", and neither of them should follow the other around. The store is deliberately
 * tiny and additive - today it holds the assistant's provider, and the shape leaves room for the
 * next preference without a second file.
 *
 * Everything here is local. There is no sync, no reporting and no fallback to a default that
 * knows more than the file does.
 */

const DEFAULTS = DEFAULT_PREFERENCES

let preferences: ProfilePreferences = { ...DEFAULTS }
/** Which profile this belongs to; switching identity forces a re-read. */
let loadedFor: string | null = null
/** Pending write with its target file frozen at schedule time, so it cannot cross profiles. */
let saveTimer: NodeJS.Timeout | null = null
let pendingSave: { file: string; payload: string } | null = null

function storeFile(): string {
  return profileFile('preferences.json')
}

function load(): void {
  const profileId = activeProfileId()
  if (loadedFor === profileId) return
  loadedFor = profileId
  preferences = { ...DEFAULTS }
  try {
    const file = storeFile()
    if (!existsSync(file)) return
    const parsed = JSON.parse(readFileSync(file, 'utf-8')) as Partial<ProfilePreferences>
    preferences = {
      aiProvider: isAiSiteId(parsed?.aiProvider) ? parsed.aiProvider : DEFAULT_AI_SITE,
      omnibox: sanitizeOmnibox(parsed?.omnibox),
      toolbar: sanitizeToolbar(parsed?.toolbar),
      mobile: sanitizeMobile(parsed?.mobile),
      launchpad: sanitizeLaunchpad(parsed?.launchpad, parsed?.browser as LegacyBrowserPreferences),
      privacy: sanitizePrivacy(parsed?.privacy),
      appearance: sanitizeAppearance(parsed?.appearance),
      tabs: sanitizeTabs(parsed?.tabs),
      languages: sanitizeLanguages(parsed?.languages),
      browser: sanitizeBrowser(parsed?.browser)
    }
  } catch (error) {
    console.warn('[devlens] could not read preferences', error)
    preferences = { ...DEFAULTS }
  }
}

function scheduleSave(): void {
  pendingSave = { file: storeFile(), payload: JSON.stringify(preferences, null, 2) }
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    const job = pendingSave
    pendingSave = null
    if (!job) return
    try {
      writeFileSync(job.file, job.payload, 'utf-8')
    } catch (error) {
      console.warn('[devlens] could not persist preferences', error)
    }
  }, 250)
}

/** Writes any queued save now: a profile switch must not swallow the previous profile's write. */
export function flushPreferences(): void {
  if (!saveTimer) return
  clearTimeout(saveTimer)
  saveTimer = null
  const job = pendingSave
  pendingSave = null
  if (!job) return
  try {
    writeFileSync(job.file, job.payload, 'utf-8')
  } catch (error) {
    console.warn('[devlens] could not persist preferences', error)
  }
}

export function preferencesNow(): ProfilePreferences {
  load()
  return { ...preferences }
}

/** Applies a patch, ignoring anything that is not a known value. */
export function setPreferences(patch: Partial<ProfilePreferences>): ProfilePreferences {
  load()
  if (isAiSiteId(patch.aiProvider)) preferences.aiProvider = patch.aiProvider
  if (patch.omnibox) preferences.omnibox = sanitizeOmnibox({ ...preferences.omnibox, ...patch.omnibox })
  if (patch.toolbar) preferences.toolbar = sanitizeToolbar({ ...preferences.toolbar, ...patch.toolbar })
  if (patch.mobile) preferences.mobile = sanitizeMobile({ ...preferences.mobile, ...patch.mobile })
  if (patch.launchpad) {
    preferences.launchpad = sanitizeLaunchpad({
      ...preferences.launchpad,
      ...patch.launchpad,
      widgets: { ...preferences.launchpad.widgets, ...patch.launchpad.widgets },
      activity: { ...preferences.launchpad.activity, ...patch.launchpad.activity }
    })
  }
  if (patch.privacy) {
    preferences.privacy = sanitizePrivacy({ ...preferences.privacy, ...patch.privacy })
  }
  if (patch.appearance) {
    preferences.appearance = sanitizeAppearance({ ...preferences.appearance, ...patch.appearance })
  }
  if (patch.tabs) {
    preferences.tabs = sanitizeTabs({
      ...preferences.tabs,
      ...patch.tabs,
      containers: patch.tabs.containers ?? preferences.tabs.containers,
      hotkeys: patch.tabs.hotkeys ?? preferences.tabs.hotkeys
    })
  }
  if (patch.languages) {
    preferences.languages = sanitizeLanguages({
      ...preferences.languages,
      ...patch.languages,
      webLanguages: patch.languages.webLanguages ?? preferences.languages.webLanguages,
      offlineModels: patch.languages.offlineModels ?? preferences.languages.offlineModels,
      spellCheckLanguages:
        patch.languages.spellCheckLanguages ?? preferences.languages.spellCheckLanguages
    })
  }
  if (patch.browser) preferences.browser = sanitizeBrowser({ ...preferences.browser, ...patch.browser })
  scheduleSave()
  return preferencesNow()
}

function sanitizeLanguageCode(value: unknown, fallback: string): string {
  const code = typeof value === 'string' ? value.trim().slice(0, 20) : ''
  return code || fallback
}

function sanitizeLanguages(input: Partial<LanguagePreferences> | undefined): LanguagePreferences {
  const defaults = DEFAULT_LANGUAGE_PREFERENCES
  const list = (values: unknown, fallback: string[]): string[] =>
    (Array.isArray(values) ? values : fallback)
      .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
      .map((value) => value.trim().slice(0, 20))
      .filter((value, index, all) => all.indexOf(value) === index)
      .slice(0, 10)
  return {
    primaryLanguage: sanitizeLanguageCode(input?.primaryLanguage, defaults.primaryLanguage),
    fallbackLanguage: sanitizeLanguageCode(input?.fallbackLanguage, defaults.fallbackLanguage),
    followSystemLocale: input?.followSystemLocale !== false,
    systemLocale: sanitizeLanguageCode(input?.systemLocale, defaults.systemLocale),
    webLanguages: list(input?.webLanguages, defaults.webLanguages),
    localTranslation: input?.localTranslation !== false,
    autoTranslatePrompt: input?.autoTranslatePrompt === true,
    offlineModels: (Array.isArray(input?.offlineModels)
      ? input.offlineModels
      : defaults.offlineModels
    )
      .slice(0, 20)
      .filter((model) => model && typeof model.label === 'string')
      .map((model, index) => ({
        id: typeof model.id === 'string' && model.id ? model.id.slice(0, 40) : `model-${index + 1}`,
        label: model.label.trim().slice(0, 80) || `Model ${index + 1}`,
        size: typeof model.size === 'string' ? model.size.slice(0, 20) : '',
        installed: model.installed === true
      })),
    spellCheck: input?.spellCheck !== false,
    spellCheckLanguages: list(input?.spellCheckLanguages, defaults.spellCheckLanguages)
  }
}

function sanitizeTabs(input: Partial<TabsPreferences> | undefined): TabsPreferences {
  const defaults = DEFAULT_TABS_PREFERENCES
  const containers = (Array.isArray(input?.containers) ? input.containers : defaults.containers)
    .slice(0, 12)
    .filter((entry) => entry && typeof entry.label === 'string')
    .map((entry, index) => ({
      id: typeof entry.id === 'string' && entry.id ? entry.id.slice(0, 40) : `container-${index + 1}`,
      label: entry.label.trim().slice(0, 40) || `Container ${index + 1}`,
      color:
        typeof entry.color === 'string' && /^#[0-9a-f]{6}$/i.test(entry.color)
          ? entry.color
          : '#2dd4bf',
      enabled: entry.enabled !== false
    }))
  const hotkeys = (Array.isArray(input?.hotkeys) ? input.hotkeys : defaults.hotkeys)
    .slice(0, 20)
    .filter((entry) => entry && typeof entry.label === 'string')
    .map((entry, index) => ({
      id: typeof entry.id === 'string' && entry.id ? entry.id.slice(0, 50) : `hotkey-${index + 1}`,
      label: entry.label.trim().slice(0, 60) || `Shortcut ${index + 1}`,
      shortcut: typeof entry.shortcut === 'string' ? entry.shortcut.trim().slice(0, 60) : ''
    }))
  return {
    layout: input?.layout === 'vertical' ? 'vertical' : 'horizontal',
    switchToNewTabs: input?.switchToNewTabs !== false,
    externalLinksBesideCurrent: input?.externalLinksBesideCurrent !== false,
    mruSwitching: input?.mruSwitching === true,
    hoverPreview: input?.hoverPreview !== false,
    tabGroups: input?.tabGroups !== false,
    taskbarPreviews: input?.taskbarPreviews !== false,
    containersEnabled: input?.containersEnabled === true,
    containers,
    pageCursor: input?.pageCursor === true,
    typeToSearch: input?.typeToSearch !== false,
    linkPreview: input?.linkPreview !== false,
    hotkeys,
    pipOnTabSwitch: input?.pipOnTabSwitch !== false,
    drmEnabled: input?.drmEnabled !== false,
    hardwareAcceleration:
      input?.hardwareAcceleration === 'enabled' || input?.hardwareAcceleration === 'disabled'
        ? input.hardwareAcceleration
        : 'automatic'
  }
}

function sanitizeAppearance(
  input: Partial<AppearancePreferences> | undefined
): AppearancePreferences {
  const defaults = DEFAULT_APPEARANCE_PREFERENCES
  return {
    contentTheme:
      input?.contentTheme === 'light' || input?.contentTheme === 'dark'
        ? input.contentTheme
        : 'system',
    workspaceTheme:
      input?.workspaceTheme === 'midnight' ||
      input?.workspaceTheme === 'ocean' ||
      input?.workspaceTheme === 'ember'
        ? input.workspaceTheme
        : 'devlens',
    appIcon:
      input?.appIcon === 'violet' ||
      input?.appIcon === 'amber' ||
      input?.appIcon === 'mono' ||
      input?.appIcon === 'neon'
        ? input.appIcon
        : 'default',
    density:
      input?.density === 'standard' ||
      input?.density === 'compact' ||
      input?.density === 'touch'
        ? input.density
        : defaults.density
  }
}

function sanitizePrivacy(input: Partial<PrivacyPreferences> | undefined): PrivacyPreferences {
  const defaults = DEFAULT_PRIVACY_PREFERENCES
  const limit = Number(input?.dataLimitGb)
  const used = Number(input?.dataUsedGb)
  const days = Number(input?.retentionDays)
  return {
    shieldMode: input?.shieldMode === 'strict' ? 'strict' : 'standard',
    blockCrossSiteTrackers: input?.blockCrossSiteTrackers !== false,
    blockFingerprinters: input?.blockFingerprinters === true,
    blockCryptominers: input?.blockCryptominers !== false,
    networkTunnelEnabled: input?.networkTunnelEnabled === true,
    dataLimitGb: Number.isFinite(limit) ? Math.min(1000, Math.max(1, Math.round(limit))) : defaults.dataLimitGb,
    dataUsedGb: Number.isFinite(used) ? Math.max(0, Number(used)) : 0,
    historyRetention:
      input?.historyRetention === 'custom' || input?.historyRetention === 'incognito'
        ? input.historyRetention
        : 'always',
    retentionDays: Number.isFinite(days) ? Math.min(3650, Math.max(1, Math.round(days))) : 90,
    sendDnt: input?.sendDnt !== false,
    dnsMode:
      input?.dnsMode === 'off' || input?.dnsMode === 'system' ? input.dnsMode : 'secure',
    httpsOnly: input?.httpsOnly !== false,
    siteExceptions: (Array.isArray(input?.siteExceptions) ? input.siteExceptions : [])
      .filter((host) => typeof host === 'string' && host.trim())
      .map((host) => host.trim().toLowerCase().slice(0, 255))
      .slice(0, 50)
  }
}

/** Session writes are frequent and deliberately silent: they must not re-render Settings. */
export function setLaunchpadSession(session: LaunchpadSession): LaunchpadSession {
  load()
  preferences.launchpad = {
    ...preferences.launchpad,
    session: sanitizeLaunchpadSession(session)
  }
  scheduleSave()
  return preferences.launchpad.session
}

interface LegacyBrowserPreferences {
  homepage?: string
  newTabPage?: 'dashboard' | 'homepage'
  startupPage?: 'dashboard' | 'homepage'
}

function normalizeWebUrl(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  let url = raw || fallback
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) url = `https://${url}`
  if (!/^https?:\/\//i.test(url) && url !== 'about:blank') return fallback
  return url
}

function launchTarget(value: unknown, fallback: LaunchTarget): LaunchTarget {
  return value === 'blank' || value === 'custom' || value === 'launchpad' ? value : fallback
}

/**
 * Launchpad settings, including a one-way migration from the old two-value homepage fields.
 */
function sanitizeLaunchpad(
  input: Partial<LaunchpadPreferences> | undefined,
  legacy?: LegacyBrowserPreferences
): LaunchpadPreferences {
  const defaults = DEFAULT_LAUNCHPAD_PREFERENCES
  const hasCurrentShape = Boolean(input && typeof input === 'object')
  const legacyCustom = legacy?.homepage
  const legacyNew = legacy?.newTabPage === 'homepage'
  const legacyHome = legacy?.startupPage === 'homepage'
  const rawWallpaper = typeof input?.wallpaper === 'string' ? input.wallpaper : ''
  const wallpaper =
    rawWallpaper.startsWith('data:image/') && rawWallpaper.length <= 7_000_000
      ? rawWallpaper
      : ''
  const dim = Number(input?.wallpaperDim)
  return {
    newTabTarget: launchTarget(
      input?.newTabTarget,
      hasCurrentShape ? defaults.newTabTarget : legacyNew ? 'custom' : 'launchpad'
    ),
    homeTarget: launchTarget(
      input?.homeTarget,
      hasCurrentShape ? defaults.homeTarget : legacyHome ? 'custom' : 'launchpad'
    ),
    customUrl: normalizeWebUrl(
      input?.customUrl ?? (hasCurrentShape ? undefined : legacyCustom),
      defaults.customUrl
    ),
    launchAtLogin: input?.launchAtLogin === true,
    restoreLastTabs: input?.restoreLastTabs === true,
    widgets: {
      clock: input?.widgets?.clock !== false,
      devSpotlight: input?.widgets?.devSpotlight !== false,
      quickSnippets: input?.widgets?.quickSnippets !== false,
      systemHealth: input?.widgets?.systemHealth !== false,
      weather: input?.widgets?.weather !== false,
      focusTimer: input?.widgets?.focusTimer !== false
    },
    activity: {
      recent: input?.activity?.recent !== false,
      bookmarks: input?.activity?.bookmarks !== false,
      downloads: input?.activity?.downloads !== false
    },
    wallpaper,
    wallpaperDim: Number.isFinite(dim) ? Math.min(80, Math.max(0, Math.round(dim))) : defaults.wallpaperDim,
    weatherPlace:
      typeof input?.weatherPlace === 'string' && input.weatherPlace.trim()
        ? input.weatherPlace.trim().slice(0, 80)
        : defaults.weatherPlace,
    session: sanitizeLaunchpadSession(input?.session)
  }
}

function sanitizeLaunchpadSession(input: Partial<LaunchpadSession> | undefined): LaunchpadSession {
  const tabs = (Array.isArray(input?.tabs) ? input.tabs : [])
    .filter((tab) => tab && typeof tab.url === 'string')
    .slice(0, 20)
    .map((tab) => ({
      url: String(tab.url).slice(0, 4096),
      title: String(tab.title ?? '').slice(0, 300)
    }))
  const activeIndex = Number(input?.activeIndex)
  return {
    tabs,
    activeIndex: Number.isFinite(activeIndex)
      ? Math.min(Math.max(0, Math.round(activeIndex)), Math.max(0, tabs.length - 1))
      : 0,
    savedAt: Number(input?.savedAt) || 0
  }
}

/**
 * Home, startup and tab behavior.
 *
 * The homepage is a real navigation target, so only web-style addresses are accepted: a typo
 * becomes an `https://` address, and a scheme that would escape the browser (or run script)
 * falls back to the default instead of being saved. Zoom is clamped to the same range the guest
 * command uses so a hand-edited file cannot ask for an unreadable page.
 */
function sanitizeBrowser(input: Partial<BrowserPreferences> | undefined): BrowserPreferences {
  const zoom = Number(input?.defaultZoom)
  return {
    openBookmarksInNewTab: input?.openBookmarksInNewTab === true,
    defaultZoom: Number.isFinite(zoom) ? Math.min(250, Math.max(50, Math.round(zoom))) : 100
  }
}

/**
 * The device emulator's settings.
 *
 * Sizes are clamped rather than trusted: a hand-edited file must not be able to ask for a viewport
 * the canvas cannot draw (a 0-pixel device divides by zero, and a 20000-pixel one is not a preview).
 */
function sanitizeMobile(input: Partial<MobileSettings> | undefined): MobileSettings {
  const defaults = DEFAULT_MOBILE_SETTINGS
  const size = (value: unknown, fallback: number): number => {
    const number = Number(value)
    if (!Number.isFinite(number)) return fallback
    return Math.min(4096, Math.max(120, Math.round(number)))
  }
  const fold: Record<string, 'main' | 'cover' | 'dual'> = {}
  for (const [key, value] of Object.entries(input?.fold ?? {})) {
    if (value === 'main' || value === 'cover' || value === 'dual') fold[key] = value
  }
  const saved = (Array.isArray(input?.saved) ? input!.saved : [])
    .filter((entry) => entry && typeof entry.label === 'string')
    .slice(0, 20)
    .map((entry) => ({
      label: entry.label.slice(0, 40),
      width: size(entry.width, defaults.custom.width),
      height: size(entry.height, defaults.custom.height)
    }))
    .filter((entry) => entry.label.length > 0)

  return {
    deviceId:
      typeof input?.deviceId === 'string' && input.deviceId.trim()
        ? input.deviceId.trim()
        : defaults.deviceId,
    fold,
    custom: {
      width: size(input?.custom?.width, defaults.custom.width),
      height: size(input?.custom?.height, defaults.custom.height)
    },
    saved
  }
}

/**
 * The layout, as the file is allowed to describe it.
 *
 * An unknown value for the toggle's position falls back to the default rather than being believed:
 * a typo in the file must not leave the handle in a place the toolbar cannot render.
 */
function sanitizeToolbar(input: Partial<ToolbarLayout> | undefined): ToolbarLayout {
  const defaults = DEFAULT_TOOLBAR_LAYOUT
  if (!input || typeof input !== 'object') return { ...defaults, tools: { ...defaults.tools } }
  const tools = { ...defaults.tools }
  for (const key of Object.keys(tools) as (keyof typeof tools)[]) {
    const value = input.tools?.[key]
    if (typeof value === 'boolean') tools[key] = value
  }
  return {
    sidebarToggle: input.sidebarToggle === 'end' ? 'end' : defaults.sidebarToggle,
    tools
  }
}

/**
 * The omnibox settings, as the file is allowed to describe them.
 *
 * The file is operator-editable and the renderer is not trusted further than the file is, so this
 * is where a preference stops being `unknown`: an entry without a usable template is dropped, a
 * keyword is normalised (no `@`, lower case, no spaces - it is typed after one), and a kind is
 * *recomputed* from the template rather than believed, because `%s` is what makes a row an engine.
 * A default engine that no longer exists falls back rather than leaving the field searching with
 * nothing.
 */
function sanitizeOmnibox(input: Partial<OmniboxSettings> | undefined): OmniboxSettings {
  const defaults = cloneOmniboxSettings(DEFAULT_OMNIBOX_SETTINGS)
  if (!input || typeof input !== 'object') return defaults

  const splitShape = Array.isArray(input.engines) || Array.isArray(input.shortcuts)
  let engines = sanitizeOmniboxEntries(input.engines, 'engine')
  let shortcuts = sanitizeOmniboxEntries(input.shortcuts, 'shortcut')
  let wantedDefault = typeof input.defaultEngine === 'string' ? input.defaultEngine : ''

  if (!splitShape) {
    /*
     * Upgrade the earlier mixed list. Built-ins were not stored then, so the complete default
     * catalog is the baseline; user rows are appended in their old order.
     */
    const legacy = Array.isArray((input as { entries?: unknown }).entries)
      ? ((input as { entries?: unknown[] }).entries ?? [])
      : []
    const legacyEngines = legacy.filter(
      (entry) =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        String((entry as { template?: unknown }).template ?? '').includes('%s')
    )
    const legacyShortcuts = legacy.filter(
      (entry) =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        !String((entry as { template?: unknown }).template ?? '').includes('%s')
    )
    engines = [
      ...defaults.engines,
      ...sanitizeOmniboxEntries(legacyEngines, 'engine')
    ]
    shortcuts = [
      ...defaults.shortcuts,
      ...sanitizeOmniboxEntries(legacyShortcuts, 'shortcut')
    ]
    if (wantedDefault && !wantedDefault.includes(':')) {
      wantedDefault = `builtin:${wantedDefault}`
    }
  }

  const sources: OmniboxSources = { ...defaults.sources }
  for (const key of Object.keys(sources) as (keyof OmniboxSources)[]) {
    const value = input.sources?.[key]
    if (typeof value === 'boolean') sources[key] = value
  }

  const next: OmniboxSettings = {
    defaultEngine: wantedDefault,
    engines,
    shortcuts,
    showSearchTerms: input.showSearchTerms !== false,
    suggestFirst: input.suggestFirst === true,
    sources
  }
  return { ...next, defaultEngine: resolveDefaultEngine(next) }
}
