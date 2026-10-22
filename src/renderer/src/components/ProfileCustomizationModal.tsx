import { useEffect, useMemo, useState } from 'react'
import { Loader2, RotateCcw, Save, X } from 'lucide-react'
import type { BrowserProfile, ProfileAvatar } from '@shared/types'
import type { ProfilePreferences } from '@shared/preferences'
import {
  CODE_FONTS,
  DEFAULT_APPEARANCE_PREFERENCES,
  INTERFACE_FONTS,
  WORKSPACE_THEMES,
  type CodeFontId,
  type ContentThemeMode,
  type UiDensity,
  type UiFontId,
  type WorkspaceThemeId
} from '@shared/appearance'
import {
  DEFAULT_BROWSER_PREFERENCES
} from '@shared/preferences'
import {
  DEFAULT_LANGUAGE_PREFERENCES,
  LANGUAGE_OPTIONS
} from '@shared/languages'
import {
  PROFILE_AVATARS,
  ProfileAvatarMark
} from '@renderer/components/ProfileAvatarMark'
import { SelectMenu, type SelectOption } from '@renderer/components/SelectMenu'

interface ProfileCustomizationModalProps {
  profile: BrowserProfile
  onClose: () => void
}

interface Draft {
  name: string
  avatar: ProfileAvatar
  contentTheme: ContentThemeMode
  workspaceTheme: WorkspaceThemeId
  density: UiDensity
  uiFont: UiFontId
  codeFont: CodeFontId
  defaultZoom: number
  primaryLanguage: string
}

const EMPTY_DRAFT: Draft = {
  name: '',
  avatar: 'user',
  contentTheme: DEFAULT_APPEARANCE_PREFERENCES.contentTheme,
  workspaceTheme: DEFAULT_APPEARANCE_PREFERENCES.workspaceTheme,
  density: DEFAULT_APPEARANCE_PREFERENCES.density,
  uiFont: DEFAULT_APPEARANCE_PREFERENCES.uiFont,
  codeFont: DEFAULT_APPEARANCE_PREFERENCES.codeFont,
  defaultZoom: DEFAULT_BROWSER_PREFERENCES.defaultZoom,
  primaryLanguage: DEFAULT_LANGUAGE_PREFERENCES.primaryLanguage
}

export function ProfileCustomizationModal({
  profile,
  onClose
}: ProfileCustomizationModalProps) {
  const [preferences, setPreferences] = useState<ProfilePreferences | null>(null)
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT, name: profile.name, avatar: profile.avatar ?? 'user' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setPreferences(null)
    setError(null)
    void window.devlens
      .profilePreferencesGet(profile.id)
      .then((next) => {
        if (cancelled) return
        setPreferences(next)
        setDraft({
          name: profile.name,
          avatar: profile.avatar ?? 'user',
          contentTheme: next.appearance.contentTheme,
          workspaceTheme: next.appearance.workspaceTheme,
          density: next.appearance.density,
          uiFont: next.appearance.uiFont,
          codeFont: next.appearance.codeFont,
          defaultZoom: next.browser.defaultZoom,
          primaryLanguage: next.languages.primaryLanguage
        })
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause))
      })
    return () => {
      cancelled = true
    }
  }, [profile.avatar, profile.id, profile.name])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [busy, onClose])

  const selectedTheme = useMemo(
    () => WORKSPACE_THEMES.find((theme) => theme.id === draft.workspaceTheme) ?? WORKSPACE_THEMES[0],
    [draft.workspaceTheme]
  )

  const save = async (): Promise<void> => {
    if (!preferences || busy || !draft.name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await window.devlens.profilesUpdate(profile.id, {
        name: draft.name.trim(),
        avatar: draft.avatar
      })
      const next = await window.devlens.profilePreferencesSet(profile.id, {
        appearance: {
          ...preferences.appearance,
          contentTheme: draft.contentTheme,
          workspaceTheme: draft.workspaceTheme,
          density: draft.density,
          uiFont: draft.uiFont,
          codeFont: draft.codeFont
        },
        browser: {
          ...preferences.browser,
          defaultZoom: draft.defaultZoom
        },
        languages: {
          ...preferences.languages,
          primaryLanguage: draft.primaryLanguage
        }
      })
      if (profile.active) {
        await window.devlens.appearanceApplyTheme(next.appearance.contentTheme)
        await window.devlens.languagesApply({
          spellCheck: next.languages.spellCheck,
          spellCheckLanguages: next.languages.spellCheckLanguages
        })
      }
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"
      onMouseDown={() => {
        if (!busy) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Customize ${profile.name}`}
        data-testid="profile-customization-modal"
        className="flex max-h-[88vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-[var(--devlens-hairline-strong)] bg-[var(--color-ink-950)] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-[var(--devlens-hairline)] px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]">
            <ProfileAvatarMark avatar={draft.avatar} size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-ink-100">Customize profile</h2>
            <p className="mt-0.5 text-[10px] text-ink-500">
              Changes are stored only inside this profile.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close profile customization"
            disabled={busy}
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-white/5 hover:text-ink-100"
          >
            <X size={14} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!preferences ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[11px] text-ink-500">
              <Loader2 size={14} className="animate-spin" />
              Loading profile preferences…
            </div>
          ) : (
            <div className="space-y-5">
              <section>
                <h3 className="text-[11px] font-medium text-ink-200">Identity</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="text-[10px] text-ink-500">
                    Profile name
                    <input
                      value={draft.name}
                      maxLength={32}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, name: event.target.value }))
                      }
                      className="mt-1 h-9 w-full rounded-md border border-[var(--devlens-hairline)] bg-black/20 px-2.5 text-[12px] text-ink-100 outline-none focus:border-[var(--devlens-accent-line)]"
                    />
                  </label>
                  <div>
                    <p className="text-[10px] text-ink-500">Avatar</p>
                    <div className="mt-1 flex items-center gap-1">
                      {PROFILE_AVATARS.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          aria-label={`Use ${entry.id} avatar`}
                          aria-pressed={draft.avatar === entry.id}
                          onClick={() =>
                            setDraft((current) => ({ ...current, avatar: entry.id }))
                          }
                          className={[
                            'inline-flex h-8 w-8 items-center justify-center rounded-full border',
                            draft.avatar === entry.id
                              ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                              : 'border-[var(--devlens-hairline)] text-ink-500 hover:text-ink-200'
                          ].join(' ')}
                        >
                          <ProfileAvatarMark avatar={entry.id} size={13} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[11px] font-medium text-ink-200">Theme</h3>
                    <p className="mt-0.5 text-[10px] text-ink-500">{selectedTheme.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        contentTheme: DEFAULT_APPEARANCE_PREFERENCES.contentTheme,
                        workspaceTheme: DEFAULT_APPEARANCE_PREFERENCES.workspaceTheme,
                        density: DEFAULT_APPEARANCE_PREFERENCES.density,
                        uiFont: DEFAULT_APPEARANCE_PREFERENCES.uiFont,
                        codeFont: DEFAULT_APPEARANCE_PREFERENCES.codeFont
                      }))
                    }
                    className="inline-flex h-7 items-center gap-1 rounded border border-[var(--devlens-hairline)] px-2 text-[9px] text-ink-400 hover:text-ink-100"
                  >
                    <RotateCcw size={9} />
                    Reset appearance
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {WORKSPACE_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      aria-pressed={draft.workspaceTheme === theme.id}
                      onClick={() =>
                        setDraft((current) => ({ ...current, workspaceTheme: theme.id }))
                      }
                      className={[
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-left',
                        draft.workspaceTheme === theme.id
                          ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                          : 'border-[var(--devlens-hairline)] hover:bg-white/[0.03]'
                      ].join(' ')}
                    >
                      <span className="flex shrink-0 gap-1">
                        {theme.swatches.map((color) => (
                          <span
                            key={color}
                            className="h-4 w-4 rounded-full border border-white/10"
                            style={{ background: color }}
                          />
                        ))}
                      </span>
                      <span className="min-w-0 text-[10px] text-ink-200">{theme.label}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <SelectField
                    label="Content theme"
                    testId="profile-content-theme"
                    value={draft.contentTheme}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        contentTheme: value as ContentThemeMode
                      }))
                    }
                    options={[
                      { value: 'system', label: 'Follow system' },
                      { value: 'light', label: 'Light' },
                      { value: 'dark', label: 'Dark' }
                    ]}
                  />
                  <SelectField
                    label="Density"
                    testId="profile-density"
                    value={draft.density}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, density: value as UiDensity }))
                    }
                    options={[
                      { value: 'automatic', label: 'Automatic' },
                      { value: 'standard', label: 'Standard' },
                      { value: 'compact', label: 'Compact' },
                      { value: 'touch', label: 'Touch' }
                    ]}
                  />
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-medium text-ink-200">Typography</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <SelectField
                    label="Interface font"
                    testId="profile-ui-font"
                    value={draft.uiFont}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, uiFont: value as UiFontId }))
                    }
                    options={INTERFACE_FONTS.map((font) => ({
                      value: font.id,
                      label: font.label,
                      description: font.detail
                    }))}
                  />
                  <SelectField
                    label="Code font"
                    testId="profile-code-font"
                    value={draft.codeFont}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, codeFont: value as CodeFontId }))
                    }
                    options={CODE_FONTS.map((font) => ({
                      value: font.id,
                      label: font.label,
                      description: font.detail
                    }))}
                  />
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-medium text-ink-200">Browsing</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <label className="text-[10px] text-ink-500">
                    Default zoom: <span className="font-mono text-ink-200">{draft.defaultZoom}%</span>
                    <input
                      type="range"
                      min={50}
                      max={250}
                      step={10}
                      value={draft.defaultZoom}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          defaultZoom: Number(event.target.value)
                        }))
                      }
                      className="mt-2 w-full accent-[var(--devlens-accent)]"
                    />
                  </label>
                  <SelectField
                    label="Primary language"
                    testId="profile-primary-language"
                    value={draft.primaryLanguage}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, primaryLanguage: value }))
                    }
                    options={LANGUAGE_OPTIONS.map((language) => ({
                      value: language.id,
                      label: language.label
                    }))}
                  />
                </div>
              </section>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[10px] text-rose-200">
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[var(--devlens-hairline)] px-5 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="h-9 rounded-md border border-[var(--devlens-hairline)] px-3 text-[11px] text-ink-300 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !preferences || !draft.name.trim()}
            onClick={() => void save()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-3 text-[11px] text-[var(--devlens-accent)] disabled:opacity-40"
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            Save profile
          </button>
        </footer>
      </section>
    </div>
  )
}

function SelectField({
  label,
  testId,
  value,
  options,
  onChange
}: {
  label: string
  testId: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] text-ink-500">{label}</p>
      <SelectMenu
        value={value}
        onChange={onChange}
        sections={[{ options }]}
        ariaLabel={label}
        testId={testId}
        menuWidth={300}
        className="w-full"
      />
    </div>
  )
}
