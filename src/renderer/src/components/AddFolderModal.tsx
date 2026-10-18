import { useEffect, useRef, useState } from 'react'
import { FolderPlus, X } from 'lucide-react'

export interface FolderChoice {
  /** A root id ('toolbar', 'menu', 'other') or a folder id. */
  id: string
  label: string
}

interface AddFolderModalProps {
  /** The folder being renamed, or null when a new one is being created. */
  folder: { id: string; title: string } | null
  /** Where the new folder goes; ignored when renaming. */
  location: string
  /** Everywhere a folder can be put: the three roots and the folders that already exist. */
  choices: FolderChoice[]
  onSave: (values: { title: string; location: string }) => void
  onCancel: () => void
}

/**
 * Create or rename a folder.
 *
 * The same panel for both, because they ask the same question and differ only in which half of
 * it is answerable: a folder that exists can be renamed but not moved into itself, and a new one
 * needs somewhere to live. Escape and Cancel leave everything as it was.
 */
export function AddFolderModal({ folder, location, choices, onSave, onCancel }: AddFolderModalProps) {
  const [title, setTitle] = useState(folder?.title ?? '')
  const [target, setTarget] = useState(location)
  const nameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  const save = (): void => {
    const name = title.trim() || 'New folder'
    onSave({ title: name, location: target })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCancel()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        save()
      }
    }
    const onPointerDown = (event: PointerEvent): void => {
      const element = event.target as HTMLElement | null
      if (element?.closest('[data-testid="add-folder-modal"]')) return
      onCancel()
    }
    window.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  })

  return (
    <div
      role="dialog"
      aria-label={folder ? 'Rename folder' : 'Add folder'}
      data-testid="add-folder-modal"
      className="absolute top-[calc(100%+8px)] right-3 z-[70] w-[300px] overflow-hidden rounded-xl border border-[var(--devlens-hairline)] bg-[color-mix(in_srgb,var(--color-ink-950)_97%,transparent)] shadow-2xl"
    >
      <header className="flex items-center gap-2 border-b border-[var(--devlens-hairline)] px-3 py-2">
        <FolderPlus size={13} className="shrink-0 text-[var(--devlens-accent)]" />
        <span className="min-w-0 flex-1 text-[12px] text-ink-100">
          {folder ? 'Rename folder' : 'Add folder'}
        </span>
        <button
          type="button"
          aria-label="Close folder editor"
          onClick={onCancel}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-500 transition-colors hover:bg-white/5 hover:text-ink-200"
        >
          <X size={12} />
        </button>
      </header>

      <div className="space-y-2 px-3 py-2.5">
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] tracking-wide text-ink-500 uppercase">
            Name
          </span>
          <input
            ref={nameRef}
            data-testid="folder-name"
            aria-label="Folder name"
            value={title}
            spellCheck={false}
            onChange={(event) => setTitle(event.target.value)}
            className="h-7 w-full rounded-md border border-[var(--devlens-hairline)] bg-ink-900/70 px-2 text-[11px] text-ink-100 outline-none focus:border-[var(--devlens-accent-line)]"
          />
        </label>

        {!folder && (
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] tracking-wide text-ink-500 uppercase">
              Location
            </span>
            <select
              data-testid="folder-location"
              aria-label="Folder location"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              className="h-7 w-full rounded-md border border-[var(--devlens-hairline)] bg-ink-900/70 px-1.5 text-[11px] text-ink-200 outline-none focus:border-[var(--devlens-accent-line)]"
            >
              {choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-[var(--devlens-hairline)] px-3 py-2">
        <button
          type="button"
          data-testid="folder-save"
          aria-label={folder ? 'Save folder name' : 'Create folder'}
          onClick={save}
          className="inline-flex h-7 items-center rounded-md border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-2.5 text-[11px] text-[var(--devlens-accent)]"
        >
          {folder ? 'Save' : 'Create'}
        </button>
        <button
          type="button"
          data-testid="folder-cancel"
          aria-label="Cancel folder"
          onClick={onCancel}
          className="inline-flex h-7 items-center rounded-md border border-[var(--devlens-hairline)] px-2.5 text-[11px] text-ink-300 hover:bg-white/5"
        >
          Cancel
        </button>
      </footer>
    </div>
  )
}
