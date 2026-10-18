import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type ReactNode
} from 'react'
import {
  Bookmark,
  ChevronDown,
  Command,
  Ghost,
  Globe,
  History,
  Layers,
  LayoutPanelTop,
  Search,
  SlidersHorizontal,
  SquareDashedMousePointer,
  X
} from 'lucide-react'
import {
  engineMark,
  parseOmnibox,
  resolveSearchTarget,
  resolvePrefixBadge,
  type OmniboxAction,
  type OmniboxSuggestion,
  type SuggestionIcon
} from '@shared/omnibox'
import type { DefaultEngineRef, OmniboxEntry } from '@shared/omnibox-settings'
import { internalRouteLabel, internalRouteOf, internalRouteUrl } from '@shared/routes'
import { IconButton } from '@renderer/components/IconButton'
import { DevLensMark } from '@renderer/components/DevLensMark'
import { FaviconMark, MARK_BOX, PrefixMark } from '@renderer/components/PrefixIcons'
import { SiteProtectionPanel } from '@renderer/components/SiteProtectionPanel'
import type { ProtectionLevel } from '@shared/protection'
import type { ProtectionState } from '@shared/types'

interface OmniboxProps {
  value: string
  onChange: (value: string) => void
  /** Runs an action: navigation, search, panel switch, finder, command or ghost entry. */
  onRun: (action: OmniboxAction, raw: string, options?: { newTab?: boolean }) => void
  onFocusChange: (focused: boolean) => void
  suggestions: OmniboxSuggestion[]
  /** The engine this profile searches with. Its mark is the field's resting identity. */
  defaultEngine?: DefaultEngineRef
  /** Session chip (ghost / sandbox) rendered inside the field. */
  sessionChip?: ReactNode
  /** Small status line under the field, e.g. finder results. */
  hint?: string | null
  /**
   * Extreme defense mode watches pastes: a detected credential never lands in the field
   * unless the operator says so.
   */
  pasteGuard?: {
    enabled: boolean
    check: (text: string) => Promise<{ secret: boolean; reason: string }>
    onBlocked: (reason: string) => void
  }
  /**
   * The page on screen. With a page loaded the leading menu becomes the site protection panel;
   * on the dashboard - where "where do I search" is the only question that matters - it is the
   * search and navigation menu.
   */
  site?: { url: string; secure: boolean; iconUrl?: string | null } | null
  /** The active tab's canonical `devlens:` URL, when it is a system page. */
  internalUrl?: string | null
  protection?: ProtectionState
  protectionBusy?: boolean
  onProtectionLevel?: (level: ProtectionLevel) => void
  onToggleSiteProtection?: (allowed: boolean) => void
  onClearSiteData?: () => void
  /**
   * Which field this is.
   *
   * The new tab dashboard mounts the *same* component as the toolbar rather than a lookalike, so
   * prefixes, commands, ranking, the ghost completion and the keyboard contract cannot drift
   * between the two. `hero` only changes the presentation - the field is wider, taller and set
   * larger - and both sizes share one implementation of everything else.
   */
  variant?: 'toolbar' | 'hero'
  /**
   * Accessible name. There is one omnibox per surface and the toolbar's is `Omnibox`, so the
   * dashboard's has its own name: two fields called the same thing would be ambiguous to a
   * screen reader, and to a test looking the field up by name.
   */
  ariaLabel?: string
  /**
   * The operator's own engines and shortcuts, plus whatever favicon the shell has resolved for
   * each of them (keyed by entry id).
   *
   * A custom row has no mark of ours to draw, so its leading slot and its suggestion row use the
   * site's own icon - the same image the tab strip would show for that origin - inside the same
   * `MARK_BOX`. The field asks for neither list on its own: the settings page owns the entries and
   * the shell owns the icons, and both are handed down.
   */
  customs?: {
    entries: OmniboxEntry[]
    engines: OmniboxEntry[]
    shortcuts: OmniboxEntry[]
    favicons: Record<string, string | null>
  }
}

const ICONS: Record<SuggestionIcon, typeof Globe> = {
  search: Search,
  globe: Globe,
  history: History,
  ghost: Ghost,
  panel: LayoutPanelTop,
  find: SquareDashedMousePointer,
  tab: Layers,
  command: Command,
  hub: Globe
}

/**
 * The leading slot's menu.
 *
 * Firefox's engine button, adapted: the search engines first - in the operator's order - then the
 * places the omnibox can take you. Picking an engine rewrites only the prefix, so a query that is
 * already typed stays typed.
 */
const MENU_SECTIONS: { id: string; label: string; hint: string; icon: typeof Globe }[] = [
  { id: 'bookmarks', label: 'Bookmarks', hint: 'saved pages, ranked first', icon: Bookmark },
  { id: 'tabs', label: 'Tabs', hint: '% - jump to an open tab', icon: Layers },
  { id: 'history', label: 'History', hint: 'where you have been', icon: History },
  { id: 'actions', label: 'Actions', hint: '> - panels and modes', icon: LayoutPanelTop },
  {
    id: 'settings',
    label: 'Settings',
    hint: 'devlens:settings/omnibox',
    icon: SlidersHorizontal
  }
]

/**
 * Smart omnibox.
 *
 * The field is a plain controlled input; everything interesting is the dropdown and the
 * keyboard contract: Up/Down move through suggestions, Tab accepts a prefix hint into the
 * field, Enter runs the highlighted suggestion (or whatever the raw text parses to) and
 * Escape closes the list before it clears the field.
 *
 * When the highlighted row carries a local completion, the leftover text is painted as ghost
 * text behind the caret, the way Firefox hints an address it already knows. The ghost is a
 * separate layer rather than an input value, so typing never fights the fill.
 */
export function Omnibox({
  value,
  onChange,
  onRun,
  onFocusChange,
  suggestions,
  defaultEngine,
  sessionChip,
  hint,
  pasteGuard,
  site,
  internalUrl,
  protection,
  protectionBusy = false,
  onProtectionLevel,
  onToggleSiteProtection,
  onClearSiteData,
  variant = 'toolbar',
  ariaLabel = 'Omnibox',
  customs
}: OmniboxProps) {
  const formRef = useRef<HTMLFormElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const blurTimer = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [focused, setFocused] = useState(false)
  /** Where the input sits inside the field, so the ghost layer can line up with its text. */
  const [fieldBox, setFieldBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null)

  /**
   * The hero presentation.
   *
   * Only sizes differ. The input and the ghost layer read their text size from the same value:
   * the ghost is measured against the input's own box, so two independent font sizes would draw
   * the completion a few pixels off the caret.
   */
  const hero = variant === 'hero'
  const textSize = hero ? 'text-[14px]' : 'text-[12px]'
  const listId = hero ? 'dashboard-omnibox-suggestions' : 'omnibox-suggestions'
  /**
   * Test ids are namespaced by surface.
   *
   * The dashboard mounts the same component, so ids have to say *which* field they belong to:
   * two elements called `omnibox-leading` would be ambiguous to anything looking the slot up by
   * name - a screen reader, a test, or a future part of the shell.
   */
  const id = (name: string): string => (hero ? `dashboard-${name}` : name)

  const preview = useMemo(() => parseOmnibox(value), [value])
  const listOpen = open && focused && suggestions.length > 0
  /** The ghost completion offered by the highlighted row, if it has one. */
  const ghost = listOpen ? suggestions[highlight]?.completion : undefined
  /**
   * The leading prefix, painted as an icon chip. The text itself is untouched: the chip only
   * covers what it stands for, so the caret, selection and parsing all keep working normally.
   */
  const badge = useMemo(
    () => resolvePrefixBadge(value, customs?.entries ?? []),
    [customs?.entries, value]
  )
  /**
   * The engine the field searches with, resolved through the same table that ranks and runs the
   * dropdown. A custom engine therefore wears its own favicon here instead of falling back to a
   * generic magnifier.
   */
  const defaultSearch = useMemo(
    () => resolveSearchTarget(defaultEngine, customs?.entries ?? []),
    [customs?.entries, defaultEngine]
  )

  useEffect(() => {
    setHighlight(0)
  }, [value])

  useEffect(
    () => () => {
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current)
    },
    []
  )

  useEffect(() => {
    if (!listOpen) return
    const container = inputRef.current?.parentElement?.querySelector('[data-omnibox-list]')
    const row = container?.querySelector(`[data-index="${highlight}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [highlight, listOpen])

  /**
   * The ghost layer is absolutely positioned over the input, so it has to be told where the
   * input currently is. The form is the nearest positioned ancestor, which makes offset
   * measurements directly usable as layer coordinates.
   */
  useEffect(() => {
    const input = inputRef.current
    if (!input) return

    const measure = (): void => {
      const next = {
        top: input.offsetTop,
        left: input.offsetLeft,
        width: input.offsetWidth,
        height: input.offsetHeight
      }
      setFieldBox((current) =>
        current &&
        current.top === next.top &&
        current.left === next.left &&
        current.width === next.width &&
        current.height === next.height
          ? current
          : next
      )
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(input)
    if (formRef.current) observer.observe(formRef.current)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  /**
   * Ctrl/Cmd+L focuses the address bar and selects what is in it, the way every other browser
   * does. It matters most on the new tab page, which covers the whole window: the keyboard is
   * the only way to reach the field without a pointer.
   *
   * Only the toolbar's field answers to it. The front page mounts this component too, and two
   * listeners would race for the same keystroke - the address bar is what Ctrl+L means, so the
   * hero field leaves the shortcut to it.
   */
  useEffect(() => {
    if (hero) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'l') return
      event.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hero])

  /**
   * Menu dismissal: Escape and a click anywhere else.
   *
   * A window-level backdrop would not work inside the toolbar (its blur makes it the containing
   * block for fixed children), so the pointer is watched directly.
   */
  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setMenuOpen(false)
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (target && formRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [menuOpen])

  /** The stored engine whose mark the slot is currently showing, if any. */
  const activeEngine = badge?.entryId ?? null

  /**
   * Switches the search engine.
   *
   * Only the prefix moves: `@g react hooks` becomes `@d react hooks`, a bare URL is wrapped so the
   * engine can search it, and an empty field just gets the new prefix ready to type into.
   */
  const switchEngine = (engine: OmniboxEntry): void => {
    const rest = /^@\S*\s?/.test(value) ? value.replace(/^@\S*\s?/, '') : value.trim()
    onChange(`@${engine.keyword} ${rest}`.trimEnd() + (rest ? '' : ' '))
    setMenuOpen(false)
    inputRef.current?.focus()
    setOpen(true)
  }

  /**
   * The gear opens the full settings page, not a local popover and not a command prefix. The
   * internal router owns tab creation and deduplication, so this row has one destination whether
   * the control centre is already open or not.
   */
  const openSettingsCenter = (): void => {
    setMenuOpen(false)
    setOpen(false)
    inputRef.current?.blur()
    onRun(
      {
        kind: 'internal',
        route: 'omnibox-settings',
        url: internalRouteUrl('omnibox-settings'),
        label: internalRouteLabel('omnibox-settings')
      },
      value
    )
  }

  /** The remaining navigation rows all mean the same thing: aim the field at a prefix. */
  const goToSection = (section: string): void => {
    if (section === 'settings') {
      openSettingsCenter()
      return
    }
    const prefix = section === 'tabs' ? '%' : section === 'actions' ? '>' : ''
    onChange(prefix)
    setMenuOpen(false)
    inputRef.current?.focus()
    setOpen(true)
  }

  /**
   * Which menu the leading slot opens.
   *
   * A loaded page means the operator is looking at a site, so the slot answers "is this page
   * safe and how is it being treated". The dashboard has no site to talk about, so it answers
   * "where do I go from here".
   */
  const siteUrl = site?.url ?? ''
  const siteLoaded =
    siteUrl.length > 0 && siteUrl !== 'about:blank' && !siteUrl.startsWith('devlens://')
  const siteMenu = siteLoaded && protection
  const internal = useMemo(() => internalRouteOf(internalUrl), [internalUrl])
  /**
   * A loaded page owns the leading slot only while the field is at rest and still mirrors that
   * page. Focusing it, typing a query or clearing it means the operator is ready to search, so
   * the slot hands the identity back to the profile's default engine.
   */
  const siteAtRest = siteLoaded && !focused && mirrorsLoadedPage(value, siteUrl)

  const run = (suggestion: OmniboxSuggestion, options?: { newTab?: boolean }): void => {
    if (suggestion.action.kind === 'insert') {
      onChange(suggestion.action.text)
      inputRef.current?.focus()
      return
    }
    onRun(suggestion.action, value, options)
    setOpen(false)
    inputRef.current?.blur()
  }

  /** Tab or Right-arrow on an inline completion: fill the field, keep the caret at the end. */
  const acceptCompletion = (): boolean => {
    const completion = listOpen ? suggestions[highlight]?.completion : undefined
    if (!completion) return false
    onChange(completion.value)
    inputRef.current?.focus()
    return true
  }

  const submit = (options?: { newTab?: boolean }): void => {
    if (listOpen && suggestions[highlight]) {
      run(suggestions[highlight], options)
      return
    }
    if (preview && preview.kind !== 'insert') {
      onRun(preview, value, options)
    }
    setOpen(false)
    inputRef.current?.blur()
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!suggestions.length) return
      setOpen(true)
      setHighlight((current) => (current + 1) % suggestions.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!suggestions.length) return
      setOpen(true)
      setHighlight((current) => (current - 1 + suggestions.length) % suggestions.length)
      return
    }
    if (event.key === 'Tab' && listOpen && suggestions[highlight]?.action.kind === 'insert') {
      event.preventDefault()
      const action = suggestions[highlight].action
      if (action.kind === 'insert') onChange(action.text)
      return
    }
    if (event.key === 'Tab' && acceptCompletion()) {
      event.preventDefault()
      return
    }
    if (
      event.key === 'ArrowRight' &&
      inputRef.current &&
      inputRef.current.selectionStart === value.length &&
      acceptCompletion()
    ) {
      event.preventDefault()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      if (listOpen) {
        setOpen(false)
        return
      }
      onChange(preview && preview.kind === 'navigate' ? preview.url : value)
      inputRef.current?.blur()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      // Alt+Enter opens the page in its own tab, like every other browser.
      submit({ newTab: event.altKey })
    }
  }

  /** Paste sentinel: classify before the value reaches the input. */
  const onPaste = (event: ReactClipboardEvent<HTMLInputElement>): void => {
    if (!pasteGuard?.enabled) return
    const text = event.clipboardData?.getData('text') ?? ''
    if (!text) return

    event.preventDefault()
    void pasteGuard.check(text).then((verdict) => {
      if (verdict.secret) {
        pasteGuard.onBlocked(verdict.reason)
        return
      }
      onChange(`${value}${text}`)
    })
  }

  /**
   * The leading slot is the field's identity chip: the loaded site's favicon at rest, the
   * default engine when the field is ready to search, the recognised brand mark the moment a
   * prefix matches, and the raw prefix hint while a token is still being typed. Nothing is ever
   * drawn *over* the text - the input stays plain and editable.
   */
  const prefixHint = describePrefix(value)
  const leading = internal
    ? {
        icon: 'devlens',
        title: `${internalRouteLabel(internal)} - DevLens page`,
        token: null,
        kind: 'devlens' as const
      }
    : badge
      ? {
        icon: badge.icon as string,
        title: badge.label,
        token: badge.token,
        kind: 'badge' as const
      }
    : prefixHint
      ? {
          icon: 'prefix',
          title: prefixHint,
          token: value.trimStart().slice(0, 1),
          kind: 'hint' as const
        }
      : siteAtRest
        ? {
            icon: 'favicon',
            title: `${siteLabel(siteUrl)} - page protection`,
            token: null,
            kind: 'site' as const
          }
        : {
            icon: defaultSearch.mark ?? 'custom',
            title: `${defaultSearch.label} - default search engine`,
            token: null,
            kind: 'default' as const
          }

  return (
    <form
      ref={formRef}
      className={[
        'nova-field relative flex min-w-0 items-center rounded-full',
        hero ? 'h-12 w-full gap-3 px-3.5' : 'mx-1 flex-1 gap-2 px-2.5 py-1.5'
      ].join(' ')}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      {/* Leading slot: the loaded site at rest, the default engine when the field is ready to
          search, the brand logo once a prefix is recognised, and the trigger for the engine /
          navigation menu. One fixed shape, so nothing shifts. */}
      <button
        type="button"
        data-testid={id('omnibox-leading')}
        data-prefix-icon={leading.icon}
        data-prefix-token={leading.token ?? ''}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Search engines and navigation"
        title={`${leading.title} - pick a search engine or where to go`}
        onClick={() => setMenuOpen((value) => !value)}
        /* A fixed box so switching between a site favicon, the default engine and a prefix brand
           cannot move the text: only what is drawn inside the box changes. */
        className={[
          'flex shrink-0 items-center gap-0.5 rounded-full transition-colors',
          hero ? 'h-7 pr-1.5 pl-2' : 'h-6 pr-1 pl-1.5',
          menuOpen ||
          leading.kind === 'badge' ||
          leading.kind === 'default' ||
          leading.kind === 'devlens'
            ? 'bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
            : 'bg-white/[0.04] text-ink-400'
        ].join(' ')}
      >
        <span className={[MARK_BOX, hero ? 'h-6 w-6' : 'h-5 w-5'].join(' ')}>
          {leading.kind === 'badge' && badge ? (
            /* One size for every mark in this slot. It used to mean two different things - an
               image and a glyph drawn to the same number were not the same visual weight - but
               the engine marks are normalized inline geometry now, so one number is the truth. */
            badge.icon !== 'custom' ? (
              <PrefixMark icon={badge.icon} size={hero ? 20 : 18} />
            ) : badge.entryId ? (
              /* A user-defined row: the site's own icon, in the same box as every other mark. */
              <FaviconMark
                label={badge.label}
                iconUrl={customs?.favicons[badge.entryId]}
                size={hero ? 18 : 16}
              />
            ) : (
              <PrefixMark icon={badge.icon} size={hero ? 20 : 18} />
            )
          ) : leading.kind === 'hint' ? (
            <span className={['font-mono', hero ? 'text-[15px]' : 'text-[13px]'].join(' ')}>
              {leading.token}
            </span>
          ) : leading.kind === 'devlens' ? (
            <DevLensMark
              size={hero ? 18 : 16}
              className="text-[var(--devlens-accent)]"
            />
          ) : leading.kind === 'site' ? (
            <FaviconMark
              label={siteLabel(siteUrl)}
              iconUrl={site?.iconUrl}
              size={hero ? 18 : 16}
            />
          ) : defaultSearch.mark ? (
            <PrefixMark icon={defaultSearch.mark} size={hero ? 20 : 18} />
          ) : defaultSearch.entry ? (
            <FaviconMark
              label={defaultSearch.label}
              iconUrl={customs?.favicons[defaultSearch.entry.id]}
              size={hero ? 18 : 16}
            />
          ) : (
            <PrefixMark icon={defaultSearch.mark ?? 'custom'} size={hero ? 20 : 18} />
          )}
        </span>
        <ChevronDown
          size={10}
          data-testid={id('omnibox-leading-caret')}
          className={['shrink-0 transition-transform', menuOpen ? 'rotate-180' : ''].join(' ')}
        />
      </button>

      {menuOpen && (
        <div
          role="menu"
          aria-label={siteMenu ? 'Site protection' : 'Search engines and navigation'}
          data-testid={id(siteMenu ? 'omnibox-site-menu' : 'omnibox-menu')}
          className="absolute top-[calc(100%+8px)] left-0 z-[70] w-[290px] overflow-hidden rounded-xl border border-[var(--devlens-hairline)] bg-[color-mix(in_srgb,var(--color-ink-950)_97%,transparent)] shadow-2xl"
        >
          {siteMenu && site && protection ? (
            <SiteProtectionPanel
              url={site.url}
              secure={site.secure}
              protection={protection}
              busy={protectionBusy}
              onToggleSiteProtection={(allowed) => {
                onToggleSiteProtection?.(allowed)
                setMenuOpen(false)
              }}
              onClearSiteData={() => {
                onClearSiteData?.()
                setMenuOpen(false)
              }}
              onLevelChange={(level) => onProtectionLevel?.(level)}
            />
          ) : (
            <>
          <p className="border-b border-[var(--devlens-hairline)] px-3 py-1.5 text-[10px] tracking-wide text-ink-500 uppercase">
            Search with
          </p>
          <div className="py-1">
            {(customs?.engines ?? []).map((engine) => {
              const current = engine.id === activeEngine
              return (
                <button
                  key={engine.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current}
                  aria-label={`Search with ${engine.label}`}
                  data-testid={id(`omnibox-engine-${engine.builtInEngine ?? engine.id}`)}
                  data-engine-token={`@${engine.keyword}`}
                  onClick={() => switchEngine(engine)}
                  className={[
                    'flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors',
                    current ? 'bg-[var(--devlens-accent-soft)]' : 'hover:bg-white/[0.04]'
                  ].join(' ')}
                >
                  {/* The same box as every other mark in the shell, and a 16px glyph inside it.
                      Every engine mark is normalized inline geometry, so the ink lands on the
                      same optical size whatever the brand's own viewBox happens to be. */}
                  <span className={[MARK_BOX, 'h-5 w-5'].join(' ')}>
                    {engine.builtInEngine ? (
                      <PrefixMark icon={engineMark(engine.builtInEngine) ?? 'custom'} size={16} />
                    ) : (
                      <FaviconMark
                        label={engine.label}
                        iconUrl={customs?.favicons[engine.id]}
                        size={16}
                      />
                    )}
                  </span>
                  {/* Full name, wrapped rather than cut: the token on the right is the shortcut,
                      the name on the left is the thing being chosen. */}
                  <span
                    className="min-w-0 flex-1 text-[11px] break-words text-ink-200"
                    title={engine.label}
                  >
                    {engine.label}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-500">
                    @{engine.keyword}
                  </span>
                </button>
              )
            })}
            {(customs?.engines.length ?? 0) === 0 && (
              <p className="px-3 py-2 text-[11px] text-ink-400">No search engines configured.</p>
            )}
          </div>

          <p className="border-t border-b border-[var(--devlens-hairline)] px-3 py-1.5 text-[10px] tracking-wide text-ink-500 uppercase">
            Go to
          </p>
          <div className="py-1">
            {MENU_SECTIONS.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  type="button"
                  role="menuitem"
                  aria-label={section.label}
                  data-testid={id(`omnibox-section-${section.id}`)}
                  onClick={() => goToSection(section.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <Icon size={13} className="shrink-0 text-ink-500" />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-ink-200">
                    {section.label}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-ink-600">{section.hint}</span>
                </button>
              )
            })}
          </div>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        value={value}
        spellCheck={false}
        autoComplete="off"
        placeholder="Search, paste a URL, or start with @ # > : & *"
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listId}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          if (blurTimer.current !== null) {
            window.clearTimeout(blurTimer.current)
            blurTimer.current = null
          }
          setFocused(true)
          setOpen(true)
          onFocusChange(true)
        }}
        onBlur={() => {
          setFocused(false)
          onFocusChange(false)
          if (blurTimer.current !== null) window.clearTimeout(blurTimer.current)
          blurTimer.current = window.setTimeout(() => {
            blurTimer.current = null
            setOpen(false)
          }, 120)
        }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        className={[
          'min-w-0 flex-1 bg-transparent font-mono text-ink-100 outline-none placeholder:text-ink-500/70',
          textSize
        ].join(' ')}
      />

      {/* Inline completion: an invisible copy of what was typed keeps the metrics exact, so
          the dimmed remainder starts right where the caret is. Purely decorative. */}
      {ghost && fieldBox && (
        <span
          aria-hidden="true"
          data-omnibox-ghost
          className={[
            'pointer-events-none absolute flex items-center overflow-hidden font-mono whitespace-pre',
            textSize
          ].join(' ')}
          style={{
            top: fieldBox.top,
            left: fieldBox.left,
            width: fieldBox.width,
            height: fieldBox.height
          }}
        >
          <span className="invisible">{value}</span>
          <span className="text-ink-500/80">{ghost.ghost}</span>
        </span>
      )}

      {sessionChip}

      {value.length > 0 && (
        <IconButton
          label={hero ? 'Clear the front page field' : 'Clear omnibox'}
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
        >
          <X size={12} />
        </IconButton>
      )}

      {hint && (
        <span className="max-w-[45%] shrink-0 truncate rounded-full bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] text-ink-400">
          {hint}
        </span>
      )}

      {listOpen && (
        <ul
          id={listId}
          data-omnibox-list
          role="listbox"
          className={[
            'nova-glass absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-y-auto rounded-xl py-1.5 shadow-2xl',
            hero ? 'max-h-96' : 'max-h-80'
          ].join(' ')}
        >
          {suggestions.map((suggestion, index) => {
            const Icon = ICONS[suggestion.icon]
            return (
              <li key={suggestion.id}>
                <button
                  type="button"
                  data-index={index}
                  role="option"
                  aria-selected={index === highlight}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    run(suggestion, { newTab: event.altKey || event.ctrlKey || event.metaKey })
                  }}
                  className={[
                    'flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors',
                    index === highlight
                      ? 'bg-[var(--devlens-accent-soft)]'
                      : 'hover:bg-white/[0.04]'
                  ].join(' ')}
                >
                  {/* One box for every row: a brand mark when the row knows its engine, the
                      generic glyph otherwise - all of them the same size, so the list reads as a
                      column of logos rather than as a ragged mixture. */}
                  <span
                    data-testid="omnibox-suggestion-mark"
                    data-mark={suggestion.mark ?? ''}
                    data-entry={suggestion.entryId ?? ''}
                    className={[MARK_BOX, 'h-5 w-5'].join(' ')}
                  >
                    {suggestion.mark ? (
                      <PrefixMark icon={suggestion.mark} size={16} />
                    ) : suggestion.entryId ? (
                      /* A user-defined row: its site's icon, never a redrawn logo. */
                      <FaviconMark
                        label={suggestion.title}
                        iconUrl={suggestion.iconUrl ?? customs?.favicons[suggestion.entryId]}
                        size={16}
                      />
                    ) : (
                      <Icon
                        size={14}
                        className={
                          suggestion.kind === 'hint' ? 'text-[var(--devlens-accent)]' : 'text-ink-500'
                        }
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    {/* One span for the name, chip included: the row's own selectors and the
                        ghost-text measurement both read this element, so it stays a leaf rather
                        than gaining a wrapper. */}
                    <span className="block min-w-0 font-mono text-[11px] break-words text-ink-200">
                      {suggestion.title}
                      {suggestion.defaultEngine && (
                        <span
                          data-testid="omnibox-suggestion-default"
                          className="ml-2 rounded bg-[var(--devlens-accent-soft)] px-1 font-mono text-[9px] text-[var(--devlens-accent)]"
                        >
                          default
                        </span>
                      )}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-ink-500">
                      {suggestion.subtitle}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[9px] tracking-wide text-ink-600 uppercase">
                    {suggestion.kind}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </form>
  )
}

/** Short label for the active prefix so the field explains itself while typing. */
function describePrefix(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const prefix = trimmed[0]
  if (!'@#>:*&'.includes(prefix)) return null

  const token = trimmed.slice(1).split(/\s/)[0]
  if (prefix === '@') return token ? `@${token}` : '@ search engine'
  if (prefix === '#') return token ? `#${token}` : '# platform hub'
  if (prefix === '>') return token ? `>${token}` : '> mode switch'
  if (prefix === ':') return token ? `:${token}` : ': system command'
  if (prefix === '&') return '& DOM finder'
  return '* ghost session'
}

/** The page's short identity for the leading favicon and its tooltip. */
function siteLabel(url: string): string {
  try {
    return new URL(url).hostname || url
  } catch {
    return url
  }
}

/**
 * Whether the field is still showing the page that is actually loaded.
 *
 * Exact string equality covers the normal status update. The URL round-trip covers a lone
 * trailing slash, which Chromium adds when it canonicalises an origin.
 */
function mirrorsLoadedPage(value: string, url: string): boolean {
  const left = value.trim()
  const right = url.trim()
  if (!left || !right) return false
  if (left === right) return true
  try {
    const a = new URL(left)
    const b = new URL(right)
    a.hash = ''
    b.hash = ''
    return a.href.replace(/\/$/, '') === b.href.replace(/\/$/, '')
  } catch {
    return false
  }
}

