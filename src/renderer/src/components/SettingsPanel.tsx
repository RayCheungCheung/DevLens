import { ArrowLeftToLine, ArrowRightToLine, Compass, LayoutPanelTop, Settings, ShieldCheck, UserRound } from 'lucide-react'
import { PROTECTION_DESCRIPTORS, PROTECTION_LEVELS, type ProtectionLevel } from '@shared/protection'
import { modeDescriptor, type WorkspaceMode } from '@shared/mode'
import type { BookmarkOptions, ProtectionState } from '@shared/types'
import type { ToolbarTools } from '@shared/preferences'
import type { SidebarTogglePosition } from '@shared/preferences'

interface SettingsPanelProps {
  mode: WorkspaceMode
  /** The bar's two switches; they live with the bookmarks, so they survive a restart. */
  bookmarkOptions: BookmarkOptions
  onBookmarkOptions: (patch: Partial<BookmarkOptions>) => void
  protection: ProtectionState
  onProtection: (level: ProtectionLevel) => void
  /** Whether the identity screen appears on launch. */
  profileAsk: boolean
  onProfileAsk: (ask: boolean) => void
  profileName: string
  /** Where the sidebar handle sits, and which toolbar tools are allowed to show. */
  layout: { sidebarToggle: SidebarTogglePosition; tools: ToolbarTools }
  onLayout: (patch: { sidebarToggle?: SidebarTogglePosition; tools?: Partial<ToolbarTools> }) => void
  /** Opens `devlens:settings/omnibox` as a tab: the engine and shortcut configuration. */
  onOpenOmniboxSettings: () => void
}

/** The toolbar controls the operator can hide, with the reason each one exists. */
const TOOL_ROWS: { key: keyof ToolbarTools; label: string; detail: string }[] = [
  { key: 'viewport', label: 'Viewport chip', detail: 'which viewport a command will reach' },
  { key: 'scrollSync', label: 'Scroll sync', detail: 'scroll the two viewports together' },
  { key: 'openInIde', label: 'Open in VS Code', detail: 'click-to-source hand-off' },
  { key: 'defense', label: 'WImH shield', detail: 'the extreme defense panel' }
]

/**
 * Settings.
 *
 * Deliberately short: three things that are genuinely configurable at runtime and are stored
 * where they belong - the bar's two switches with the bookmarks, the identity prompt with the
 * profile registry, and the protection level, which is session state by design and says so.
 * Everything else about DevLens lives in `devlens.config.json`, and inventing a UI that writes it
 * would be a second place for the same truth.
 */
export function SettingsPanel({
  mode,
  bookmarkOptions,
  onBookmarkOptions,
  protection,
  onProtection,
  profileAsk,
  onProfileAsk,
  profileName,
  layout,
  onLayout,
  onOpenOmniboxSettings
}: SettingsPanelProps) {
  const descriptor = modeDescriptor(mode)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-testid="settings-panel">
      <section className="border-b border-[var(--devlens-hairline)] px-3 py-3">
        <h3 className="flex items-center gap-1.5 text-[11px] text-ink-200">
          <LayoutPanelTop size={12} className="text-[var(--devlens-accent)]" />
          Bookmarks toolbar
        </h3>
        <label className="mt-2 flex items-center gap-2 text-[10px] text-ink-400">
          <input
            type="checkbox"
            data-testid="settings-toolbar-visible"
            checked={bookmarkOptions.toolbarVisible}
            onChange={(event) => onBookmarkOptions({ toolbarVisible: event.target.checked })}
            className="h-3.5 w-3.5 accent-[var(--devlens-accent)]"
          />
          Always show the bar, even when it is empty
        </label>
        <label className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-400">
          <input
            type="checkbox"
            data-testid="settings-other-bookmarks"
            checked={bookmarkOptions.showOtherBookmarks}
            onChange={(event) => onBookmarkOptions({ showOtherBookmarks: event.target.checked })}
            className="h-3.5 w-3.5 accent-[var(--devlens-accent)]"
          />
          Show the other-bookmarks chip
        </label>
      </section>

      <section className="border-b border-[var(--devlens-hairline)] px-3 py-3">
        <h3 className="flex items-center gap-1.5 text-[11px] text-ink-200">
          <Compass size={12} className="text-[var(--devlens-accent)]" />
          Omnibox &amp; Engines
        </h3>
        <p className="mt-1.5 text-[10px] leading-4 text-ink-500">
          The default engine, your own engines and shortcuts, and what the dropdown may suggest.
        </p>
        <button
          type="button"
          data-testid="settings-open-omnibox"
          onClick={onOpenOmniboxSettings}
          className="mt-2 flex w-full items-center justify-between rounded border border-[var(--devlens-hairline)] px-2 py-1.5 text-[11px] text-ink-200 hover:border-[var(--devlens-accent-line)] hover:bg-white/[0.03]"
        >
          Open the control panel
          <span className="font-mono text-[9px] text-ink-500">devlens:settings/omnibox</span>
        </button>
      </section>

      <section className="border-b border-[var(--devlens-hairline)] px-3 py-3">
        <h3 className="flex items-center gap-1.5 text-[11px] text-ink-200">
          <LayoutPanelTop size={12} className="text-[var(--devlens-accent)]" />
          Toolbar &amp; sidebar
        </h3>
        <p className="mt-1.5 text-[10px] leading-4 text-ink-500">Where the dock handle sits</p>
        <div
          role="radiogroup"
          aria-label="Sidebar toggle position"
          className="mt-2 flex overflow-hidden rounded border border-[var(--devlens-hairline)]"
        >
          {(
            [
              ['start', 'Far left', ArrowLeftToLine],
              ['end', 'With the tools', ArrowRightToLine]
            ] as [SidebarTogglePosition, string, typeof ArrowLeftToLine][]
          ).map(([value, label, Glyph]) => {
            const active = layout.sidebarToggle === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`settings-sidebar-toggle-${value}`}
                onClick={() => onLayout({ sidebarToggle: value })}
                className={[
                  'flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] transition-colors',
                  active
                    ? 'bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                    : 'text-ink-400 hover:bg-white/[0.03]'
                ].join(' ')}
              >
                <Glyph size={11} />
                {label}
              </button>
            )
          })}
        </div>

        <p className="mt-3 text-[10px] leading-4 text-ink-500">Tools in the toolbar</p>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {TOOL_ROWS.map((row) => (
            <label key={row.key} className="flex items-start gap-2 text-[10px] text-ink-300">
              <input
                type="checkbox"
                data-testid={`settings-tool-${row.key}`}
                checked={layout.tools[row.key]}
                onChange={(event) => onLayout({ tools: { [row.key]: event.target.checked } })}
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--devlens-accent)]"
              />
              <span className="min-w-0">
                <span className="block">{row.label}</span>
                <span className="block text-ink-600">{row.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="border-b border-[var(--devlens-hairline)] px-3 py-3">
        <h3 className="flex items-center gap-1.5 text-[11px] text-ink-200">
          <ShieldCheck size={12} className="text-[var(--devlens-accent)]" />
          Protection
        </h3>
        <div className="mt-2 flex flex-col gap-1">
          {PROTECTION_LEVELS.map((level) => {
            const option = PROTECTION_DESCRIPTORS[level]
            const current = level === protection.level
            return (
              <button
                key={level}
                type="button"
                role="menuitemradio"
                aria-checked={current}
                aria-label={`Set protection to ${option.label}`}
                data-testid={`settings-protection-${level}`}
                onClick={() => onProtection(level)}
                className={[
                  'flex min-w-0 items-start gap-2 rounded border px-2 py-1.5 text-left transition-colors',
                  current
                    ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                    : 'border-[var(--devlens-hairline)] hover:bg-white/[0.03]'
                ].join(' ')}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-ink-200">{option.label}</span>
                  <span className="block text-[10px] leading-4 text-ink-500">{option.summary}</span>
                </span>
                {current && (
                  <span className="shrink-0 font-mono text-[9px] text-[var(--devlens-accent)]">on</span>
                )}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-ink-600">
          The level is per session and never written to disk; the toolbar badge changes it too.
        </p>
      </section>

      <section className="px-3 py-3">
        <h3 className="flex items-center gap-1.5 text-[11px] text-ink-200">
          <UserRound size={12} className="text-[var(--devlens-accent)]" />
          Identity
        </h3>
        <p className="mt-1.5 truncate font-mono text-[10px] text-ink-500" data-testid="settings-profile">
          {profileName}
        </p>
        <label className="mt-2 flex items-center gap-2 text-[10px] text-ink-400">
          <input
            type="checkbox"
            data-testid="settings-ask-on-startup"
            checked={profileAsk}
            onChange={(event) => onProfileAsk(event.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--devlens-accent)]"
          />
          Ask who is using DevLens on startup
        </label>
      </section>

      <section className="mt-auto border-t border-[var(--devlens-hairline)] px-3 py-2.5">
        <h3 className="flex items-center gap-1.5 text-[11px] text-ink-200">
          <Settings size={12} className="text-[var(--devlens-accent)]" />
          {descriptor.label}
        </h3>
        <p className="mt-1 text-[10px] leading-4 text-ink-500">
          {descriptor.tagline}. The dock offers {mode === 'dev' ? 'every tool' : 'everyday tools only'}{' '}
          in this mode.
        </p>
      </section>
    </div>
  )
}
