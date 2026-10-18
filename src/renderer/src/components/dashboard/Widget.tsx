import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface WidgetProps {
  icon: LucideIcon
  /** Card title. The dashboard's own labels are the only headings the widgets add. */
  title: string
  /** One short line under the title; omitted when there is nothing to add. */
  note?: string
  /** Right-aligned controls (a count, a rescan button, ...). */
  action?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * The dashboard's card shell.
 *
 * Every widget is the same object - a hairline card, a small icon-and-title header with an
 * optional control on the right, then the body - so the grid reads as one surface rather than as
 * a pile of unrelated panels. The header is a fixed height and the body owns its own scrolling,
 * which keeps a card from resizing when its contents change.
 */
export function Widget({ icon: Icon, title, note, action, className = '', children }: WidgetProps) {
  return (
    <section
      /* The title doubles as the widget's handle: one place to look a card up, in the UI and in
         a test, without inventing an id per card that nothing else needs. */
      data-widget={title}
      className={['nova-card flex min-w-0 flex-col gap-2.5 px-3.5 py-3', className].join(' ')}
    >
      {/* The header wraps instead of clipping: a dashboard card can be 340px wide when the
          developer sidebar is open, and a title cut to "F..." is not a title. */}
      <header className="flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1">
        <Icon size={13} className="shrink-0 text-[var(--devlens-accent)]" />
        <h2 className="min-w-0 flex-1 text-[11px] tracking-wide text-ink-200">{title}</h2>
        {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
      </header>
      {note && <p className="-mt-1.5 truncate font-mono text-[9px] text-ink-600">{note}</p>}
      <div className="min-w-0">{children}</div>
    </section>
  )
}

/** A widget control: the small pill buttons the cards use in their headers. */
export function WidgetAction({
  label,
  title,
  onClick,
  disabled = false,
  children
}: {
  label: string
  title?: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-[var(--devlens-hairline)] px-2 text-[10px] text-ink-400 transition-colors hover:border-[var(--devlens-accent-line)] hover:bg-[var(--devlens-accent-soft)] hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}
