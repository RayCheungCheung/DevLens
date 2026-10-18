import { useRef, useState } from 'react'
import { Globe, Loader2, Plus, VenetianMask, VolumeX, X } from 'lucide-react'
import type { WorkspaceMode } from '@shared/mode'
import {
  PRIVATE_TAB_LABEL,
  PRIVATE_TAB_LONG_PRESS_MS,
  PRIVATE_TAB_SHORTCUT_LABEL
} from '@shared/private-tab'
import { internalRouteOf } from '@shared/routes'
import { DevLensMark } from '@renderer/components/DevLensMark'
import { MARK_BOX } from '@renderer/components/PrefixIcons'
import { TabContextMenu, type TabMenuAction } from '@renderer/components/TabContextMenu'
import { NewTabMenu } from '@renderer/components/NewTabMenu'

export interface PageTab {
  id: string
  /** null means the tab has no page yet, so the dashboard is showing. */
  url: string | null
  title: string
  host: string
  secure: boolean
  /** Set while the tab is muted; the chip says so instead of pretending. */
  muted?: boolean
  pinned?: boolean
  /** Unloaded tabs keep their address but hold no viewports (memory saver). */
  unloaded?: boolean
  /**
   * Max-protection private tab: its own in-memory session, Level 3 enforced, never in history.
   * The flag decides the partition it loads on, so it has to live on the tab itself.
   */
  private?: boolean
  /**
   * An explicit session for this tab, when it was opened *from* a guest.
   *
   * A new tab normally follows the window's session (profile, ghost, defense). A tab opened from a
   * page must follow *that page's* session instead - a sub-system reachable only with the cookie
   * the page just set would otherwise open with none of it and answer 401. Private tabs ignore this
   * field: their partition is per-tab by design.
   */
  partition?: string
}

interface TabStripProps {
  tabs: PageTab[]
  activeId: string | null
  mode: WorkspaceMode
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNewTab: () => void
  /** The second entry on the `+` menu: a tab that runs at Level 3 on its own session. */
  onNewPrivateTab: () => void
  /** Right-click menu: one entry point, so the strip does not need twenty callbacks. */
  onTabAction: (action: TabMenuAction, tabId: string) => void
  canReopen: boolean
  /** data URLs keyed by tab id, resolved in the main process. */
  icons?: Record<string, string>
}

/**
 * Floating tab strip.
 *
 * Firefox's detached look: each tab is its own rounded-top chip sitting on the toolbar's
 * hairline, the active one merging into the content frame with an accent hairline on top.
 * The strip scrolls horizontally once the tabs stop fitting, and its trailing button is the
 * same "new tab page" action as Ctrl+T.
 */
/** A stable colour per host, so an icon-less chip still looks deliberate. */
function hostTint(host: string): string {
  let hash = 0
  for (const char of host) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return `hsl(${hash} 45% 42%)`
}

/** The chip's leading glyph: the site's favicon, or the site's initial. */
function TabIcon({ tab, icon }: { tab: PageTab; icon?: string }) {
  const [broken, setBroken] = useState(false)
  const internal = internalRouteOf(tab.url)
  if (internal) {
    return (
      <span
        data-testid="tab-devlens-mark"
        data-route={internal}
        className={[MARK_BOX, 'h-5 w-5 text-[var(--devlens-accent)]'].join(' ')}
      >
        <DevLensMark size={14} />
      </span>
    )
  }
  if (icon && !broken) {
    return (
      <img
        data-testid="tab-favicon"
        src={icon}
        alt=""
        aria-hidden="true"
        draggable={false}
        onError={() => setBroken(true)}
        className="h-3.5 w-3.5 shrink-0 rounded-[3px] object-contain"
      />
    )
  }
  if (tab.host) {
    return (
      <span
        data-testid="tab-initial"
        aria-hidden="true"
        style={{ backgroundColor: hostTint(tab.host) }}
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] font-mono text-[8px] leading-none text-white/90 uppercase"
      >
        {tab.host.replace(/^www\./, '').slice(0, 1)}
      </span>
    )
  }
  return <Globe size={11} className="shrink-0 text-ink-500" />
}

export function TabStrip({
  tabs,
  activeId,
  mode,
  onSelect,
  onClose,
  onNewTab,
  onNewPrivateTab,
  onTabAction,
  canReopen,
  icons = {}
}: TabStripProps) {
  const [menu, setMenu] = useState<{ tabId: string; x: number; y: number } | null>(null)
  /** Where the `+` menu should appear, or null when it is closed. */
  const [newMenu, setNewMenu] = useState<{ x: number; y: number } | null>(null)
  const newTabButton = useRef<HTMLButtonElement | null>(null)
  const pressTimer = useRef<number | null>(null)
  /**
   * A held press ends with a `click` on release. Swallowing exactly one click is what keeps the
   * long press from opening the dashboard behind the menu it just opened.
   */
  const holdFired = useRef(false)

  const cancelHold = (): void => {
    if (pressTimer.current === null) return
    window.clearTimeout(pressTimer.current)
    pressTimer.current = null
  }

  const openNewTabMenu = (x: number, y: number): void => {
    setNewMenu({ x: Math.min(x, Math.max(0, window.innerWidth - 300)), y })
  }

  /** Held long enough: offer both kinds of tab, anchored under the button. */
  const startHold = (): void => {
    cancelHold()
    holdFired.current = false
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null
      holdFired.current = true
      const box = newTabButton.current?.getBoundingClientRect()
      openNewTabMenu(box?.left ?? window.innerWidth / 2, (box?.bottom ?? 40) + 4)
    }, PRIVATE_TAB_LONG_PRESS_MS)
  }

  const menuTab = menu ? tabs.find((tab) => tab.id === menu.tabId) ?? null : null

  return (
    <div
      data-mode={mode}
      data-testid="tab-strip"
      role="tablist"
      aria-label="Open pages"
      /* The strip doubles as the window's drag handle now that the native title bar is gone. */
      className="nova-drag flex h-9 shrink-0 items-end gap-1 overflow-x-auto bg-ink-950 px-2 pt-1"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <div
            key={tab.id}
            data-testid="page-tab"
            /* The strip is where "this tab is different" is visible, so the flag is on the
               chip itself rather than only inside the badge. */
            data-private={tab.private ? 'true' : 'false'}
            role="tab"
            aria-selected={active}
            aria-label={`${tab.title || 'New tab'}${active ? '' : ''}`}
            /* The whole chip selects the tab, not only the label inside it: clicking the padding
               or the gap between two chips used to hit a dead area. */
            onClick={() => onSelect(tab.id)}
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
              // Keep the menu inside the window: a right-click near the edge would otherwise
              // open a panel that runs off it.
              setMenu({
                tabId: tab.id,
                x: Math.min(event.clientX, Math.max(0, window.innerWidth - 310)),
                y: Math.min(event.clientY, Math.max(0, window.innerHeight - 300))
              })
            }}
            /**
             * Middle click closes the chip it landed on - the browser gesture everyone expects.
             * `auxclick` is the event for it (a middle click never fires `click`), so the tab is
             * not selected first and focus does not jump on the way out.
             */
            onAuxClick={(event) => {
              if (event.button !== 1) return
              event.preventDefault()
              event.stopPropagation()
              onClose(tab.id)
            }}
            className={[
              'nova-tab nova-no-drag group flex h-8 max-w-[220px] min-w-[132px] shrink-0 items-center gap-2 pl-2.5 pr-1.5',
              active ? 'nova-tab--active' : '',
              tab.private ? 'nova-tab--private' : ''
            ].join(' ')}
          >
            <button
              type="button"
              onClick={(event) => {
                // The chip handles it too; stopping here keeps the action from firing twice.
                event.stopPropagation()
                onSelect(tab.id)
              }}
              title={tab.url ?? 'New tab page'}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              {tab.private ? (
                <span
                  data-testid="private-tab-badge"
                  aria-label={`${PRIVATE_TAB_LABEL} tab`}
                  title={`${PRIVATE_TAB_LABEL} - its own in-memory session, nothing written down`}
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-[var(--devlens-stealth-soft)] text-[var(--devlens-stealth)]"
                >
                  <VenetianMask size={10} />
                </span>
              ) : (
                <TabIcon tab={tab} icon={icons[tab.id]} />
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={[
                    'block truncate text-[11px] leading-4',
                    active ? 'text-ink-100' : 'text-ink-400'
                  ].join(' ')}
                >
                  {tab.title || tab.host || 'New tab'}
                </span>
              </span>
            </button>

            {tab.muted && <VolumeX size={11} className="shrink-0 text-ink-500" aria-label="Muted" />}
            {tab.unloaded && (
              <Loader2 size={11} className="shrink-0 text-ink-600" aria-label="Unloaded" />
            )}

            <button
              type="button"
              aria-label={`Close ${tab.title || 'tab'}`}
              title="Close tab"
              onClick={(event) => {
                event.stopPropagation()
                onClose(tab.id)
              }}
              className={[
                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors',
                active
                  ? 'text-ink-400 hover:bg-white/10 hover:text-ink-100'
                  : 'text-ink-600 opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-ink-200'
              ].join(' ')}
            >
              <X size={11} />
            </button>
          </div>
        )
      })}

      <button
        type="button"
        /* The one new-tab control in the window: it sits beside the tabs, the way Chrome and
           Firefox place theirs, and the toolbar no longer carries a duplicate. */
        ref={newTabButton}
        data-testid="new-tab-button"
        aria-label="New tab dashboard"
        aria-haspopup="menu"
        title={`New tab page (Ctrl+T) - hold or right-click for a ${PRIVATE_TAB_LABEL} tab (${PRIVATE_TAB_SHORTCUT_LABEL})`}
        /**
         * Three gestures, two outcomes: a click opens the dashboard, a hold or a right-click
         * offers both kinds of tab. The hold is timed from the press, so a press that turns into
         * a drag or a scroll out of the strip is cancelled rather than firing late.
         */
        onPointerDown={(event) => {
          if (event.button === 0) startHold()
        }}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          cancelHold()
          openNewTabMenu(event.clientX, event.clientY)
        }}
        onClick={() => {
          // The release that ended a hold must not also open the dashboard.
          if (holdFired.current) {
            holdFired.current = false
            return
          }
          onNewTab()
        }}
        className="nova-no-drag ml-0.5 mb-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-white/[0.07] hover:text-ink-100"
      >
        <Plus size={13} />
      </button>

      {newMenu && (
        <NewTabMenu
          x={newMenu.x}
          y={newMenu.y}
          onNewTab={onNewTab}
          onNewPrivateTab={onNewPrivateTab}
          onClose={() => setNewMenu(null)}
        />
      )}

      {menu && menuTab && (
        <TabContextMenu
          x={menu.x}
          y={menu.y}
          tab={menuTab}
          canReopen={canReopen}
          context={{
            index: tabs.findIndex((tab) => tab.id === menuTab.id),
            total: tabs.length,
            hasDuplicates: tabs.some(
              (tab) =>
                tab.id !== menuTab.id && Boolean(tab.url) && tab.url === menuTab.url
            )
          }}
          onAction={onTabAction}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}
