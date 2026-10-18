import { useEffect, useState } from 'react'
import { Activity, CircleSlash, Eye, MousePointerSquareDashed, PenLine, ShieldHalf, X } from 'lucide-react'
import { DEFENSE_SHORTCUT_LABEL, isNormalMode, type WorkspaceMode } from '@shared/mode'
import type { CapturedRequest, InspectionState, WimhState } from '@shared/types'
import { DefensePanel } from '@renderer/components/DefensePanel'
import { IconButton } from '@renderer/components/IconButton'

interface DefenseOverlayProps {
  mode: WorkspaceMode
  /** Defense subsystems, shared with the developer sidebar's WImH panel. */
  defense: {
    state: WimhState | null
    busy: boolean
    onToggle: (enabled: boolean) => void
    onScrub: () => void
    onClipboardTtl: (ms: number) => void
    onExitSession: () => void
  }
  /** What main is currently allowed to observe, and under whose permission. */
  inspection: InspectionState
  /** Requests observed during the current lease; empty again the moment it ends. */
  observed: CapturedRequest[]
  /** Page tooling, only usable while the lease is held (or in dev mode). */
  pageTools: {
    enabled: boolean
    designMode: boolean
    onFind: (selector: string) => void
    onToggleDesignMode: (enabled: boolean) => void
  }
  onClose: () => void
  onStash: () => void
  onNotice: (message: string) => void
}

/**
 * WImH overlay.
 *
 * The on-demand security surface of normal mode. It is intentionally a floating panel and not
 * an `aside`: it borrows the observation pipeline for as long as it is open and gives it back
 * on close, so the browser underneath stays a clean, unmonitored one. Nothing here is
 * persistent - the list below only ever holds what the lease collected.
 */
export function DefenseOverlay({
  mode,
  defense,
  inspection,
  observed,
  pageTools,
  onClose,
  onStash,
  onNotice
}: DefenseOverlayProps) {
  const [selector, setSelector] = useState('')
  /**
   * Escape closes the panel from anywhere, except while the omnibox has focus: there the key
   * belongs to the suggestion dropdown first.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (document.activeElement?.getAttribute('aria-label') === 'Omnibox') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  const onDemand = inspection.source === 'lease'
  const statusLine = onDemand
    ? `observing while open - ${inspection.capturedCount} request(s), ${inspection.consoleCount} console line(s)`
    : inspection.source === 'dev'
      ? 'dev mode already observes - this panel adds nothing'
      : 'observation off'

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label="WImH defense overlay"
      data-testid="wimh-overlay"
      data-mode={mode}
      className="nova-glass fixed right-3 bottom-10 z-[45] flex max-h-[min(620px,78vh)] w-[400px] flex-col overflow-hidden rounded-xl shadow-2xl"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--devlens-hairline)] px-3 py-2">
        <ShieldHalf size={15} className="shrink-0 text-violet-200" />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] text-ink-100">WImH defense overlay</span>
          <span className="block font-mono text-[10px] text-ink-500">
            {isNormalMode(mode) ? 'normal mode stays normal' : 'dev mode'} - {DEFENSE_SHORTCUT_LABEL} or Esc
          </span>
        </span>
        <IconButton label="Close WImH panel" onClick={onClose}>
          <X size={14} />
        </IconButton>
      </header>

      <div className="shrink-0 space-y-2 border-b border-[var(--devlens-hairline)] px-3 py-2">
        <div className="flex items-center gap-2">
          {onDemand ? (
            <Eye size={12} className="shrink-0 text-[var(--devlens-accent)]" />
          ) : (
            <CircleSlash size={12} className="shrink-0 text-ink-500" />
          )}
          <span className="min-w-0 flex-1 font-mono text-[10px] text-ink-400">{statusLine}</span>
          <button
            type="button"
            onClick={onStash}
            disabled={observed.length === 0}
            className="inline-flex items-center gap-1 rounded border border-[var(--devlens-hairline)] px-1.5 py-0.5 font-mono text-[10px] text-ink-300 transition-colors hover:bg-white/5 disabled:opacity-40"
          >
            <Activity size={10} />
            Forget now
          </button>
        </div>

        {/* The only list in this panel: it exists for as long as the lease does. */}
        {observed.length > 0 ? (
          <ul data-testid="wimh-observed" className="max-h-28 space-y-0.5 overflow-y-auto">
            {observed.slice(0, 20).map((request) => (
              <li key={request.id} className="truncate font-mono text-[10px] text-ink-400">
                <span className="text-[var(--devlens-accent)]">{request.method}</span>{' '}
                <span className="text-ink-500">{request.statusCode ?? (request.error ? 'failed' : '...')}</span>{' '}
                {request.url}
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-mono text-[10px] text-ink-600">
            Nothing observed. Close this panel and the browser is unmonitored again.
          </p>
        )}

        {/* Page tooling. The guest only accepts these while the lease above is held. */}
        <div className="flex items-center gap-1.5">
          <form
            className="flex min-w-0 flex-1 items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault()
              if (!pageTools.enabled) {
                onNotice('open the overlay lease first')
                return
              }
              pageTools.onFind(selector.trim())
            }}
          >
            <input
              value={selector}
              onChange={(event) => setSelector(event.target.value)}
              spellCheck={false}
              placeholder="CSS selector"
              aria-label="Inspect selector"
              className="h-6 min-w-0 flex-1 rounded border border-[var(--devlens-hairline)] bg-neutral-950/60 px-1.5 font-mono text-[10px] text-ink-200 outline-none placeholder:text-ink-600"
            />
            <button
              type="submit"
              aria-label="Highlight selector"
              disabled={!pageTools.enabled}
              className="inline-flex h-6 shrink-0 items-center gap-1 rounded border border-[var(--devlens-hairline)] px-1.5 font-mono text-[10px] text-ink-300 transition-colors hover:bg-white/5 disabled:opacity-40"
            >
              <MousePointerSquareDashed size={10} />
              Highlight
            </button>
          </form>
          <button
            type="button"
            aria-pressed={pageTools.designMode}
            aria-label="Toggle design mode in the page"
            disabled={!pageTools.enabled}
            onClick={() => pageTools.onToggleDesignMode(!pageTools.designMode)}
            className={[
              'inline-flex h-6 shrink-0 items-center gap-1 rounded border px-1.5 font-mono text-[10px] transition-colors',
              pageTools.designMode
                ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                : 'border-[var(--devlens-hairline)] text-ink-300 hover:bg-white/5',
              pageTools.enabled ? '' : 'opacity-40'
            ].join(' ')}
          >
            <PenLine size={10} />
            Design
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DefensePanel
          state={defense.state}
          busy={defense.busy}
          onToggle={(enabled) => {
            defense.onToggle(enabled)
            onNotice(enabled ? 'extreme defense engaged' : 'extreme defense disengaged')
          }}
          onScrub={defense.onScrub}
          onClipboardTtl={defense.onClipboardTtl}
          onExitSession={defense.onExitSession}
          onNotice={onNotice}
        />
      </div>
    </section>
  )
}
