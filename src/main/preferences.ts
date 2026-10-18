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
  type ProfilePreferences,
  type MobileSettings,
  type ToolbarLayout
} from '../shared/preferences'
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
      mobile: sanitizeMobile(parsed?.mobile)
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
  scheduleSave()
  return preferencesNow()
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
