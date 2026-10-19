import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Search, X } from 'lucide-react'
import {
  APP_ICON_CATEGORIES,
  APP_ICON_STYLES,
  appIconDesign,
  type AppIconCategory,
  type AppIconColor,
  type AppIconShape,
  type AppIconStyle
} from '@shared/app-icon-art'

interface AppIconPickerProps {
  value: AppIconStyle
  onChange: (style: AppIconStyle) => void
  onClose: () => void
}

export function AppIconPreview({
  style,
  size = 56,
  className = ''
}: {
  style: AppIconStyle
  size?: number
  className?: string
}) {
  const design = appIconDesign(style)
  const color = (token: AppIconColor): string => design.palette[token]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={['block shrink-0', className].join(' ')}
      data-app-icon={style}
    >
      <rect width="100" height="100" rx="22" fill={design.background} />
      {design.shapes.map((shape, index) => renderShape(shape, index, color))}
    </svg>
  )
}

function renderShape(
  shape: AppIconShape,
  index: number,
  color: (token: AppIconColor) => string
): ReactNode {
  const common = {
    opacity: shape.opacity,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  }
  if (shape.kind === 'circle') {
    return (
      <circle
        key={index}
        cx={shape.cx}
        cy={shape.cy}
        r={shape.r}
        fill={shape.fill ? color(shape.fill) : 'none'}
        stroke={shape.stroke ? color(shape.stroke) : 'none'}
        strokeWidth={shape.width}
        {...common}
      />
    )
  }
  if (shape.kind === 'rect') {
    return (
      <rect
        key={index}
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        rx={shape.radius}
        fill={shape.fill ? color(shape.fill) : 'none'}
        stroke={shape.stroke ? color(shape.stroke) : 'none'}
        strokeWidth={shape.strokeWidth}
        {...common}
      />
    )
  }
  if (shape.kind === 'line') {
    return (
      <line
        key={index}
        x1={shape.x1}
        y1={shape.y1}
        x2={shape.x2}
        y2={shape.y2}
        stroke={color(shape.stroke)}
        strokeWidth={shape.width}
        {...common}
      />
    )
  }
  if (shape.kind === 'polyline') {
    return (
      <polyline
        key={index}
        points={shape.points.map((point) => point.join(',')).join(' ')}
        fill="none"
        stroke={shape.stroke ? color(shape.stroke) : 'none'}
        strokeWidth={shape.width}
        {...common}
      />
    )
  }
  return (
    <polygon
      key={index}
      points={shape.points.map((point) => point.join(',')).join(' ')}
      fill={shape.fill ? color(shape.fill) : 'none'}
      stroke={shape.stroke ? color(shape.stroke) : 'none'}
      strokeWidth={shape.width}
      {...common}
    />
  )
}

export function AppIconPicker({ value, onChange, onClose }: AppIconPickerProps) {
  const [category, setCategory] = useState<'all' | AppIconCategory>('all')
  const [query, setQuery] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return APP_ICON_STYLES.filter(
      (design) =>
        (category === 'all' || design.category === category) &&
        (!needle || `${design.label} ${design.category}`.toLowerCase().includes(needle))
    )
  }, [category, query])

  const selected = appIconDesign(value)

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-icon-picker-title"
        data-testid="app-icon-picker"
        className="flex max-h-[min(820px,92vh)] w-full max-w-[980px] flex-col overflow-hidden rounded-xl border border-white/10 bg-ink-900 shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--devlens-hairline)] px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--devlens-accent)]">
              Appearance / Browser icon
            </p>
            <h2 id="app-icon-picker-title" className="mt-1 text-[24px] font-semibold text-ink-100">
              Browser icons
            </h2>
            <p className="mt-1 text-[11px] text-ink-400">
              Pick a mark for DevLens in the taskbar, desktop and Start menu.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close browser icons"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--devlens-hairline)] text-ink-400 hover:border-[var(--devlens-accent-line)] hover:text-ink-100"
          >
            <X size={15} />
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--devlens-hairline)] px-5 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5" role="tablist" aria-label="Icon collections">
            {APP_ICON_CATEGORIES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={category === entry.id}
                onClick={() => setCategory(entry.id)}
                className={[
                  'rounded-full border px-3 py-1.5 text-[10px] transition-colors',
                  category === entry.id
                    ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                    : 'border-[var(--devlens-hairline)] text-ink-400 hover:text-ink-100'
                ].join(' ')}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <label className="flex h-8 w-full items-center gap-2 rounded-md border border-[var(--devlens-hairline)] bg-black/20 px-2.5 focus-within:border-[var(--devlens-accent-line)] sm:w-[190px]">
            <Search size={12} className="shrink-0 text-ink-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find an icon"
              aria-label="Find a browser icon"
              className="min-w-0 flex-1 bg-transparent text-[10px] text-ink-200 outline-none placeholder:text-ink-600"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-ink-500">
              {APP_ICON_CATEGORIES.find((entry) => entry.id === category)?.label}
            </p>
            <span className="font-mono text-[9px] text-ink-600">{visible.length} icons</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 min-[520px]:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {visible.map((design) => {
              const active = design.id === value
              return (
                <button
                  key={design.id}
                  type="button"
                  aria-label={`Use ${design.label} browser icon`}
                  aria-pressed={active}
                  data-testid={`app-icon-choice-${design.id}`}
                  onClick={() => onChange(design.id)}
                  className={[
                    'group flex min-w-0 flex-col items-center gap-2 rounded-lg border p-2.5 text-center transition-colors',
                    active
                      ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                      : 'border-[var(--devlens-hairline)] bg-white/[0.012] hover:border-white/20 hover:bg-white/[0.035]'
                  ].join(' ')}
                >
                  <span className="relative">
                    <AppIconPreview style={design.id} size={62} className="transition-transform group-hover:-translate-y-0.5" />
                    {active && (
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink-900 bg-[var(--devlens-accent)] text-ink-950">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="w-full truncate text-[10px] text-ink-300">{design.label}</span>
                </button>
              )
            })}
          </div>
          {visible.length === 0 && (
            <div className="flex min-h-40 items-center justify-center text-[11px] text-ink-500">
              No browser icons match that search.
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[var(--devlens-hairline)] px-5 py-3 sm:px-6">
          <p className="min-w-0 truncate text-[10px] text-ink-500">
            Selected: <span className="text-ink-200">{selected.label}</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-[var(--devlens-accent)] px-4 py-2 text-[10px] font-medium text-ink-950 hover:brightness-105"
          >
            Done
          </button>
        </footer>
      </section>
    </div>,
    document.body
  )
}
