import { useCallback, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  Command,
  History,
  ShieldCheck,
  X
} from 'lucide-react'
import type { OmniboxAction, OmniboxSuggestion } from '@shared/omnibox'
import type { DefaultEngineRef, OmniboxEntry } from '@shared/omnibox-settings'
import type { WorkspaceMode } from '@shared/mode'
import type { BookmarkEntry, LocalServer, WimhState, WorkspaceEntry } from '@shared/types'
import type { LaunchpadPreferences } from '@shared/launchpad'
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
  onInsertPrefix: (text: string) => void
  onToggleWimh: () => void
}

/** How many shortcut tiles the grid holds before it stops being scannable. */
const SHORTCUT_LIMIT = 11

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
  onInsertPrefix,
  onToggleWimh
}: NewTabDashboardProps) {
  const dev = services.mode === 'dev'

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
    const push = (url: string, title: string, saved: boolean): void => {
      if (out.length >= SHORTCUT_LIMIT) return
      const host = hostOf(url)
      if (!host || seen.has(host)) return
      seen.add(host)
      out.push({ url, title: title || host, saved })
    }
    for (const bookmark of services.bookmarks) push(bookmark.url, bookmark.title, true)
    for (const entry of services.recent) push(entry.url, entry.title, false)
    for (const server of reachable) push(server.url, server.title ?? server.label, false)
    return out
  }, [reachable, services.bookmarks, services.recent])

  /**
   * Normal mode is a clean browser, so the dashboard drops everything developer-facing: the
   * monitoring counters, the workspace list with its editor hand-off, and the dev-only prefix
   * entries. What is left is a start page - shortcuts, clocks, a timer and a list.
   */
  const cheatSheet = useMemo(
    () => [
      ...omnibox.engines.map((engine) => ({
        id: `engine:${engine.id}`,
        prefix: `@${engine.keyword}`,
        insert: `@${engine.keyword} `,
        label: `Search ${engine.label}`
      })),
      ...omnibox.shortcuts.map((shortcut) => ({
        id: `shortcut:${shortcut.id}`,
        prefix: `#${shortcut.keyword}`,
        insert: `#${shortcut.keyword}`,
        label: `Open ${shortcut.label}`
      })),
      {
        id: 'ghost',
        prefix: '*',
        insert: '* ',
        label: 'Ghost session, isolated and in-memory',
        devOnly: false
      },
      { id: 'find', prefix: '&', insert: '& ', label: 'Highlight DOM matches in the viewport', devOnly: true },
      { id: 'port', prefix: ':port', insert: ':port ', label: 'Open http://localhost:<port>' },
      { id: 'clear', prefix: ':clear-cache', insert: ':clear-cache', label: 'Wipe cache and storage' },
      { id: 'sandbox', prefix: ':sandbox', insert: ':sandbox', label: 'Open an isolated sandbox window' },
      { id: 'wimh', prefix: ':wimh', insert: ':wimh', label: 'WImH defense overlay, on demand in both modes' },
      { id: 'recon', prefix: '>sec', insert: '>sec', label: 'Security and recon panel', devOnly: true },
      { id: 'design', prefix: '>design', insert: '>design', label: 'Live design and CSS panel', devOnly: true },
      { id: 'intercept', prefix: '>intercept', insert: '>intercept', label: 'HTTP interceptor panel', devOnly: true },
      { id: 'defense', prefix: '>defense', insert: '>defense', label: 'Extreme defense mode', devOnly: true }
    ],
    [omnibox.engines, omnibox.shortcuts]
  )

  const visibleCheatSheet = useMemo(
    () => cheatSheet.filter((entry) => dev || !('devOnly' in entry && entry.devOnly)),
    [cheatSheet, dev]
  )

  /** The hero field takes focus when its `+` tile is clicked, from the tile's own click. */
  const focusField = useCallback(() => {
    const field = document.querySelector<HTMLInputElement>('[aria-label="Dashboard omnibox"]')
    field?.focus()
  }, [])

  return (
    <div
      data-mode={services.mode}
      data-testid="new-tab-dashboard"
      className="nova-ntp absolute inset-0 z-40 overflow-y-auto"
      style={
        launchpad.wallpaper
          ? {
              backgroundImage: `linear-gradient(rgba(3, 5, 8, ${Math.min(
                0.82,
                Math.max(0.12, launchpad.wallpaperDim / 100)
              )}), rgba(3, 5, 8, ${Math.min(
                0.9,
                Math.max(0.2, launchpad.wallpaperDim / 100 + 0.08)
              )})), url(${launchpad.wallpaper})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }
          : undefined
      }
    >
      {/* One container, measured on its own width: the pane shrinks when the developer sidebar
          opens, and the grid has to answer to the pane, not to the window. */}
      <div className="@container mx-auto flex max-w-5xl flex-col gap-6 px-8 pt-10 pb-16">
        {/* ---------------- brand ---------------- */}
        <header className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-[22px] leading-7 font-medium tracking-tight text-ink-100">
              DevLens
              <DevLensMark size={14} className="text-[var(--devlens-accent)]" />
            </h1>
            <p className="mt-1 truncate text-[11px] text-ink-500">
              Be normal when you need, be a hacker when you want.
            </p>
          </div>

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
        <section className="flex flex-col gap-4 pt-2">
          <div className="mx-auto w-full max-w-2xl">
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
              /* No page is loaded here, so the default engine owns the leading slot and the
                 panel offers the search engines and places to go. */
            />
          </div>

          <QuickLaunch
            shortcuts={shortcuts}
            onOpenUrl={onOpenUrl}
            onFocusField={focusField}
          />
        </section>

        {/* ---------------- widgets ---------------- */}
        <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2 @6xl:grid-cols-3">
          {launchpad.widgets.clock && <WorldClocks />}
          {launchpad.widgets.devSpotlight && (
            <DevSpotlight wallpaper={launchpad.wallpaper} dim={launchpad.wallpaperDim} />
          )}
          {launchpad.widgets.quickSnippets && <QuickSnippets profileId={services.profileId} />}
          {launchpad.widgets.systemHealth && (
            <SystemHealth
              requests={services.stats.requests}
              failures={services.stats.failures}
              consoleErrors={services.stats.consoleErrors}
              tracked={services.stats.tracked}
            />
          )}
          {launchpad.widgets.weather && <WeatherWidget place={launchpad.weatherPlace} />}
          {launchpad.widgets.focusTimer && <FocusTimer />}
          <Checklist profileId={services.profileId} />
          <ServersWidget
            servers={services.servers}
            scanning={services.scanning}
            ghostActive={services.ghostActive}
            onScan={onScanServers}
            onOpenUrl={onOpenUrl}
          />
          {dev && (
            <WorkspacesWidget
              workspaces={services.workspaces}
              onAdd={onAddWorkspace}
              onAddPath={onAddWorkspacePath}
              onRemove={onRemoveWorkspace}
              onActivate={onActivateWorkspace}
              onOpenInIde={onOpenInIde}
            />
          )}
          {dev && (
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
          )}
        </div>

        {/* ---------------- reference ---------------- */}
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 text-[11px] tracking-wide text-ink-200">
            <Command size={12} className="text-[var(--devlens-accent)]" />
            Omni-prefix cheat sheet
          </h2>
          <div className="grid grid-cols-2 gap-1.5 @2xl:grid-cols-3 @5xl:grid-cols-4">
            {visibleCheatSheet.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onInsertPrefix(entry.insert)}
                title={`Insert ${entry.prefix}`}
                className="nova-card nova-card--interactive flex min-w-0 items-center gap-2 px-2.5 py-1.5 text-left"
              >
                <span className="shrink-0 rounded bg-[var(--devlens-accent-soft)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--devlens-accent)]">
                  {entry.prefix}
                </span>
                <span className="min-w-0 flex-1 truncate text-[10px] text-ink-400">{entry.label}</span>
              </button>
            ))}
          </div>
        </section>

        {launchpad.activity.recent && services.recent.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="flex items-center gap-1.5 text-[11px] tracking-wide text-ink-200">
              <History size={12} className="text-[var(--devlens-accent)]" />
              Recent
            </h2>
            <div className="grid grid-cols-1 gap-1.5 @2xl:grid-cols-2 @5xl:grid-cols-3">
              {services.recent.slice(0, 6).map((entry) => (
                <button
                  key={entry.url}
                  type="button"
                  onClick={(event) =>
                    onOpenUrl(entry.url, {
                      newTab: event.altKey || event.ctrlKey || event.metaKey
                    })
                  }
                  onAuxClick={(event) => {
                    if (event.button === 1) onOpenUrl(entry.url, { newTab: true })
                  }}
                  title={entry.url}
                  className="nova-card nova-card--interactive flex min-w-0 flex-col gap-0.5 px-2.5 py-1.5 text-left"
                >
                  <span className="w-full truncate text-[11px] text-ink-200">
                    {entry.title || entry.url}
                  </span>
                  {/* The address is context, not a second title: when history only ever had the
                      URL, printing it twice says nothing. */}
                  {entry.title && entry.title !== entry.url && (
                    <span className="w-full truncate font-mono text-[9px] text-ink-600">
                      {entry.url}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {launchpad.activity.bookmarks && services.bookmarks.length > 0 && (
          <section className="flex flex-col gap-2" data-testid="launchpad-bookmarks">
            <h2 className="flex items-center gap-1.5 text-[11px] tracking-wide text-ink-200">
              <History size={12} className="text-[var(--devlens-accent)]" />
              Bookmarks
            </h2>
            <div className="grid grid-cols-1 gap-1.5 @2xl:grid-cols-2 @5xl:grid-cols-3">
              {services.bookmarks.slice(0, 6).map((entry) => (
                <button
                  key={entry.url}
                  type="button"
                  onClick={(event) =>
                    onOpenUrl(entry.url, {
                      newTab: event.altKey || event.ctrlKey || event.metaKey
                    })
                  }
                  title={entry.url}
                  className="nova-card nova-card--interactive flex min-w-0 flex-col gap-0.5 px-2.5 py-1.5 text-left"
                >
                  <span className="w-full truncate text-[11px] text-ink-200">{entry.title}</span>
                  <span className="w-full truncate font-mono text-[9px] text-ink-600">{entry.url}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {launchpad.activity.downloads && (
          <section className="flex flex-col gap-2" data-testid="launchpad-downloads">
            <h2 className="flex items-center gap-1.5 text-[11px] tracking-wide text-ink-200">
              <History size={12} className="text-[var(--devlens-accent)]" />
              Downloads
            </h2>
            <p className="rounded border border-dashed border-[var(--devlens-hairline)] px-3 py-3 font-mono text-[10px] text-ink-600">
              no downloads recorded in this session
            </p>
          </section>
        )}
      </div>

      {services.wimh?.active && (
        <p className="pointer-events-none fixed bottom-12 left-1/2 -translate-x-1/2 rounded border border-violet-400/40 bg-violet-500/15 px-3 py-1 font-mono text-[10px] text-violet-100">
          extreme defense active - history writes refused, clipboard watched
        </p>
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
