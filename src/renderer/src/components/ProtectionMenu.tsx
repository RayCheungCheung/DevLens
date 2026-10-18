import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Lock, ShieldCheck, ShieldHalf, TerminalSquare, Zap } from 'lucide-react'
import { modeDescriptor, type WorkspaceMode } from '@shared/mode'
import {
  LOCAL_ONLY_GUARANTEE,
  PROTECTION_DESCRIPTORS,
  PROTECTION_LEVELS,
  type ProtectionLevel
} from '@shared/protection'
import type { ProtectionState } from '@shared/types'

interface ProtectionMenuProps {
  mode: WorkspaceMode
  /** Live state: the active level, the policy it applies and what it has actually done. */
  protection: ProtectionState
  busy: boolean
  onSelect: (level: ProtectionLevel) => void
  /**
   * True while a max-protection private tab is focused.
   *
   * The badge still reports a level - Level 3, because that is what the tab is running - but
   * the dial belongs to the window and cannot be turned for one tab. Locking it here is what
   * keeps "Private (Max Protection)" from becoming a claim the next click could retract.
   */
  locked?: boolean
  lockedReason?: string
}

const LEVEL_ICONS = {
  standard: Lock,
  strict: ShieldCheck,
  extreme: ShieldHalf
} as const

/**
 * The toolbar's security badge, and the protection dial behind it.
 *
 * The badge is the browser's privacy control, so it is deliberately available in both modes -
 * this is not a developer panel. The menu only ever changes *local* behaviour: which hosts are
 * cancelled, which headers are hardened and whether the session is RAM-only. The promise at the
 * bottom of the menu is the same constant the engine documents, so the claim and the code
 * cannot drift apart.
 */
export function ProtectionMenu({
  mode,
  protection,
  busy,
  onSelect,
  locked = false,
  lockedReason
}: ProtectionMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement | null>(null)

  const descriptor = modeDescriptor(mode)
  const dev = mode === 'dev'
  const active = PROTECTION_DESCRIPTORS[protection.level]
  const ActiveIcon = dev ? TerminalSquare : active.id === 'standard' ? Lock : LEVEL_ICONS[active.id]

  /** Escape belongs to the menu first while it is open; nothing else should react to it. */
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open])

  /**
   * Clicking anywhere else dismisses the menu.
   *
   * A full-window backdrop would not work here: the toolbar blurs the content behind it, and a
   * filtered element becomes the containing block for `position: fixed` children, so the
   * backdrop would only ever cover the toolbar itself.
   */
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (target && wrapper.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

  const counters = [
    `${protection.blockedRequests} request(s) cancelled`,
    `${protection.scrubbedHeaders} header set(s) rewritten`,
    `${protection.trimmedReferers} referer(s) trimmed`
  ]
  if (protection.ramOnlySession && !locked) counters.push('RAM-only session on')

  return (
    <div ref={wrapper} className="relative shrink-0">
      <button
        type="button"
        data-testid="protection-badge"
        data-level={protection.level}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Protection level - ${active.label}`}
        title={`${descriptor.label} - ${descriptor.tagline}. Protection: ${active.label}.`}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
        className={[
          'inline-flex items-center gap-1.5 rounded border px-1.5 py-1 text-left font-mono text-[10px] transition-colors',
          locked ? 'border-[var(--devlens-stealth-line)] bg-[var(--devlens-stealth-soft)] text-ink-100' : descriptor.chipClass,
          open ? 'ring-1 ring-[var(--devlens-accent-line)]' : ''
        ].join(' ')}
      >
        <ActiveIcon size={10} className={['shrink-0', locked ? 'text-[var(--devlens-stealth)]' : ''].join(' ')} />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate">
            {locked
              ? `${active.label} (this tab)`
              : dev
                ? `${descriptor.label} (${active.short})`
                : `Normal Mode (${active.short})`}
          </span>
          <span className="truncate text-[9px] opacity-60">
            {locked ? 'Max-protection private tab' : descriptor.tagline}
          </span>
        </span>
        <ChevronDown size={9} className={['shrink-0 transition-transform', open ? 'rotate-180' : ''].join(' ')} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Protection level"
          data-testid="protection-menu"
          /* Near-opaque on purpose: this menu opens over the log panel and the page, and a
             translucent surface makes the level descriptions unreadable. */
          className="absolute right-0 top-[calc(100%+6px)] z-[70] w-[330px] overflow-hidden rounded-xl border border-[var(--devlens-hairline)] bg-[color-mix(in_srgb,var(--color-ink-950)_97%,transparent)] shadow-2xl"
        >
            <p className="border-b border-[var(--devlens-hairline)] px-3 py-1.5 text-[10px] tracking-wide text-ink-500 uppercase">
              Protection level
            </p>

            {locked && (
              <p
                data-testid="protection-locked-note"
                className="border-b border-[var(--devlens-hairline)] bg-[var(--devlens-stealth-soft)] px-3 py-2 text-[10px] leading-4 text-ink-300"
              >
                {lockedReason ??
                  'This tab is running at maximum protection. The level belongs to the window, so it cannot be lowered here.'}
              </p>
            )}

            {PROTECTION_LEVELS.map((level) => {
              const option = PROTECTION_DESCRIPTORS[level]
              const Icon = LEVEL_ICONS[level]
              const current = level === protection.level
              return (
                <button
                  key={level}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current}
                  aria-label={option.label}
                  data-level={level}
                  data-testid={`protection-level-${level}`}
                  /* Locked rows keep their explanation visible instead of vanishing: the point
                     is to show that Level 3 is being enforced, not to hide the dial. */
                  disabled={busy || locked}
                  title={locked ? 'Enforced by this private tab' : undefined}
                  onClick={() => {
                    setOpen(false)
                    if (!current) onSelect(level)
                  }}
                  className={[
                    'flex w-full items-start gap-2 px-3 py-2 text-left transition-colors',
                    current ? 'bg-[var(--devlens-accent-soft)]' : 'hover:bg-white/[0.04]'
                  ].join(' ')}
                >
                  <Icon
                    size={12}
                    className={['mt-0.5 shrink-0', current ? 'text-[var(--devlens-accent)]' : 'text-ink-500'].join(' ')}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-ink-100">{option.label}</span>
                    <span className="block text-[10px] leading-4 text-ink-500">{option.summary}</span>
                    <span className="mt-1 block space-y-0.5">
                      {option.details.map((detail) => (
                        <span key={detail} className="block font-mono text-[9px] leading-4 text-ink-600">
                          - {detail}
                        </span>
                      ))}
                    </span>
                  </span>
                  {current ? (
                    <Check size={12} data-testid="protection-active-check" className="mt-0.5 shrink-0 text-[var(--devlens-accent)]" />
                  ) : (
                    <span className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  )}
                </button>
              )
            })}

            <div className="space-y-1 border-t border-[var(--devlens-hairline)] px-3 py-2">
              <p className="flex items-center gap-1.5 text-[10px] text-ink-400">
                <Zap size={10} className="shrink-0 text-[var(--devlens-accent)]" />
                <span className="font-mono">{counters.join(' - ')}</span>
              </p>
              <p className="text-[10px] leading-4 text-ink-300" data-testid="protection-guarantee">
                {LOCAL_ONLY_GUARANTEE}
              </p>
            </div>
        </div>
      )}
    </div>
  )
}
