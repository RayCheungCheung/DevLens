import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  Globe2,
  LayoutDashboard,
  PanelsTopLeft,
  Pin
} from 'lucide-react'
import type { StartupTabMode } from '@shared/launchpad'
import { useMenuDismiss } from '@renderer/hooks/useMenuDismiss'

interface StartupTabsSelectProps {
  value: StartupTabMode
  savedCount: number
  pinnedCount: number
  onChange: (value: StartupTabMode) => void
}

export function StartupTabsSelect({
  value,
  savedCount,
  pinnedCount,
  onChange
}: StartupTabsSelectProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapper = useRef<HTMLDivElement | null>(null)

  const options = useMemo(
    () => [
      {
        id: 'none' as const,
        label: 'Start fresh',
        detail: 'Use the Launchpad or homepage target.',
        icon: LayoutDashboard
      },
      {
        id: 'pinned' as const,
        label: 'Pinned tabs only',
        detail: `${pinnedCount} pinned tab${pinnedCount === 1 ? '' : 's'} will reopen.`,
        icon: Pin
      },
      {
        id: 'all' as const,
        label: 'All previous tabs',
        detail: `${savedCount} saved tab${savedCount === 1 ? '' : 's'} will reopen.`,
        icon: PanelsTopLeft
      },
      {
        id: 'custom' as const,
        label: 'Custom link',
        detail: 'Open one specific page at launch.',
        icon: Globe2
      }
    ],
    [pinnedCount, savedCount]
  )
  const selected = options.find((option) => option.id === value) ?? options[0]

  useMenuDismiss({
    ref: wrapper,
    onClose: () => setOpen(false),
    closeOnBlur: true
  })

  useEffect(() => {
    if (!open) return
    const index = options.findIndex((option) => option.id === value)
    setActiveIndex(index >= 0 ? index : 0)
  }, [open, options, value])

  const choose = (id: StartupTabMode): void => {
    onChange(id)
    setOpen(false)
  }

  const move = (direction: 1 | -1): void => {
    if (!options.length) return
    setActiveIndex((current) => (current + direction + options.length) % options.length)
  }

  const Icon = selected.icon

  return (
    <div ref={wrapper} className="relative w-[300px] max-w-full">
      <button
        type="button"
        role="combobox"
        data-testid="launchpad-startup-tabs"
        aria-label="Open previous windows and tabs"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="launchpad-startup-tabs-listbox"
        aria-activedescendant={
          open ? `launchpad-startup-option-${options[activeIndex]?.id}` : undefined
        }
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) {
              setOpen(true)
              return
            }
            move(event.key === 'ArrowDown' ? 1 : -1)
            return
          }
          if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            if (!open) setOpen(true)
            setActiveIndex(event.key === 'Home' ? 0 : options.length - 1)
            return
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!open) {
              setOpen(true)
              return
            }
            choose(options[activeIndex].id)
            return
          }
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            setOpen(false)
          }
        }}
        className={[
          'group flex min-h-[58px] w-full items-center gap-3 rounded-xl border px-3.5 py-2 text-left outline-none transition-all',
          open
            ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] shadow-[0_8px_24px_rgba(0,0,0,0.2)]'
            : 'border-[var(--devlens-hairline)] bg-[var(--devlens-tab)] hover:border-[var(--devlens-hairline-strong)] hover:bg-[var(--devlens-tab-active)]',
          'focus-visible:border-[var(--devlens-accent-line)] focus-visible:ring-2 focus-visible:ring-[var(--devlens-accent-soft)]'
        ].join(' ')}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--devlens-hairline)] bg-[var(--devlens-tab-active)] text-ink-300">
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-medium uppercase tracking-[0.12em] text-ink-500">
            Startup tabs
          </span>
          <span className="mt-0.5 block truncate text-[12px] font-medium text-ink-100">
            {selected.label}
          </span>
          <span className="mt-0.5 block truncate text-[9px] text-ink-500">{selected.detail}</span>
        </span>
        <ChevronDown
          size={15}
          className={[
            'shrink-0 text-ink-500 transition-transform duration-200 group-hover:text-ink-300',
            open ? 'rotate-180' : ''
          ].join(' ')}
        />
      </button>

      {open && (
        <div
          id="launchpad-startup-tabs-listbox"
          role="listbox"
          data-testid="launchpad-startup-listbox"
          className="absolute right-0 top-full z-50 mt-2 w-[340px] overflow-hidden rounded-xl border border-[var(--devlens-hairline-strong)] bg-[color-mix(in_srgb,var(--devlens-tab-active)_97%,var(--devlens-accent)_3%)] shadow-[0_22px_55px_rgba(0,0,0,0.48)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-[var(--devlens-hairline)] px-3.5 py-2.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              When DevLens starts
            </span>
            <span className="rounded-full border border-[var(--devlens-hairline)] bg-[var(--devlens-tab)] px-2 py-0.5 font-mono text-[8px] text-ink-400">
              4 modes
            </span>
          </div>
          <div className="p-1.5">
            {options.map((option, index) => {
              const OptionIcon = option.icon
              const active = option.id === value
              return (
                <button
                  key={option.id}
                  id={`launchpad-startup-option-${option.id}`}
                  type="button"
                  role="option"
                  data-testid={`launchpad-startup-option-${option.id}`}
                  aria-selected={active}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option.id)}
                  className={[
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors',
                    active
                      ? 'bg-[var(--devlens-accent-soft)]'
                      : index === activeIndex
                        ? 'bg-white/[0.065]'
                        : 'hover:bg-white/[0.045]'
                  ].join(' ')}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--devlens-hairline)] bg-[var(--devlens-tab)] text-ink-300">
                    <OptionIcon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-ink-100">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] text-ink-500">
                      {option.detail}
                    </span>
                  </span>
                  <span
                    className={[
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      active
                        ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent)] text-white'
                        : 'border-white/10 text-transparent'
                    ].join(' ')}
                  >
                    <Check size={11} strokeWidth={2.5} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
