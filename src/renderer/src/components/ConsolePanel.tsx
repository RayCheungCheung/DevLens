import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Loader2, Play, Trash2 } from 'lucide-react'
import type { ConsoleLevel, LogEntry } from '@shared/types'
import { formatClock, formatDuration } from '@renderer/lib/format'
import { shortenUrl } from '@renderer/lib/url'
import { IconButton } from '@renderer/components/IconButton'
import type { LogCounts } from '@renderer/hooks/useLogStore'

type KindFilter = 'all' | 'console' | 'network'
type LevelFilter = 'all' | ConsoleLevel

interface ConsolePanelProps {
  entries: LogEntry[]
  counts: LogCounts
  guestId: number | null
  onClear: () => void
  onOpenSource: (sourceUrl: string, line: number) => void
}

const FILTERS: readonly { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'console', label: 'Console' },
  { id: 'network', label: 'Network' }
]

const LEVELS: readonly LevelFilter[] = ['all', 'error', 'warn', 'info', 'log', 'debug']

interface CommandResult {
  id: string
  expression: string
  output: string
  error: boolean
  timestamp: number
}

export function ConsolePanel({
  entries,
  counts,
  guestId,
  onClear,
  onOpenSource
}: ConsolePanelProps) {
  const [filter, setFilter] = useState<KindFilter>('all')
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [command, setCommand] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<CommandResult[]>([])
  const listRef = useRef<HTMLDivElement | null>(null)
  const stickToBottom = useRef(true)
  const historyIndex = useRef(-1)

  useEffect(
    () => () => {
      if (guestId) void window.devlens.guestDebuggerDetach(guestId)
    },
    [guestId]
  )

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return entries.filter((entry) => {
      if (filter !== 'all' && entry.kind !== filter) return false
      if (
        levelFilter !== 'all' &&
        (entry.kind !== 'console' || entry.level !== levelFilter)
      ) {
        return false
      }
      if (!needle) return true
      return entrySearchText(entry).includes(needle)
    })
  }, [entries, filter, levelFilter, query])

  useEffect(() => {
    const list = listRef.current
    if (!list || !stickToBottom.current) return
    list.scrollTop = list.scrollHeight
  }, [visible.length])

  const execute = async (expression = command): Promise<void> => {
    const source = expression.trim()
    if (!source || !guestId || running) return
    setRunning(true)
    setCommandHistory((current) =>
      current[current.length - 1] === source ? current : [...current, source].slice(-100)
    )
    historyIndex.current = -1

    const response = await window.devlens.guestDebuggerSend({
      webContentsId: guestId,
      method: 'Runtime.evaluate',
      params: {
        expression: source,
        includeCommandLineAPI: true,
        awaitPromise: true,
        returnByValue: true,
        generatePreview: true,
        userGesture: true,
        replMode: true
      }
    })

    const outcome = describeEvaluation(response)
    setResults((current) =>
      [
        ...current,
        {
          id: `command-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
          expression: source,
          output: outcome.output,
          error: outcome.error,
          timestamp: Date.now()
        }
      ].slice(-100)
    )
    setCommand('')
    setRunning(false)
  }

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
        <select
          value={levelFilter}
          onChange={(event) => setLevelFilter(event.target.value as LevelFilter)}
          aria-label="Filter console level"
          className="h-7 shrink-0 rounded-md border border-white/10 bg-neutral-950/70 px-1.5 font-mono text-[10px] text-neutral-300 outline-none focus:border-teal-400/50"
        >
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
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

      <div className="shrink-0 border-t border-white/10 bg-neutral-950/75">
        {results.length > 0 && (
          <div className="max-h-36 overflow-y-auto border-b border-white/5 px-3 py-1.5">
            {results.map((result) => (
              <div key={result.id} className="border-b border-white/5 py-1 last:border-b-0">
                <p className="break-all font-mono text-[10px] text-teal-300">
                  <span className="mr-1 text-neutral-600">›</span>
                  {result.expression}
                </p>
                <pre
                  className={[
                    'mt-0.5 whitespace-pre-wrap break-all pl-3 font-mono text-[10px] leading-4',
                    result.error ? 'text-rose-300' : 'text-neutral-300'
                  ].join(' ')}
                >
                  {result.output}
                </pre>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start gap-1.5 px-3 py-2">
          <span className="pt-1.5 font-mono text-[12px] text-[var(--devlens-accent)]">›</span>
          <textarea
            value={command}
            rows={1}
            disabled={!guestId || running}
            spellCheck={false}
            aria-label="JavaScript console command"
            placeholder={guestId ? 'Evaluate JavaScript in the active viewport' : 'Open a web page first'}
            onChange={(event) => {
              historyIndex.current = -1
              setCommand(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void execute()
                return
              }
              if (event.key === 'ArrowUp' && commandHistory.length > 0) {
                event.preventDefault()
                const next =
                  historyIndex.current < 0
                    ? commandHistory.length - 1
                    : Math.max(0, historyIndex.current - 1)
                historyIndex.current = next
                setCommand(commandHistory[next] ?? '')
                return
              }
              if (event.key === 'ArrowDown' && historyIndex.current >= 0) {
                event.preventDefault()
                const next = historyIndex.current + 1
                if (next >= commandHistory.length) {
                  historyIndex.current = -1
                  setCommand('')
                } else {
                  historyIndex.current = next
                  setCommand(commandHistory[next] ?? '')
                }
              }
            }}
            className="min-h-7 min-w-0 flex-1 resize-y rounded border border-white/10 bg-black/30 px-2 py-1 font-mono text-[11px] leading-5 text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-teal-400/50 disabled:opacity-50"
          />
          <button
            type="button"
            aria-label="Run console expression"
            disabled={!guestId || running || command.trim().length === 0}
            onClick={() => void execute()}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-2 text-[10px] text-[var(--devlens-accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={10} />}
            run
          </button>
          {results.length > 0 && (
            <button
              type="button"
              onClick={() => setResults([])}
              className="inline-flex h-7 shrink-0 items-center rounded border border-white/10 px-2 text-[10px] text-neutral-400 hover:bg-white/5"
            >
              clear results
            </button>
          )}
        </div>
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

function describeEvaluation(response: {
  ok: boolean
  result: unknown
  error: string | null
}): { output: string; error: boolean } {
  if (!response.ok) return { output: response.error ?? 'evaluation failed', error: true }

  const payload = asRecord(response.result)
  const exception = asRecord(payload?.exceptionDetails)
  if (exception) {
    const thrown = asRecord(exception.exception)
    return {
      output:
        stringValue(thrown?.description) ||
        stringValue(exception.text) ||
        'Uncaught exception',
      error: true
    }
  }

  const remote = asRecord(payload?.result)
  if (!remote) return { output: 'undefined', error: false }
  if ('value' in remote) return { output: formatValue(remote.value), error: false }
  if (typeof remote.unserializableValue === 'string') {
    return { output: remote.unserializableValue, error: false }
  }
  if (typeof remote.description === 'string') return { output: remote.description, error: false }
  return { output: String(remote.type ?? 'undefined'), error: false }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined) return 'undefined'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
