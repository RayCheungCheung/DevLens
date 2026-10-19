import { Check, CheckCircle2, Globe2 } from 'lucide-react'
import { LensyMascot } from './LensyMascot'

interface DefaultBrowserCardProps {
  isDefaultBrowser: boolean
  busy: boolean
  onSetDefault: () => void
}

const DEV_LENS_ADVANTAGES = [
  'Desktop and mobile viewports stay side by side.',
  'Developer tools and source hand-off stay a shortcut away.',
  'Profiles, browsing data and diagnostics stay local-first.'
]

export function DefaultBrowserCard({
  isDefaultBrowser,
  busy,
  onSetDefault
}: DefaultBrowserCardProps) {
  return (
    <section
      data-testid="launchpad-default-browser-card"
      data-default-browser={isDefaultBrowser ? 'true' : 'false'}
      className="relative overflow-hidden rounded-lg border border-[var(--devlens-hairline)] bg-white/[0.018]"
    >
      <div className="relative flex min-h-[178px] flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:pr-40">
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--devlens-accent)]">
            Default browser
          </p>
          {isDefaultBrowser ? (
            <>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                  <CheckCircle2 size={13} />
                </span>
                <h3 className="text-[18px] font-semibold text-ink-100">Nice choice.</h3>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-ink-400">
                Thanks for making DevLens your default browser. Web links will now open in your
                developer workspace.
              </p>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-3">
                {DEV_LENS_ADVANTAGES.map((advantage) => (
                  <li key={advantage} className="flex items-start gap-1.5 text-[9px] leading-4 text-ink-300">
                    <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]">
                      <Check size={9} strokeWidth={3} />
                    </span>
                    <span>{advantage}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h3 className="mt-1.5 text-[18px] font-semibold text-ink-100">
                Make DevLens your everyday browser
              </h3>
              <p className="mt-1 max-w-[520px] text-[11px] leading-5 text-ink-400">
                Open web links, local previews and project docs in the browser built for inspecting
                both sides of the work.
              </p>
              <button
                type="button"
                data-testid="launchpad-set-default-browser"
                disabled={busy}
                onClick={onSetDefault}
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-3 text-[10px] text-[var(--devlens-accent)] transition-colors hover:brightness-110 disabled:opacity-40"
              >
                <Globe2 size={12} />
                {busy ? 'Setting…' : 'Set DevLens as default'}
              </button>
            </>
          )}
        </div>
        <div className="relative mt-1 flex w-[112px] flex-col items-center self-center sm:absolute sm:right-4 sm:top-1/2 sm:bottom-auto sm:mt-0 sm:-translate-y-1/2">
          <LensyMascot happy={isDefaultBrowser} />
        </div>
      </div>
    </section>
  )
}

