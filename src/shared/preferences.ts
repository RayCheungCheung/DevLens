/**
 * Per-profile preferences.
 *
 * The shape is shared because both sides read it: main owns the file, the renderer draws from it.
 * It is deliberately small - a preference earns a place here by being something the *profile*
 * owns and the *window* follows, rather than something a session can hold.
 */

import { DEFAULT_AI_SITE, type AiSiteId } from './ai-sites'
import { DEFAULT_OMNIBOX_SETTINGS, type OmniboxSettings } from './omnibox-settings'
import type { DeviceFoldState } from './config'

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
   * and which local sources the dropdown may draw from (`devlens:settings/omnibox` writes it).
   */
  omnibox: OmniboxSettings
  /**
   * Toolbar and sidebar arrangement, per profile: the same person on the same machine may want
   * the dock on the left for one identity and the dev cluster hidden for another.
   */
  toolbar: ToolbarLayout
  mobile: MobileSettings
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

export const DEFAULT_PREFERENCES: ProfilePreferences = {
  aiProvider: DEFAULT_AI_SITE,
  omnibox: DEFAULT_OMNIBOX_SETTINGS,
  toolbar: DEFAULT_TOOLBAR_LAYOUT,
  mobile: DEFAULT_MOBILE_SETTINGS
}
