import { useState } from 'react'
import { Boxes, Folder, FolderPlus, X } from 'lucide-react'
import type { WorkspaceEntry } from '@shared/types'
import { Widget, WidgetAction } from '@renderer/components/dashboard/Widget'

interface WorkspacesWidgetProps {
  workspaces: WorkspaceEntry[]
  onAdd: () => void
  onAddPath: (path: string) => void
  onRemove: (path: string) => void
  onActivate: (path: string) => void
  onOpenInIde: (path: string) => void
}

/**
 * Workspaces.
 *
 * Handing a folder to an editor is developer tooling rather than browsing, so the dashboard only
 * draws this card in dev mode - the shell decides that, not the widget, which simply renders the
 * list it is given. The active one is the root click-to-source resolves inside.
 */
export function WorkspacesWidget({
  workspaces,
  onAdd,
  onAddPath,
  onRemove,
  onActivate,
  onOpenInIde
}: WorkspacesWidgetProps) {
  const [draft, setDraft] = useState('')

  const submit = (): void => {
    const value = draft.trim()
    if (!value) return
    onAddPath(value)
    setDraft('')
  }

  return (
    <Widget
      icon={Boxes}
      title="Workspaces"
      note="click-to-source resolves inside the active one"
      action={
        <WidgetAction label="Add workspace folder" onClick={onAdd}>
          <FolderPlus size={11} />
          add folder
        </WidgetAction>
      }
    >
      <div className="flex flex-col gap-1.5">
        {workspaces.map((workspace) => (
          <div
            key={workspace.path}
            className={[
              'nova-card flex min-w-0 flex-col gap-1 px-2.5 py-1.5',
              workspace.active ? 'nova-card--active' : ''
            ].join(' ')}
          >
            <div className="flex items-center gap-1.5">
              <Folder
                size={11}
                className={workspace.active ? 'text-[var(--devlens-accent)]' : 'text-ink-500'}
              />
              <span className="min-w-0 flex-1 truncate text-[11px] text-ink-200">
                {workspace.packageName ?? workspace.name}
              </span>
              {workspace.framework && (
                <span className="shrink-0 rounded bg-white/5 px-1 font-mono text-[9px] text-ink-400">
                  {workspace.framework}
                </span>
              )}
              <button
                type="button"
                title="Remove from the list"
                aria-label={`Remove ${workspace.name}`}
                onClick={() => onRemove(workspace.path)}
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-ink-600 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
              >
                <X size={9} />
              </button>
            </div>
            <p className="truncate font-mono text-[9px] text-ink-600" title={workspace.path}>
              {workspace.path}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onActivate(workspace.path)}
                className={[
                  'rounded border px-1.5 py-0.5 text-[10px] transition-colors',
                  workspace.active
                    ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-ink-100'
                    : 'border-[var(--devlens-hairline)] text-ink-300 hover:bg-white/5'
                ].join(' ')}
              >
                {workspace.active ? 'active' : 'set active'}
              </button>
              <button
                type="button"
                onClick={() => onOpenInIde(workspace.path)}
                className="rounded border border-[var(--devlens-hairline)] px-1.5 py-0.5 text-[10px] text-ink-300 transition-colors hover:border-[var(--devlens-accent-line)] hover:text-ink-100"
              >
                open in editor
              </button>
            </div>
          </div>
        ))}

        {workspaces.length === 0 && (
          <p className="rounded border border-dashed border-[var(--devlens-hairline)] px-3 py-3 text-center font-mono text-[10px] text-ink-600">
            no workspace yet - add a folder to hand files to the editor
          </p>
        )}

        <div className="flex items-center gap-1.5">
          <input
            value={draft}
            spellCheck={false}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
            placeholder="C:\projects\my-app"
            aria-label="Workspace path"
            className="h-7 min-w-0 flex-1 rounded border border-[var(--devlens-hairline)] bg-ink-950/70 px-2 font-mono text-[10px] text-ink-200 outline-none placeholder:text-ink-600 focus:border-[var(--devlens-accent-line)]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim()}
            className="rounded border border-[var(--devlens-hairline)] px-2 py-1 text-[10px] text-ink-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            add path
          </button>
        </div>
      </div>
    </Widget>
  )
}
