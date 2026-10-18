import { useMemo, useState } from 'react'
import { ChevronDown, Globe, Plus, Search, X } from 'lucide-react'
import {
  entryFromDraft,
  entryPrefix,
  type OmniboxEntry,
  type OmniboxEntryKind
} from '@shared/omnibox-settings'

interface AddEngineModalProps {
  /** The family being created; editing keeps the row's existing kind. */
  kind: OmniboxEntryKind
  /** The row being edited, when the modal was opened from "Edit". */
  entry?: OmniboxEntry | null
  onSave: (entry: OmniboxEntry) => void
  onClose: () => void
}

/**
 * Add (or edit) one engine or shortcut.
 *
 * The form is Firefox's, because that is the form the model came from: a name, a URL, and an
 * optional keyword. What it adds is the sentence under the URL field, which says out loud which
 * of the two things the operator just built - a `%s` makes the row search, its absence makes it
 * a place to go - because that difference decides what typing the keyword with a query after it
 * does, and the operator should not have to find that out by trying it.
 */
export function AddEngineModal({ kind, entry, onSave, onClose }: AddEngineModalProps) {
  const [name, setName] = useState(entry?.label ?? '')
  const [template, setTemplate] = useState(entry?.template ?? '')
  const [keyword, setKeyword] = useState(entry?.keyword ?? '')
  const [postData, setPostData] = useState(entry?.postData ?? '')
  const [suggestionsUrl, setSuggestionsUrl] = useState(entry?.suggestionsUrl ?? '')
  const [advanced, setAdvanced] = useState(Boolean(entry?.postData || entry?.suggestionsUrl))

  const draft = useMemo(
    () => entryFromDraft({ label: name, keyword, template, postData, suggestionsUrl }, kind),
    [kind, name, keyword, template, postData, suggestionsUrl]
  )
  const canSave = Boolean(draft) && (draft?.label.length ?? 0) > 0

  const submit = (): void => {
    if (!draft) return
    /* Keep the id of the row being edited: "set as default" refers to it. */
    onSave(
      entry
        ? {
            ...draft,
            id: entry.id,
            ...(entry.builtInEngine ? { builtInEngine: entry.builtInEngine } : {})
          }
        : draft
    )
  }

  return (
    <div
      data-testid="add-engine-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`${entry ? 'Edit' : 'Add'} ${kind === 'engine' ? 'search engine' : 'site shortcut'}`}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-[var(--devlens-hairline)] bg-[color-mix(in_srgb,var(--color-ink-950)_98%,transparent)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--devlens-hairline)] px-4 py-2.5">
          <h3 className="flex items-center gap-2 text-[13px] text-ink-100">
            {entry ? <Search size={13} className="text-[var(--devlens-accent)]" /> : <Plus size={13} className="text-[var(--devlens-accent)]" />}
            {entry ? 'Edit' : 'Add'} {kind === 'engine' ? 'search engine' : 'site shortcut'}
          </h3>
          <button
            type="button"
            aria-label="Close"
            data-testid="engine-cancel-icon"
            onClick={onClose}
            className="rounded p-1 text-ink-500 hover:bg-white/[0.06] hover:text-ink-200"
          >
            <X size={13} />
          </button>
        </header>

        <div className="flex flex-col gap-3 px-4 py-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] tracking-wide text-ink-300 uppercase">Name</span>
            <input
              autoFocus
              data-testid="engine-name"
              value={name}
              placeholder="YouTube"
              onChange={(event) => setName(event.target.value)}
              className="h-9 rounded-md border border-[var(--devlens-hairline)] bg-black/40 px-2.5 font-mono text-[12px] text-ink-100 outline-none focus:border-[var(--devlens-accent-line)]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] tracking-wide text-ink-300 uppercase">
              {kind === 'engine' ? 'Search URL with %s' : 'Target URL'}
            </span>
            <input
              data-testid="engine-template"
              value={template}
              placeholder={
                kind === 'engine'
                  ? 'https://www.google.com/search?q=%s'
                  : 'https://www.youtube.com/'
              }
              onChange={(event) => setTemplate(event.target.value)}
              className="h-9 rounded-md border border-[var(--devlens-hairline)] bg-black/40 px-2.5 font-mono text-[12px] text-ink-100 outline-none focus:border-[var(--devlens-accent-line)]"
            />
            <span
              data-testid="engine-kind"
              data-kind={kind}
              className="flex items-center gap-1.5 text-[11px] leading-4 text-ink-400"
            >
              {kind === 'engine' ? <Search size={10} /> : <Globe size={10} />}
              {kind === 'engine'
                ? 'Required: %s marks where the query goes.'
                : 'Direct address only. A %s placeholder is not allowed.'}
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] tracking-wide text-ink-300 uppercase">
              Trigger ({kind === 'engine' ? '@keyword' : '#keyword'})
            </span>
            <span className="flex h-9 w-40 items-center overflow-hidden rounded-md border border-[var(--devlens-hairline)] bg-black/40 focus-within:border-[var(--devlens-accent-line)]">
              <span className="border-r border-[var(--devlens-hairline)] px-2.5 font-mono text-[12px] text-ink-400">
                {entryPrefix(kind)}
              </span>
              <input
                data-testid="engine-keyword"
                value={keyword}
                placeholder={kind === 'engine' ? 'g' : 'yt'}
                onChange={(event) => setKeyword(event.target.value)}
                className="min-w-0 flex-1 bg-transparent px-2.5 font-mono text-[12px] text-ink-100 outline-none"
              />
            </span>
          </label>

          {kind === 'engine' && (
            <button
              type="button"
              data-testid="engine-advanced-toggle"
              aria-expanded={advanced}
              onClick={() => setAdvanced((value) => !value)}
              className="flex w-fit items-center gap-1 text-[11px] text-ink-300 hover:text-ink-100"
            >
              <ChevronDown size={11} className={advanced ? 'rotate-180' : ''} />
              Advanced
            </button>
          )}

          {advanced && kind === 'engine' && (
            <div className="flex flex-col gap-3 rounded-md border border-[var(--devlens-hairline)] px-3 py-2.5">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] tracking-wide text-ink-300 uppercase">
                  POST data (optional)
                </span>
                <input
                  data-testid="engine-post-data"
                  value={postData}
                  placeholder="query=%s&amp;source=devlens"
                  onChange={(event) => setPostData(event.target.value)}
                  className="h-9 rounded-md border border-[var(--devlens-hairline)] bg-black/40 px-2.5 font-mono text-[12px] text-ink-100 outline-none focus:border-[var(--devlens-accent-line)]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] tracking-wide text-ink-300 uppercase">
                  Suggestions URL (optional)
                </span>
                <input
                  data-testid="engine-suggestions"
                  value={suggestionsUrl}
                  placeholder="https://suggestqueries.google.com/complete/search?q=%s"
                  onChange={(event) => setSuggestionsUrl(event.target.value)}
                  className="h-9 rounded-md border border-[var(--devlens-hairline)] bg-black/40 px-2.5 font-mono text-[12px] text-ink-100 outline-none focus:border-[var(--devlens-accent-line)]"
                />
              </label>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[var(--devlens-hairline)] px-4 py-2.5">
          <button
            type="button"
            data-testid="engine-cancel"
            onClick={onClose}
            className="rounded-md border border-[var(--devlens-hairline)] px-3.5 py-2 text-[12px] text-ink-200 hover:bg-white/[0.05]"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="engine-save"
            disabled={!canSave}
            onClick={submit}
            className={[
              'rounded-md px-3.5 py-2 text-[12px]',
              canSave
                ? 'bg-[var(--devlens-accent)] text-ink-950 hover:brightness-110'
                : 'cursor-not-allowed bg-white/[0.06] text-ink-500'
            ].join(' ')}
          >
            {entry ? 'Save changes' : 'Add'}
          </button>
        </footer>
      </div>
    </div>
  )
}
