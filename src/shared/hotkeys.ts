export type HotkeyActionId =
  | 'new-tab'
  | 'close-tab'
  | 'reload-page'
  | 'find-in-page'
  | 'open-settings'
  | 'open-shell-devtools'
  | 'open-elements'
  | 'open-console'
  | 'open-network'
  | 'toggle-sidebar'
  | 'toggle-ghost'
  | 'toggle-wimh'
  | 'open-private-tab'

export type HotkeyCategory = 'system' | 'developer'

export interface HotkeyDefinition {
  id: HotkeyActionId
  label: string
  detail: string
  category: HotkeyCategory
  defaultShortcut: string
}

export interface HotkeyPreferences {
  bindings: Record<HotkeyActionId, string>
}

export interface HotkeyEventLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export const HOTKEY_DEFINITIONS: readonly HotkeyDefinition[] = [
  {
    id: 'new-tab',
    label: 'New tab',
    detail: 'Open a new DevLens tab.',
    category: 'system',
    defaultShortcut: 'Ctrl+T'
  },
  {
    id: 'close-tab',
    label: 'Close tab',
    detail: 'Close the active tab, then the window on the last tab.',
    category: 'system',
    defaultShortcut: 'Ctrl+W'
  },
  {
    id: 'reload-page',
    label: 'Reload page',
    detail: 'Reload both active viewports.',
    category: 'system',
    defaultShortcut: 'Ctrl+R'
  },
  {
    id: 'find-in-page',
    label: 'Find in page',
    detail: 'Open the DevLens Find Bar.',
    category: 'system',
    defaultShortcut: 'Ctrl+F'
  },
  {
    id: 'open-settings',
    label: 'Open Settings',
    detail: 'Open the DevLens settings centre.',
    category: 'system',
    defaultShortcut: 'Ctrl+,'
  },
  {
    id: 'open-shell-devtools',
    label: 'Open shell DevTools',
    detail: 'Open DevTools for the DevLens shell, not the active website.',
    category: 'system',
    defaultShortcut: 'F12'
  },
  {
    id: 'open-private-tab',
    label: 'New private tab',
    detail: 'Open a maximum-protection private tab.',
    category: 'system',
    defaultShortcut: 'Ctrl+Shift+P'
  },
  {
    id: 'open-elements',
    label: 'Elements panel',
    detail: 'Open the embedded DOM and style inspector.',
    category: 'developer',
    defaultShortcut: 'Ctrl+Shift+I'
  },
  {
    id: 'open-console',
    label: 'Console panel',
    detail: 'Open the embedded JavaScript console.',
    category: 'developer',
    defaultShortcut: 'Ctrl+Shift+J'
  },
  {
    id: 'open-network',
    label: 'Network panel',
    detail: 'Open request capture, interception and replay.',
    category: 'developer',
    defaultShortcut: 'Ctrl+Shift+E'
  },
  {
    id: 'toggle-sidebar',
    label: 'Toggle Sidebar',
    detail: 'Open or close the current developer Sidebar panel.',
    category: 'developer',
    defaultShortcut: 'Ctrl+Shift+B'
  },
  {
    id: 'toggle-ghost',
    label: 'Toggle Ghost mode',
    detail: 'Enter or leave the isolated in-memory Ghost session.',
    category: 'developer',
    defaultShortcut: 'Ctrl+Shift+G'
  },
  {
    id: 'toggle-wimh',
    label: 'Toggle WImH',
    detail: 'Engage or disengage extreme defense mode.',
    category: 'developer',
    defaultShortcut: 'Ctrl+Shift+H'
  }
]

export const DEFAULT_HOTKEY_BINDINGS: Record<HotkeyActionId, string> =
  Object.fromEntries(
    HOTKEY_DEFINITIONS.map((definition) => [definition.id, definition.defaultShortcut])
  ) as Record<HotkeyActionId, string>

export const DEFAULT_HOTKEY_PREFERENCES: HotkeyPreferences = {
  bindings: { ...DEFAULT_HOTKEY_BINDINGS }
}

export function sanitizeHotkeyPreferences(input: unknown): HotkeyPreferences {
  const candidate =
    input && typeof input === 'object'
      ? (input as { bindings?: Record<string, unknown> }).bindings
      : undefined
  const bindings = { ...DEFAULT_HOTKEY_BINDINGS }
  for (const definition of HOTKEY_DEFINITIONS) {
    const value = candidate?.[definition.id]
    if (typeof value === 'string') {
      bindings[definition.id] = normalizeShortcut(value, definition.defaultShortcut)
    }
  }
  return { bindings }
}

export function matchesHotkey(
  shortcut: string,
  event: HotkeyEventLike
): boolean {
  const parsed = parseShortcut(shortcut)
  if (!parsed) return false
  const ctrl = event.ctrlKey || event.metaKey
  if (parsed.ctrl !== ctrl) return false
  if (parsed.shift !== event.shiftKey) return false
  if (parsed.alt !== event.altKey) return false
  return normalizeKey(event.key) === parsed.key
}

export function findHotkeyAction(
  bindings: Record<HotkeyActionId, string>,
  event: HotkeyEventLike
): HotkeyActionId | null {
  for (const definition of HOTKEY_DEFINITIONS) {
    if (matchesHotkey(bindings[definition.id], event)) return definition.id
  }
  return null
}

export function shortcutFromEvent(event: HotkeyEventLike): string {
  const key = normalizeKey(event.key)
  if (!key || MODIFIER_KEYS.has(key)) return ''
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  parts.push(displayKey(key))
  return parts.join('+')
}

export function findHotkeyConflict(
  bindings: Record<HotkeyActionId, string>,
  action: HotkeyActionId,
  shortcut: string
): HotkeyActionId | null {
  const normalized = normalizeShortcut(shortcut, '')
  if (!normalized) return null
  for (const definition of HOTKEY_DEFINITIONS) {
    if (definition.id === action) continue
    if (normalizeShortcut(bindings[definition.id], '') === normalized) return definition.id
  }
  return null
}

export function hotkeyDefinition(action: HotkeyActionId): HotkeyDefinition {
  return HOTKEY_DEFINITIONS.find((definition) => definition.id === action) ?? HOTKEY_DEFINITIONS[0]
}

function normalizeShortcut(value: string, fallback: string): string {
  const parsed = parseShortcut(value)
  return parsed ? formatParsedShortcut(parsed) : fallback
}

function parseShortcut(value: string):
  | { ctrl: boolean; shift: boolean; alt: boolean; key: string }
  | null {
  const tokens = value
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)
  if (tokens.length === 0) return null
  let ctrl = false
  let shift = false
  let alt = false
  let key = ''
  for (const token of tokens) {
    const lower = token.toLowerCase()
    if (lower === 'ctrl' || lower === 'control' || lower === 'cmd' || lower === 'meta') {
      ctrl = true
    } else if (lower === 'shift') {
      shift = true
    } else if (lower === 'alt' || lower === 'option') {
      alt = true
    } else {
      key = normalizeKey(token)
    }
  }
  if (!key || MODIFIER_KEYS.has(key)) return null
  return { ctrl, shift, alt, key }
}

function formatParsedShortcut(parsed: {
  ctrl: boolean
  shift: boolean
  alt: boolean
  key: string
}): string {
  const parts: string[] = []
  if (parsed.ctrl) parts.push('Ctrl')
  if (parsed.alt) parts.push('Alt')
  if (parsed.shift) parts.push('Shift')
  parts.push(displayKey(parsed.key))
  return parts.join('+')
}

const MODIFIER_KEYS = new Set(['control', 'shift', 'alt', 'meta', 'os'])

function normalizeKey(value: string): string {
  const key = value.trim()
  if (key === ' ') return 'space'
  return key.toLowerCase()
}

function displayKey(value: string): string {
  if (value === 'space') return 'Space'
  if (/^f\d{1,2}$/i.test(value)) return value.toUpperCase()
  return value.length === 1 ? value.toUpperCase() : value
}
