import { useRef, useState } from 'react'
import { useMenuDismiss } from '@renderer/hooks/useMenuDismiss'
import {
  AppWindow,
  Bookmark,
  ChevronRight,
  Copy,
  CornerUpLeft,
  Link2,
  Layers,
  MoveHorizontal,
  Pin,
  Plus,
  RotateCw,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX
} from 'lucide-react'

/**
 * The tab chip's context menu.
 *
 * Every row here is one the shell can carry out for *this* tab, decided before the menu renders.
 * There are no greyed-out entries and no reasons: an option that cannot act is not drawn at all.
 * The rows this build has no backend for (tab groups, split view, cross-device hand-off, OS share
 * targets) are gone rather than disabled, and the contextual ones - unload, bookmark, copy link,
 * the container sessions, reopen, the batch closes - exist only when their context exists.
 *
 * The context comes in as a prop rather than being sniffed here: the tab strip knows the index,
 * the count and whether there are duplicates, and a menu that guessed would be a menu with a row
 * that does nothing.
 */

export type TabMenuAction =
  | 'new-right'
  | 'reload'
  | 'mute'
  | 'pin'
  | 'unload'
  | 'duplicate'
  | 'ask-ai'
  | 'bookmark'
  | 'move-left'
  | 'move-right'
  | 'move-first'
  | 'move-last'
  | 'copy-link'
  | 'container-standard'
  | 'container-ghost'
  | 'container-wimh'
  | 'close'
  | 'close-others'
  | 'close-right'
  | 'close-left'
  | 'close-duplicates'
  | 'reopen'

interface TabContextMenuProps {
  /** Position in viewport coordinates, straight from the right-click. */
  x: number
  y: number
  tab: { id: string; title: string; url: string | null; muted?: boolean; pinned?: boolean; unloaded?: boolean }
  /** True when there is something on the closed stack to bring back. */
  canReopen: boolean
  /** Where this tab sits in the strip and what else is in it, for the batch rows. */
  context: {
    index: number
    total: number
    /** True when another open tab has this tab's URL. */
    hasDuplicates: boolean
  }
  onAction: (action: TabMenuAction, tabId: string) => void
  onClose: () => void
}

interface Row {
  action?: TabMenuAction
  label: string
  icon: typeof Plus
  shortcut?: string
  separator?: boolean
}

export function TabContextMenu({
  x,
  y,
  tab,
  canReopen,
  context,
  onAction,
  onClose
}: TabContextMenuProps) {
  const [submenu, setSubmenu] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)
  useMenuDismiss({ ref, onClose })

  const run = (action: TabMenuAction): void => {
    onAction(action, tab.id)
    onClose()
  }

  /* Decided once, from the tab and its neighbours: what is left after the not-applicable rows
     are dropped. */
  const hasPage = Boolean(tab.url)
  const hasLeft = context.index > 0
  const hasRight = context.total > 0 && context.index < context.total - 1
  const hasOthers = context.total > 1

  const groups: { id?: string; label?: string; rows: Row[] }[] = [
    {
      rows: [
        { action: 'new-right', label: 'New Tab to Right', icon: Plus },
      ]
    },
    {
      rows: [
        { action: 'reload', label: 'Reload Tab', icon: RotateCw },
        {
          action: 'mute',
          label: tab.muted ? 'Unmute Tab' : 'Mute Tab',
          icon: tab.muted ? Volume2 : VolumeX
        },
        { action: 'pin', label: tab.pinned ? 'Unpin Tab' : 'Pin Tab', icon: Pin },
        ...(hasPage
          ? ([
              {
                action: 'unload',
                label: tab.unloaded ? 'Load Tab' : 'Unload Tab',
                icon: AppWindow
              }
            ] as Row[])
          : []),
        { action: 'duplicate', label: 'Duplicate Tab', icon: Copy }
      ]
    },
    {
      rows: [
        { action: 'ask-ai', label: 'Open the AI assistant', icon: Sparkles, shortcut: 'Z' },
        ...(hasPage ? ([{ action: 'bookmark', label: 'Bookmark Tab...', icon: Bookmark }] as Row[]) : [])
      ]
    },
    {
      id: 'move',
      label: 'Move Tab',
      rows: [
        ...(hasLeft ? ([{ action: 'move-left', label: 'Move Left', icon: MoveHorizontal }] as Row[]) : []),
        ...(hasRight ? ([{ action: 'move-right', label: 'Move Right', icon: MoveHorizontal }] as Row[]) : []),
        ...(hasLeft ? ([{ action: 'move-first', label: 'Move to Start', icon: CornerUpLeft }] as Row[]) : []),
        ...(hasRight ? ([{ action: 'move-last', label: 'Move to End', icon: CornerUpLeft }] as Row[]) : [])
      ]
    },
    {
      id: 'share',
      label: 'Share',
      rows: [
        ...(hasPage ? ([{ action: 'copy-link', label: 'Copy Link', icon: Link2 }] as Row[]) : [])
      ]
    },
    {
      id: 'container',
      label: 'Open in New Container Tab',
      rows: [
        ...(hasPage
          ? ([
              { action: 'container-standard', label: 'Standard Session', icon: Layers },
              { action: 'container-ghost', label: 'Ghost (in-memory, trackers blocked)', icon: Layers },
              { action: 'container-wimh', label: 'Extreme defense (RAM-only)', icon: Layers }
            ] as Row[])
          : [])
      ]
    },
    {
      rows: [
        { action: 'close', label: 'Close Tab', icon: Trash2, shortcut: 'W', separator: true },
        ...(context.hasDuplicates
          ? ([{ action: 'close-duplicates', label: 'Close Duplicate Tabs', icon: Copy }] as Row[])
          : []),
        ...(hasOthers ? ([{ action: 'close-others', label: 'Close Other Tabs', icon: Trash2 }] as Row[]) : []),
        ...(hasRight ? ([{ action: 'close-right', label: 'Close Tabs to the Right', icon: Trash2 }] as Row[]) : []),
        ...(hasLeft ? ([{ action: 'close-left', label: 'Close Tabs to the Left', icon: Trash2 }] as Row[]) : []),
        ...(canReopen
          ? ([
              { action: 'reopen', label: 'Reopen Closed Tab', icon: CornerUpLeft, shortcut: 'Shift+T' }
            ] as Row[])
          : [])
      ]
    }
  ]

  /* A submenu with nothing in it is not a submenu. */
  const visible = groups.filter((group) => group.rows.length > 0)

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Tab options for ${tab.title || 'this tab'}`}
      data-testid="tab-context-menu"
      data-tab={tab.id}
      style={{ left: x, top: y }}
      /* The strip is the window's drag region and this menu renders inside it, so the menu
         must opt out or every row press becomes a window drag and no click ever lands. */
      className="nova-popup fixed z-[80] max-h-[70vh] w-[300px] overflow-y-auto rounded-xl border border-[var(--devlens-hairline)] bg-[color-mix(in_srgb,var(--color-ink-950)_97%,transparent)] py-1 shadow-2xl"
    >
      <p className="truncate px-3 py-1.5 font-mono text-[10px] text-ink-500">
        {tab.url ?? 'new tab page'}
      </p>

      {visible.map((group) => {
        if (group.id && group.label) {
          const active = submenu === group.id
          return (
            <div key={group.id} className="border-t border-[var(--devlens-hairline)]">
              <button
                type="button"
                role="menuitem"
                aria-expanded={active}
                aria-label={group.label}
                data-testid={`tab-menu-${group.id}`}
                onClick={() => setSubmenu(active ? null : group.id ?? null)}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
              >
                <ChevronRight
                  size={12}
                  className={['shrink-0 text-ink-500 transition-transform', active ? 'rotate-90' : ''].join(' ')}
                />
                <span className="min-w-0 flex-1 truncate text-[11px] text-ink-200">{group.label}</span>
              </button>
              {active && (
                <div className="pb-1">
                  {group.rows.map((row) => (
                    <MenuRow key={row.label} row={row} nested onRun={run} />
                  ))}
                </div>
              )}
            </div>
          )
        }
        return (
          <div key={group.rows[0].label}>
            {group.rows.map((row) => (
              <MenuRow key={row.label} row={row} onRun={run} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function MenuRow({
  row,
  nested = false,
  onRun
}: {
  row: Row
  nested?: boolean
  onRun: (action: TabMenuAction) => void
}) {
  const Icon = row.icon
  return (
    <button
      type="button"
      role="menuitem"
      aria-label={row.label}
      data-testid={`tab-menu-${row.action ?? row.label}`}
      onClick={() => row.action && onRun(row.action)}
      className={[
        'flex w-full items-center gap-2.5 py-1.5 text-left transition-colors',
        nested ? 'pl-6 pr-3' : 'px-3',
        row.separator ? 'mt-1 border-t border-[var(--devlens-hairline)] pt-1.5' : '',
        'text-ink-200 hover:bg-white/[0.04]'
      ].join(' ')}
    >
      <Icon size={13} className="shrink-0 text-ink-500" />
      <span className="min-w-0 flex-1 truncate text-[11px]">{row.label}</span>
      {row.shortcut && <span className="shrink-0 font-mono text-[9px] text-ink-600">{row.shortcut}</span>}
    </button>
  )
}
