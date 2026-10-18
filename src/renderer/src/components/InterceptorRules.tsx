import { useState } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import type { InterceptorRule, InterceptorRuleKind } from '@shared/types'

interface InterceptorRulesProps {
  rules: InterceptorRule[]
  onAdd: (rule: Omit<InterceptorRule, 'id' | 'hits'>) => void
  onUpdate: (id: string, patch: Partial<InterceptorRule>) => void
  onRemove: (id: string) => void
  onToggle: (id: string) => void
}

const KINDS: { id: InterceptorRuleKind; label: string }[] = [
  { id: 'block', label: 'Block' },
  { id: 'set-header', label: 'Set header' },
  { id: 'remove-header', label: 'Remove header' },
  { id: 'redirect', label: 'Redirect' },
  { id: 'pause', label: 'Hold' }
]

const KIND_TONES: Record<InterceptorRuleKind, string> = {
  block: 'text-rose-300',
  'set-header': 'text-sky-300',
  'remove-header': 'text-amber-300',
  redirect: 'text-violet-300',
  pause: 'text-teal-300'
}

/**
 * Rule editor.
 *
 * Patterns match the full request URL: a pattern containing an asterisk is a glob that
 * may match anywhere in the URL, anything else is a plain substring. So "/api/" catches
 * every endpoint below that path and "api.example.com" catches that host wherever it
 * appears, which is what an operator expects without writing regular expressions.
 */
export function InterceptorRules({
  rules,
  onAdd,
  onUpdate,
  onRemove,
  onToggle
}: InterceptorRulesProps) {
  const [open, setOpen] = useState(rules.length > 0)
  const [draft, setDraft] = useState<Omit<InterceptorRule, 'id' | 'hits'>>({
    kind: 'block',
    pattern: '',
    enabled: true,
    header: '',
    value: '',
    target: ''
  })

  const needsHeader = draft.kind === 'set-header' || draft.kind === 'remove-header'
  const canAdd = draft.pattern.trim().length > 0 && (!needsHeader || Boolean(draft.header?.trim()))

  return (
    <div className="shrink-0 border-b border-white/5">
      <button
        type="button"
        aria-label="Toggle rules"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wide text-neutral-500 transition-colors hover:text-neutral-300"
      >
        <ChevronDown size={11} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
        Rules
        <span className="font-mono text-neutral-600">{rules.length}</span>
      </button>

      {open && (
        <div className="space-y-1.5 px-3 pb-2">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded border border-white/10 bg-neutral-950/50 px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-pressed={rule.enabled}
                  onClick={() => onToggle(rule.id)}
                  title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                  className={[
                    'h-3.5 w-3.5 shrink-0 rounded-sm border transition-colors',
                    rule.enabled ? 'border-teal-400/60 bg-teal-400/60' : 'border-white/20'
                  ].join(' ')}
                />
                <span className={['shrink-0 font-mono text-[10px]', KIND_TONES[rule.kind]].join(' ')}>
                  {rule.kind}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-neutral-300">
                  {rule.pattern}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-neutral-600">{rule.hits}</span>
                <button
                  type="button"
                  title="Delete rule"
                  aria-label="Delete rule"
                  onClick={() => onRemove(rule.id)}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <Trash2 size={10} />
                </button>
              </div>

              {rule.kind === 'set-header' && (
                <p className="mt-1 truncate font-mono text-[10px] text-neutral-500">
                  {rule.header}: {rule.value}
                </p>
              )}
              {rule.kind === 'remove-header' && (
                <p className="mt-1 truncate font-mono text-[10px] text-neutral-500">remove {rule.header}</p>
              )}
              {rule.kind === 'redirect' && (
                <div className="mt-1 flex items-center gap-1">
                  <input
                    value={rule.target ?? ''}
                    spellCheck={false}
                    onChange={(event) => onUpdate(rule.id, { target: event.target.value })}
                    placeholder="https://target.example/path"
                    className="min-w-0 flex-1 rounded border border-white/10 bg-neutral-950/70 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300 outline-none focus:border-teal-400/50"
                  />
                </div>
              )}
            </div>
          ))}

          <div className="space-y-1 rounded border border-dashed border-white/15 p-2">
            <div className="flex items-center gap-1">
              <select
                value={draft.kind}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    kind: event.target.value as InterceptorRuleKind,
                    // Fields belong to a kind: never carry a header into a redirect draft.
                    header: '',
                    value: '',
                    target: ''
                  }))
                }
                aria-label="Rule kind"
                className="h-6 shrink-0 rounded border border-white/10 bg-neutral-950/70 px-1 font-mono text-[10px] text-neutral-300 outline-none"
              >
                {KINDS.map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    {kind.label}
                  </option>
                ))}
              </select>
              <input
                value={draft.pattern}
                spellCheck={false}
                aria-label="Rule pattern"
                onChange={(event) => setDraft((current) => ({ ...current, pattern: event.target.value }))}
                placeholder="*://*/api/*"
                className="h-6 min-w-0 flex-1 rounded border border-white/10 bg-neutral-950/70 px-1.5 font-mono text-[10px] text-neutral-200 outline-none focus:border-teal-400/50"
              />
            </div>

            {needsHeader && (
              <div className="flex items-center gap-1">
                <input
                  value={draft.header ?? ''}
                  spellCheck={false}
                  aria-label="Rule header"
                  onChange={(event) => setDraft((current) => ({ ...current, header: event.target.value }))}
                  placeholder="x-debug"
                  className="h-6 w-[38%] shrink-0 rounded border border-white/10 bg-neutral-950/70 px-1.5 font-mono text-[10px] text-neutral-200 outline-none focus:border-teal-400/50"
                />
                {draft.kind === 'set-header' && (
                  <input
                    value={draft.value ?? ''}
                    spellCheck={false}
                    aria-label="Rule value"
                    onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
                    placeholder="value"
                    className="h-6 min-w-0 flex-1 rounded border border-white/10 bg-neutral-950/70 px-1.5 font-mono text-[10px] text-neutral-200 outline-none focus:border-teal-400/50"
                  />
                )}
              </div>
            )}

            {draft.kind === 'redirect' && (
              <input
                value={draft.target ?? ''}
                spellCheck={false}
                onChange={(event) => setDraft((current) => ({ ...current, target: event.target.value }))}
                placeholder="https://target.example/path"
                className="h-6 w-full rounded border border-white/10 bg-neutral-950/70 px-1.5 font-mono text-[10px] text-neutral-200 outline-none focus:border-teal-400/50"
              />
            )}

            <button
              type="button"
              disabled={!canAdd}
              onClick={() => {
                onAdd({ ...draft, pattern: draft.pattern.trim() })
                setDraft((current) => ({
                  ...current,
                  pattern: '',
                  header: '',
                  value: '',
                  target: ''
                }))
              }}
              className="inline-flex items-center gap-1 rounded border border-teal-400/40 bg-teal-400/10 px-2 py-1 text-[10px] text-teal-100 transition-colors hover:bg-teal-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-neutral-600"
            >
              <Plus size={10} />
              Add rule
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
