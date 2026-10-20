import { useEffect, useRef, useState } from 'react'
import {
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  History,
  Pin,
  ShieldCheck,
  ShieldOff
} from 'lucide-react'
import type { HistoryPolicy } from '@shared/privacy'
import { useMenuDismiss } from '@renderer/hooks/useMenuDismiss'

interface HistoryPolicySelectProps {
  value: HistoryPolicy
  onChange: (value: HistoryPolicy) => void
}

const OPTIONS: {
  value: HistoryPolicy
  label: string
  detail: string
  icon: typeof History
}[] = [
  {
    value: 'remember',
    label: 'Remember history',
    detail: 'Keep visits until an expiration rule removes older entries.',
    icon: History
  },
  {
    value: 'never',
    label: 'Never remember history',
    detail: 'Stop writing history and clear existing entries.',
    icon: ShieldOff
  },
  {
    value: 'pinned',
    label: 'Pinned tabs only',
    detail: 'Keep history and site data for pinned tab origins.',
    icon: Pin
  },
  {
    value: 'pinned-bookmarks',
    label: 'Pinned tabs + bookmarks',
    detail: 'Also keep the origins of every bookmarked page.',
    icon: Bookmark
  },
  {
    value: 'pinned-exceptions',
    label: 'Pinned tabs + allowed sites',
    detail: 'Also keep sites listed in browsing-data exceptions.',
    icon: ShieldCheck
  },
  {
    value: 'pinned-bookmarks-exceptions',
    label: 'Pinned tabs + bookmarks + allowed sites',
    detail: 'Keep all three custom retention groups.',
    icon: BookmarkCheck
  }
]

export function HistoryPolicySelect({ value, onChange }: HistoryPolicySelectProps) {
  const [open, setOpen] = useState(false)
  const [openAbove, setOpenAbove] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapper = useRef<HTMLDivElement | null>(null)
  const selected = OPTIONS.find((option) => option.value === value) ?? OPTIONS[0]
  const SelectedIcon = selected.icon

  useMenuDismiss({
    ref: wrapper,
    onClose: () => setOpen(false),
    closeOnBlur: true
  })

  useEffect(() => {
    if (!open) return
    const index = OPTIONS.findIndex((option) => option.value === value)
    setActiveIndex(index >= 0 ? index : 0)
  }, [open, value])

  const choose = (next: HistoryPolicy): void => {
    onChange(next)
    setOpen(false)
  }

  const move = (direction: 1 | -1): void => {
    setActiveIndex((index) => (index + direction + OPTIONS.length) % OPTIONS.length)
  }

  const show = (): void => {
    const rect = wrapper.current?.getBoundingClientRect()
    if (rect) {
      const below = window.innerHeight - rect.bottom
      setOpenAbove(below < 430 && rect.top > below)
    }
    setOpen(true)
  }

  return (
    <div ref={wrapper} className="relative w-full">
      <button
        type="button"
        role="combobox"
        data-testid="privacy-history-policy"
        aria-label="History policy"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="privacy-history-policy-listbox"
        aria-activedescendant={
          open ? `privacy-history-policy-${OPTIONS[activeIndex]?.value}` : undefined
        }
        onClick={() => {
          if (open) setOpen(false)
          else show()
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) {
              show()
              return
            }
            move(event.key === 'ArrowDown' ? 1 : -1)
            return
          }
          if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            if (!open) show()
            setActiveIndex(event.key === 'Home' ? 0 : OPTIONS.length - 1)
            return
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!open) {
              show()
              return
            }
            choose(OPTIONS[activeIndex].value)
            return
          }
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            setOpen(false)
          }
        }}
        className={[
          'group flex min-h-[62px] w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left outline-none transition-all',
          open
            ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
            : 'border-[var(--devlens-hairline)] bg-[var(--devlens-tab)] hover:border-[var(--devlens-hairline-strong)] hover:bg-[var(--devlens-tab-active)]',
          'focus-visible:border-[var(--devlens-accent-line)] focus-visible:ring-2 focus-visible:ring-[var(--devlens-accent-soft)]'
        ].join(' ')}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--devlens-hairline)] bg-[var(--devlens-tab-active)] text-[var(--devlens-accent)]">
          <SelectedIcon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-medium uppercase tracking-[0.12em] text-ink-500">
            History policy
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
          id="privacy-history-policy-listbox"
          role="listbox"
          data-testid="privacy-history-policy-listbox"
          className={[
            'absolute left-0 z-50 w-full max-w-[460px] overflow-hidden rounded-xl border border-[var(--devlens-hairline-strong)] bg-[color-mix(in_srgb,var(--devlens-tab-active)_97%,var(--devlens-accent)_3%)] shadow-[0_22px_55px_rgba(0,0,0,0.48)] backdrop-blur-xl',
            openAbove ? 'bottom-full mb-2' : 'top-full mt-2'
          ].join(' ')}
        >
          <div className="flex items-center justify-between border-b border-[var(--devlens-hairline)] px-4 py-2.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              Keep between sessions
            </span>
            <span className="rounded-full border border-[var(--devlens-hairline)] bg-[var(--devlens-tab)] px-2 py-0.5 font-mono text-[8px] text-ink-400">
              6 policies
            </span>
          </div>
          <div className="max-h-[390px] overflow-y-auto p-1.5">
            {OPTIONS.map((option, index) => {
              const Icon = option.icon
              const active = option.value === value
              return (
                <button
                  key={option.value}
                  id={`privacy-history-policy-${option.value}`}
                  type="button"
                  role="option"
                  data-testid={`privacy-history-policy-${option.value}`}
                  aria-selected={active}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option.value)}
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
                    <Icon size={16} />
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
