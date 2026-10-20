import { ipcRenderer, webFrame } from 'electron'
import type { IpcChannel } from '../shared/ipc'
import type { FindHit, FindResult, ScrollSyncMessage } from '../shared/types'

/**
 * Bridge injected into every <webview> guest.
 *
 * It runs in the isolated world, so it can talk to the shell through
 * `ipcRenderer.sendToHost` without ever exposing an API to the page itself.
 *
 * Scroll sync:
 *   guest -> shell : viewportScroll      (`ipc-message` event on the webview element)
 *   shell -> guest : viewportApplyScroll (webview.send from the renderer)
 *
 * This is the low-latency path. The shell also reconciles both viewports on a timer,
 * because a viewport scroll does not always surface as a `scroll` event (programmatic
 * jumps are the usual suspect) and a missed event must not desync the pair.
 *
 * The channel names are spelled out instead of imported from shared/ipc: a sandboxed
 * preload is executed without `require`, so this bundle has to stay self-contained.
 * The `satisfies IpcChannel` checks keep them aligned with the shared contract.
 */
const SCROLL_CHANNEL = 'devlens:viewport:scroll' satisfies IpcChannel
const APPLY_SCROLL_CHANNEL = 'devlens:viewport:apply-scroll' satisfies IpcChannel
const DESIGN_MODE_CHANNEL = 'devlens:viewport:design-mode' satisfies IpcChannel
const FIND_CHANNEL = 'devlens:viewport:find' satisfies IpcChannel
const FIND_RESULT_CHANNEL = 'devlens:viewport:find-result' satisfies IpcChannel
const TEXT_FIND_CHANNEL = 'devlens:viewport:text-find' satisfies IpcChannel
const TEXT_FIND_RESULT_CHANNEL = 'devlens:viewport:text-find-result' satisfies IpcChannel
const CONTEXT_MENU_CHANNEL = 'devlens:viewport:context-menu' satisfies IpcChannel
const ZOOM_WHEEL_RESULT_CHANNEL = 'devlens:viewport:zoom-wheel-result' satisfies IpcChannel
const FOLD_CHANNEL = 'devlens:viewport:fold' satisfies IpcChannel
const MODE_CHANNEL = 'devlens:viewport:mode' satisfies IpcChannel

/**
 * Capability lock.
 *
 * Normal mode is neither a monitored browser nor an authoring surface, so the guest refuses
 * design mode and DOM finding while it is locked. Enforcing that in the page's own bridge
 * means a shell bug cannot hand a "clean" session developer powers.
 *
 * The one exception is the on-demand inspection lease: while the operator has the WImH
 * overlay open, the shell may borrow page tooling for that panel alone. The lease is a
 * separate flag so the guest can still report "locked" mode - the browser as a whole is
 * unchanged - and it is dropped the moment the panel closes.
 */
let devCapabilitiesEnabled = true
let inspectionLease = false

/** Page tooling is available in dev mode, or while an explicit inspection lease is held. */
function canInspectPage(): boolean {
  return devCapabilitiesEnabled || inspectionLease
}

const DESIGN_MODE_STYLE_ID = 'devlens-design-mode-style'
const FIND_STYLE_ID = 'devlens-find-style'
const TEXT_FIND_STYLE_ID = 'devlens-text-find-style'
const TEXT_FIND_HIGHLIGHT = 'devlens-page-find'
const TEXT_FIND_CURRENT_HIGHLIGHT = 'devlens-page-find-current'
const FIND_ATTR = 'data-devlens-find-index'
const FIND_LIMIT = 200
const TEXT_FIND_LIMIT = 500
const DESIGN_MODE_CSS = [
  'html { caret-color: #14b8a6; }',
  'body *:hover { outline: 1px dashed rgba(45, 212, 191, 0.55) !important; outline-offset: -1px; }',
  'body *:focus { outline: 1px solid rgba(45, 212, 191, 0.9) !important; outline-offset: -1px; }'
].join('\n')

/**
 * The emulated fold, as the page can see it.
 *
 * A foldable preview is only honest if the page can tell it is on a fold: a hinge is a real gap
 * that content must not be laid out across, and a page that cannot find out about it either
 * straddles the seam or ignores the second panel. So the shell pushes the state and the guest
 * publishes it on the document - an attribute for CSS (`[data-devlens-fold="dual"]`) and a custom
 * property for the gap - which is the same shape the real APIs expose, minus the ones Chromium
 * does not have.
 */
let foldState: { state: string; hinge: number } = { state: 'main', hinge: 0 }

function applyFold(): void {
  const root = document.documentElement
  if (!root) return
  root.setAttribute('data-devlens-fold', foldState.state)
  root.style.setProperty('--devlens-fold-hinge', `${foldState.hinge}px`)
}

ipcRenderer.on(FOLD_CHANNEL, (_event, message: { state?: string; hinge?: number }) => {
  foldState = {
    state: typeof message?.state === 'string' ? message.state : 'main',
    hinge: Number.isFinite(message?.hinge) ? Math.max(0, Number(message?.hinge)) : 0
  }
  applyFold()
})

window.addEventListener('DOMContentLoaded', applyFold)

const SCROLL_THROTTLE_MS = 60
const APPLY_LOCK_MS = 120
/** Cadence of the fallback position sampler. */
const SAMPLE_INTERVAL_MS = 100
/** Ignore sub-pixel level drift so an idle page never reports. */
const RATIO_EPSILON = 0.0005

let lastSentAt = 0
let trailingSend: number | null = null
let applyingRemoteScroll = false
let lastReportedRatio = -1

function scrollingElement(): Element {
  return document.scrollingElement ?? document.documentElement
}

function currentScroll(): ScrollSyncMessage {
  const element = scrollingElement()
  const scrollHeight = element.scrollHeight
  const innerHeight = window.innerHeight
  const max = scrollHeight - innerHeight
  const scrollTop = element.scrollTop
  return {
    ratio: max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0,
    scrollTop,
    scrollHeight,
    innerHeight
  }
}

function emitScroll(snapshot: ScrollSyncMessage): void {
  lastSentAt = Date.now()
  lastReportedRatio = snapshot.ratio
  // `sendToHost` lands as an `ipc-message` event on the <webview> element.
  ipcRenderer.sendToHost(SCROLL_CHANNEL, snapshot)
}

/**
 * Trailing-edge throttle. A leading-edge throttle can swallow the only scroll event
 * of a programmatic jump (for example when the page jumps back to the top), which
 * would leave the twin viewport stranded, so the last position always gets sent.
 */
function scheduleReport(snapshot: ScrollSyncMessage): void {
  const now = Date.now()
  const elapsed = now - lastSentAt

  if (elapsed >= SCROLL_THROTTLE_MS) {
    emitScroll(snapshot)
    return
  }

  if (trailingSend !== null) return
  trailingSend = window.setTimeout(() => {
    trailingSend = null
    emitScroll(currentScroll())
  }, SCROLL_THROTTLE_MS - elapsed)
}

/**
 * Report the current position, but only when the ratio actually moved.
 *
 * Reporting on every event would flood the shell: a frame that is merely resizing
 * (a scrollbar appearing, the canvas recalculating) fires events without the reader
 * having scrolled anywhere, and relaying those would yank the twin viewport back.
 */
function reportScroll(): void {
  if (applyingRemoteScroll) return

  const snapshot = currentScroll()
  if (lastReportedRatio >= 0 && Math.abs(snapshot.ratio - lastReportedRatio) < RATIO_EPSILON) {
    return
  }
  scheduleReport(snapshot)
}

/**
 * Applies the twin viewport's position. The ratio is remembered so that a page which
 * is still growing (images, late layout) re-applies it once it can actually scroll.
 */
function applyRatio(ratio: number): void {
  const element = scrollingElement()
  const max = element.scrollHeight - window.innerHeight
  if (max <= 0) return

  applyingRemoteScroll = true
  element.scrollTop = Math.round(max * ratio)
  // Remember where we just put this viewport so it does not echo the move back.
  lastReportedRatio = ratio
  window.setTimeout(() => {
    applyingRemoteScroll = false
  }, APPLY_LOCK_MS)
}

ipcRenderer.on(APPLY_SCROLL_CHANNEL, (_event, message: { ratio: number }) => {
  if (typeof message?.ratio !== 'number') return
  applyRatio(message.ratio)
})

/**
 * Live design mode.
 *
 * `document.designMode` is a document level switch, so setting it from the isolated
 * world affects the page the user sees. The hover outline is added here because the
 * flag alone gives no feedback about what is editable.
 */
function applyDesignMode(enabled: boolean): void {
  if (enabled && !canInspectPage()) {
    // Locked: the page stays untouched and the request is ignored.
    document.documentElement.dataset.devlensDesignMode = 'locked'
    return
  }
  try {
    document.designMode = enabled ? 'on' : 'off'
  } catch {
    return
  }

  document.documentElement.dataset.devlensDesignMode = enabled ? 'on' : 'off'
  const existing = document.getElementById(DESIGN_MODE_STYLE_ID)

  if (!enabled) {
    existing?.remove()
    return
  }
  if (existing) return

  const style = document.createElement('style')
  style.id = DESIGN_MODE_STYLE_ID
  style.textContent = DESIGN_MODE_CSS
  ;(document.head ?? document.documentElement).appendChild(style)
}

ipcRenderer.on(DESIGN_MODE_CHANNEL, (_event, message: { enabled: boolean }) => {
  applyDesignMode(Boolean(message?.enabled))
})

/**
 * `& <selector>` - DOM and component finder.
 *
 * Matching runs here in the isolated world (querySelectorAll, classList and attributes are
 * shared DOM state), but React stores its fiber expando in the page's own world. The nodes
 * are tagged with an index attribute here and the main world is asked for the component
 * names of exactly those nodes, so each half runs where it can actually see the data.
 */
ipcRenderer.on(FIND_CHANNEL, (_event, message: { selector?: string; clear?: boolean }) => {
  void handleFind(String(message?.selector ?? ''), Boolean(message?.clear))
})

ipcRenderer.on(
  TEXT_FIND_CHANNEL,
  (
    _event,
    message: { query?: string; forward?: boolean; findNext?: boolean; clear?: boolean }
  ) => {
    if (message?.clear) {
      clearTextFind()
      return
    }
    runTextFind(
      String(message?.query ?? ''),
      message?.forward !== false,
      message?.findNext === true
    )
  }
)

ipcRenderer.on(MODE_CHANNEL, (_event, message: { dev?: boolean; inspection?: boolean }) => {
  devCapabilitiesEnabled = Boolean(message?.dev)
  inspectionLease = devCapabilitiesEnabled ? false : Boolean(message?.inspection)
  document.documentElement.dataset.devlensMode = devCapabilitiesEnabled ? 'dev' : 'locked'
  document.documentElement.dataset.devlensInspection = inspectionLease ? 'granted' : 'none'
  if (!canInspectPage()) {
    // Drop whatever the developer workspace or the lease had switched on.
    applyDesignMode(false)
    clearFind()
  }
})

async function handleFind(selector: string, clear: boolean): Promise<void> {
  try {
    clearFind()
    if (!canInspectPage()) {
      sendFindResult({
        viewId: 'mobile',
        selector,
        matches: 0,
        hits: [],
        error: 'the DOM finder is a dev mode tool'
      })
      return
    }
    if (!selector || clear) {
      sendFindResult({ viewId: 'mobile', selector, matches: 0, hits: [], error: null })
      return
    }

    let nodes: Element[] = []
    try {
      nodes = Array.from(document.querySelectorAll(selector)).slice(0, FIND_LIMIT)
    } catch {
      sendFindResult({
        viewId: 'mobile',
        selector,
        matches: 0,
        hits: [],
        error: `"${selector}" is not a valid selector`
      })
      return
    }

    injectFindStyle()
    nodes.forEach((node, index) => node.setAttribute(FIND_ATTR, String(index)))
    nodes[0]?.scrollIntoView({ block: 'center', inline: 'nearest' })

    const components = await readReactComponents(nodes.length)
    const hits: FindHit[] = nodes
      .slice(0, 12)
      .map((node, index) => describeNode(node, components[index] ?? null))

    sendFindResult({
      viewId: 'mobile',
      selector,
      matches: nodes.length,
      hits,
      error: nodes.length === 0 ? `no element matches "${selector}"` : null
    })
  } catch (error) {
    sendFindResult({
      viewId: 'mobile',
      selector,
      matches: 0,
      hits: [],
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * The shell's Find Bar, implemented against the page's text rather than a browser dialog.
 *
 * Chromium's embedded-webview finder returns a request id in this runtime but does not emit
 * results, so the guest does the deterministic half: collect text ranges, paint every match with
 * the CSS Custom Highlight API, scroll the active one into view, and report its ordinal. The DOM
 * itself is never wrapped or rewritten, so React pages and live apps keep their structure.
 */
let textFindQuery = ''
let textFindRanges: Range[] = []
let textFindIndex = 0
let textFindUsesSelection = false

function runTextFind(query: string, forward: boolean, findNext: boolean): void {
  const clean = query.trim()
  if (!clean) {
    clearTextFind()
    return
  }

  if (clean !== textFindQuery || textFindRanges.length === 0) {
    textFindQuery = clean
    textFindRanges = collectTextRanges(clean)
    textFindIndex = 0
  } else if (findNext) {
    const count = textFindRanges.length
    textFindIndex = (textFindIndex + (forward ? 1 : -1) + count) % count
  }

  applyTextFindHighlights()
  const current = textFindRanges[textFindIndex]
  if (current) revealTextRange(current)
  ipcRenderer.sendToHost(TEXT_FIND_RESULT_CHANNEL, {
    activeMatchOrdinal: textFindRanges.length ? textFindIndex + 1 : 0,
    matches: textFindRanges.length,
    finalUpdate: true
  })
}

function collectTextRanges(query: string): Range[] {
  const ranges: Range[] = []
  const root = document.body ?? document.documentElement
  if (!root) return ranges

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const needle = query.toLocaleLowerCase()
  let node = walker.nextNode()
  while (node && ranges.length < TEXT_FIND_LIMIT) {
    const text = node.nodeValue ?? ''
    const parent = node.parentElement
    if (text && parent && !parent.closest('script,style,noscript,template,svg,textarea,select,option')) {
      const haystack = text.toLocaleLowerCase()
      let offset = haystack.indexOf(needle)
      while (offset >= 0 && ranges.length < TEXT_FIND_LIMIT) {
        const range = document.createRange()
        range.setStart(node, offset)
        range.setEnd(node, offset + query.length)
        // A range with no client rects belongs to hidden or unrendered content.
        if (range.getClientRects().length > 0) ranges.push(range)
        offset = haystack.indexOf(needle, offset + Math.max(1, needle.length))
      }
    }
    node = walker.nextNode()
  }
  return ranges
}

function applyTextFindHighlights(): void {
  injectTextFindStyle()
  const highlightWindow = window as unknown as {
    Highlight?: new (...ranges: Range[]) => unknown
  }
  const registry = (
    typeof CSS !== 'undefined' ? CSS : undefined
  ) as unknown as
    | { highlights?: { set: (name: string, highlight: unknown) => void; delete: (name: string) => void } }
    | undefined
  const highlights = registry?.highlights

  if (highlights) {
    highlights.delete(TEXT_FIND_HIGHLIGHT)
    highlights.delete(TEXT_FIND_CURRENT_HIGHLIGHT)
    if (textFindRanges.length && highlightWindow.Highlight) {
      highlights.set(
        TEXT_FIND_HIGHLIGHT,
        new highlightWindow.Highlight(...textFindRanges)
      )
      const current = textFindRanges[textFindIndex]
      if (current) {
        highlights.set(
          TEXT_FIND_CURRENT_HIGHLIGHT,
          new highlightWindow.Highlight(current)
        )
      }
    }
    return
  }

  // Older Chromium: at least keep the active match visually selected.
  const current = textFindRanges[textFindIndex]
  if (!current) return
  const selection = window.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  selection.addRange(current)
  textFindUsesSelection = true
}

function injectTextFindStyle(): void {
  if (document.getElementById(TEXT_FIND_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = TEXT_FIND_STYLE_ID
  style.textContent = [
    `::highlight(${TEXT_FIND_HIGHLIGHT}) {`,
    '  background-color: rgba(250, 204, 21, 0.42);',
    '  color: inherit;',
    '}',
    `::highlight(${TEXT_FIND_CURRENT_HIGHLIGHT}) {`,
    '  background-color: rgba(45, 212, 191, 0.78);',
    '  color: #061018;',
    '}'
  ].join('\n')
  ;(document.head ?? document.documentElement).appendChild(style)
}

function revealTextRange(range: Range): void {
  const rect = range.getBoundingClientRect()
  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    window.scrollBy({ top: rect.top - window.innerHeight / 3, behavior: 'smooth' })
  } else if (rect.top < 40) {
    window.scrollBy({ top: rect.top - 80, behavior: 'smooth' })
  } else if (rect.bottom > window.innerHeight - 24) {
    window.scrollBy({ top: rect.bottom - window.innerHeight + 48, behavior: 'smooth' })
  }
}

function clearTextFind(): void {
  textFindQuery = ''
  textFindRanges = []
  textFindIndex = 0
  const registry = (
    typeof CSS !== 'undefined' ? CSS : undefined
  ) as unknown as
    | { highlights?: { delete: (name: string) => void } }
    | undefined
  registry?.highlights?.delete(TEXT_FIND_HIGHLIGHT)
  registry?.highlights?.delete(TEXT_FIND_CURRENT_HIGHLIGHT)
  if (textFindUsesSelection) {
    window.getSelection()?.removeAllRanges()
    textFindUsesSelection = false
  }
  ipcRenderer.sendToHost(TEXT_FIND_RESULT_CHANNEL, {
    activeMatchOrdinal: 0,
    matches: 0,
    finalUpdate: true
  })
}

function describeNode(node: Element, component: string | null): FindHit {
  return {
    tag: node.tagName.toLowerCase(),
    id: node.id,
    classes: Array.from(node.classList).slice(0, 4),
    component,
    text: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
  }
}

/** Component names are a bonus: without them the DOM highlights still work. */
async function readReactComponents(count: number): Promise<(string | null)[]> {
  if (count === 0) return []
  try {
    const script = `(function () {
      var nodes = document.querySelectorAll('[${FIND_ATTR}]')
      var names = []
      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i]
        var key = null
        var props = Object.getOwnPropertyNames(node)
        for (var p = 0; p < props.length; p += 1) {
          if (props[p].indexOf('__reactFiber$') === 0 || props[p].indexOf('__reactInternalInstance$') === 0) {
            key = props[p]
            break
          }
        }
        var name = null
        if (key) {
          var fiber = node[key]
          var depth = 0
          while (fiber && depth < 30) {
            var type = fiber.type
            var candidate = null
            if (typeof type === 'function') candidate = type.displayName || type.name
            else if (type && typeof type === 'object') candidate = type.displayName || type.name || null
            if (candidate) { name = candidate; break }
            fiber = fiber.return
            depth += 1
          }
        }
        names.push(name)
      }
      return names
    })()`
    const result = await webFrame.executeJavaScript(script, true)
    return Array.isArray(result) ? (result as (string | null)[]) : []
  } catch {
    return []
  }
}

function injectFindStyle(): void {
  if (document.getElementById(FIND_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = FIND_STYLE_ID
  style.textContent = [
    `[${FIND_ATTR}] {`,
    '  outline: 2px solid rgba(250, 204, 21, 0.95) !important;',
    '  outline-offset: 1px !important;',
    '  background-color: rgba(250, 204, 21, 0.12) !important;',
    '}',
    `[${FIND_ATTR}="0"] { outline-color: rgba(45, 212, 191, 0.95) !important; }`
  ].join('\n')
  ;(document.head ?? document.documentElement).appendChild(style)
}

function clearFind(): void {
  for (const node of Array.from(document.querySelectorAll(`[${FIND_ATTR}]`))) {
    node.removeAttribute(FIND_ATTR)
  }
  document.getElementById(FIND_STYLE_ID)?.remove()
}

function sendFindResult(result: FindResult): void {
  ipcRenderer.sendToHost(FIND_RESULT_CHANNEL, result)
}

/**
 * Right-click inspection.
 *
 * Chromium's own menu is not what a DevLens window should show, so the guest reports what was
 * under the pointer and lets the shell decide. The inspection is synchronous and local: the
 * selection, whether the target is editable, and the nearest link or media element are all read
 * from the DOM in this handler, before anything is sent. That is what keeps the shell's menu free
 * of rows that would not work - by the time the shell is asked to render, the answer is known.
 *
 * The payload is facts only. The shell decides which rows those facts imply, because a page that
 * could name a shell command could also lie about which one it wanted.
 */
window.addEventListener(
  'contextmenu',
  (event: MouseEvent) => {
    const target = event.target as Element | null
    const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
    const media = target?.closest?.('img, video, audio') as
      | HTMLImageElement
      | HTMLVideoElement
      | HTMLAudioElement
      | null
    const editable = target?.closest?.(
      'input, textarea, [contenteditable=""], [contenteditable="true"]'
    )
    const sized = media as (HTMLImageElement & HTMLVideoElement) | null
    ipcRenderer.sendToHost(CONTEXT_MENU_CHANNEL, {
      x: event.clientX,
      y: event.clientY,
      selection: window.getSelection()?.toString() ?? '',
      editable: Boolean(editable),
      linkUrl: anchor?.href ?? null,
      linkText: anchor?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 300) || null,
      mediaUrl: media ? media.currentSrc || media.src || null : null,
      mediaKind: media ? media.tagName.toLowerCase() : null,
      mediaWidth: sized ? Math.round(sized.naturalWidth || sized.videoWidth || 0) || null : null,
      mediaHeight: sized ? Math.round(sized.naturalHeight || sized.videoHeight || 0) || null : null
    })
  },
  true
)

/**
 * Ctrl/Cmd + wheel, captured before the page can turn it into its own pinch zoom.
 *
 * Electron's `before-input-event` no longer carries mouse-wheel input, so the guest bridge is
 * the only place that sees both the gesture and its delta. The shell performs the zoom through
 * the same logarithmic level store as the menu, which keeps all three entry points consistent.
 */
window.addEventListener(
  'wheel',
  (event: WheelEvent) => {
    if (!(event.ctrlKey || event.metaKey) || !event.deltaY) return
    event.preventDefault()
    event.stopImmediatePropagation()
    ipcRenderer.sendToHost(ZOOM_WHEEL_RESULT_CHANNEL, { deltaY: event.deltaY })
  },
  { passive: false, capture: true }
)

// Passive listener keeps scrolling on the compositor fast path: this is the fast path
// and reports the moment the user scrolls.
window.addEventListener('scroll', () => reportScroll(), { passive: true, capture: true })

/**
 * Safety net for positions that never surface as a `scroll` event.
 *
 * Chromium does not dispatch scroll events to a frame the compositor is not driving -
 * a viewport scaled down to fit the canvas is a good example - so an event-only bridge
 * leaves the twin viewport stranded. The sampler reads one number per tick, skips hidden
 * frames, and only reports when the ratio actually changed, so an idle page costs nothing.
 */
window.setInterval(() => {
  if (document.visibilityState !== 'visible') return
  reportScroll()
}, SAMPLE_INTERVAL_MS)

