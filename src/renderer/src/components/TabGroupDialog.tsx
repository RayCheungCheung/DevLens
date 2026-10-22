import { useEffect, useRef, useState } from 'react'
import { FolderPlus, X } from 'lucide-react'

const GROUP_COLORS = [
  '#2dd4bf',
  '#7dd3fc',
  '#a78bfa',
  '#f472b6',
  '#fb7185',
  '#fbbf24',
  '#a3e635'
] as const

export function TabGroupDialog({
  onSave,
  onClose
}: {
  onSave: (name: string, color: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(GROUP_COLORS[0])
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  return (
    <div
      className="nova-no-drag fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Create tab group"
        data-testid="tab-group-dialog"
        className="w-full max-w-[360px] rounded-xl border border-[var(--devlens-hairline-strong)] bg-[color-mix(in_srgb,var(--color-ink-950)_97%,transparent)] p-4 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) return
          onSave(name, color)
          onClose()
        }}
      >
        <header className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]">
            <FolderPlus size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[12px] font-medium text-ink-100">New tab group</h2>
            <p className="text-[9px] text-ink-500">Name it and choose a group color.</p>
          </div>
          <button
            type="button"
            aria-label="Close tab group dialog"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-ink-500 hover:bg-white/5 hover:text-ink-100"
          >
            <X size={13} />
          </button>
        </header>

        <input
          ref={inputRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          placeholder="e.g. Research"
          aria-label="Tab group name"
          data-testid="tab-group-name"
          className="mt-4 h-9 w-full rounded-md border border-[var(--devlens-hairline)] bg-black/20 px-3 text-[11px] text-ink-100 outline-none placeholder:text-ink-600 focus:border-[var(--devlens-accent-line)]"
        />

        <div className="mt-3 flex items-center gap-2" aria-label="Tab group color">
          {GROUP_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Use ${swatch} for this group`}
              aria-pressed={color === swatch}
              data-color={swatch}
              onClick={() => setColor(swatch)}
              className={[
                'h-6 w-6 rounded-full border-2 transition-transform',
                color === swatch
                  ? 'scale-110 border-white'
                  : 'border-transparent hover:scale-105'
              ].join(' ')}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-[var(--devlens-hairline)] px-3 text-[10px] text-ink-400 hover:text-ink-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="h-8 rounded-md border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-3 text-[10px] text-[var(--devlens-accent)] hover:bg-[var(--devlens-accent)] hover:text-ink-950 disabled:opacity-40"
          >
            Create group
          </button>
        </div>
      </form>
    </div>
  )
}
