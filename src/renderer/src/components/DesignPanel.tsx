import { useEffect, useMemo, useState } from 'react'
import { Copy, Eraser, Pencil, Play, Save } from 'lucide-react'
import type { ViewportId } from '@shared/types'

export type DesignTarget = 'active' | 'both'

interface DesignPanelProps {
  css: string
  onCssChange: (css: string) => void
  designMode: boolean
  onDesignModeChange: (enabled: boolean) => void
  target: DesignTarget
  onTargetChange: (target: DesignTarget) => void
  activeView: ViewportId
  onApply: () => void
  onClear: () => void
  status: string | null
  appliedAt: number | null
  /** Draft differs from what is live in the viewports. */
  dirty?: boolean
}

const SAMPLE = `/* Try it: this is injected into the live viewport */
body {
  background: #101418;
  color: #e6edf3;
}

header, nav {
  outline: 1px solid rgba(45, 212, 191, 0.6);
}`

/**
 * Live design and CSS overrides.
 *
 * CSS goes into the guest through webview.insertCSS, and design mode flips
 * document.designMode inside the guest, so both survive only as long as the document -
 * the frame replays them after every navigation.
 */
export function DesignPanel({
  css,
  onCssChange,
  designMode,
  onDesignModeChange,
  target,
  onTargetChange,
  activeView,
  onApply,
  onClear,
  status,
  appliedAt,
  dirty = false
}: DesignPanelProps) {
  const [copied, setCopied] = useState(false)
  const lineCount = useMemo(() => css.split('\n').filter((line) => line.trim()).length, [css])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = async (): Promise<void> => {
    await window.devlens.clipboardWrite(css)
    setCopied(true)
  }

  const save = async (): Promise<void> => {
    await window.devlens.saveTextFile({
      filename: 'devlens-overrides.css',
      content: css,
      title: 'Save CSS overrides'
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 border-b border-white/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={designMode}
            onClick={() => onDesignModeChange(!designMode)}
            className={[
              'inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md border text-[11px] transition-colors',
              designMode
                ? 'border-teal-400/50 bg-teal-400/10 text-teal-100'
                : 'border-white/10 text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
            ].join(' ')}
          >
            <Pencil size={12} />
            Design mode
            <span className={designMode ? 'text-teal-300' : 'text-neutral-600'}>
              {designMode ? 'on' : 'off'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-white/10 p-0.5">
            {(['active', 'both'] as DesignTarget[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onTargetChange(option)}
                className={[
                  'rounded-[4px] px-2 py-0.5 text-[10px] transition-colors',
                  target === option
                    ? 'bg-white/10 text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-300'
                ].join(' ')}
              >
                {option === 'active' ? activeView : 'both'}
              </button>
            ))}
          </div>
          <span className="font-mono text-[10px] text-neutral-600">{lineCount} lines</span>
          {dirty && <span className="font-mono text-[10px] text-amber-300">unapplied</span>}
          {appliedAt && (
            <span className="font-mono text-[10px] text-neutral-600">
              applied {new Date(appliedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <textarea
        value={css}
        spellCheck={false}
        aria-label="CSS overrides"
        onChange={(event) => onCssChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            onApply()
          }
        }}
        placeholder={SAMPLE}
        className="min-h-0 flex-1 resize-none bg-neutral-950/60 px-3 py-2 font-mono text-[11px] leading-5 text-neutral-200 outline-none placeholder:text-neutral-700"
      />

      <div className="shrink-0 space-y-2 border-t border-white/5 px-3 py-2">
        {status && <p className="font-mono text-[10px] text-neutral-500">{status}</p>}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onApply}
            disabled={css.trim().length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-teal-400/40 bg-teal-400/10 px-2.5 py-1 text-[11px] text-teal-100 transition-colors hover:bg-teal-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-neutral-600"
          >
            <Play size={11} />
            Apply
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[11px] text-neutral-300 transition-colors hover:bg-white/5 hover:text-neutral-100"
          >
            <Eraser size={11} />
            Clear
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            disabled={css.trim().length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[11px] text-neutral-300 transition-colors hover:bg-white/5 hover:text-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-600"
          >
            <Copy size={11} />
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={css.trim().length === 0}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[11px] text-neutral-300 transition-colors hover:bg-white/5 hover:text-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-600"
          >
            <Save size={11} />
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
