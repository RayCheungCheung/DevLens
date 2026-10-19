import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Widget } from '@renderer/components/dashboard/Widget'

const QUOTES = [
  { text: 'Simplicity is prerequisite for reliability.', author: 'Edsger W. Dijkstra' },
  { text: 'Programs must be written for people to read.', author: 'Harold Abelson' },
  { text: 'Make it work, make it right, make it fast.', author: 'Kent Beck' },
  { text: 'The best error message is the one that never shows up.', author: 'Thomas Fuchs' }
]

/**
 * A small editorial pause beside the utility widgets. A chosen wallpaper becomes the photo;
 * without one the card stays a typographic quote rather than reserving an empty image frame.
 */
export function DevSpotlight({ wallpaper, dim }: { wallpaper: string; dim: number }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % QUOTES.length), 15000)
    return () => window.clearInterval(timer)
  }, [])

  const quote = QUOTES[index]
  const overlay = Math.min(0.85, Math.max(0.15, dim / 100))

  return (
    <Widget icon={Sparkles} title="Dev spotlight" note={wallpaper ? 'quote over your wallpaper' : 'a quiet developer quote'}>
      <div className="relative min-h-[126px] overflow-hidden rounded-md border border-[var(--devlens-hairline)]">
        {wallpaper && (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${wallpaper})` }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-black"
              style={{ opacity: overlay }}
            />
          </>
        )}
        <blockquote className="relative z-10 flex min-h-[126px] flex-col justify-between gap-4 px-4 py-4">
          <p className="text-[13px] leading-5 text-ink-100">“{quote.text}”</p>
          <footer className="font-mono text-[9px] uppercase tracking-wide text-ink-400">
            {quote.author}
          </footer>
        </blockquote>
      </div>
    </Widget>
  )
}
