/** Persistent tab and browsing preferences for one DevLens profile. */

export type TabLayoutMode = 'horizontal' | 'vertical'
export type HardwareAccelerationMode = 'automatic' | 'enabled' | 'disabled'

export interface DevContainer {
  id: string
  label: string
  color: string
  enabled: boolean
}

export interface DeveloperHotkey {
  id: string
  label: string
  shortcut: string
}

export interface TabGroup {
  id: string
  name: string
  color: string
  collapsed: boolean
}

export interface TabsPreferences {
  layout: TabLayoutMode
  switchToNewTabs: boolean
  externalLinksBesideCurrent: boolean
  mruSwitching: boolean
  hoverPreview: boolean
  tabGroups: boolean
  groups: TabGroup[]
  taskbarPreviews: boolean
  containersEnabled: boolean
  containers: DevContainer[]
  pageCursor: boolean
  typeToSearch: boolean
  linkPreview: boolean
  hotkeys: DeveloperHotkey[]
  pipOnTabSwitch: boolean
  drmEnabled: boolean
  hardwareAcceleration: HardwareAccelerationMode
}

export const DEFAULT_TABS_PREFERENCES: TabsPreferences = {
  layout: 'horizontal',
  switchToNewTabs: true,
  externalLinksBesideCurrent: true,
  mruSwitching: false,
  hoverPreview: true,
  tabGroups: true,
  groups: [],
  taskbarPreviews: true,
  containersEnabled: false,
  containers: [
    { id: 'dev', label: 'Dev', color: '#2dd4bf', enabled: true },
    { id: 'staging', label: 'Staging', color: '#fbbf24', enabled: true },
    { id: 'production', label: 'Production', color: '#fb7185', enabled: true }
  ],
  pageCursor: false,
  typeToSearch: true,
  linkPreview: true,
  hotkeys: [
    { id: 'mru-tab', label: 'Switch to recent tab', shortcut: 'Ctrl+Tab' },
    { id: 'duplicate-tab', label: 'Duplicate tab', shortcut: 'Ctrl+Shift+D' },
    { id: 'group-tab', label: 'Group selected tab', shortcut: 'Ctrl+G' }
  ],
  pipOnTabSwitch: true,
  drmEnabled: true,
  hardwareAcceleration: 'automatic'
}
