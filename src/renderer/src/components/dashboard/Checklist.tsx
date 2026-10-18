import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ListChecks, Plus, Trash2 } from 'lucide-react'
import { Widget, WidgetAction } from '@renderer/components/dashboard/Widget'

interface Item {
  id: string
  text: string
  done: boolean
}

interface ChecklistProps {
  /**
   * Which profile's list this is.
   *
   * The shell's storage is one store for every profile - the per-profile isolation lives in the
   * webview partitions - so the key carries the identity. Without it, a task written while using
   * "Work" would be waiting in "Personal".
   */
  profileId: string
}

const LIMIT = 40

function keyFor(profileId: string): string {
  return `devlens.checklist.${profileId || 'default'}`
}

function load(profileId: string): Item[] {
  try {
    const raw = window.localStorage.getItem(keyFor(profileId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as Item[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item.text === 'string')
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : `${Math.random().toString(36).slice(2, 9)}`,
        text: item.text.slice(0, 200),
        done: item.done === true
      }))
      .slice(0, LIMIT)
  } catch {
    // A corrupt or unavailable store is an empty list, never a broken dashboard.
    return []
  }
}

function save(profileId: string, items: Item[]): void {
  try {
    window.localStorage.setItem(keyFor(profileId), JSON.stringify(items))
  } catch {
    /* private mode or a full store: the list still works for this session */
  }
}

/**
 * Daily checklist.
 *
 * It is deliberately the smallest thing that is still honest: a text list with a tick, stored
 * locally under the active profile's key, written back on every change, and never sent anywhere.
 */
export function Checklist({ profileId }: ChecklistProps) {
  const [items, setItems] = useState<Item[]>([])
  const [draft, setDraft] = useState('')
  /** Which profile the in-memory list belongs to; a switch forces a re-read. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    if (loadedFor === profileId) return
    setItems(load(profileId))
    setLoadedFor(profileId)
  }, [loadedFor, profileId])

  useEffect(() => {
    if (loadedFor !== profileId) return
    save(profileId, items)
  }, [items, loadedFor, profileId])

  const done = useMemo(() => items.filter((item) => item.done).length, [items])

  const add = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    setItems((current) => [
      { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, text: text.slice(0, 200), done: false },
      ...current
    ].slice(0, LIMIT))
    setDraft('')
  }, [draft])

  return (
    <Widget
      icon={ListChecks}
      title="Checklist"
      note={items.length === 0 ? 'nothing on the list yet' : `${done} of ${items.length} done`}
      action={
        done > 0 ? (
          <WidgetAction
            label="Clear done items"
            onClick={() => setItems((current) => current.filter((item) => !item.done))}
          >
            <Trash2 size={11} />
          </WidgetAction>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <input
            value={draft}
            spellCheck={false}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter adds and keeps the field, so a list can be typed in one go.
              if (event.key !== 'Enter') return
              event.preventDefault()
              add()
            }}
            placeholder="Add a task"
            aria-label="New checklist item"
            data-testid="checklist-input"
            className="h-7 min-w-0 flex-1 rounded border border-[var(--devlens-hairline)] bg-ink-950/70 px-2 text-[11px] text-ink-100 outline-none placeholder:text-ink-600 focus:border-[var(--devlens-accent-line)]"
          />
          <button
            type="button"
            aria-label="Add checklist item"
            data-testid="checklist-add"
            onClick={add}
            disabled={!draft.trim()}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--devlens-hairline)] text-ink-400 transition-colors hover:border-[var(--devlens-accent-line)] hover:bg-[var(--devlens-accent-soft)] hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={12} />
          </button>
        </div>

        <ul data-testid="checklist" className="flex max-h-40 flex-col divide-y divide-[var(--devlens-hairline)] overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} data-testid="checklist-item" className="flex items-center gap-2 py-1">
              <button
                type="button"
                role="checkbox"
                aria-checked={item.done}
                aria-label={item.done ? `Uncheck ${item.text}` : `Check ${item.text}`}
                data-testid="checklist-toggle"
                onClick={() =>
                  setItems((current) =>
                    current.map((entry) =>
                      entry.id === item.id ? { ...entry, done: !entry.done } : entry
                    )
                  )
                }
                className={[
                  'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                  item.done
                    ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                    : 'border-[var(--devlens-hairline)] text-transparent hover:border-[var(--devlens-accent-line)]'
                ].join(' ')}
              >
                <Check size={10} />
              </button>
              <span
                className={[
                  'min-w-0 flex-1 truncate text-[11px]',
                  item.done ? 'text-ink-600 line-through' : 'text-ink-300'
                ].join(' ')}
                title={item.text}
              >
                {item.text}
              </span>
              <button
                type="button"
                aria-label={`Remove ${item.text}`}
                data-testid="checklist-remove"
                onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-ink-600 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 size={9} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Widget>
  )
}
