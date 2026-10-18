import { useCallback, useEffect, useState } from 'react'
import type { ConsoleLogEntry, LogEntry, NetworkEntry } from '@shared/types'

const MAX_ENTRIES = 400

export interface LogCounts {
  total: number
  console: number
  network: number
  errors: number
}

export interface LogStore {
  /** Oldest first, so the list reads top-to-bottom like a browser console. */
  entries: LogEntry[]
  counts: LogCounts
  clear: () => void
}

/**
 * Subscribes to the log streams the main process pushes over IPC.
 *
 * `enabled` exists for normal mode: nothing is collected in the background there, so the
 * subscription is only live while the WImH overlay is open and has borrowed the pipeline.
 */
export function useLogStore(enabled = true): LogStore {
  const [entries, setEntries] = useState<LogEntry[]>([])

  useEffect(() => {
    if (!enabled) return

    const append = (entry: LogEntry): void =>
      setEntries((previous) => {
        const next = previous.length >= MAX_ENTRIES ? previous.slice(-MAX_ENTRIES + 1) : previous
        return [...next, entry]
      })

    const offConsole = window.devlens.onConsoleLog((entry: ConsoleLogEntry) => append(entry))
    const offNetwork = window.devlens.onNetworkEntry((entry: NetworkEntry) => append(entry))

    return () => {
      offConsole()
      offNetwork()
    }
  }, [enabled])

  const clear = useCallback(() => setEntries([]), [])

  const counts: LogCounts = {
    total: entries.length,
    console: entries.filter((entry) => entry.kind === 'console').length,
    network: entries.filter((entry) => entry.kind === 'network').length,
    errors: entries.filter(
      (entry) =>
        (entry.kind === 'console' && entry.level === 'error') || entry.kind === 'network'
    ).length
  }

  return { entries, counts, clear }
}
