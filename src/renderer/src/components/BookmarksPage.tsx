import { useMemo, useState } from 'react'
import { Bookmark, ExternalLink, Star, Trash2 } from 'lucide-react'
import type { BookmarkEntry, BookmarkLocation } from '@shared/types'

interface BookmarksPageProps {
  bookmarks: BookmarkEntry[]
  onOpen: (url: string, options?: { newTab?: boolean }) => void
  onRemove: (url: string) => void
}

const ROOTS: { id: BookmarkLocation; label: string }[] = [
  { id: 'toolbar', label: 'Bookmarks Toolbar' },
  { id: 'menu', label: 'Bookmarks Menu' },
  { id: 'other', label: 'Other Bookmarks' }
]

/**
 * The saved bookmarks, as the shell's own full tab surface (`devlens:bookmarks`).
 *
 * The same three roots the bar and the menu file under, read as one list: open a bookmark in
 * place or in a new tab, or take it out. Editing a bookmark's shape stays on the bar.
 */
export function BookmarksPage({ bookmarks, onOpen, onRemove }: BookmarksPageProps) {
  const [filter, setFilter] = useState('')

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    if (!needle) return bookmarks
    return bookmarks.filter(
      (entry) =>
        entry.url.toLowerCase().includes(needle) || entry.title.toLowerCase().includes(needle)
    )
  }, [bookmarks, filter])

  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-y-auto bg-ink-950" data-testid="bookmarks-page">
      <div className="flex h-full w-full max-w-[720px] flex-col py-6">
        <div className="shrink-0 px-4">
          <h1 className="flex items-center gap-2 text-[15px] font-semibold text-ink-100">
            <Star size={16} className="text-[var(--devlens-accent)]" />
            Bookmarks
            <span className="ml-1 font-mono text-[10px] font-normal text-ink-600">
              {visible.length}/{bookmarks.length}
            </span>
          </h1>
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            spellCheck={false}
            placeholder="Filter your bookmarks"
            aria-label="Filter bookmarks"
            className="mt-3 h-8 w-full rounded-md border border-[var(--devlens-hairline)] bg-ink-950/70 px-3 text-[12px] text-ink-100 outline-none placeholder:text-ink-600 focus:border-[var(--devlens-accent-line)]"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {visible.length === 0 ? (
            <p className="py-10 text-center font-mono text-[11px] text-ink-600">
              {bookmarks.length === 0 ? 'no bookmarks saved in this profile yet' : 'no bookmark matches that filter'}
            </p>
          ) : (
            ROOTS.map((root) => {
              const inRoot = visible.filter((entry) => entry.location === root.id)
              if (inRoot.length === 0) return null
              return (
                <section key={root.id} className="mt-3">
                  <h2 className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                    <Bookmark size={10} />
                    {root.label}
                  </h2>
                  {inRoot.map((entry) => (
                    <div
                      key={entry.url}
                      className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-white/[0.04]"
                    >
                      <button
                        type="button"
                        title={entry.url}
                        onClick={(event) =>
                          onOpen(entry.url, { newTab: event.altKey || event.ctrlKey || event.metaKey })
                        }
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <Bookmark size={12} className="shrink-0 text-ink-600" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] text-ink-200">
                            {entry.title || entry.url}
                          </span>
                          <span className="block truncate font-mono text-[10px] text-ink-600">
                            {entry.url}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Open ${entry.title || entry.url} in a new tab`}
                        title="Open in a new tab"
                        onClick={() => onOpen(entry.url, { newTab: true })}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-600 opacity-0 transition-colors group-hover:opacity-100 hover:bg-white/10 hover:text-ink-200"
                      >
                        <ExternalLink size={12} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${entry.title || entry.url}`}
                        title="Remove this bookmark"
                        onClick={() => onRemove(entry.url)}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-600 opacity-0 transition-colors group-hover:opacity-100 hover:bg-rose-400/10 hover:text-rose-200"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </section>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
