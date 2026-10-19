import { useEffect, useState } from 'react'
import { Check, Code2, Copy, Plus, Trash2 } from 'lucide-react'
import { Widget } from '@renderer/components/dashboard/Widget'

interface Snippet {
  id: string
  text: string
}

const STARTERS: Snippet[] = [
  { id: 'snippet-dev', text: 'npm run dev' },
  { id: 'snippet-status', text: 'git status --short' },
  { id: 'snippet-test', text: 'npm test' }
]

function keyFor(profileId: string): string {
  return `devlens.snippets.${profileId || 'default'}`
}

function load(profileId: string): Snippet[] {
  try {
    const raw = window.localStorage.getItem(keyFor(profileId))
    if (!raw) return STARTERS
    const parsed = JSON.parse(raw) as Snippet[]
    if (!Array.isArray(parsed)) return STARTERS
    return parsed
      .filter((entry) => entry && typeof entry.text === 'string')
      .slice(0, 30)
      .map((entry) => ({
        id: typeof entry.id === 'string' ? entry.id : `${Date.now()}-${Math.random()}`,
        text: entry.text.slice(0, 240)
      }))
  } catch {
    return STARTERS
  }
}

/** A local copy shelf for the commands a developer repeats during the day. */
export function QuickSnippets({ profileId }: { profileId: string }) {
  const [items, setItems] = useState<Snippet[]>(() => load(profileId))
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    setItems(load(profileId))
  }, [profileId])

  useEffect(() => {
    try {
      window.localStorage.setItem(keyFor(profileId), JSON.stringify(items))
    } catch {
      /* the snippet shelf still works for this session */
    }
  }, [items, profileId])

  const add = (): void => {
    const text = draft.trim()
    if (!text) return
    setItems((current) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: text.slice(0, 240) },
      ...current
    ].slice(0, 30))
    setDraft('')
  }

  const copy = (item: Snippet): void => {
    void window.devlens.clipboardWrite(item.text).then((ok) => {
      if (!ok) return
      setCopied(item.id)
      window.setTimeout(() => setCopied((value) => (value === item.id ? null : value)), 1200)
    })
  }

  return (
    <Widget icon={Code2} title="Quick snippets" note={`${items.length} local command${items.length === 1 ? '' : 's'}`}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
            placeholder="Add a command"
            aria-label="New quick snippet"
            data-testid="snippet-input"
            className="h-7 min-w-0 flex-1 rounded border border-[var(--devlens-hairline)] bg-ink-950/70 px-2 font-mono text-[10px] text-ink-100 outline-none placeholder:text-ink-600 focus:border-[var(--devlens-accent-line)]"
          />
          <button
            type="button"
            aria-label="Add quick snippet"
            onClick={add}
            disabled={!draft.trim()}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--devlens-hairline)] text-ink-400 hover:border-[var(--devlens-accent-line)] hover:bg-[var(--devlens-accent-soft)] hover:text-ink-100 disabled:opacity-40"
          >
            <Plus size={12} />
          </button>
        </div>
        <ul className="flex max-h-40 flex-col divide-y divide-[var(--devlens-hairline)] overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-1.5 py-1">
              <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-300" title={item.text}>
                {item.text}
              </code>
              <button
                type="button"
                aria-label={`Copy ${item.text}`}
                onClick={() => copy(item)}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-500 hover:bg-white/5 hover:text-ink-100"
              >
                {copied === item.id ? <Check size={11} /> : <Copy size={11} />}
              </button>
              <button
                type="button"
                aria-label={`Remove ${item.text}`}
                onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-600 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Trash2 size={10} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Widget>
  )
}
