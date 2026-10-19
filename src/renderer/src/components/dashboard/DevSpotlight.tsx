import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Widget } from '@renderer/components/dashboard/Widget'
import { DEVELOPER_QUOTES } from '@shared/developer-quotes'

/**
 * A small editorial pause beside the utility widgets. A chosen wallpaper becomes the photo;
 * without one the card stays a typographic quote rather than reserving an empty image frame.
 */
export function DevSpotlight({ wallpaper, dim }: { wallpaper: string; dim: number }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % DEVELOPER_QUOTES.length),
      15000
    )
    return () => window.clearInterval(timer)
  }, [])

  const quote = DEVELOPER_QUOTES[index]
  const overlay = Math.min(0.85, Math.max(0.15, dim / 100))

  return (
    <Widget
      icon={Sparkles}
      title="Dev spotlight"
      note={`${index + 1} / ${DEVELOPER_QUOTES.length}${wallpaper ? ' · over your wallpaper' : ''}`}
    >
      <div className="relative min-h-[126px] overflow-hidden rounded-md border border-[var(--devlens-hairline)]">
        {wallpaper && (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url("${wallpaper}")` }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-black"
              style={{ opacity: overlay }}
            />
          </>
        )}
        <blockquote className="relative z-10 flex min-h-[126px] flex-col justify-between gap-4 px-4 py-4">
          <p
            data-testid="dev-spotlight-quote"
            data-quote-index={index}
            data-quote-total={DEVELOPER_QUOTES.length}
            className="text-[13px] leading-5 text-ink-100"
          >
            “{quote.text}”
          </p>
          <footer className="font-mono text-[9px] uppercase tracking-wide text-ink-400">
            {quote.author}
          </footer>
        </blockquote>
      </div>
    </Widget>
  )
}
