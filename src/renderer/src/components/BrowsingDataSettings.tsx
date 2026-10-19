import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ShieldOff, Trash2, X } from 'lucide-react'
import type {
  ClearBrowsingDataRequest,
  ClearBrowsingDataResult,
  HistoryPolicy,
  PrivacyPreferences,
  ProfileDiskUsage,
  RetentionPeriod
} from '@shared/privacy'

interface BrowsingDataSettingsProps {
  privacy: PrivacyPreferences
  diskUsage: ProfileDiskUsage
  onPrivacy: (patch: Partial<PrivacyPreferences>) => void
  onHistoryPolicy: (policy: HistoryPolicy) => void
  onClearBrowsingData: (request: ClearBrowsingDataRequest) => Promise<ClearBrowsingDataResult>
  onRunCleanup: () => void
  onRefreshUsage: () => void
}

const EXPIRY_OPTIONS: { value: RetentionPeriod; label: string }[] = [
  { value: 'forever', label: 'Keep Indefinitely' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'on-close', label: 'On Close' }
]

const HISTORY_POLICIES: { value: HistoryPolicy; label: string; detail: string }[] = [
  {
    value: 'remember',
    label: 'Remember history',
    detail: 'Keep visits until an expiration rule removes older entries.'
  },
  {
    value: 'never',
    label: 'Never remember history',
    detail: 'Stop writing history and clear existing history immediately.'
  },
  {
    value: 'pinned',
    label: 'Custom history (Keep Pinned Tabs Only)',
    detail: 'On close, keep history and site data only for pinned tab origins.'
  }
]

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function BrowsingDataSettingsContent({
  privacy,
  diskUsage,
  onPrivacy,
  onHistoryPolicy,
  onClearBrowsingData,
  onRunCleanup,
  onRefreshUsage
}: BrowsingDataSettingsProps) {
  const [clearOpen, setClearOpen] = useState(false)
  const [exceptionsOpen, setExceptionsOpen] = useState(false)
  const [exceptionDraft, setExceptionDraft] = useState('')
  const [clearBusy, setClearBusy] = useState(false)
  const [clearError, setClearError] = useState('')
  const [selection, setSelection] = useState<ClearBrowsingDataRequest>({
    cookies: true,
    cache: true,
    history: true,
    storage: true
  })

  const usageLabel = formatBytes(diskUsage.bytes)
  const exceptionHosts = useMemo(
    () => new Set(privacy.browsingDataExceptions.map((host) => host.toLowerCase())),
    [privacy.browsingDataExceptions]
  )

  const changeRetention = (patch: Partial<PrivacyPreferences>): void => {
    onPrivacy(patch)
    onRunCleanup()
  }

  const addException = (): void => {
    const host = exceptionDraft.trim().toLowerCase()
    if (!host || exceptionHosts.has(host)) return
    onPrivacy({
      browsingDataExceptions: [...privacy.browsingDataExceptions, host].slice(0, 50)
    })
    setExceptionDraft('')
  }

  const clearSelected = async (): Promise<void> => {
    if (!Object.values(selection).some(Boolean)) return
    setClearBusy(true)
    setClearError('')
    try {
      const result = await onClearBrowsingData(selection)
      if (!result.ok) {
        setClearError(result.error ?? 'Could not clear the selected browsing data.')
        return
      }
      onRefreshUsage()
      setClearOpen(false)
    } catch (error) {
      setClearError(error instanceof Error ? error.message : String(error))
    } finally {
      setClearBusy(false)
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-[var(--devlens-hairline)] bg-white/[0.018]">
        <div className="border-b border-[var(--devlens-hairline)] px-4 py-3">
          <h3 className="text-[12px] font-medium text-ink-100">Browsing Data &amp; History Retention</h3>
          <p className="mt-0.5 text-[10px] leading-4 text-ink-500">
            Control storage, cleanup rules and how pinned tabs survive a restart.
          </p>
        </div>
        <div className="divide-y divide-white/[0.05] px-4">
          <div className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--devlens-hairline)] bg-black/20 text-[var(--devlens-accent)]">
                  <ShieldOff size={17} />
                </span>
                <div>
                  <p data-testid="privacy-disk-usage" className="font-mono text-[18px] leading-5 text-ink-100">
                    {usageLabel}
                  </p>
                  <p className="text-[10px] text-ink-500">
                    Site data and cache for this profile
                    {diskUsage.cacheBytes ? ` · ${formatBytes(diskUsage.cacheBytes)} cache` : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="privacy-clear-browsing-data"
                  onClick={() => {
                    setClearError('')
                    setClearOpen(true)
                  }}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-[10px] text-ink-200 hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-200"
                >
                  <Trash2 size={12} />
                  Clear Browsing Data
                </button>
                <button
                  type="button"
                  data-testid="privacy-manage-exceptions"
                  onClick={() => setExceptionsOpen(true)}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--devlens-hairline)] px-2.5 text-[10px] text-ink-200 hover:border-[var(--devlens-accent-line)]"
                >
                  Manage Exceptions
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 rounded-md border border-[var(--devlens-hairline)] px-3 py-2.5">
              <div>
                <p className="text-[11px] text-ink-200">Auto-Clear on Exit</p>
                <p className="mt-0.5 text-[10px] text-ink-500">Clear cookies and site data when DevLens closes.</p>
              </div>
              <Toggle
                testId="privacy-auto-clear-on-exit"
                checked={privacy.autoClearOnExit}
                onChange={(checked) => changeRetention({ autoClearOnExit: checked })}
              />
            </div>
          </div>

          <div className="py-4">
            <p className="text-[11px] text-ink-200">History Policies</p>
            <p className="mt-0.5 text-[10px] text-ink-500">Choose what DevLens may remember between sessions.</p>
            <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="History policies">
              {HISTORY_POLICIES.map((policy) => {
                const selected = privacy.historyPolicy === policy.value
                return (
                  <label
                    key={policy.value}
                    className={[
                      'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5',
                      selected
                        ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                        : 'border-[var(--devlens-hairline)] hover:bg-white/[0.025]'
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="history-policy"
                      value={policy.value}
                      checked={selected}
                      data-testid={`privacy-history-policy-${policy.value}`}
                      onChange={() => onHistoryPolicy(policy.value)}
                      className="mt-0.5 accent-[var(--devlens-accent)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[11px] text-ink-200">{policy.label}</span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-ink-500">{policy.detail}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="py-4">
            <p className="text-[11px] text-ink-200">Auto-Delete Expiration</p>
            <p className="mt-0.5 text-[10px] text-ink-500">
              Each data type can expire independently. On Close runs when DevLens exits.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <ExpirySelect
                label="Cookies & site data"
                testId="privacy-cookie-expiry"
                value={privacy.cookieExpiry}
                onChange={(cookieExpiry) => changeRetention({ cookieExpiry })}
              />
              <ExpirySelect
                label="History"
                testId="privacy-history-expiry"
                value={privacy.historyExpiry}
                onChange={(historyExpiry) => changeRetention({ historyExpiry })}
              />
              <ExpirySelect
                label="Cache"
                testId="privacy-cache-expiry"
                value={privacy.cacheExpiry}
                onChange={(cacheExpiry) => changeRetention({ cacheExpiry })}
              />
            </div>
          </div>
        </div>
      </section>

      {clearOpen && createPortal(
        <Modal title="Clear Browsing Data" onClose={() => setClearOpen(false)}>
          <p className="text-[11px] leading-5 text-ink-400">
            Choose what to remove from this profile. Exceptions in Manage Exceptions are preserved.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {([
              ['cookies', 'Cookies'],
              ['cache', 'Cached files'],
              ['history', 'Browsing history'],
              ['storage', 'Site storage']
            ] as const).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2.5 rounded-md border border-[var(--devlens-hairline)] px-3 py-2 text-[11px] text-ink-200">
                <input
                  type="checkbox"
                  checked={selection[key]}
                  data-testid={`privacy-clear-${key}`}
                  onChange={(event) =>
                    setSelection((current) => ({ ...current, [key]: event.target.checked }))
                  }
                  className="accent-[var(--devlens-accent)]"
                />
                {label}
              </label>
            ))}
          </div>
          {clearError && <p role="alert" className="mt-3 text-[10px] text-rose-300">{clearError}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setClearOpen(false)} className="rounded-md border border-[var(--devlens-hairline)] px-3 py-2 text-[10px] text-ink-300">
              Cancel
            </button>
            <button
              type="button"
              data-testid="privacy-clear-confirm"
              disabled={clearBusy || !Object.values(selection).some(Boolean)}
              onClick={() => void clearSelected()}
              className="rounded-md bg-rose-400 px-3 py-2 text-[10px] font-medium text-ink-950 disabled:opacity-40"
            >
              {clearBusy ? 'Clearing…' : 'Clear selected data'}
            </button>
          </div>
        </Modal>,
        document.body
      )}

      {exceptionsOpen && createPortal(
        <Modal title="Browsing Data Exceptions" onClose={() => setExceptionsOpen(false)}>
          <p className="text-[11px] leading-5 text-ink-400">
            These sites keep cookies and site data when cleanup runs.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              value={exceptionDraft}
              onChange={(event) => setExceptionDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addException()
                }
              }}
              placeholder="example.com"
              aria-label="Add browsing data exception"
              data-testid="privacy-browsing-exception-input"
              className="h-8 min-w-0 flex-1 rounded-md border border-[var(--devlens-hairline)] bg-black/20 px-2.5 font-mono text-[10px] text-ink-200 outline-none focus:border-[var(--devlens-accent-line)]"
            />
            <button type="button" data-testid="privacy-browsing-exception-add" onClick={addException} disabled={!exceptionDraft.trim()} className="rounded-md border border-[var(--devlens-hairline)] px-3 text-[10px] text-ink-200 disabled:opacity-40">
              Add
            </button>
          </div>
          <ul className="mt-3 flex flex-col divide-y divide-white/[0.05] rounded-md border border-[var(--devlens-hairline)] px-3">
            {privacy.browsingDataExceptions.map((host) => (
              <li key={host} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-200">{host}</span>
                <button
                  type="button"
                  aria-label={`Remove browsing data exception for ${host}`}
                  onClick={() =>
                    onPrivacy({
                      browsingDataExceptions: privacy.browsingDataExceptions.filter((entry) => entry !== host)
                    })
                  }
                  className="flex h-6 w-6 items-center justify-center rounded text-ink-500 hover:bg-rose-400/10 hover:text-rose-300"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
            {privacy.browsingDataExceptions.length === 0 && (
              <li className="py-3 text-[10px] text-ink-600">No browsing data exceptions.</li>
            )}
          </ul>
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={() => setExceptionsOpen(false)} className="rounded-md bg-[var(--devlens-accent)] px-3 py-2 text-[10px] font-medium text-ink-950">
              Done
            </button>
          </div>
        </Modal>,
        document.body
      )}
    </>
  )
}

function ExpirySelect({
  label,
  testId,
  value,
  onChange
}: {
  label: string
  testId: string
  value: RetentionPeriod
  onChange: (value: RetentionPeriod) => void
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[10px] text-ink-400">
      {label}
      <select
        data-testid={testId}
        value={value}
        onChange={(event) => onChange(event.target.value as RetentionPeriod)}
        className="h-8 rounded-md border border-[var(--devlens-hairline)] bg-ink-900 px-2.5 text-[10px] text-ink-200 outline-none focus:border-[var(--devlens-accent-line)]"
      >
        {EXPIRY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function Toggle({
  checked,
  testId,
  onChange
}: {
  checked: boolean
  testId: string
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={[
        'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
        checked
          ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent)]'
          : 'border-white/15 bg-ink-700'
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'absolute top-0.5 h-3.5 w-3.5 rounded-full transition-transform',
          checked ? 'translate-x-[17px] bg-ink-950' : 'translate-x-0.5 bg-ink-200'
        ].join(' ')}
      />
    </button>
  )
}

function Modal({
  title,
  onClose,
  children
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-[460px] rounded-xl border border-white/10 bg-ink-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[17px] font-semibold text-ink-100">{title}</h2>
          <button type="button" aria-label={`Close ${title}`} onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-ink-500 hover:bg-white/5 hover:text-ink-100">
            <X size={15} />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}
