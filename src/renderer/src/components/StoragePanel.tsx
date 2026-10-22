import { useMemo, useState } from 'react'
import { Cookie, Database, HardDrive, Loader2, Pencil, RefreshCw, Save, Trash2 } from 'lucide-react'
import type { CookieRecord } from '@shared/types'

/** Re-exported so the shell can import the record and the panel from one place. */
export type { CookieRecord }

export interface StorageArea {
  /** `localStorage` or `sessionStorage`. */
  id: 'local' | 'session'
  entries: { key: string; value: string }[]
}

export interface CacheArea {
  name: string
  entries: string[]
}

interface StoragePanelProps {
  /** The page the panel is inspecting; empty when no page is loaded. */
  url: string
  cookies: CookieRecord[]
  storage: StorageArea[]
  caches: CacheArea[]
  busy: boolean
  error: string | null
  onRefresh: () => void
  onRemoveCookie: (name: string) => void
  onRemoveEntry: (area: StorageArea['id'], key: string) => void
  onSetEntry: (area: StorageArea['id'], key: string, value: string) => void
  onRemoveCache: (name: string) => void
  onClearCache: () => void
  onClearSite: () => void
}

/**
 * Cookies and site storage.
 *
 * Two halves, because they live in two places: cookies belong to the session (the main process
 * reads them), while localStorage and sessionStorage belong to the loaded document (the guest
 * reads them). One refresh button drives both, so there is a single "as of now" for the whole
 * panel rather than two that can disagree.
 */
export function StoragePanel({
  url,
  cookies,
  storage,
  caches,
  busy,
  error,
  onRefresh,
  onRemoveCookie,
  onRemoveEntry,
  onSetEntry,
  onRemoveCache,
  onClearCache,
  onClearSite
}: StoragePanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [draft, setDraft] = useState<{
    area: StorageArea['id']
    key: string
    value: string
  }>({ area: 'local', key: '', value: '' })
  const origin = useMemo(() => {
    try {
      return new URL(url).origin
    } catch {
      return ''
    }
  }, [url])

  const total =
    cookies.length +
    storage.reduce((count, area) => count + area.entries.length, 0) +
    caches.reduce((count, cache) => count + cache.entries.length, 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="storage-panel">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--devlens-hairline)] px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-500" title={origin}>
          {origin || 'no page loaded'}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-ink-600">{total} entr{total === 1 ? 'y' : 'ies'}</span>
        <button
          type="button"
          aria-label="Refresh cookies and storage"
          onClick={onRefresh}
          disabled={busy || !origin}
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded border border-[var(--devlens-hairline)] px-2 text-[10px] text-ink-400 transition-colors hover:border-[var(--devlens-accent-line)] hover:text-ink-100 disabled:opacity-40"
        >
          {busy ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
          refresh
        </button>
      </div>

      {error && (
        <p className="shrink-0 border-b border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-[10px] text-rose-200">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="border-b border-[var(--devlens-hairline)] py-1">
          <h3 className="flex items-center gap-1.5 px-3 py-1 text-[11px] text-ink-200">
            <Cookie size={12} className="text-[var(--devlens-accent)]" />
            Cookies
            <span className="font-mono text-[9px] text-ink-600">{cookies.length}</span>
          </h3>
          {cookies.length === 0 ? (
            <p className="px-3 py-2 font-mono text-[10px] text-ink-600">
              {origin ? 'no cookies for this origin' : 'nothing to inspect'}
            </p>
          ) : (
            cookies.map((cookie) => {
              const key = `cookie:${cookie.domain}:${cookie.path}:${cookie.name}`
              const open = expanded[key] ?? false
              return (
                <div key={key} data-testid="cookie-row" data-name={cookie.name} className="group px-3">
                  <div className="flex min-w-0 items-center gap-2 py-1">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setExpanded((current) => ({ ...current, [key]: !open }))}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-200">
                        {cookie.name}
                      </span>
                      <span className="shrink-0 font-mono text-[9px] text-ink-600">
                        {cookie.session ? 'session' : 'persistent'}
                      </span>
                      {cookie.secure && <span className="shrink-0 font-mono text-[9px] text-teal-300">https</span>}
                      {cookie.httpOnly && <span className="shrink-0 font-mono text-[9px] text-violet-300">httpOnly</span>}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete the ${cookie.name} cookie`}
                      onClick={() => onRemoveCookie(cookie.name)}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-600 opacity-0 transition-colors group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                  {open && (
                    <dl className="mb-1.5 rounded border border-[var(--devlens-hairline)] bg-ink-950/50 px-2 py-1.5 font-mono text-[10px] text-ink-400">
                      <div className="truncate">
                        <dt className="inline text-ink-600">value </dt>
                        <dd className="inline break-all text-ink-300">{cookie.value || '(empty)'}</dd>
                      </div>
                      <div className="truncate">
                        <dt className="inline text-ink-600">domain </dt>
                        <dd className="inline">{cookie.domain}{cookie.path}</dd>
                      </div>
                      <div className="truncate">
                        <dt className="inline text-ink-600">sameSite </dt>
                        <dd className="inline">{cookie.sameSite}</dd>
                        <dt className="ml-2 inline text-ink-600">expires </dt>
                        <dd className="inline">
                          {cookie.expires ? new Date(cookie.expires * 1000).toLocaleString() : 'when the tab closes'}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>
              )
            })
          )}
        </section>

        {storage.map((area) => (
          <section key={area.id} className="border-b border-[var(--devlens-hairline)] py-1">
            <h3 className="flex items-center gap-1.5 px-3 py-1 text-[11px] text-ink-200">
              <Database size={12} className="text-[var(--devlens-accent)]" />
              {area.id === 'local' ? 'localStorage' : 'sessionStorage'}
              <span className="font-mono text-[9px] text-ink-600">{area.entries.length}</span>
            </h3>
            {area.entries.length === 0 ? (
              <p className="px-3 py-2 font-mono text-[10px] text-ink-600">empty</p>
            ) : (
              area.entries.map((entry) => (
                <div
                  key={`${area.id}:${entry.key}`}
                  data-testid="storage-row"
                  data-area={area.id}
                  data-key={entry.key}
                  className="group flex min-w-0 items-center gap-2 px-3 py-1"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-200" title={entry.value}>
                    {entry.key}
                  </span>
                  <span className="max-w-[45%] shrink-0 truncate font-mono text-[9px] text-ink-600" title={entry.value}>
                    {entry.value}
                  </span>
                  <button
                    type="button"
                    aria-label={`Edit the ${entry.key} key`}
                    onClick={() =>
                      setDraft({ area: area.id, key: entry.key, value: entry.value })
                    }
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-600 opacity-0 transition-colors group-hover:opacity-100 hover:bg-white/5 hover:text-ink-200"
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete the ${entry.key} key`}
                    onClick={() => onRemoveEntry(area.id, entry.key)}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-600 opacity-0 transition-colors group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))
            )}
          </section>
        ))}

        <section className="border-b border-[var(--devlens-hairline)] py-1">
          <h3 className="flex items-center gap-1.5 px-3 py-1 text-[11px] text-ink-200">
            <HardDrive size={12} className="text-[var(--devlens-accent)]" />
            Cache Storage
            <span className="font-mono text-[9px] text-ink-600">{caches.length}</span>
          </h3>
          {caches.length === 0 ? (
            <p className="px-3 py-2 font-mono text-[10px] text-ink-600">empty</p>
          ) : (
            caches.map((cache) => (
              <div key={cache.name} className="group px-3 py-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-200" title={cache.name}>
                    {cache.name}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-ink-600">
                    {cache.entries.length}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete the ${cache.name} cache`}
                    onClick={() => onRemoveCache(cache.name)}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-600 opacity-0 transition-colors group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
                {cache.entries.slice(0, 5).map((entry) => (
                  <p key={entry} className="truncate pl-3 font-mono text-[9px] text-ink-600" title={entry}>
                    {entry}
                  </p>
                ))}
              </div>
            ))
          )}
        </section>
      </div>

      <div className="shrink-0 space-y-2 border-t border-[var(--devlens-hairline)] px-3 py-2">
        <div className="grid grid-cols-[74px_minmax(0,1fr)_auto] gap-1.5">
          <select
            value={draft.area}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                area: event.target.value === 'session' ? 'session' : 'local'
              }))
            }
            aria-label="Storage area"
            className="h-7 rounded border border-[var(--devlens-hairline)] bg-ink-950 px-1 font-mono text-[10px] text-ink-300 outline-none focus:border-[var(--devlens-accent-line)]"
          >
            <option value="local">local</option>
            <option value="session">session</option>
          </select>
          <input
            value={draft.key}
            onChange={(event) =>
              setDraft((current) => ({ ...current, key: event.target.value }))
            }
            spellCheck={false}
            placeholder="key"
            aria-label="Storage key"
            className="h-7 min-w-0 rounded border border-[var(--devlens-hairline)] bg-black/20 px-2 font-mono text-[10px] text-ink-200 outline-none placeholder:text-ink-600 focus:border-[var(--devlens-accent-line)]"
          />
          <button
            type="button"
            disabled={!origin || !draft.key.trim()}
            onClick={() => {
              onSetEntry(draft.area, draft.key.trim(), draft.value)
              setDraft((current) => ({ ...current, key: '', value: '' }))
            }}
            className="inline-flex h-7 items-center gap-1 rounded border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-2 text-[10px] text-[var(--devlens-accent)] disabled:opacity-40"
          >
            <Save size={10} />
            set
          </button>
        </div>
        <input
          value={draft.value}
          onChange={(event) =>
            setDraft((current) => ({ ...current, value: event.target.value }))
          }
          spellCheck={false}
          placeholder="value"
          aria-label="Storage value"
          className="h-7 w-full rounded border border-[var(--devlens-hairline)] bg-black/20 px-2 font-mono text-[10px] text-ink-200 outline-none placeholder:text-ink-600 focus:border-[var(--devlens-accent-line)]"
        />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Clear HTTP cache for this profile"
            onClick={onClearCache}
            disabled={!origin}
            className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded border border-[var(--devlens-hairline)] text-[10px] text-ink-300 transition-colors hover:border-sky-400/40 hover:text-sky-200 disabled:opacity-40"
          >
            <HardDrive size={10} />
            Clear HTTP cache
          </button>
          <button
            type="button"
            aria-label="Clear this site's cookies and storage"
            onClick={onClearSite}
            disabled={!origin}
            className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded border border-[var(--devlens-hairline)] text-[10px] text-ink-300 transition-colors hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-40"
          >
            <Trash2 size={10} />
            Clear site data
          </button>
        </div>
      </div>
    </div>
  )
}
