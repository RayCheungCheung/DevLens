import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { IdeId, IdeOption } from '@shared/ide'
import { useMenuDismiss } from '@renderer/hooks/useMenuDismiss'

interface IdeSelectProps {
  options: IdeOption[]
  value: IdeId
  disabled: boolean
  onChange: (id: IdeId) => void
}

function EditorIcon({ option }: { option: IdeOption | undefined }) {
  if (option?.icon) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/25 p-0.5">
        <img src={option.icon} alt="" className="h-full w-full object-contain" />
      </span>
    )
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] font-mono text-[10px] font-semibold uppercase text-[var(--devlens-accent)]">
      {(option?.label ?? '?').slice(0, 2)}
    </span>
  )
}

export function IdeSelect({ options, value, disabled, onChange }: IdeSelectProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapper = useRef<HTMLDivElement | null>(null)
  const selected = useMemo(
    () => options.find((option) => option.id === value),
    [options, value]
  )
  const installed = useMemo(() => options.filter((option) => option.installed), [options])
  const items = useMemo(
    () =>
      selected && !selected.installed
        ? [selected, ...installed]
        : installed.length
          ? installed
          : selected
            ? [selected]
            : [],
    [installed, selected]
  )

  useMenuDismiss({
    ref: wrapper,
    onClose: () => setOpen(false),
    closeOnBlur: true
  })

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  useEffect(() => {
    if (!open) return
    const index = items.findIndex((option) => option.id === value)
    setActiveIndex(index >= 0 ? index : 0)
  }, [items, open, value])

  const choose = (option: IdeOption): void => {
    if (!option.installed) return
    onChange(option.id)
    setOpen(false)
  }

  const move = (direction: 1 | -1): void => {
    if (items.length === 0) return
    let next = activeIndex
    for (let count = 0; count < items.length; count += 1) {
      next = (next + direction + items.length) % items.length
      if (items[next].installed) {
        setActiveIndex(next)
        return
      }
    }
  }

  return (
    <div ref={wrapper} className="relative min-w-0 flex-1">
      <button
        type="button"
        role="combobox"
        data-testid="developer-ide-select"
        aria-label="Editor for opening source files"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="developer-ide-listbox"
        aria-activedescendant={open && items[activeIndex] ? `developer-ide-option-${items[activeIndex].id}` : undefined}
        disabled={disabled}
        onClick={() => {
          setOpen((current) => !current)
        }}
        onKeyDown={(event) => {
          if (disabled) return
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
            if (!open) setOpen(true)
            event.preventDefault()
            const candidates = items
              .map((option, index) => ({ option, index }))
              .filter(({ option }) => option.installed)
            if (candidates.length) {
              setActiveIndex(
                event.key === 'Home' ? candidates[0].index : candidates[candidates.length - 1].index
              )
            }
            return
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!open) {
              setOpen(true)
              return
            }
            const option = items[activeIndex]
            if (option) choose(option)
            return
          }
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            setOpen(false)
          }
        }}
        className="flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-lg border border-[var(--devlens-hairline)] bg-black/20 px-3 py-2 text-left outline-none transition-colors hover:border-white/20 focus-visible:border-[var(--devlens-accent-line)] focus-visible:ring-2 focus-visible:ring-[var(--devlens-accent-soft)] disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-black/10"
      >
        <EditorIcon option={selected} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] text-ink-100">
            {selected?.label ?? 'Choose an editor'}
          </span>
          <span className="mt-0.5 block truncate text-[9px] text-ink-500">
            {selected?.installed ? selected.detail ?? 'Installed editor' : 'Not detected'}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={['shrink-0 text-ink-500 transition-transform', open ? 'rotate-180' : ''].join(' ')}
        />
      </button>

      {open && (
        <div
          id="developer-ide-listbox"
          role="listbox"
          data-testid="developer-ide-listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-lg border border-white/15 bg-[#111317] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
        >
          {items.map((option, index) => {
            const selectedOption = option.id === value
            return (
              <button
                key={option.id}
                id={`developer-ide-option-${option.id}`}
                type="button"
                role="option"
                data-testid={`developer-ide-option-${option.id}`}
                aria-selected={selectedOption}
                disabled={!option.installed}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
                className={[
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                  index === activeIndex
                    ? 'bg-white/[0.07]'
                    : 'bg-transparent',
                  selectedOption
                    ? 'ring-1 ring-inset ring-[var(--devlens-accent-line)]'
                    : ''
                ].join(' ')}
              >
                <EditorIcon option={option} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] text-ink-100">{option.label}</span>
                  <span className="mt-0.5 block truncate text-[9px] text-ink-500">
                    {option.installed ? option.detail ?? 'Installed' : 'Not detected'}
                  </span>
                </span>
                {selectedOption && <Check size={13} className="shrink-0 text-[var(--devlens-accent)]" />}
              </button>
            )
          })}
          {items.length === 0 && (
            <p className="px-3 py-4 text-center text-[10px] text-ink-500">No installed editors found.</p>
          )}
        </div>
      )}
    </div>
  )
}
