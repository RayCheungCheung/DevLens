import { Plus, X } from 'lucide-react'
import type { HeaderPair } from '@shared/types'

interface HeaderPairsEditorProps {
  headers: HeaderPair[]
  onChange: (headers: HeaderPair[]) => void
  /** Read-only name column (used when listing captured request headers). */
  readOnly?: boolean
  emptyLabel?: string
}

/** Small name/value list editor shared by the paused queue and the repeater. */
export function HeaderPairsEditor({
  headers,
  onChange,
  readOnly = false,
  emptyLabel = 'No headers'
}: HeaderPairsEditorProps) {
  const update = (index: number, patch: Partial<HeaderPair>): void => {
    onChange(headers.map((pair, position) => (position === index ? { ...pair, ...patch } : pair)))
  }

  return (
    <div className="space-y-1">
      {headers.length === 0 && <p className="font-mono text-[10px] text-neutral-600">{emptyLabel}</p>}

      {headers.map((pair, index) => (
        <div key={`${pair.name}-${index}`} className="flex items-center gap-1">
          <input
            value={pair.name}
            readOnly={readOnly}
            spellCheck={false}
            aria-label="Header name"
            onChange={(event) => update(index, { name: event.target.value })}
            className={[
              'w-[38%] shrink-0 rounded border border-white/10 bg-neutral-950/70 px-1.5 py-1 font-mono text-[10px] text-neutral-300 outline-none focus:border-teal-400/50',
              readOnly ? 'text-neutral-500' : ''
            ].join(' ')}
          />
          <input
            value={pair.value}
            readOnly={readOnly}
            spellCheck={false}
            aria-label="Header value"
            onChange={(event) => update(index, { value: event.target.value })}
            className="min-w-0 flex-1 rounded border border-white/10 bg-neutral-950/70 px-1.5 py-1 font-mono text-[10px] text-neutral-200 outline-none focus:border-teal-400/50"
          />
          {!readOnly && (
            <button
              type="button"
              title={`Remove ${pair.name || 'header'}`}
              aria-label={`Remove ${pair.name || 'header'}`}
              onClick={() => onChange(headers.filter((_, position) => position !== index))}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
            >
              <X size={11} />
            </button>
          )}
        </div>
      ))}

      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...headers, { name: '', value: '' }])}
          className="inline-flex items-center gap-1 rounded border border-dashed border-white/15 px-1.5 py-1 text-[10px] text-neutral-400 transition-colors hover:border-teal-400/40 hover:text-teal-200"
        >
          <Plus size={10} />
          Add header
        </button>
      )}
    </div>
  )
}
