import { useEffect, useRef, useState } from 'react'
import { Coffee, Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { Widget, WidgetAction } from '@renderer/components/dashboard/Widget'

type Phase = 'focus' | 'break'

/** The classic pomodoro pair. Both are a constant here, so the label can never disagree. */
const DURATIONS: Record<Phase, number> = { focus: 25 * 60, break: 5 * 60 }
const PHASE_LABEL: Record<Phase, string> = { focus: 'Focus', break: 'Break' }

function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60)
  return `${String(minutes).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

/**
 * Focus timer.
 *
 * A countdown the operator starts, stops and resets, and nothing else: it is a local widget, so
 * there is no notification, no sound and no idle detection - a timer that shouts is worse than one
 * that is ignored. Running out hands over to the other phase and waits to be started, which keeps
 * "the break began" a decision rather than a surprise.
 */
export function FocusTimer() {
  const [phase, setPhase] = useState<Phase>('focus')
  const [remaining, setRemaining] = useState(DURATIONS.focus)
  const [running, setRunning] = useState(false)
  /** Focus rounds finished since the dashboard opened. Session only, like the mode dial. */
  const [completed, setCompleted] = useState(0)
  const finished = useRef(false)

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running])

  /**
   * The handover at zero.
   *
   * It runs in an effect rather than inside the interval callback so the phase change happens
   * once per countdown: the updater runs twice under React's development double-invoke, and a
   * phase flip there would advance two steps at a time.
   */
  useEffect(() => {
    if (remaining > 0) {
      finished.current = false
      return
    }
    if (!running || finished.current) return
    finished.current = true
    setRunning(false)
    setPhase((current) => {
      const next: Phase = current === 'focus' ? 'break' : 'focus'
      if (current === 'focus') setCompleted((count) => count + 1)
      setRemaining(DURATIONS[next])
      return next
    })
  }, [remaining, running])

  const total = DURATIONS[phase]
  const progress = total === 0 ? 0 : Math.min(1, Math.max(0, 1 - remaining / total))

  const switchTo = (next: Phase): void => {
    finished.current = false
    setRunning(false)
    setPhase(next)
    setRemaining(DURATIONS[next])
  }

  const reset = (): void => {
    finished.current = false
    setRunning(false)
    setRemaining(DURATIONS[phase])
  }

  return (
    <Widget
      icon={Timer}
      title="Focus timer"
      note={`${completed} focus round${completed === 1 ? '' : 's'} done this session`}
      action={
        <>
          <WidgetAction
            label={phase === 'focus' ? 'Switch to break' : 'Switch to focus'}
            title={phase === 'focus' ? 'Break: 5 minutes' : 'Focus: 25 minutes'}
            onClick={() => switchTo(phase === 'focus' ? 'break' : 'focus')}
          >
            <Coffee size={11} />
          </WidgetAction>
          <WidgetAction label="Reset timer" onClick={reset}>
            <RotateCcw size={11} />
          </WidgetAction>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        {/* Wraps rather than overlaps: the phase chip and the button drop to their own line when
            the card is narrow, and the clock never has something drawn across it. */}
        <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
          <span
            data-testid="focus-timer-clock"
            className="font-mono text-[28px] leading-8 tabular-nums text-ink-100"
          >
            {clock(remaining)}
          </span>
          <span
            data-testid="focus-timer-phase"
            data-phase={phase}
            className="mb-1 shrink-0 rounded-full bg-[var(--devlens-accent-soft)] px-2 py-0.5 text-[10px] text-[var(--devlens-accent)]"
          >
            {PHASE_LABEL[phase]}
          </span>
          <button
            type="button"
            data-testid="focus-timer-toggle"
            aria-label={running ? 'Pause timer' : 'Start timer'}
            aria-pressed={running}
            onClick={() => {
              finished.current = false
              setRunning((value) => !value)
            }}
            className="mb-0.5 ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)] transition-colors hover:bg-[var(--devlens-accent)] hover:text-ink-950"
          >
            {running ? <Pause size={13} /> : <Play size={13} />}
          </button>
        </div>

        <div
          className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]"
          role="progressbar"
          aria-label={`${PHASE_LABEL[phase]} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            data-testid="focus-timer-progress"
            className="h-full rounded-full bg-[var(--devlens-accent)] transition-[width] duration-500 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </Widget>
  )
}
