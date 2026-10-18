import { useMemo, useState } from 'react'
import { Clock, ExternalLink, History, Trash2 } from 'lucide-react'
import type { HistoryEntry } from '@shared/types'

interface HistoryPanelProps {
  entries: HistoryEntry[]
  onOpen: (url: string, options?: { newTab?: boolean }) => void
  onClear: () => void
}

/**
 * History.
 *
 * A browser surface rather than a developer one, which is why it sits in the everyday half of the
 * dock. The list is the profile's own store, newest first, and the filter matches titles as well
 * as addresses because "that article about indexes" is how people look for a page.
 */
export function HistoryPanel({ entries, onOpen, onClear }: HistoryPanelProps) {
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
    <div className="flex min-h-0 flex-1 flex-col" data-testid="history-panel">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--devlens-hairline)] px-3 py-2">
        <History size={13} className="shrink-0 text-[var(--devlens-accent)]" />
        <input
          value={filter}
          spellCheck={false}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter this profile's history"
          aria-label="Filter history"
          className="h-6 min-w-0 flex-1 rounded border border-[var(--devlens-hairline)] bg-ink-950/70 px-2 text-[11px] text-ink-100 outline-none placeholder:text-ink-600 focus:border-[var(--devlens-accent-line)]"
        />
        <span className="shrink-0 font-mono text-[10px] text-ink-600">
          {visible.length}/{entries.length}
        </span>
        <button
          type="button"
          aria-label="Clear browsing history"
          title="Forget every page in this profile's history"
          onClick={onClear}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[var(--devlens-hairline)] text-ink-500 transition-colors hover:border-rose-400/40 hover:text-rose-200"
        >
          <Trash2 size={11} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-center font-mono text-[10px] text-ink-600">
            {entries.length === 0 ? 'nothing visited yet in this profile' : 'no page matches that filter'}
          </p>
        ) : (
          visible.map((entry) => (
            <div
              key={entry.url}
              data-testid="history-row"
              data-url={entry.url}
              className="group flex w-full min-w-0 items-center gap-2 px-3 py-1.5 transition-colors hover:bg-white/[0.04]"
            >
              <button
                type="button"
                title={entry.url}
                onClick={(event) =>
                  onOpen(entry.url, { newTab: event.altKey || event.ctrlKey || event.metaKey })
                }
                onAuxClick={(event) => {
                  if (event.button !== 1) return
                  event.preventDefault()
                  onOpen(entry.url, { newTab: true })
                }}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <Clock size={11} className="shrink-0 text-ink-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] text-ink-200">
                    {entry.title || entry.url}
                  </span>
                  <span className="block truncate font-mono text-[9px] text-ink-600">
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
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-600 opacity-0 transition-colors group-hover:opacity-100 hover:bg-white/10 hover:text-ink-200"
              >
                <ExternalLink size={11} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
