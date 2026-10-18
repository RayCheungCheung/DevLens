import { useRef } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  MousePointerClick,
  RotateCw,
  Scissors,
  ClipboardPaste
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
}

interface PageContextMenuProps {
  payload: PageContextMenuPayload
  context: PageContextMenuContext
  onCommand: (command: PageCommandKind) => void
  onOpenUrl: (url: string) => void
  onCopyText: (text: string) => void
  onClose: () => void
}

interface Row {
  key: string
  label: string
  icon: typeof Copy
  run: () => void
  separatorBefore?: boolean
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
    separatorBefore = false
  ): Row => ({ key, label, icon, run, separatorBefore })

  const groups: Row[][] = []

  /* Navigation first: whatever the click landed on, these are the page-level verbs. Each is only
     present when the frame can actually perform it. */
  const navigation: Row[] = []
  if (context.canGoBack) navigation.push(row('back', 'Back', ArrowLeft, () => onCommand('back')))
  if (context.canGoForward) {
    navigation.push(row('forward', 'Forward', ArrowRight, () => onCommand('forward')))
  }
  navigation.push(row('reload', 'Reload', RotateCw, () => onCommand('reload')))
  groups.push(navigation)

  /* Editing: Copy and Cut exist because something is selected; Paste exists because the target
     takes text *and* the clipboard has some. Nothing here is ever greyed out. */
  const editing: Row[] = []
  if (hasSelection) {
    editing.push(row('copy', 'Copy', Copy, () => onCommand('copy')))
    if (payload.editable) editing.push(row('cut', 'Cut', Scissors, () => onCommand('cut')))
  }
  if (canPaste) editing.push(row('paste', 'Paste', ClipboardPaste, () => onCommand('paste')))
  editing.push(
    row('select-all', 'Select All', MousePointerClick, () => onCommand('select-all'), true)
  )
  groups.push(editing)

  /* The target's own affordances: a link offers link actions, media offers media actions, and a
     right-click on plain text offers neither because neither would apply. */
  const target: Row[] = []
  if (payload.linkUrl) {
    target.push(
      row('open-link', 'Open Link in New Tab', ExternalLink, () => onOpenUrl(payload.linkUrl!))
    )
    target.push(
      row('copy-link', 'Copy Link Address', Link2, () => onCopyText(payload.linkUrl!))
    )
  }
  if (payload.mediaUrl) {
    target.push(
      row('open-image', `Open ${payload.mediaKind ?? 'media'} in New Tab`, ImageIcon, () =>
        onOpenUrl(payload.mediaUrl!)
      )
    )
    target.push(
      row('copy-image', 'Copy Image Address', Link2, () => onCopyText(payload.mediaUrl!))
    )
  }
  if (context.pageUrl) {
    target.push(row('copy-page', 'Copy Page URL', Link2, () => onCopyText(context.pageUrl), true))
  }
  groups.push(target)

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Page options"
      data-testid="page-context-menu"
      style={{ left: payload.x, top: payload.y }}
      className="fixed z-[85] max-h-[70vh] w-[268px] overflow-y-auto rounded-xl border border-[var(--devlens-hairline)] bg-[color-mix(in_srgb,var(--color-ink-950)_97%,transparent)] py-1 shadow-2xl"
    >
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
                  data-testid={`page-menu-${entry.key}`}
                  onClick={() => {
                    entry.run()
                    onClose()
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[11px] text-ink-200 transition-colors hover:bg-white/[0.05]"
                >
                  <Icon size={13} className="shrink-0 text-ink-500" />
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                </button>
              )
            })}
          </div>
        ))}
    </div>
  )
}
