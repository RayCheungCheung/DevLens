interface LensyMascotProps {
  happy?: boolean
  shield?: boolean
  pose?: 'full' | 'peek'
  size?: number
  showName?: boolean
}

export function LensyMascot({
  happy = false,
  shield = false,
  pose = 'full',
  size = 98,
  showName = true
}: LensyMascotProps) {
  return (
    <div
      data-testid="lensy-mascot"
      data-variant={pose === 'peek' ? 'peek' : shield ? 'shield' : happy ? 'happy' : 'neutral'}
      className="flex shrink-0 flex-col items-center"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        role="img"
        aria-label={
          pose === 'peek'
            ? 'Lensy peeking in from the edge'
            : shield
              ? 'Lensy holding a shield'
              : 'Lensy, the DevLens mascot'
        }
        className="drop-shadow-[0_12px_20px_rgba(0,0,0,0.28)]"
      >
        {pose === 'peek' ? (
          <g>
            <path d="M52 20V106" stroke="var(--devlens-accent-line)" strokeWidth="2" strokeDasharray="3 5" />
            <g transform="translate(58 27)">
              <path d="M15 0V-10M62 0V-10" stroke="var(--devlens-accent)" strokeWidth="5" strokeLinecap="round" />
              <rect x="0" y="0" width="72" height="69" rx="24" fill="var(--devlens-accent-soft)" stroke="var(--devlens-accent-line)" strokeWidth="2.5" />
              <rect x="8" y="8" width="56" height="53" rx="18" fill="#0b0d10" stroke="var(--devlens-accent)" strokeWidth="2" />
              <circle cx="27" cy="29" r="9" fill="var(--devlens-accent)" />
              <circle cx="27" cy="29" r="4" fill="#ecfeff" />
              <circle cx="50" cy="29" r="3.2" fill="var(--devlens-accent)" />
              <path d="M30 45Q42 54 54 45" fill="none" stroke="#ecfeff" strokeWidth="3" strokeLinecap="round" />
              <path d="M9 56V65M63 56V65" stroke="var(--devlens-accent)" strokeWidth="4" strokeLinecap="round" />
            </g>
            <path d="M58 48H48M58 68H48" stroke="var(--devlens-accent)" strokeWidth="4" strokeLinecap="round" />
            <circle cx="47" cy="48" r="3" fill="var(--devlens-accent)" />
            <circle cx="47" cy="68" r="3" fill="var(--devlens-accent)" />
            <path d="M38 31l-5-3M36 89l-5 3" stroke="var(--devlens-accent)" strokeWidth="2" strokeLinecap="round" opacity=".55" />
          </g>
        ) : (
          <>
            <path d="M35 33V24M85 33V24" stroke="var(--devlens-accent)" strokeWidth="5" strokeLinecap="round" />
            <rect x="24" y="29" width="72" height="69" rx="24" fill="var(--devlens-accent-soft)" stroke="var(--devlens-accent-line)" strokeWidth="2.5" />
            <rect x="32" y="37" width="56" height="53" rx="18" fill="#0b0d10" stroke="var(--devlens-accent)" strokeWidth="2" />
            <circle cx="49" cy="58" r="9" fill="var(--devlens-accent)" />
            <circle cx="49" cy="58" r="4" fill="#ecfeff" />
            <circle cx="72" cy="58" r="3.2" fill="var(--devlens-accent)" />
            {!shield && (
              <path
                d={happy ? 'M49 72 Q60 81 71 72' : 'M50 74 H70'}
                fill="none"
                stroke="#ecfeff"
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}
            <path d="M33 85V94M87 85V94" stroke="var(--devlens-accent)" strokeWidth="4" strokeLinecap="round" />
            {happy && !shield && (
              <>
                <path d="M97 40l2.2 4.8L104 47l-4.8 2.2L97 54l-2.2-4.8L90 47l4.8-2.2z" fill="var(--devlens-accent)" />
                <circle cx="23" cy="48" r="2.5" fill="var(--devlens-accent)" />
              </>
            )}
          </>
        )}
        {shield && pose !== 'peek' && (
          <>
            <path d="M34 76 L43 82M86 76 L77 82" stroke="var(--devlens-accent)" strokeWidth="3.5" strokeLinecap="round" />
            <path
              d="M60 69 L87 79V93C87 104 75 111 60 116C45 111 33 104 33 93V79Z"
              fill="var(--devlens-accent)"
              stroke="#ecfeff"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path d="M49 91L57 99L72 83" fill="none" stroke="#081014" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M94 45l2 4.3 4.3 2-4.3 2-2 4.3-2-4.3-4.3-2 4.3-2z" fill="var(--devlens-accent)" />
          </>
        )}
      </svg>
      {showName && (
        <span className="mt-0.5 rounded-full border border-[var(--devlens-hairline)] bg-ink-900/80 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-ink-400">
          Lensy
        </span>
      )}
    </div>
  )
}
