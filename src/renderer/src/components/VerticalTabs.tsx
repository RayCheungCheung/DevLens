import { Fragment, useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Globe,
  Plus,
  VenetianMask,
  VolumeX,
  X
} from 'lucide-react'
import type { PageTab } from '@renderer/components/TabStrip'
import { TabContextMenu, type TabMenuAction } from '@renderer/components/TabContextMenu'
import { internalRouteOf } from '@shared/routes'
import type { TabGroup } from '@shared/tabs'
import { DevLensMark } from '@renderer/components/DevLensMark'
import { TabGroupDialog } from '@renderer/components/TabGroupDialog'

interface VerticalTabsProps {
  tabs: PageTab[]
  activeId: string | null
  splitTabIds?: Set<string>
  tabGroups?: TabGroup[]
  tabGroupsEnabled?: boolean
  icons?: Record<string, string>
  notifiedTabIds?: Set<string>
  canReopen: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNewTab: () => void
  onTabAction: (action: TabMenuAction, tabId: string, groupId?: string, partnerId?: string) => void
  onAssignTabToGroup: (tabId: string, groupId: string | null) => void
  onToggleTabGroup: (groupId: string) => void
  onCreateTabGroup: (tabId: string, name: string, color: string) => void
}

function validFaviconDataUrl(value: string | undefined): value is string {
  return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(value)
}

function domainInitial(host: string): string {
  let label = host.toLowerCase().trim().replace(/^www\./, '')
  const port = label.indexOf(':')
  if (port !== -1) label = label.slice(0, port)
  const parts = label.split('.')
  const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
  return (base ?? '').replace(/[^a-z0-9]/g, '').slice(0, 1).toUpperCase()
}

function TabMark({ tab, icon }: { tab: PageTab; icon?: string }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [icon])
  if (tab.private) return <VenetianMask size={14} className="text-[var(--devlens-stealth)]" />
  if (internalRouteOf(tab.url)) return <DevLensMark size={14} className="text-[var(--devlens-accent)]" />
  if (validFaviconDataUrl(icon) && !broken) {
    return (
      <img
        src={icon}
        alt=""
        onError={() => setBroken(true)}
        className="h-3.5 w-3.5 rounded-[3px] object-contain"
      />
    )
  }
  const initial = domainInitial(tab.host)
  if (initial) {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-white/10 font-mono text-[8px] text-ink-200">
        {initial}
      </span>
    )
  }
  return <Globe size={12} className="text-ink-500" />
}

/** A vertical tab rail for wide developer workspaces. */
export function VerticalTabs({
  tabs,
  activeId,
  splitTabIds = new Set(),
  tabGroups = [],
  tabGroupsEnabled = true,
  icons = {},
  notifiedTabIds = new Set(),
  canReopen,
  onSelect,
  onClose,
  onNewTab,
  onTabAction,
  onAssignTabToGroup,
  onToggleTabGroup,
  onCreateTabGroup
}: VerticalTabsProps) {
  const [menu, setMenu] = useState<{ tabId: string; x: number; y: number } | null>(null)
  const [groupDialogTabId, setGroupDialogTabId] = useState<string | null>(null)
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)

  const splitPartnerFor = (tabId: string): { id: string; title: string } | undefined => {
    const index = tabs.findIndex((tab) => tab.id === tabId)
    if (index < 0) return undefined
    const current = tabs[index]
    if (!current.url || current.unloaded || internalRouteOf(current.url)) return undefined
    const partner = [tabs[index + 1], tabs[index - 1]].find(
      (tab) => tab?.url && !tab.unloaded && !internalRouteOf(tab.url)
    )
    return partner ? { id: partner.id, title: partner.title || partner.host } : undefined
  }

  const orderedTabs: PageTab[] = []
  const emittedGroups = new Set<string>()
  for (const tab of tabs) {
    if (!tab.groupId) {
      orderedTabs.push(tab)
      continue
    }
    if (emittedGroups.has(tab.groupId)) continue
    emittedGroups.add(tab.groupId)
    orderedTabs.push(...tabs.filter((entry) => entry.groupId === tab.groupId))
  }
  const firstGroupTabs = new Set(
    [...emittedGroups].map(
      (groupId) => orderedTabs.find((tab) => tab.groupId === groupId)?.id ?? ''
    )
  )

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
        {orderedTabs.map((tab) => {
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
                  data-testid="vertical-tab-group"
                  data-group-id={group.id}
                  aria-expanded={!collapsed}
                  onClick={() => onToggleTabGroup(group.id)}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragOverGroupId(group.id)
                  }}
                  onDragLeave={() => setDragOverGroupId((current) => current === group.id ? null : current)}
                  onDrop={(event) => {
                    event.preventDefault()
                    const draggedId = event.dataTransfer.getData('application/x-devlens-tab')
                    setDragOverGroupId(null)
                    if (draggedId) onAssignTabToGroup(draggedId, group.id)
                  }}
                  className={[
                    'mb-1 flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-left',
                    dragOverGroupId === group.id
                      ? 'border-white/30 bg-white/[0.08]'
                      : 'border-[var(--devlens-hairline)] bg-white/[0.025]'
                  ].join(' ')}
                  title={`${group.name} - click to ${collapsed ? 'expand' : 'collapse'}`}
                >
                  {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                  <Folder size={10} style={{ color: group.color }} />
                  <span className="min-w-0 flex-1 truncate text-[9px] text-ink-300">{group.name}</span>
                  <span className="font-mono text-[8px] text-ink-600">
                    {tabs.filter((entry) => entry.groupId === group.id).length}
                  </span>
                </button>
              )}
              {(!collapsed || active) && (
            <div
              role="tab"
              aria-selected={active}
              data-testid="vertical-page-tab"
              data-split={splitTabIds.has(tab.id) ? 'true' : 'false'}
              data-group-id={tab.groupId ?? ''}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('application/x-devlens-tab', tab.id)
              }}
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
                  : splitTabIds.has(tab.id)
                    ? 'border-[var(--devlens-accent-line)] bg-white/[0.025] text-ink-300'
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
              )}
            </Fragment>
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
            ).length > 0,
            splitPartner: splitPartnerFor(menu.tabId),
            tabGroups: tabGroupsEnabled ? tabGroups : undefined
          }}
          onAction={handleMenuAction}
          onClose={() => setMenu(null)}
        />
      )}
      {groupDialogTabId && (
        <TabGroupDialog
          onSave={(name, color) => onCreateTabGroup(groupDialogTabId, name, color)}
          onClose={() => setGroupDialogTabId(null)}
        />
      )}
    </aside>
  )
}
