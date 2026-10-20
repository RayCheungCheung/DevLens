import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { AI_SITES, type AiSiteId } from '@shared/ai-sites'
import { AI_BRAND_THEME, AiMark } from '@renderer/components/AiMark'
import { useMenuDismiss } from '@renderer/hooks/useMenuDismiss'

interface AiProviderSelectProps {
  value: AiSiteId
  onChange: (value: AiSiteId) => void
}

function ProviderMark({ site, size = 17 }: { site: AiSiteId; size?: number }) {
  const theme = AI_BRAND_THEME[site]
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
      style={{ backgroundColor: theme.background, borderColor: theme.border }}
    >
      <AiMark site={site} size={size} />
    </span>
  )
}

export function AiProviderSelect({ value, onChange }: AiProviderSelectProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapper = useRef<HTMLDivElement | null>(null)
  const current = AI_SITES.find((site) => site.id === value) ?? AI_SITES[0]

  useMenuDismiss({
    ref: wrapper,
    onClose: () => setOpen(false),
    closeOnBlur: true
  })

  useEffect(() => {
    if (!open) return
    const index = AI_SITES.findIndex((site) => site.id === value)
    setActiveIndex(index >= 0 ? index : 0)
  }, [open, value])

  const choose = (site: AiSiteId): void => {
    onChange(site)
    setOpen(false)
  }

  const move = (direction: 1 | -1): void => {
    setActiveIndex((index) => (index + direction + AI_SITES.length) % AI_SITES.length)
  }

  return (
    <div ref={wrapper} className="relative min-w-0 flex-1">
      <button
        type="button"
        role="combobox"
        data-testid="ai-model-select"
        aria-label="AI model"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="ai-model-listbox"
        aria-activedescendant={
          open ? `ai-model-option-${AI_SITES[activeIndex]?.id}` : undefined
        }
        title={current.label}
        onClick={() => setOpen((state) => !state)}
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
            setActiveIndex(event.key === 'Home' ? 0 : AI_SITES.length - 1)
            return
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!open) {
              setOpen(true)
              return
            }
            choose(AI_SITES[activeIndex].id)
            return
          }
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            setOpen(false)
          }
        }}
        className={[
          'group flex min-h-[42px] w-full min-w-0 items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left outline-none transition-colors',
          open
            ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
            : 'border-[var(--devlens-hairline)] bg-[var(--devlens-tab)] hover:border-[var(--devlens-hairline-strong)] hover:bg-[var(--devlens-tab-active)]',
          'focus-visible:border-[var(--devlens-accent-line)] focus-visible:ring-2 focus-visible:ring-[var(--devlens-accent-soft)]'
        ].join(' ')}
      >
        <ProviderMark site={current.id} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11.5px] font-medium text-ink-100">
            {current.label}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[8.5px] text-ink-500">
            {current.host}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={[
            'shrink-0 text-ink-500 transition-transform duration-200 group-hover:text-ink-300',
            open ? 'rotate-180' : ''
          ].join(' ')}
        />
      </button>

      {open && (
        <div
          id="ai-model-listbox"
          role="listbox"
          data-testid="ai-model-listbox"
          className="absolute left-0 top-full z-[80] mt-1.5 w-[292px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--devlens-hairline-strong)] bg-[color-mix(in_srgb,var(--devlens-tab-active)_97%,var(--devlens-accent)_3%)] shadow-[0_20px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-[var(--devlens-hairline)] px-3 py-2">
            <span className="text-[8.5px] font-semibold uppercase tracking-[0.13em] text-ink-500">
              AI assistant
            </span>
            <span className="rounded-full border border-[var(--devlens-hairline)] bg-[var(--devlens-tab)] px-1.5 py-0.5 font-mono text-[8px] text-ink-400">
              4 providers
            </span>
          </div>
          <div className="p-1.5">
            {AI_SITES.map((site, index) => {
              const selected = site.id === value
              return (
                <button
                  key={site.id}
                  id={`ai-model-option-${site.id}`}
                  type="button"
                  role="option"
                  data-testid={`ai-model-option-${site.id}`}
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(site.id)}
                  className={[
                    'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
                    selected
                      ? 'bg-[var(--devlens-accent-soft)]'
                      : index === activeIndex
                        ? 'bg-white/[0.065]'
                        : 'hover:bg-white/[0.045]'
                  ].join(' ')}
                >
                  <ProviderMark site={site.id} size={18} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] font-medium text-ink-100">
                      {site.label}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[8.5px] text-ink-500">
                      {site.host}
                    </span>
                  </span>
                  <span
                    className={[
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      selected
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
