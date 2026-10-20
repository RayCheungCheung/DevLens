interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  testId: string
  ariaLabel?: string
  disabled?: boolean
}

/**
 * Shared settings switch.
 *
 * The thumb is laid out with flex rather than absolute positioning. A button centres its inline
 * content by default, which previously moved an absolutely positioned thumb outside the track.
 * Keeping both thumb positions in normal flow makes the control robust across themes and zoom.
 */
export function ToggleSwitch({
  checked,
  onChange,
  testId,
  ariaLabel,
  disabled = false
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border p-[3px] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--devlens-accent-soft)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent)]'
          : 'border-white/15 bg-ink-700'
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'pointer-events-none block h-4 w-4 rounded-full shadow-sm transition-transform duration-200 ease-out',
          checked ? 'translate-x-4 bg-ink-950' : 'translate-x-0 bg-ink-200'
        ].join(' ')}
      />
    </button>
  )
}
