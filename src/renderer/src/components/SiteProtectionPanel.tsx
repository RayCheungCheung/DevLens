import { Eraser, Lock, ShieldCheck, ShieldOff, Unlock } from 'lucide-react'
import { LOCAL_ONLY_GUARANTEE, PROTECTION_DESCRIPTORS, PROTECTION_LEVELS, type ProtectionLevel } from '@shared/protection'
import type { ProtectionState } from '@shared/types'

interface SiteProtectionPanelProps {
  /** The page on screen: its address decides what this panel says. */
  url: string
  secure: boolean
  protection: ProtectionState
  busy: boolean
  /** Exempts this site from cancellation (true) or puts it back under the level (false). */
  onToggleSiteProtection: (exempt: boolean) => void
  /** Cookies and storage for this origin, and nothing else. */
  onClearSiteData: () => void
  onLevelChange: (level: ProtectionLevel) => void
}

/** The host a panel row names, without the scheme or a trailing slash. */
function displayHost(url: string): string {
  try {
    return new URL(url).host || url
  } catch {
    return url
  }
}

/**
 * Firefox's site-information panel, for the page that is open.
 *
 * The leading slot shows this instead of the engine menu whenever a page is loaded, because the
 * question "where do I search" only matters when the field is empty. Everything here is bound to
 * the site in front of the operator: an exemption applies to that host alone, the clear action
 * touches that origin alone, and the level selector is the same engine switch the toolbar uses.
 */
export function SiteProtectionPanel({
  url,
  secure,
  protection,
  busy,
  onToggleSiteProtection,
  onClearSiteData,
  onLevelChange
}: SiteProtectionPanelProps) {
  const host = displayHost(url)
  const exempt = protection.allowedSites.includes(host.toLowerCase())
  const protecting = !exempt && protection.policy.blockTrackers

  return (
    <div role="menu" aria-label="Site protection" data-testid="site-panel" className="py-1">
      <div className="flex items-center gap-2.5 border-b border-[var(--devlens-hairline)] px-3 py-2">
        <span
          className={[
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
            secure ? 'bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]' : 'bg-amber-400/10 text-amber-300'
          ].join(' ')}
        >
          {secure ? <Lock size={14} /> : <Unlock size={14} />}
        </span>
        <span className="min-w-0 flex-1">
          <span data-testid="site-panel-host" className="block truncate text-[12px] text-ink-100">
            {host}
          </span>
          <span
            data-testid="site-panel-connection"
            className={[
              'block font-mono text-[10px]',
              secure ? 'text-[var(--devlens-accent)]' : 'text-amber-300'
            ].join(' ')}
          >
            {secure ? 'Connection secure' : 'Not secure - this page is plain HTTP'}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-2.5 px-3 py-2">
        {protecting ? (
          <ShieldCheck size={14} className="shrink-0 text-[var(--devlens-accent)]" />
        ) : (
          <ShieldOff size={14} className="shrink-0 text-amber-300" />
        )}
        <span className="min-w-0 flex-1">
          <span data-testid="site-panel-guard" className="block text-[11px] text-ink-100">
            {protecting ? 'DevLens is on guard' : 'Protection paused for this site'}
          </span>
          <span className="block font-mono text-[10px] text-ink-500">
            {protection.blockedRequests} request(s) cancelled under {PROTECTION_DESCRIPTORS[protection.level].label}
          </span>
        </span>
      </div>

      <div className="border-t border-[var(--devlens-hairline)] py-1">
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={protecting}
          aria-label="Enhanced tracking protection"
          data-testid="site-panel-etp"
          disabled={busy}
          onClick={() => onToggleSiteProtection(!exempt)}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            <span
              className={[
                'h-3.5 w-3.5 rounded-[4px] border',
                protecting
                  ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                  : 'border-[var(--devlens-hairline-strong)]'
              ].join(' ')}
            />
          </span>
          <span className="min-w-0 flex-1 text-[11px] text-ink-200">Enhanced tracking protection</span>
          <span className="shrink-0 font-mono text-[10px] text-ink-500">{protecting ? 'on' : 'off'}</span>
        </button>

        <button
          type="button"
          role="menuitem"
          aria-label="Clear cookies and site data"
          data-testid="site-panel-clear"
          disabled={busy}
          onClick={onClearSiteData}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
        >
          <Eraser size={13} className="shrink-0 text-ink-500" />
          <span className="min-w-0 flex-1 text-[11px] text-ink-200">Clear cookies &amp; site data</span>
          <span className="shrink-0 font-mono text-[9px] text-ink-600">{host}</span>
        </button>
      </div>

      <div className="border-t border-[var(--devlens-hairline)] px-3 py-2" role="group" aria-label="Protection level">
        <p className="mb-1.5 text-[10px] tracking-wide text-ink-500 uppercase">Privacy level</p>
        <div className="flex items-center gap-1">
          {PROTECTION_LEVELS.map((level) => {
            const option = PROTECTION_DESCRIPTORS[level]
            const current = level === protection.level
            return (
              <button
                key={level}
                type="button"
                aria-pressed={current}
                aria-label={option.label}
                data-testid={`site-panel-level-${level}`}
                data-level={level}
                disabled={busy}
                onClick={() => onLevelChange(level)}
                className={[
                  'flex-1 rounded-md border px-1.5 py-1 text-[10px] transition-colors',
                  current
                    ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                    : 'border-[var(--devlens-hairline)] text-ink-400 hover:text-ink-200'
                ].join(' ')}
              >
                {option.short}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-ink-500">{LOCAL_ONLY_GUARANTEE}</p>
      </div>
    </div>
  )
}
