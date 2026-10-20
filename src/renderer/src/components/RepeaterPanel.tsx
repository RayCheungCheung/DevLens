import { useEffect, useState } from 'react'
import { Copy, Loader2, RotateCcw, Send } from 'lucide-react'
import { SelectMenu } from '@renderer/components/SelectMenu'
import type { RepeaterRequest, RepeaterResponse } from '@shared/types'
import { HeaderPairsEditor } from '@renderer/components/HeaderPairs'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

export const EMPTY_REPEATER_REQUEST: RepeaterRequest = {
  method: 'GET',
  url: '',
  headers: [{ name: 'accept', value: 'application/json' }],
  body: ''
}

interface RepeaterPanelProps {
  draft: RepeaterRequest
  onDraftChange: (draft: RepeaterRequest) => void
  /** Kept in the parent so switching tabs does not throw the response away. */
  response: RepeaterResponse | null
  onResponse: (response: RepeaterResponse | null) => void
}

/**
 * Repeater studio.
 *
 * The request is sent from the main process, which is the only place a payload can be
 * rewritten: webRequest exposes request bodies for reading, never for editing after the
 * fact. That is also why the Repeater exists next to the capture list.
 */
export function RepeaterPanel({ draft, onDraftChange, response, onResponse }: RepeaterPanelProps) {
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  const send = async (): Promise<void> => {
    if (!draft.url.trim() || sending) return
    setSending(true)
    onResponse(null)
    try {
      const result = await window.devlens.repeaterSend({
        method: draft.method,
        url: draft.url.trim(),
        headers: draft.headers,
        body: draft.body
      })
      onResponse(result)
    } finally {
      setSending(false)
    }
  }

  const canSend = draft.url.trim().length > 0 && !sending

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-1.5 border-b border-white/5 px-3 py-2">
        <div className="flex items-center gap-1">
          <SelectMenu
            ariaLabel="Request method"
            testId="request-method"
            value={draft.method}
            onChange={(method) => onDraftChange({ ...draft, method })}
            size="sm"
            className="w-[86px] shrink-0 font-mono"
            menuWidth={140}
            sections={[
              {
                options: METHODS.map((method) => ({
                  value: method,
                  label: method
                }))
              }
            ]}
          />
          <input
            value={draft.url}
            spellCheck={false}
            aria-label="Request URL"
            onChange={(event) => onDraftChange({ ...draft, url: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void send()
            }}
            placeholder="https://api.example.com/v1/resource"
            className="h-7 min-w-0 flex-1 rounded border border-white/10 bg-neutral-950/70 px-2 font-mono text-[10px] text-neutral-200 outline-none focus:border-teal-400/50"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!canSend}
            title="Send the request from the main process"
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded border border-teal-400/40 bg-teal-400/10 px-2 text-[10px] text-teal-100 transition-colors hover:bg-teal-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-neutral-600"
          >
            {sending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
            Send
          </button>
        </div>

        <HeaderPairsEditor
          headers={draft.headers}
          onChange={(headers) => onDraftChange({ ...draft, headers })}
          emptyLabel="No custom headers"
        />

        <textarea
          value={draft.body}
          spellCheck={false}
          aria-label="Request body"
          onChange={(event) => onDraftChange({ ...draft, body: event.target.value })}
          rows={3}
          placeholder='{"key":"value"}'
          className="w-full resize-none rounded border border-white/10 bg-neutral-950/70 px-2 py-1.5 font-mono text-[10px] leading-4 text-neutral-200 outline-none placeholder:text-neutral-700 focus:border-teal-400/50"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {!response && !sending && (
          <p className="py-6 text-center font-mono text-[10px] text-neutral-600">
            No response yet. Send the request, or push one in from the capture list.
          </p>
        )}

        {sending && (
          <p className="py-6 text-center font-mono text-[10px] text-neutral-500">Sending...</p>
        )}

        {response && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={[
                  'rounded px-1.5 py-0.5 font-mono text-[10px]',
                  response.ok && (response.status ?? 0) < 400
                    ? 'bg-teal-400/15 text-teal-200'
                    : 'bg-rose-500/15 text-rose-200'
                ].join(' ')}
              >
                {response.status ?? 'ERR'} {response.statusText}
              </span>
              <span className="font-mono text-[10px] text-neutral-600">{response.durationMs} ms</span>
              <button
                type="button"
                onClick={() => {
                  void window.devlens.clipboardWrite(response.body)
                  setCopied(true)
                }}
                className="ml-auto inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-neutral-300 transition-colors hover:bg-white/5"
              >
                <Copy size={10} />
                {copied ? 'Copied' : 'Copy body'}
              </button>
              <button
                type="button"
                title="Clear the response"
                aria-label="Clear the response"
                onClick={() => onResponse(null)}
                className="inline-flex h-5 w-5 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-300"
              >
                <RotateCcw size={10} />
              </button>
            </div>

            {response.error && (
              <p className="rounded border border-rose-400/30 bg-rose-500/10 px-2 py-1 font-mono text-[10px] text-rose-200">
                {response.error}
              </p>
            )}

            {response.headers.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">Response headers</p>
                <HeaderPairsEditor headers={response.headers} onChange={() => undefined} readOnly />
              </div>
            )}

            {response.body && (
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-600">
                  Body{response.truncated ? ' (truncated)' : ''}
                </p>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded border border-white/10 bg-neutral-950/70 p-2 font-mono text-[10px] text-neutral-300">
                  {response.body}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
