import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { IdeId, IdeOption } from '@shared/ide'
import { IDE_BRAND_THEME, ideBrandLogo } from '@shared/ide-brand'
import { useMenuDismiss } from '@renderer/hooks/useMenuDismiss'

interface IdeSelectProps {
  options: IdeOption[]
  value: IdeId
  disabled: boolean
  onChange: (id: IdeId) => void
}

function EditorIcon({ option }: { option: IdeOption | undefined }) {
  if (!option) return null
  const brand = IDE_BRAND_THEME[option.id]
  return (
    <span
      className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_4px_12px_rgba(0,0,0,0.22)]"
      style={{ backgroundColor: brand.background, borderColor: brand.border }}
    >
      <img
        src={ideBrandLogo(option.id)}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="h-[23px] w-[23px] select-none object-contain"
      />
      {option.id === 'codebuddycn' && (
        <span
          aria-hidden="true"
          className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-[#ff7a59] ring-2 ring-[#0b0d11]"
        />
      )}
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
        className={[
          'group flex min-h-[58px] w-full min-w-0 items-center gap-3 rounded-xl border px-3.5 py-2 text-left outline-none transition-all',
          open
            ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] shadow-[0_8px_24px_rgba(0,0,0,0.22)]'
            : 'border-[var(--devlens-hairline)] bg-[var(--devlens-tab)] hover:border-[var(--devlens-hairline-strong)] hover:bg-[var(--devlens-tab-active)]',
          'focus-visible:border-[var(--devlens-accent-line)] focus-visible:ring-2 focus-visible:ring-[var(--devlens-accent-soft)]',
          'disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-black/10'
        ].join(' ')}
      >
        <EditorIcon option={selected} />
        <span className="min-w-0 flex-1">
          <span className="mb-0.5 block text-[9px] font-medium uppercase tracking-[0.12em] text-ink-500">
            Open files with
          </span>
          <span className="block truncate text-[12px] font-medium text-ink-100">
            {selected?.label ?? 'Choose an editor'}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[9px] text-ink-500">
            {selected?.installed ? selected.detail ?? 'Installed editor' : 'Not detected'}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={[
            'mr-0.5 shrink-0 text-ink-500 transition-transform duration-200 group-hover:text-ink-300',
            open ? 'rotate-180' : ''
          ].join(' ')}
        />
      </button>

      {open && (
        <div
          id="developer-ide-listbox"
          role="listbox"
          data-testid="developer-ide-listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[var(--devlens-hairline-strong)] bg-[color-mix(in_srgb,var(--devlens-tab-active)_97%,var(--devlens-accent)_3%)] shadow-[0_22px_55px_rgba(0,0,0,0.48),0_1px_0_rgba(255,255,255,0.05)_inset] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-[var(--devlens-hairline)] px-3.5 py-2.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              Installed on this PC
            </span>
            <span className="rounded-full border border-[var(--devlens-hairline)] bg-[var(--devlens-tab)] px-2 py-0.5 font-mono text-[8px] text-ink-400">
              {items.filter((option) => option.installed).length}
            </span>
          </div>
          <div className="max-h-[318px] overflow-y-auto p-1.5">
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
                    'group/row relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                    selectedOption
                      ? 'bg-[var(--devlens-accent-soft)]'
                      : index === activeIndex
                        ? 'bg-white/[0.065]'
                        : 'bg-transparent hover:bg-white/[0.045]'
                  ].join(' ')}
                >
                  {selectedOption && (
                    <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--devlens-accent)]" />
                  )}
                  <EditorIcon option={option} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] font-medium text-ink-100">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[9px] text-ink-500">
                      {option.installed ? option.detail ?? 'Installed' : 'Not detected'}
                    </span>
                  </span>
                  <span
                    className={[
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                      selectedOption
                        ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent)] text-white'
                        : 'border-white/10 text-transparent group-hover/row:border-white/20'
                    ].join(' ')}
                  >
                    <Check size={11} strokeWidth={2.5} />
                  </span>
                </button>
              )
            })}
          </div>
          {items.length === 0 && (
            <p className="px-3 py-4 text-center text-[10px] text-ink-500">No installed editors found.</p>
          )}
          <div className="border-t border-[var(--devlens-hairline)] px-3.5 py-2 text-[8.5px] text-ink-500">
            Detected from Windows app registrations
          </div>
        </div>
      )}
    </div>
  )
}
