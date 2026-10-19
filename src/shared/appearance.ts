/** Persistent visual preferences for one DevLens profile. */

export type ContentThemeMode = 'system' | 'light' | 'dark'
export type WorkspaceThemeId = 'devlens' | 'midnight' | 'ocean' | 'ember'
export type AppIconStyle = 'default' | 'violet' | 'amber' | 'mono' | 'neon'
export type UiDensity = 'automatic' | 'standard' | 'compact' | 'touch'

export interface AppearancePreferences {
  contentTheme: ContentThemeMode
  workspaceTheme: WorkspaceThemeId
  appIcon: AppIconStyle
  density: UiDensity
}

export const WORKSPACE_THEMES: {
  id: WorkspaceThemeId
  label: string
  detail: string
  swatches: string[]
}[] = [
  {
    id: 'devlens',
    label: 'DevLens Signature',
    detail: 'Graphite chrome with the familiar lime developer accent.',
    swatches: ['#0f1218', '#a3e635', '#232935']
  },
  {
    id: 'midnight',
    label: 'Midnight Circuit',
    detail: 'Deep indigo chrome with a cool violet signal.',
    swatches: ['#0b0d1a', '#8b9cff', '#242849']
  },
  {
    id: 'ocean',
    label: 'Ocean Terminal',
    detail: 'Blue-black surfaces with a bright cyan control accent.',
    swatches: ['#071318', '#38e8ff', '#12333d']
  },
  {
    id: 'ember',
    label: 'Ember Forge',
    detail: 'Warm charcoal chrome with an amber build accent.',
    swatches: ['#15100c', '#ffb44a', '#3b291b']
  }
]

export const APP_ICON_STYLES: {
  id: AppIconStyle
  label: string
  accent: string
}[] = [
  { id: 'default', label: 'DevLens Teal', accent: '#2dd4bf' },
  { id: 'violet', label: 'Midnight Violet', accent: '#8b9cff' },
  { id: 'amber', label: 'Ember Amber', accent: '#ffb44a' },
  { id: 'mono', label: 'Monochrome', accent: '#d7deea' },
  { id: 'neon', label: 'Neon Lime', accent: '#a3e635' }
]

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  contentTheme: 'system',
  workspaceTheme: 'devlens',
  appIcon: 'default',
  density: 'automatic'
}
