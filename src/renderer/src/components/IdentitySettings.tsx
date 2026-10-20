import { useState, type ReactNode } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import type { BrowserProfile, ProfileAvatar } from '@shared/types'
import {
  PROFILE_AVATARS,
  ProfileAvatarMark
} from '@renderer/components/ProfileAvatarMark'
import { ToggleSwitch } from '@renderer/components/ToggleSwitch'

interface IdentitySettingsProps {
  profiles: BrowserProfile[]
  busy: boolean
  askOnStartup: boolean
  onAskOnStartupChange: (ask: boolean) => void
  onSwitch: (id: string) => void
  onCreate: (name: string, avatar: ProfileAvatar) => void
  onDelete: (id: string) => void
}

function lastUsedLabel(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 90) return 'Used just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `Used ${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Used ${hours}h ago`
  return `Used ${Math.round(hours / 24)}d ago`
}

export function IdentitySettingsContent({
  profiles,
  busy,
  askOnStartup,
  onAskOnStartupChange,
  onSwitch,
  onCreate,
  onDelete
}: IdentitySettingsProps) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [avatar, setAvatar] = useState<ProfileAvatar>('user')
  const [deleteTarget, setDeleteTarget] = useState<BrowserProfile | null>(null)

  const submit = (): void => {
    const name = draft.trim()
    if (!name || busy) return
    onCreate(name, avatar)
    setDraft('')
    setAvatar('user')
    setAdding(false)
  }

  return (
    <div className="flex flex-col gap-4" data-testid="identity-settings">
      <SettingsCard
        title="Local profiles"
        detail="Every identity stored on this computer. Switching changes its tabs, history, bookmarks, cookies and settings."
        action={
          <span className="rounded-full border border-[var(--devlens-hairline)] bg-[var(--devlens-tab)] px-2.5 py-1 font-mono text-[10px] text-ink-400">
            {profiles.length} local
          </span>
        }
      >
        <ul data-testid="settings-profile-list" className="flex flex-col gap-2">
          {profiles.map((profile) => {
            const active = profile.active
            return (
              <li
                key={profile.id}
                data-testid={`settings-profile-${profile.id}`}
                data-active={active ? 'true' : 'false'}
                className={[
                  'flex items-center gap-2 rounded-xl border transition-colors',
                  active
                    ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                    : 'border-[var(--devlens-hairline)] bg-white/[0.015] hover:bg-white/[0.03]'
                ].join(' ')}
              >
                <button
                  type="button"
                  disabled={busy}
                  data-testid={`settings-profile-switch-${profile.id}`}
                  aria-pressed={active}
                  onClick={() => {
                    if (!active) onSwitch(profile.id)
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    className={[
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                      active
                        ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                        : 'border-[var(--devlens-hairline)] bg-[var(--devlens-tab)] text-ink-300'
                    ].join(' ')}
                  >
                    <ProfileAvatarMark avatar={profile.avatar} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-ink-100">{profile.name}</span>
                      {!profile.removable && (
                        <span className="shrink-0 rounded border border-[var(--devlens-hairline)] px-1.5 py-0.5 text-[9px] text-ink-500">
                          Built-in
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-ink-500">
                      {active ? 'Active on this computer' : lastUsedLabel(profile.lastUsedAt)}
                    </span>
                  </span>
                  {active ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--devlens-accent-soft)] px-2 py-1 text-[10px] text-[var(--devlens-accent)]">
                      <Check size={11} />
                      Active
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] text-ink-400">Switch</span>
                  )}
                </button>
                {profile.removable && !active && (
                  <button
                    type="button"
                    aria-label={`Delete ${profile.name}`}
                    title={`Delete ${profile.name} and wipe its storage`}
                    disabled={busy}
                    onClick={() => setDeleteTarget(profile)}
                    className="mr-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {deleteTarget && (
          <div
            role="alertdialog"
            aria-label={`Delete ${deleteTarget.name}`}
            className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/[0.06] p-3"
          >
            <p className="text-[12px] text-ink-100">Delete {deleteTarget.name}?</p>
            <p className="mt-1 text-[10px] leading-5 text-ink-400">
              This permanently wipes that profile's cookies, storage, history and bookmarks.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                data-testid="settings-profile-delete-cancel"
                onClick={() => setDeleteTarget(null)}
                className="h-8 rounded-md border border-[var(--devlens-hairline)] px-3 text-[11px] text-ink-300 hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="settings-profile-delete-confirm"
                disabled={busy}
                onClick={() => {
                  onDelete(deleteTarget.id)
                  setDeleteTarget(null)
                }}
                className="h-8 rounded-md border border-rose-400/40 bg-rose-400/10 px-3 text-[11px] text-rose-200 hover:bg-rose-400/15 disabled:opacity-40"
              >
                Delete profile
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 border-t border-[var(--devlens-hairline)] pt-3">
          {adding ? (
            <div className="rounded-lg border border-[var(--devlens-hairline)] bg-[var(--devlens-tab)] p-3">
              <label className="text-[10px] text-ink-400">
                Profile name
                <input
                  autoFocus
                  value={draft}
                  data-testid="settings-profile-name"
                  spellCheck={false}
                  maxLength={32}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submit()
                  }}
                  placeholder="Work, Client A, Personal..."
                  className="mt-1.5 h-10 w-full rounded-lg border border-[var(--devlens-hairline)] bg-ink-900/70 px-3 text-[12px] text-ink-100 outline-none placeholder:text-ink-500 focus:border-[var(--devlens-accent-line)]"
                />
              </label>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5" role="group" aria-label="Profile avatar">
                  {PROFILE_AVATARS.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      aria-label={`Avatar ${entry.id}`}
                      aria-pressed={avatar === entry.id}
                      onClick={() => setAvatar(entry.id)}
                      className={[
                        'inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                        avatar === entry.id
                          ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                          : 'border-[var(--devlens-hairline)] text-ink-500 hover:text-ink-200'
                      ].join(' ')}
                    >
                      <ProfileAvatarMark avatar={entry.id} size={14} />
                    </button>
                  ))}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    data-testid="settings-profile-create-cancel"
                    onClick={() => {
                      setAdding(false)
                      setDraft('')
                    }}
                    className="h-9 rounded-lg border border-[var(--devlens-hairline)] px-3 text-[11px] text-ink-300 hover:bg-white/[0.04]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-testid="settings-profile-create"
                    disabled={busy || !draft.trim()}
                    onClick={submit}
                    className="h-9 rounded-lg border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-3.5 text-[11px] text-[var(--devlens-accent)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Create profile
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              data-testid="settings-profile-new"
              onClick={() => setAdding(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-[var(--devlens-hairline-strong)] px-3.5 text-[12px] text-ink-300 transition-colors hover:border-[var(--devlens-accent-line)] hover:text-ink-100"
            >
              <Plus size={14} />
              Add local profile
            </button>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Startup prompt"
        detail="Ask before the browser opens when more than one profile exists."
      >
        <SettingRow
          label="Ask who is using DevLens on startup"
          detail="The identity gate appears before browsing starts."
        >
          <ToggleSwitch
            checked={askOnStartup}
            testId="settings-page-ask-on-startup"
            onChange={onAskOnStartupChange}
          />
        </SettingRow>
      </SettingsCard>

      <p className="font-mono text-[10px] leading-5 text-ink-500">
        Profiles and their sessions stay on this computer. Nothing is synced or uploaded.
      </p>
    </div>
  )
}

function SettingsCard({
  title,
  detail,
  action,
  children
}: {
  title: string
  detail: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-[var(--devlens-hairline)] bg-white/[0.018]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--devlens-hairline)] px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-ink-100">{title}</h3>
          <p className="mt-1 text-[11px] leading-5 text-ink-500">{detail}</p>
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function SettingRow({
  label,
  detail,
  children
}: {
  label: string
  detail: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-1">
      <div className="min-w-0">
        <p className="text-[13px] text-ink-200">{label}</p>
        <p className="mt-1 text-[11px] leading-5 text-ink-500">{detail}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
