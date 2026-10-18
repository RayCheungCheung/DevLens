import { Loader2, RefreshCw, Server } from 'lucide-react'
import type { LocalServer } from '@shared/types'
import { Widget, WidgetAction } from '@renderer/components/dashboard/Widget'

interface ServersWidgetProps {
  servers: LocalServer[]
  scanning: boolean
  ghostActive: boolean
  onScan: () => void
  onOpenUrl: (url: string, options?: { newTab?: boolean }) => void
}

/**
 * Local servers.
 *
 * The one widget that is a *browser* utility rather than developer tooling, which is why it stays
 * in both modes: knowing your own dev server is up, and opening it, is useful whether or not the
 * developer panels are available. A server that answered is a chip; the rest of the probe list is
 * not repeated here, because a dashboard full of ports nobody started is noise.
 */
export function ServersWidget({
  servers,
  scanning,
  ghostActive,
  onScan,
  onOpenUrl
}: ServersWidgetProps) {
  const reachable = servers.filter((server) => server.reachable)

  return (
    <Widget
      icon={Server}
      title="Local servers"
      note={`${reachable.length} reachable${ghostActive ? ' - ghost session active' : ''}`}
      action={
        <WidgetAction label="Rescan local servers" onClick={onScan} disabled={scanning}>
          {scanning ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          rescan
        </WidgetAction>
      }
    >
      {reachable.length === 0 ? (
        <p className="rounded border border-dashed border-[var(--devlens-hairline)] px-3 py-4 text-center font-mono text-[10px] text-ink-600">
          {scanning ? 'probing local ports...' : 'nothing answered on the usual dev ports'}
        </p>
      ) : (
        /* Every reachable server, not a slice: a dashboard that hides the port you are looking
           for is worse than one with a scrollbar, and the scroll keeps the card from growing
           with whatever the machine happens to be running. */
        <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pr-0.5">
          {reachable.map((server) => (
            <button
              key={server.url}
              type="button"
              onClick={(event) =>
                onOpenUrl(server.url, {
                  newTab: event.altKey || event.ctrlKey || event.metaKey
                })
              }
              onAuxClick={(event) => {
                if (event.button === 1) onOpenUrl(server.url, { newTab: true })
              }}
              title={`Open ${server.url} in both viewports`}
              className="nova-card nova-card--interactive flex min-w-0 flex-col items-start gap-0.5 px-2.5 py-1.5 text-left"
            >
              <span className="flex w-full items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-200">
                  :{server.port}
                </span>
                {server.status !== null && (
                  <span className="shrink-0 font-mono text-[9px] text-ink-600">{server.status}</span>
                )}
              </span>
              <span className="w-full truncate text-[10px] text-ink-400">
                {server.title ?? server.service ?? server.label}
              </span>
              <span className="w-full truncate font-mono text-[9px] tracking-wide text-ink-600 uppercase">
                {server.service ?? 'http'}
              </span>
            </button>
          ))}
        </div>
      )}
    </Widget>
  )
}
