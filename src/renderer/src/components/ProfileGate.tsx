import { useState } from 'react'
import {
  Briefcase,
  FlaskConical,
  Ghost,
  Laptop,
  Plus,
  ShieldCheck,
  Star,
  User
} from 'lucide-react'
import type { BrowserProfile, ProfileAvatar } from '@shared/types'

interface ProfileGateProps {
  profiles: BrowserProfile[]
  /** True while a switch or a create is in flight. */
  busy: boolean
  askOnStartup: boolean
  onSelect: (id: string) => void
  onCreate: (name: string, avatar: ProfileAvatar) => void
  onAskOnStartupChange: (ask: boolean) => void
}

const AVATARS: { id: ProfileAvatar; icon: typeof User }[] = [
  { id: 'user', icon: User },
  { id: 'briefcase', icon: Briefcase },
  { id: 'laptop', icon: Laptop },
  { id: 'flask', icon: FlaskConical },
  { id: 'shield', icon: ShieldCheck },
  { id: 'ghost', icon: Ghost },
  { id: 'star', icon: Star }
]

function avatarIcon(profile: BrowserProfile): typeof User {
  return AVATARS.find((entry) => entry.id === profile.avatar)?.icon ?? User
}

/** "2 minutes ago", "yesterday" - enough to pick the identity you used last. */
function lastUsedLabel(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 90) return 'last used just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `last used ${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `last used ${hours}h ago`
  return `last used ${Math.round(hours / 24)}d ago`
}

/**
 * "Who is using DevLens?"
 *
 * Shown before the browser shell when the registry holds more than one identity, so a shared
 * machine never opens somebody else's session by default. Picking a profile binds the session,
 * the storage directory and the tab set to that identity; nothing is shared between them.
 */
export function ProfileGate({
  profiles,
  busy,
  askOnStartup,
  onSelect,
  onCreate,
  onAskOnStartupChange
}: ProfileGateProps) {
  const [draft, setDraft] = useState('')
  const [avatar, setAvatar] = useState<ProfileAvatar>('user')
  const [adding, setAdding] = useState(profiles.length === 0)

  const submit = (): void => {
    const name = draft.trim()
    if (!name) return
    onCreate(name, avatar)
    setDraft('')
    setAvatar('user')
  }

  return (
    <div
      data-testid="profile-gate"
      className="flex h-full w-full items-center justify-center bg-ink-950 px-6 py-10"
    >
      <div className="w-full max-w-3xl">
        <header className="mb-6 text-center">
          <h1 className="text-[22px] leading-7 font-medium tracking-tight text-ink-100">
            Who is using DevLens?
          </h1>
          <p className="mt-1.5 text-[12px] text-ink-500">
            Each profile keeps its own tabs, history, bookmarks, cookies and storage.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {profiles.map((profile) => {
            const Icon = avatarIcon(profile)
            return (
              <button
                key={profile.id}
                type="button"
                data-testid={`profile-card-${profile.id}`}
                data-profile-name={profile.name}
                disabled={busy}
                onClick={() => onSelect(profile.id)}
                className={[
                  'flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                  profile.active
                    ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                    : 'border-[var(--devlens-hairline)] bg-white/[0.02] hover:border-[var(--devlens-accent-line)] hover:bg-white/[0.05]'
                ].join(' ')}
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--devlens-hairline)] bg-ink-850 text-ink-200">
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] text-ink-100">{profile.name}</span>
                  <span className="block truncate font-mono text-[10px] text-ink-500">
                    {lastUsedLabel(profile.lastUsedAt)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {adding ? (
          <div className="mt-3 rounded-xl border border-[var(--devlens-hairline)] bg-white/[0.02] px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submit()
                }}
                placeholder="Profile name"
                aria-label="New profile name"
                spellCheck={false}
                className="h-8 min-w-0 flex-1 rounded-md border border-[var(--devlens-hairline)] bg-ink-900/70 px-2 text-[12px] text-ink-100 outline-none placeholder:text-ink-500"
              />
              <button
                type="button"
                aria-label="Create profile"
                disabled={busy || draft.trim().length === 0}
                onClick={submit}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-2.5 text-[11px] text-[var(--devlens-accent)] disabled:opacity-40"
              >
                <Plus size={12} />
                Create
              </button>
              <button
                type="button"
                aria-label="Cancel new profile"
                onClick={() => setAdding(false)}
                className="inline-flex h-8 shrink-0 items-center rounded-md border border-[var(--devlens-hairline)] px-2.5 text-[11px] text-ink-400 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1.5" role="group" aria-label="Avatar">
              {AVATARS.map((entry) => {
                const Icon = entry.icon
                const active = entry.id === avatar
                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-label={`Avatar ${entry.id}`}
                    aria-pressed={active}
                    onClick={() => setAvatar(entry.id)}
                    className={[
                      'inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors',
                      active
                        ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                        : 'border-[var(--devlens-hairline)] text-ink-500 hover:text-ink-200'
                    ].join(' ')}
                  >
                    <Icon size={13} />
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Add profile"
            onClick={() => setAdding(true)}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl border border-dashed border-[var(--devlens-hairline-strong)] px-3 text-[12px] text-ink-300 transition-colors hover:border-[var(--devlens-accent-line)] hover:text-ink-100"
          >
            <Plus size={13} />
            Add profile
          </button>
        )}

        <label className="mt-6 flex items-center gap-2 text-[11px] text-ink-400">
          <input
            type="checkbox"
            aria-label="Always ask on startup"
            checked={askOnStartup}
            onChange={(event) => onAskOnStartupChange(event.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--devlens-accent)]"
          />
          Always ask on startup
        </label>
      </div>
    </div>
  )
}
