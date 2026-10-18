import { useEffect } from 'react'
import { FilePlus, VenetianMask } from 'lucide-react'
import {
  PRIVATE_TAB_LABEL,
  PRIVATE_TAB_SHORTCUT_LABEL,
  PRIVATE_TAB_SUMMARY
} from '@shared/private-tab'

interface NewTabMenuProps {
  x: number
  y: number
  onNewTab: () => void
  onNewPrivateTab: () => void
  onClose: () => void
}

/**
 * What the tab strip's `+` offers when asked properly: a right-click, or a held press.
 *
 * Two entries, no more. The plain new tab is the same action as a plain click, so the menu is
 * never the only way to do the common thing - it only adds the second option, which is the one
 * that would otherwise need a keyboard.
 */
export function NewTabMenu({ x, y, onNewTab, onNewPrivateTab, onClose }: NewTabMenuProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-testid="new-tab-menu"]')) return
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [onClose])

  const run = (action: () => void): void => {
    action()
    onClose()
  }

  return (
    <div
      role="menu"
      aria-label="New tab options"
      data-testid="new-tab-menu"
      style={{ left: x, top: y }}
      /* Rendered inside the tab strip, which is the window's drag region: without the opt-out
         the rows would start a window drag instead of clicking. */
      className="nova-popup fixed z-[80] w-[280px] overflow-hidden rounded-xl border border-[var(--devlens-hairline)] bg-[color-mix(in_srgb,var(--color-ink-950)_97%,transparent)] py-1 shadow-2xl"
    >
      <button
        type="button"
        role="menuitem"
        aria-label="New Tab"
        data-testid="new-tab-menu-plain"
        onClick={() => run(onNewTab)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
      >
        <FilePlus size={13} className="shrink-0 text-ink-400" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-ink-200">New Tab</span>
          <span className="block font-mono text-[9px] text-ink-600">Ctrl+T</span>
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        aria-label={PRIVATE_TAB_LABEL}
        data-testid="new-tab-menu-private"
        onClick={() => run(onNewPrivateTab)}
        className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--devlens-stealth-soft)]"
      >
        <VenetianMask size={13} className="mt-0.5 shrink-0 text-[var(--devlens-stealth)]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-ink-100">New Max-Protection Private Tab</span>
          <span className="block font-mono text-[9px] text-ink-600">{PRIVATE_TAB_SHORTCUT_LABEL}</span>
          <span className="mt-1 block text-[10px] leading-4 text-ink-500">{PRIVATE_TAB_SUMMARY}</span>
        </span>
      </button>
    </div>
  )
}
