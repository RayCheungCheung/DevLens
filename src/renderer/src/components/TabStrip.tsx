import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Globe,
  Loader2,
  Plus,
  VenetianMask,
  VolumeX,
  X
} from 'lucide-react'
import type { WorkspaceMode } from '@shared/mode'
import type { TabGroup } from '@shared/tabs'
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
import { TabGroupDialog } from '@renderer/components/TabGroupDialog'

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
  /** Persistent tab-group association. */
  groupId?: string
}

interface TabStripProps {
  tabs: PageTab[]
  activeId: string | null
  /** Both tab ids currently shown in Split View. */
  splitTabIds?: Set<string>
  tabGroups?: TabGroup[]
  tabGroupsEnabled?: boolean
  mode: WorkspaceMode
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNewTab: () => void
  /** The second entry on the `+` menu: a tab that runs at Level 3 on its own session. */
  onNewPrivateTab: () => void
  /** Right-click menu: one entry point, so the strip does not need twenty callbacks. */
  onTabAction: (action: TabMenuAction, tabId: string, groupId?: string, partnerId?: string) => void
  onAssignTabToGroup: (tabId: string, groupId: string | null) => void
  onToggleTabGroup: (groupId: string) => void
  onCreateTabGroup: (tabId: string, name: string, color: string) => void
  canReopen: boolean
  /** data URLs keyed by tab id, resolved in the main process. */
  icons?: Record<string, string>
  /** Tab ids that have an unread notification (title or URL changed while backgrounded). */
  notifiedTabIds?: Set<string>
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

/**
 * The site's initial, taken from the *registrable domain* rather than the raw host.
 *
 * A naive `host.slice(0, 1)` keys off the left-most label, so `a.notion.so` (or any app or CDN
 * subdomain) would print that subdomain's first letter - the misleading letter the fallback used
 * to show. Taking the first label of the two right-most labels (`notion.so` -> `notion` -> `N`)
 * ties the glyph to the brand the user actually sees. Sub-parts the user typed (a port, `www.`)
 * are stripped first; two-part public suffixes like `co.uk` are outside the scope of a favicon
 * fallback and degrade to the last two labels, which is still honest.
 */
function domainInitial(host: string): string {
  let label = host.toLowerCase().trim()
  if (!label) return ''
  // Drop a port (`example.com:3000`) - the number is not part of the domain.
  const portCut = label.indexOf(':')
  if (portCut !== -1) label = label.slice(0, portCut)
  label = label.replace(/^www\./, '')
  if (!label) return ''
  const parts = label.split('.')
  // Two or more labels: the domain is the second-to-last, e.g. `a.notion.so` -> `notion`.
  const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
  const initial = base.replace(/[^a-z0-9]/g, '').slice(0, 1)
  return initial ? initial.toUpperCase() : ''
}

/**
 * Tab icons arrive from main as local data URLs. Reject malformed or remote strings before they
 * become an `<img>` request, so only an actual image decode failure triggers the letter avatar.
 */
function validFaviconDataUrl(value: string | undefined): value is string {
  return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(value)
}

/** The chip's leading glyph: the site's favicon, or the site's initial. */
function TabIcon({ tab, icon }: { tab: PageTab; icon?: string }) {
  const [broken, setBroken] = useState(false)
  // A broken image should not stick once a real data URL arrives: the fetch is asynchronous, so
  // the icon prop can flip from empty to a valid URL after this component has already errored.
  useEffect(() => {
    setBroken(false)
  }, [icon])
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
  if (validFaviconDataUrl(icon) && !broken) {
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
  const initial = domainInitial(tab.host)
  if (initial) {
    return (
      <span
        data-testid="tab-initial"
        aria-hidden="true"
        style={{ backgroundColor: hostTint(tab.host) }}
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] font-mono text-[8px] leading-none text-white/90"
      >
        {initial}
      </span>
    )
  }
  return <Globe size={11} className="shrink-0 text-ink-500" />
}

/**
 * Small dot indicator for background tabs with unread notifications.
 *
 * Shown only when the tab is not the active tab AND it has a pending notification
 * (its title or URL changed while it was backgrounded). Hidden in all other cases.
 */
function NotificationDot({ hasNotification }: { hasNotification: boolean }) {
  if (!hasNotification) return null
  return (
    <span
      aria-hidden="true"
      className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--devlens-accent)]"
    />
  )
}

/**
 * A pinned tab chip: square, shows only the favicon, no title or close button.
 * Anchored to the left, separate from the scrollable regular tabs.
 */
function PinnedTabChip({
  tab,
  icon,
  active,
  hasNotification,
  onSelect,
  onContextMenu,
  onAuxClick
}: {
  tab: PageTab
  icon?: string
  active: boolean
  /** True only when the background tab has an unread notification. */
  hasNotification: boolean
  onSelect: (id: string) => void
  onContextMenu: (e: React.MouseEvent) => void
  onAuxClick: (e: React.MouseEvent) => void
}) {
  return (
    <div
      key={tab.id}
      data-testid="page-tab"
      data-pinned="true"
      data-private={tab.private ? 'true' : 'false'}
      role="tab"
      aria-selected={active}
      aria-label={tab.title || 'Pinned tab'}
      onClick={() => onSelect(tab.id)}
      onContextMenu={onContextMenu}
      onAuxClick={onAuxClick}
      className={[
        'nova-tab nova-no-drag relative flex h-9 w-9 shrink-0 items-center justify-center rounded-tl-lg rounded-tr-lg',
        active ? 'nova-tab--active' : 'bg-ink-900',
        tab.private ? 'nova-tab--private' : ''
      ].join(' ')}
    >
      <NotificationDot hasNotification={!active && hasNotification} />
      {tab.private ? (
        <span className="flex h-5 w-5 items-center justify-center text-[var(--devlens-stealth)]">
          <VenetianMask size={14} />
        </span>
      ) : (
        <TabIcon tab={tab} icon={icon} />
      )}
    </div>
  )
}

export function TabStrip({
  tabs,
  activeId,
  splitTabIds = new Set(),
  tabGroups = [],
  tabGroupsEnabled = true,
  mode,
  onSelect,
  onClose,
  onNewTab,
  onNewPrivateTab,
  onTabAction,
  onAssignTabToGroup,
  onToggleTabGroup,
  onCreateTabGroup,
  canReopen,
  icons = {},
  notifiedTabIds = new Set()
}: TabStripProps) {
  const [menuTab, setMenuTab] = useState<{ tabId: string; x: number; y: number } | null>(null)
  const [groupDialogTabId, setGroupDialogTabId] = useState<string | null>(null)
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)
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

  const handleContextMenu = useCallback(
    (tabId: string, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setMenuTab({
        tabId,
        x: Math.min(e.clientX, Math.max(0, window.innerWidth - 310)),
        y: Math.min(e.clientY, Math.max(0, window.innerHeight - 300))
      })
    },
    []
  )

  const handleAuxClick = useCallback(
    (tabId: string, e: React.MouseEvent) => {
      if (e.button !== 1) return
      e.preventDefault()
      e.stopPropagation()
      onClose(tabId)
    },
    [onClose]
  )

  /** A split partner must be a loaded web tab adjacent to the one that was right-clicked. */
  const splitPartnerFor = (tabId: string): { id: string; title: string } | undefined => {
    const index = tabs.findIndex((tab) => tab.id === tabId)
    if (index < 0) return undefined
    const current = tabs[index]
    if (!current.url || current.unloaded || internalRouteOf(current.url)) return undefined
    const candidates = [tabs[index + 1], tabs[index - 1]]
    const partner = candidates.find(
      (tab) =>
        tab &&
        tab.url &&
        !tab.unloaded &&
        !internalRouteOf(tab.url)
    )
    return partner ? { id: partner.id, title: partner.title || partner.host } : undefined
  }

  const handleMenuAction = (
    action: TabMenuAction,
    tabId: string,
    groupId?: string
  ): void => {
    if (action === 'group-new') {
      setGroupDialogTabId(tabId)
      return
    }
    if (action === 'group-assign') {
      onAssignTabToGroup(tabId, groupId ?? null)
      return
    }
    if (action === 'group-remove') {
      onAssignTabToGroup(tabId, null)
      return
    }
    const partnerId = (action === "split-side-by-side" || action === "split-stacked") ? splitPartnerFor(tabId)?.id : undefined
    onTabAction(action, tabId, groupId, partnerId)
  }

  const regularTabs = tabs.filter((tab) => !tab.pinned)
  const orderedRegularTabs: PageTab[] = []
  const emittedGroups = new Set<string>()
  for (const tab of regularTabs) {
    if (!tab.groupId) {
      orderedRegularTabs.push(tab)
      continue
    }
    if (emittedGroups.has(tab.groupId)) continue
    emittedGroups.add(tab.groupId)
    orderedRegularTabs.push(...regularTabs.filter((entry) => entry.groupId === tab.groupId))
  }
  const firstGroupTabs = new Set(
    [...emittedGroups].map(
      (groupId) => orderedRegularTabs.find((tab) => tab.groupId === groupId)?.id ?? ''
    )
  )

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

  return (
    <div
      data-mode={mode}
      data-testid="tab-strip"
      role="tablist"
      aria-label="Open pages"
      /* The strip doubles as the window's drag handle now that the native title bar is gone. */
      className="nova-drag flex h-10.5 shrink-0 items-end gap-2 overflow-x-auto bg-[color-mix(in_srgb,var(--devlens-chrome-base)_85%,var(--theme-accent-base)_15%)] px-3 py-1.5"
    >
      {/* Pinned tabs: fixed position on the left, square, only favicon */}
      {tabs
        .filter((tab) => tab.pinned)
        .map((tab) => {
          const active = tab.id === activeId
          return (
            <PinnedTabChip
              key={tab.id}
              tab={tab}
              icon={icons[tab.id]}
              active={active}
              hasNotification={notifiedTabIds.has(tab.id)}
              onSelect={onSelect}
              onContextMenu={(e) => handleContextMenu(tab.id, e)}
              onAuxClick={(e) => handleAuxClick(tab.id, e)}
            />
          )
        })}

      {/* Separator if there are both pinned and regular tabs */}
      {tabs.some((t) => t.pinned) && tabs.some((t) => !t.pinned) && (
        <div className="nova-no-drag mb-1.5 h-5 w-px shrink-0 bg-white/10" />
      )}

      {/* Regular tabs: scrollable, show title and close button */}
      {orderedRegularTabs.map((tab) => {
          const active = tab.id === activeId
          const group = tab.groupId
            ? tabGroups.find((entry) => entry.id === tab.groupId)
            : undefined
          const collapsed = group?.collapsed === true
          return (
            <Fragment key={tab.id}>
              {group && firstGroupTabs.has(tab.id) && (
                <button
                  type="button"
                  data-testid="tab-group"
                  data-group-id={group.id}
                  aria-expanded={!collapsed}
                  aria-label={`${group.name} tab group, ${regularTabs.filter((entry) => entry.groupId === group.id).length} tabs`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleTabGroup(group.id)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setDragOverGroupId(group.id)
                  }}
                  onDragLeave={() => setDragOverGroupId((current) => current === group.id ? null : current)}
                  onDrop={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    const draggedId = event.dataTransfer.getData('application/x-devlens-tab')
                    setDragOverGroupId(null)
                    if (draggedId) onAssignTabToGroup(draggedId, group.id)
                  }}
                  className={[
                    'nova-no-drag mb-0.5 flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-left transition-colors',
                    dragOverGroupId === group.id
                      ? 'border-white/40 bg-white/[0.10]'
                      : 'border-[var(--devlens-hairline-strong)] bg-white/[0.035]'
                  ].join(' ')}
                  style={{ borderColor: dragOverGroupId === group.id ? group.color : undefined }}
                  title={`${group.name} - click to ${collapsed ? 'expand' : 'collapse'}, drop tabs here to add`}
                >
                  {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                  <Folder size={11} style={{ color: group.color }} />
                  <span className="max-w-[110px] truncate text-[10px] text-ink-200">
                    {group.name}
                  </span>
                  <span className="font-mono text-[8px] text-ink-600">
                    {regularTabs.filter((entry) => entry.groupId === group.id).length}
                  </span>
                </button>
              )}
              {(!collapsed || active) && (
            <div
              data-testid="page-tab"
              data-private={tab.private ? 'true' : 'false'}
              data-split={splitTabIds.has(tab.id) ? 'true' : 'false'}
              data-group-id={tab.groupId ?? ''}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('application/x-devlens-tab', tab.id)
              }}
              role="tab"
              aria-selected={active}
              aria-label={tab.title || 'New tab'}
              onClick={() => onSelect(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setMenuTab({
                  tabId: tab.id,
                  x: Math.min(e.clientX, Math.max(0, window.innerWidth - 310)),
                  y: Math.min(e.clientY, Math.max(0, window.innerHeight - 300))
                })
              }}
              onAuxClick={(e) => {
                if (e.button !== 1) return
                e.preventDefault()
                e.stopPropagation()
                onClose(tab.id)
              }}
              className={[
                'nova-tab nova-no-drag group flex h-9 max-w-[220px] min-w-[132px] shrink-0 items-center gap-2 pl-3 pr-2',
                active ? 'nova-tab--active' : '',
                splitTabIds.has(tab.id) ? 'border-[var(--devlens-accent-line)]' : '',
                tab.private ? 'nova-tab--private' : ''
              ].join(' ')}
            >
              <button
                type="button"
                onClick={(e) => {
                  // The chip handles it too; stopping here keeps the action from firing twice.
                  e.stopPropagation()
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
                      'block truncate text-[11px] leading-5',
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
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(tab.id)
                }}
                className={[
                  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors',
                  active
                    ? 'text-ink-400 hover:bg-white/10 hover:text-ink-100'
                    : 'text-ink-600 opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-ink-200'
                ].join(' ')}
              >
                <X size={12} />
              </button>
            </div>
              )}
            </Fragment>
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

      {menuTab && (
        <TabContextMenu
          x={menuTab.x}
          y={menuTab.y}
          tab={tabs.find((t) => t.id === menuTab.tabId) ?? { id: '', title: '', url: null }}
          canReopen={canReopen}
          context={{
            index: tabs.findIndex((tab) => tab.id === menuTab.tabId),
            total: tabs.length,
            hasDuplicates: tabs.some(
              (tab) =>
                tab.id !== menuTab.tabId && Boolean(tab.url) && tab.url === (tabs.find((t) => t.id === menuTab.tabId)?.url)
            ),
            splitPartner: splitPartnerFor(menuTab.tabId),
            tabGroups: tabGroupsEnabled ? tabGroups : undefined
          }}
          onAction={handleMenuAction}
          onClose={() => setMenuTab(null)}
        />
      )}

      {groupDialogTabId && (
        <TabGroupDialog
          onSave={(name, color) => onCreateTabGroup(groupDialogTabId, name, color)}
          onClose={() => setGroupDialogTabId(null)}
        />
      )}
    </div>
  )
}



