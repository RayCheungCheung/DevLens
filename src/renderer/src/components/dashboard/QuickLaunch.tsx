import { useState } from 'react'
import { Globe, Plus } from 'lucide-react'
import { iconFor, useFavicons } from '@renderer/components/dashboard/useFavicons'

export interface Shortcut {
  url: string
  title: string
  /** Set for a bookmark, which is drawn with a hairline ring so the two lists stay legible. */
  saved?: boolean
}

interface QuickLaunchProps {
  shortcuts: Shortcut[]
  onOpenUrl: (url: string, options?: { newTab?: boolean }) => void
  /** The `+` tile's action: fill the field so a new address can be typed. */
  onFocusField: () => void
}

/** A tile's leading glyph: the site's icon, or the first letter of its host. */
function TileIcon({ icon, host }: { icon: string | undefined | null; host: string }) {
  const [broken, setBroken] = useState(false)
  if (icon && !broken) {
    return (
      <img
        data-testid="shortcut-favicon"
        src={icon}
        alt=""
        aria-hidden="true"
        draggable={false}
        onError={() => setBroken(true)}
        className="h-6 w-6 shrink-0 rounded object-contain"
      />
    )
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white/[0.06] font-mono text-[12px] text-ink-300 uppercase">
      {host.replace(/^www\./, '').slice(0, 1) || <Globe size={13} />}
    </span>
  )
}

function hostOfTile(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * The shortcut grid.
 *
 * What a browser puts here is "what you actually open": the pages you saved, then the ones you
 * have been to. The tile is a fixed size and the two lines are truncated, so a long title cannot
 * push the grid around - the layout has to survive whatever a site calls itself.
 */
export function QuickLaunch({ shortcuts, onOpenUrl, onFocusField }: QuickLaunchProps) {
  const icons = useFavicons(shortcuts.slice(0, 12).map((entry) => entry.url))

  return (
    <div
      data-testid="quick-launch"
      className="grid grid-cols-3 gap-2 @xl:grid-cols-4 @4xl:grid-cols-6"
    >
      {shortcuts.map((entry) => (
        <button
          key={entry.url}
          type="button"
          data-testid="shortcut"
          data-saved={entry.saved ? 'true' : 'false'}
          title={entry.url}
          onClick={(event) =>
            onOpenUrl(entry.url, { newTab: event.altKey || event.ctrlKey || event.metaKey })
          }
          onAuxClick={(event) => {
            if (event.button === 1) onOpenUrl(entry.url, { newTab: true })
          }}
          className={[
            'nova-card nova-card--interactive flex h-[84px] min-w-0 flex-col items-center justify-center gap-2 px-2',
            entry.saved ? 'ring-1 ring-[var(--devlens-accent-line)] ring-inset' : ''
          ].join(' ')}
        >
          <TileIcon icon={iconFor(icons, entry.url)} host={hostOfTile(entry.url)} />
          <span className="w-full truncate text-center text-[10px] text-ink-300">
            {entry.title || hostOfTile(entry.url)}
          </span>
        </button>
      ))}

      <button
        type="button"
        aria-label="Type an address"
        data-testid="shortcut-new"
        title="Type an address in the field above"
        onClick={onFocusField}
        className="flex h-[84px] min-w-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--devlens-hairline)] px-2 text-ink-500 transition-colors hover:border-[var(--devlens-accent-line)] hover:text-ink-200"
      >
        <span className="flex h-6 w-6 items-center justify-center">
          <Plus size={14} />
        </span>
        <span className="w-full truncate text-center text-[10px]">Add</span>
      </button>
    </div>
  )
}
