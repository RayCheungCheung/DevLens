import { useEffect, useState, type ReactNode } from 'react'
import {
  Clipboard,
  Cpu,
  EyeOff,
  HardDrive,
  Loader2,
  ShieldCheck,
  Trash2,
  Zap
} from 'lucide-react'
import type { WimhEvent, WimhState } from '@shared/types'

interface DefensePanelProps {
  state: WimhState | null
  busy: boolean
  onToggle: (enabled: boolean) => void
  onScrub: () => void
  onClipboardTtl: (ms: number) => void
  onExitSession: () => void
  onNotice: (message: string) => void
}

const TTL_OPTIONS = [5000, 15000, 30000, 60000, 300000]

const CATEGORY_TONES: Record<WimhEvent['category'], string> = {
  'ram-only': 'text-sky-300',
  memory: 'text-violet-300',
  window: 'text-teal-300',
  clipboard: 'text-amber-300',
  session: 'text-neutral-300'
}

/**
 * WImH control surface.
 *
 * Every subsystem reports what it has actually done, and the panel is explicit about the
 * limits: a host with kernel or debugger access can still read this process, and no userspace
 * app can stop another process from reading the shared clipboard while a value sits there.
 * Saying that out loud is part of the feature.
 */
export function DefensePanel({
  state,
  busy,
  onToggle,
  onScrub,
  onClipboardTtl,
  onExitSession,
  onNotice
}: DefensePanelProps) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  if (!state) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center gap-2">
        <Loader2 size={14} className="animate-spin text-teal-300" />
        <span className="text-[11px] text-neutral-500">reading defense state</span>
      </div>
    )
  }

  const uptime = state.startedAt ? Math.max(0, Math.round((now - state.startedAt) / 1000)) : 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 border-b border-white/5 px-3 py-2">
        <button
          type="button"
          aria-pressed={state.active}
          aria-label="Toggle extreme defense mode"
          disabled={busy}
          onClick={() => onToggle(!state.active)}
          className={[
            'flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors',
            state.active
              ? 'border-violet-400/50 bg-violet-500/15'
              : 'border-white/10 hover:border-violet-400/30 hover:bg-white/[0.03]'
          ].join(' ')}
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin text-violet-200" />
          ) : (
            <ShieldCheck size={15} className={state.active ? 'text-violet-200' : 'text-neutral-500'} />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] text-neutral-100">
              Extreme defense {state.active ? 'on' : 'off'}
            </span>
            <span className="block font-mono text-[10px] text-neutral-500">
              {state.active
                ? `${state.partition} - up ${uptime}s - exit wipes everything`
                : 'RAM-only session, clipboard sentinel, window capture protection'}
            </span>
          </span>
          {state.active && (
            <span className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
              wimh
            </span>
          )}
        </button>

        <div className="grid grid-cols-2 gap-1.5">
          <Subsystem
            icon={<HardDrive size={11} />}
            title="RAM only"
            tone={state.ramOnly.partitionInMemory && state.active ? 'good' : 'idle'}
            lines={[
              state.ramOnly.partitionInMemory ? 'session not on disk' : 'checking partition',
              `${state.ramOnly.cookiesDowngraded} cookie${state.ramOnly.cookiesDowngraded === 1 ? '' : 's'} downgraded`,
              `${state.ramOnly.historyBlocked} history writes refused`,
              `${state.ramOnly.storageWipes} storage wipe${state.ramOnly.storageWipes === 1 ? '' : 's'}`
            ]}
          />
          <Subsystem
            icon={<Cpu size={11} />}
            title="Memory hygiene"
            tone={state.memory.liveScrubs > 0 ? 'good' : 'idle'}
            lines={[
              `${state.memory.liveScrubs} buffer${state.memory.liveScrubs === 1 ? '' : 's'} pending`,
              `${state.memory.scrubbedValues} zeroed`,
              `${state.memory.redactedFields} fields redacted`,
              `zero after ${Math.round(state.memory.scrubAfterMs / 1000)}s`
            ]}
          />
          <Subsystem
            icon={<EyeOff size={11} />}
            title="Window protection"
            tone={state.contentProtection ? 'good' : 'idle'}
            lines={[
              state.contentProtection ? 'capture excluded by OS' : 'capture allowed',
              `${state.displayMediaBlocked} display media refused`,
              'window snapshots blocked'
            ]}
          />
          <Subsystem
            icon={<Clipboard size={11} />}
            title="Clipboard sentinel"
            tone={state.clipboard.enabled ? 'good' : 'idle'}
            lines={[
              `${state.clipboard.guardedWrites} writes classified`,
              `${state.clipboard.purgedSecrets} purge${state.clipboard.purgedSecrets === 1 ? '' : 's'}`,
              `${state.clipboard.blockedPastes} paste${state.clipboard.blockedPastes === 1 ? '' : 's'} refused`,
              state.clipboard.lastPurgeReason ?? 'no secret seen yet'
            ]}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-neutral-500">
            purge after
            <select
              aria-label="Clipboard purge timeout"
              value={state.clipboard.clearAfterMs}
              onChange={(event) => onClipboardTtl(Number(event.target.value))}
              className="rounded border border-white/10 bg-neutral-950/70 px-1 py-0.5 font-mono text-[10px] text-neutral-300 outline-none"
            >
              {TTL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option / 1000}s
                </option>
              ))}
              {!TTL_OPTIONS.includes(state.clipboard.clearAfterMs) && (
                <option value={state.clipboard.clearAfterMs}>
                  {Math.round(state.clipboard.clearAfterMs / 1000)}s
                </option>
              )}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              onScrub()
              onNotice('scratch buffers zeroed')
            }}
            className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-1 text-[10px] text-neutral-300 transition-colors hover:bg-white/5"
          >
            <Zap size={10} />
            Scrub now
          </button>
          {state.active && (
            <button
              type="button"
              onClick={onExitSession}
              className="ml-auto inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-1 text-[10px] text-neutral-400 transition-colors hover:border-rose-400/40 hover:text-rose-200"
            >
              <Trash2 size={10} />
              Wipe &amp; exit
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <p className="mb-1.5 text-[10px] uppercase tracking-wide text-neutral-600">Defense log</p>
        {state.events.length === 0 ? (
          <p className="font-mono text-[10px] text-neutral-600">
            Nothing to report. Enable the mode to start collecting defense events.
          </p>
        ) : (
          <ul className="space-y-1">
            {state.events.map((event) => (
              <li key={event.id} className="font-mono text-[10px] leading-4">
                <span className="text-neutral-600">
                  {new Date(event.timestamp).toLocaleTimeString()}{' '}
                </span>
                <span className={CATEGORY_TONES[event.category]}>{event.category}</span>{' '}
                <span className="text-neutral-300">{event.message}</span>
                {event.detail && <span className="text-neutral-600"> - {event.detail}</span>}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 space-y-1 rounded border border-white/10 bg-neutral-950/50 p-2 text-[10px] leading-4 text-neutral-500">
          <p className="text-neutral-400">Limits worth knowing</p>
          <p>
            A host with kernel or debugger access can read this process's memory, and a
            JavaScript string cannot be overwritten in place - which is why nothing sensitive is
            kept as one.
          </p>
          <p>
            Other applications can read the clipboard while a value sits there. The sentinel
            shortens that window and refuses to paste detected credentials into DevLens.
          </p>
        </div>
      </div>
    </div>
  )
}

interface SubsystemProps {
  icon: ReactNode
  title: string
  tone: 'good' | 'idle'
  lines: string[]
}

function Subsystem({ icon, title, tone, lines }: SubsystemProps) {
  return (
    <div className="rounded border border-white/10 bg-neutral-950/50 px-2 py-1.5">
      <p
        className={[
          'mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide',
          tone === 'good' ? 'text-teal-300' : 'text-neutral-500'
        ].join(' ')}
      >
        {icon}
        {title}
      </p>
      {lines.map((line) => (
        <p key={line} className="truncate font-mono text-[10px] leading-4 text-neutral-400">
          {line}
        </p>
      ))}
    </div>
  )
}
