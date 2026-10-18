import { useMemo, useState } from 'react'
import { ClipboardCopy, FileJson, FileText, Save } from 'lucide-react'
import type { ReconSnapshot } from '@shared/recon'
import { DEFAULT_REPORT_OPTIONS, renderJson, renderMarkdown, type ReportOptions } from '@shared/report'
import type { ReportFormat } from '@shared/types'

interface ReconPanelProps {
  snapshot: ReconSnapshot
  outputDir: string | null
  onNotice: (message: string) => void
}

const SECTION_KEYS: { key: keyof ReportOptions; label: string }[] = [
  { key: 'includeSummary', label: 'Summary' },
  { key: 'includeHosts', label: 'Hosts' },
  { key: 'includeEndpoints', label: 'Endpoints' },
  { key: 'includeAssets', label: 'Assets' },
  { key: 'includeFailures', label: 'Failures' },
  { key: 'includeConsole', label: 'Console' },
  { key: 'includeRules', label: 'Rules' },
  { key: 'includeDesign', label: 'Design' },
  { key: 'includeRequests', label: 'Request log' }
]

/**
 * Recon and reporting.
 *
 * The inventory is derived from what the interceptor captured (hosts, endpoints, query
 * parameter names, failures) plus the console stream, and can leave the app as Markdown
 * or JSON - either through a save dialog or straight into `report.outputDir`.
 */
export function ReconPanel({ snapshot, outputDir, onNotice }: ReconPanelProps) {
  const [format, setFormat] = useState<ReportFormat>('markdown')
  const [options, setOptions] = useState<ReportOptions>(DEFAULT_REPORT_OPTIONS)
  const [saving, setSaving] = useState(false)

  const document = useMemo(
    () => (format === 'markdown' ? renderMarkdown(snapshot, options) : renderJson(snapshot, options)),
    [format, options, snapshot]
  )

  const filename = `devlens-recon-${new Date(snapshot.generatedAt)
    .toISOString()
    .replace(/[:.]/g, '-')}.${format === 'markdown' ? 'md' : 'json'}`

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      const result = await window.devlens.saveTextFile({
        filename,
        content: document,
        title: 'Save DevLens recon report'
      })
      if (result.cancelled) onNotice('report cancelled')
      else if (result.ok) onNotice(`saved ${result.path}`)
      else onNotice(result.error ?? 'could not save the report')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 border-b border-white/5 px-3 py-2">
        <div className="grid grid-cols-3 gap-1.5">
          <Stat label="hosts" value={snapshot.totals.hosts} />
          <Stat label="endpoints" value={snapshot.totals.endpoints} />
          <Stat label="requests" value={snapshot.totals.requests} />
          <Stat label="failures" value={snapshot.totals.failures} tone={snapshot.totals.failures > 0 ? 'warn' : 'normal'} />
          <Stat label="blocked" value={snapshot.totals.blocked} tone={snapshot.totals.blocked > 0 ? 'danger' : 'normal'} />
          <Stat label="console errors" value={snapshot.totals.consoleErrors} tone={snapshot.totals.consoleErrors > 0 ? 'warn' : 'normal'} />
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex rounded-md border border-white/10 p-0.5">
            {(['markdown', 'json'] as ReportFormat[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFormat(option)}
                className={[
                  'inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] transition-colors',
                  format === option ? 'bg-white/10 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
                ].join(' ')}
              >
                {option === 'markdown' ? <FileText size={10} /> : <FileJson size={10} />}
                {option}
              </button>
            ))}
          </div>
          <span className="font-mono text-[10px] text-neutral-600">
            {document.length.toLocaleString()} chars
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {SECTION_KEYS.map((section) => (
            <button
              key={section.key}
              type="button"
              aria-pressed={options[section.key]}
              onClick={() =>
                setOptions((current) => ({ ...current, [section.key]: !current[section.key] }))
              }
              className={[
                'rounded border px-1.5 py-0.5 text-[10px] transition-colors',
                options[section.key]
                  ? 'border-teal-400/40 bg-teal-400/10 text-teal-100'
                  : 'border-white/10 text-neutral-500 hover:text-neutral-300'
              ].join(' ')}
            >
              {section.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md border border-teal-400/40 bg-teal-400/10 px-2 py-1 text-[10px] text-teal-100 transition-colors hover:bg-teal-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-neutral-600"
          >
            <Save size={11} />
            {saving ? 'Saving' : 'Save report'}
          </button>
          <button
            type="button"
            onClick={() => {
              void window.devlens.clipboardWrite(document)
              onNotice('report copied')
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[10px] text-neutral-300 transition-colors hover:bg-white/5 hover:text-neutral-100"
          >
            <ClipboardCopy size={11} />
            Copy
          </button>
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-neutral-600">
            {outputDir ? `-> ${outputDir}` : 'save dialog'}
          </span>
        </div>
      </div>

      {snapshot.findings.length > 0 && (
        <div className="shrink-0 space-y-1 border-b border-white/5 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Observations</p>
          {snapshot.findings.map((finding) => (
            <p key={finding.title} className="text-[10px] leading-4 text-neutral-400">
              <span className={SEVERITY_TONES[finding.severity]}>{finding.severity}</span>{' '}
              <span className="text-neutral-300">{finding.title}</span> - {finding.detail}
            </p>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-950/40 p-3">
        <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-neutral-400">
          {document}
        </pre>
      </div>
    </div>
  )
}

const SEVERITY_TONES: Record<string, string> = {
  info: 'text-sky-300',
  low: 'text-amber-300',
  medium: 'text-rose-300'
}

interface StatProps {
  label: string
  value: number
  tone?: 'normal' | 'warn' | 'danger'
}

function Stat({ label, value, tone = 'normal' }: StatProps) {
  const toneClass =
    tone === 'danger' ? 'text-rose-300' : tone === 'warn' ? 'text-amber-300' : 'text-neutral-200'

  return (
    <div className="rounded border border-white/10 bg-neutral-950/50 px-1.5 py-1">
      <p className={['font-mono text-[13px] leading-4', toneClass].join(' ')}>{value}</p>
      <p className="truncate text-[9px] uppercase tracking-wide text-neutral-600">{label}</p>
    </div>
  )
}
