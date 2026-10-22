import { useState } from 'react'
import { Bookmark, ChevronRight, ExternalLink, Folder, Trash2 } from 'lucide-react'
import type { BookmarkNode, BookmarkOptions, BookmarkTree } from '@shared/types'

interface BookmarksPanelProps {
  tree: BookmarkTree
  options: BookmarkOptions
  onOpen: (url: string, options?: { newTab?: boolean }) => void
  /** Opens every address under a folder, in its own tab. */
  onOpenAll: (urls: string[], label: string) => void
  onRemoveNode: (id: string) => void
  onToggleOption: (patch: Partial<BookmarkOptions>) => void
}

const ROOTS: { id: keyof BookmarkTree; label: string }[] = [
  { id: 'toolbar', label: 'Bookmarks Toolbar' },
  { id: 'menu', label: 'Bookmarks Menu' },
  { id: 'other', label: 'Other Bookmarks' }
]

function urlsUnder(node: BookmarkNode): string[] {
  if (node.kind === 'bookmark') return node.url ? [node.url] : []
  return (node.children ?? []).flatMap(urlsUnder)
}

/**
 * Bookmarks and folders.
 *
 * The same tree the bar draws, read as a list: useful when the bar is hidden, when a folder is
 * deep, or when the operator wants to see all three roots at once. Editing stays on the bar - this
 * is the view, with the two visibility switches that decide what the bar shows.
 */
export function BookmarksPanel({
  tree,
  options,
  onOpen,
  onOpenAll,
  onRemoveNode,
  onToggleOption
}: BookmarksPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ toolbar: true })
  const total = ROOTS.reduce((count, root) => count + urlsUnder({ kind: 'folder', id: root.id, addedAt: 0, children: tree[root.id] }).length, 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="bookmarks-panel">
      <div className="shrink-0 border-b border-[var(--devlens-hairline)] px-3 py-2">
        <div className="flex items-center gap-2">
          <Bookmark size={13} className="shrink-0 text-[var(--devlens-accent)]" />
          <span className="min-w-0 flex-1 text-[11px] text-ink-200">
            {total} bookmark{total === 1 ? '' : 's'}
          </span>
        </div>
        <label className="mt-2 flex items-center gap-2 text-[10px] text-ink-400">
          <input
            type="checkbox"
            data-testid="bookmarks-option-bar"
            checked={options.toolbarVisible}
            onChange={(event) => onToggleOption({ toolbarVisible: event.target.checked })}
            className="h-3.5 w-3.5 accent-[var(--devlens-accent)]"
          />
          Always show the bookmarks toolbar
        </label>
        <label className="mt-1 flex items-center gap-2 text-[10px] text-ink-400">
          <input
            type="checkbox"
            data-testid="bookmarks-option-other"
            checked={options.showOtherBookmarks}
            onChange={(event) => onToggleOption({ showOtherBookmarks: event.target.checked })}
            className="h-3.5 w-3.5 accent-[var(--devlens-accent)]"
          />
          Show other bookmarks on the bar
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {ROOTS.map((root) => {
          const nodes = tree[root.id]
          const open = expanded[root.id] ?? false
          return (
            <section key={root.id}>
              <div className="flex items-center gap-1 px-2">
                <button
                  type="button"
                  data-testid="bookmarks-root"
                  data-root={root.id}
                  aria-expanded={open}
                  onClick={() => setExpanded((current) => ({ ...current, [root.id]: !open }))}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <ChevronRight
                    size={11}
                    className={['shrink-0 text-ink-600 transition-transform', open ? 'rotate-90' : ''].join(' ')}
                  />
                  <Folder size={11} className="shrink-0 text-ink-500" />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-ink-200">
                    {root.label}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-ink-600">
                    {urlsUnder({ kind: 'folder', id: root.id, addedAt: 0, children: nodes }).length}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Open every bookmark in ${root.label}`}
                  title="Open all in tabs"
                  onClick={() =>
                    onOpenAll(
                      urlsUnder({ kind: 'folder', id: root.id, addedAt: 0, children: nodes }),
                      root.label
                    )
                  }
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-600 transition-colors hover:bg-white/10 hover:text-ink-200"
                >
                  <ExternalLink size={11} />
                </button>
              </div>

              {open && (
                <div className="pl-5">
                  <NodeList
                    nodes={nodes}
                    depth={0}
                    onOpen={onOpen}
                    onOpenAll={onOpenAll}
                    onRemoveNode={onRemoveNode}
                  />
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function NodeList({
  nodes,
  depth,
  onOpen,
  onOpenAll,
  onRemoveNode
}: {
  nodes: BookmarkNode[]
  depth: number
  onOpen: BookmarksPanelProps['onOpen']
  onOpenAll: BookmarksPanelProps['onOpenAll']
  onRemoveNode: (id: string) => void
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  if (nodes.length === 0) {
    return <p className="py-1 pl-2 font-mono text-[9px] text-ink-600">empty</p>
  }

  return (
    <>
      {nodes.map((node) => {
        if (node.kind === 'separator') {
          return <div key={node.id} className="bookmark-separator-menu" />
        }
        if (node.kind === 'folder') {
          const expanded = open[node.id] ?? false
          return (
            <div key={node.id}>
              <div className="group flex items-center gap-1">
                <button
                  type="button"
                  data-testid="bookmarks-folder"
                  data-folder-name={node.title ?? ''}
                  aria-expanded={expanded}
                  onClick={() => setOpen((current) => ({ ...current, [node.id]: !expanded }))}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <ChevronRight
                    size={11}
                    className={['shrink-0 text-ink-600 transition-transform', expanded ? 'rotate-90' : ''].join(' ')}
                  />
                  <Folder size={11} className="shrink-0 text-ink-500" />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-ink-300">
                    {node.title ?? 'Folder'}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-ink-600">
                    {urlsUnder(node).length}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Open every bookmark in ${node.title ?? 'folder'}`}
                  onClick={() => onOpenAll(urlsUnder(node), node.title ?? 'that folder')}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-600 opacity-0 transition-colors group-hover:opacity-100 hover:bg-white/10 hover:text-ink-200"
                >
                  <ExternalLink size={11} />
                </button>
              </div>
              {expanded && (
                <div className="pl-4">
                  <NodeList
                    nodes={node.children ?? []}
                    depth={depth + 1}
                    onOpen={onOpen}
                    onOpenAll={onOpenAll}
                    onRemoveNode={onRemoveNode}
                  />
                </div>
              )}
            </div>
          )
        }
        const url = node.url ?? ''
        return (
          <div key={node.id} className="group flex min-w-0 items-center gap-1" data-testid="bookmarks-row">
            <button
              type="button"
              data-url={url}
              title={url}
              onClick={(event) =>
                onOpen(url, { newTab: event.altKey || event.ctrlKey || event.metaKey })
              }
              onAuxClick={(event) => {
                if (event.button !== 1) return
                event.preventDefault()
                onOpen(url, { newTab: true })
              }}
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left transition-colors hover:bg-white/[0.04]"
            >
              <Bookmark size={10} className="shrink-0 text-ink-600" />
              <span className="min-w-0 flex-1 truncate text-[11px] text-ink-200">
                {node.title || url}
              </span>
            </button>
            <button
              type="button"
              aria-label={`Delete ${node.title || url}`}
              title="Delete this bookmark"
              onClick={() => onRemoveNode(node.id)}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-600 opacity-0 transition-colors group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Trash2 size={10} />
            </button>
          </div>
        )
      })}
    </>
  )
}
