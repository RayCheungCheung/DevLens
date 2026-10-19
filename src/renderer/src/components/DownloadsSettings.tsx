import { useEffect, useState, type ReactNode } from 'react'
import { Download, FolderOpen, Plus, Search, Trash2 } from 'lucide-react'
import {
  actionsForContentType,
  BUILTIN_CONTENT_TYPES,
  normalizeContentType,
  type DownloadPreferences,
  type DownloadPreferencesPatch,
  type FileHandlerAction
} from '@shared/downloads'

interface DownloadsSettingsProps {
  preferences: DownloadPreferences
  onChange: (patch: DownloadPreferencesPatch) => void
}

const builtinTypes = new Set<string>(BUILTIN_CONTENT_TYPES.map(({ type }) => type))
const inputClass = 'h-8 min-w-0 rounded-md border border-[var(--devlens-hairline)] bg-ink-900 px-2.5 text-[11px] text-ink-200 outline-none focus:border-[var(--devlens-accent-line)]'
const buttonClass = 'flex items-center justify-center gap-1.5 rounded-md border border-[var(--devlens-hairline)] px-3 py-2 text-[10px] text-ink-200 hover:border-[var(--devlens-accent-line)] disabled:opacity-40'

export function DownloadsSettingsContent({ preferences, onChange }: DownloadsSettingsProps) {
  const [defaultDirectory, setDefaultDirectory] = useState('System Downloads folder')
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const [typeDraft, setTypeDraft] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void window.devlens.downloadsDefaultDirectory().then((directory) => {
      if (!cancelled) setDefaultDirectory(directory)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  const chooseDirectory = async (): Promise<void> => {
    setPicking(true)
    setError('')
    try {
      await window.devlens.downloadsPickDirectory()
    } catch {
      setError('Could not choose a download folder. Please try again.')
    } finally {
      setPicking(false)
    }
  }

  const addHandler = (): void => {
    const type = normalizeContentType(typeDraft)
    if (!type) { setError('Enter a MIME type such as application/json or an external protocol such as zoommtg.'); return }
    if (Object.hasOwn(preferences.handlers, type)) { setError('This content type already has a handler. Change its action in the list.'); return }
    if (Object.keys(preferences.handlers).length >= 100) { setError('The handler list is limited to 100 content types. Remove a custom entry first.'); return }
    onChange({ handlers: { [type]: 'ask' } })
    setTypeDraft('')
    setQuery('')
    setError('')
  }

  const entries = Object.entries(preferences.handlers).filter(([type]) => {
    const label = BUILTIN_CONTENT_TYPES.find((entry) => entry.type === type)?.label ?? type
    return `${type} ${label}`.toLowerCase().includes(query.trim().toLowerCase())
  })

  return (
    <div className="flex flex-col gap-4" data-testid="downloads-settings">
      <Card title="Default Download Behavior" detail="Choose where files are saved and when DevLens asks first.">
        <label htmlFor="download-location" className="text-[11px] text-ink-200">Download Location</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input id="download-location" data-testid="download-location" readOnly
            value={preferences.directory || defaultDirectory}
            className={`${inputClass} min-w-[160px] flex-1 font-mono text-[10px]`} />
          <button type="button" onClick={() => void chooseDirectory()} disabled={picking} className={buttonClass}>
            <FolderOpen size={12} />{picking ? 'Choosing…' : 'Save files to…'}
          </button>
          {preferences.directory && <button type="button" className={buttonClass} onClick={() => onChange({ directory: '' })}>Use system default</button>}
        </div>
        <div className="mt-4 divide-y divide-white/[0.05]">
          <Toggle label="Ask where to save files before downloading" detail="Show a Save As dialog whenever a file is saved."
            checked={preferences.promptBeforeDownload} testId="downloads-prompt"
            onChange={(checked) => onChange({ promptBeforeDownload: checked })} />
          <Toggle label="Delete private window downloads on close" detail="Remove download history when a private tab or window closes. Downloaded files are kept."
            checked={preferences.deletePrivateHistoryOnClose} testId="downloads-private-cleanup"
            onChange={(checked) => onChange({ deletePrivateHistoryOnClose: checked })} />
        </div>
        <p className="mt-3 text-[10px] leading-4 text-ink-500">Max Protection private tabs and windows continue to block downloads.</p>
      </Card>

      <Card title="Dev Protocol & File Handlers (Content Types)" detail="Set the default action for each MIME type or external protocol.">
        <label className="mb-3 flex items-center gap-2">
          <Search size={12} className="text-ink-500" />
          <input aria-label="Filter content types" placeholder="Search content types or protocols" value={query}
            onChange={(event) => setQuery(event.target.value)} className={`${inputClass} flex-1`} />
        </label>
        <div className="overflow-x-auto rounded-md border border-[var(--devlens-hairline)]">
          <table className="w-full min-w-[480px] border-collapse text-left text-[10px]">
            <thead className="bg-white/[0.025] text-ink-500">
              <tr><th scope="col" className="px-3 py-2 font-medium">Content Type / Protocol</th><th scope="col" className="px-3 py-2 font-medium">Action</th><th scope="col" className="w-9"><span className="sr-only">Remove</span></th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {entries.map(([type, action]) => {
                const label = BUILTIN_CONTENT_TYPES.find((entry) => entry.type === type)?.label ?? type
                return (
                  <tr key={type} data-content-type={type}>
                    <td className="px-3 py-2.5">
                      <span className="block text-[11px] text-ink-200">{label}</span>
                      <span className="mt-0.5 block break-all font-mono text-[9px] text-ink-500">{type.includes('/') ? type : `${type}: protocol`}</span>
                    </td>
                    <td className="px-3 py-2">
                      <select aria-label={`Action for ${type}`} value={action} className={`${inputClass} w-full`}
                        onChange={(event) => onChange({ handlers: { [type]: event.target.value as FileHandlerAction } })}>
                        {actionsForContentType(type).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </td>
                    <td className="pr-2">
                      {!builtinTypes.has(type) && <button type="button" aria-label={`Remove ${type}`} onClick={() => onChange({ handlers: { [type]: null } })}
                        className="rounded p-1.5 text-ink-500 hover:bg-white/5 hover:text-rose-300"><Trash2 size={12} /></button>}
                    </td>
                  </tr>
                )
              })}
              {entries.length === 0 && <tr><td colSpan={3} className="px-3 py-5 text-center text-ink-500">No matching content types.</td></tr>}
            </tbody>
          </table>
        </div>
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); addHandler() }}>
          <input aria-label="New MIME type or protocol" placeholder="application/json or myapp:" value={typeDraft}
            onChange={(event) => setTypeDraft(event.target.value)} className={`${inputClass} min-w-[160px] flex-1`} />
          <button type="submit" className={buttonClass}><Plus size={12} />Add content type</button>
        </form>
        <p className="mt-3 text-[10px] leading-4 text-ink-500">
          Built-in viewing is available for supported document and image types. Protocols use a registered system app.
          Opening an external app requires confirmation.
        </p>
      </Card>

      <Card title="Fallback Handling for Unhandled Types" detail="Choose what happens when a downloaded file has no matching content type entry.">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Unhandled file types</legend>
          {([
            { value: 'save', label: 'Automatically save files' },
            { value: 'ask', label: 'Ask to open or save files' }
          ] as const).map(({ value, label }) => (
            <label key={value} className="flex cursor-pointer items-center gap-2.5 rounded-md border border-[var(--devlens-hairline)] px-3 py-2.5 text-[11px] text-ink-200 focus-within:ring-2 focus-within:ring-[var(--devlens-accent)]">
              <input type="radio" name="unhandled-download-action" value={value} checked={preferences.unhandledAction === value}
                onChange={() => onChange({ unhandledAction: value })} className="accent-[var(--devlens-accent)]" />
              {value === 'save' && <Download size={12} className="text-ink-500" />}{label}
            </label>
          ))}
        </fieldset>
      </Card>
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
    </div>
  )
}

function Card({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--devlens-hairline)] bg-white/[0.018]">
      <div className="border-b border-[var(--devlens-hairline)] px-4 py-3">
        <h3 className="text-[12px] font-medium text-ink-100">{title}</h3>
        <p className="mt-0.5 text-[10px] leading-4 text-ink-500">{detail}</p>
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  )
}

function Toggle({ label, detail, checked, testId, onChange }: { label: string; detail: string; checked: boolean; testId: string; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0"><p className="text-[11px] text-ink-200">{label}</p><p className="mt-0.5 text-[10px] leading-4 text-ink-500">{detail}</p></div>
      <button type="button" role="switch" aria-label={label} aria-checked={checked} data-testid={testId} onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${checked ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent)]' : 'border-white/15 bg-ink-700'}`}>
        <span aria-hidden="true" className={`absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full transition-transform ${checked ? 'translate-x-4 bg-ink-950' : 'bg-ink-200'}`} />
      </button>
    </div>
  )
}
