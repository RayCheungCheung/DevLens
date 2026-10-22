import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Pencil,
  ShieldCheck,
  X
} from 'lucide-react'
import type { OmniboxAction, OmniboxSuggestion } from '@shared/omnibox'
import type { DefaultEngineRef, OmniboxEntry } from '@shared/omnibox-settings'
import type { WorkspaceMode } from '@shared/mode'
import type { BookmarkEntry, LocalServer, WimhState, WorkspaceEntry } from '@shared/types'
import type { LaunchpadPreferences } from '@shared/launchpad'
import type { AppearancePreferences } from '@shared/appearance'
import { resolveLaunchpadWallpaper } from '@shared/wallpapers'
import type { SettingsCategoryId } from '@shared/routes'
import { Checklist } from '@renderer/components/dashboard/Checklist'
import { DevSpotlight } from '@renderer/components/dashboard/DevSpotlight'
import { FocusTimer } from '@renderer/components/dashboard/FocusTimer'
import { QuickLaunch, type Shortcut } from '@renderer/components/dashboard/QuickLaunch'
import { QuickSnippets } from '@renderer/components/dashboard/QuickSnippets'
import { ServersWidget } from '@renderer/components/dashboard/ServersWidget'
import { SystemHealth } from '@renderer/components/dashboard/SystemHealth'
import { WeatherWidget } from '@renderer/components/dashboard/WeatherWidget'
import { Widget } from '@renderer/components/dashboard/Widget'
import { WorkspacesWidget } from '@renderer/components/dashboard/WorkspacesWidget'
import { WorldClocks } from '@renderer/components/dashboard/WorldClocks'
import { Omnibox } from '@renderer/components/Omnibox'
import { DevLensMark } from '@renderer/components/DevLensMark'
import { DEV_LENS_SPOTLIGHT_SIGNATURE } from '@shared/developer-quotes'
import { LaunchpadCustomizePanel } from '@renderer/components/LaunchpadCustomizePanel'
import {
  PrivateSessionLanding,
  type PrivateLandingGuideRoute
} from '@renderer/components/PrivateSessionLanding'

/**
 * The dashboard's embedded omnibox.
 *
 * It is the toolbar's own component, mounted a second time in its hero presentation - so the
 * dashboard field parses prefixes, ranks local history, offers the ghost completion and honours
 * the same keyboard contract because it *is* the same field. It shares one value and one runner
 * with the toolbar, which means whatever is typed is visible in both places: there is one message,
 * drawn twice, rather than two drafts that can disagree.
 */
interface DashboardOmnibox {
  value: string
  onChange: (value: string) => void
  onRun: (action: OmniboxAction, raw: string, options?: { newTab?: boolean }) => void
  onFocusChange: (focused: boolean) => void
  suggestions: OmniboxSuggestion[]
  defaultEngine: DefaultEngineRef
  engines: OmniboxEntry[]
  shortcuts: OmniboxEntry[]
  favicons: Record<string, string | null>
  internalUrl?: string | null
  sessionChip?: ReactNode
  pasteGuard?: {
    enabled: boolean
    check: (text: string) => Promise<{ secret: boolean; reason: string }>
    onBlocked: (reason: string) => void
  }
}

interface NewTabDashboardProps {
  launchpad: LaunchpadPreferences
  services: {
    servers: LocalServer[]
    scanning: boolean
    workspaces: WorkspaceEntry[]
    wimh: WimhState | null
    ghostActive: boolean
    privateTab: boolean
    mode: WorkspaceMode
    /** Recently visited pages, newest first. */
    recent: { url: string; title: string }[]
    /** Saved pages; they lead the shortcut grid because they were saved on purpose. */
    bookmarks: BookmarkEntry[]
    /** Whose checklist this card shows. */
    profileId: string
    stats: { requests: number; failures: number; consoleErrors: number; tracked: number }
  }
  /** The toolbar's omnibox, wired to the same state, shown here as the hero field. */
  omnibox: DashboardOmnibox
  /** Omitted when there is no page to return to, which also hides the close button. */
  onClose?: () => void
  /** Alt/Ctrl/middle click opens the target in its own tab, like every browser. */
  onOpenUrl: (url: string, options?: { newTab?: boolean }) => void
  onScanServers: () => void
  onAddWorkspace: () => void
  onAddWorkspacePath: (path: string) => void
  onRemoveWorkspace: (path: string) => void
  onActivateWorkspace: (path: string) => void
  onOpenInIde: (path: string) => void
  onToggleWimh: () => void
  /** Opens a full Settings category when the quick customization panel needs more controls. */
  onOpenSettings: (category: SettingsCategoryId) => void
  appearance: AppearancePreferences
  onAppearance: (patch: Partial<AppearancePreferences>) => void
  onLaunchpad: (patch: Partial<LaunchpadPreferences>) => void
  onChooseWallpaper: () => void
  onOpenPrivateGuide: (route: PrivateLandingGuideRoute) => void
}

/** How many shortcut tiles the grid holds before it stops being scannable. */
const MAX_SHORTCUTS = 32

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * DevLens front page.
 *
 * Rendered as the page of an empty tab rather than inside a webview: it opens instantly, shows
 * live local data, and leaves whatever is running in the other tabs untouched.
 *
 * The shape is a hero and a grid of cards - what Firefox puts behind a new tab, arranged the way
 * Arc and Zen arrange their widgets - because a start page is glanced at, not read: the field is
 * where the eye lands, the shortcuts are one click away, and everything else is a local utility
 * that stays out of the way until it is needed. In normal mode the developer cards are not drawn
 * at all; what is left is a browser start page with a clock, a timer and a list.
 */
export function NewTabDashboard({
  launchpad,
  services,
  omnibox,
  onClose,
  onOpenUrl,
  onScanServers,
  onAddWorkspace,
  onAddWorkspacePath,
  onRemoveWorkspace,
  onActivateWorkspace,
  onOpenInIde,
  onToggleWimh,
  onOpenSettings,
  appearance,
  onAppearance,
  onLaunchpad,
  onChooseWallpaper,
  onOpenPrivateGuide
}: NewTabDashboardProps) {
  const wallpaperUrl = resolveLaunchpadWallpaper(launchpad)
  const dev = services.mode === 'dev'
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const widgetTrackRef = useRef<HTMLDivElement | null>(null)
  const brandTaps = useRef({ count: 0, lastAt: 0 })
  const [widgetPage, setWidgetPage] = useState(0)
  const [widgetPageCount, setWidgetPageCount] = useState(1)
  const wimhActive = Boolean(services.wimh?.active)
  const dualProtection = wimhActive && services.privateTab
  const privateVariant = dualProtection
    ? 'dual'
    : wimhActive
      ? 'wimh'
      : services.privateTab
        ? 'private'
        : services.ghostActive
          ? 'ghost'
          : null

  /**
   * Scanning is the front page's own business: opening it re-probes the usual ports. The effect
   * is deliberately mount-only - the shell hands down a fresh callback on every render, and a
   * scan per render would hammer the ports for no reason.
   */
  useEffect(() => {
    onScanServers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reachable = useMemo(
    () => services.servers.filter((server) => server.reachable),
    [services.servers]
  )

  /**
   * The shortcut grid.
   *
   * Saved pages first - they are a decision the operator already made - then the pages that were
   * actually visited, then whatever local server answered, so the grid is useful on a fresh
   * profile too. Deduplicated by host: two entries for one site is a wasted tile.
   */
  const shortcuts = useMemo<Shortcut[]>(() => {
    const seen = new Set<string>()
    const out: Shortcut[] = []
    const shortcutLimit = Math.min(MAX_SHORTCUTS, Math.max(1, launchpad.shortcutRows) * 8)
    const push = (url: string, title: string, saved: boolean): void => {
      if (out.length >= shortcutLimit) return
      const host = hostOf(url)
      if (!host || seen.has(host)) return
      seen.add(host)
      out.push({ url, title: title || host, saved })
    }
    for (const bookmark of services.bookmarks) push(bookmark.url, bookmark.title, true)
    for (const entry of services.recent) push(entry.url, entry.title, false)
    for (const server of reachable) push(server.url, server.title ?? server.label, false)
    return out
  }, [launchpad.shortcutRows, reachable, services.bookmarks, services.recent])

  /** The hero field takes focus when its `+` tile is clicked, from the tile's own click. */
  const focusField = useCallback(() => {
    const field = document.querySelector<HTMLInputElement>('[aria-label="Dashboard omnibox"]')
    field?.focus()
  }, [])

  const widgetCount =
    [
      launchpad.widgets.clock,
      launchpad.widgets.devSpotlight,
      launchpad.widgets.quickSnippets,
      launchpad.widgets.systemHealth,
      launchpad.widgets.weather,
      launchpad.widgets.focusTimer
    ].filter(Boolean).length +
    2 +
    (dev ? 2 : 0)

  /**
   * Keep the widget shelf to one row with horizontal paging. The page indicator follows the
   * scroll position rather than a renderer-only counter, so resizing the window and changes to
   * the visible widget set cannot desynchronise the arrows from what is actually on screen.
   */
  useEffect(() => {
    if (!launchpad.widgetsVisible) return
    const track = widgetTrackRef.current
    if (!track) return

    const sync = (): void => {
      const pageWidth = Math.max(1, track.clientWidth)
      const pages = Math.max(1, Math.ceil((track.scrollWidth - 1) / pageWidth))
      setWidgetPageCount(pages)
      setWidgetPage(Math.min(pages - 1, Math.round(track.scrollLeft / pageWidth)))
    }

    sync()
    track.addEventListener('scroll', sync, { passive: true })
    const observer = new ResizeObserver(sync)
    observer.observe(track)
    return () => {
      track.removeEventListener('scroll', sync)
      observer.disconnect()
    }
  }, [launchpad.widgetsVisible, widgetCount])

  const pageWidgets = (direction: -1 | 1): void => {
    const track = widgetTrackRef.current
    if (!track) return
    track.scrollBy({
      left: direction * Math.max(1, track.clientWidth),
      behavior: 'smooth'
    })
  }

  const tapBrand = (): void => {
    const now = Date.now()
    const next =
      now - brandTaps.current.lastAt > 2600 ? 1 : brandTaps.current.count + 1
    brandTaps.current = { count: next, lastAt: now }
    if (next < 5) return
    brandTaps.current = { count: 0, lastAt: 0 }
    window.dispatchEvent(
      new CustomEvent('devlens:easter-egg', { detail: 'brand' })
    )
  }

  const dashboardOmnibox = (
    <Omnibox
      variant="hero"
      ariaLabel="Dashboard omnibox"
      value={omnibox.value}
      onChange={omnibox.onChange}
      onRun={omnibox.onRun}
      onFocusChange={omnibox.onFocusChange}
      suggestions={omnibox.suggestions}
      defaultEngine={omnibox.defaultEngine}
      customs={{
        entries: [...omnibox.engines, ...omnibox.shortcuts],
        engines: omnibox.engines,
        shortcuts: omnibox.shortcuts,
        favicons: omnibox.favicons
      }}
      internalUrl={omnibox.internalUrl}
      sessionChip={omnibox.sessionChip}
      pasteGuard={omnibox.pasteGuard}
    />
  )

  if (privateVariant) {
    return (
      <PrivateSessionLanding
        variant={privateVariant}
        onOpenGuide={onOpenPrivateGuide}
      >
        {dashboardOmnibox}
      </PrivateSessionLanding>
    )
  }

  return (
    <div
      data-dashboard-mode={services.mode}
      data-testid="new-tab-dashboard"
      className="dashboard-ntp absolute inset-0 z-40 overflow-hidden text-white"
      style={
        wallpaperUrl
          ? {
              backgroundImage: `linear-gradient(rgba(2, 5, 8, ${Math.min(
                0.38,
                Math.max(0.08, launchpad.wallpaperDim / 220)
              )}), rgba(2, 5, 8, ${Math.min(
                0.62,
                Math.max(0.2, launchpad.wallpaperDim / 150)
              )})), url("${wallpaperUrl}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center top',
              backgroundColor: '#061113'
            }
          : { backgroundColor: '#080b10' }
      }
    >
      <div className="@container flex min-h-full flex-col">
        <div className="mx-auto w-full max-w-[1500px] px-6 pb-14 pt-6">
        {/* ---------------- brand ---------------- */}
        <header className="flex items-start gap-4">
          <button
            type="button"
            onClick={tapBrand}
            aria-label="DevLens"
            title="DevLens"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-black/20 text-[var(--devlens-accent)] shadow-lg backdrop-blur-md">
              <DevLensMark size={24} />
            </span>
            <div className="min-w-0">
            <h1 className="text-[27px] font-semibold leading-8 tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
              DevLens
            </h1>
            <p
              data-testid="devlens-team-signature"
              className="mt-0.5 font-mono text-[9px] tracking-wide text-white/65 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
            >
              {DEV_LENS_SPOTLIGHT_SIGNATURE} <span className="text-ink-300">— DevLens Team</span>
            </p>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onToggleWimh}
              aria-pressed={Boolean(services.wimh?.active)}
              title={
                services.wimh?.active
                  ? 'Extreme defense is on: history writes refused, clipboard watched'
                  : 'Engage extreme defense for this window'
              }
              className={[
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] transition-colors',
                services.wimh?.active
                  ? 'border-violet-400/50 bg-violet-500/15 text-violet-100'
                  : 'border-[var(--devlens-hairline)] text-ink-300 hover:bg-white/5'
              ].join(' ')}
            >
              <ShieldCheck size={13} />
              {services.wimh?.active ? 'Extreme defense on' : 'Extreme defense'}
            </button>
            {onClose && (
              <button
                type="button"
                aria-label="Close dashboard"
                title="Close dashboard"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--devlens-hairline)] text-ink-400 transition-colors hover:bg-white/5 hover:text-ink-100"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </header>

        {/* ---------------- hero ---------------- */}
        <section className="flex flex-col items-center gap-7 pb-4 pt-[8vh]">
          <div className="mx-auto w-full max-w-3xl">
            {dashboardOmnibox}
          </div>

          {launchpad.shortcutsVisible && (
            <div className="w-full max-w-5xl">
              <QuickLaunch
                shortcuts={shortcuts}
                onOpenUrl={onOpenUrl}
                onFocusField={focusField}
              />
            </div>
          )}
        </section>
        </div>

        <div className="dashboard-band min-h-0 flex-1 border-y border-white/[0.06]">
          <div className="mx-auto flex h-full w-full max-w-[1480px] flex-col justify-center px-6 py-5">
        {/* ---------------- widgets ---------------- */}
        {launchpad.widgetsVisible && (
        <section className="flex min-h-0 flex-col">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[20px] font-semibold text-white">Widgets</h2>
              <p className="mt-0.5 text-[10px] text-white/50">
                Local tools arranged around the way this profile works.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="min-w-10 text-center font-mono text-[9px] text-white/40">
                {widgetPage + 1} / {widgetPageCount}
              </span>
              <button
                type="button"
                aria-label="Previous widgets"
                disabled={widgetPage === 0}
                onClick={() => pageWidgets(-1)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/55 transition-colors hover:border-white/20 hover:text-white disabled:cursor-default disabled:opacity-25"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                aria-label="Next widgets"
                disabled={widgetPage >= widgetPageCount - 1}
                onClick={() => pageWidgets(1)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/55 transition-colors hover:border-white/20 hover:text-white disabled:cursor-default disabled:opacity-25"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => setCustomizeOpen(true)}
                className="ml-1 rounded-md border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[10px] text-white/60 transition-colors hover:border-white/20 hover:text-white"
              >
                Customize
              </button>
            </div>
          </div>
        <div className="dashboard-widgets-stage min-h-0">
        <div
          ref={widgetTrackRef}
          data-testid="dashboard-widget-track"
          className="dashboard-widgets-track"
        >
        <div className="dashboard-widgets">
          {launchpad.widgets.clock && <div><WorldClocks /></div>}
          {launchpad.widgets.devSpotlight && (
            <div><DevSpotlight wallpaper={wallpaperUrl} dim={launchpad.wallpaperDim} /></div>
          )}
          {launchpad.widgets.quickSnippets && <div><QuickSnippets profileId={services.profileId} /></div>}
          {launchpad.widgets.systemHealth && (
            <div>
              <SystemHealth
                requests={services.stats.requests}
                failures={services.stats.failures}
                consoleErrors={services.stats.consoleErrors}
                tracked={services.stats.tracked}
              />
            </div>
          )}
          {launchpad.widgets.weather && <div><WeatherWidget place={launchpad.weatherPlace} /></div>}
          {launchpad.widgets.focusTimer && <div><FocusTimer /></div>}
          <div><Checklist profileId={services.profileId} /></div>
          <div>
            <ServersWidget
              servers={services.servers}
              scanning={services.scanning}
              ghostActive={services.ghostActive}
              onScan={onScanServers}
              onOpenUrl={onOpenUrl}
            />
          </div>
          {dev && (
            <div>
              <WorkspacesWidget
                workspaces={services.workspaces}
                onAdd={onAddWorkspace}
                onAddPath={onAddWorkspacePath}
                onRemove={onRemoveWorkspace}
                onActivate={onActivateWorkspace}
                onOpenInIde={onOpenInIde}
              />
            </div>
          )}
          {dev && (
            <div>
              <Widget icon={Activity} title="Session activity" note="what this window has seen">
                <div className="grid grid-cols-2 gap-1.5">
                  <Stat label="requests captured" value={services.stats.requests} />
                  <Stat label="failures" value={services.stats.failures} tone="warn" />
                  <Stat label="console errors" value={services.stats.consoleErrors} tone="warn" />
                  <Stat
                    label="trackers blocked"
                    value={services.stats.tracked}
                    tone={services.stats.tracked > 0 ? 'good' : 'normal'}
                  />
                </div>
              </Widget>
            </div>
          )}
        </div>
        </div>
        </div>
        </section>
        )}

      </div>
        </div>

        <button
          type="button"
          aria-label="Customize launchpad"
          title="Customize launchpad"
          onClick={() => setCustomizeOpen(true)}
          className="fixed bottom-14 right-5 z-[46] inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[color-mix(in_srgb,var(--color-ink-950)_84%,transparent)] text-white/65 shadow-xl backdrop-blur-md transition-colors hover:border-[var(--devlens-accent-line)] hover:text-[var(--devlens-accent)]"
        >
          <Pencil size={16} />
        </button>
      </div>

      {services.wimh?.active && (
        <p className="pointer-events-none fixed bottom-12 left-1/2 -translate-x-1/2 rounded border border-violet-400/40 bg-violet-500/15 px-3 py-1 font-mono text-[10px] text-violet-100">
          extreme defense active - history writes refused, clipboard watched
        </p>
      )}

      {customizeOpen && (
        <LaunchpadCustomizePanel
          launchpad={launchpad}
          appearance={appearance}
          onLaunchpad={onLaunchpad}
          onAppearance={onAppearance}
          onChooseWallpaper={onChooseWallpaper}
          onManageAppearance={() => {
            setCustomizeOpen(false)
            onOpenSettings('appearance')
          }}
          onManageWidgets={() => {
            setCustomizeOpen(false)
            onOpenSettings('home')
          }}
          onClose={() => setCustomizeOpen(false)}
        />
      )}
    </div>
  )
}

interface StatProps {
  label: string
  value: number
  tone?: 'normal' | 'warn' | 'good'
}

function Stat({ label, value, tone = 'normal' }: StatProps) {
  const toneClass =
    tone === 'warn' && value > 0
      ? 'text-amber-300'
      : tone === 'good' && value > 0
        ? 'text-[var(--devlens-accent)]'
        : 'text-ink-100'

  // A tinted fact cell rather than a card: it lives inside one, and a border here would read as
  // a box in a box.
  return (
    <div className="rounded bg-white/[0.03] px-2.5 py-1.5">
      <p className={['font-mono text-[15px] leading-5 tabular-nums', toneClass].join(' ')}>{value}</p>
      <p className="truncate text-[9px] tracking-wide text-ink-500 uppercase">{label}</p>
    </div>
  )
}
