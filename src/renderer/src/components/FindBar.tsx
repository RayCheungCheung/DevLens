import { useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import type { FindInPageResult } from '@shared/types'

interface FindBarProps {
  query: string
  enabled: boolean
  /** Bumped when the bar is opened, so the input takes focus even when it was already mounted. */
  focusSignal: number
  result: FindInPageResult | null
  onQueryChange: (value: string) => void
  onNext: (forward: boolean) => void
  onClose: () => void
}

/**
 * The native find bar.
 *
 * Search itself runs in the guest's webContents, so the count and the highlight use Chromium's
 * own finder rather than a DOM walk that would miss shadow roots and cross-frame text. This bar
 * only owns the query, the focus and the two directions.
 */
export function FindBar({
  query,
  enabled,
  focusSignal,
  result,
  onQueryChange,
  onNext,
  onClose
}: FindBarProps) {
  const input = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const element = input.current
    if (!element) return
    element.focus()
    element.select()
  }, [focusSignal])

  const countLabel = !enabled
    ? 'Web pages only'
    : !query.trim()
      ? 'Type to find'
      : result && result.matches > 0
        ? `${result.activeMatchOrdinal} / ${result.matches}`
        : 'No matches'

  return (
    <div
      role="search"
      aria-label="Find in page"
      data-testid="find-bar"
      className="absolute right-4 top-3 z-[75] flex w-[min(440px,calc(100%-2rem))] items-center gap-1.5 rounded-lg border border-[var(--devlens-hairline-strong)] bg-[color-mix(in_srgb,var(--color-ink-950)_96%,transparent)] p-1.5 shadow-2xl backdrop-blur-xl"
    >
      <Search size={14} className="ml-1.5 shrink-0 text-ink-400" />
      <input
        ref={input}
        type="text"
        value={query}
        disabled={!enabled}
        aria-label="Find text in page"
        placeholder={enabled ? 'Find in page' : 'Open a web page to search it'}
        data-testid="find-input"
        spellCheck={false}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onNext(!event.shiftKey)
          }
        }}
        className="h-7 min-w-0 flex-1 bg-transparent text-[12px] text-ink-100 outline-none placeholder:text-ink-500 disabled:cursor-not-allowed"
      />
      <span
        aria-live="polite"
        className={[
          'shrink-0 px-1 font-mono text-[10px]',
          result?.matches === 0 && query.trim() ? 'text-[var(--color-nova-rose)]' : 'text-ink-500'
        ].join(' ')}
      >
        {countLabel}
      </span>
      <button
        type="button"
        title="Previous match (Shift+Enter)"
        aria-label="Previous match"
        data-testid="find-previous"
        disabled={!enabled || !query.trim()}
        onClick={() => onNext(false)}
        className="flex h-7 w-7 items-center justify-center rounded text-ink-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:text-ink-700"
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        title="Next match (Enter)"
        aria-label="Next match"
        data-testid="find-next"
        disabled={!enabled || !query.trim()}
        onClick={() => onNext(true)}
        className="flex h-7 w-7 items-center justify-center rounded text-ink-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:text-ink-700"
      >
        <ChevronDown size={14} />
      </button>
      <button
        type="button"
        title="Close find bar (Esc)"
        aria-label="Close find bar"
        data-testid="find-close"
        onClick={onClose}
        className="flex h-7 w-7 items-center justify-center rounded text-ink-400 hover:bg-white/5 hover:text-ink-100"
      >
        <X size={14} />
      </button>
    </div>
  )
}
