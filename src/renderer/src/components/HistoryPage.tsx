import { useMemo, useState } from 'react'
import { Clock, ExternalLink, Trash2 } from 'lucide-react'
import type { HistoryEntry } from '@shared/types'

interface HistoryPageProps {
  entries: HistoryEntry[]
  onOpen: (url: string, options?: { newTab?: boolean }) => void
  onClear: () => void
}

/**
 * The profile's visited pages, as the shell's own full tab surface (`devlens:history`).
 *
 * Same list as the dock's panel, but standing on its own: filter by title or address, open a row
 * in place or in a new tab, or forget the lot.
 */
export function HistoryPage({ entries, onOpen, onClear }: HistoryPageProps) {
  const [filter, setFilter] = useState('')

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    if (!needle) return entries
    return entries.filter(
      (entry) =>
        entry.url.toLowerCase().includes(needle) || entry.title.toLowerCase().includes(needle)
    )
  }, [entries, filter])

  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-y-auto bg-ink-950" data-testid="history-page">
      <div className="flex h-full w-full max-w-[720px] flex-col py-6">
        <div className="shrink-0 px-4">
          <h1 className="flex items-center gap-2 text-[15px] font-semibold text-ink-100">
            <Clock size={16} className="text-[var(--devlens-accent)]" />
            History
            <span className="ml-1 font-mono text-[10px] font-normal text-ink-600">
              {visible.length}/{entries.length}
            </span>
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              spellCheck={false}
              placeholder="Filter this profile's history"
              aria-label="Filter history"
              className="h-8 min-w-0 flex-1 rounded-md border border-[var(--devlens-hairline)] bg-ink-950/70 px-3 text-[12px] text-ink-100 outline-none placeholder:text-ink-600 focus:border-[var(--devlens-accent-line)]"
            />
            <button
              type="button"
              data-testid="history-page-clear"
              onClick={onClear}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--devlens-hairline)] px-3 text-[11px] text-ink-400 transition-colors hover:border-rose-400/40 hover:text-rose-200"
            >
              <Trash2 size={11} />
              Clear
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {visible.length === 0 ? (
            <p className="py-10 text-center font-mono text-[11px] text-ink-600">
              {entries.length === 0
                ? 'nothing visited yet in this profile'
                : 'no page matches that filter'}
            </p>
          ) : (
            visible.map((entry) => (
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
                  <Clock size={12} className="shrink-0 text-ink-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-ink-200">
                      {entry.title || entry.url}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-ink-600">
                      {entry.url}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-ink-600">
                    {entry.visitCount}x
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
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
