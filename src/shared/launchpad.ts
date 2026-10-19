/**
 * Launchpad preferences.
 *
 * These live in the profile's preference file because a start page is part of an identity, not
 * the window: Work can open a project URL while Personal opens the Dashboard. Session data and
 * widget choices travel with the same identity.
 */

export type LaunchTarget = 'launchpad' | 'blank' | 'custom'

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
  restoreLastTabs: boolean
  widgets: LaunchpadWidgets
  activity: LaunchpadActivity
  /** A data URL chosen from disk, or empty for the theme surface. */
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
  restoreLastTabs: false,
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
