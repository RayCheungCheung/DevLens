/** Persistent visual preferences for one DevLens profile. */

import type { AppIconStyle } from './app-icon-art'

export { APP_ICON_CATEGORIES, APP_ICON_STYLES, APP_ICON_STYLE_IDS, type AppIconCategory, type AppIconStyle } from './app-icon-art'

export type ContentThemeMode = 'system' | 'light' | 'dark'
export type WorkspaceThemeId = 'devlens' | 'midnight' | 'ocean' | 'ember'
export type UiDensity = 'automatic' | 'standard' | 'compact' | 'touch'
export type UiFontId = 'segoe' | 'arial' | 'calibri' | 'georgia' | 'verdana' | 'trebuchet'
export type CodeFontId = 'cascadia' | 'cascadia-code' | 'consolas' | 'lucida' | 'courier'

export interface AppearancePreferences {
  contentTheme: ContentThemeMode
  workspaceTheme: WorkspaceThemeId
  appIcon: AppIconStyle
  density: UiDensity
  uiFont: UiFontId
  codeFont: CodeFontId
}

export interface FontOption<T extends string> {
  id: T
  label: string
  family: string
  detail: string
}

export const INTERFACE_FONTS: FontOption<UiFontId>[] = [
  {
    id: 'segoe',
    label: 'Segoe UI',
    family: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif",
    detail: 'Native Windows proportions'
  },
  {
    id: 'arial',
    label: 'Arial',
    family: "Arial, Helvetica, sans-serif",
    detail: 'Neutral and universally readable'
  },
  {
    id: 'calibri',
    label: 'Calibri',
    family: "Calibri, 'Segoe UI', system-ui, sans-serif",
    detail: 'Softer humanist shapes'
  },
  {
    id: 'georgia',
    label: 'Georgia',
    family: "Georgia, 'Times New Roman', serif",
    detail: 'Editorial serif'
  },
  {
    id: 'verdana',
    label: 'Verdana',
    family: "Verdana, Geneva, 'Segoe UI', sans-serif",
    detail: 'Wide and highly legible'
  },
  {
    id: 'trebuchet',
    label: 'Trebuchet MS',
    family: "'Trebuchet MS', 'Segoe UI', sans-serif",
    detail: 'Compact with a friendlier tone'
  }
]

export const CODE_FONTS: FontOption<CodeFontId>[] = [
  {
    id: 'cascadia',
    label: 'Cascadia Mono',
    family: "'Cascadia Mono', 'Cascadia Code', Consolas, ui-monospace, monospace",
    detail: 'DevLens default'
  },
  {
    id: 'cascadia-code',
    label: 'Cascadia Code',
    family: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace",
    detail: 'Programming ligatures'
  },
  {
    id: 'consolas',
    label: 'Consolas',
    family: "Consolas, 'Cascadia Mono', ui-monospace, monospace",
    detail: 'Classic Windows coding face'
  },
  {
    id: 'lucida',
    label: 'Lucida Console',
    family: "'Lucida Console', Monaco, 'Cascadia Mono', monospace",
    detail: 'Dense terminal rhythm'
  },
  {
    id: 'courier',
    label: 'Courier New',
    family: "'Courier New', Courier, monospace",
    detail: 'Traditional typewriter spacing'
  }
]

export function isUiFontId(value: unknown): value is UiFontId {
  return INTERFACE_FONTS.some((font) => font.id === value)
}

export function isCodeFontId(value: unknown): value is CodeFontId {
  return CODE_FONTS.some((font) => font.id === value)
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

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  contentTheme: 'system',
  workspaceTheme: 'devlens',
  appIcon: 'default',
  density: 'automatic',
  uiFont: 'segoe',
  codeFont: 'cascadia'
}
