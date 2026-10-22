import type { ReactNode } from 'react'
import { ChevronRight, ShieldCheck, VenetianMask } from 'lucide-react'
import { LensyMascot } from '@renderer/components/LensyMascot'

type PrivateVariant = 'private' | 'wimh' | 'dual' | 'ghost'
export type PrivateGuideRoute = 'private-how' | 'private-who' | 'wimh-how' | 'wimh-who'
export type PrivateLandingGuideRoute =
  | PrivateGuideRoute
  | 'wimh-whatnhow'

interface PrivateSessionLandingProps {
  variant: PrivateVariant
  children: ReactNode
  onOpenGuide: (route: PrivateLandingGuideRoute) => void
}

const VARIANT_COPY: Record<
  PrivateVariant,
  {
    label: string
    title: string
    detail: string
    assurance: string
    footer: string
    links: { label: string; route: PrivateLandingGuideRoute }[]
  }
> = {
  private: {
    label: 'Private session',
    title: "You're off the record.",
    detail:
      'This tab has its own in-memory session. When it closes, DevLens discards its cookies, storage, cache and other session data.',
    assurance: '100% — DevLens does not collect your private-session data or use it for profit.',
    footer:
      'This private tab is isolated from the normal profile. The protection is strongest while this tab remains open.',
    links: [
      { label: 'How DevLens protects this private tab?', route: 'private-how' },
      { label: 'Who might still see this private activity?', route: 'private-who' }
    ]
  },
  wimh: {
    label: 'Extreme defense',
    title: 'Extreme defense is active.',
    detail:
      'WImH moves this session to a RAM-only partition, watches sensitive clipboard actions, refuses history writes and wipes site storage and cache when the protected session ends.',
    assurance: '100% — WImH does not collect your protected-session data or use it for profit.',
    footer:
      'WImH is DevLens\'s strongest built-in defense mode. It combines memory-only browsing, clipboard protection and session cleanup.',
    links: [
      { label: 'What is WImH and how does it protect me?', route: 'wimh-how' },
      { label: 'What can WImH not hide from the network?', route: 'wimh-who' }
    ]
  },
  dual: {
    label: 'Private + WImH',
    title: 'Two layers of protection are active.',
    detail:
      'This private tab is running inside a WImH session. DevLens combines per-tab isolation with RAM-only storage, clipboard defense, history blocking and a full session wipe when protection ends.',
    assurance:
      '100% — the combined Private + WImH session is not collected or used for profit.',
    footer:
      'Closing this private tab or ending WImH wipes the protected session. Together they provide the strongest local separation currently available in DevLens.',
    links: [
      { label: 'How do Private and WImH work together?', route: 'wimh-how' },
      { label: 'What can still see activity in dual mode?', route: 'wimh-who' },
      { label: 'What and How WImH protect you?', route: 'wimh-whatnhow' },
      { label: 'How DevLens protects this private tab?', route: 'private-how' }
    ]
  },
  ghost: {
    label: 'Ghost session',
    title: "You're off the record.",
    detail:
      'Ghost mode isolates this session in memory and blocks known trackers. Closing the Ghost session wipes its storage and cache.',
    assurance: '100% — DevLens does not collect your Ghost-session data or use it for profit.',
    footer:
      'This Ghost session stays separate from the normal profile and is cleared when the session ends.',
    links: [
      { label: 'How does DevLens protect a Ghost session?', route: 'private-how' },
      { label: 'Who might still see Ghost activity?', route: 'private-who' }
    ]
  }
}

export function PrivateSessionLanding({
  variant,
  children,
  onOpenGuide
}: PrivateSessionLandingProps) {
  const copy = VARIANT_COPY[variant]
  const privatePose = variant === 'private' || variant === 'dual'
  const shield = variant === 'wimh' || variant === 'dual'

  return (
    <div
      data-testid="private-session-landing"
      data-private-variant={variant}
      className="private-session-surface absolute inset-0 z-40 overflow-y-auto"
    >
      <div className="mx-auto flex min-h-full w-full max-w-[900px] flex-col px-6 pb-10 pt-8">
        <div className="flex items-center gap-2 self-center rounded-full border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-3 py-1 text-[10px] font-medium text-[var(--devlens-accent)]">
          {shield ? <ShieldCheck size={12} /> : <VenetianMask size={12} />}
          {copy.label}
        </div>

        <main className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <LensyMascot
            pose={privatePose ? 'private' : 'full'}
            shield={shield}
            size={184}
            showName={false}
          />

          <h1 className="mt-6 text-[42px] font-semibold leading-tight text-ink-100">
            {copy.title}
          </h1>
          <p className="mt-3 max-w-[620px] text-[14px] leading-7 text-ink-300">
            {copy.detail}
          </p>
          <p className="mt-4 rounded-full border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-4 py-1.5 text-[11px] font-medium text-[var(--devlens-accent)]">
            {copy.assurance}
          </p>

          <div className="mt-8 w-full max-w-[660px]">{children}</div>

          <div className="mt-10 w-full max-w-[720px] border-t border-[var(--devlens-hairline)] pt-5">
            <p className="text-[11px] leading-5 text-ink-400">
              {copy.footer}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {copy.links.map((link, index) => (
                <button
                  key={link.route}
                  type="button"
                  onClick={() => onOpenGuide(link.route)}
                  className={[
                    'inline-flex items-center justify-center gap-1 text-[11px] underline underline-offset-4',
                    index < 2
                      ? 'text-[var(--devlens-accent)] decoration-[var(--devlens-accent-line)]'
                      : 'text-ink-400 decoration-white/20 hover:text-ink-100'
                  ].join(' ')}
                >
                  {link.label}
                  <ChevronRight size={12} />
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
