import { useEffect, useRef, useState } from 'react'
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen, Globe } from 'lucide-react'
import type {
  BookmarkDropPosition,
  BookmarkNode,
  BookmarkOptions,
  BookmarkTree
} from '@shared/types'
import {
  BookmarksMenu,
  type BookmarkMenuAction,
  type BookmarkMenuTarget
} from '@renderer/components/BookmarksMenu'

interface BookmarksBarProps {
  /** The bar's own tree: three ordered roots, folders and separators inside them. */
  tree: BookmarkTree
  options: BookmarkOptions
  /** Favicons by origin, resolved by main and handed over as data URLs. */
  icons: Record<string, string>
  /** The page on screen, so "Add Bookmark..." knows what it would save. */
  page: { url: string; title: string } | null
  /** Plain click (or a folder entry) navigates the active tab; Alt/Ctrl opens a new one. */
  onOpen: (url: string, options?: { newTab?: boolean }) => void
  /** The drop end of a drag: reorder, or file a node into a folder. */
  onMove: (input: { id: string; targetId: string | null; position: BookmarkDropPosition }) => void
  /** Everything the menus ask for. The bar draws; the shell decides. */
  onAction: (action: BookmarkMenuAction, target: BookmarkMenuTarget) => void
  /** True while the store's clipboard holds a node, so the menu can decide to offer Paste. */
  hasClipboard?: boolean
}

/**
 * The drag payload's type.
 *
 * A dedicated MIME type means a drag that started somewhere else - a link on a page, a file -
 * cannot be mistaken for a bar node, and the id is also kept in a ref because `getData` is
 * unreadable during `dragover`, which is where the drop position is decided.
 */
const NODE_MIME = 'application/x-devlens-bookmark'

/**
 * The bookmarks toolbar, under the address bar.
 *
 * It shows the toolbar root in its stored order: links, folders with their own menus, and
 * separators. Everything on it can be dragged - onto another item to reorder, into a folder to
 * file it - and everything has a right-click menu. The bar is hidden when it holds nothing,
 * unless "always show" was turned on, and the blank space to the right of the last item is a
 * right-click target of its own and the drop zone for "put it last".
 */
export function BookmarksBar({
  tree,
  options,
  icons,
  page,
  onOpen,
  onMove,
  onAction,
  hasClipboard = false
}: BookmarksBarProps) {
  const [menu, setMenu] = useState<{ x: number; y: number; target: BookmarkMenuTarget } | null>(null)
  /**
   * The dropdown that is open, and where it hangs.
   *
   * The bar scrolls, and a scroll container clips its absolutely positioned children - so the
   * menus are placed in viewport coordinates from the button they belong to, the same way the
   * bar's context menus are.
   */
  const [dropdown, setDropdown] = useState<{ id: string; x: number; y: number } | null>(null)
  /** The node being dragged, and where it would land. */
  const [dragging, setDragging] = useState<string | null>(null)
  const [hint, setHint] = useState<{ id: string; position: BookmarkDropPosition } | null>(null)
  const dragId = useRef<string | null>(null)

  const items = tree.toolbar
  const otherRoots = [...tree.menu, ...tree.other]
  if (items.length === 0 && !options.toolbarVisible) return null

  const openMenu = (event: ReactMouseEvent, target: BookmarkMenuTarget): void => {
    event.preventDefault()
    event.stopPropagation()
    setDropdown(null)
    setMenu({
      x: Math.min(event.clientX, Math.max(0, window.innerWidth - 290)),
      y: Math.min(event.clientY, Math.max(0, window.innerHeight - 340)),
      target
    })
  }

  /** The drop zone every node offers: before it, after it, or inside a folder. */
  const openDropdown = (event: ReactMouseEvent<HTMLButtonElement>, id: string, width: number): void => {
    if (dropdown?.id === id) {
      setDropdown(null)
      return
    }
    const box = event.currentTarget.getBoundingClientRect()
    setDropdown({
      id,
      x: Math.min(box.left, Math.max(0, window.innerWidth - width - 8)),
      y: box.bottom + 2
    })
  }

  const dropHandlers = (node: BookmarkNode) => ({
    onDragOver: (event: DragEvent): void => {
      if (!dragId.current || dragId.current === node.id) return
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'move'
      const box = event.currentTarget.getBoundingClientRect()
      const ratio = (event.clientX - box.left) / Math.max(1, box.width)
      const position: BookmarkDropPosition =
        node.kind === 'folder' && ratio > 0.3 && ratio < 0.7
          ? 'inside'
          : ratio < 0.5
            ? 'before'
            : 'after'
      setHint({ id: node.id, position })
    },
    onDragLeave: (): void => {
      setHint((current) => (current?.id === node.id ? null : current))
    },
    onDrop: (event: DragEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      const id = dragId.current ?? event.dataTransfer.getData(NODE_MIME)
      const position = hint?.id === node.id ? hint.position : 'after'
      dragId.current = null
      setDragging(null)
      setHint(null)
      if (id && id !== node.id) onMove({ id, targetId: node.id, position })
    }
  })

  const startDrag = (event: DragEvent, id: string): void => {
    dragId.current = id
    setDragging(id)
    event.dataTransfer.setData(NODE_MIME, id)
    event.dataTransfer.effectAllowed = 'move'
  }

  const endDrag = (): void => {
    dragId.current = null
    setDragging(null)
    setHint(null)
  }

  const dropOnBlank = (event: DragEvent): void => {
    const id = dragId.current ?? event.dataTransfer.getData(NODE_MIME)
    if (!id) return
    event.preventDefault()
    dragId.current = null
    setDragging(null)
    setHint(null)
    onMove({ id, targetId: null, position: 'after' })
  }

  return (
    <div
      data-testid="bookmarks-bar"
      role="toolbar"
      aria-label="Bookmarks toolbar"
      onContextMenu={(event) => openMenu(event, { kind: 'blank' })}
      onDragOver={(event) => {
        if (dragId.current) event.preventDefault()
      }}
      onDrop={dropOnBlank}
      className="flex h-8.5 shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--devlens-hairline)] bg-ink-950/80 px-3 py-1.5"
    >
      {items.map((node) => {
        const drop = hint?.id === node.id ? hint.position : null
        const shared = {
          draggable: true,
          onDragStart: (event: DragEvent) => startDrag(event, node.id),
          onDragEnd: endDrag,
          'data-node-id': node.id,
          'data-drop': drop ?? undefined,
          className: [
            'shrink-0',
            dragging === node.id ? 'opacity-40' : '',
            drop === 'inside' ? 'bg-[var(--devlens-accent-soft)] ring-1 ring-[var(--devlens-accent-line)]' : '',
            drop === 'before' ? 'border-l-2 border-l-[var(--devlens-accent)]' : '',
            drop === 'after' ? 'border-r-2 border-r-[var(--devlens-accent)]' : ''
          ].join(' ')
        }

        if (node.kind === 'separator') {
          return (
            <div
              key={node.id}
              role="separator"
              aria-label="Separator"
              title="Separator - drag to move, right-click for options"
              data-testid="bookmark-bar-separator"
              {...shared}
              {...dropHandlers(node)}
              onContextMenu={(event) => openMenu(event, { kind: 'separator', node })}
              className={[shared.className, 'mx-1 flex h-6 w-2 cursor-grab items-center justify-center'].join(' ')}
            >
              <span className="h-4 w-px bg-[var(--devlens-hairline-strong)]" />
            </div>
          )
        }

        if (node.kind === 'folder') {
          const open = dropdown?.id === node.id
          return (
            <div key={node.id} {...shared} {...dropHandlers(node)}>
              <button
                type="button"
                data-testid="bookmark-bar-folder"
                data-folder-name={node.title ?? ''}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`Open the ${node.title ?? 'folder'} folder`}
                title={`${node.title ?? 'Folder'} - click for its contents, right-click for options`}
                onClick={(event) => openDropdown(event, node.id, 300)}
                onContextMenu={(event) => openMenu(event, { kind: 'folder', node })}
                className="flex h-7 max-w-[180px] cursor-grab items-center gap-2 rounded px-2 text-left transition-colors hover:bg-white/[0.06]"
              >
                {open ? (
                  <FolderOpen size={12} className="shrink-0 text-[var(--devlens-accent)]" />
                ) : (
                  <Folder size={12} className="shrink-0 text-ink-400" />
                )}
                <span className="truncate text-[11px] text-ink-300">{node.title ?? 'Folder'}</span>
                <ChevronDown size={9} className="shrink-0 text-ink-600" />
              </button>
              {open && dropdown && (
                <FolderMenu
                  x={dropdown.x}
                  y={dropdown.y}
                  node={node}
                  icons={icons}
                  onOpen={onOpen}
                  onClose={() => setDropdown(null)}
                  onAction={(action) => onAction(action, { kind: 'folder', node })}
                />
              )}
            </div>
          )
        }

        return (
          <div key={node.id} {...shared} {...dropHandlers(node)} className={[shared.className, 'flex'].join(' ')}>
            <BarItem
              node={node}
              icon={icons[originOf(node.url ?? '')]}
              onOpen={onOpen}
              onContextMenu={(event) => openMenu(event, { kind: 'bookmark', node })}
            />
          </div>
        )
      })}

      {/* The blank end of the bar: a right-click target and the drop zone for "move to the end". */}
      <div
        data-testid="bookmarks-bar-blank"
        aria-hidden="true"
        className="h-7 min-w-8 flex-1 shrink-0"
        title={barSummary(items)}
      />

      {/* The chip is the switch's own state, not a consequence of what is filed: an "Other
          bookmarks" button that vanished when the folder was emptied would read as a bug. */}
      {options.showOtherBookmarks && (
        <div className="shrink-0">
          <button
            type="button"
            data-testid="other-bookmarks-chip"
            aria-haspopup="menu"
            aria-expanded={dropdown?.id === 'other'}
            aria-label="Other bookmarks"
            title="Bookmarks menu and other bookmarks"
            onClick={(event) => openDropdown(event, 'other', 300)}
            onContextMenu={(event) => openMenu(event, { kind: 'blank' })}
            className="flex h-7 max-w-[160px] items-center gap-2 rounded px-2 text-left transition-colors hover:bg-white/[0.06]"
          >
            <Folder size={12} className="shrink-0 text-ink-400" />
            <span className="truncate text-[11px] text-ink-300">Other bookmarks</span>
            <ChevronDown size={9} className="shrink-0 text-ink-600" />
          </button>
          {dropdown?.id === 'other' && (
            <div
              role="menu"
              aria-label="Other bookmarks"
              data-testid="other-bookmarks-menu"
              style={{ left: dropdown.x, top: dropdown.y }}
              className="fixed z-[70] max-h-[60vh] w-[300px] overflow-y-auto rounded-xl border border-[var(--devlens-hairline)] bg-[color-mix(in_srgb,var(--color-ink-950)_97%,transparent)] py-1 shadow-2xl"
            >
              {(
                [
                  ['Bookmarks Menu', tree.menu],
                  ['Other Bookmarks', tree.other]
                ] as const
              ).map(([label, nodes]) =>
                nodes.length === 0 ? null : (
                  <div key={label}>
                    <p className="px-3 py-1 font-mono text-[9px] tracking-wide text-ink-600 uppercase">
                      {label}
                    </p>
                    <FolderEntries
                      nodes={nodes}
                      icons={icons}
                      onOpen={onOpen}
                      onClose={() => setDropdown(null)}
                    />
                  </div>
                )
              )}
              <button
                type="button"
                data-testid="other-open-all"
                onClick={() => {
                  setDropdown(null)
                  onAction('open-all-folder', { kind: 'folder', node: { id: 'other', kind: 'folder', addedAt: 0, title: 'Other bookmarks', children: otherRoots } })
                }}
                className="mt-1 w-full border-t border-[var(--devlens-hairline)] px-3 py-1.5 text-left text-[11px] text-ink-200 transition-colors hover:bg-white/[0.04]"
              >
                Open All in Tabs
              </button>
            </div>
          )}
        </div>
      )}

      {menu && (
        <BookmarksMenu
          x={menu.x}
          y={menu.y}
          target={menu.target}
          toolbarVisible={options.toolbarVisible}
          showOtherBookmarks={options.showOtherBookmarks}
          canAddBookmark={Boolean(page)}
          canExport={items.length > 0 || otherRoots.length > 0}
          hasClipboard={hasClipboard}
          onAction={onAction}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}

/** One link on the bar: the site's icon (or its initial) followed by the saved name. */
function BarItem({
  node,
  icon,
  onOpen,
  onContextMenu
}: {
  node: BookmarkNode
  icon?: string
  onOpen: BookmarksBarProps['onOpen']
  onContextMenu: (event: ReactMouseEvent) => void
}) {
  const [broken, setBroken] = useState(false)
  const url = node.url ?? ''
  const title = node.title || url
  const host = hostOf(url)

  return (
    <button
      type="button"
      data-testid="bookmark-bar-item"
      data-url={url}
      aria-label={`Open ${title}`}
      title={url}
      onClick={(event) => onOpen(url, { newTab: event.altKey || event.ctrlKey || event.metaKey })}
      onAuxClick={(event) => {
        if (event.button !== 1) return
        event.preventDefault()
        onOpen(url, { newTab: true })
      }}
      onContextMenu={onContextMenu}
      className="flex h-7 max-w-[180px] cursor-grab items-center gap-2 rounded px-2 text-left transition-colors hover:bg-white/[0.06]"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon && !broken ? (
          <img
            data-testid="bookmark-bar-icon"
            src={icon}
            alt=""
            aria-hidden="true"
            draggable={false}
            onError={() => setBroken(true)}
            className="h-3.5 w-3.5 rounded-[3px] object-contain"
          />
        ) : host ? (
          <span
            aria-hidden="true"
            className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-white/10 font-mono text-[8px] leading-none text-ink-200 uppercase"
          >
            {host.slice(0, 1)}
          </span>
        ) : (
          <Globe size={12} className="text-ink-500" />
        )}
      </span>
      <span className="truncate text-[11px] text-ink-300">{title}</span>
    </button>
  )
}

/** What a folder opens into: its contents, then "Open All in Tabs" at the foot. */
function FolderMenu({
  x,
  y,
  node,
  icons,
  onOpen,
  onAction,
  onClose
}: {
  x: number
  y: number
  node: BookmarkNode
  icons: Record<string, string>
  onOpen: BookmarksBarProps['onOpen']
  onAction: (action: BookmarkMenuAction) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    const onPointerDown = (event: PointerEvent): void => {
      const element = event.target as HTMLElement | null
      if (element?.closest('[data-testid="bookmark-folder-menu"]')) return
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [onClose])

  const children = node.children ?? []
  return (
    <div
      role="menu"
      aria-label={`${node.title ?? 'Folder'} contents`}
      data-testid="bookmark-folder-menu"
      style={{ left: x, top: y }}
      className="fixed z-[70] max-h-[60vh] w-[300px] overflow-y-auto rounded-xl border border-[var(--devlens-hairline)] bg-[color-mix(in_srgb,var(--color-ink-950)_97%,transparent)] py-1 shadow-2xl"
    >
      {children.length === 0 ? (
        <p className="px-3 py-2 font-mono text-[10px] text-ink-600">this folder is empty</p>
      ) : (
        <FolderEntries nodes={children} icons={icons} onOpen={onOpen} onClose={onClose} />
      )}
      <button
        type="button"
        data-testid="folder-open-all"
        disabled={children.length === 0}
        onClick={() => {
          onAction('open-all-folder')
          onClose()
        }}
        className="mt-1 w-full border-t border-[var(--devlens-hairline)] px-3 py-1.5 text-left text-[11px] text-ink-200 transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:text-ink-600"
      >
        Open All in Tabs
      </button>
    </div>
  )
}

/** The rows of a folder menu, one level deep: a nested folder opens the same list again. */
function FolderEntries({
  nodes,
  icons,
  onOpen,
  onClose
}: {
  nodes: BookmarkNode[]
  icons: Record<string, string>
  onOpen: BookmarksBarProps['onOpen']
  onClose: () => void
}) {
  const [nested, setNested] = useState<string | null>(null)

  return (
    <ul className="flex flex-col">
      {nodes.map((child) => {
        if (child.kind === 'separator') {
          return (
            <li key={child.id} aria-hidden="true" className="mx-3 my-1 h-px bg-[var(--devlens-hairline)]" />
          )
        }
        if (child.kind === 'folder') {
          const open = nested === child.id
          return (
            <li key={child.id} className="relative">
              <button
                type="button"
                data-testid="folder-entry-folder"
                data-folder-name={child.title ?? ''}
                aria-label={`${child.title ?? 'Folder'} folder`}
                onClick={(event) => {
                  event.stopPropagation()
                  setNested(open ? null : child.id)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
              >
                <Folder size={12} className="shrink-0 text-ink-400" />
                <span className="min-w-0 flex-1 truncate text-[11px] text-ink-200">
                  {child.title ?? 'Folder'}
                </span>
                <ChevronRight size={11} className="shrink-0 text-ink-600" />
              </button>
              {open && (
                <div className="ml-2 border-l border-[var(--devlens-hairline)] pl-1">
                  <FolderEntries nodes={child.children ?? []} icons={icons} onOpen={onOpen} onClose={onClose} />
                </div>
              )}
            </li>
          )
        }
        const url = child.url ?? ''
        return (
          <li key={child.id}>
            <button
              type="button"
              data-testid="folder-entry"
              data-url={url}
              title={url}
              onClick={(event) => {
                onClose()
                onOpen(url, { newTab: event.altKey || event.ctrlKey || event.metaKey })
              }}
              onAuxClick={(event) => {
                if (event.button !== 1) return
                event.preventDefault()
                onClose()
                onOpen(url, { newTab: true })
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {icons[originOf(url)] ? (
                  <img
                    src={icons[originOf(url)]}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="h-3.5 w-3.5 rounded-[3px] object-contain"
                  />
                ) : (
                  <Globe size={11} className="text-ink-500" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-ink-200">
                {child.title || url}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Icons are cached per origin, so a bar full of one site's pages asks for one image. */
function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

/** Count of the links on the bar, for the blank strip's tooltip. */
function barSummary(nodes: BookmarkNode[]): string {
  const count = nodes.filter((node) => node.kind === 'bookmark').length
  return `${count} bookmark${count === 1 ? '' : 's'} - right-click for the toolbar options`
}
