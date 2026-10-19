import { ArrowLeft, ExternalLink, ScrollText } from 'lucide-react'
import { ABOUT_LINKS, CURRENT_BUILD_NOTES } from '@shared/about'

interface ChangelogPageProps {
  version: string | undefined
  onBack: () => void
  onOpenReleaseHistory: (url: string) => void
}

/** Offline release notes for the installed build; published history lives on GitHub. */
export function ChangelogPage({ version, onBack, onOpenReleaseHistory }: ChangelogPageProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-ink-950" data-testid="changelog-page">
      <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6 px-5 py-7 sm:px-8">
        <header className="flex items-start gap-3">
          <button type="button" onClick={onBack} aria-label="Back to About DevLens"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--devlens-hairline)] text-ink-400 hover:text-ink-100">
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 className="flex items-center gap-2 text-[22px] font-semibold text-ink-100">
              <ScrollText size={20} className="text-[var(--devlens-accent)]" />
              Release Notes & Changelog
            </h1>
            <p className="mt-1 text-[11px] text-ink-400">Notes bundled with this installation.</p>
          </div>
        </header>
        <section className="rounded-lg border border-[var(--devlens-hairline)] bg-white/[0.018] p-5">
          <h2 className="text-[15px] font-medium text-ink-100">DevLens {version ? `v${version}` : '— loading version…'}</h2>
          <p className="mt-1 text-[10px] text-ink-500">About & system updates</p>
          <ul className="mt-4 list-disc space-y-2 pl-4 text-[11px] leading-5 text-ink-300">
            {CURRENT_BUILD_NOTES.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </section>
        <button type="button" onClick={() => onOpenReleaseHistory(ABOUT_LINKS.releases)}
          className="flex items-center gap-2 self-start rounded-md border border-[var(--devlens-hairline)] px-3 py-2 text-[11px] text-ink-200 hover:border-[var(--devlens-accent-line)]">
          View Release History <ExternalLink size={12} />
        </button>
      </div>
    </div>
  )
}
