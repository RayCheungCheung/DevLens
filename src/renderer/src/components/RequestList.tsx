import { useMemo, useState } from 'react'
import { Ban, Copy, CornerDownRight, Search, Terminal } from 'lucide-react'
import type { CapturedRequest } from '@shared/types'
import { HeaderPairsEditor } from '@renderer/components/HeaderPairs'
import { shortenUrl } from '@renderer/lib/url'

type KindFilter = 'all' | 'calls' | 'documents' | 'assets' | 'failed'

interface RequestListProps {
  requests: CapturedRequest[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onSendToRepeater: (request: CapturedRequest) => void
  onBlockUrl: (url: string) => void
  onCopyUrl: (url: string) => void
}

const FILTERS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'calls', label: 'Calls' },
  { id: 'documents', label: 'Docs' },
  { id: 'assets', label: 'Assets' },
  { id: 'failed', label: 'Failed' }
]

const CALL_TYPES = new Set(['xhr', 'fetch', 'mainFrame', 'subFrame', 'webSocket'])
const ASSET_TYPES = new Set(['script', 'stylesheet', 'image', 'font', 'media', 'object'])

/** Captured requests, newest first, with per-request detail and hand-off actions. */
export function RequestList({
  requests,
  selectedId,
  onSelect,
  onSendToRepeater,
  onBlockUrl,
  onCopyUrl
}: RequestListProps) {
  const [filter, setFilter] = useState<KindFilter>('all')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return requests.filter((request) => {
      if (filter === 'calls' && !CALL_TYPES.has(request.resourceType)) return false
      if (filter === 'documents' && request.resourceType !== 'document') return false
      if (filter === 'assets' && !ASSET_TYPES.has(request.resourceType)) return false
      if (filter === 'failed' && !request.error && (request.statusCode ?? 0) < 400) return false
      if (!needle) return true
      return `${request.method} ${request.url}`.toLowerCase().includes(needle)
    })
  }, [requests, filter, query])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-white/5 px-3 py-1.5">
        <div className="flex rounded-md border border-white/10 p-0.5">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={[
                'rounded-[4px] px-1.5 py-0.5 text-[10px] transition-colors',
                filter === option.id ? 'bg-white/10 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-white/10 bg-neutral-950/70 px-1.5 py-0.5 focus-within:border-teal-400/50">
          <Search size={11} className="shrink-0 text-neutral-600" />
          <input
            value={query}
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter"
            aria-label="Filter requests"
            className="min-w-0 flex-1 bg-transparent font-mono text-[10px] text-neutral-200 outline-none placeholder:text-neutral-600"
          />
        </div>
        <span className="shrink-0 font-mono text-[10px] text-neutral-600">{visible.length}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-center font-mono text-[10px] text-neutral-600">
            {requests.length === 0 ? 'No requests captured yet.' : 'Nothing matches this filter.'}
          </p>
        ) : (
          visible.map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              expanded={selectedId === request.id}
              onToggle={() => onSelect(selectedId === request.id ? null : request.id)}
              onSendToRepeater={onSendToRepeater}
              onBlockUrl={onBlockUrl}
              onCopyUrl={onCopyUrl}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface RequestRowProps {
  request: CapturedRequest
  expanded: boolean
  onToggle: () => void
  onSendToRepeater: (request: CapturedRequest) => void
  onBlockUrl: (url: string) => void
  onCopyUrl: (url: string) => void
}

function RequestRow({
  request,
  expanded,
  onToggle,
  onSendToRepeater,
  onBlockUrl,
  onCopyUrl
}: RequestRowProps) {
  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-3 py-1 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span
          className={[
            'w-10 shrink-0 font-mono text-[10px]',
            statusTone(request.statusCode, request.error)
          ].join(' ')}
        >
          {request.statusCode ?? (request.error ? 'ERR' : '...')}
        </span>
        <span className="w-11 shrink-0 font-mono text-[10px] uppercase text-neutral-500">
          {request.method}
        </span>
        <span className="w-16 shrink-0 truncate font-mono text-[10px] text-neutral-600">
          {request.resourceType}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-neutral-300">
          {shortenUrl(request.url, 70)}
        </span>
        {request.paused && (
          <span className="shrink-0 rounded bg-amber-400/15 px-1 font-mono text-[9px] text-amber-200">
            held
          </span>
        )}
        {request.blockedByRule && (
          <span className="shrink-0 rounded bg-rose-500/15 px-1 font-mono text-[9px] text-rose-200">
            blocked
          </span>
        )}
        {request.viewId && (
          <span className="shrink-0 font-mono text-[9px] uppercase text-neutral-600">
            {request.viewId}
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-white/5 bg-neutral-950/60 px-3 py-2">
          <p className="break-all font-mono text-[10px] text-neutral-400">{request.url}</p>
          <p className="font-mono text-[10px] text-neutral-600">
            {request.durationMs !== null ? `${request.durationMs} ms` : 'pending'}
            {request.mimeType && <span className="ml-2">{request.mimeType}</span>}
            {request.fromCache && <span className="ml-2 text-sky-300">from cache</span>}
            {request.remoteAddress && <span className="ml-2">{request.remoteAddress}</span>}
            {request.modifiedHeaders.length > 0 && (
              <span className="ml-2 text-amber-300">rules: {request.modifiedHeaders.join(', ')}</span>
            )}
            {request.error && <span className="ml-2 text-rose-300">{request.error}</span>}
          </p>

          <RequestHeaders request={request} />

          {request.bodyPreview && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">
                Body{request.bodyTruncated ? ' (truncated)' : ''}
              </p>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded border border-white/10 bg-neutral-950/70 p-2 font-mono text-[10px] text-neutral-300">
                {request.bodyPreview}
              </pre>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSendToRepeater(request)}
              className="inline-flex items-center gap-1 rounded border border-teal-400/40 bg-teal-400/10 px-1.5 py-0.5 text-[10px] text-teal-100 transition-colors hover:bg-teal-400/20"
            >
              <CornerDownRight size={10} />
              Send to Repeater
            </button>
            <button
              type="button"
              onClick={() => onBlockUrl(request.url)}
              className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-neutral-300 transition-colors hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200"
            >
              <Ban size={10} />
              Block URL
            </button>
            <button
              type="button"
              onClick={() => onCopyUrl(request.url)}
              className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-neutral-300 transition-colors hover:bg-white/5"
            >
              <Copy size={10} />
              Copy URL
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function statusTone(statusCode: number | null, error: string | null): string {
  if (error) return 'text-rose-300'
  if (statusCode === null) return 'text-neutral-500'
  if (statusCode >= 500) return 'text-rose-300'
  if (statusCode >= 400) return 'text-amber-300'
  if (statusCode >= 300) return 'text-sky-300'
  return 'text-neutral-400'
}

type HeaderTab = 'request' | 'response'

interface RequestHeadersProps {
  request: CapturedRequest
}

/** Compact header inspector with search, response capture awareness, and cURL hand-off. */
function RequestHeaders({ request }: RequestHeadersProps) {
  const [tab, setTab] = useState<HeaderTab>('request')
  const [filter, setFilter] = useState('')
  const responseHeaders = request.responseHeaders ?? []
  const activeHeaders = tab === 'request' ? request.headers : responseHeaders
  const needle = filter.trim().toLowerCase()
  const visibleHeaders = needle
    ? activeHeaders.filter(
        (header) =>
          header.name.toLowerCase().includes(needle) ||
          header.value.toLowerCase().includes(needle)
      )
    : activeHeaders

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <div className="flex rounded-md border border-white/10 p-0.5">
          {(['request', 'response'] as HeaderTab[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTab(option)}
              className={[
                'rounded-[4px] px-1.5 py-0.5 text-[10px] capitalize transition-colors',
                tab === option
                  ? 'bg-white/10 text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-300'
              ].join(' ')}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-1 rounded border border-white/10 bg-neutral-950/70 px-1.5 py-0.5 focus-within:border-teal-400/50">
          <Search size={10} className="shrink-0 text-neutral-600" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter headers"
            aria-label="Filter headers"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent font-mono text-[10px] text-neutral-200 outline-none placeholder:text-neutral-600"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            void window.devlens.clipboardWrite(toCurl(request))
          }}
          title="Copy as cURL"
          aria-label="Copy as cURL"
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded border border-white/10 px-1.5 text-[10px] text-neutral-300 transition-colors hover:bg-white/5"
        >
          <Terminal size={10} />
          cURL
        </button>
      </div>

      <HeaderPairsEditor
        headers={visibleHeaders}
        onChange={() => undefined}
        readOnly
        emptyLabel={
          activeHeaders.length === 0
            ? tab === 'request'
              ? 'No request headers'
              : 'No response metadata captured yet'
            : 'No headers match this filter'
        }
      />
    </div>
  )
}

function toCurl(request: CapturedRequest): string {
  const lines = [`curl -X ${request.method} '${request.url.replace(/'/g, `'\\''`)}'`]
  for (const header of request.headers) {
    if (!header.name) continue
    lines.push(`  -H '${header.name}: ${header.value.replace(/'/g, `'\\''`)}'`)
  }
  if (request.bodyPreview) {
    lines.push(`  --data-raw '${request.bodyPreview.replace(/'/g, `'\\''`)}'`)
  }
  return lines.join(' \\\n')
}
