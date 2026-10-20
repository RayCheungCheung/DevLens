import { useEffect, useRef, useState } from 'react'
import { Bookmark, Trash2, X } from 'lucide-react'
import type { BookmarkEntry, BookmarkLocation } from '@shared/types'
import { SelectMenu } from '@renderer/components/SelectMenu'

interface AddBookmarkModalProps {
  /** The page being saved: its address is fixed, its name and place are not. */
  page: { url: string; title: string }
  /** The entry already saved at that address, when the editor was opened to change it. */
  existing: BookmarkEntry | null
  /**
   * Everywhere a page can be filed: the three roots, plus the folders on the bar and inside them.
   * A location is a root id or a folder id, which is what lets the editor say "into Dev stuff"
   * rather than only "onto the toolbar".
   */
  locations?: { id: string; label: string }[]
  /** Where the editor last filed something, so the dropdown defaults to it. */
  lastLocation: BookmarkLocation
  /** `showEditor` carries the checkbox back, so the next star click knows what to do. */
  onSave: (
    values: { url: string; title: string; location: string },
    options: { showEditor: boolean }
  ) => void
  onRemove: (url: string) => void
  onCancel: () => void
}

/** The three roots, always offered, always in this order. */
const ROOT_LOCATIONS: { id: BookmarkLocation; label: string }[] = [
  { id: 'toolbar', label: 'Bookmarks Toolbar' },
  { id: 'menu', label: 'Bookmarks Menu' },
  { id: 'other', label: 'Other Bookmarks' }
]

/**
 * Firefox's "Add bookmark" editor.
 *
 * The name is prefilled with the page title and the place with wherever the last bookmark went,
 * which is exactly what makes saving a one-click affair while still letting the operator fix
 * either. The "show editor when saving" switch lives here because this panel is what it governs.
 */
export function AddBookmarkModal({
  page,
  existing,
  locations = ROOT_LOCATIONS,
  lastLocation,
  onSave,
  onRemove,
  onCancel
}: AddBookmarkModalProps) {
  const [title, setTitle] = useState(existing?.title ?? page.title ?? '')
  /**
   * The dropdown value is the root id or the folder id. An entry saved before the bar had
   * folders only carries its root, which is one of the options anyway.
   */
  const [location, setLocation] = useState<string>(existing?.folderId ?? existing?.location ?? lastLocation)
  const [showEditor, setShowEditor] = useState(true)
  const nameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCancel()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        onSave({ url: page.url, title: title.trim() || page.url, location }, { showEditor })
      }
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-testid="add-bookmark-modal"]') || target?.closest('[data-bookmark-trigger]')) {
        return
      }
      onCancel()
    }
    window.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [location, onCancel, onSave, page.url, showEditor, title])

  return (
    <div
      role="dialog"
      aria-label={existing ? 'Edit bookmark' : 'Add bookmark'}
      data-testid="add-bookmark-modal"
      className="absolute top-[calc(100%+8px)] right-3 z-[70] w-[320px] overflow-hidden rounded-xl border border-[var(--devlens-hairline)] bg-[color-mix(in_srgb,var(--color-ink-950)_97%,transparent)] shadow-2xl"
    >
      <header className="flex items-center gap-2 border-b border-[var(--devlens-hairline)] px-3 py-2">
        <Bookmark size={13} className="shrink-0 text-[var(--devlens-accent)]" />
        <span className="min-w-0 flex-1 text-[12px] text-ink-100">
          {existing ? 'Edit bookmark' : 'Add bookmark'}
        </span>
        <button
          type="button"
          aria-label="Close bookmark editor"
          onClick={onCancel}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-500 transition-colors hover:bg-white/5 hover:text-ink-200"
        >
          <X size={12} />
        </button>
      </header>

      <div className="space-y-2 px-3 py-2.5">
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] tracking-wide text-ink-500 uppercase">Name</span>
          <input
            ref={nameRef}
            data-testid="bookmark-name"
            value={title}
            aria-label="Bookmark name"
            spellCheck={false}
            onChange={(event) => setTitle(event.target.value)}
            className="h-7 w-full rounded-md border border-[var(--devlens-hairline)] bg-ink-900/70 px-2 text-[11px] text-ink-100 outline-none focus:border-[var(--devlens-accent-line)]"
          />
        </label>

        <label className="block">
          <span className="mb-1 block font-mono text-[10px] tracking-wide text-ink-500 uppercase">
            Location
          </span>
          <SelectMenu
            ariaLabel="Bookmark location"
            testId="bookmark-location"
            value={location}
            onChange={setLocation}
            size="sm"
            className="w-full"
            menuWidth={220}
            sections={[
              {
                options: locations.map((entry) => ({
                  value: entry.id,
                  label: entry.label
                }))
              }
            ]}
          />
        </label>

        <p data-testid="bookmark-url" className="truncate font-mono text-[10px] text-ink-500" title={page.url}>
          {page.url}
        </p>

        <label className="flex items-center gap-2 pt-0.5 text-[11px] text-ink-400">
          <input
            type="checkbox"
            data-testid="bookmark-show-editor"
            aria-label="Show editor when saving"
            checked={showEditor}
            onChange={(event) => setShowEditor(event.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--devlens-accent)]"
          />
          Show editor when saving
        </label>
      </div>

      <footer className="flex items-center gap-2 border-t border-[var(--devlens-hairline)] px-3 py-2">
        <button
          type="button"
          data-testid="bookmark-save"
          aria-label="Save bookmark"
          onClick={() =>
            onSave({ url: page.url, title: title.trim() || page.url, location }, { showEditor })
          }
          className="inline-flex h-7 items-center rounded-md border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-2.5 text-[11px] text-[var(--devlens-accent)]"
        >
          Save
        </button>
        <button
          type="button"
          data-testid="bookmark-cancel"
          aria-label="Cancel bookmark"
          onClick={onCancel}
          className="inline-flex h-7 items-center rounded-md border border-[var(--devlens-hairline)] px-2.5 text-[11px] text-ink-300 hover:bg-white/5"
        >
          Cancel
        </button>
        {existing && (
          <button
            type="button"
            data-testid="bookmark-remove"
            aria-label="Remove bookmark"
            onClick={() => onRemove(page.url)}
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-[var(--devlens-hairline)] px-2 text-[11px] text-ink-400 hover:border-rose-400/40 hover:text-rose-200"
          >
            <Trash2 size={11} />
            Remove
          </button>
        )}
      </footer>
    </div>
  )
}
