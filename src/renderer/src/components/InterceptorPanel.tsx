import { useEffect, useMemo, useState } from 'react'
import { Ban, Play, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react'
import type { CapturedRequest, PausedRequest, RepeaterRequest, RepeaterResponse } from '@shared/types'
import type { InterceptorStore } from '@renderer/hooks/useInterceptorStore'
import { HeaderPairsEditor } from '@renderer/components/HeaderPairs'
import { InterceptorRules } from '@renderer/components/InterceptorRules'
import { RequestList } from '@renderer/components/RequestList'
import {
  EMPTY_REPEATER_REQUEST,
  RepeaterPanel
} from '@renderer/components/RepeaterPanel'

type Segment = 'capture' | 'repeater'

interface InterceptorPanelProps {
  store: InterceptorStore
  onNotice: (message: string) => void
}

/**
 * Interceptor studio: capture on one segment, replay on the other.
 *
 * Held requests are the interactive part of the interception: the network stack is
 * waiting for an answer, so the queue has to be impossible to miss.
 */
export function InterceptorPanel({ store, onNotice }: InterceptorPanelProps) {
  const [segment, setSegment] = useState<Segment>('capture')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RepeaterRequest>(EMPTY_REPEATER_REQUEST)
  const [response, setResponse] = useState<RepeaterResponse | null>(null)

  const sendToRepeater = (request: CapturedRequest): void => {
    setDraft({
      method: request.method,
      url: request.url,
      headers:
        request.headers.length > 0
          ? request.headers.map((pair) => ({ ...pair }))
          : [{ name: 'accept', value: 'application/json' }],
      body: request.bodyPreview ?? ''
    })
    setResponse(null)
    setSegment('repeater')
  }

  const blockUrl = (url: string): void => {
    store.addRule({ kind: 'block', pattern: url, enabled: true, note: 'added from the capture list' })
    onNotice(`blocking ${url}`)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-white/5 px-3 py-2">
        <div className="flex rounded-md border border-white/10 p-0.5">
          {(['capture', 'repeater'] as Segment[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSegment(option)}
              className={[
                'rounded-[4px] px-2 py-0.5 text-[11px] capitalize transition-colors',
                segment === option ? 'bg-white/10 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
              ].join(' ')}
            >
              {option}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-label="Toggle request interception"
          aria-pressed={store.state.enabled}
          onClick={() => store.setEnabled(!store.state.enabled)}
          title={store.state.enabled ? 'Interception is on' : 'Interception is off'}
          className={[
            'inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] transition-colors',
            store.state.enabled
              ? 'border-teal-400/40 bg-teal-400/10 text-teal-200'
              : 'border-white/10 text-neutral-500 hover:text-neutral-300'
          ].join(' ')}
        >
          {store.state.enabled ? <ShieldCheck size={11} /> : <ShieldOff size={11} />}
          {store.state.enabled ? 'on' : 'off'}
        </button>

        <button
          type="button"
          aria-label="Hold all requests"
          aria-pressed={store.state.pauseAll}
          onClick={() => store.setPauseAll(!store.state.pauseAll)}
          title="Hold every guest request for review (auto-resumes after the timeout)"
          className={[
            'inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] transition-colors',
            store.state.pauseAll
              ? 'border-amber-400/50 bg-amber-400/10 text-amber-200'
              : 'border-white/10 text-neutral-500 hover:text-neutral-300'
          ].join(' ')}
        >
          <Ban size={11} />
          hold all
        </button>

        <span className="ml-auto font-mono text-[10px] text-neutral-600">
          {store.requests.length}
          {store.paused.length > 0 && <span className="ml-1 text-amber-300">{store.paused.length} held</span>}
        </span>
        <button
          type="button"
          title="Clear captured requests"
          aria-label="Clear captured requests"
          onClick={() => {
            store.clear()
            setSelectedId(null)
          }}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {segment === 'capture' ? (
        <>
          <TrafficSummary
            requests={store.requests}
            paused={store.paused}
            captureEnabled={store.state.enabled}
          />
          {store.paused.length > 0 && <HeldQueue store={store} />}
          <InterceptorRules
            rules={store.rules}
            onAdd={store.addRule}
            onUpdate={store.updateRule}
            onRemove={store.removeRule}
            onToggle={store.toggleRule}
          />
          <RequestList
            requests={store.requests}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onSendToRepeater={sendToRepeater}
            onBlockUrl={blockUrl}
            onCopyUrl={(url) => {
              void window.devlens.clipboardWrite(url)
              onNotice('URL copied')
            }}
          />
        </>
      ) : (
        <RepeaterPanel
          draft={draft}
          onDraftChange={setDraft}
          response={response}
          onResponse={setResponse}
        />
      )}
    </div>
  )
}

interface TrafficSummaryProps {
  requests: CapturedRequest[]
  paused: PausedRequest[]
  captureEnabled: boolean
}

/** At-a-glance health for the current capture buffer. */
function TrafficSummary({ requests, paused, captureEnabled }: TrafficSummaryProps) {
  const stats = useMemo(() => {
    const completed = requests.filter((request) => request.durationMs !== null)
    const failed = requests.filter(
      (request) => request.error || (request.statusCode ?? 0) >= 400
    )
    const blocked = requests.filter((request) => request.blockedByRule)
    const totalDuration = completed.reduce((total, request) => total + (request.durationMs ?? 0), 0)

    return {
      total: requests.length,
      blocked: blocked.length,
      failed: failed.length,
      averageMs: completed.length === 0 ? null : Math.round(totalDuration / completed.length)
    }
  }, [requests])

  const cells = [
    { label: 'Requests', value: String(stats.total), tone: 'text-neutral-200' },
    {
      label: 'Blocked',
      value: String(stats.blocked),
      tone: stats.blocked > 0 ? 'text-rose-300' : 'text-neutral-200'
    },
    {
      label: 'Errors',
      value: String(stats.failed),
      tone: stats.failed > 0 ? 'text-amber-300' : 'text-neutral-200'
    },
    {
      label: 'Avg',
      value: stats.averageMs === null ? '--' : `${stats.averageMs}ms`,
      tone: 'text-neutral-200'
    }
  ]

  return (
    <section
      aria-label="Traffic summary"
      className="mx-3 mt-2 flex shrink-0 items-center gap-2 rounded-md border border-white/10 bg-neutral-950/70 px-2.5 py-1.5"
    >
      <span
        className={[
          'inline-flex h-1.5 w-1.5 shrink-0 rounded-full',
          captureEnabled ? 'bg-teal-300 animate-pulse' : 'bg-neutral-600'
        ].join(' ')}
        aria-hidden="true"
      />
      <span className="text-[10px] uppercase tracking-wide text-neutral-500">
        {captureEnabled ? 'Live' : 'Paused'}
      </span>

      <div className="ml-1 grid min-w-0 flex-1 grid-cols-4 gap-2">
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0">
            <p className="truncate text-[9px] uppercase tracking-wide text-neutral-600">
              {cell.label}
            </p>
            <p className={`truncate font-mono text-[11px] ${cell.tone}`}>{cell.value}</p>
          </div>
        ))}
      </div>

      {paused.length > 0 && (
        <span className="shrink-0 rounded bg-amber-400/15 px-1.5 py-0.5 font-mono text-[9px] text-amber-200">
          {paused.length} held
        </span>
      )}
    </section>
  )
}

interface HeldQueueProps {
  store: InterceptorStore
}

/** Requests the network stack is waiting on. Resume continues, drop fails them. */
function HeldQueue({ store }: HeldQueueProps) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="shrink-0 space-y-2 border-b border-amber-400/20 bg-amber-400/[0.04] px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-amber-200">
          Held requests
        </span>
        <span className="font-mono text-[10px] text-amber-200/70">
          {store.paused.length} of {store.state.maxPaused}
        </span>
        <button
          type="button"
          onClick={() => store.setPauseAll(false)}
          className="ml-auto rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-neutral-300 transition-colors hover:bg-white/5"
        >
          release all
        </button>
      </div>

      {store.paused.map((paused) => (
        <HeldRequest key={paused.id} paused={paused} store={store} now={now} />
      ))}
    </div>
  )
}

interface HeldRequestProps {
  paused: PausedRequest
  store: InterceptorStore
  now: number
}

function HeldRequest({ paused, store, now }: HeldRequestProps) {
  const [headers, setHeaders] = useState(paused.headers)
  const secondsLeft = Math.max(0, Math.round((paused.expiresAt - now) / 1000))

  return (
    <div
      data-request-id={paused.id}
      className="rounded border border-amber-400/25 bg-neutral-950/70 p-2"
    >
      <p className="font-mono text-[10px] text-neutral-300">
        <span className="text-amber-200">{paused.method}</span> {paused.url}
      </p>
      <p className="mt-0.5 font-mono text-[10px] text-neutral-600">
        {paused.resourceType}
        {paused.viewId ? ` - ${paused.viewId}` : ''} - auto-resume in {secondsLeft}s
      </p>

      <div className="mt-1.5">
        <HeaderPairsEditor headers={headers} onChange={setHeaders} />
      </div>

      {paused.bodyPreview && (
        <pre className="mt-1.5 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded border border-white/10 bg-neutral-950/70 p-1.5 font-mono text-[10px] text-neutral-400">
          {paused.bodyPreview}
        </pre>
      )}

      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => store.resume({ id: paused.id, headers })}
          className="inline-flex items-center gap-1 rounded border border-teal-400/40 bg-teal-400/10 px-1.5 py-0.5 text-[10px] text-teal-100 transition-colors hover:bg-teal-400/20"
        >
          <Play size={10} />
          Resume
        </button>
        <button
          type="button"
          onClick={() => store.drop(paused.id)}
          className="inline-flex items-center gap-1 rounded border border-rose-400/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-100 transition-colors hover:bg-rose-500/20"
        >
          <Ban size={10} />
          Drop
        </button>
        <button
          type="button"
          onClick={() => store.addRule({ kind: 'pause', pattern: paused.url, enabled: true })}
          className="ml-auto rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200"
        >
          always hold this URL
        </button>
      </div>
    </div>
  )
}
