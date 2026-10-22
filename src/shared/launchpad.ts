/**
 * Launchpad preferences.
 *
 * These live in the profile's preference file because a start page is part of an identity, not
 * the window: Work can open a project URL while Personal opens the Dashboard. Session data and
 * widget choices travel with the same identity.
 */

export type LaunchTarget = 'launchpad' | 'blank' | 'custom'
export type StartupTabMode = 'none' | 'pinned' | 'all' | 'custom'
import type { WallpaperPresetId } from './wallpapers'

export interface LaunchpadWidgets {
  clock: boolean
  devSpotlight: boolean
  quickSnippets: boolean
  systemHealth: boolean
  weather: boolean
  focusTimer: boolean
}

export interface LaunchpadActivity {
  recent: boolean
  bookmarks: boolean
  downloads: boolean
}

export interface LaunchpadSessionTab {
  url: string
  title: string
  pinned?: boolean
  /** Persistent tab-group association. */
  groupId?: string
}

export interface LaunchpadSession {
  tabs: LaunchpadSessionTab[]
  activeIndex: number
  savedAt: number
}

export interface LaunchpadPreferences {
  newTabTarget: LaunchTarget
  homeTarget: LaunchTarget
  customUrl: string
  launchAtLogin: boolean
  startupTabs: StartupTabMode
  /** The page opened at launch when `startupTabs` is `custom`. */
  startupUrl: string
  /** Refresh default-browser status whenever the DevLens window gains focus. */
  checkDefaultBrowser: boolean
  /** Show the shortcut tile grid below the search field. */
  shortcutsVisible: boolean
  /** Visible shortcut rows; the grid caps itself to this many rows of eight. */
  shortcutRows: number
  /** Show the dashboard widget band. Individual widget choices remain in Settings. */
  widgetsVisible: boolean
  widgets: LaunchpadWidgets
  activity: LaunchpadActivity
  /** Built-in wallpaper id, custom image, or the plain theme surface. */
  wallpaperPreset: WallpaperPresetId
  /** A data URL chosen from disk; used only when `wallpaperPreset` is custom. */
  wallpaper: string
  wallpaperDim: number
  weatherPlace: string
  session: LaunchpadSession
}

export interface LaunchpadSystemState {
  isDefaultBrowser: boolean
  launchAtLogin: boolean
}

export interface LaunchpadWeather {
  ok: boolean
  place: string
  temperatureC: number | null
  weather: string | null
  windKph: number | null
  error: string | null
}

export const LAUNCHPAD_BLANK_URL = 'devlens:blank'

export const DEFAULT_LAUNCHPAD_PREFERENCES: LaunchpadPreferences = {
  newTabTarget: 'launchpad',
  homeTarget: 'launchpad',
  customUrl: 'https://duckduckgo.com/',
  launchAtLogin: false,
  startupTabs: 'none',
  startupUrl: 'https://developer.mozilla.org/',
  checkDefaultBrowser: true,
  shortcutsVisible: true,
  shortcutRows: 1,
  widgetsVisible: true,
  widgets: {
    clock: true,
    devSpotlight: true,
    quickSnippets: true,
    systemHealth: true,
    weather: true,
    focusTimer: true
  },
  activity: {
    recent: true,
    bookmarks: true,
    downloads: true
  },
  wallpaperPreset: 'lensy',
  wallpaper: '',
  wallpaperDim: 36,
  weatherPlace: 'Macau',
  session: {
    tabs: [],
    activeIndex: 0,
    savedAt: 0
  }
}

/** The URL a target opens, or null for the Launchpad itself. */
export function launchTargetUrl(target: LaunchTarget, customUrl: string): string | null {
  if (target === 'blank') return LAUNCHPAD_BLANK_URL
  if (target === 'custom' && customUrl.trim()) return customUrl.trim()
  return null
}
