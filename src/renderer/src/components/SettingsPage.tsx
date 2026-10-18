import { ArrowLeftToLine, ArrowRightToLine, ChevronRight, Compass, LayoutPanelTop, Settings, UserRound } from 'lucide-react'
import { AI_SITES, type AiSiteId } from '@shared/ai-sites'
import {
  type SidebarTogglePosition,
  type ToolbarLayout,
  type ToolbarTools
} from '@shared/preferences'
import { AiMark } from '@renderer/components/AiMark'

interface SettingsPageProps {
  /** Which AI site the assistant opens on; the provider the dock's brand follows. */
  aiProvider: AiSiteId
  onProviderChange: (site: AiSiteId) => void
  /** Where the dock handle sits, and which toolbar tools may show. */
  toolbarLayout: ToolbarLayout
  onLayout: (patch: { sidebarToggle?: SidebarTogglePosition; tools?: Partial<ToolbarTools> }) => void
  /** Whether the identity screen appears on launch. */
  profileAsk: boolean
  onProfileAsk: (ask: boolean) => void
  profileName: string
  /** Opens `devlens:settings/omnibox` - the engine and shortcut configuration. */
  onOpenOmnibox: () => void
}

/** The toolbar controls the operator can hide, with the reason each one exists. */
const TOOL_ROWS: { key: keyof ToolbarTools; label: string; detail: string }[] = [
  { key: 'viewport', label: 'Viewport chip', detail: 'which viewport a command will reach' },
  { key: 'scrollSync', label: 'Scroll sync', detail: 'scroll the two viewports together' },
  { key: 'openInIde', label: 'Open in VS Code', detail: 'click-to-source hand-off' },
  { key: 'defense', label: 'WImH shield', detail: 'the extreme defense panel' }
]

/**
 * The profile settings hub, as the shell's own full tab surface (`devlens:settings`).
 *
 * A short, real set of controls: which AI provider the assistant opens on, how the toolbar is
 * arranged, whether the identity prompt appears on startup, and one door to the omnibox's own
 * configuration. Nothing here is a placeholder - every row writes where it belongs.
 */
export function SettingsPage({
  aiProvider,
  onProviderChange,
  toolbarLayout,
  onLayout,
  profileAsk,
  onProfileAsk,
  profileName,
  onOpenOmnibox
}: SettingsPageProps) {
  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-y-auto bg-ink-950" data-testid="settings-page">
      <div className="flex h-full w-full max-w-[720px] flex-col py-6">
        <div className="shrink-0 px-4">
          <h1 className="flex items-center gap-2 text-[15px] font-semibold text-ink-100">
            <Settings size={16} className="text-[var(--devlens-accent)]" />
            Settings
          </h1>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <section className="border-b border-[var(--devlens-hairline)] px-2 py-3">
            <h2 className="flex items-center gap-1.5 text-[11px] text-ink-200">
              <Compass size={12} className="text-[var(--devlens-accent)]" />
              AI provider
            </h2>
            <p className="mt-1 text-[10px] leading-4 text-ink-500">
              Which site the assistant panel opens on, and which brand the dock shows.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {AI_SITES.map((site) => {
                const active = site.id === aiProvider
                return (
                  <button
                    key={site.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`settings-provider-${site.id}`}
                    onClick={() => onProviderChange(site.id)}
                    className={[
                      'flex items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors',
                      active
                        ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                        : 'border-[var(--devlens-hairline)] hover:bg-white/[0.03]'
                    ].join(' ')}
                  >
                    <AiMark site={site.id} className="shrink-0 text-current" />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-ink-200">{site.label}</span>
                    {active && <span className="shrink-0 font-mono text-[9px] text-[var(--devlens-accent)]">on</span>}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="border-b border-[var(--devlens-hairline)] px-2 py-3">
            <h2 className="flex items-center gap-1.5 text-[11px] text-ink-200">
              <Compass size={12} className="text-[var(--devlens-accent)]" />
              Omnibox &amp; engines
            </h2>
            <p className="mt-1 text-[10px] leading-4 text-ink-500">
              The default engine, your own engines and shortcuts, and what the dropdown may suggest.
            </p>
            <button
              type="button"
              data-testid="settings-open-omnibox"
              onClick={onOpenOmnibox}
              className="mt-2 flex w-full items-center justify-between rounded-md border border-[var(--devlens-hairline)] px-3 py-2 text-[11px] text-ink-200 hover:border-[var(--devlens-accent-line)] hover:bg-white/[0.03]"
            >
              <span>Open the control panel</span>
              <span className="flex items-center gap-1 font-mono text-[9px] text-ink-500">
                devlens:settings/omnibox <ChevronRight size={11} />
              </span>
            </button>
          </section>

          <section className="border-b border-[var(--devlens-hairline)] px-2 py-3">
            <h2 className="flex items-center gap-1.5 text-[11px] text-ink-200">
              <LayoutPanelTop size={12} className="text-[var(--devlens-accent)]" />
              Toolbar &amp; sidebar
            </h2>
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
                const active = toolbarLayout.sidebarToggle === value
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
                    data-testid={`settings-page-tool-${row.key}`}
                    checked={toolbarLayout.tools[row.key]}
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

          <section className="px-2 py-3">
            <h2 className="flex items-center gap-1.5 text-[11px] text-ink-200">
              <UserRound size={12} className="text-[var(--devlens-accent)]" />
              Identity
            </h2>
            <p className="mt-1.5 truncate font-mono text-[10px] text-ink-500">{profileName}</p>
            <label className="mt-2 flex items-center gap-2 text-[10px] text-ink-400">
              <input
                type="checkbox"
                data-testid="settings-page-ask-on-startup"
                checked={profileAsk}
                onChange={(event) => onProfileAsk(event.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--devlens-accent)]"
              />
              Ask who is using DevLens on startup
            </label>
          </section>
        </div>
      </div>
    </div>
  )
}
