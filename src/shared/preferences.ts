/**
 * Per-profile preferences.
 *
 * The shape is shared because both sides read it: main owns the file, the renderer draws from it.
 * It is deliberately small - a preference earns a place here by being something the *profile*
 * owns and the *window* follows, rather than something a session can hold.
 */

import { DEFAULT_AI_SITE, type AiSiteId } from './ai-sites'
import { DEFAULT_OMNIBOX_SETTINGS, type OmniboxSettings } from './omnibox-settings'
import {
  DEFAULT_LAUNCHPAD_PREFERENCES,
  type LaunchpadPreferences
} from './launchpad'
import { DEFAULT_PRIVACY_PREFERENCES, type PrivacyPreferences } from './privacy'
import {
  DEFAULT_APPEARANCE_PREFERENCES,
  type AppearancePreferences
} from './appearance'
import { DEFAULT_TABS_PREFERENCES, type TabsPreferences } from './tabs'
import {
  DEFAULT_LANGUAGE_PREFERENCES,
  type LanguagePreferences
} from './languages'
import type { DeviceFoldState } from './config'
import type { UpdateChannel, UpdateStrategy } from './types'
import { DEFAULT_DOWNLOAD_PREFERENCES, type DownloadPreferences, type DownloadPreferencesPatch } from './downloads'
import type { IdeId } from './ide'
import {
  DEFAULT_HOTKEY_PREFERENCES,
  type HotkeyPreferences
} from './hotkeys'

/** Where the sidebar toggle sits in the toolbar. */
export type SidebarTogglePosition = 'start' | 'end'

/** The developer affordances the toolbar's right-hand cluster may show. */
export interface ToolbarTools {
  /** The `mobile`/`desktop` chip: which viewport a command will reach. */
  viewport: boolean
  /** Scroll sync between the two viewports. */
  scrollSync: boolean
  /** "Open in VS Code" - the click-to-source hand-off. */
  openInIde: boolean
  /** The WImH shield. A privacy surface, so it is on by default and switchable like the rest. */
  defense: boolean
}

/**
 * How the operator wants the chrome arranged.
 *
 * The sidebar toggle is the only control that changes *place* rather than visibility: it is the
 * anchor of the layout, and which end it anchors is a matter of taste (and of whether the dock is
 * the thing they reach for first). The rest is a list of what is allowed to appear, because a
 * toolbar that cannot shed a button is a toolbar an operator stops reading.
 */
export interface ToolbarLayout {
  sidebarToggle: SidebarTogglePosition
  tools: ToolbarTools
}

/** A device size the operator saved for themselves. */
export interface MobilePreset {
  label: string
  width: number
  height: number
}

/**
 * Browser preferences that sit above the tab, rather than inside it.
 *
 * These are deliberately small and durable: what a new tab opens, what a launch opens, and
 * whether a bookmark click borrows the current tab. Each one is read by a real code path in
 * the shell, so the Settings page never has to present a switch that only changes its own state.
 */
export interface BrowserPreferences {
  /** Whether a bookmark click opens beside the current tab instead of navigating it. */
  openBookmarksInNewTab: boolean
  /** The zoom percentage applied to every newly attached page. */
  defaultZoom: number
}

export interface DeveloperPreferences {
  /** Switch for the whole editor hand-off; the dropdown stays disabled while off. */
  ideEnabled: boolean
  /** Which detected editor receives click-to-source. */
  ideId: IdeId
}

/**
 * The mobile emulator's own state.
 *
 * Per profile like everything else here, because the device someone tests on is part of how they
 * work: a front-end developer checking an iPad layout does not want to re-pick it after switching
 * to their personal identity. Fold state is remembered *per device*, so flipping the Z Flip to its
 * cover screen and back to a Surface Duo does not lose either answer.
 */
export interface MobileSettings {
  deviceId: string
  /** The layout each foldable was last emulated in, keyed by device id. */
  fold: Record<string, DeviceFoldState>
  /** The free-form size the custom preset is showing. */
  custom: { width: number; height: number }
  /** Sizes the operator saved, offered in the device list. */
  saved: MobilePreset[]
}

export interface ProfilePreferences {
  /** Which AI site the assistant panel opens on, and which brand the dock shows. */
  aiProvider: AiSiteId
  /**
   * The omnibox's own configuration: the default engine, the operator's engines and shortcuts,
   * and which local sources the dropdown may draw from (`devlens:settings/search` writes it).
   */
  omnibox: OmniboxSettings
  /**
   * Toolbar and sidebar arrangement, per profile: the same person on the same machine may want
   * the dock on the left for one identity and the dev cluster hidden for another.
   */
  toolbar: ToolbarLayout
  mobile: MobileSettings
  /** Launchpad targets, widgets, activity and session restoration. */
  launchpad: LaunchpadPreferences
  /** Shield, retention, DNS and storage exceptions. */
  privacy: PrivacyPreferences
  /** Content theme, workspace chrome theme, app icon and density. */
  appearance: AppearancePreferences
  /** Tab layout, interaction, containers and media behavior. */
  tabs: TabsPreferences
  /** Interface, web content, translation and spell-check language preferences. */
  languages: LanguagePreferences
  /** Home, startup, tab-opening and default-zoom choices. */
  browser: BrowserPreferences
  /**
   * Update distribution channel and strategy shown by `devlens:settings/about`.
   *
   * Each profile remembers its own choices. Applying updates requires a configured distribution
   * service; the source build only stores these preferences.
   */
  about: AboutPreferences
  downloads: DownloadPreferences
  developer: DeveloperPreferences
  /** Editable global and developer keyboard bindings, one set per profile. */
  hotkeys: HotkeyPreferences
}

/** About controls send only the changed field, so rapid edits cannot overwrite each other. */
export type ProfilePreferencesPatch = Omit<Partial<ProfilePreferences>, 'about' | 'downloads'> & {
  about?: Partial<AboutPreferences>
  downloads?: DownloadPreferencesPatch
}

export const DEFAULT_MOBILE_SETTINGS: MobileSettings = {
  /* A 375x812 phone: the compact geometry the emulator has always opened on. */
  deviceId: 'iphone-13-mini',
  fold: {},
  custom: { width: 390, height: 844 },
  saved: []
}

export const DEFAULT_TOOLBAR_LAYOUT: ToolbarLayout = {
  /* The far left, ahead of Back/Forward: the dock is the outermost layer of the workspace, so its
     handle is the outermost control. */
  sidebarToggle: 'start',
  tools: { viewport: true, scrollSync: true, openInIde: true, defense: true }
}

export const DEFAULT_BROWSER_PREFERENCES: BrowserPreferences = {
  openBookmarksInNewTab: false,
  defaultZoom: 100
}

export const DEFAULT_DEVELOPER_PREFERENCES: DeveloperPreferences = {
  ideEnabled: true,
  ideId: 'vscode'
}

/**
 * The About page's own choices.
 *
 * The version, Electron/Node/Chromium numbers and OS info are read-only system facts; only the
 * operator's update channel and strategy are preferences, so that is all this stores.
 */
export interface AboutPreferences {
  /** Which distribution channel DevLens pulls updates from. */
  updateChannel: UpdateChannel
  /** How the operator wants updates applied. */
  updateStrategy: UpdateStrategy
}

export const DEFAULT_ABOUT_PREFERENCES: AboutPreferences = {
  /* The channel a careful operator starts on. */
  updateChannel: 'stable',
  /* Automatic download and apply is the comfortable default. */
  updateStrategy: 'auto'
}

export const DEFAULT_PREFERENCES: ProfilePreferences = {
  aiProvider: DEFAULT_AI_SITE,
  omnibox: DEFAULT_OMNIBOX_SETTINGS,
  toolbar: DEFAULT_TOOLBAR_LAYOUT,
  mobile: DEFAULT_MOBILE_SETTINGS,
  launchpad: DEFAULT_LAUNCHPAD_PREFERENCES,
  privacy: DEFAULT_PRIVACY_PREFERENCES,
  appearance: DEFAULT_APPEARANCE_PREFERENCES,
  tabs: DEFAULT_TABS_PREFERENCES,
  languages: DEFAULT_LANGUAGE_PREFERENCES,
  browser: DEFAULT_BROWSER_PREFERENCES,
  about: DEFAULT_ABOUT_PREFERENCES,
  downloads: DEFAULT_DOWNLOAD_PREFERENCES,
  developer: DEFAULT_DEVELOPER_PREFERENCES,
  hotkeys: DEFAULT_HOTKEY_PREFERENCES
}
