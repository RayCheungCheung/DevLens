import { Bug, SquareTerminal } from 'lucide-react'
import type { WorkspaceMode } from '@shared/mode'
import type { ViewportId } from '@shared/types'
import { tailPath } from '@renderer/lib/format'
import type { ViewportStatus } from '@renderer/components/ViewportFrame'
import { IconButton } from '@renderer/components/IconButton'

interface StatusBarProps {
  activeView: ViewportId
  activeStatus: ViewportStatus
  syncEnabled: boolean
  errorCount: number
  entryFile: string
  /** Last action result (IDE hand-off, export, ...). */
  statusMessage: string | null
  designMode: boolean
  interceptedCount: number
  heldCount: number
  sessionProfile: 'standard' | 'ghost' | 'wimh'
  blockedTrackers: number
  /** Name of the workspace click-to-source resolves inside. */
  workspaceName: string
  mode: WorkspaceMode
  profileName: string
  onOpenShellDevTools: () => void
  onOpenGuestDevTools: () => void
}

export function StatusBar({
  activeView,
  activeStatus,
  syncEnabled,
  errorCount,
  entryFile,
  statusMessage,
  designMode,
  interceptedCount,
  heldCount,
  sessionProfile,
  blockedTrackers,
  workspaceName,
  mode,
  profileName,
  onOpenShellDevTools,
  onOpenGuestDevTools
}: StatusBarProps) {
  const dev = mode === 'dev'

  return (
    <footer
      data-mode={mode}
      className="nova-glass flex h-9 shrink-0 items-center gap-4 border-t px-3 text-[11px] text-ink-500"
    >
      {/* The mode banner follows the same workspace finish in both modes. */}
      <span
        data-testid="mode-indicator"
        className="flex shrink-0 items-center gap-1.5 text-[var(--devlens-accent)]"
      >
        {dev ? 'dev mode - full tooling' : 'Normal Mode (Max Privacy & Immersion)'}
      </span>

      <span data-status-secondary className="flex items-center gap-1.5">
        <span className="text-neutral-600">profile</span>
        <span className="text-neutral-400">{profileName}</span>
      </span>

      <span className="flex items-center gap-1.5">
        <span
          className={[
            'h-1.5 w-1.5 rounded-full',
            activeStatus.phase === 'failed'
              ? 'bg-rose-400'
              : activeStatus.isLoading
                ? 'animate-pulse bg-amber-400'
                : 'bg-[var(--devlens-accent)]'
          ].join(' ')}
        />
        {activeStatus.phase === 'idle' && !activeStatus.url ? (
          <span className="text-neutral-400">no page loaded</span>
        ) : (
          <>
            <span className="font-mono text-neutral-400">{activeView}</span>
            <span>{activeStatus.phase}</span>
          </>
        )}
      </span>

      {/* Monitoring counters only exist in dev mode. */}
      {dev && (
        <span data-status-secondary className="flex items-center gap-1.5">
          <span className="text-neutral-600">sync</span>
          <span className={syncEnabled ? 'text-[var(--devlens-accent)]' : 'text-neutral-500'}>
            {syncEnabled ? 'on' : 'off'}
          </span>
        </span>
      )}

      {dev && (
        <span data-status-secondary className="flex items-center gap-1.5">
          <span className="text-neutral-600">issues</span>
          <span className={errorCount > 0 ? 'text-rose-300' : 'text-neutral-400'}>{errorCount}</span>
        </span>
      )}

      {dev && (
        <span data-status-secondary className="flex items-center gap-1.5">
          <span className="text-neutral-600">captured</span>
          <span className="text-neutral-400">{interceptedCount}</span>
          {heldCount > 0 && <span className="text-amber-300">{heldCount} held</span>}
        </span>
      )}

      {designMode && <span className="text-[var(--devlens-accent)]">design mode</span>}

      {sessionProfile === 'ghost' && (
        <span className="flex items-center gap-1.5">
          <span className="text-violet-300">ghost</span>
          <span className="text-neutral-500">{blockedTrackers} blocked</span>
        </span>
      )}

      {sessionProfile === 'wimh' && (
        <span className="flex items-center gap-1.5">
          <span className="text-violet-300">extreme defense</span>
          <span className="text-neutral-500">{blockedTrackers} blocked</span>
        </span>
      )}

      {/* The workspace path is developer context, so it lives in dev mode only. */}
      {dev && (
        <span data-status-secondary className="flex min-w-0 items-center gap-1.5">
          <span className="text-neutral-600">workspace</span>
          <span className="truncate font-mono text-neutral-400">{workspaceName}</span>
          <span className="truncate font-mono text-neutral-600">{tailPath(entryFile, 3)}</span>
        </span>
      )}

      <span className="ml-auto flex min-w-0 items-center gap-2">
        {statusMessage && (
          <span className="truncate font-mono text-[var(--devlens-accent)]">{statusMessage}</span>
        )}
        {dev && (
          <>
            <IconButton
              label="Open DevLens Developer Tools"
              onClick={onOpenShellDevTools}
            >
              <Bug size={13} />
            </IconButton>
            <IconButton
              label={`Open DevTools for the ${activeView} viewport`}
              onClick={onOpenGuestDevTools}
            >
              <SquareTerminal size={13} />
            </IconButton>
          </>
        )}
      </span>
    </footer>
  )
}
