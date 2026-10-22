import {
  Blocks,
  Compass,
  Eye,
  Gauge,
  HeartHandshake,
  LockKeyhole,
  MousePointerClick,
  Sparkles,
  Wrench
} from 'lucide-react'
import { LensyMascot } from '@renderer/components/LensyMascot'

const PRINCIPLES = [
  {
    icon: Compass,
    title: 'Calm by default',
    detail:
      'The browser should feel quiet until the operator asks for power. Developer surfaces appear around the page, not over every page.'
  },
  {
    icon: MousePointerClick,
    title: 'Power on demand',
    detail:
      'Deep controls stay close but do not compete for attention. One deliberate action should reveal the right tool with clear context.'
  },
  {
    icon: Eye,
    title: 'Inspect everything',
    detail:
      'Development tools should explain what the page is doing. Evidence, requests and structure should remain visible and traceable.'
  },
  {
    icon: LockKeyhole,
    title: 'Local-first trust',
    detail:
      'Profiles, notes, protection and captured context stay on the machine. Privacy is enforced by the product, not promised by a settings label.'
  },
  {
    icon: HeartHandshake,
    title: 'Human by default',
    detail:
      'Technical controls should still be legible, forgiving and honest about their limits. The browser should explain itself without patronising the user.'
  },
  {
    icon: Gauge,
    title: 'Craft over clutter',
    detail:
      'Every control earns its place. Spacing, hierarchy, motion and feedback exist to make the next action obvious, never merely to decorate.'
  }
] as const

/** The people and mascot behind the product. */
export function AboutDevLensTeams() {
  return (
    <div data-testid="about-devlens-teams" className="flex flex-col gap-4">
      <section className="relative overflow-hidden rounded-xl border border-[var(--devlens-accent-line)] bg-[linear-gradient(135deg,var(--devlens-accent-soft),rgba(255,255,255,0.018))] px-6 py-6">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--devlens-glow)] blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <LensyMascot shield size={132} showName={false} />
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--devlens-accent-line)] bg-black/15 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--devlens-accent)]">
              <Sparkles size={10} />
              About DevLens Teams
            </span>
            <h2 className="mt-3 text-[28px] font-semibold leading-tight text-ink-100">
              Built by RayCheung,
              <br />
              watched over by Lensy.
            </h2>
            <p className="mt-3 max-w-[650px] text-[12px] leading-6 text-ink-400">
              DevLens is a small, independent project with an ambitious goal: make a browser feel
              like a focused development workspace without losing the speed and clarity of a normal
              browser.
            </p>
          </div>
        </div>
      </section>

      <section
        data-testid="devlens-design-philosophy"
        className="relative overflow-hidden rounded-xl border border-[var(--devlens-hairline)] bg-black/15 p-6"
      >
        <div className="absolute inset-y-0 left-0 w-1 bg-[var(--devlens-accent)]" />
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--devlens-accent)]">
          Our design philosophy
        </p>
        <blockquote className="mt-3 max-w-[820px] text-[21px] font-medium leading-8 text-ink-100">
          “A browser should feel ordinary when you need to move quickly, and become a precise
          instrument when you need to understand what is happening underneath.”
        </blockquote>
        <div className="mt-4 grid gap-4 border-t border-[var(--devlens-hairline)] pt-4 md:grid-cols-[0.9fr_1.1fr]">
          <p className="text-[11px] leading-6 text-ink-400">
            DevLens is designed as a layered workspace. The page stays central; tools gather around
            it only when they have context. Normal Mode removes the developer surface so reading and
            privacy remain undistracted, while dev mode reveals the instruments needed to inspect,
            compare, intercept and repair.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.018] px-3 py-2.5">
              <p className="font-mono text-[8px] uppercase tracking-wide text-ink-600">Default</p>
              <p className="mt-1 text-[11px] text-ink-200">Readable, calm, fast</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.018] px-3 py-2.5">
              <p className="font-mono text-[8px] uppercase tracking-wide text-ink-600">Inspect</p>
              <p className="mt-1 text-[11px] text-ink-200">Visible evidence, shared context</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.018] px-3 py-2.5">
              <p className="font-mono text-[8px] uppercase tracking-wide text-ink-600">Protect</p>
              <p className="mt-1 text-[11px] text-ink-200">Local data and enforced boundaries</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.018] px-3 py-2.5">
              <p className="font-mono text-[8px] uppercase tracking-wide text-ink-600">Return</p>
              <p className="mt-1 text-[11px] text-ink-200">Clean browser when work is done</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--devlens-hairline)] bg-white/[0.018] p-5">
          <div className="flex items-start gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-orange-300/30 bg-[linear-gradient(135deg,rgba(251,146,60,0.2),rgba(244,114,182,0.12))] text-[22px] font-semibold tracking-tight text-orange-100 shadow-inner">
              RC
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-orange-300">
                Creator &amp; developer
              </p>
              <h3 className="mt-1 text-[20px] font-semibold text-ink-100">RayCheung</h3>
              <p className="mt-2 text-[11px] leading-5 text-ink-400">
                RayCheung builds the product direction, interaction design and implementation
                behind DevLens: the dual viewports, local-first privacy model, developer tools and
                the small details that make the workspace feel coherent.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2.5">
              <Wrench size={13} className="text-orange-300" />
              <p className="mt-1.5 text-[10px] text-ink-200">Product engineering</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2.5">
              <Blocks size={13} className="text-orange-300" />
              <p className="mt-1.5 text-[10px] text-ink-200">Interface systems</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--devlens-hairline)] bg-white/[0.018] p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]">
              <LensyMascot pose="peek" size={72} showName={false} />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--devlens-accent)]">
                Mascot &amp; privacy companion
              </p>
              <h3 className="mt-1 text-[20px] font-semibold text-ink-100">Lensy</h3>
              <p className="mt-2 text-[11px] leading-5 text-ink-400">
                Lensy keeps an eye on both viewports. The little lens-headed guide appears when
                DevLens is protecting a connection, opening a private session or explaining what
                WImH is doing with your data.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-3 py-2.5">
            <p className="text-[10px] leading-5 text-ink-300">
              “Build sharp. Inspect everything.” Lensy turns the serious parts of privacy and
              debugging into a presence that is easy to recognise and harder to ignore.
            </p>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-[var(--devlens-hairline)] bg-white/[0.018] p-5">
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">
          Design principles
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PRINCIPLES.map(({ icon: Icon, title, detail }) => (
            <div
              key={title}
              className="rounded-lg border border-white/[0.06] bg-black/15 p-3.5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]">
                <Icon size={14} />
              </span>
              <h3 className="mt-3 text-[12px] font-medium text-ink-100">{title}</h3>
              <p className="mt-1 text-[10px] leading-5 text-ink-500">{detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 rounded-lg border border-white/[0.06] bg-black/15 p-4 sm:grid-cols-3">
          <div>
            <p className="font-mono text-[8px] uppercase tracking-wide text-ink-600">Rule 01</p>
            <p className="mt-1 text-[10px] leading-5 text-ink-300">
              The page is the subject; the tools are the lens.
            </p>
          </div>
          <div>
            <p className="font-mono text-[8px] uppercase tracking-wide text-ink-600">Rule 02</p>
            <p className="mt-1 text-[10px] leading-5 text-ink-300">
              Privacy and safety must work without requiring expertise.
            </p>
          </div>
          <div>
            <p className="font-mono text-[8px] uppercase tracking-wide text-ink-600">Rule 03</p>
            <p className="mt-1 text-[10px] leading-5 text-ink-300">
              When the product is uncertain, explain the boundary instead of hiding it.
            </p>
          </div>
        </div>
        <p className="mt-4 border-t border-[var(--devlens-hairline)] pt-3 text-right font-mono text-[9px] tracking-wide text-ink-500">
          — RayCheung &amp; Lensy, DevLens Team
        </p>
      </section>
    </div>
  )
}
