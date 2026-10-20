import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { useMenuDismiss } from '@renderer/hooks/useMenuDismiss'

export interface SelectOption {
  value: string
  /** Stable DOM identity when the stored value contains shell-only prefixes. */
  id?: string
  label: string
  description?: string
  icon?: ReactNode
  disabled?: boolean
}

export interface SelectSection {
  label?: string
  options: SelectOption[]
}

interface SelectMenuProps {
  value: string
  onChange: (value: string) => void
  sections: SelectSection[]
  ariaLabel: string
  testId: string
  placeholder?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
  menuWidth?: number
  listTestId?: string
  optionTestIdPrefix?: string
}

const SAFE_ID = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '_')

export function SelectMenu({
  value,
  onChange,
  sections,
  ariaLabel,
  testId,
  placeholder = 'Choose an option',
  disabled = false,
  size = 'md',
  className = '',
  menuWidth = 240,
  listTestId,
  optionTestIdPrefix
}: SelectMenuProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: menuWidth,
    maxHeight: 320
  })

  const items = useMemo(() => sections.flatMap((section) => section.options), [sections])
  const selected = items.find((option) => option.value === value)
  const listId = listTestId ?? `${testId}-listbox`
  const optionPrefix = optionTestIdPrefix ?? `${testId}-option`

  useMenuDismiss({
    ref: [triggerRef, menuRef],
    onClose: () => setOpen(false),
    closeOnBlur: true
  })

  useLayoutEffect(() => {
    if (!open) return
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(
      Math.max(rect.width, menuWidth),
      Math.max(180, window.innerWidth - 16)
    )
    const spaceBelow = window.innerHeight - rect.bottom - 10
    const spaceAbove = rect.top - 10
    const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow
    const maxHeight = Math.min(340, openAbove ? spaceAbove : spaceBelow)
    const top = openAbove ? Math.max(8, rect.top - maxHeight - 6) : rect.bottom + 6
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    setPosition({ left, top, width, maxHeight })
  }, [menuWidth, open])

  useEffect(() => {
    if (!open) return
    const index = items.findIndex((option) => option.value === value)
    setActiveIndex(index >= 0 ? index : 0)
  }, [items, open, value])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const choose = (option: SelectOption): void => {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
  }

  const show = (): void => {
    if (disabled) return
    setOpen(true)
  }

  const move = (direction: 1 | -1): void => {
    if (!items.length) return
    let next = activeIndex
    for (let count = 0; count < items.length; count += 1) {
      next = (next + direction + items.length) % items.length
      if (!items[next].disabled) {
        setActiveIndex(next)
        return
      }
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        data-testid={testId}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && items[activeIndex]
            ? `${optionPrefix}-${SAFE_ID(items[activeIndex].id ?? items[activeIndex].value)}`
            : undefined
        }
        disabled={disabled}
        title={selected?.label ?? placeholder}
        onClick={() => {
          if (open) setOpen(false)
          else show()
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) show()
            else move(event.key === 'ArrowDown' ? 1 : -1)
            return
          }
          if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            if (!open) show()
            const index =
              event.key === 'Home'
                ? items.findIndex((option) => !option.disabled)
                : items.findLastIndex((option) => !option.disabled)
            if (index >= 0) setActiveIndex(index)
            return
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!open) show()
            else if (items[activeIndex]) choose(items[activeIndex])
            return
          }
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            setOpen(false)
          }
        }}
        className={[
          'group flex min-w-0 items-center rounded-lg border px-2.5 text-left outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40',
          size === 'sm' ? 'min-h-8 gap-1.5 text-[10px]' : 'min-h-10 gap-2 text-[11px]',
          open
            ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
            : 'border-[var(--devlens-hairline)] bg-[var(--devlens-tab)] hover:border-[var(--devlens-hairline-strong)] hover:bg-[var(--devlens-tab-active)]',
          'focus-visible:border-[var(--devlens-accent-line)] focus-visible:ring-2 focus-visible:ring-[var(--devlens-accent-soft)]',
          className
        ].join(' ')}
      >
        {selected?.icon && <span className="shrink-0 text-ink-400">{selected.icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ink-200">{selected?.label ?? placeholder}</span>
          {size === 'md' && selected?.description && (
            <span className="mt-0.5 block truncate text-[9px] text-ink-500">
              {selected.description}
            </span>
          )}
        </span>
        <ChevronDown
          size={size === 'sm' ? 12 : 14}
          className={[
            'shrink-0 text-ink-500 transition-transform duration-200 group-hover:text-ink-300',
            open ? 'rotate-180' : ''
          ].join(' ')}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            data-testid={listId}
            style={{
              left: position.left,
              top: position.top,
              width: position.width,
              maxHeight: position.maxHeight
            }}
            className="devlens-dropdown-surface fixed z-[150] overflow-y-auto rounded-xl border p-1.5 backdrop-blur-xl"
          >
            {sections.map((section, sectionIndex) => (
              <div
                key={section.label ?? sectionIndex}
                className={sectionIndex > 0 ? 'mt-1 border-t border-[var(--devlens-hairline)] pt-1' : ''}
              >
                {section.label && (
                  <p className="px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.13em] text-ink-500">
                    {section.label}
                  </p>
                )}
                {section.options.map((option) => {
                  const index = items.indexOf(option)
                  const selectedOption = option.value === value
                  return (
                    <button
                      key={option.value}
                      id={`${optionPrefix}-${SAFE_ID(option.id ?? option.value)}`}
                      type="button"
                      role="option"
                      data-testid={`${optionPrefix}-${SAFE_ID(option.id ?? option.value)}`}
                      aria-selected={selectedOption}
                      disabled={option.disabled}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(option)}
                      className={[
                        'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                        selectedOption
                          ? 'bg-[var(--devlens-accent-soft)]'
                          : index === activeIndex
                            ? 'bg-white/[0.065]'
                            : 'hover:bg-white/[0.045]'
                      ].join(' ')}
                    >
                      {option.icon && <span className="shrink-0 text-ink-400">{option.icon}</span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] text-ink-100">{option.label}</span>
                        {option.description && (
                          <span className="mt-0.5 block truncate text-[9px] text-ink-500">
                            {option.description}
                          </span>
                        )}
                      </span>
                      <span
                        className={[
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                          selectedOption
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
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
