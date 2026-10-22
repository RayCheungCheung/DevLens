import { useEffect, useState } from 'react'
import {
  Ghost,
  Globe,
  Layers,
  Server,
  ShieldCheck,
  SquareDashedMousePointer,
  Terminal
} from 'lucide-react'
import type { PrefixBadgeIcon } from '@shared/omnibox'

/**
 * Prefix marks.
 *
 * The six search engines are inline SVG - nothing is fetched, so a mark cannot be missing offline
 * and the shell needs no image host in its CSP for an engine - and all six share one frame, which
 * is what makes a list of them read as a list of logos rather than as a ragged column.
 *
 * Two of the six are drawn in colour, because their published artwork is a *knockout*: the lion's
 * face and the duck are holes in the shape, so a single-colour fill leaves them showing whatever
 * happens to be behind the chip. On this chrome that is nearly black, which is how a shield and a
 * duck both read as an orange blob. They are drawn the way their brands draw them instead - the
 * mark in its ink over its own outline in white - which needs no measurement and no transform.
 *
 * Site shortcuts and custom engines use the fetched favicon path instead.
 */

interface MarkProps {
  size?: number
}

/**
 * Every mark draws inside the same box.
 *
 * The container is fixed and the glyph is centred in it, so a mark that fills its own artwork and
 * one that does not land the same size on screen: without this, a narrow mark next to a round one
 * reads as "one is too big, one is too small".
 */
export const MARK_BOX = 'flex shrink-0 items-center justify-center overflow-hidden'

/* ------------------------------------------------------------------ *
 * Engine marks
 * ------------------------------------------------------------------ */

/**
 * The frame every engine mark is drawn in.
 *
 * Each brand publishes its artwork in a 24-unit box, and it is up to the artwork how much of that
 * box it fills - a roundel fills it, a shield is narrower, a wordmark is shorter. This window puts
 * the same inset around all of them (2.4 units, a tenth of the box on every side), so the ink of
 * every mark lands on the same optical size - 20 of the 24 units - whatever its own frame was.
 *
 * It is a `viewBox`, not a `transform`. The frame is deliberately *larger* than the artwork needs,
 * so a mark can never be clipped by its own svg, and there is no measured scaling step in the
 * render path: change a path and the frame still holds it.
 */
const MARK_FRAME = '-2.4 -2.4 28.8 28.8'

/** The white the brand artwork itself uses for the detail it cuts out. */
const MARK_WHITE = '#ffffff'

/**
 * Artwork that expresses its detail as a hole rather than as a shape.
 *
 * `under` is the mark's own outer contour. Drawn in white beneath `d`, it is what the knockout
 * reveals: the lion's face and the duck are *drawn* in the brand's own white instead of leaving a
 * hole for the chrome to show through, which is the difference between a logo and an orange blob.
 */
interface BrandArt {
  /** The published path, windings intact, so the detail is still cut out of the shape. */
  d: string
  /** The same artwork's outer contour, on its own: the silhouette the holes open onto. */
  under: string
  /** The colour the mark is drawn in. */
  ink: string
}

const BRAND_ART: Record<'brave' | 'duckduckgo', BrandArt> = {
  brave: {
    ink: '#FB542B',
    // The shield: mane, ears and point, before the face is cut out of it.
    under:
      'M15.68 0l2.096 2.38s1.84-.512 2.709.358c.868.87 1.584 1.638 1.584 1.638l-.562 1.381.715 2.047s-2.104 7.98-2.35 8.955c-.486 1.919-.818 2.66-2.198 3.633-1.38.972-3.884 2.66-4.293 2.916-.409.256-.92.692-1.38.692-.46 0-.97-.436-1.38-.692a185.796 185.796 0 01-4.293-2.916c-1.38-.973-1.712-1.714-2.197-3.633-.247-.975-2.351-8.955-2.351-8.955l.715-2.047-.562-1.381s.716-.768 1.585-1.638c.868-.87 2.708-.358 2.708-.358L8.321 0h7.36z',
    d: 'M15.68 0l2.096 2.38s1.84-.512 2.709.358c.868.87 1.584 1.638 1.584 1.638l-.562 1.381.715 2.047s-2.104 7.98-2.35 8.955c-.486 1.919-.818 2.66-2.198 3.633-1.38.972-3.884 2.66-4.293 2.916-.409.256-.92.692-1.38.692-.46 0-.97-.436-1.38-.692a185.796 185.796 0 01-4.293-2.916c-1.38-.973-1.712-1.714-2.197-3.633-.247-.975-2.351-8.955-2.351-8.955l.715-2.047-.562-1.381s.716-.768 1.585-1.638c.868-.87 2.708-.358 2.708-.358L8.321 0h7.36zm-3.679 14.936c-.14 0-1.038.317-1.758.69-.72.373-1.242.637-1.409.742-.167.104-.065.301.087.409.152.107 2.194 1.69 2.393 1.866.198.175.489.464.687.464.198 0 .49-.29.688-.464.198-.175 2.24-1.759 2.392-1.866.152-.108.254-.305.087-.41-.167-.104-.689-.368-1.41-.741-.72-.373-1.617-.69-1.757-.69zm0-11.278s-.409.001-1.022.206-1.278.46-1.584.46c-.307 0-2.581-.434-2.581-.434S4.119 7.152 4.119 7.849c0 .697.339.881.68 1.243l2.02 2.149c.192.203.59.511.356 1.066-.235.555-.58 1.26-.196 1.977.384.716 1.042 1.194 1.464 1.115.421-.08 1.412-.598 1.776-.834.364-.237 1.518-1.19 1.518-1.554 0-.365-1.193-1.02-1.413-1.168-.22-.15-1.226-.725-1.247-.95-.02-.227-.012-.293.284-.851.297-.559.831-1.304.742-1.8-.089-.495-.95-.753-1.565-.986-.615-.232-1.799-.671-1.947-.74-.148-.068-.11-.133.339-.175.448-.043 1.719-.212 2.292-.052.573.16 1.552.403 1.632.532.079.13.149.134.067.579-.081.445-.5 2.581-.541 2.96-.04.38-.12.63.288.724.409.094 1.097.256 1.333.256s.924-.162 1.333-.256c.408-.093.329-.344.288-.723-.04-.38-.46-2.516-.541-2.961-.082-.445-.012-.45.067-.579.08-.129 1.059-.372 1.632-.532.573-.16 1.845.009 2.292.052.449.042.487.107.339.175-.148.069-1.332.508-1.947.74-.615.233-1.476.49-1.565.986-.09.496.445 1.241.742 1.8.297.558.304.624.284.85-.02.226-1.026.802-1.247.95-.22.15-1.413.804-1.413 1.169 0 .364 1.154 1.317 1.518 1.554.364.236 1.355.755 1.776.834.422.079 1.08-.4 1.464-1.115.384-.716.039-1.422-.195-1.977-.235-.555.163-.863.355-1.066l2.02-2.149c.341-.362.68-.546.68-1.243 0-.697-2.695-3.96-2.695-3.96s-2.274.436-2.58.436c-.307 0-.972-.256-1.585-.461-.613-.205-1.022-.206-1.022-.206z'
  },
  duckduckgo: {
    ink: '#DE5833',
    // The orange disc: the duck is cut out of this, so this is the white it opens onto.
    under: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z',
    d: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 23C5.925 23 1 18.074 1 12S5.926 1 12 1s11 4.925 11 11-4.925 11-11 11zm10.219-11c0 4.805-3.317 8.833-7.786 9.925-.27-.521-.53-1.017-.749-1.438.645.249 1.93.718 2.208.615.376-.144.282-3.149-.14-3.245-.338-.075-1.632.837-2.141 1.209l.034.156c.078.397.144.993.03 1.247-.001.004-.002.01-.004.013a.218.218 0 0 1-.068.088c-.284.188-1.081.284-1.503.188a.516.516 0 0 1-.064-.02c-.694.396-2.01 1.109-2.25.971-.329-.188-.377-2.676-.329-3.288.035-.46 1.653.286 2.442.679.174-.163.602-.272.98-.31-.57-1.389-.99-2.977-.733-4.105 0 .002.002.002.002.002.356.248 2.73 1.05 3.91 1.027 1.18-.024 3.114-.743 2.903-1.323-.212-.58-2.135.51-4.142.324-1.486-.138-1.748-.804-1.42-1.29.414-.611 1.168.116 2.411-.256 1.245-.371 2.987-1.035 3.632-1.397 1.494-.833-.625-1.177-1.125-.947-.474.22-2.123.637-2.889.82.428-1.516-.603-4.149-1.757-5.3-.376-.376-.951-.612-1.603-.736-.25-.344-.654-.671-1.225-.977a5.772 5.772 0 0 0-3.595-.584l-.024.004-.034.004.004.002c-.148.028-.237.08-.357.098.148.016.705.276 1.057.418-.174.068-.412.108-.596.184a.828.828 0 0 0-.204.056c-.173.08-.303.375-.3.515.84-.086 2.082-.026 2.991.246-.644.09-1.235.258-1.661.482-.016.008-.03.018-.048.028-.054.02-.106.042-.152.066-1.367.72-1.971 2.405-1.611 4.424.323 1.824 1.665 8.088 2.29 11.064-3.973-1.4-6.822-5.186-6.822-9.639C1.781 6.356 6.356 1.781 12 1.781S22.219 6.356 22.219 12zM9.095 9.581a.758.758 0 1 0 0 1.516.758.758 0 0 0 0-1.516zm.338.702a.196.196 0 1 1 0-.392.196.196 0 0 1 0 .392zm4.724-1.043a.65.65 0 1 0 0 1.299.65.65 0 0 0 0-1.3zm.29.601a.168.168 0 1 1 0-.336.168.168 0 0 1 0 .336zM9.313 8.146s-.571-.26-1.125.09c-.554.348-.534.704-.534.704s-.294-.656.49-.978c.786-.32 1.17.184 1.17.184zm5.236-.052s-.41-.234-.73-.23c-.654.008-.831.296-.831.296s.11-.688.945-.55a.84.84 0 0 1 .616.484z'
  }
}

/**
 * The marks whose artwork is a set of solid shapes with nothing cut out of it.
 *
 * No underlay needed, and no calibration beyond the shared frame. Google's own G is four paths so
 * its four brand colours survive; the other three are the official simple-icons geometry.
 */
const SIMPLE_MARKS: Record<'google' | 'bing' | 'wikipedia' | 'perplexity', { d: string; fill: string }[]> = {
  google: [
    {
      fill: '#4285F4',
      d: 'M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.86c2.26-2.08 3.58-5.15 3.58-8.81z'
    },
    {
      fill: '#34A853',
      d: 'M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.87-3a7.23 7.23 0 0 1-10.76-3.79H1.35v3.09A12 12 0 0 0 12 24z'
    },
    {
      fill: '#FBBC05',
      d: 'M5.31 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.35a12 12 0 0 0 0 10.76l3.96-3.09z'
    },
    {
      fill: '#EA4335',
      d: 'M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A12 12 0 0 0 1.35 6.62l3.96 3.09A7.23 7.23 0 0 1 12 4.75z'
    }
  ],
  bing: [
    {
      fill: '#258FFB',
      d: 'M20.176 15.406a6.48 6.48 0 01-1.736 4.414c1.338-1.47.803-3.869-1.003-4.635-.862-.305-2.488-.85-3.367-1.158a1.834 1.834 0 01-.932-.818c-.381-.975-1.163-2.968-1.548-3.948-.095-.285-.31-.625-.265-.938.046-.598.724-1.003 1.276-.754l3.682 1.888c.621.292 1.305.692 1.796 1.172a6.486 6.486 0 012.097 4.777zm-1.44 1.888c-.264-1.194-1.135-1.744-2.216-2.028-1.527.902-4.853 2.878-6.952 4.13-1.103.68-2.13 1.35-2.919 1.242a2.866 2.866 0 01-2.77-2.325c-.012-.048-.008-.03-.001.01a6.4 6.4 0 00.947 2.653 6.498 6.498 0 005.486 3.022c1.908.062 3.536-1.153 5.099-2.096.292-.188.804-.496 1.332-.831l1.423-1.51c.553-.577.764-1.426.571-2.267zm-12.04 2.97c.422 0 .822-.1 1.173-.29.355-.215.964-.579 1.7-1.018L9.57 4.502c0-.99-.497-1.864-1.257-2.382-.08-.059-2.91-1.901-2.99-1.956-.605-.432-1.523.045-1.5.797v14.887l.417 2.36a2.488 2.488 0 002.455 2.056z'
    }
  ],
  wikipedia: [
    {
      fill: '#e6edf3',
      d: 'M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.421-.314.255-.557.616-.736 1.067 0 0-4.043 9.258-5.426 12.339-.525 1.007-1.053.917-1.503-.031-.571-1.171-1.773-3.786-2.646-5.71l.053-.036z'
    }
  ],
  perplexity: [
    {
      fill: '#20808D',
      d: 'M22.3977 7.0896h-2.3106V.0676l-7.5094 6.3542V.1577h-1.1554v6.1966L4.4904 0v7.0896H1.6023v10.3976h2.8882V24l6.932-6.3591v6.2005h1.1554v-6.0469l6.9318 6.1807v-6.4879h2.8882V7.0896zm-3.4657-4.531v4.531h-5.355l5.355-4.531zm-13.2862.0676 4.8691 4.4634H5.6458V2.6262zM2.7576 16.332V8.245h7.8476l-6.1149 6.1147v1.9723H2.7576zm2.8882 5.0404v-3.8852h.0001v-2.6488l5.7763-5.7764v7.0111l-5.7764 5.2993zm12.7086.0248-5.7766-5.1509V9.0618l5.7766 5.7766v6.5588zm2.8882-5.0652h-1.733v-1.9723L13.3948 8.245h7.8478v8.087z'
    }
  ]
}

/** The brand artwork for a mark that needs its white drawn, or null when it needs none. */
function brandArt(icon: PrefixBadgeIcon): BrandArt | null {
  if (icon === 'brave' || icon === 'duckduckgo') return BRAND_ART[icon]
  return null
}

/** The paths for a mark that is solid shapes only, or null when it is not one of those. */
function simpleMark(icon: PrefixBadgeIcon): { d: string; fill: string }[] | null {
  if (icon === 'google' || icon === 'bing' || icon === 'wikipedia' || icon === 'perplexity') {
    return SIMPLE_MARKS[icon]
  }
  return null
}

/** True when the field knows a brand mark of its own for this engine. */
function isEngineMark(icon: PrefixBadgeIcon): boolean {
  return brandArt(icon) !== null || simpleMark(icon) !== null
}

/**
 * One engine mark, drawn in the shared frame.
 *
 * Nothing here scales or measures: the artwork is used as its author published it, the frame does
 * the optical sizing, and the profile of the brand decides whether it needs a white underlay.
 */
function EngineMark({ icon, size }: { icon: PrefixBadgeIcon; size: number }) {
  const art = brandArt(icon)
  const simple = simpleMark(icon)
  return (
    <svg
      data-engine-mark={icon}
      viewBox={MARK_FRAME}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      {art ? (
        <>
          {/* The silhouette first, in the brand's own white: this is what the knockout reveals. */}
          <path d={art.under} fill={MARK_WHITE} />
          {/* Then the artwork as published, whose windings cut the face or the duck back out. */}
          <path d={art.d} fill={art.ink} />
        </>
      ) : (
        simple?.map((path) => <path key={path.d.slice(0, 24)} d={path.d} fill={path.fill} />)
      )}
    </svg>
  )
}

/** The octocat silhouette, reduced to the shape that still reads at badge size. */
function GitHubMark({ size = 10 }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        fill="#e6edf3"
        d="M12 2.5c-5.3 0-9.5 4.2-9.5 9.4 0 4.2 2.7 7.7 6.5 9 .5.1.7-.2.7-.5v-1.8c-2.6.6-3.2-1.1-3.2-1.1-.4-1-1-1.3-1-1.3-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.1-.2-4.3-1-4.3-4.6 0-1 .4-1.9 1-2.5-.1-.3-.4-1.3.1-2.7 0 0 .8-.2 2.6 1a9 9 0 0 1 4.7 0c1.8-1.2 2.6-1 2.6-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.5 1 2.5 0 3.6-2.2 4.4-4.3 4.6.4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5a9.5 9.5 0 0 0 6.4-9c0-5.2-4.2-9.4-9.5-9.4z"
      />
    </svg>
  )
}

/** Reddit's head: circle, antenna and two eyes. The fallback for the operator's image. */
function RedditMark({ size = 10 }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <g fill="#FF4500">
        <rect x="11.2" y="2.4" width="1.6" height="6" rx="0.8" />
        <circle cx="12.8" cy="2.6" r="1.8" />
        <circle cx="12" cy="14.6" r="8" />
      </g>
      <g fill="#0b0e14">
        <circle cx="9.2" cy="13.6" r="1.5" />
        <circle cx="14.8" cy="13.6" r="1.5" />
      </g>
      <path
        fill="#0b0e14"
        d="M8.4 17.6c1.9 1.5 5.3 1.5 7.2 0 .5-.4 1.2.1.9.7-.6 1.1-2.4 1.9-4.5 1.9s-3.9-.8-4.5-1.9c-.3-.6.4-1.1.9-.7z"
      />
    </svg>
  )
}

/** Amazon's smile. The fallback for the operator's image. */
function AmazonMark({ size = 10 }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <g fill="#FF9900">
        <circle cx="12" cy="8.4" r="4.4" fill="none" stroke="#FF9900" strokeWidth="2.2" />
        <path d="M16.4 8.4v2.2a2 2 0 0 0 2 2h.6v2.2h-1a3.6 3.6 0 0 1-3.6-3.6z" />
        <path d="M2.6 16.4h16.2c1.5 0 2.6.6 3.6 1.6-3.2 3.4-12 5.4-19.8 1z" />
      </g>
    </svg>
  )
}

/**
 * The mark for a resolved prefix badge.
 *
 * An engine is drawn inline in the shared frame. An image-backed mark renders the brand image and
 * falls back to its inline twin if it cannot be loaded; everything else is inline from the start.
 */
export function PrefixMark({ icon, size = 10 }: { icon: PrefixBadgeIcon; size?: number }) {
  if (isEngineMark(icon)) return <EngineMark icon={icon} size={size} />
  return <InlineMark icon={icon} size={size} />
}

/** The remaining inline marks: the GitHub octocat, the two hub fallbacks and the generic glyphs. */
function InlineMark({ icon, size = 10 }: { icon: PrefixBadgeIcon; size?: number }) {
  switch (icon) {
    case 'github':
      return <GitHubMark size={size} />
    case 'reddit':
      return <RedditMark size={size} />
    case 'amazon':
      return <AmazonMark size={size} />
    case 'shield':
      return <ShieldCheck size={size} className="text-[var(--devlens-accent)]" />
    case 'terminal':
      return <Terminal size={size} className="text-[var(--devlens-accent)]" />
    case 'ghost':
      return <Ghost size={size} className="text-violet-200" />
    case 'finder':
      return <SquareDashedMousePointer size={size} className="text-[var(--devlens-accent)]" />
    case 'tabs':
      return <Layers size={size} className="text-[var(--devlens-accent)]" />
    case 'cve':
      return <Server size={size} className="text-amber-300" />
    /* A row the operator added, before its favicon has arrived: the site's initial is honest,
       a brand mark drawn on their behalf would not be. */
    case 'custom':
      return <Globe size={size} className="text-ink-400" />
    default:
      return <Globe size={size} />
  }
}

/**
 * A mark for something the operator added.
 *
 * The site's own icon, through the same favicon pipeline the tab strip uses, inside the same box
 * as every other mark - and `object-contain`, so a wide icon and a square one sit the same way.
 * Nothing here is redrawn: a third-party icon is never run through the path normalisation the
 * built-ins get, because there is no artwork of ours to calibrate and a clipped logo is a worse
 * outcome than a small one.
 */
export function FaviconMark({
  label,
  iconUrl,
  size = 16
}: {
  label: string
  iconUrl?: string | null
  size?: number
}) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [iconUrl])
  const validImage =
    typeof iconUrl === 'string' && /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(iconUrl)
  if (validImage && !broken) {
    return (
      <img
        data-favicon-mark="true"
        src={iconUrl}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        draggable={false}
        onError={() => setBroken(true)}
        className="shrink-0 object-contain"
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    )
  }
  const initial = (label.trim()[0] ?? '?').toUpperCase()
  return (
    <span
      data-favicon-mark="initial"
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded bg-white/[0.06] font-mono text-ink-300"
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.6)) }}
    >
      {initial}
    </span>
  )
}
