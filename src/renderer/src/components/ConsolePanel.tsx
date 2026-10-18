import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Trash2 } from 'lucide-react'
import type { LogEntry } from '@shared/types'
import { formatClock, formatDuration } from '@renderer/lib/format'
import { shortenUrl } from '@renderer/lib/url'
import { IconButton } from '@renderer/components/IconButton'
import type { LogCounts } from '@renderer/hooks/useLogStore'

type KindFilter = 'all' | 'console' | 'network'

interface ConsolePanelProps {
  entries: LogEntry[]
  counts: LogCounts
  onClear: () => void
  onOpenSource: (sourceUrl: string, line: number) => void
}

const FILTERS: readonly { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'console', label: 'Console' },
  { id: 'network', label: 'Network' }
]

export function ConsolePanel({ entries, counts, onClear, onOpenSource }: ConsolePanelProps) {
  const [filter, setFilter] = useState<KindFilter>('all')
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const stickToBottom = useRef(true)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return entries.filter((entry) => {
      if (filter !== 'all' && entry.kind !== filter) return false
      if (!needle) return true
      return entrySearchText(entry).includes(needle)
    })
  }, [entries, filter, query])

  useEffect(() => {
    const list = listRef.current
    if (!list || !stickToBottom.current) return
    list.scrollTop = list.scrollHeight
  }, [visible.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-3 py-2">
        <div className="flex rounded-md border border-white/10 p-0.5">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={[
                'rounded-[4px] px-2 py-0.5 text-[11px] transition-colors',
                filter === option.id
                  ? 'bg-white/10 text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-300'
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter"
          spellCheck={false}
          aria-label="Filter log entries"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-neutral-950/70 px-2 py-1 font-mono text-[11px] text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-teal-400/50"
        />
        <span className="shrink-0 font-mono text-[11px] text-neutral-600">
          {counts.errors > 0 ? `${counts.errors} failing` : `${counts.total} events`}
        </span>
        <IconButton label="Clear log" onClick={onClear} tone="danger">
          <Trash2 size={13} />
        </IconButton>
      </div>

      <div
        ref={listRef}
        onScroll={(event) => {
          const list = event.currentTarget
          stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 40
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-center text-[11px] text-neutral-600">
            Nothing captured yet.
          </p>
        ) : (
          visible.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() => setExpandedId((current) => (current === entry.id ? null : entry.id))}
              onOpenSource={onOpenSource}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface EntryRowProps {
  entry: LogEntry
  expanded: boolean
  onToggle: () => void
  onOpenSource: (sourceUrl: string, line: number) => void
}

function EntryRow({ entry, expanded, onToggle, onOpenSource }: EntryRowProps) {
  const accent = entry.kind === 'network' ? networkAccent(entry.statusCode, entry.error) : LEVEL_ACCENTS[entry.level]

  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="w-14 shrink-0 pt-px font-mono text-[10px] text-neutral-600">
          {formatClock(entry.timestamp)}
        </span>
        <span
          className={[
            'w-12 shrink-0 pt-px text-center font-mono text-[10px] uppercase',
            accent
          ].join(' ')}
        >
          {entry.kind === 'network' ? (entry.statusCode ?? 'ERR') : entry.level}
        </span>
        <span className="w-14 shrink-0 pt-px font-mono text-[10px] uppercase text-neutral-600">
          {entry.viewId}
        </span>
        <span className="min-w-0 flex-1 break-words font-mono text-[11px] leading-5 text-neutral-300">
          {entry.kind === 'network' ? `${entry.method} ${shortenUrl(entry.url, 96)}` : entry.message}
        </span>
      </button>

      {expanded && (
        <div className="space-y-1.5 border-t border-white/5 bg-neutral-950/60 px-3 py-2 font-mono text-[10px] text-neutral-500">
          {entry.kind === 'network' ? (
            <>
              <p className="break-all text-neutral-400">{entry.url}</p>
              <p>
                <span className="text-neutral-600">type </span>
                {entry.resourceType}
                <span className="ml-3 text-neutral-600">took </span>
                {formatDuration(entry.durationMs) || 'n/a'}
                {entry.error && (
                  <>
                    <span className="ml-3 text-neutral-600">error </span>
                    <span className="text-rose-300">{entry.error}</span>
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <p className="break-all text-neutral-400">{entry.sourceUrl || 'injected script'}</p>
              <div className="flex items-center gap-2">
                <span>
                  <span className="text-neutral-600">line </span>
                  {entry.line}
                </span>
                {entry.sourceUrl && (
                  <button
                    type="button"
                    onClick={() => onOpenSource(entry.sourceUrl, entry.line)}
                    className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-neutral-300 transition-colors hover:border-teal-400/40 hover:bg-teal-400/10 hover:text-teal-200"
                  >
                    <ArrowUpRight size={11} />
                    Open source
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const LEVEL_ACCENTS: Record<string, string> = {
  error: 'text-rose-300',
  warn: 'text-amber-300',
  info: 'text-sky-300',
  log: 'text-neutral-400',
  debug: 'text-neutral-500'
}

function networkAccent(statusCode: number | null, error: string | null): string {
  if (error) return 'text-rose-300'
  if (statusCode === null) return 'text-rose-300'
  return statusCode >= 500 ? 'text-rose-300' : 'text-amber-300'
}

function entrySearchText(entry: LogEntry): string {
  return entry.kind === 'network'
    ? `${entry.method} ${entry.url} ${entry.error ?? ''} ${entry.viewId}`.toLowerCase()
    : `${entry.message} ${entry.sourceUrl} ${entry.viewId}`.toLowerCase()
}
