import type { MouseEvent, ReactNode } from 'react'

interface IconButtonProps {
  /** Used as both tooltip and accessible name. */
  label: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  /** Renders a pressed state for toggles. */
  pressed?: boolean
  tone?: 'neutral' | 'accent' | 'danger'
  /**
   * Runs before the button would take focus.
   *
   * A toolbar button that steals focus blurs whatever had it, and in this shell losing focus is
   * a real event: the omnibox closes its dropdown and re-syncs the address. A control that only
   * changes the *layout* has no business doing that, so it can refuse the focus instead.
   */
  onMouseDown?: (event: MouseEvent<HTMLButtonElement>) => void
  /** Stable hook for the tests, so a control can move without breaking them. */
  testId?: string
  /** Free-form data attributes, e.g. which slot a movable control is occupying. */
  data?: Record<string, string>
  children: ReactNode
}

const TONES = {
  neutral: 'text-neutral-400 hover:bg-white/5 hover:text-neutral-100',
  accent: 'text-teal-300 hover:bg-teal-400/10 hover:text-teal-200',
  danger: 'text-rose-300 hover:bg-rose-500/10 hover:text-rose-200'
} as const

export function IconButton({
  label,
  onClick,
  active = false,
  disabled = false,
  pressed,
  tone = 'neutral',
  onMouseDown,
  testId,
  data,
  children
}: IconButtonProps) {
  const isPressed = pressed ?? active

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed === undefined ? undefined : pressed}
      disabled={disabled}
      onMouseDown={onMouseDown}
      onClick={onClick}
      data-testid={testId}
      {...data}
      className={[
        'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition-colors',
        'disabled:cursor-not-allowed disabled:text-neutral-700 disabled:hover:bg-transparent',
        isPressed ? 'border-teal-400/40 bg-teal-400/10 text-teal-200' : TONES[tone]
      ].join(' ')}
    >
      {children}
    </button>
  )
}
