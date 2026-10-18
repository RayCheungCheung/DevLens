import type { AiSiteId } from '@shared/ai-sites'

interface AiMarkProps {
  site: AiSiteId
  size?: number
  className?: string
}

/**
 * The assistant's brand marks, drawn inline in a 24-unit frame.
 *
 * Not fetched: a dock icon that waits on a CDN is a dock icon that is missing on a plane, and an
 * unreachable host makes the rail render a stalled request on every remount. They are monochrome
 * shapes in `currentColor`, so the same artwork follows the dock's active and hover colours as
 * well as a provider accent. The shell's CSP does not have to allow an image host.
 *
 * The paths are deliberately filled rather than scaled bitmaps or transformed text. At 16px the
 * curves still land cleanly on high-DPI displays, and no viewport-sized percentage can stretch
 * one provider's mark to a different optical weight.
 */
export function AiMark({ site, size = 14, className = '' }: AiMarkProps) {
  return (
    <svg
      data-ai-mark={site}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={['block shrink-0', className].join(' ')}
    >
      {site === 'gemini' && (
        /* Four concave arms, centred on 12,12 and kept clear of all four frame edges. */
        <path d="M12 1.5c.27 5.71 4.79 10.23 10.5 10.5C16.79 12.27 12.27 16.79 12 22.5 11.73 16.79 7.21 12.27 1.5 12 7.21 11.73 11.73 7.21 12 1.5Z" />
      )}
      {site === 'claude' && (
        /* A five-ray asterisk with tapered arms and a recognisable negative-space centre. */
        <path d="M10.92 1.8h2.16l.7 6.34 5.03-3.87 1.08 1.88-5.24 3.58 5.24 3.58-1.08 1.88-5.03-3.87-.7 6.34h-2.16l-.7-6.34-5.03 3.87-1.08-1.88 5.24-3.58-5.24-3.58 1.08-1.88 5.03 3.87z" />
      )}
      {site === 'chatgpt' && (
        /* The six-lobe knot as one compound path, so every opening stays transparent. */
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.182a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.91 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.041l.142-.08 4.778-2.759a.795.795 0 0 0 .393-.681V11.13l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.495 4.494zM3.599 18.304a4.471 4.471 0 0 1-.535-3.014l.142.085 4.783 2.758a.771.771 0 0 0 .781 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062l-4.84 2.794a4.499 4.499 0 0 1-6.14-1.648zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.814 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.856L13.104 8.364 15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.677a.79.79 0 0 0-.407-.667zm2.011-3.023-.142-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.499 4.499 0 0 1 6.68 4.66zM8.306 12.863l-2.02-1.164a.08.08 0 0 1-.038-.057V6.074a4.499 4.499 0 0 1 7.376-3.454l-.142.081L8.704 5.459a.795.795 0 0 0-.393.681zm1.098-2.365 2.602-1.5 2.607 1.5v2.999l-2.598 1.5-2.606-1.5z" />
      )}
      {site === 'deepseek' && (
        <>
          /* A whale rising through the frame: curved back, exposed belly and split fluke. */
          <path d="M2.2 11.8c2.4-2.1 5.3-3.2 8.6-3.2 3.4 0 6.3 1.1 8.7 3.4l-.3-1.6c-.8-2.6-2.6-4.4-5.5-5.3 1.3-1.2 3-1.9 5-2.1-3.7-2.2-7.3-1.7-10.7 1.3-2.3 2-4.2 4.5-5.8 7.5Z" />
          <path d="M3.3 13.3c1.6 3.2 4.2 5.1 7.8 5.7.8.1 1.6-.3 2.3-1.1l1.1-1.2.7 1.6 1.9-2.3 1.2 2.3 1.1-1.7 2.3.6c-2 2.6-5 3.9-8.9 3.9-4.5 0-7.9-1.8-10.1-5.3z" />
        </>
      )}
    </svg>
  )
}
