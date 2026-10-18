import { useCallback, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import {
  Bookmark,
  Cookie,
  History,
  Monitor,
  Network,
  Paintbrush,
  Radar,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Terminal
} from 'lucide-react'
import type { ReconSnapshot } from '@shared/recon'
import type {
  AiContextChip,
  BookmarkOptions,
  BookmarkTree,
  HistoryEntry,
  LocalServer,
  LogEntry,
  NetworkEntry,
  ProtectionState,
  ViewportId,
  WorkspaceEntry,
  WimhState
} from '@shared/types'
import { dockToolsFor, isDevMode, type DockToolId, type WorkspaceMode } from '@shared/mode'
import type { ProtectionLevel } from '@shared/protection'
import type { SidebarTogglePosition, ToolbarTools } from '@shared/preferences'
import { aiSite, type AiSiteId } from '@shared/ai-sites'
import { AiMark } from '@renderer/components/AiMark'
import { MARK_BOX } from '@renderer/components/PrefixIcons'
import type { InterceptorStore } from '@renderer/hooks/useInterceptorStore'
import type { LogCounts } from '@renderer/hooks/useLogStore'
import { AiAssistantPanel } from '@renderer/components/AiAssistantPanel'
import { BookmarksPanel } from '@renderer/components/BookmarksPanel'
import { ConsolePanel } from '@renderer/components/ConsolePanel'
import { DesignPanel, type DesignTarget } from '@renderer/components/DesignPanel'
import { HistoryPanel } from '@renderer/components/HistoryPanel'
import { InterceptorPanel } from '@renderer/components/InterceptorPanel'
import { ReconPanel } from '@renderer/components/ReconPanel'
import { DefensePanel } from '@renderer/components/DefensePanel'
import { ServersPanel } from '@renderer/components/ServersPanel'
import { SettingsPanel } from '@renderer/components/SettingsPanel'
import { StoragePanel, type CookieRecord, type StorageArea } from '@renderer/components/StoragePanel'
import { ViewportPanel } from '@renderer/components/ViewportPanel'

/** The panel the dock has selected. Same ids as the dock table, so nothing can drift. */
export type SidebarPanel = DockToolId

interface SidebarProps {
  width: number
  onWidthChange: (width: number) => void
  mode: WorkspaceMode
  /** Controlled so omnibox commands (`>sec`, `>design`, `>intercept`) can switch tools. */
  panel: SidebarPanel
  onPanelChange: (panel: SidebarPanel) => void
  /** Whether the panel column is showing; the dock itself is always there. */
  open: boolean
  onOpenChange: (open: boolean) => void
  activeView: ViewportId
  activeUrl: string
  activeTitle: string
  profileId: string
  profileName: string
  logs: {
    entries: LogEntry[]
    counts: LogCounts
    onClear: () => void
    onOpenSource: (sourceUrl: string, line: number) => void
    failedRequests: NetworkEntry[]
  }
  design: {
    css: string
    onCssChange: (css: string) => void
    designMode: boolean
    onDesignModeChange: (enabled: boolean) => void
    target: DesignTarget
    onTargetChange: (target: DesignTarget) => void
    onApply: () => void
    onClear: () => void
    status: string | null
    appliedAt: number | null
    dirty?: boolean
  }
  interceptor: {
    store: InterceptorStore
    onNotice: (message: string) => void
  }
  recon: {
    snapshot: ReconSnapshot
    outputDir: string | null
    onNotice: (message: string) => void
  }
  ai: {
    chips: AiContextChip[]
    /** The provider this profile last used; the dock's AI button wears its branding. */
    provider: AiSiteId
    onProviderChange: (provider: AiSiteId) => void
  }
  defense: {
    state: WimhState | null
    busy: boolean
    onToggle: (enabled: boolean) => void
    onScrub: () => void
    onClipboardTtl: (ms: number) => void
    onExitSession: () => void
    onNotice: (message: string) => void
  }
  /** Everyday panels: history, bookmarks and settings. */
  everyday: {
    onNotice: (message: string) => void
    history: HistoryEntry[]
    onOpenHistory: (url: string, options?: { newTab?: boolean }) => void
    onClearHistory: () => void
    tree: BookmarkTree
    bookmarkOptions: BookmarkOptions
    onOpenAllBookmarks: (urls: string[], label: string) => void
    onRemoveBookmarkNode: (id: string) => void
    onBookmarkOptions: (patch: Partial<BookmarkOptions>) => void
    protection: ProtectionState
    onProtection: (level: ProtectionLevel) => void
    profileAsk: boolean
    onProfileAsk: (ask: boolean) => void
    /** Chrome arrangement: where the dock handle sits and which tools the toolbar shows. */
    layout: { sidebarToggle: SidebarTogglePosition; tools: ToolbarTools }
    onLayout: (patch: { sidebarToggle?: SidebarTogglePosition; tools?: Partial<ToolbarTools> }) => void
    /** Opens the omnibox control panel (`devlens:settings/omnibox`) as a tab. */
    onOpenOmniboxSettings: () => void
  }
  /** Developer panels that are not one of the original five. */
  tools: {
    servers: LocalServer[]
    scanning: boolean
    workspace: WorkspaceEntry | null
    onScan: () => void
    onOpenUrl: (url: string, options?: { newTab?: boolean }) => void
    onOpenWorkspaceInIde: () => void
    deviceId: string
    onDeviceIndex: (deviceId: string) => void
    onActiveView: (view: ViewportId) => void
    /** False while a DevLens system page owns the canvas. */
    viewportAvailable: boolean
    desktopWidth: number | null
    onDesktopWidth: (width: number | null) => void
    syncEnabled: boolean
    onSyncChange: (enabled: boolean) => void
    cookies: CookieRecord[]
    storage: StorageArea[]
    storageBusy: boolean
    storageError: string | null
    onRefreshStorage: () => void
    onRemoveCookie: (name: string) => void
    onRemoveStorageEntry: (area: StorageArea['id'], key: string) => void
    onClearSiteStorage: () => void
  }
}

const MIN_WIDTH = 340
const MAX_WIDTH = 860
/** The overlay the AI panel becomes over a mobile preview. */
const OVERLAY_WIDTH = 380

const ICONS: Record<DockToolId, typeof Terminal> = {
  ai: Sparkles,
  bookmarks: Bookmark,
  history: History,
  console: Terminal,
  interceptor: Network,
  servers: Server,
  viewport: Monitor,
  design: Paintbrush,
  storage: Cookie,
  recon: Radar,
  defense: ShieldCheck,
  settings: Settings
}

/**
 * The dock.
 *
 * A mode-aware left rail: in normal mode it offers the everyday four and nothing else, in dev mode
 * it expands to the whole toolset. The list itself comes from `DOCK_TOOLS` in shared code, so the
 * rail cannot offer a tool the mode does not allow - the filter and the panel-availability answer
 * come from one table.
 *
 * The panel column beside it is one `<aside>`, and it has two placements: the usual column, and -
 * when the AI panel is open over a mobile preview - a floating panel in the corner of the canvas,
 * so reading an AI answer never means giving up the mobile frame you were checking.
 */
export function Sidebar({
  width,
  onWidthChange,
  mode,
  panel,
  onPanelChange,
  open,
  onOpenChange,
  activeView,
  activeUrl,
  activeTitle,
  profileId,
  profileName,
  logs,
  design,
  interceptor,
  recon,
  defense,
  ai,
  everyday,
  tools
}: SidebarProps) {
  const dragging = useRef(false)
  const dev = isDevMode(mode)
  const dockTools = dockToolsFor(mode)
  const mainTools = dockTools.filter((tool) => tool.slot === 'main')
  const footerTools = dockTools.filter((tool) => tool.slot === 'footer')

  const startResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      dragging.current = true
      const startX = event.clientX
      const startWidth = width

      const move = (moveEvent: MouseEvent): void => {
        if (!dragging.current) return
        // The dock is on the left, so widening the panel means dragging its edge left.
        const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (moveEvent.clientX - startX)))
        onWidthChange(next)
      }
      const stop = (): void => {
        dragging.current = false
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', stop)
        document.body.style.cursor = ''
      }

      document.body.style.cursor = 'col-resize'
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', stop)
    },
    [onWidthChange, width]
  )

  const badges: Partial<Record<SidebarPanel, { value: number; tone: 'danger' | 'warn' }>> = {}
  if (logs.counts.errors > 0) badges.console = { value: logs.counts.errors, tone: 'danger' }
  if (interceptor.store.paused.length > 0) {
    badges.interceptor = { value: interceptor.store.paused.length, tone: 'warn' }
  }

  const activeTool = dockTools.find((tool) => tool.id === panel) ?? dockTools[0]
  /** The AI button wears the provider this profile last used, not a generic sparkle. */
  const aiBrand = aiSite(ai.provider)
  /** The AI panel over a mobile preview floats instead of taking a column. */
  const overlay = panel === 'ai' && dev && activeView === 'mobile'
  const showPanel = open && !overlay

  const select = (id: SidebarPanel): void => {
    if (id === panel && open) {
      onOpenChange(false)
      return
    }
    onPanelChange(id)
    onOpenChange(true)
  }

  return (
    <>
      <nav
        data-testid="dock"
        data-mode={mode}
        aria-label="Dock"
        className="nova-glass flex w-12 shrink-0 flex-col items-center justify-start gap-1 py-2"
      >
        {mainTools.map((tool) => (
          <DockButton
            key={tool.id}
            id={tool.id}
            label={tool.label}
            /* The provider is context, not part of the button's name: the accessible name is the
               tool, and the tooltip is where "which assistant, exactly" belongs. */
            hint={tool.id === 'ai' ? `${tool.label} - ${aiBrand.label}` : undefined}
            icon={ICONS[tool.id]}
            active={panel === tool.id && (open || overlay)}
            badge={badges[tool.id]}
            mark={tool.id === 'ai' ? { brand: aiBrand.id } : undefined}
            onClick={() => select(tool.id)}
          />
        ))}

        <span className="min-h-2 flex-1" />

        {footerTools.map((tool) => (
          <DockButton
            key={tool.id}
            id={tool.id}
            label={tool.label}
            icon={ICONS[tool.id]}
            active={panel === tool.id && open}
            onClick={() => select(tool.id)}
          />
        ))}
      </nav>

      {(showPanel || overlay) && (
        <aside
          data-testid="side-panel"
          data-panel={panel}
          data-mode={mode}
          data-developer={dev ? 'true' : 'false'}
          data-placement={overlay ? 'overlay' : 'column'}
          className={[
            'nova-glass flex min-h-0 flex-col border-[var(--devlens-hairline)]',
            overlay
              ? 'fixed right-3 bottom-12 z-[60] rounded-xl border shadow-2xl'
              : 'relative shrink-0 border-r'
          ].join(' ')}
          style={overlay ? { width: `${OVERLAY_WIDTH}px`, maxHeight: '72vh' } : { width: `${width}px` }}
        >
          {!overlay && (
            <div
              onMouseDown={startResize}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-[var(--devlens-accent-soft)]"
            />
          )}

          <div className="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--devlens-hairline)] px-2.5">
            {(() => {
              const Icon = ICONS[activeTool.id]
              return <Icon size={12} className="shrink-0 text-[var(--devlens-accent)]" />
            })()}
            <span className="min-w-0 flex-1 truncate text-[11px] text-ink-200">{activeTool.label}</span>
            {overlay && (
              <span className="shrink-0 rounded bg-[var(--devlens-accent-soft)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--devlens-accent)]">
                mobile overlay
              </span>
            )}
            <button
              type="button"
              aria-label="Close the side panel"
              title="Close the panel"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-500 transition-colors hover:bg-white/5 hover:text-ink-200"
            >
              <span aria-hidden="true" className="text-[13px] leading-none">
                ×
              </span>
            </button>
          </div>

          {panel === 'ai' && (
            <AiAssistantPanel
              chips={ai.chips}
              provider={ai.provider}
              onProviderChange={ai.onProviderChange}
              activeUrl={activeUrl}
              activeTitle={activeTitle}
              profileId={profileId}
              onNotice={everyday.onNotice}
            />
          )}

          {panel === 'bookmarks' && (
            <BookmarksPanel
              tree={everyday.tree}
              options={everyday.bookmarkOptions}
              onOpen={everyday.onOpenHistory}
              onOpenAll={everyday.onOpenAllBookmarks}
              onRemoveNode={everyday.onRemoveBookmarkNode}
              onToggleOption={everyday.onBookmarkOptions}
            />
          )}

          {panel === 'history' && (
            <HistoryPanel
              entries={everyday.history}
              onOpen={everyday.onOpenHistory}
              onClear={everyday.onClearHistory}
            />
          )}

          {panel === 'settings' && (
            <SettingsPanel
              mode={mode}
              bookmarkOptions={everyday.bookmarkOptions}
              onBookmarkOptions={everyday.onBookmarkOptions}
              protection={everyday.protection}
              onProtection={everyday.onProtection}
              profileAsk={everyday.profileAsk}
              onProfileAsk={everyday.onProfileAsk}
              profileName={profileName}
              layout={everyday.layout}
              onLayout={everyday.onLayout}
              onOpenOmniboxSettings={everyday.onOpenOmniboxSettings}
            />
          )}

          {panel === 'console' && (
            <ConsolePanel
              entries={logs.entries}
              counts={logs.counts}
              onClear={logs.onClear}
              onOpenSource={logs.onOpenSource}
            />
          )}

          {panel === 'design' && (
            <DesignPanel
              css={design.css}
              onCssChange={design.onCssChange}
              designMode={design.designMode}
              onDesignModeChange={design.onDesignModeChange}
              target={design.target}
              onTargetChange={design.onTargetChange}
              activeView={activeView}
              onApply={design.onApply}
              onClear={design.onClear}
              status={design.status}
              appliedAt={design.appliedAt}
              dirty={design.dirty}
            />
          )}

          {panel === 'interceptor' && (
            <InterceptorPanel store={interceptor.store} onNotice={interceptor.onNotice} />
          )}

          {panel === 'servers' && (
            <ServersPanel
              servers={tools.servers}
              scanning={tools.scanning}
              workspaceRoot={tools.workspace?.path ?? null}
              onScan={tools.onScan}
              onOpen={tools.onOpenUrl}
              onOpenInIde={tools.onOpenWorkspaceInIde}
            />
          )}

          {panel === 'viewport' && (
            <ViewportPanel
              activeView={activeView}
              onActiveView={tools.onActiveView}
              deviceId={tools.deviceId}
              onDeviceIndex={tools.onDeviceIndex}
              desktopWidth={tools.desktopWidth}
              onDesktopWidth={tools.onDesktopWidth}
              available={tools.viewportAvailable}
              syncEnabled={tools.syncEnabled}
              onSyncChange={tools.onSyncChange}
            />
          )}

          {panel === 'storage' && (
            <StoragePanel
              url={activeUrl}
              cookies={tools.cookies}
              storage={tools.storage}
              busy={tools.storageBusy}
              error={tools.storageError}
              onRefresh={tools.onRefreshStorage}
              onRemoveCookie={tools.onRemoveCookie}
              onRemoveEntry={tools.onRemoveStorageEntry}
              onClearSite={tools.onClearSiteStorage}
            />
          )}

          {panel === 'recon' && (
            <ReconPanel
              snapshot={recon.snapshot}
              outputDir={recon.outputDir}
              onNotice={recon.onNotice}
            />
          )}

          {panel === 'defense' && (
            <DefensePanel
              state={defense.state}
              busy={defense.busy}
              onToggle={defense.onToggle}
              onScrub={defense.onScrub}
              onClipboardTtl={defense.onClipboardTtl}
              onExitSession={defense.onExitSession}
              onNotice={defense.onNotice}
            />
          )}
        </aside>
      )}
    </>
  )
}

interface DockButtonProps {
  id: DockToolId
  label: string
  icon: typeof Terminal
  active: boolean
  onClick: () => void
  badge?: { value: number; tone: 'danger' | 'warn' }
  /** A brand mark to draw instead of the glyph, e.g. the AI provider the profile last used. */
  mark?: { brand: AiSiteId }
  /** Extra context for the tooltip, never part of the accessible name. */
  hint?: string
}

function DockButton({ id, label, icon: Icon, active, onClick, badge, mark, hint }: DockButtonProps) {
  return (
    <button
      type="button"
      data-testid={`dock-${id}`}
      data-tool={id}
      /* The brand lives on the button, so "which provider is this profile on" does not depend on
         an asset having loaded. */
      data-brand={mark?.brand ?? undefined}
      title={hint ?? label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={[
        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
          : 'text-ink-500 hover:bg-white/[0.05] hover:text-ink-200'
      ].join(' ')}
    >
      {mark ? (
        <span
          data-testid={`dock-mark-${id}`}
          data-brand={mark.brand}
          /* The same 20px MARK_BOX as every other mark in the shell. currentColor lets the
             button's active and hover colours flow through the vector rather than pinning it to
             a provider tint that would ignore the rail's state. */
          className={[MARK_BOX, 'h-5 w-5'].join(' ')}
        >
          <AiMark site={mark.brand} size={16} />
        </span>
      ) : (
        <Icon size={14} />
      )}
      {badge && (
        <span
          className={[
            'absolute right-0.5 top-0.5 rounded px-0.5 font-mono text-[9px] leading-3',
            badge.tone === 'danger' ? 'bg-rose-500/80 text-white' : 'bg-amber-400/80 text-neutral-900'
          ].join(' ')}
        >
          {badge.value}
        </span>
      )}
    </button>
  )
}


