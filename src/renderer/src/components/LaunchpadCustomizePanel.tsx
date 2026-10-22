import { useEffect, useState, type ReactNode } from 'react'
import {
  Check,
  ChevronRight,
  ImagePlus,
  LayoutDashboard,
  Settings2,
  X
} from 'lucide-react'
import type { AppearancePreferences, ContentThemeMode, WorkspaceThemeId } from '@shared/appearance'
import { WORKSPACE_THEMES } from '@shared/appearance'
import type { LaunchpadPreferences } from '@shared/launchpad'
import { WALLPAPER_PRESETS, type WallpaperPresetId } from '@shared/wallpapers'
import { SelectMenu } from '@renderer/components/SelectMenu'

interface LaunchpadCustomizePanelProps {
  launchpad: LaunchpadPreferences
  appearance: AppearancePreferences
  onLaunchpad: (patch: Partial<LaunchpadPreferences>) => void
  onAppearance: (patch: Partial<AppearancePreferences>) => void
  onChooseWallpaper: () => void
  onManageAppearance: () => void
  onManageWidgets: () => void
  onClose: () => void
}

const CONTENT_THEMES: { id: ContentThemeMode; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' }
]

export function LaunchpadCustomizePanel({
  launchpad,
  appearance,
  onLaunchpad,
  onAppearance,
  onChooseWallpaper,
  onManageAppearance,
  onManageWidgets,
  onClose
}: LaunchpadCustomizePanelProps) {
  const [lastWallpaper, setLastWallpaper] = useState<WallpaperPresetId>(
    launchpad.wallpaperPreset === 'none' ? 'lensy' : launchpad.wallpaperPreset
  )
  const backdropEnabled = launchpad.wallpaperPreset !== 'none'

  useEffect(() => {
    if (launchpad.wallpaperPreset !== 'none') setLastWallpaper(launchpad.wallpaperPreset)
  }, [launchpad.wallpaperPreset])

  return (
    <div
      className="absolute inset-0 z-[50] bg-black/35 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Launchpad Studio"
        data-testid="launchpad-customize-panel"
        className="absolute bottom-4 right-4 flex max-h-[calc(100%-2rem)] w-[460px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl border border-[var(--devlens-hairline-strong)] bg-[color-mix(in_srgb,var(--color-ink-950)_97%,transparent)] shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--devlens-hairline)] px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]">
            <LayoutDashboard size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold text-ink-100">Launchpad Studio</h2>
            <p className="mt-0.5 text-[9px] tracking-wide text-ink-500">
              Shape this profile&apos;s start surface
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Launchpad Studio"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-white/5 hover:text-ink-100"
          >
            <X size={14} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <WorkspaceFinish
            workspaceTheme={appearance.workspaceTheme}
            contentTheme={appearance.contentTheme}
            onWorkspaceTheme={(workspaceTheme) => onAppearance({ workspaceTheme })}
            onContentTheme={(contentTheme) => onAppearance({ contentTheme })}
          />

          <StudioDivider />

          <section>
            <SectionHeader
              title="Backdrop"
              detail={
                backdropEnabled
                  ? 'The selected scene sits behind the search field.'
                  : 'The launchpad uses the plain DevLens surface.'
              }
              control={
                <PresenceControl
                  shown={backdropEnabled}
                  shownLabel="On"
                  hiddenLabel="Off"
                  ariaLabel="Backdrop visibility"
                  onChange={(enabled) =>
                    onLaunchpad({
                      wallpaperPreset: enabled ? lastWallpaper : 'none',
                      wallpaper: enabled ? launchpad.wallpaper : ''
                    })
                  }
                />
              }
            />

            {backdropEnabled && (
              <div className="mt-3 grid grid-cols-3 gap-x-2.5 gap-y-3">
                <button
                  type="button"
                  onClick={onChooseWallpaper}
                  className="group flex min-w-0 flex-col items-start gap-1.5"
                >
                  <span className="flex aspect-[1.4] w-full items-center justify-center rounded-lg border border-dashed border-[var(--devlens-hairline-strong)] bg-white/[0.015] text-ink-400 transition-colors group-hover:border-[var(--devlens-accent-line)] group-hover:text-[var(--devlens-accent)]">
                    <ImagePlus size={20} strokeWidth={1.5} />
                  </span>
                  <span className="truncate text-[9px] text-ink-400">Import scene</span>
                </button>

                {WALLPAPER_PRESETS.map((wallpaper) => {
                  const selected = launchpad.wallpaperPreset === wallpaper.id
                  return (
                    <button
                      key={wallpaper.id}
                      type="button"
                      onClick={() =>
                        onLaunchpad({
                          wallpaperPreset: wallpaper.id,
                          wallpaper: ''
                        })
                      }
                      className="group flex min-w-0 flex-col items-start gap-1.5"
                    >
                      <span
                        className={[
                          'relative aspect-[1.4] w-full rounded-lg border bg-cover bg-center transition-transform group-hover:-translate-y-0.5',
                          selected
                            ? 'border-[var(--devlens-accent)]'
                            : 'border-white/[0.08]'
                        ].join(' ')}
                        style={{ backgroundImage: `url("${wallpaper.image}")` }}
                      >
                        {selected && (
                          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--devlens-accent)] text-ink-950">
                            <Check size={10} strokeWidth={3} />
                          </span>
                        )}
                      </span>
                      <span
                        className={[
                          'truncate text-[9px]',
                          selected ? 'text-ink-100' : 'text-ink-400'
                        ].join(' ')}
                      >
                        {wallpaper.label.replace(' Night', '')}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <StudioDivider />

          <section>
            <SectionHeader
              title="Quick tiles"
              detail={
                launchpad.shortcutsVisible
                  ? `${shortcutCapacity(launchpad.shortcutRows)} spaces are reserved below search.`
                  : 'The area below search stays clear.'
              }
              control={
                <PresenceControl
                  shown={launchpad.shortcutsVisible}
                  shownLabel="Show"
                  hiddenLabel="Hide"
                  ariaLabel="Quick tile visibility"
                  onChange={(shortcutsVisible) => onLaunchpad({ shortcutsVisible })}
                />
              }
            />
            {launchpad.shortcutsVisible && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--devlens-hairline)] bg-white/[0.015] px-3 py-2">
                <span className="text-[10px] text-ink-400">Visible tile rows</span>
                <SelectMenu
                  value={String(launchpad.shortcutRows)}
                  onChange={(value) => onLaunchpad({ shortcutRows: Number(value) })}
                  sections={[
                    {
                      options: [1, 2, 3, 4].map((rows) => ({
                        value: String(rows),
                        label: `${rows} row${rows === 1 ? '' : 's'}`
                      }))
                    }
                  ]}
                  ariaLabel="Visible quick tile rows"
                  testId="launchpad-shortcut-rows"
                  size="sm"
                  menuWidth={130}
                  className="w-[104px]"
                />
              </div>
            )}
          </section>

          <StudioDivider />

          <section>
            <SectionHeader
              title="Widget shelf"
              detail={
                launchpad.widgetsVisible
                  ? 'Local tools are visible below the launch surface.'
                  : 'The widget shelf is folded away.'
              }
              control={
                <PresenceControl
                  shown={launchpad.widgetsVisible}
                  shownLabel="Show"
                  hiddenLabel="Hide"
                  ariaLabel="Widget shelf visibility"
                  onChange={(widgetsVisible) => onLaunchpad({ widgetsVisible })}
                />
              }
            />
            {launchpad.widgetsVisible && (
              <button
                type="button"
                onClick={onManageWidgets}
                className="mt-3 flex h-9 w-full items-center justify-between rounded-lg border border-[var(--devlens-hairline)] px-3 text-[10px] text-ink-300 transition-colors hover:border-[var(--devlens-accent-line)] hover:bg-white/[0.025]"
              >
                Choose individual widgets
                <ChevronRight size={12} className="text-ink-500" />
              </button>
            )}
          </section>
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-[var(--devlens-hairline)] px-4 py-3">
          <span className="text-[9px] text-ink-600">Stored in this profile</span>
          <button
            type="button"
            onClick={onManageAppearance}
            className="inline-flex items-center gap-1.5 text-[10px] text-ink-400 hover:text-[var(--devlens-accent)]"
          >
            <Settings2 size={12} />
            All launchpad settings
          </button>
        </footer>
      </aside>
    </div>
  )
}

function WorkspaceFinish({
  workspaceTheme,
  contentTheme,
  onWorkspaceTheme,
  onContentTheme
}: {
  workspaceTheme: WorkspaceThemeId
  contentTheme: ContentThemeMode
  onWorkspaceTheme: (theme: WorkspaceThemeId) => void
  onContentTheme: (theme: ContentThemeMode) => void
}) {
  return (
    <section>
      <SectionHeader
        title="Workspace finish"
        detail="Choose the chrome treatment, then tune its light or dark surface."
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {WORKSPACE_THEMES.map((theme) => {
          const selected = workspaceTheme === theme.id
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onWorkspaceTheme(theme.id)}
              className={[
                'flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                selected
                  ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                  : 'border-[var(--devlens-hairline)] bg-white/[0.012] hover:bg-white/[0.035]'
              ].join(' ')}
            >
              <span className="flex shrink-0 gap-0.5">
                {theme.swatches.map((color, index) => (
                  <span
                    key={color}
                    className={[
                      'block rounded-sm',
                      index === 0 ? 'h-7 w-2.5' : 'h-7 w-1.5'
                    ].join(' ')}
                    style={{ background: color }}
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1 truncate text-[10px] text-ink-200">
                {theme.label.replace(' Circuit', '').replace(' Terminal', '').replace(' Forge', '')}
              </span>
              {selected && <Check size={11} className="shrink-0 text-[var(--devlens-accent)]" />}
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex rounded-lg border border-[var(--devlens-hairline)] p-0.5">
        {CONTENT_THEMES.map((theme) => {
          const selected = contentTheme === theme.id
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onContentTheme(theme.id)}
              className={[
                'h-7 min-w-0 flex-1 rounded-md px-2 text-[9px] transition-colors',
                selected
                  ? 'bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                  : 'text-ink-500 hover:text-ink-200'
              ].join(' ')}
            >
              {theme.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function SectionHeader({
  title,
  detail,
  control
}: {
  title: string
  detail: string
  control?: ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-[11px] font-medium text-ink-100">{title}</h3>
        <p className="mt-0.5 text-[9px] leading-4 text-ink-500">{detail}</p>
      </div>
      {control}
    </div>
  )
}

function PresenceControl({
  shown,
  shownLabel,
  hiddenLabel,
  ariaLabel,
  onChange
}: {
  shown: boolean
  shownLabel: string
  hiddenLabel: string
  ariaLabel: string
  onChange: (shown: boolean) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex shrink-0 rounded-md border border-[var(--devlens-hairline)] p-0.5"
    >
      <button
        type="button"
        role="radio"
        aria-checked={shown}
        onClick={() => onChange(true)}
        className={[
          'h-6 rounded px-2 text-[8px] transition-colors',
          shown
            ? 'bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
            : 'text-ink-600 hover:text-ink-300'
        ].join(' ')}
      >
        {shownLabel}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={!shown}
        onClick={() => onChange(false)}
        className={[
          'h-6 rounded px-2 text-[8px] transition-colors',
          !shown ? 'bg-white/[0.06] text-ink-200' : 'text-ink-600 hover:text-ink-300'
        ].join(' ')}
      >
        {hiddenLabel}
      </button>
    </div>
  )
}

function StudioDivider() {
  return <div className="my-4 h-px bg-[var(--devlens-hairline)]" />
}

function shortcutCapacity(rows: number): number {
  return Math.max(1, rows) * 8
}
