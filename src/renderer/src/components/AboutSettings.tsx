import { useEffect, useState, type ReactNode } from 'react'
import {
  CheckCircle2,
  Copy,
  Info,
  ChevronRight,
  ScrollText
} from 'lucide-react'
import { ABOUT_LINKS } from '@shared/about'
import type { AboutPreferences } from '@shared/preferences'
import { DevLensMark } from './DevLensMark'
import { LensyMascot } from './LensyMascot'
import type {
  AboutInfo,
  UpdateChannel,
  UpdateStrategy
} from '@shared/types'

interface AboutSettingsProps {
  /** The system and version info, fetched once from main on mount. */
  aboutInfo: AboutInfo | null
  preferences: AboutPreferences
  /** Called when the operator changes the update channel or strategy. */
  onAboutChange: (patch: Partial<{ updateChannel: UpdateChannel; updateStrategy: UpdateStrategy }>) => void
  /** Opens a `devlens:` route as a tab (e.g. the changelog). */
  onOpenRoute: (url: string) => void
}

const CHANNEL_OPTIONS: { value: UpdateChannel; label: string; detail: string }[] = [
  { value: 'stable', label: 'Stable (Recommended)', detail: 'Tested releases for everyday use' },
  { value: 'beta', label: 'Beta', detail: 'Pre-release builds with upcoming features' },
  { value: 'dev', label: 'Dev Nightly', detail: 'Latest commits, least tested' }
]

const STRATEGY_OPTIONS: { value: UpdateStrategy; label: string; detail: string }[] = [
  {
    value: 'auto',
    label: 'Automatically download and apply updates',
    detail: 'Download and apply updates automatically when an updater is available.'
  },
  {
    value: 'manual',
    label: 'Notify when updates are available (Manual Install)',
    detail: 'Choose when to download and install new releases.'
  },
  {
    value: 'background',
    label: 'Check background updates when DevLens is closed',
    detail: 'Requires a distribution with a background update service.'
  }
]

/**
 * The About DevLens settings page (`devlens:settings/about`).
 *
 * This page is mostly read-only: version numbers, Electron/Node/Chromium versions and OS info come
 * from the main process, which is the only place that can see `app.getVersion()` and
 * `process.versions`. The two interactive controls — update channel and update strategy — write
 * to the profile preference store like every other setting, so they survive a restart and stay
 * per-identity.
 */
export function AboutSettingsContent({
  aboutInfo,
  preferences,
  onAboutChange,
  onOpenRoute
}: AboutSettingsProps): ReactNode {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const version = aboutInfo?.version ?? 'Loading…'
  const arch = aboutInfo?.arch ?? '…'
  const { updateChannel: channel, updateStrategy: strategy } = preferences
  const upToDate = aboutInfo?.updateStatus === 'up-to-date'

  const systemInfoLines: { label: string; value: string }[] = [
    { label: 'DevLens', value: `v${version} (${arch})` },
    { label: 'Electron', value: aboutInfo?.electron ?? '' },
    { label: 'Node.js', value: aboutInfo?.node ?? '' },
    { label: 'Chromium', value: aboutInfo?.chromium ?? '' },
    { label: 'OS', value: aboutInfo ? `${aboutInfo.platform} ${aboutInfo.osVersion}` : '' },
    { label: 'Architecture', value: arch }
  ]

  const systemInfoText = systemInfoLines
    .filter((line) => line.value)
    .map((line) => `${line.label}: ${line.value}`)
    .join('\n')

  const copySystemInfo = (): void => {
    if (!aboutInfo) return
    setCopyError(false)
    window.devlens.clipboardWrite(systemInfoText).then(
      (ok) => {
        setCopied(ok)
        setCopyError(!ok)
      },
      () => setCopyError(true)
    )
  }

  return (
    <div className="flex flex-col gap-4" data-testid="about-settings">
      {/* Version Status & Release Notes */}
      <SettingsCard
        title="Version status"
        detail="The current build and its release channel."
      >
        <div className="flex flex-col gap-4 py-1 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <DevLensMark size={32} className="text-[var(--devlens-accent)]" />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink-100">DevLens v{version} ({arch})</p>
                <div className="mt-1 flex items-center gap-1.5" role="status">
                  {upToDate ? <CheckCircle2 size={11} className="text-emerald-400" /> : <Info size={11} className="text-ink-400" />}
                  <span className="text-[10px] text-ink-400">
                    {!aboutInfo ? 'Loading version information…' : upToDate ? 'DevLens is up to date' : 'Update status unavailable'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <ShortcutTile
                label="Release Notes & Changelog"
                detail="devlens:changelog"
                onClick={() => onOpenRoute('devlens:changelog')}
              />
              <ShortcutTile
                label="View Release History"
                detail="All published versions"
                onClick={() => onOpenRoute(ABOUT_LINKS.releases)}
              />
            </div>
          </div>
          <div data-testid="about-version-mascot" className="self-center sm:ml-4">
            <LensyMascot pose="peek" size={104} />
          </div>
        </div>
      </SettingsCard>

      {/* Auto-Update & Distribution Channels */}
      <SettingsCard
        title="Auto-update"
        detail="Choose how DevLens checks for and applies updates."
      >
        <p className="mb-4 text-[10px] leading-4 text-ink-400">
          These preferences are saved to this profile. This build has no update service configured;
          automatic installation and checks while closed are unavailable. Use release history to check published releases.
        </p>
        <SettingRow
          label="Update Channel"
          detail="Which distribution stream DevLens pulls updates from."
        >
          <div role="radiogroup" aria-label="Update Channel" className="flex flex-col gap-1.5" data-testid="about-update-channel">
            {CHANNEL_OPTIONS.map((option) => {
              const selected = option.value === channel
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 transition-colors hover:bg-white/[0.03] focus-within:ring-2 focus-within:ring-[var(--devlens-accent)]"
                  data-selected={selected}
                  data-channel={option.value}
                  style={{
                    borderColor: selected
                      ? 'var(--devlens-accent-line)'
                      : 'var(--devlens-hairline)',
                    background: selected ? 'var(--devlens-accent-soft)' : 'transparent'
                  }}
                >
                  <input
                    type="radio"
                    name="update-channel"
                    checked={selected}
                    onChange={() => onAboutChange({ updateChannel: option.value })}
                    className="sr-only"
                  />
                  <span
                    className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border"
                    style={{
                      borderColor: selected
                        ? 'var(--devlens-accent)'
                        : 'rgba(255,255,255,0.2)'
                    }}
                  >
                    {selected && (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: 'var(--devlens-accent)' }}
                      />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] text-ink-100">{option.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-ink-500">
                      {option.detail}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </SettingRow>

        <div className="my-3 h-px bg-[var(--devlens-hairline)]" />

        <div role="radiogroup" aria-label="Update Strategy" className="flex flex-col gap-1.5" data-testid="about-update-strategy">
          <p className="text-[11px] text-ink-200">Update Strategy</p>
          {STRATEGY_OPTIONS.map((option) => {
            const selected = option.value === strategy
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 transition-colors hover:bg-white/[0.03] focus-within:ring-2 focus-within:ring-[var(--devlens-accent)]"
                data-selected={selected}
                data-strategy={option.value}
                style={{
                  borderColor: selected
                    ? 'var(--devlens-accent-line)'
                    : 'var(--devlens-hairline)',
                  background: selected ? 'var(--devlens-accent-soft)' : 'transparent'
                }}
              >
                <input
                  type="radio"
                  name="update-strategy"
                  checked={selected}
                  onChange={() => onAboutChange({ updateStrategy: option.value })}
                  className="sr-only"
                />
                <span
                  className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border"
                  style={{
                    borderColor: selected
                      ? 'var(--devlens-accent)'
                      : 'rgba(255,255,255,0.2)'
                  }}
                >
                  {selected && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: 'var(--devlens-accent)' }}
                    />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] text-ink-100">{option.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-ink-500">
                    {option.detail}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      </SettingsCard>

      {/* Developer Diagnostics & Community */}
      <SettingsCard
        title="Developer Diagnostics & Community"
        detail="System info for issue reports and links to the community."
      >
        <SettingRow
          label="DevLens Diagnostics"
          detail="Copy system info (Electron, Node, OS, Architecture) for issue reports."
        >
          <button
            type="button"
            data-testid="about-copy-system-info"
            onClick={copySystemInfo}
            disabled={!aboutInfo}
            className="flex items-center gap-1.5 rounded-md border border-[var(--devlens-hairline)] px-3 py-1.5 text-[10px] text-ink-200 transition-colors hover:border-[var(--devlens-accent-line)] hover:bg-white/[0.03] disabled:opacity-40"
          >
            {copied ? (
              <CheckCircle2 size={11} className="text-emerald-400" />
            ) : (
              <Copy size={11} />
            )}
            <span aria-live="polite">{copied ? 'Copied' : 'Copy System Info'}</span>
          </button>
        </SettingRow>
        {copyError && <p role="alert" className="mt-2 text-[10px] text-rose-300">Could not copy system info. Please try again.</p>}
        {aboutInfo && (
          <dl className="mt-3 grid gap-x-5 gap-y-2 rounded-md border border-[var(--devlens-hairline)] p-3 sm:grid-cols-2">
            {systemInfoLines.map(({ label, value }) => (
              <div key={label} className="min-w-0">
                <dt className="text-[9px] text-ink-500">{label}</dt>
                <dd className="break-words font-mono text-[10px] text-ink-200">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <h4 className="mt-4 text-[11px] text-ink-200">Community & Support</h4>
        <div className="mt-3 flex flex-wrap gap-2">
          <ShortcutTile
            label="GitHub Repository"
            detail="Source, issues and releases"
            onClick={() => onOpenRoute(ABOUT_LINKS.repository)}
          />
          <ShortcutTile
            label="Submit Bug / Feature Request"
            detail="Open an issue on GitHub"
            onClick={() => onOpenRoute(ABOUT_LINKS.issues)}
          />
          <ShortcutTile
            label="Join Discord"
            detail="Community support and discussion"
            onClick={() => onOpenRoute(ABOUT_LINKS.discord)}
          />
        </div>
      </SettingsCard>

      {/* License */}
      <SettingsCard
        title="License"
        detail="DevLens is free and open-source software."
      >
        <div className="flex items-start gap-2.5 py-1">
          <ScrollText size={14} className="mt-0.5 shrink-0 text-[var(--devlens-accent)]" />
          <div className="min-w-0">
            <p className="text-[11px] text-ink-100">MIT License</p>
            <p className="mt-1 text-[10px] leading-4 text-ink-500">
              Copyright (c) 2026 Ray Cheung. Permission is hereby granted, free of charge, to any
              person obtaining a copy of this software and associated documentation files (the
              "Software"), to deal in the Software without restriction, including without limitation
              the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
              copies of the Software, and to permit persons to whom the Software is furnished to do so,
              subject to the following conditions:
            </p>
            <p className="mt-2 text-[10px] leading-4 text-ink-500">
              The above copyright notice and this permission notice shall be included in all copies
              or substantial portions of the Software.
            </p>
            <p className="mt-2 text-[10px] leading-4 text-ink-600">
              THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
              INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
              HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
              CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
              OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
            </p>
          </div>
        </div>
      </SettingsCard>
    </div>
  )
}

/* ---- Local UI primitives matching SettingsPage.tsx ---- */

function SettingsCard({
  title,
  detail,
  children
}: {
  title: string
  detail: string
  children: ReactNode
}) {
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

function SettingRow({
  label,
  detail,
  children
}: {
  label: string
  detail: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
      <div className="min-w-0">
        <p className="text-[11px] text-ink-200">{label}</p>
        <p className="mt-0.5 text-[10px] leading-4 text-ink-500">{detail}</p>
      </div>
      <div className="min-w-0 sm:max-w-[65%]">{children}</div>
    </div>
  )
}

function ShortcutTile({
  label,
  detail,
  onClick
}: {
  label: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-center gap-2.5 rounded-md border border-[var(--devlens-hairline)] px-3 py-2.5 text-left hover:border-[var(--devlens-accent-line)] hover:bg-white/[0.03]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] text-ink-200">{label}</span>
        <span className="mt-0.5 block truncate text-[9px] text-ink-500">{detail}</span>
      </span>
      <ChevronRight size={11} className="shrink-0 text-ink-500" />
    </button>
  )
}

