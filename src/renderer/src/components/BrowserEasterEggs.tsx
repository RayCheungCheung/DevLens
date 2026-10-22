import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Eye, Sparkles, X } from 'lucide-react'
import { LensyMascot } from '@renderer/components/LensyMascot'

type SecretId = 'konami' | 'brand' | 'idle'

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a'
] as const

const IDLE_AFTER_MS = 120_000

const SECRETS: Record<
  Exclude<SecretId, 'idle'>,
  { eyebrow: string; title: string; body: string; signature: string }
> = {
  konami: {
    eyebrow: 'Lensy protocol: unlocked',
    title: 'The old sequence still works.',
    body: 'Up, up, down, down. The internet remembers. Lensy has opened both viewports, checked the signal and left a tiny sparkle in the cache.',
    signature: '↑ ↑ ↓ ↓ ← → ← → B A'
  },
  brand: {
    eyebrow: 'Five taps, one observant mascot',
    title: 'You found Lensy hiding in the logo.',
    body: 'Every DevLens page has a secret pair of eyes. Lensy uses them to watch the console, the network and both viewport edges at the same time.',
    signature: 'Build sharp. Inspect everything.'
  }
}

/** Small browser-wide surprises that never interfere with page content. */
export function BrowserEasterEggs() {
  const [secret, setSecret] = useState<SecretId | null>(null)
  const [idlePeek, setIdlePeek] = useState(false)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    let cursor = 0
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return

      if (event.key.toLowerCase() === KONAMI[cursor].toLowerCase()) cursor += 1
      else cursor = event.key.toLowerCase() === KONAMI[0].toLowerCase() ? 1 : 0

      if (cursor === KONAMI.length) {
        cursor = 0
        setIdlePeek(false)
        setSecret('konami')
      }
    }
    const onBrandSecret = (event: Event): void => {
      if ((event as CustomEvent<string>).detail !== 'brand') return
      setIdlePeek(false)
      setSecret('brand')
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('devlens:easter-egg', onBrandSecret)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('devlens:easter-egg', onBrandSecret)
    }
  }, [])

  useEffect(() => {
    let idleTimer = 0
    let hideTimer = 0
    let lastMoveAt = 0
    const resetIdle = (): void => {
      window.clearTimeout(idleTimer)
      window.clearTimeout(hideTimer)
      if (secret) return
      idleTimer = window.setTimeout(() => {
        setIdlePeek(true)
        hideTimer = window.setTimeout(() => setIdlePeek(false), 6500)
      }, IDLE_AFTER_MS)
    }
    const onPointerMove = (): void => {
      const now = Date.now()
      if (now - lastMoveAt < 1000) return
      lastMoveAt = now
      resetIdle()
    }
    resetIdle()
    const events = ['pointerdown', 'keydown', 'wheel'] as const
    for (const event of events) window.addEventListener(event, resetIdle, { passive: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => {
      window.clearTimeout(idleTimer)
      window.clearTimeout(hideTimer)
      for (const event of events) window.removeEventListener(event, resetIdle)
      window.removeEventListener('pointermove', onPointerMove)
    }
  }, [secret])

  useEffect(() => {
    if (!secret) return
    setIdlePeek(false)
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setSecret(null)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [secret])

  const copy = secret && secret !== 'idle' ? SECRETS[secret] : null
  return (
    <>
      {idlePeek && !secret && (
        <button
          type="button"
          data-testid="lensy-idle-easter-egg"
          aria-label="Lensy has a secret for you"
          onClick={() => {
            setIdlePeek(false)
            setSecret('idle')
          }}
          className="devlens-lensy-peek fixed bottom-12 left-5 z-[100] flex items-end gap-2 text-left"
        >
          <LensyMascot pose="peek" size={92} showName={false} />
          <span className="mb-5 max-w-[220px] rounded-xl border border-[var(--devlens-accent-line)] bg-[color-mix(in_srgb,var(--color-ink-950)_94%,transparent)] px-3 py-2 text-[10px] leading-4 text-ink-300 shadow-xl backdrop-blur-md">
            Lensy is still watching both viewports. Click for a secret.
          </span>
        </button>
      )}

      {secret && (
        <div
          className="devlens-secret-backdrop fixed inset-0 z-[110] flex items-center justify-center bg-black/72 p-4 backdrop-blur-md"
          onMouseDown={() => setSecret(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="devlens-secret-title"
            data-testid={`devlens-easter-egg-${secret}`}
            className="devlens-secret-card relative w-full max-w-[520px] overflow-hidden rounded-2xl border border-[var(--devlens-accent-line)] bg-[color-mix(in_srgb,var(--color-ink-950)_94%,var(--devlens-accent)_6%)] px-7 pb-7 pt-5 text-center shadow-[0_30px_100px_rgba(0,0,0,0.72)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div aria-hidden="true" className="devlens-secret-confetti">
              {Array.from({ length: 14 }, (_, index) => (
                <span
                  key={index}
                  style={
                    {
                      left: `${4 + index * 6.7}%`,
                      animationDelay: `${index * 55}ms`,
                      backgroundColor:
                        index % 3 === 0
                          ? 'var(--devlens-accent)'
                          : index % 3 === 1
                            ? '#fbbf24'
                            : '#a78bfa'
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            <div className="relative flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--devlens-accent)]">
                <Sparkles size={11} />
                Hidden transmission
              </span>
              <button
                ref={closeRef}
                type="button"
                aria-label="Close easter egg"
                onClick={() => setSecret(null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--devlens-hairline)] text-ink-400 hover:bg-white/5 hover:text-ink-100"
              >
                <X size={13} />
              </button>
            </div>

            <div className="relative mt-2 flex justify-center">
              <LensyMascot
                shield={secret === 'konami'}
                happy={secret === 'brand'}
                pose={secret === 'idle' ? 'peek' : 'full'}
                size={164}
                showName={false}
              />
            </div>

            <p className="relative mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--devlens-accent)]">
              {copy?.eyebrow ?? 'Lensy noticed the silence'}
            </p>
            <h2
              id="devlens-secret-title"
              className="relative mt-2 text-[22px] font-semibold leading-tight text-ink-100"
            >
              {copy?.title ?? 'A quiet browser is still paying attention.'}
            </h2>
            <p className="relative mx-auto mt-3 max-w-[410px] text-[11px] leading-6 text-ink-400">
              {copy?.body ??
                'Lensy waited until the page was calm, checked both viewports, then decided to peek in. Nothing was captured; this was only for you.'}
            </p>
            {copy?.signature && (
              <p className="relative mt-5 rounded-full border border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] px-3 py-1 font-mono text-[9px] text-[var(--devlens-accent)]">
                {copy.signature}
              </p>
            )}
            {secret === 'idle' && (
              <p className="relative mt-4 inline-flex items-center gap-1.5 font-mono text-[9px] text-ink-600">
                <Eye size={10} />
                no page data was read
              </p>
            )}
          </section>
        </div>
      )}
    </>
  )
}
