import { useEffect, type RefObject } from 'react'

interface MenuDismissOptions {
  /** The menu's own element: a press inside it belongs to the menu, not to the dismissal. */
  ref: RefObject<HTMLElement | null>
  onClose: () => void
  /** Set false for a menu that must survive losing window focus (none currently do). */
  closeOnBlur?: boolean
}

/**
 * One dismissal contract for every menu in the shell.
 *
 * A context menu is a promise that the next thing the operator does anywhere will dismiss it. That
 * promise is easy to break in pieces - a menu that only listens for `click` misses the press that
 * starts a drag, one that only listens on the trigger misses every other surface, one that ignores
 * `scroll` leaves itself floating over the wrong element - so the listeners live here and every
 * menu takes them:
 *
 *   pointerdown   the press *anywhere*, in the capture phase, before anything can swallow it
 *   click         the press that turned into a click on a control that stops propagation
 *   scroll        any scroll, from the page, the sidebar or the tab strip, capture phase
 *   resize        the layout moved under the menu
 *   keydown       Escape, capture phase, so the omnibox cannot take it first
 *   blur          the window itself lost focus
 *
 * All of them are registered in the capture phase on `window`: a menu that is dismissed by a
 * bubble-phase listener is dismissed only if nothing between the target and the root stops it,
 * and plenty of controls in this shell do exactly that.
 */
export function useMenuDismiss({ ref, onClose, closeOnBlur = true }: MenuDismissOptions): void {
  useEffect(() => {
    /**
     * The opening gesture can move the page.
     *
     * A right-click is often preceded by the browser scrolling the target into view, and a menu
     * that treats that scroll as "the operator looked away" closes itself before it has been seen.
     * So the layout events - scroll and resize - are ignored for a moment after mount, while the
     * press events are not: a press is always deliberate, and a scroll can be the tail of the
     * gesture that opened the menu.
     */
    const openedAt = Date.now()
    const SETTLE_MS = 200
    const settled = (): boolean => Date.now() - openedAt > SETTLE_MS

    const inside = (target: EventTarget | null): boolean => {
      const node = target as Node | null
      const element = ref.current
      return Boolean(element && node && (element === node || element.contains(node)))
    }

    const onPointerDown = (event: Event): void => {
      if (inside(event.target)) return
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      /* Stop it here: Escape belongs to the menu while one is open, not to whatever is behind it. */
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    const onScrollOrResize = (event: Event): void => {
      /* Scrolling *inside* the menu is the operator reading it, not dismissing it. */
      if (inside(event.target)) return
      if (!settled()) return
      onClose()
    }
    /**
     * The *window* losing focus, and nothing else.
     *
     * `blur` does not bubble, but a capture-phase listener on `window` still sees it for every
     * element on the page - including the menu row that is taking focus as the operator presses
     * it. Closing on that would dismiss the menu on the way *into* it: the press removed the row
     * before the click could be delivered, which is a menu whose every entry does nothing. So the
     * target is checked, and only the window itself counts as the operator having left.
     */
    const onBlur = (event: Event): void => {
      if (event.target !== window && event.target !== document) return
      onClose()
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('click', onPointerDown, true)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize, true)
    window.addEventListener('keydown', onKeyDown, true)
    if (closeOnBlur) window.addEventListener('blur', onBlur, true)

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('click', onPointerDown, true)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize, true)
      window.removeEventListener('keydown', onKeyDown, true)
      if (closeOnBlur) window.removeEventListener('blur', onBlur, true)
    }
  }, [closeOnBlur, onClose, ref])
}
