import { useState } from 'react'
import { Globe, Plus, Star } from 'lucide-react'
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
        className="h-8 w-8 shrink-0 object-contain"
      />
    )
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center font-mono text-[16px] text-white/75 uppercase">
      {host.replace(/^www\./, '').slice(0, 1) || <Globe size={15} />}
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

function shortcutLabel(entry: Shortcut): string {
  const host = hostOfTile(entry.url).replace(/^www\./, '')
  const title = entry.title.trim()
  if (!title || title === host || /^https?:\/\//i.test(title)) return host || 'Open'
  return title
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
      className="flex flex-wrap items-start justify-center gap-x-5 gap-y-5"
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
            'group flex w-[96px] min-w-0 flex-col items-center gap-2 rounded-lg px-1 py-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-white/20'
          ].join(' ')}
        >
          <span
            className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] border border-white/[0.09] bg-[rgba(9,12,15,0.56)] shadow-[0_1px_0_rgba(255,255,255,0.035)_inset] backdrop-blur-md transition-colors duration-150 group-hover:border-white/20 group-hover:bg-[rgba(18,22,26,0.76)]"
          >
            <TileIcon icon={iconFor(icons, entry.url)} host={hostOfTile(entry.url)} />
            {entry.saved && (
              <Star
                size={8}
                aria-label="Saved"
                className="absolute right-1.5 top-1.5 text-white/45"
              />
            )}
          </span>
          <span className="w-full truncate text-[10px] leading-4 text-white/65 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] transition-colors group-hover:text-white/90">
            {shortcutLabel(entry)}
          </span>
        </button>
      ))}

      <button
        type="button"
        aria-label="Type an address"
        data-testid="shortcut-new"
        title="Type an address in the field above"
        onClick={onFocusField}
        className="group flex w-[96px] min-w-0 flex-col items-center gap-2 rounded-lg px-1 py-1 text-white/40 transition-colors hover:text-white/75"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-[16px] border border-dashed border-white/15 bg-black/15 transition-colors group-hover:border-white/30 group-hover:bg-black/25">
          <Plus size={18} />
        </span>
        <span className="w-full truncate text-center text-[10px] leading-4">Add</span>
      </button>
    </div>
  )
}
