interface DevLensMarkProps {
  size?: number
  className?: string
}

/**
 * The DevLens identity mark.
 *
 * A viewfinder around a lens: the outer brackets describe a browser viewport, the ring and
 * centre point describe the inspection lens. It is deliberately one inline vector in
 * `currentColor`, so the tab strip, omnibox and front-page header share the same geometry and
 * inherit the active theme rather than depending on a bitmap or a loaded image.
 */
export function DevLensMark({ size = 16, className = '' }: DevLensMarkProps) {
  return (
    <svg
      data-devlens-mark="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={['block shrink-0', className].join(' ')}
    >
      <path d="M3.5 8V5.5A2 2 0 0 1 5.5 3.5H8" />
      <path d="M16 3.5h2.5a2 2 0 0 1 2 2V8" />
      <path d="M20.5 16v2.5a2 2 0 0 1-2 2H16" />
      <path d="M8 20.5H5.5a2 2 0 0 1-2-2V16" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <path d="M12 6.2v1.25M12 16.55v1.25M6.2 12h1.25M16.55 12h1.25" />
    </svg>
  )
}
