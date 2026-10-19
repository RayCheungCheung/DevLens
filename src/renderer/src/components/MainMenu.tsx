import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ChevronRight,
  Clock,
  Download,
  LogOut,
  Menu,
  MoveUpRight,
  Plus,
  Printer,
  Search,
  Settings,
  ShieldPlus,
  Star,
  Terminal,
  Wrench
} from 'lucide-react'
import { useMenuDismiss } from '@renderer/hooks/useMenuDismiss'
import { IconButton } from '@renderer/components/IconButton'

interface MainMenuProps {
  /** Display name of the active profile, e.g. "Ray Cheung". */
  profileName: string
  /** Open the profile switcher (the identity block in the menu). */
  onOpenProfileMenu: () => void
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

/**
 * The operator's main menu, opened from the three-line button on the far right of the toolbar.
 *
 * It is the browser's conventional command list: identity, window controls, the everyday tools,
 * the page operations and the system settings. Every row is a real action - the ones that have
 * a panel yet open it, the ones that do not yet report their status instead of pretending they
 * did something.
 */
export function MainMenu({
  profileName,
  onOpenProfileMenu,
  onNewTab,
  onNewPrivateTab,
  onHistory,
  onBookmarks,
  onPrint,
  onSavePage,
  onFind,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onGetZoomPercent,
  onSettings,
  onToggleDefense,
  defenseActive,
  onOpenDevTools,
  onExit
}: MainMenuProps) {
  const [open, setOpen] = useState(false)
  /** The active guest's zoom, refreshed whenever the menu opens. 100 until read. */
  const [zoomPercent, setZoomPercent] = useState(100)
  const [zoomBusy, setZoomBusy] = useState(false)
  const wrapper = useRef<HTMLDivElement | null>(null)
  useMenuDismiss({ ref: wrapper, onClose: () => setOpen(false) })

  /** Close the menu, then run the action the row is bound to. */
  const run = (action: () => void): void => {
    setOpen(false)
    action()
  }

  /** Opening the menu re-reads the zoom so the Zoom row shows the live value. */
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void onGetZoomPercent().then((value) => {
      if (!cancelled && Number.isFinite(value)) setZoomPercent(value)
    })
    return () => {
      cancelled = true
    }
  }, [open, onGetZoomPercent])

  /** Run one zoom action, then show the percentage the page actually reports. */
  const adjustZoom = async (action: () => Promise<number>): Promise<void> => {
    if (zoomBusy) return
    setZoomBusy(true)
    try {
      const value = await action()
      if (Number.isFinite(value) && value > 0) setZoomPercent(value)
    } finally {
      setZoomBusy(false)
    }
  }

  /** One command row: an icon, a label, and a right-aligned keyboard shortcut or sub-menu chevron. */
  const row = (
    id: string,
    icon: ReactNode,
    label: string,
    action: () => void,
    trailing?: { shortcut?: string; chevron?: boolean }
  ): ReactNode => (
    <button
      type="button"
      role="menuitem"
      data-testid={`main-menu-${id}`}
      onClick={() => run(action)}
      className="group flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-ink-400 group-hover:text-ink-200">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-100">{label}</span>
      {trailing?.chevron ? (
        <ChevronRight size={13} className="shrink-0 text-ink-500" />
      ) : trailing?.shortcut ? (
        <span className="shrink-0 font-mono text-[10px] text-ink-500">{trailing.shortcut}</span>
      ) : null}
    </button>
  )

  const divider = (key: string): ReactNode => (
    <div
      key={key}
      aria-hidden="true"
      className="my-1 h-px bg-[var(--devlens-hairline)]"
    />
  )

  return (
    <div ref={wrapper} className="relative shrink-0">
      <IconButton
        label="Menu"
        testId="main-menu-button"
        pressed={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
      >
        <Menu size={16} />
      </IconButton>

      {open && (
        <div
          role="menu"
          aria-label="Main menu"
          data-testid="main-menu"
          className="absolute right-0 top-[calc(100%+6px)] z-[70] w-[300px] overflow-hidden rounded-xl border border-[var(--devlens-hairline)] bg-[color-mix(in_srgb,var(--color-ink-950)_97%,transparent)] py-1 shadow-2xl"
        >
          {/* Identity: who is signed in. */}
          <button
            type="button"
            role="menuitem"
            data-testid="main-menu-profile"
            onClick={() => run(onOpenProfileMenu)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-400/20 text-[11px] font-mono uppercase text-teal-100">
              {profileName.slice(0, 1) || 'U'}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-100">{profileName}</span>
            <ChevronRight size={14} className="shrink-0 text-ink-500" />
          </button>

          {divider('before-window')}

          {/* Window controls. */}
          {row('new-tab', <Plus size={15} />, 'New Tab', onNewTab, { shortcut: 'Ctrl+T' })}
          {row('new-private-tab', <ShieldPlus size={15} />, 'New Private Tab', onNewPrivateTab, {
            shortcut: 'Ctrl+Shift+P'
          })}

          {divider('before-everyday')}

          {/* The everyday tools. */}
          {row('history', <Clock size={15} />, 'History', onHistory)}
          {row('bookmarks', <Star size={15} />, 'Bookmarks', onBookmarks)}

          {divider('before-page')}

          {/* Page operations. */}
          {row('print', <Printer size={15} />, 'Print...', onPrint, { shortcut: 'Ctrl+P' })}
          {row('save-page', <Download size={15} />, 'Save Page As...', onSavePage, {
            shortcut: 'Ctrl+S'
          })}
          {row('find', <Search size={15} />, 'Find in Page...', onFind, { shortcut: 'Ctrl+F' })}

          {/* Zoom: inline controls, not a sub-menu. */}
          <div role="menuitem" data-testid="main-menu-zoom" className="flex w-full items-center gap-2.5 px-3 py-1.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-ink-400">
              <MoveUpRight size={15} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-100">Zoom</span>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                data-testid="main-menu-zoom-out"
                title="Zoom out"
                disabled={zoomBusy}
                onClick={() => void adjustZoom(onZoomOut)}
                className="flex h-6 w-6 items-center justify-center rounded text-[15px] leading-none text-ink-200 hover:bg-white/5 disabled:cursor-wait disabled:text-ink-600"
              >
                &minus;
              </button>
              <button
                type="button"
                data-testid="main-menu-zoom-reset"
                title="Reset zoom to 100%"
                disabled={zoomBusy}
                onClick={() => void adjustZoom(onZoomReset)}
                className="min-w-[42px] rounded px-1 py-1 text-center font-mono text-[11px] text-ink-200 hover:bg-white/5 disabled:cursor-wait disabled:text-ink-600"
              >
                {zoomPercent}%
              </button>
              <button
                type="button"
                data-testid="main-menu-zoom-in"
                title="Zoom in"
                disabled={zoomBusy}
                onClick={() => void adjustZoom(onZoomIn)}
                className="flex h-6 w-6 items-center justify-center rounded text-[15px] leading-none text-ink-200 hover:bg-white/5 disabled:cursor-wait disabled:text-ink-600"
              >
                +
              </button>
            </div>
          </div>

          {divider('before-system')}

          {/* DevLens's own features: the things that are not in a stock browser. */}
          {row('devlens-defense', <Wrench size={15} />, 'Extreme Defense', onToggleDefense, {
            shortcut: defenseActive ? 'on' : undefined
          })}
          {row('devlens-devtools', <Terminal size={15} />, 'Open DevTools', onOpenDevTools)}

          {divider('before-settings')}

          {/* System settings. */}
          {row('settings', <Settings size={15} />, 'Settings', onSettings)}
          {row('exit', <LogOut size={15} />, 'Exit', onExit, { shortcut: 'Ctrl+Shift+Q' })}

          <p
            data-testid="main-menu-note"
            className="mt-1 border-t border-[var(--devlens-hairline)] px-3 py-2 text-[10px] leading-4 text-ink-500"
          >
            DevLens items work in both everyday and dev mode; the rest act on the active page.
          </p>
        </div>
      )}
    </div>
  )
}
