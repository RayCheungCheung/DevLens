import { useEffect, useRef, useState } from 'react'
import { Check, Plus, Trash2, UserRound, X } from 'lucide-react'
import type { BrowserProfile } from '@shared/types'

interface ProfileSwitcherProps {
  profiles: BrowserProfile[]
  busy: boolean
  onSwitch: (id: string) => void
  onCreate: (name: string) => void
  onDelete: (id: string) => void
  onNotice: (message: string) => void
  /**
   * A counter the parent bumps to open the profile popover programmatically -
   * e.g. from the main menu's identity row. Zero (or omitted) never opens it.
   */
  openSignal?: number
}

/**
 * Profile identity manager.
 *
 * Each profile is a persistent Electron partition, so cookies, localStorage, IndexedDB and
 * cached sessions belong to one identity and never mix. Switching remounts the viewports on
 * the new partition, which is why it takes effect without restarting anything.
 */
export function ProfileSwitcher({
  profiles,
  busy,
  onSwitch,
  onCreate,
  onDelete,
  onNotice,
  openSignal
}: ProfileSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)

  const active = profiles.find((profile) => profile.active) ?? profiles[0]

  useEffect(() => {
    if (!open) return
    const onDocumentPointerDown = (event: MouseEvent): void => {
      if (containerRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentPointerDown)
    return () => document.removeEventListener('mousedown', onDocumentPointerDown)
  }, [open])

  /** The parent's "open the menu for me" signal; a new non-zero value wins. */
  useEffect(() => {
    if (openSignal) setOpen(true)
  }, [openSignal])

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Browser profiles"
        aria-expanded={open}
        title={`Profile: ${active?.name ?? 'none'} - cookies and storage are isolated per profile`}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[12px] text-neutral-200 transition-colors hover:border-teal-400/40 hover:bg-teal-400/10"
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-400/20 font-mono text-[9px] uppercase text-teal-100">
          {(active?.name ?? '?').slice(0, 1)}
        </span>
        <span className="max-w-[90px] truncate">{active?.name ?? 'Profile'}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-72 rounded-lg border border-white/10 bg-neutral-900/98 p-2 shadow-2xl backdrop-blur">
          <p className="px-1 pb-1.5 text-[10px] uppercase tracking-wide text-neutral-600">
            Profiles
          </p>

          <ul className="max-h-56 space-y-0.5 overflow-y-auto">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <div
                  className={[
                    'flex items-center gap-1.5 rounded px-1.5 py-1',
                    profile.active ? 'bg-teal-400/10' : 'hover:bg-white/[0.04]'
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!profile.active) onSwitch(profile.id)
                      setOpen(false)
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {profile.active ? (
                      <Check size={12} className="shrink-0 text-teal-300" />
                    ) : (
                      <UserRound size={12} className="shrink-0 text-neutral-500" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] text-neutral-200">{profile.name}</span>
                      <span className="block truncate font-mono text-[9px] text-neutral-600">
                        {profile.partition}
                      </span>
                    </span>
                  </button>

                  {profile.removable && !profile.active && (
                    <button
                      type="button"
                      title={`Delete ${profile.name} and wipe its storage`}
                      aria-label={`Delete ${profile.name}`}
                      onClick={() => onDelete(profile.id)}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-600 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-center gap-1 border-t border-white/5 pt-2">
            <input
              value={draft}
              spellCheck={false}
              aria-label="New profile name"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                const name = draft.trim()
                if (!name) return
                onCreate(name)
                setDraft('')
                setOpen(false)
              }}
              placeholder="Work, Client A, Personal..."
              className="h-7 min-w-0 flex-1 rounded border border-white/10 bg-neutral-950/70 px-2 text-[11px] text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-teal-400/50"
            />
            <button
              type="button"
              disabled={!draft.trim() || busy}
              onClick={() => {
                onCreate(draft.trim())
                setDraft('')
                setOpen(false)
                onNotice('profile created')
              }}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded border border-teal-400/40 bg-teal-400/10 px-2 text-[10px] text-teal-100 transition-colors hover:bg-teal-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-neutral-600"
            >
              <Plus size={10} />
              New
            </button>
          </div>

          <p className="mt-1.5 px-1 font-mono text-[9px] leading-4 text-neutral-600">
            Each profile keeps its own cookies, local storage and sessions. Deleting a profile
            wipes its storage.
          </p>

          <button
            type="button"
            aria-label="Close profile menu"
            onClick={() => setOpen(false)}
            className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded text-neutral-600 transition-colors hover:bg-white/5 hover:text-neutral-300"
          >
            <X size={10} />
          </button>
        </div>
      )}
    </div>
  )
}
