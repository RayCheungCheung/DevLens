import { ArrowLeft, Check, Palette } from 'lucide-react'
import {
  WORKSPACE_THEMES,
  type AppearancePreferences,
  type WorkspaceThemeId
} from '@shared/appearance'

interface ThemeManagerPageProps {
  appearance: AppearancePreferences
  onTheme: (theme: WorkspaceThemeId) => void
  onBack: () => void
}

/** Extended theme gallery reached from the Appearance settings category. */
export function ThemeManagerPage({ appearance, onTheme, onBack }: ThemeManagerPageProps) {
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto bg-ink-950"
      data-testid="theme-manager"
    >
      <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6 px-8 py-7">
        <header className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Appearance"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--devlens-hairline)] text-ink-400 hover:border-[var(--devlens-accent-line)] hover:text-ink-100"
          >
            <ArrowLeft size={14} />
          </button>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--devlens-accent)]">
              Workspace chrome
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-[22px] font-semibold text-ink-100">
              <Palette size={18} className="text-[var(--devlens-accent)]" />
              Manage DevLens Themes
            </h1>
            <p className="mt-1 text-[11px] text-ink-400">
              Theme changes apply to the toolbar, tabs, sidebar and dashboard chrome together.
            </p>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          {WORKSPACE_THEMES.map((theme) => {
            const selected = appearance.workspaceTheme === theme.id
            return (
              <button
                key={theme.id}
                type="button"
                aria-pressed={selected}
                data-testid={`theme-manager-${theme.id}`}
                onClick={() => onTheme(theme.id)}
                className={[
                  'overflow-hidden rounded-lg border text-left transition-colors',
                  selected
                    ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                    : 'border-[var(--devlens-hairline)] bg-white/[0.018] hover:border-[var(--devlens-accent-line)]'
                ].join(' ')}
              >
                <div className="flex h-24 items-stretch">
                  {theme.swatches.map((color, index) => (
                    <span
                      key={color}
                      className="block flex-1"
                      style={{ backgroundColor: color, opacity: 1 - index * 0.08 }}
                    />
                  ))}
                </div>
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-ink-100">{theme.label}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-ink-500">{theme.detail}</p>
                  </div>
                  {selected && <Check size={15} className="mt-0.5 shrink-0 text-[var(--devlens-accent)]" />}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
