import { Code2, ExternalLink, Loader2, RefreshCw, Server } from 'lucide-react'
import type { LocalServer } from '@shared/types'

interface ServersPanelProps {
  servers: LocalServer[]
  scanning: boolean
  /** The click-to-source root: what "open in the editor" would open. */
  workspaceRoot: string | null
  onScan: () => void
  onOpen: (url: string, options?: { newTab?: boolean }) => void
  onOpenInIde: () => void
}

/**
 * Local dev servers.
 *
 * The scanner from the front page, as a panel: every port that answered, with the service it
 * looked like and the page title it sent back, plus the one-row jump into the editor for the
 * workspace that owns it. Unreachable probes are listed too - a port that is *down* is the more
 * common thing to be looking for.
 */
export function ServersPanel({
  servers,
  scanning,
  workspaceRoot,
  onScan,
  onOpen,
  onOpenInIde
}: ServersPanelProps) {
  const reachable = servers.filter((server) => server.reachable)

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="servers-panel">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--devlens-hairline)] px-3 py-2">
        <Server size={13} className="shrink-0 text-[var(--devlens-accent)]" />
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-500">
          {reachable.length} reachable / {servers.length} probed
        </span>
        <button
          type="button"
          aria-label="Rescan local servers"
          onClick={onScan}
          disabled={scanning}
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded border border-[var(--devlens-hairline)] px-2 text-[10px] text-ink-400 transition-colors hover:border-[var(--devlens-accent-line)] hover:text-ink-100 disabled:opacity-40"
        >
          {scanning ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
          rescan
        </button>
      </div>

      {workspaceRoot && (
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--devlens-hairline)] px-3 py-1.5">
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-600" title={workspaceRoot}>
            {workspaceRoot}
          </span>
          <button
            type="button"
            aria-label="Open the active workspace in the editor"
            onClick={onOpenInIde}
            className="inline-flex h-6 shrink-0 items-center gap-1 rounded border border-[var(--devlens-hairline)] px-1.5 text-[10px] text-ink-300 transition-colors hover:border-[var(--devlens-accent-line)] hover:text-ink-100"
          >
            <Code2 size={10} />
            IDE
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {servers.length === 0 ? (
          <p className="px-3 py-6 text-center font-mono text-[10px] text-ink-600">
            probing the usual dev ports...
          </p>
        ) : (
          servers.map((server) => (
            <div
              key={server.url}
              data-testid="server-row"
              data-port={server.port}
              data-reachable={server.reachable ? 'true' : 'false'}
              className="group flex min-w-0 items-center gap-2 px-3 py-1.5 transition-colors hover:bg-white/[0.04]"
            >
              <span
                aria-hidden="true"
                className={[
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  server.reachable ? 'bg-teal-400' : 'bg-ink-700'
                ].join(' ')}
              />
              <button
                type="button"
                title={server.reachable ? `Open ${server.url}` : `${server.url} did not answer`}
                disabled={!server.reachable}
                onClick={(event) =>
                  onOpen(server.url, { newTab: event.altKey || event.ctrlKey || event.metaKey })
                }
                className="flex min-w-0 flex-1 flex-col items-start text-left disabled:cursor-not-allowed"
              >
                <span className="flex w-full items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-200">
                    :{server.port}
                  </span>
                  {server.status !== null && (
                    <span className="shrink-0 font-mono text-[9px] text-ink-600">
                      {server.status}
                    </span>
                  )}
                </span>
                <span className="w-full truncate text-[10px] text-ink-400">
                  {server.title ?? (server.reachable ? server.url : 'no answer')}
                </span>
                <span className="w-full truncate font-mono text-[9px] tracking-wide text-ink-600 uppercase">
                  {server.service ?? 'http'}
                  {server.pinned ? ' - pinned' : ''}
                </span>
              </button>
              {server.reachable && (
                <button
                  type="button"
                  aria-label={`Open ${server.url} in a new tab`}
                  onClick={() => onOpen(server.url, { newTab: true })}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-600 opacity-0 transition-colors group-hover:opacity-100 hover:bg-white/10 hover:text-ink-200"
                >
                  <ExternalLink size={11} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
