/**
 * Workspace modes.
 *
 * DevLens runs in exactly one of two modes, and the mode decides what the browser *is*:
 *
 *  - `normal`: a clean, single-pane browser with maximum privacy. One viewport fills the
 *    window, no side panels, and the monitoring pipeline (console, network, interception,
 *    recon, AI) is switched off in the main process - not merely hidden in the UI.
 *  - `dev`: the weaponised workspace. Dual viewport, every panel, live capture, rules,
 *    design overrides and the AI debugger.
 *
 * The tables live here so the main process and the renderer cannot drift: main uses them to
 * decide what to enforce, the renderer to decide what to offer.
 */

export type WorkspaceMode = 'normal' | 'dev'

export const WORKSPACE_MODES: readonly WorkspaceMode[] = ['normal', 'dev']

export interface ModeCapabilities {
  /** Two side-by-side viewports. Forbidden in normal mode. */
  dualViewport: boolean
  /** The developer sidebar as a whole. */
  sidebar: boolean
  /** Console & network capture, request records and the failure log. */
  monitoring: boolean
  /** Interception rules: block, header rewriting, holds, redirects. */
  rules: boolean
  /** Live design mode, CSS overrides and the DOM/component finder. */
  authoring: boolean
  /** AI debugger prompts. */
  ai: boolean
  /** Tracker blocking, which normal mode keeps on for privacy. */
  trackerBlocking: boolean
  /** Profile switching and the new tab dashboard: browser basics, always available. */
  profiles: boolean
  dashboard: boolean
}

const DEV_CAPABILITIES: ModeCapabilities = {
  dualViewport: true,
  sidebar: true,
  monitoring: true,
  rules: true,
  authoring: true,
  ai: true,
  // Dev mode leaves the profile's traffic alone so what you see is what the page does.
  trackerBlocking: false,
  profiles: true,
  dashboard: true
}

const NORMAL_CAPABILITIES: ModeCapabilities = {
  dualViewport: false,
  sidebar: false,
  monitoring: false,
  rules: false,
  authoring: false,
  ai: false,
  // Max privacy: the tracker blocklist stays on even without the defense panels.
  trackerBlocking: true,
  profiles: true,
  dashboard: true
}

export function capabilitiesFor(mode: WorkspaceMode): ModeCapabilities {
  return mode === 'normal' ? NORMAL_CAPABILITIES : DEV_CAPABILITIES
}

export interface ModeDescriptor {
  mode: WorkspaceMode
  label: string
  tagline: string
  /** Short badge used in the toolbar. */
  badge: string
  /** Tailwind classes for the mode chip. */
  chipClass: string
  /** Tailwind classes for the accent used while the mode is active. */
  accentClass: string
}

export const MODE_DESCRIPTORS: Record<WorkspaceMode, ModeDescriptor> = {
  normal: {
    mode: 'normal',
    label: 'Normal Mode',
    tagline: 'Max Privacy & Immersion',
    badge: 'NORMAL',
    chipClass: 'border-white/10 bg-white/[0.03] text-neutral-300',
    accentClass: 'border-neutral-800'
  },
  dev: {
    mode: 'dev',
    label: 'Dev Mode',
    tagline: 'Weaponised Workspace',
    badge: 'DEV',
    chipClass: 'border-lime-400/50 bg-lime-400/10 text-lime-200',
    accentClass: 'border-lime-400/40'
  }
}

export function modeDescriptor(mode: WorkspaceMode): ModeDescriptor {
  return MODE_DESCRIPTORS[mode]
}

/** Normal mode is the clean, unmonitored browser: nothing developer-facing may appear. */
export function isNormalMode(mode: WorkspaceMode): boolean {
  return mode === 'normal'
}

export function isDevMode(mode: WorkspaceMode): boolean {
  return mode === 'dev'
}

/**
 * Every keyboard combination that could reveal the developer workspace.
 *
 * `Ctrl/Cmd+Shift+D` is included deliberately: it is the mode switch, so in normal mode it is
 * ignored like the rest. The toolbar's mode segment is the way in and out, which keeps the
 * browser free of hidden triggers without trapping anyone in a mode.
 */
export function isDeveloperShortcut(event: {
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  key: string
}): boolean {
  if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return false
  return ['i', 'c', 'r', 'a', 'd', 'j', 'k'].includes(event.key.toLowerCase())
}

/**
 * Panels that belong to the developer workspace and are therefore dev-only.
 *
 * `ai` is deliberately not in here any more: the AI panel is a *productivity* surface now - a
 * multi-model side panel you can chat with - so it is offered in both modes. The developer
 * *debugger* side of it (context chips built from captured traffic) only has anything to say in
 * dev mode, which is where the capture exists in the first place.
 */
export const DEV_ONLY_PANELS = [
  'elements',
  'console',
  'interceptor',
  'recon',
  'design',
  'defense',
  'servers',
  'viewport',
  'storage'
] as const

export type DevOnlyPanel = (typeof DEV_ONLY_PANELS)[number]

export function isPanelAvailable(mode: WorkspaceMode, panel: string): boolean {
  return mode === 'dev' || !(DEV_ONLY_PANELS as readonly string[]).includes(panel)
}

/**
 * The dock: what the left rail offers, and in which mode.
 *
 * One table, because the alternative is a renderer that filters its own list and a mode table
 * that filters another - and then a tool that shows up in normal mode by omission. The dock
 * draws this list; `isPanelAvailable` answers the same question for the omnibox's `>` commands
 * and for anything else that opens a panel by name.
 *
 * The everyday tools come first and the settings slot is pinned to the bottom of the rail. The
 * developer tools sit between them in the order they are usually reached for.
 */
export type DockToolId =
  | 'ai'
  | 'bookmarks'
  | 'history'
  | 'elements'
  | 'console'
  | 'interceptor'
  | 'servers'
  | 'viewport'
  | 'design'
  | 'storage'
  | 'recon'
  | 'defense'
  | 'settings'

export interface DockTool {
  id: DockToolId
  label: string
  /** Modes that offer it. */
  modes: readonly WorkspaceMode[]
  /** Where it sits: the main run of tools, or the pinned footer. */
  slot: 'main' | 'footer'
}

export const DOCK_TOOLS: readonly DockTool[] = [
  /* Everyday: the same four in both modes. */
  { id: 'ai', label: 'AI assistant', modes: ['normal', 'dev'], slot: 'main' },
  { id: 'bookmarks', label: 'Bookmarks', modes: ['normal', 'dev'], slot: 'main' },
  { id: 'history', label: 'History', modes: ['normal', 'dev'], slot: 'main' },

  /* Developer tools: the dock expands to these in dev mode. */
  { id: 'elements', label: 'Elements', modes: ['dev'], slot: 'main' },
  { id: 'console', label: 'Console', modes: ['dev'], slot: 'main' },
  { id: 'interceptor', label: 'Network', modes: ['dev'], slot: 'main' },
  { id: 'servers', label: 'Local dev servers', modes: ['dev'], slot: 'main' },
  { id: 'viewport', label: 'Device viewport (RWD)', modes: ['dev'], slot: 'main' },
  { id: 'design', label: 'Live design & CSS', modes: ['dev'], slot: 'main' },
  { id: 'storage', label: 'Application', modes: ['dev'], slot: 'main' },
  { id: 'recon', label: 'Recon & report', modes: ['dev'], slot: 'main' },
  { id: 'defense', label: 'Extreme defense mode', modes: ['dev'], slot: 'main' },

  { id: 'settings', label: 'Settings', modes: ['normal', 'dev'], slot: 'footer' }
]

/** The tools the dock shows in a mode, footer last. */
export function dockToolsFor(mode: WorkspaceMode): DockTool[] {
  return DOCK_TOOLS.filter((tool) => tool.modes.includes(mode))
}

/**
 * The WImH defense overlay is the one exception to the normal-mode lock-down.
 *
 * It is privacy rather than monitoring - a RAM-only session, a clipboard sentinel and a
 * screen-capture guard - so it stays reachable in both modes. It carries its own shortcut so
 * the developer combinations stay inert in normal mode: opening it never turns the browser
 * into a monitored one, it only borrows the observation pipeline for as long as the operator
 * keeps the panel open.
 */
export const DEFENSE_SHORTCUT_LABEL = 'Ctrl/Cmd+Shift+H'

export function isDefenseShortcut(event: {
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  key: string
}): boolean {
  return (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'h'
}
