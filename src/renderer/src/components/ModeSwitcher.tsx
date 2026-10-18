import { Lock, TerminalSquare } from 'lucide-react'
import { modeDescriptor, WORKSPACE_MODES, type WorkspaceMode } from '@shared/mode'

interface ModeSwitcherProps {
  mode: WorkspaceMode
  busy: boolean
  onChange: (mode: WorkspaceMode) => void
}

/**
 * Mode switcher.
 *
 * Normal is deliberately quiet - a thin lock and a muted label, because the point of that mode
 * is to disappear. Dev gets the hacker accent: a lime terminal badge, a glow on the rail and
 * the mode name in the status bar.
 */
export function ModeSwitcher({ mode, busy, onChange }: ModeSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Workspace mode"
      className={[
        'flex shrink-0 items-center gap-0.5 rounded-md border p-0.5 transition-colors',
        mode === 'dev' ? 'border-lime-400/40 bg-lime-400/[0.06]' : 'border-white/10 bg-white/[0.02]'
      ].join(' ')}
    >
      {WORKSPACE_MODES.map((option) => {
        const active = option === mode
        const descriptor = modeDescriptor(option)
        const Icon = option === 'dev' ? TerminalSquare : Lock

        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            aria-label={`${descriptor.label} - ${descriptor.tagline}`}
            disabled={busy}
            onClick={() => onChange(option)}
            title={`${descriptor.label} - ${descriptor.tagline}`}
            className={[
              'inline-flex h-6 items-center gap-1.5 rounded-[4px] px-2 text-[10px] transition-colors',
              active
                ? option === 'dev'
                  ? 'bg-lime-400/15 text-lime-100'
                  : 'bg-white/10 text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-300'
            ].join(' ')}
          >
            <Icon size={11} />
            {option === 'dev' ? 'Dev' : 'Normal'}
          </button>
        )
      })}
    </div>
  )
}

