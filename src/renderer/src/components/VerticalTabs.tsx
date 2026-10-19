import { useState } from 'react'
import { Globe, Plus, VenetianMask, VolumeX, X } from 'lucide-react'
import type { PageTab } from '@renderer/components/TabStrip'
import { TabContextMenu, type TabMenuAction } from '@renderer/components/TabContextMenu'
import { internalRouteOf } from '@shared/routes'
import { DevLensMark } from '@renderer/components/DevLensMark'

interface VerticalTabsProps {
  tabs: PageTab[]
  activeId: string | null
  icons?: Record<string, string>
  notifiedTabIds?: Set<string>
  canReopen: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNewTab: () => void
  onTabAction: (action: TabMenuAction, tabId: string) => void
}

function TabMark({ tab, icon }: { tab: PageTab; icon?: string }) {
  if (tab.private) return <VenetianMask size={14} className="text-[var(--devlens-stealth)]" />
  if (internalRouteOf(tab.url)) return <DevLensMark size={14} className="text-[var(--devlens-accent)]" />
  if (icon) return <img src={icon} alt="" className="h-3.5 w-3.5 rounded-[3px] object-contain" />
  if (tab.host) {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-white/10 font-mono text-[8px] text-ink-200">
        {tab.host.replace(/^www\./, '').slice(0, 1).toUpperCase()}
      </span>
    )
  }
  return <Globe size={12} className="text-ink-500" />
}

/** A vertical tab rail for wide developer workspaces. */
export function VerticalTabs({
  tabs,
  activeId,
  icons = {},
  notifiedTabIds = new Set(),
  canReopen,
  onSelect,
  onClose,
  onNewTab,
  onTabAction
}: VerticalTabsProps) {
  const [menu, setMenu] = useState<{ tabId: string; x: number; y: number } | null>(null)

  return (
    <aside
      data-testid="vertical-tabs"
      className="flex w-[220px] shrink-0 flex-col border-r border-[var(--devlens-hairline)] bg-ink-900/70"
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--devlens-hairline)] px-3">
        <span className="font-mono text-[9px] uppercase tracking-wide text-ink-500">
          {tabs.length} tabs
        </span>
        <button
          type="button"
          onClick={onNewTab}
          aria-label="New tab"
          className="flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:bg-white/5 hover:text-ink-100"
        >
          <Plus size={13} />
        </button>
      </div>
      <div role="tablist" aria-label="Open pages" className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {tabs.map((tab) => {
          const active = tab.id === activeId
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              data-testid="vertical-page-tab"
              onClick={() => onSelect(tab.id)}
              onContextMenu={(event) => {
                event.preventDefault()
                setMenu({
                  tabId: tab.id,
                  x: Math.min(event.clientX, window.innerWidth - 310),
                  y: Math.min(event.clientY, window.innerHeight - 300)
                })
              }}
              className={[
                'group mb-1 flex min-h-9 items-center gap-2 rounded-md border px-2 py-1.5 transition-colors',
                active
                  ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                  : 'border-transparent text-ink-400 hover:border-[var(--devlens-hairline)] hover:bg-white/[0.035]'
              ].join(' ')}
            >
              <TabMark tab={tab} icon={icons[tab.id]} />
              <span className={['min-w-0 flex-1 truncate text-[10px]', active ? 'text-ink-100' : ''].join(' ')}>
                {tab.title || tab.host || 'New tab'}
              </span>
              {notifiedTabIds.has(tab.id) && !active && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--devlens-accent)]" />
              )}
              {tab.muted && <VolumeX size={10} className="shrink-0 text-ink-500" />}
              <button
                type="button"
                aria-label={`Close ${tab.title || 'tab'}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onClose(tab.id)
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-500 opacity-0 hover:bg-white/10 hover:text-ink-100 group-hover:opacity-100"
              >
                <X size={11} />
              </button>
            </div>
          )
        })}
      </div>

      {menu && (
        <TabContextMenu
          x={menu.x}
          y={menu.y}
          tab={tabs.find((tab) => tab.id === menu.tabId) ?? { id: '', title: '', url: null }}
          canReopen={canReopen}
          context={{
            index: tabs.findIndex((tab) => tab.id === menu.tabId),
            total: tabs.length,
            hasDuplicates: tabs.filter(
              (tab) => tab.id !== menu.tabId && tab.url && tab.url === tabs.find((entry) => entry.id === menu.tabId)?.url
            ).length > 0
          }}
          onAction={onTabAction}
          onClose={() => setMenu(null)}
        />
      )}
    </aside>
  )
}
