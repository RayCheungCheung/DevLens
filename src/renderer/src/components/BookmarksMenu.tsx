import { useRef, useState } from 'react'
import { useMenuDismiss } from '@renderer/hooks/useMenuDismiss'
import type { LucideIcon } from 'lucide-react'
import {
  Check,
  ChevronRight,
  Clipboard,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FolderPlus,
  Ghost,
  Minus,
  Plus,
  ShieldHalf,
  Trash2,
  AppWindow,
  Download,
  Upload
} from 'lucide-react'
import type { BookmarkNode } from '@shared/types'

/** Everything the bar's menus can ask for. One union, so a typo cannot be an inert row. */
export type BookmarkMenuAction =
  | 'open-new-tab'
  | 'open-window'
  | 'open-private-window'
  | 'container-standard'
  | 'container-ghost'
  | 'container-wimh'
  | 'edit-bookmark'
  | 'delete-bookmark'
  | 'rename-folder'
  | 'open-all-folder'
  | 'delete-node'
  | 'delete-separator'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'add-bookmark'
  | 'add-folder'
  | 'add-separator'
  | 'import-bookmarks'
  | 'export-bookmarks'
  | 'open-all'
  | 'toolbar-open-all'
  | 'toolbar-visible'
  | 'show-other'
  | 'manage-bookmarks'

export interface BookmarkMenuTarget {
  kind: 'bookmark' | 'folder' | 'separator' | 'blank'
  node?: BookmarkNode
}

interface Row {
  action?: BookmarkMenuAction
  label: string
  icon: LucideIcon
  /** Rows that toggle say whether they are on. */
  checked?: boolean
  separator?: boolean
}

interface Group {
  id?: string
  label?: string
  rows: Row[]
}

interface BookmarksMenuProps {
  x: number
  y: number
  target: BookmarkMenuTarget
  /** Whether the bar itself is showing, for the "Always show" style toggle. */
  toolbarVisible: boolean
  showOtherBookmarks: boolean
  /** False when the active tab has no page to save. */
  canAddBookmark: boolean
  /** False when the whole store is empty, which is the only case Export cannot run. */
  canExport?: boolean
  /**
   * True when the store's own clipboard is holding a node.
   *
   * Paste is the one row whose applicability is *state* rather than shape: cutting a bookmark and
   * then right-clicking the blank end of the bar is exactly when it should appear, and a bar with
   * an empty clipboard should not offer it at all.
   */
  hasClipboard?: boolean
  onAction: (action: BookmarkMenuAction, target: BookmarkMenuTarget) => void
  onClose: () => void
}

/**
 * The bookmarks bar's context menus.
 *
 * Three shapes - a link, a folder, a divider - plus the blank end of the bar, sharing one
 * component because they share most of their rows: the same "add", the same clipboard, the same
 * toolbar submenu. The differences are which destructive entry appears and whether there is an
 * address to open.
 *
 * Like the tab menu, nothing here is disabled: a row that cannot act for this target is not in the
 * tree. Add Bookmark appears only when there is a page to save, Export only when the store has
 * something in it, and the clipboard rows only where a clipboard operation means something - Cut
 * and Copy need a node, Paste needs something on the clipboard.
 */
export function BookmarksMenu({
  x,
  y,
  target,
  toolbarVisible,
  showOtherBookmarks,
  canAddBookmark,
  canExport = true,
  hasClipboard = false,
  onAction,
  onClose
}: BookmarksMenuProps) {
  const [submenu, setSubmenu] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)
  useMenuDismiss({ ref, onClose })
  const node = target.node
  const isLink = target.kind === 'bookmark'
  const isFolder = target.kind === 'folder'
  const isSeparator = target.kind === 'separator'

  const run = (action: BookmarkMenuAction): void => {
    onAction(action, target)
    onClose()
  }

  /** The tail every variant ends with: the toolbar submenu, the chip toggle and the manager. */
  const barRows: Group[] = [
    {
      id: 'toolbar',
      label: 'Bookmarks Toolbar',
      rows: [
        { action: 'toolbar-open-all', label: 'Open All in Tabs', icon: ExternalLink },
        {
          action: 'toolbar-visible',
          label: toolbarVisible ? 'Hide the Bookmarks Toolbar' : 'Always Show the Bookmarks Toolbar',
          icon: Eye,
          checked: toolbarVisible
        },
        { action: 'add-folder', label: 'Add Folder...', icon: FolderPlus },
        { action: 'add-separator', label: 'Add Separator', icon: Minus }
      ]
    },
    /* The toolbar's own file operations, right under the toolbar submenu they belong to. */
    {
      rows: [
        { action: 'import-bookmarks', label: 'Import Bookmarks...', icon: Download },
        ...(canExport
          ? ([{ action: 'export-bookmarks', label: 'Export Bookmarks...', icon: Upload }] as Row[])
          : [])
      ]
    },
    {
      rows: [
        {
          action: 'show-other',
          label: showOtherBookmarks ? 'Hide Other Bookmarks' : 'Show Other Bookmarks',
          icon: showOtherBookmarks ? EyeOff : Eye,
          checked: showOtherBookmarks
        }
      ]
    }
  ]

  /**
   * What every variant shares in the middle.
   *
   * `withNode` is what a clipboard row needs to mean something: Cut and Copy have nothing to act on
   * from the blank end of the bar, and Paste has nothing to act on anywhere unless the store's own
   * clipboard is holding something.
   */
  const editingRows = (withNode: boolean): Group => ({
    rows: [
      ...(withNode
        ? ([
            { action: 'cut', label: 'Cut', icon: Clipboard },
            { action: 'copy', label: 'Copy', icon: Copy }
          ] as Row[])
        : []),
      ...(hasClipboard
        ? ([{ action: 'paste', label: 'Paste', icon: Clipboard }] as Row[])
        : []),
      ...(canAddBookmark
        ? ([
            {
              action: 'add-bookmark',
              label: 'Add Bookmark...',
              icon: Plus,
              separator: withNode || hasClipboard
            }
          ] as Row[])
        : []),
      { action: 'add-folder', label: 'Add Folder...', icon: FolderPlus },
      { action: 'add-separator', label: 'Add Separator', icon: Minus }
    ]
  })

  let groups: Group[]
  if (isLink) {
    groups = [
      {
        rows: [
          { action: 'open-new-tab', label: 'Open in New Tab', icon: ExternalLink },
          { action: 'open-window', label: 'Open in New Window', icon: AppWindow },
          { action: 'open-private-window', label: 'Open in New Private Window', icon: EyeOff }
        ]
      },
      {
        id: 'container',
        label: 'Open in New Container Tab',
        rows: [
          { action: 'container-standard', label: 'Standard Session', icon: AppWindow },
          { action: 'container-ghost', label: 'Ghost Session', icon: Ghost },
          { action: 'container-wimh', label: 'Extreme Defense', icon: ShieldHalf }
        ]
      },
      {
        rows: [
          { action: 'edit-bookmark', label: 'Edit Bookmark...', icon: Edit3 },
          { action: 'delete-bookmark', label: 'Delete Bookmark', icon: Trash2 }
        ]
      },
      editingRows(true),
      ...barRows
    ]
  } else if (isFolder) {
    groups = [
      {
        rows: [
          { action: 'open-all-folder', label: 'Open All in Tabs', icon: ExternalLink },
          { action: 'rename-folder', label: 'Rename Folder...', icon: Edit3 },
          { action: 'delete-node', label: 'Delete Folder', icon: Trash2 }
        ]
      },
      editingRows(true),
      ...barRows
    ]
  } else if (isSeparator) {
    groups = [
      { rows: [{ action: 'delete-separator', label: 'Delete Separator', icon: Trash2 }] },
      editingRows(true),
      ...barRows
    ]
  } else {
    groups = [
      { rows: [{ action: 'open-all', label: 'Open All Bookmarks', icon: ExternalLink }] },
      editingRows(false),
      ...barRows
    ]
  }

  // A folder's own name is the only heading the menu needs, and it doubles as a handle for the
  // node the actions are about.
  const heading = isFolder
    ? (node?.title ?? 'Folder')
    : isSeparator
      ? 'Separator'
      : isLink
        ? (node?.title ?? node?.url ?? 'Bookmark')
        : 'Bookmarks toolbar'

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Bookmark options for ${heading}`}
      data-testid="bookmark-context-menu"
      data-target-kind={target.kind}
      data-node-id={node?.id ?? ''}
      style={{ left: x, top: y }}
      className="fixed z-[80] max-h-[70vh] w-[268px] overflow-y-auto rounded-xl border border-[var(--devlens-hairline)] bg-[color-mix(in_srgb,var(--color-ink-950)_97%,transparent)] py-1 shadow-2xl"
    >
      <p className="truncate px-3 py-1.5 font-mono text-[10px] text-ink-500">{heading}</p>

      {groups.map((group, index) => {
        if (group.id && group.label) {
          const active = submenu === group.id
          return (
            <div key={group.id} className="border-t border-[var(--devlens-hairline)]">
              <button
                type="button"
                role="menuitem"
                aria-expanded={active}
                aria-label={group.label}
                data-testid={`bookmark-menu-${group.id}`}
                onClick={() => setSubmenu(active ? null : (group.id ?? null))}
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
          <div key={`${group.rows[0]?.label ?? 'group'}-${index}`}>
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
  onRun: (action: BookmarkMenuAction) => void
}) {
  const Icon = row.icon
  return (
    <button
      type="button"
      role="menuitem"
      aria-label={row.label}
      data-testid={`bookmark-menu-${row.action ?? row.label}`}
      onClick={() => row.action && onRun(row.action)}
      className={[
        'flex w-full items-center gap-2.5 py-1.5 text-left transition-colors',
        nested ? 'pl-6 pr-3' : 'px-3',
        'text-ink-200 hover:bg-white/[0.04]',
        row.separator ? 'mt-1 border-t border-[var(--devlens-hairline)] pt-1.5' : ''
      ].join(' ')}
    >
      <Icon size={12} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-[11px]">{row.label}</span>
      {row.checked && <Check size={11} className="shrink-0 text-[var(--devlens-accent)]" />}
    </button>
  )
}
