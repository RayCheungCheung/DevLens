import { useEffect, useState } from 'react'
import { Check, Keyboard, RotateCcw } from 'lucide-react'
import {
  DEFAULT_HOTKEY_BINDINGS,
  HOTKEY_DEFINITIONS,
  findHotkeyConflict,
  hotkeyDefinition,
  shortcutFromEvent,
  type HotkeyActionId
} from '@shared/hotkeys'

interface HotkeySettingsProps {
  bindings: Record<HotkeyActionId, string>
  onChange: (bindings: Record<HotkeyActionId, string>) => void
}

const CATEGORY_LABELS = {
  system: {
    title: 'Browser & system',
    detail: 'Everyday tab, page and window commands.'
  },
  developer: {
    title: 'Developer workspace',
    detail: 'DevLens panels, Sidebar and isolated browsing modes.'
  }
} as const

export function HotkeySettings({ bindings, onChange }: HotkeySettingsProps) {
  const [capturing, setCapturing] = useState<HotkeyActionId | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!capturing) return
    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.key === 'Escape') {
        setCapturing(null)
        setNotice(null)
        return
      }

      const shortcut = shortcutFromEvent(event)
      if (!shortcut) return
      const conflict = findHotkeyConflict(bindings, capturing, shortcut)
      if (conflict) {
        setNotice(
          `${shortcut} is already assigned to ${hotkeyDefinition(conflict).label}.`
        )
        return
      }

      onChange({ ...bindings, [capturing]: shortcut })
      setCapturing(null)
      setNotice(`${hotkeyDefinition(capturing).label} now uses ${shortcut}.`)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [bindings, capturing, onChange])

  return (
    <div className="flex flex-col gap-4" data-testid="hotkey-settings">
      <section className="rounded-lg border border-[var(--devlens-hairline)] bg-white/[0.018]">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--devlens-hairline)] px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]">
            <Keyboard size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[12px] font-medium text-ink-100">Keyboard shortcuts</h3>
            <p className="mt-0.5 text-[10px] leading-4 text-ink-500">
              Click a binding, then press the new key combination. Escape cancels recording.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange({ ...DEFAULT_HOTKEY_BINDINGS })
              setCapturing(null)
              setNotice('All shortcuts were reset to their defaults.')
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--devlens-hairline)] px-2.5 text-[10px] text-ink-300 hover:border-[var(--devlens-accent-line)] hover:text-ink-100"
          >
            <RotateCcw size={11} />
            Reset all
          </button>
        </div>
        {notice && (
          <p
            role="status"
            className="border-b border-[var(--devlens-hairline)] bg-[var(--devlens-accent-soft)] px-4 py-2 text-[10px] text-[var(--devlens-accent)]"
          >
            {notice}
          </p>
        )}
      </section>

      {(['system', 'developer'] as const).map((category) => {
        const definitions = HOTKEY_DEFINITIONS.filter(
          (definition) => definition.category === category
        )
        return (
          <section
            key={category}
            className="rounded-lg border border-[var(--devlens-hairline)] bg-white/[0.018]"
          >
            <div className="border-b border-[var(--devlens-hairline)] px-4 py-3">
              <h3 className="text-[12px] font-medium text-ink-100">
                {CATEGORY_LABELS[category].title}
              </h3>
              <p className="mt-0.5 text-[10px] leading-4 text-ink-500">
                {CATEGORY_LABELS[category].detail}
              </p>
            </div>
            <div className="divide-y divide-[var(--devlens-hairline)]">
              {definitions.map((definition) => {
                const binding = bindings[definition.id]
                const recording = capturing === definition.id
                const isDefault = binding === DEFAULT_HOTKEY_BINDINGS[definition.id]
                return (
                  <div
                    key={definition.id}
                    data-testid="hotkey-row"
                    data-hotkey={definition.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-ink-100">{definition.label}</p>
                      <p className="mt-0.5 text-[10px] leading-4 text-ink-500">
                        {definition.detail}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Record shortcut for ${definition.label}`}
                        onClick={() => {
                          setCapturing((current) =>
                            current === definition.id ? null : definition.id
                          )
                          setNotice(null)
                        }}
                        className={[
                          'inline-flex h-8 min-w-[126px] items-center justify-center rounded-md border px-2.5 font-mono text-[10px] transition-colors',
                          recording
                            ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                            : 'border-[var(--devlens-hairline)] bg-black/15 text-ink-200 hover:border-[var(--devlens-accent-line)]'
                        ].join(' ')}
                      >
                        {recording ? 'Press shortcut…' : binding}
                      </button>
                      <button
                        type="button"
                        aria-label={`Reset ${definition.label} to default`}
                        disabled={isDefault}
                        onClick={() => {
                          onChange({
                            ...bindings,
                            [definition.id]: DEFAULT_HOTKEY_BINDINGS[definition.id]
                          })
                          setCapturing(null)
                          setNotice(`${definition.label} was reset to its default.`)
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-white/5 hover:text-ink-200 disabled:opacity-25"
                      >
                        {isDefault ? <Check size={11} /> : <RotateCcw size={11} />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
