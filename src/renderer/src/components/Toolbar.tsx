import type { ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Code2,
  Link2,
  PanelRightClose,
  PanelRightOpen,
  RotateCw,
  ShieldHalf,
  Star,
  Unlink2
} from 'lucide-react'
import type { OmniboxAction, OmniboxSuggestion } from '@shared/omnibox'
import type { DefaultEngineRef } from '@shared/omnibox-settings'
import { isDevMode as isDevModeValue, type WorkspaceMode } from '@shared/mode'
import type { ProtectionLevel } from '@shared/protection'
import type { ViewportId } from '@shared/types'
import type { ProtectionState } from '@shared/types'
import type { ToolbarLayout } from '@shared/preferences'
import { IconButton } from '@renderer/components/IconButton'
import { Omnibox } from '@renderer/components/Omnibox'
import { ModeSwitcher } from '@renderer/components/ModeSwitcher'
import { ProtectionMenu } from '@renderer/components/ProtectionMenu'
import { ProfileSwitcher } from '@renderer/components/ProfileSwitcher'
import { MainMenu } from '@renderer/components/MainMenu'
import type { BrowserProfile } from '@shared/types'

interface ToolbarProps {
  address: string
  onAddressChange: (value: string) => void
  onRun: (action: OmniboxAction, raw: string) => void
  onAddressFocusChange: (focused: boolean) => void
  suggestions: OmniboxSuggestion[]
  /** The profile's resolved default engine; the field uses it as its resting mark. */
  defaultEngine: DefaultEngineRef
  /** The operator's own engines and shortcuts, plus the icons the shell resolved for them. */
  customs?: {
    entries: import('@shared/omnibox-settings').OmniboxEntry[]
    engines: import('@shared/omnibox-settings').OmniboxEntry[]
    shortcuts: import('@shared/omnibox-settings').OmniboxEntry[]
    favicons: Record<string, string | null>
  }
  omniboxHint: string | null
  sessionChip: ReactNode
  /** The page on screen is saved locally, so the star renders filled. */
  bookmarked: boolean
  /**
   * False while the tab is showing the dashboard or an internal page. The star is a page action,
   * and on the start page there is no page to act on - so it is not rendered at all rather than
   * sitting there doing nothing.
   */
  canBookmark: boolean
  onToggleBookmark: () => void
  /** The add-bookmark editor, anchored under the toolbar when it is open. */
  bookmarkEditor?: ReactNode
  /** The add/rename folder panel, anchored the same way. */
  bookmarkFolderEditor?: ReactNode
  /** WImH defense overlay: the one security surface normal mode still offers. */
  defenseOpen: boolean
  onToggleDefense: () => void
  /** Protection dial: which hosts are cancelled, which headers are hardened, RAM-only or not. */
  protection: ProtectionState
  protectionBusy: boolean
  onProtectionChange: (level: ProtectionLevel) => void
  /**
   * Set while the focused tab is a max-protection private tab.
   *
   * The badge then reports Level 3 as enforced *by that tab* and the dial is locked, because the
   * window's level is not what is protecting the page on screen.
   */
  protectionLocked?: { reason: string } | null
  /** The page on screen, so the leading menu can talk about *this* site. */
  site: { url: string; secure: boolean; iconUrl?: string | null }
  /** Set on a `devlens:` tab so the field can draw the DevLens mark instead of an engine. */
  internalUrl?: string | null
  onToggleSiteProtection: (allowed: boolean) => void
  onClearSiteData: () => void
  pasteGuard: {
    enabled: boolean
    check: (text: string) => Promise<{ secret: boolean; reason: string }>
    onBlocked: (reason: string) => void
  }
  onBack: () => void
  onForward: () => void
  onReload: () => void
  canGoBack: boolean
  canGoForward: boolean
  activeView: ViewportId
  /** False on `devlens:` pages and the front page: there is no web viewport to emulate. */
  viewportAvailable: boolean
  syncEnabled: boolean
  onToggleSync: () => void
  onOpenInIde: () => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
  ideLabel: string
  ideScheme: string
  /** Workspace mode: normal hides every developer affordance. */
  mode: WorkspaceMode
  modeBusy: boolean
  /**
   * How the operator arranged the chrome: where the sidebar handle lives, and which developer
   * tools the right-hand cluster is allowed to show.
   */
  layout: ToolbarLayout
  onModeChange: (mode: WorkspaceMode) => void
  profiles: BrowserProfile[]
  profilesBusy: boolean
  onProfileSwitch: (id: string) => void
  onProfileCreate: (name: string) => void
  onProfileDelete: (id: string) => void
  onNotice: (message: string) => void
  /** Main-menu callbacks, in display order. */
  menu: {
    profileName: string
    onOpenProfileMenu: () => void
    /** Bumped to open the profile popover from the menu's identity row. */
    profileOpenSignal: number
    onNewTab: () => void
    /** Opens a private (WImH) tab in place of the current session. */
    onNewPrivateTab: () => void
    onHistory: () => void
    onBookmarks: () => void
    onPrint: () => void
    onSavePage: () => void
    onFind: () => void
    onZoomIn: () => Promise<number>
    onZoomOut: () => Promise<number>
    onZoomReset: () => Promise<number>
    /** Reads the active guest's zoom as a whole percentage; shown in the Zoom row. */
    onGetZoomPercent: () => Promise<number>
    onSettings: () => void
    /** Flips the extreme defense (WImH) session on or off. */
    onToggleDefense: () => void
    /** Whether the extreme defense session is active right now. */
    defenseActive: boolean
    /** Opens the active guest's native DevTools drawer. */
    onOpenDevTools: () => void
    onExit: () => void
  }
}

export function Toolbar({
  address,
  onAddressChange,
  onRun,
  onAddressFocusChange,
  suggestions,
  defaultEngine,
  customs,
  omniboxHint,
  sessionChip,
  bookmarked,
  canBookmark,
  onToggleBookmark,
  bookmarkEditor,
  bookmarkFolderEditor,
  defenseOpen,
  onToggleDefense,
  protection,
  protectionBusy,
  onProtectionChange,
  protectionLocked,
  site,
  internalUrl,
  onToggleSiteProtection,
  onClearSiteData,
  pasteGuard,
  onBack,
  onForward,
  onReload,
  canGoBack,
  canGoForward,
  activeView,
  viewportAvailable,
  syncEnabled,
  onToggleSync,
  onOpenInIde,
  sidebarOpen,
  onToggleSidebar,
  ideLabel,
  ideScheme,
  mode,
  modeBusy,
  layout,
  onModeChange,
  profiles,
  profilesBusy,
  onProfileSwitch,
  onProfileCreate,
  onProfileDelete,
  onNotice,
  menu
}: ToolbarProps) {
  // Normal mode renders navigation, the omnibox, the mode switcher and profiles - and nothing
  // that could reach the developer area.
  const dev = isDevModeValue(mode)

  /**
   * The dock's handle.
   *
   * One element, rendered in exactly one of two places: the far left, ahead of Back/Forward, or
   * with the rest of the developer tools on the right. It never appears twice and it keeps its
   * identity wherever it is - the position is a layout preference, not a different button.
   *
   * `onMouseDown` is cancelled deliberately. A toolbar button that takes focus blurs whatever had
   * it, and in this shell focus loss is a real event: the omnibox closes its dropdown and re-syncs
   * the address bar from the live page. A control whose whole job is to change the *layout* must
   * not also change what is focused, or clicking it reads as the toolbar collapsing under the
   * pointer. Its footprint is a fixed 32px square for the same reason - toggling the dock may not
   * reflow the row it lives in.
   */
  const sidebarToggle = dev ? (
    <IconButton
      label={sidebarOpen ? 'Hide developer sidebar' : 'Show developer sidebar'}
      pressed={sidebarOpen}
      testId="sidebar-toggle"
      data={{ 'data-sidebar-toggle': layout.sidebarToggle }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onToggleSidebar}
    >
      {sidebarOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
    </IconButton>
  ) : null

  return (
    <header
      data-mode={mode}
      /*
       * `nova-glass` blurs, which makes this header a stacking context. It has to sit above
       * everything that can appear *under* it in the layout:
       *   - the sidebar (a stacking context of its own, later in the DOM),
       *   - the new tab dashboard, which is page content inside the canvas at `z-40`,
       *   - the WImH overlay at `z-45`.
       * The omnibox dropdown and the engine menu hang below the toolbar into the canvas area, so
       * with a lower z-index the dashboard painted over them: the menu opened and was covered,
       * which looked exactly like "it only works when a website is open".
       */
      className="nova-glass relative z-50 flex h-12 shrink-0 items-center gap-1.5 border-b px-3"
      style={
        dev
          ? { borderBottomColor: 'var(--devlens-accent-line)', boxShadow: '0 10px 30px -26px var(--devlens-glow)' }
          : undefined
      }
    >
      {/* The leftmost slot, before navigation: the dock is the outermost layer of the workspace,
          so its handle is the outermost control. */}
      {layout.sidebarToggle === 'start' && (
        <span data-toolbar-slot="sidebar-toggle" className="flex shrink-0 items-center">
          {sidebarToggle}
        </span>
      )}

      <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.02] p-0.5">
        {/* No new-tab button here: a second `+` next to the tabs read as a duplicate. The tab
            strip owns that action, immediately to the right of the last tab. */}
        <IconButton label="Back" onClick={onBack} disabled={!canGoBack}>
          <ArrowLeft size={15} />
        </IconButton>
        <IconButton label="Forward" onClick={onForward} disabled={!canGoForward}>
          <ArrowRight size={15} />
        </IconButton>
        <IconButton label="Reload both viewports" onClick={onReload}>
          <RotateCw size={14} />
        </IconButton>
      </div>

      <Omnibox
        value={address}
        onChange={onAddressChange}
        onRun={onRun}
        onFocusChange={onAddressFocusChange}
        suggestions={suggestions}
        defaultEngine={defaultEngine}
        customs={customs}
        sessionChip={sessionChip}
        hint={omniboxHint}
        pasteGuard={pasteGuard}
        site={site}
        internalUrl={internalUrl}
        protection={protection}
        protectionBusy={protectionBusy}
        onProtectionLevel={onProtectionChange}
        onToggleSiteProtection={onToggleSiteProtection}
        onClearSiteData={onClearSiteData}
      />

      {/* Bookmarks are part of being a browser, so they stay in both modes - but only on a page.
          On the dashboard there is nothing to save, so the star is absent until there is. */}
      {canBookmark && (
        <span data-bookmark-trigger className="flex shrink-0">
          <IconButton
            label={bookmarked ? 'Edit bookmark' : 'Bookmark this page'}
            pressed={bookmarked}
            onClick={onToggleBookmark}
          >
            <Star size={15} fill={bookmarked ? 'currentColor' : 'none'} />
          </IconButton>
        </span>
      )}

      {/* The defense overlay is the deliberate escape hatch: normal mode keeps its privacy
          tools reachable, while the monitoring workspace stays locked away. */}
      {layout.tools.defense && (
        <IconButton label="WImH defense panel" pressed={defenseOpen} onClick={onToggleDefense}>
          <ShieldHalf size={15} />
        </IconButton>
      )}

      {/* Dual viewport, scroll sync and editor hand-off are developer affordances. */}
      {dev && layout.tools.viewport && viewportAvailable && (
        <span
          data-testid="viewport-chip"
          data-toolbar-secondary
          className="shrink-0 rounded-md border border-[var(--devlens-hairline)] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[10px] text-ink-400"
        >
          {activeView}
        </span>
      )}

      {dev && layout.tools.scrollSync && (
        <button
          type="button"
          data-toolbar-secondary
          onClick={onToggleSync}
          aria-pressed={syncEnabled}
          title={syncEnabled ? 'Scroll sync is on' : 'Scroll sync is off'}
          className={[
            'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] transition-all',
            syncEnabled
              ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
              : 'border-[var(--devlens-hairline)] text-ink-400 hover:bg-white/5 hover:text-ink-200'
          ].join(' ')}
        >
          {syncEnabled ? <Link2 size={14} /> : <Unlink2 size={14} />}
          Scroll sync
        </button>
      )}

      {dev && layout.tools.openInIde && (
        <button
          type="button"
          data-toolbar-secondary
          onClick={onOpenInIde}
          title={`Open ${ideLabel} with ${ideScheme}://file/...`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--devlens-hairline)] bg-white/[0.02] px-2.5 text-[12px] text-ink-200 transition-all hover:border-[var(--devlens-accent-line)] hover:bg-[var(--devlens-accent-soft)] hover:text-[var(--devlens-accent)]"
        >
          <Code2 size={14} />
          Open in VS Code
        </button>
      )}

      {/* Identity and mode cluster: visually grouped, hairline separated from the page tools. */}
      <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-[var(--devlens-hairline)]" />
      {/* The security badge doubles as the protection dial. It is a privacy control, not a
          developer one, so it stays available in both modes. */}
      <ProtectionMenu
        mode={mode}
        protection={protection}
        busy={protectionBusy}
        onSelect={onProtectionChange}
        locked={Boolean(protectionLocked)}
        lockedReason={protectionLocked?.reason}
      />
      <ModeSwitcher mode={mode} busy={modeBusy} onChange={onModeChange} />
      <ProfileSwitcher
        profiles={profiles}
        busy={profilesBusy}
        onSwitch={onProfileSwitch}
        onCreate={onProfileCreate}
        onDelete={onProfileDelete}
        onNotice={onNotice}
        openSignal={menu.profileOpenSignal}
      />
      <MainMenu
        profileName={menu.profileName}
        onOpenProfileMenu={menu.onOpenProfileMenu}
        onNewTab={menu.onNewTab}
        onNewPrivateTab={menu.onNewPrivateTab}
        onHistory={menu.onHistory}
        onBookmarks={menu.onBookmarks}
        onPrint={menu.onPrint}
        onSavePage={menu.onSavePage}
        onFind={menu.onFind}
        onZoomIn={menu.onZoomIn}
        onZoomOut={menu.onZoomOut}
        onZoomReset={menu.onZoomReset}
        onGetZoomPercent={menu.onGetZoomPercent}
        onSettings={menu.onSettings}
        onToggleDefense={menu.onToggleDefense}
        defenseActive={menu.defenseActive}
        onOpenDevTools={menu.onOpenDevTools}
        onExit={menu.onExit}
      />

      {layout.sidebarToggle === 'end' && (
        <span data-toolbar-slot="sidebar-toggle" className="flex shrink-0 items-center">
          {sidebarToggle}
        </span>
      )}

      {bookmarkEditor}
      {bookmarkFolderEditor}
    </header>
  )
}
