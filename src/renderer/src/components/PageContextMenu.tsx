import { useEffect, useRef } from 'react'
import {
  Accessibility,
  AppWindow,
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  Braces,
  Camera,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  FileCode2,
  Ghost,
  Image as ImageIcon,
  Languages,
  Layers,
  Link2,
  Maximize2,
  MousePointerClick,
  RotateCw,
  Save,
  Scissors,
  ClipboardPaste,
  Search,
  Sparkles
} from 'lucide-react'
import { useMenuDismiss } from '@renderer/hooks/useMenuDismiss'
import type { PageCommandKind, PageContextMenuPayload } from '@shared/types'

/**
 * What the shell knows about a right-click in a page, plus the little the guest cannot know.
 *
 * `clipboard` is read in main before this menu is built, `canGoBack`/`canGoForward` come from the
 * frame's own navigation state, and `dev` is the workspace mode - all three decide whether a row
 * exists at all.
 */
export interface PageContextMenuContext {
  clipboard: string
  canGoBack: boolean
  canGoForward: boolean
  dev: boolean
  pageUrl: string
  pageTitle: string
  menuX: number
  menuY: number
}

export type PageContextAction =
  | {
      type: 'open-link'
      url: string
      title: string
      mode: 'tab' | 'split' | 'container' | 'window' | 'private' | 'preview'
    }
  | { type: 'bookmark-link'; url: string; title: string }
  | { type: 'bookmark-page'; url: string; title: string }
  | { type: 'save-page'; url: string; title: string }
  | { type: 'screenshot' }
  | { type: 'view-source' }
  | { type: 'copy-clean-link'; url: string }
  | { type: 'save-link'; url: string }
  | { type: 'save-image'; url: string }
  | { type: 'copy-image'; url: string }
  | { type: 'copy-image-data'; url: string }
  | { type: 'inspect-element'; x: number; y: number }
  | { type: 'inspect-accessibility'; x: number; y: number }
  | { type: 'translate-link'; url: string; text: string }
  | { type: 'ask-ai'; url: string; title: string }

interface PageContextMenuProps {
  payload: PageContextMenuPayload
  context: PageContextMenuContext
  onCommand: (command: PageCommandKind) => void
  onOpenUrl: (url: string) => void
  onCopyText: (text: string) => void
  onAction: (action: PageContextAction) => void
  onClose: () => void
}

interface Row {
  key: string
  label: string
  icon: typeof Copy
  run: () => void
  separatorBefore?: boolean
  shortcut?: string
}

/**
 * The page's own context menu.
 *
 * Every row here is built from an inspection that has *already happened*: the guest reported the
 * selection, whether the target is editable, and the nearest link or media element at the moment
 * of the right-click, and the clipboard was read before this component was mounted. So the list is
 * decided rather than decorated - there is no `disabled` prop in this file, and no row can appear
 * for something that cannot be done. A menu of five things that work beats a menu of fourteen with
 * nine greyed out, because the operator stops reading the second kind.
 */
export function PageContextMenu({
  payload,
  context,
  onCommand,
  onOpenUrl,
  onCopyText,
  onAction,
  onClose
}: PageContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  useMenuDismiss({ ref, onClose })

  const selection = payload.selection.trim()
  const hasSelection = selection.length > 0
  const canPaste = payload.editable && context.clipboard.length > 0

  const row = (
    key: string,
    label: string,
    icon: typeof Copy,
    run: () => void,
    separatorBefore = false,
    shortcut?: string
  ): Row => ({ key, label, icon, run, separatorBefore, shortcut })

  const groups: Row[][] = []

  /* Editing: Copy and Cut exist because something is selected; Paste exists because the target
     takes text *and* the clipboard has some. Nothing here is ever greyed out. */
  const editing: Row[] = []
  if (hasSelection) {
    editing.push(row('copy', 'Copy', Copy, () => onCommand('copy')))
    if (payload.editable) editing.push(row('cut', 'Cut', Scissors, () => onCommand('cut')))
  }
  if (canPaste) editing.push(row('paste', 'Paste', ClipboardPaste, () => onCommand('paste')))
  groups.push(editing)

  const pageOperations: Row[] = [
    row('save-page', 'Save Page As...', Save, () =>
      onAction({ type: 'save-page', url: context.pageUrl, title: context.pageTitle })
    ),
    row('select-all', 'Select All', MousePointerClick, () => onCommand('select-all')),
    row('screenshot', 'Take Screenshot', Camera, () => onAction({ type: 'screenshot' })),
    row('ask-ai-page', 'Ask AI Assistant', Sparkles, () =>
      onAction({ type: 'ask-ai', url: context.pageUrl, title: context.pageTitle }),
      false,
      'Z'
    ),
    row('view-source', 'View Page Source', FileCode2, () => onAction({ type: 'view-source' }))
  ]
  groups.push(pageOperations)

  /* The target's own affordances: a link offers link actions, media offers media actions, and a
     right-click on plain text offers neither because neither would apply. */
  const target: Row[] = []
  if (payload.linkUrl) {
    const linkTitle = payload.linkText || payload.linkUrl
    target.push(
      row('open-link', 'Open Link in New Tab', ExternalLink, () =>
        onAction({ type: 'open-link', url: payload.linkUrl!, title: linkTitle, mode: 'tab' })
      )
    )
    target.push(
      row('open-split', 'Open Link in Split View', Maximize2, () =>
        onAction({ type: 'open-link', url: payload.linkUrl!, title: linkTitle, mode: 'split' }),
        false,
        'M'
      )
    )
    target.push(
      row('open-container', 'Open Link in New Container Tab', Layers, () =>
        onAction({ type: 'open-link', url: payload.linkUrl!, title: linkTitle, mode: 'container' })
      )
    )
    target.push(
      row('open-window', 'Open Link in New Window', AppWindow, () =>
        onAction({ type: 'open-link', url: payload.linkUrl!, title: linkTitle, mode: 'window' })
      )
    )
    target.push(
      row('open-private', 'Open Link in Private Window', Ghost, () =>
        onAction({ type: 'open-link', url: payload.linkUrl!, title: linkTitle, mode: 'private' })
      )
    )
    target.push(
      row('preview-link', 'Preview Link', Eye, () =>
        onAction({ type: 'open-link', url: payload.linkUrl!, title: linkTitle, mode: 'preview' }),
        false,
        'J'
      )
    )
    target.push(
      row('bookmark-link', 'Bookmark Link...', BookmarkPlus, () =>
        onAction({ type: 'bookmark-link', url: payload.linkUrl!, title: linkTitle })
      )
    )
    target.push(
      row('save-link', 'Save Link As...', Save, () =>
        onAction({ type: 'save-link', url: payload.linkUrl! })
      )
    )
    target.push(row('copy-link', 'Copy Link', Link2, () => onCopyText(payload.linkUrl!)))
    target.push(
      row('copy-clean-link', 'Copy Clean Link', Link2, () =>
        onAction({ type: 'copy-clean-link', url: payload.linkUrl! }),
        false,
        'U'
      )
    )
  }
  if (payload.mediaUrl) {
    const mediaLabel = payload.mediaKind === 'img' ? 'Image' : 'Media'
    const dimensions =
      payload.mediaWidth && payload.mediaHeight
        ? ` · ${payload.mediaWidth}×${payload.mediaHeight}`
        : ''
    target.push(
      row('open-image', `Open ${mediaLabel} in New Tab`, ImageIcon, () =>
        onOpenUrl(payload.mediaUrl!)
      )
    )
    target.push(
      row('save-image', 'Save Image As...', Save, () =>
        onAction({ type: 'save-image', url: payload.mediaUrl! })
      )
    )
    target.push(
      row('copy-image', 'Copy Image', Copy, () =>
        onAction({ type: 'copy-image', url: payload.mediaUrl! })
      )
    )
    target.push(
      row('copy-image-link', 'Copy Image Link', Link2, () => onCopyText(payload.mediaUrl!))
    )
    target.push(
      row('copy-image-data', 'Copy Image as Data URI (Base64)', Braces, () =>
        onAction({ type: 'copy-image-data', url: payload.mediaUrl! })
      )
    )
    target.push(
      row(`inspect-image`, `Inspect Image Elements / Dimensions${dimensions}`, Search, () =>
        onAction({ type: 'inspect-element', x: payload.x, y: payload.y })
      )
    )
  }
  if (context.pageUrl) {
    target.push(row('copy-page', 'Copy Page URL', Link2, () => onCopyText(context.pageUrl), true))
  }
  groups.push(target)

  const intelligence: Row[] = []
  if (payload.linkUrl) {
    intelligence.push(
      row('translate-link', 'Translate Link Text', Languages, () =>
        onAction({
          type: 'translate-link',
          url: payload.linkUrl!,
          text: payload.linkText || payload.linkUrl!
        })
      )
    )
  }
  if (payload.linkUrl || payload.mediaUrl) {
    const askUrl = payload.linkUrl ?? payload.mediaUrl!
    intelligence.push(
      row('ask-ai-link', 'Ask AI about Link', Sparkles, () =>
        onAction({
          type: 'ask-ai',
          url: askUrl,
          title: payload.linkText || payload.mediaKind || askUrl
        })
      )
    )
  }
  if (context.dev) {
    intelligence.push(
      row('inspect-element', 'Inspect Element', Code2, () =>
        onAction({ type: 'inspect-element', x: payload.x, y: payload.y }),
        intelligence.length > 0,
        'Q'
      )
    )
    intelligence.push(
      row('inspect-accessibility', 'Inspect Accessibility Properties', Accessibility, () =>
        onAction({ type: 'inspect-accessibility', x: payload.x, y: payload.y })
      )
    )
  }
  groups.push(intelligence)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return
      }
      const key = event.key.toUpperCase()
      if (key === 'ESCAPE') {
        onClose()
        return
      }
      const entry = groups.flat().find((item) => item.shortcut === key)
      if (!entry) return
      event.preventDefault()
      entry.run()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [groups, onClose])

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Page options"
      data-testid="page-context-menu"
      style={{
        left: Math.max(8, Math.min(context.menuX, window.innerWidth - 346)),
        top: Math.max(8, Math.min(context.menuY, window.innerHeight - 120))
      }}
      className="fixed z-[85] max-h-[70vh] w-[330px] overflow-y-auto rounded-xl border border-[var(--devlens-hairline)] bg-[color-mix(in_srgb,var(--color-ink-950)_97%,transparent)] py-1 shadow-2xl"
    >
      <div className="mx-1.5 mb-1 flex items-center gap-1 border-b border-[var(--devlens-hairline)] px-1 pb-1.5">
        {([
          ['back', 'Back', ArrowLeft, context.canGoBack, () => onCommand('back')],
          ['forward', 'Forward', ArrowRight, context.canGoForward, () => onCommand('forward')],
          ['reload', 'Reload', RotateCw, true, () => onCommand('reload')],
          [
            'bookmark-page',
            'Bookmark Page',
            BookmarkPlus,
            Boolean(context.pageUrl),
            () => onAction({ type: 'bookmark-page', url: context.pageUrl, title: context.pageTitle })
          ]
        ] as const).map(([key, label, Icon, enabled, run]) => (
          <button
            key={key}
            type="button"
            aria-label={label}
            title={label}
            data-testid={`page-menu-nav-${key}`}
            disabled={!enabled}
            onClick={() => {
              run()
              onClose()
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-white/[0.06] hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
      {groups
        .filter((group) => group.length > 0)
        .map((group, index) => (
          <div
            key={group[0]?.key ?? index}
            className={
              index === 0
                ? ''
                : 'mt-1 border-t border-[var(--devlens-hairline)] pt-1'
            }
          >
            {group.map((entry) => {
              const Icon = entry.icon
              return (
                <button
                  key={entry.key}
                  type="button"
                  role="menuitem"
                  title={entry.label}
                  data-testid={`page-menu-${entry.key}`}
                  onClick={() => {
                    entry.run()
                    onClose()
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[11px] text-ink-200 transition-colors hover:bg-white/[0.05]"
                >
                  <Icon size={13} className="shrink-0 text-ink-500" />
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  {entry.shortcut && (
                    <span className="shrink-0 rounded border border-[var(--devlens-hairline)] px-1.5 py-0.5 font-mono text-[9px] text-ink-500">
                      {entry.shortcut}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
    </div>
  )
}
