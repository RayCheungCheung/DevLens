import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, MousePointer2, MonitorX, Loader2 } from 'lucide-react'
import type { ThreatState } from '@shared/types'
import { LensyMascot } from '@renderer/components/LensyMascot'

interface ProtectiveShieldProps {
  state: ThreatState
  className?: string
}

/**
 * Protective shield overlay that covers the entire viewport when a threat is
 * detected during WImH mode.
 *
 * The shield:
 *  - Renders at the highest z-index with a semi-opaque backdrop.
 *  - Displays Lensy holding a shield with the "DevLens is protecting you" message.
 *  - Locks all pointer events on the page underneath.
 *  - Shows a dismiss button that confirms the operator is human before unlocking.
 */
export function ProtectiveShield({ state, className }: ProtectiveShieldProps) {
  const [dismissTimer, setDismissTimer] = useState(5)
  const [dismissReady, setDismissReady] = useState(false)

  const alert = state.alert

  // Countdown before the dismiss button becomes active - prevents
  // a script from instantly dismissing the shield.
  useEffect(() => {
    if (!state.locked || !alert) {
      setDismissTimer(5)
      setDismissReady(false)
      return
    }

    const interval = setInterval(() => {
      setDismissTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          setDismissReady(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [state.locked, alert?.timestamp])

  if (!state.locked || !alert) return null

  const isCritical = alert.severity === 'critical'
  const threatIcon = alert.kind === 'remote-control'
    ? MousePointer2
    : alert.kind === 'screenshot-detected'
      ? MonitorX
      : ShieldAlert

  const ThreatIcon = threatIcon

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={`DevLens protective shield - ${alert.message}`}
      data-testid="protective-shield"
      data-threat={alert.kind}
      data-severity={alert.severity}
      className={[
        'fixed inset-0 z-[9999] flex items-center justify-center',
        'bg-black/85 backdrop-blur-md',
        'animate-in fade-in duration-300',
        className ?? ''
      ].join(' ')}
    >
      {/* Prevent interaction with the page underneath. */}
      <div className="absolute inset-0" aria-hidden="true" />

      <div className="relative z-10 flex max-w-md flex-col items-center gap-6 px-6 py-10 text-center">
        {/* Lensy mascot with protective shield pose */}
        <LensyMascot
          shield
          shieldState={isCritical ? 'insecure' : 'secure'}
          size={120}
          showName={false}
        />

        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            {isCritical ? (
              <ShieldAlert size={22} className="text-amber-400" />
            ) : (
              <ShieldCheck size={22} className="text-violet-300" />
            )}
            <h1 className="font-mono text-[18px] font-semibold uppercase tracking-[0.08em] text-ink-100">
              DevLens is protecting you
            </h1>
          </div>
          <p className="max-w-xs font-mono text-[12px] leading-relaxed text-ink-300">
            {state.reason}
          </p>
        </div>

        {/* Threat details card */}
        <div
          className={[
            'w-full rounded-lg border px-4 py-3 text-left',
            isCritical
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-violet-400/30 bg-violet-400/10'
          ].join(' ')}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <ThreatIcon size={14} className={isCritical ? 'text-amber-300' : 'text-violet-300'} />
            <span
              className={[
                'font-mono text-[10px] uppercase tracking-[0.1em]',
                isCritical ? 'text-amber-300' : 'text-violet-300'
              ].join(' ')}
            >
              {isCritical ? 'Critical threat' : 'Warning'}
            </span>
          </div>
          <p className="font-mono text-[12px] text-ink-200">{alert.message}</p>
          <p className="mt-1 font-mono text-[10px] text-ink-400">{alert.detail}</p>
          <p className="mt-2 font-mono text-[9px] text-ink-600">
            {new Date(alert.timestamp).toLocaleTimeString()}
          </p>
        </div>

        {/* Dismiss button */}
        {dismissReady ? (
          <button
            type="button"
            data-testid="shield-dismiss"
            onClick={() => {
              if (typeof window.devlens?.threatDismiss === 'function') {
                window.devlens.threatDismiss()
              }
            }}
            className={[
              'inline-flex items-center gap-2 rounded-md border px-5 py-2.5 font-mono text-[12px] transition-colors',
              isCritical
                ? 'border-amber-500/40 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                : 'border-violet-400/40 bg-violet-400/20 text-violet-200 hover:bg-violet-400/30'
            ].join(' ')}
          >
            <ShieldCheck size={15} />
            I understand — dismiss shield
          </button>
        ) : (
          <div className="flex items-center gap-2 text-ink-500">
            <Loader2 size={14} className="animate-spin" />
            <span className="font-mono text-[11px]">
              Shield unlocks in {dismissTimer}s
            </span>
          </div>
        )}

        {/* Footer */}
        <p className="font-mono text-[9px] text-ink-600 max-w-[280px] leading-relaxed">
          The protective shield locks the interface when suspicious activity is
          detected. Dismissing it confirms you are the human operator.
        </p>
      </div>
    </div>
  )
}
