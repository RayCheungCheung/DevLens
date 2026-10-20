import { useMemo, useState } from 'react'
import {
  GripVertical,
  Link2,
  ListFilter,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2
} from 'lucide-react'
import { engineMark } from '@shared/omnibox'
import {
  entryPrefix,
  type OmniboxEntry,
  type OmniboxEntryKind,
  type OmniboxSettings,
  type OmniboxSources
} from '@shared/omnibox-settings'
import { FaviconMark, MARK_BOX, PrefixMark } from '@renderer/components/PrefixIcons'
import { AddEngineModal } from '@renderer/components/AddEngineModal'
import { SelectMenu } from '@renderer/components/SelectMenu'

interface OmniboxSettingsContentProps {
  settings: OmniboxSettings
  onChange: (next: OmniboxSettings) => void
  favicons: Record<string, string | null>
}

const SOURCE_ROWS: { key: keyof OmniboxSources; label: string; detail: string }[] = [
  { key: 'history', label: 'Browsing history', detail: 'pages this profile has visited' },
  { key: 'bookmarks', label: 'Bookmarks', detail: 'saved pages, ranked above a pass-through' },
  { key: 'tabs', label: 'Open tabs', detail: 'the `%` switcher' },
  { key: 'actions', label: 'Prefix suggestions', detail: 'the `@` and `#` lists, plus commands' },
  { key: 'recentSearches', label: 'Recent searches', detail: 'what this session already opened' }
]

function EntryMark({
  entry,
  favicons
}: {
  entry: OmniboxEntry
  favicons: Record<string, string | null>
}) {
  return (
    <span className={[MARK_BOX, 'h-5 w-5'].join(' ')}>
      {entry.builtInEngine ? (
        <PrefixMark icon={engineMark(entry.builtInEngine) ?? 'custom'} size={16} />
      ) : (
        <FaviconMark label={entry.label} iconUrl={favicons[entry.id]} size={16} />
      )}
    </span>
  )
}

interface EntryRowProps {
  entry: OmniboxEntry
  index: number
  favicons: Record<string, string | null>
  isDefault?: boolean
  onDefault?: () => void
  onEdit: () => void
  onDelete: () => void
  draggingIndex: number
  dragOverIndex: number
  onDragStart: (index: number) => void
  onDragOver: (index: number) => void
  onDrop: (fromIndex: number, toIndex: number) => void
  onDragEnd: () => void
}

function EntryRow({
  entry,
  index,
  favicons,
  isDefault = false,
  onDefault,
  onEdit,
  onDelete,
  draggingIndex,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}: EntryRowProps) {
  const prefix = entryPrefix(entry.kind)
  const isDragging = index === draggingIndex
  const isDropTarget = index === dragOverIndex

  return (
    <li
      data-testid={`${entry.kind}-row-${entry.id}`}
      data-kind={entry.kind}
      className={[
        'flex items-center gap-2 py-2.5 transition-opacity',
        isDragging && 'opacity-40',
        isDropTarget && 'border-t-2 border-[var(--devlens-accent)]'
      ].filter(Boolean).join(' ')}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', `${entry.kind}:${entry.id}`)
        onDragStart(index)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        onDragOver(index)
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onDrop(draggingIndex, index)
      }}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${entry.label}`}
        className="shrink-0 rounded p-1 text-ink-500 hover:bg-white/[0.06] hover:text-ink-200 cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </button>

      <EntryMark entry={entry} favicons={favicons} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] text-ink-100">{entry.label}</span>
          <span
            data-testid={`${entry.kind}-keyword-${entry.id}`}
            className="shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px] text-ink-300"
          >
            {prefix}
            {entry.keyword}
          </span>
          {entry.builtInEngine && (
            <span className="shrink-0 font-mono text-[10px] text-ink-500">built-in</span>
          )}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-400" title={entry.template}>
          {entry.template}
        </span>
      </span>

      {onDefault && (
        <button
          type="button"
          data-testid={`engine-default-${entry.id}`}
          disabled={isDefault}
          onClick={onDefault}
          className={[
            'flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px]',
            isDefault
              ? 'border-[var(--devlens-accent-line)] text-[var(--devlens-accent)]'
              : 'border-[var(--devlens-hairline)] text-ink-300 hover:bg-white/[0.05]'
          ].join(' ')}
        >
          <Star size={10} />
          {isDefault ? 'Default' : 'Set default'}
        </button>
      )}

      <button
        type="button"
        aria-label={`Edit ${entry.label}`}
        data-testid={`${entry.kind}-edit-${entry.id}`}
        onClick={onEdit}
        className="shrink-0 rounded p-1.5 text-ink-400 hover:bg-white/[0.06] hover:text-ink-100"
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        aria-label={`Delete ${entry.label}`}
        data-testid={`${entry.kind}-delete-${entry.id}`}
        onClick={onDelete}
        className="shrink-0 rounded p-1.5 text-ink-400 hover:bg-white/[0.06] hover:text-rose-300"
      >
        <Trash2 size={13} />
      </button>
    </li>
  )
}

/** The Omnibox category's embedded control centre for the two prefix families. */
export function OmniboxSettingsContent({
  settings,
  onChange,
  favicons
}: OmniboxSettingsContentProps) {
  const [draggingIndex, setDraggingIndex] = useState(-1)
  const [dragOverIndex, setDragOverIndex] = useState(-1)
  const [modal, setModal] = useState<{
    open: boolean
    kind: OmniboxEntryKind
    entry: OmniboxEntry | null
  }>({ open: false, kind: 'engine', entry: null })

  const current =
    settings.engines.find((entry) => entry.id === settings.defaultEngine) ??
    settings.engines[0] ??
    null

  const patch = (next: Partial<OmniboxSettings>): void => onChange({ ...settings, ...next })

  const saveEntry = (entry: OmniboxEntry): void => {
    const key = entry.kind === 'engine' ? 'engines' : 'shortcuts'
    const list = settings[key]
    const exists = list.some((candidate) => candidate.id === entry.id)
    const nextList = exists
      ? list.map((candidate) => (candidate.id === entry.id ? entry : candidate))
      : [...list, entry]
    const next: OmniboxSettings = { ...settings, [key]: nextList }
    if (entry.kind === 'engine' && !next.engines.some((candidate) => candidate.id === next.defaultEngine)) {
      next.defaultEngine = entry.id
    }
    onChange(next)
    setModal({ open: false, kind: entry.kind, entry: null })
  }

  const removeEntry = (kind: OmniboxEntryKind, id: string): void => {
    const key = kind === 'engine' ? 'engines' : 'shortcuts'
    const nextList = settings[key].filter((entry) => entry.id !== id)
    const next: OmniboxSettings = { ...settings, [key]: nextList }
    if (kind === 'engine' && settings.defaultEngine === id) {
      next.defaultEngine = nextList[0]?.id ?? ''
    }
    onChange(next)
  }

  const handleDragStart = (_kind: OmniboxEntryKind, index: number): void => {
    setDraggingIndex(index)
    setDragOverIndex(-1)
  }

  const handleDragOver = (_kind: OmniboxEntryKind, index: number): void => {
    setDragOverIndex(index)
  }

  const handleDrop = (kind: OmniboxEntryKind, fromIndex: number, toIndex: number): void => {
    const key = kind === 'engine' ? 'engines' : 'shortcuts'
    const list = [...settings[key]]
    if (fromIndex === toIndex) {
      setDraggingIndex(-1)
      setDragOverIndex(-1)
      return
    }
    const [moved] = list.splice(fromIndex, 1)
    list.splice(toIndex, 0, moved)
    patch({ [key]: list })
    setDraggingIndex(-1)
    setDragOverIndex(-1)
  }

  const handleDragEnd = (): void => {
    setDraggingIndex(-1)
    setDragOverIndex(-1)
  }

  const engineHintCount = useMemo(
    () => settings.engines.filter((entry) => entry.kind === 'engine').length,
    [settings.engines]
  )

  return (
    <div data-testid="omnibox-settings" className="flex w-full flex-col gap-4">
      <p className="text-[11px] leading-5 text-ink-400">
        Search with <span className="font-mono text-ink-200">@</span>, jump directly with{' '}
        <span className="font-mono text-ink-200">#</span>. Both lists use the order shown here.
      </p>

      <section
        data-testid="settings-section-default"
        data-section="default"
        className="rounded-lg border border-[var(--devlens-hairline)] bg-white/[0.018] p-4"
      >
        <h2 className="flex items-center gap-2 text-[14px] text-ink-100">
          <Search size={13} className="text-[var(--devlens-accent)]" />
          Default Omnibox Engine
        </h2>
        <p className="mt-1 text-[12px] text-ink-400">
          Bare text uses this engine. A complete <span className="font-mono">@</span> or{' '}
          <span className="font-mono">#</span> prefix still wins.
        </p>

        <SelectMenu
          ariaLabel="Default search engine"
          testId="default-engine-trigger"
          listTestId="default-engine-list"
          optionTestIdPrefix="default-engine-option"
          value={current?.id ?? ''}
          onChange={(id) => patch({ defaultEngine: id })}
          disabled={!current}
          className="mt-3 w-[18rem]"
          menuWidth={300}
          sections={[
            {
              options: settings.engines.map((entry) => ({
                value: entry.id,
                id: entry.builtInEngine ?? entry.id,
                label: entry.label,
                description: `@${entry.keyword}`,
                icon: <EntryMark entry={entry} favicons={favicons} />
              }))
            }
          ]}
        />

        <div className="mt-4 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-[12px] text-ink-200">
            <input
              type="checkbox"
              data-testid="settings-show-search-terms"
              checked={settings.showSearchTerms}
              onChange={(event) => patch({ showSearchTerms: event.target.checked })}
              className="h-3.5 w-3.5 accent-[var(--devlens-accent)]"
            />
            Show search terms in the address bar on results pages
          </label>
          <label className="flex items-center gap-2 text-[12px] text-ink-200">
            <input
              type="checkbox"
              data-testid="settings-suggest-first"
              checked={settings.suggestFirst}
              onChange={(event) => patch({ suggestFirst: event.target.checked })}
              className="h-3.5 w-3.5 accent-[var(--devlens-accent)]"
            />
            Show search suggestions before browsing history
          </label>
        </div>
      </section>

      <section
        data-testid="settings-section-engines"
        data-section="engines"
        className="rounded-lg border border-[var(--devlens-hairline)] bg-white/[0.018] p-4"
      >
        <h2 className="flex items-center gap-2 text-[14px] text-ink-100">
          <Search size={13} className="text-[var(--devlens-accent)]" />
          Search Engines (<span className="font-mono">@</span>)
        </h2>
        <p className="mt-1 text-[12px] text-ink-400">
          Every row must contain <span className="font-mono text-ink-300">%s</span>. Type{' '}
          <span className="font-mono">@keyword query</span> to search.
        </p>
        <ul data-testid="engine-list" className="mt-3 flex flex-col divide-y divide-[var(--devlens-hairline)]">
          {settings.engines.map((entry, index) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              index={index}
              favicons={favicons}
              isDefault={entry.id === current?.id}
              onDefault={() => patch({ defaultEngine: entry.id })}
              onEdit={() => setModal({ open: true, kind: 'engine', entry })}
              onDelete={() => removeEntry('engine', entry.id)}
              draggingIndex={draggingIndex}
              dragOverIndex={dragOverIndex}
              onDragStart={(idx) => handleDragStart('engine', idx)}
              onDragOver={(idx) => handleDragOver('engine', idx)}
              onDrop={(from, to) => handleDrop('engine', from, to)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </ul>
        {engineHintCount === 0 && (
          <p data-testid="engine-empty" className="mt-3 text-[12px] text-ink-400">
            No search engines. Add one to make bare queries searchable.
          </p>
        )}
        <button
          type="button"
          data-testid="add-engine"
          onClick={() => setModal({ open: true, kind: 'engine', entry: null })}
          className="mt-4 flex items-center gap-1.5 rounded-md bg-[var(--devlens-accent)] px-3.5 py-2 text-[12px] text-ink-950 hover:brightness-110"
        >
          <Plus size={12} />
          Add Search Engine
        </button>
      </section>

      <section
        data-testid="settings-section-shortcuts"
        data-section="shortcuts"
        className="rounded-lg border border-[var(--devlens-hairline)] bg-white/[0.018] p-4"
      >
        <h2 className="flex items-center gap-2 text-[14px] text-ink-100">
          <Link2 size={13} className="text-[var(--devlens-accent)]" />
          Site Shortcuts (<span className="font-mono">#</span>)
        </h2>
        <p className="mt-1 text-[12px] text-ink-400">
          Direct addresses only - no <span className="font-mono text-ink-300">%s</span>. Type{' '}
          <span className="font-mono">#keyword</span> to jump straight to the site.
        </p>
        <ul data-testid="shortcut-list" className="mt-3 flex flex-col divide-y divide-[var(--devlens-hairline)]">
          {settings.shortcuts.map((entry, index) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              index={index}
              favicons={favicons}
              onEdit={() => setModal({ open: true, kind: 'shortcut', entry })}
              onDelete={() => removeEntry('shortcut', entry.id)}
              draggingIndex={draggingIndex}
              dragOverIndex={dragOverIndex}
              onDragStart={(idx) => handleDragStart('shortcut', idx)}
              onDragOver={(idx) => handleDragOver('shortcut', idx)}
              onDrop={(from, to) => handleDrop('shortcut', from, to)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </ul>
        {settings.shortcuts.length === 0 && (
          <p data-testid="shortcut-empty" className="mt-3 text-[12px] text-ink-400">
            No site shortcuts yet.
          </p>
        )}
        <button
          type="button"
          data-testid="add-shortcut"
          onClick={() => setModal({ open: true, kind: 'shortcut', entry: null })}
          className="mt-4 flex items-center gap-1.5 rounded-md bg-[var(--devlens-accent)] px-3.5 py-2 text-[12px] text-ink-950 hover:brightness-110"
        >
          <Plus size={12} />
          Add Site Shortcut
        </button>
      </section>

      <section
        data-testid="settings-section-suggestions"
        data-section="suggestions"
        className="rounded-lg border border-[var(--devlens-hairline)] bg-white/[0.018] p-4"
      >
        <h2 className="flex items-center gap-2 text-[14px] text-ink-100">
          <ListFilter size={13} className="text-[var(--devlens-accent)]" />
          Address Bar Suggestions &amp; Discovery
        </h2>
        <p className="mt-1 text-[12px] text-ink-400">
          What the dropdown may offer. Everything here is local.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {SOURCE_ROWS.map((row) => (
            <label key={row.key} className="flex items-start gap-2 text-[12px] text-ink-200">
              <input
                type="checkbox"
                data-testid={`suggest-source-${row.key}`}
                checked={settings.sources[row.key]}
                onChange={(event) =>
                  patch({ sources: { ...settings.sources, [row.key]: event.target.checked } })
                }
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--devlens-accent)]"
              />
              <span className="min-w-0">
                <span className="block text-ink-200">{row.label}</span>
                <span className="block text-[11px] text-ink-400">{row.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {modal.open && (
        <AddEngineModal
          kind={modal.kind}
          entry={modal.entry}
          onSave={saveEntry}
          onClose={() => setModal({ open: false, kind: modal.kind, entry: null })}
        />
      )}
    </div>
  )
}
