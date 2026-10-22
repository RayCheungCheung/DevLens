import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  X
} from 'lucide-react'
import type { GuestDebuggerResult } from '@shared/types'
import { IconButton } from '@renderer/components/IconButton'

interface InspectorPanelProps {
  guestId: number | null
  activeUrl: string
  onOpenExternal: () => void
}

interface DomNode {
  nodeId: number
  backendNodeId?: number
  nodeType: number
  nodeName: string
  nodeValue?: string
  attributes?: string[]
  childNodeCount?: number
  children?: DomNode[]
}

interface StyleRange {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

interface StyleRule {
  key: string
  label: string
  origin: string
  cssText: string
  styleSheetId: string | null
  range: StyleRange | null
}

interface ComputedProperty {
  name: string
  value: string
}

interface BoxModel {
  content: number[]
  padding: number[]
  border: number[]
  margin: number[]
  width: number
  height: number
}

interface AttributeDraft {
  name: string
  value: string
}

type DetailTab = 'html' | 'styles' | 'computed' | 'layout'

export function InspectorPanel({
  guestId,
  activeUrl,
  onOpenExternal
}: InspectorPanelProps) {
  const [root, setRoot] = useState<DomNode | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<DomNode | null>(null)
  const [styles, setStyles] = useState<StyleRule[]>([])
  const [computed, setComputed] = useState<ComputedProperty[]>([])
  const [box, setBox] = useState<BoxModel | null>(null)
  const [attributes, setAttributes] = useState<AttributeDraft[]>([])
  const [outerHtml, setOuterHtml] = useState('')
  const [htmlDraft, setHtmlDraft] = useState('')
  const [htmlBusy, setHtmlBusy] = useState(false)
  const [tab, setTab] = useState<DetailTab>('html')
  const [computedFilter, setComputedFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectionSeq = useRef(0)
  const documentSeq = useRef(0)

  const selectNode = useCallback(
    async (node: DomNode) => {
      if (!guestId || node.nodeType !== 1) return
      const requestSeq = ++selectionSeq.current
      setSelected(node)
      setAttributes(attributeDrafts(node))
      setLoading(true)
      setError(null)

      const [matchedResult, computedResult, boxResult, htmlResult, attributesResult] = await Promise.all([
        sendCdp(guestId, 'CSS.getMatchedStylesForNode', { nodeId: node.nodeId }),
        sendCdp(guestId, 'CSS.getComputedStyleForNode', { nodeId: node.nodeId }),
        sendCdp(guestId, 'DOM.getBoxModel', { nodeId: node.nodeId }),
        sendCdp(guestId, 'DOM.getOuterHTML', { nodeId: node.nodeId }),
        sendCdp(guestId, 'DOM.getAttributes', { nodeId: node.nodeId })
      ])
      if (requestSeq !== selectionSeq.current) return

      if (!matchedResult.ok && !computedResult.ok && !boxResult.ok) {
        setError(matchedResult.error ?? computedResult.error ?? boxResult.error)
      }

      setStyles(collectStyleRules(matchedResult))
      setComputed(collectComputed(computedResult))
      setBox(collectBoxModel(boxResult))
      if (attributesResult.ok) {
        const latestAttributes = stringArray(asRecord(attributesResult.result)?.attributes)
        const latestNode = { ...node, attributes: latestAttributes }
        setSelected(latestNode)
        setAttributes(attributeDrafts(latestNode))
      }
      const html =
        htmlResult.ok && typeof asRecord(htmlResult.result)?.outerHTML === 'string'
          ? String(asRecord(htmlResult.result)?.outerHTML)
          : ''
      setOuterHtml(html)
      setHtmlDraft(html)
      setLoading(false)

      void sendCdp(guestId, 'Overlay.highlightNode', {
        nodeId: node.nodeId,
        highlightConfig: {
          showInfo: true,
          contentColor: { r: 45, g: 212, b: 191, a: 0.12 },
          paddingColor: { r: 125, g: 211, b: 252, a: 0.16 },
          borderColor: { r: 196, g: 181, b: 253, a: 0.22 },
          marginColor: { r: 251, g: 191, b: 36, a: 0.16 }
        }
      })
    },
    [guestId]
  )

  const loadDocument = useCallback(async () => {
    if (!guestId) {
      setRoot(null)
      setSelected(null)
      setAttributes([])
      setOuterHtml('')
      setHtmlDraft('')
      return
    }
    const requestSeq = ++documentSeq.current
    setLoading(true)
    setError(null)
    await sendCdp(guestId, 'DOM.enable')
    await sendCdp(guestId, 'CSS.enable')
    await sendCdp(guestId, 'Overlay.enable')
    const result = await sendCdp(guestId, 'DOM.getDocument', { depth: 3, pierce: true })
    if (requestSeq !== documentSeq.current) return
    if (!result.ok) {
      setError(result.error)
      setLoading(false)
      return
    }
    const nextRoot = asDomNode(asRecord(result.result)?.root)
    setRoot(nextRoot)
    setExpanded((current) => {
      const next = new Set(current)
      if (nextRoot) {
        next.add(nextRoot.nodeId)
        const html = findFirstElement(nextRoot, 'html')
        if (html) next.add(html.nodeId)
      }
      return next
    })
    setLoading(false)
  }, [guestId])

  useEffect(() => {
    if (!guestId) return
    let refreshTimer: number | null = null
    const off = window.devlens.onGuestDebuggerEvent((events) => {
      for (const event of events) {
        if (event.guestId !== guestId) continue
        if (event.method === 'Debugger.detached') {
          setError(String(event.params.reason ?? 'The embedded debugger detached.'))
          continue
        }
        if (event.method === 'DOM.setChildNodes') {
          const parentId = Number(event.params.parentId)
          const nodes = Array.isArray(event.params.nodes)
            ? event.params.nodes.map(asDomNode).filter((node): node is DomNode => Boolean(node))
            : []
          if (parentId && nodes.length) {
            setRoot((current) => replaceChildren(current, parentId, nodes))
          }
          continue
        }
        if (
          event.method === 'DOM.documentUpdated' ||
          event.method === 'DOM.childNodeInserted' ||
          event.method === 'DOM.childNodeRemoved' ||
          event.method === 'DOM.attributeModified' ||
          event.method === 'DOM.attributeRemoved'
        ) {
          if (refreshTimer !== null) window.clearTimeout(refreshTimer)
          refreshTimer = window.setTimeout(() => void loadDocument(), 220)
        }
      }
    })

    void loadDocument()
    return () => {
      off()
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      if (guestId) {
        void sendCdp(guestId, 'Overlay.hideHighlight')
        void window.devlens.guestDebuggerDetach(guestId)
      }
    }
  }, [guestId, loadDocument])

  const expandNode = (node: DomNode): void => {
    if (!guestId) return
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(node.nodeId)) next.delete(node.nodeId)
      else next.add(node.nodeId)
      return next
    })
    if (!node.children?.length && (node.childNodeCount ?? 0) > 0) {
      void sendCdp(guestId, 'DOM.requestChildNodes', { nodeId: node.nodeId, depth: 1 })
    }
  }

  const saveStyle = async (rule: StyleRule, cssText: string): Promise<void> => {
    if (!guestId || !rule.styleSheetId || !rule.range || !selected) return
    const response = await sendCdp(guestId, 'CSS.setStyleTexts', {
      edits: [
        {
          styleSheetId: rule.styleSheetId,
          range: rule.range,
          text: cssText
        }
      ]
    })
    if (!response.ok) {
      setError(response.error)
      return
    }
    await selectNode(selected)
  }

  const saveAttributes = async (): Promise<void> => {
    if (!guestId || !selected) return
    const original = attributesOf(selected)
    const next = new Map<string, string>()
    for (const attribute of attributes) {
      const name = attribute.name.trim()
      if (name) next.set(name, attribute.value)
    }

    setHtmlBusy(true)
    setError(null)
    try {
      for (const name of Object.keys(original)) {
        if (!next.has(name)) {
          const response = await sendCdp(guestId, 'DOM.removeAttribute', {
            nodeId: selected.nodeId,
            name
          })
          if (!response.ok) throw new Error(response.error ?? 'could not remove attribute')
        }
      }
      for (const [name, value] of next) {
        const response = await sendCdp(guestId, 'DOM.setAttributeValue', {
          nodeId: selected.nodeId,
          name,
          value
        })
        if (!response.ok) throw new Error(response.error ?? 'could not set attribute')
      }
      await selectNode(selected)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setHtmlBusy(false)
    }
  }

  const saveHtml = async (): Promise<void> => {
    if (!guestId || !selected || !htmlDraft.trim()) return
    setHtmlBusy(true)
    setError(null)
    const response = await sendCdp(guestId, 'DOM.setOuterHTML', {
      nodeId: selected.nodeId,
      outerHTML: htmlDraft
    })
    setHtmlBusy(false)
    if (!response.ok) {
      setError(response.error)
      return
    }
    setSelected(null)
    setAttributes([])
    setOuterHtml('')
    setHtmlDraft('')
    await loadDocument()
  }

  const visibleComputed = useMemo(() => {
    const needle = computedFilter.trim().toLowerCase()
    if (!needle) return computed
    return computed.filter((property) =>
      `${property.name}:${property.value}`.toLowerCase().includes(needle)
    )
  }, [computed, computedFilter])

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="inspector-panel">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--devlens-hairline)] px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-500" title={activeUrl}>
          {activeUrl || 'no page loaded'}
        </span>
        <IconButton label="Refresh DOM tree and styles" onClick={() => void loadDocument()}>
          <RefreshCw size={12} />
        </IconButton>
        <IconButton label="Open external DevTools" onClick={onOpenExternal}>
          <ExternalLink size={12} />
        </IconButton>
      </div>

      {error && (
        <p className="shrink-0 border-b border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-[10px] text-rose-200">
          {error}
        </p>
      )}

      <section className="flex min-h-[160px] flex-[0.9] flex-col overflow-hidden border-b border-[var(--devlens-hairline)]">
        <div className="flex shrink-0 items-center gap-2 px-3 py-1.5">
          <span className="text-[11px] font-medium text-ink-200">DOM tree</span>
          {loading && <Loader2 size={10} className="animate-spin text-ink-500" />}
          <span className="ml-auto font-mono text-[9px] text-ink-600">live</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
          {root ? (
            <DomTreeNode
              node={root}
              depth={0}
              expanded={expanded}
              selectedId={selected?.nodeId ?? null}
              onToggle={expandNode}
              onSelect={(node) => void selectNode(node)}
            />
          ) : (
            <p className="px-2 py-5 text-center font-mono text-[10px] text-ink-600">
              {guestId ? 'Waiting for a document…' : 'Open a web page to inspect its DOM.'}
            </p>
          )}
        </div>
      </section>

      <section className="flex min-h-0 flex-[1.1] flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-1 border-b border-[var(--devlens-hairline)] px-2">
          {(['html', 'styles', 'computed', 'layout'] as DetailTab[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTab(option)}
              className={[
                'border-b-2 px-2 py-1.5 text-[10px] capitalize transition-colors',
                tab === option
                  ? 'border-[var(--devlens-accent)] text-[var(--devlens-accent)]'
                  : 'border-transparent text-ink-500 hover:text-ink-200'
              ].join(' ')}
            >
              {option}
            </button>
          ))}
          {selected && (
            <span className="ml-auto truncate font-mono text-[9px] text-ink-600">
              {nodeLabel(selected)}
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!selected ? (
            <p className="px-3 py-6 text-center font-mono text-[10px] text-ink-600">
              Select an element to inspect and edit its HTML, styles and box model.
            </p>
          ) : tab === 'html' ? (
            <HtmlEditor
              attributes={attributes}
              onAttributesChange={setAttributes}
              onSaveAttributes={() => void saveAttributes()}
              html={htmlDraft}
              originalHtml={outerHtml}
              onHtmlChange={setHtmlDraft}
              onSaveHtml={() => void saveHtml()}
              busy={htmlBusy}
            />
          ) : tab === 'styles' ? (
            <div className="space-y-2 p-2">
              {styles.length === 0 ? (
                <p className="font-mono text-[10px] text-ink-600">No editable styles found.</p>
              ) : (
                styles.map((rule) => (
                  <StyleRuleEditor
                    key={rule.key}
                    rule={rule}
                    onSave={(text) => void saveStyle(rule, text)}
                  />
                ))
              )}
            </div>
          ) : tab === 'computed' ? (
            <div>
              <div className="sticky top-0 z-10 border-b border-white/5 bg-[var(--color-ink-950)] p-2">
                <input
                  value={computedFilter}
                  onChange={(event) => setComputedFilter(event.target.value)}
                  spellCheck={false}
                  placeholder="Filter computed properties"
                  aria-label="Filter computed styles"
                  className="h-7 w-full rounded border border-[var(--devlens-hairline)] bg-black/20 px-2 font-mono text-[10px] text-ink-200 outline-none placeholder:text-ink-600 focus:border-[var(--devlens-accent-line)]"
                />
              </div>
              <div className="divide-y divide-white/5">
                {visibleComputed.map((property) => (
                  <div
                    key={property.name}
                    className="grid grid-cols-[minmax(110px,0.8fr)_minmax(0,1.2fr)] gap-2 px-3 py-1 font-mono text-[10px]"
                  >
                    <span className="break-all text-ink-500">{property.name}</span>
                    <span className="break-all text-ink-200">{property.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <BoxModelView box={box} />
          )}
        </div>
      </section>
    </div>
  )
}

function DomTreeNode({
  node,
  depth,
  expanded,
  selectedId,
  onToggle,
  onSelect
}: {
  node: DomNode
  depth: number
  expanded: Set<number>
  selectedId: number | null
  onToggle: (node: DomNode) => void
  onSelect: (node: DomNode) => void
}) {
  const hasChildren = (node.childNodeCount ?? 0) > 0 || Boolean(node.children?.length)
  const open = expanded.has(node.nodeId)
  const selectable = node.nodeType === 1

  return (
    <div data-testid="dom-node" data-node-id={node.nodeId}>
      <div
        className={[
          'flex min-w-0 items-center rounded',
          selectedId === node.nodeId ? 'bg-[var(--devlens-accent-soft)]' : 'hover:bg-white/[0.04]'
        ].join(' ')}
        style={{ paddingLeft: `${depth * 11 + 2}px` }}
      >
        <button
          type="button"
          aria-label={open ? `Collapse ${nodeLabel(node)}` : `Expand ${nodeLabel(node)}`}
          onClick={() => onToggle(node)}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-ink-600"
        >
          {hasChildren ? (
            open ? <ChevronDown size={10} /> : <ChevronRight size={10} />
          ) : (
            <span className="h-1 w-1 rounded-full bg-ink-700" />
          )}
        </button>
        <button
          type="button"
          disabled={!selectable}
          onClick={() => onSelect(node)}
          title={nodeLabel(node)}
          className="min-w-0 flex-1 truncate py-0.5 text-left font-mono text-[10px] text-ink-300 disabled:text-ink-600"
        >
          {nodeLabel(node)}
        </button>
      </div>
      {open &&
        node.children?.map((child) => (
          <DomTreeNode
            key={child.nodeId}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            selectedId={selectedId}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </div>
  )
}

function HtmlEditor({
  attributes,
  onAttributesChange,
  onSaveAttributes,
  html,
  originalHtml,
  onHtmlChange,
  onSaveHtml,
  busy
}: {
  attributes: AttributeDraft[]
  onAttributesChange: (attributes: AttributeDraft[]) => void
  onSaveAttributes: () => void
  html: string
  originalHtml: string
  onHtmlChange: (html: string) => void
  onSaveHtml: () => void
  busy: boolean
}) {
  const updateAttribute = (index: number, patch: Partial<AttributeDraft>): void => {
    onAttributesChange(
      attributes.map((attribute, position) =>
        position === index ? { ...attribute, ...patch } : attribute
      )
    )
  }

  return (
    <div className="space-y-2 p-2">
      <section className="rounded border border-[var(--devlens-hairline)] bg-black/15">
        <div className="flex items-center gap-2 border-b border-white/5 px-2 py-1">
          <span className="min-w-0 flex-1 text-[10px] font-medium text-ink-200">Attributes</span>
          <button
            type="button"
            onClick={() => onAttributesChange([...attributes, { name: '', value: '' }])}
            className="inline-flex h-5 items-center gap-1 rounded border border-dashed border-white/15 px-1.5 text-[9px] text-ink-400 hover:border-teal-400/40 hover:text-teal-200"
          >
            <Plus size={9} />
            add
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSaveAttributes}
            aria-label="Save element attributes"
            className="inline-flex h-5 items-center gap-1 rounded border border-[var(--devlens-accent-line)] px-1.5 text-[9px] text-[var(--devlens-accent)] disabled:opacity-40"
          >
            {busy ? <Loader2 size={9} className="animate-spin" /> : <Save size={9} />}
            save
          </button>
        </div>

        <div className="space-y-1 p-2">
          {attributes.length === 0 && (
            <p className="font-mono text-[10px] text-ink-600">No attributes on this element.</p>
          )}
          {attributes.map((attribute, index) => (
            <div key={index} className="flex items-center gap-1">
              <input
                value={attribute.name}
                spellCheck={false}
                aria-label={`Attribute ${index + 1} name`}
                placeholder="name"
                onChange={(event) => updateAttribute(index, { name: event.target.value })}
                className="h-6 w-[34%] shrink-0 rounded border border-[var(--devlens-hairline)] bg-black/25 px-1.5 font-mono text-[10px] text-teal-200 outline-none focus:border-[var(--devlens-accent-line)]"
              />
              <input
                value={attribute.value}
                spellCheck={false}
                aria-label={`Attribute ${index + 1} value`}
                placeholder="value"
                onChange={(event) => updateAttribute(index, { value: event.target.value })}
                className="h-6 min-w-0 flex-1 rounded border border-[var(--devlens-hairline)] bg-black/25 px-1.5 font-mono text-[10px] text-ink-200 outline-none focus:border-[var(--devlens-accent-line)]"
              />
              <button
                type="button"
                aria-label={`Remove attribute ${attribute.name || index + 1}`}
                onClick={() =>
                  onAttributesChange(attributes.filter((_, position) => position !== index))
                }
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-600 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border border-[var(--devlens-hairline)] bg-black/15">
        <div className="flex items-center gap-2 border-b border-white/5 px-2 py-1">
          <span className="min-w-0 flex-1 text-[10px] font-medium text-ink-200">Outer HTML</span>
          {html !== originalHtml && (
            <button
              type="button"
              onClick={() => onHtmlChange(originalHtml)}
              className="h-5 rounded border border-white/10 px-1.5 text-[9px] text-ink-400 hover:bg-white/5"
            >
              reset
            </button>
          )}
          <button
            type="button"
            disabled={busy || !html.trim() || html === originalHtml}
            onClick={onSaveHtml}
            aria-label="Apply outer HTML"
            className="inline-flex h-5 items-center gap-1 rounded border border-[var(--devlens-accent-line)] px-1.5 text-[9px] text-[var(--devlens-accent)] disabled:opacity-40"
          >
            {busy ? <Loader2 size={9} className="animate-spin" /> : <Save size={9} />}
            apply
          </button>
        </div>
        <textarea
          value={html}
          spellCheck={false}
          aria-label="Outer HTML source"
          onChange={(event) => onHtmlChange(event.target.value)}
          className="min-h-36 w-full resize-y bg-transparent px-2 py-1.5 font-mono text-[10px] leading-4 text-ink-200 outline-none"
        />
      </section>
    </div>
  )
}

function StyleRuleEditor({
  rule,
  onSave
}: {
  rule: StyleRule
  onSave: (text: string) => void
}) {
  const [text, setText] = useState(rule.cssText)

  useEffect(() => setText(rule.cssText), [rule.cssText])

  return (
    <div className="rounded border border-[var(--devlens-hairline)] bg-black/15">
      <div className="flex items-center gap-2 border-b border-white/5 px-2 py-1">
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-teal-200" title={rule.label}>
          {rule.label}
        </span>
        <span className="shrink-0 font-mono text-[8px] uppercase text-ink-600">{rule.origin}</span>
        {rule.styleSheetId && rule.range && (
          <button
            type="button"
            onClick={() => onSave(text)}
            aria-label={`Save styles for ${rule.label}`}
            className="inline-flex h-5 items-center gap-1 rounded border border-teal-400/30 px-1.5 text-[9px] text-teal-200 hover:bg-teal-400/10"
          >
            <Save size={9} />
            save
          </button>
        )}
      </div>
      <textarea
        value={text}
        readOnly={!rule.styleSheetId || !rule.range}
        spellCheck={false}
        aria-label={`CSS declarations for ${rule.label}`}
        onChange={(event) => setText(event.target.value)}
        className="min-h-16 w-full resize-y bg-transparent px-2 py-1.5 font-mono text-[10px] leading-4 text-ink-200 outline-none read-only:text-ink-500"
      />
    </div>
  )
}

function BoxModelView({ box }: { box: BoxModel | null }) {
  if (!box) {
    return <p className="px-3 py-6 text-center font-mono text-[10px] text-ink-600">No box model available.</p>
  }

  return (
    <div className="space-y-2 p-3">
      <div className="rounded border border-amber-400/30 bg-amber-400/5 p-3">
        <BoxEdge label="margin" values={box.margin} />
        <div className="mt-2 rounded border border-violet-400/30 bg-violet-400/5 p-3">
          <BoxEdge label="border" values={box.border} />
          <div className="mt-2 rounded border border-sky-400/30 bg-sky-400/5 p-3">
            <BoxEdge label="padding" values={box.padding} />
            <div className="mt-2 flex min-h-16 items-center justify-center rounded border border-teal-400/30 bg-teal-400/10 font-mono text-[10px] text-teal-100">
              {Math.round(box.width)} x {Math.round(box.height)}
            </div>
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-[90px_minmax(0,1fr)] gap-x-2 gap-y-1 font-mono text-[10px]">
        {[
          ['margin', box.margin],
          ['border', box.border],
          ['padding', box.padding]
        ].map(([label, values]) => (
          <div key={String(label)} className="contents">
            <dt className="text-ink-500">{String(label)}</dt>
            <dd className="text-ink-300">{formatEdges(values as number[])}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function BoxEdge({ label, values }: { label: string; values: number[] }) {
  return (
    <div className="flex items-center justify-between font-mono text-[9px] text-ink-500">
      <span>{label}</span>
      <span>{formatEdges(values)}</span>
    </div>
  )
}

async function sendCdp(
  guestId: number,
  method: string,
  params: Record<string, unknown> = {}
): Promise<GuestDebuggerResult> {
  return window.devlens.guestDebuggerSend({ webContentsId: guestId, method, params })
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function asDomNode(value: unknown): DomNode | null {
  const node = asRecord(value)
  if (!node || typeof node.nodeId !== 'number' || typeof node.nodeName !== 'string') return null
  return {
    nodeId: node.nodeId,
    backendNodeId: typeof node.backendNodeId === 'number' ? node.backendNodeId : undefined,
    nodeType: Number(node.nodeType) || 0,
    nodeName: node.nodeName,
    nodeValue: typeof node.nodeValue === 'string' ? node.nodeValue : undefined,
    attributes: Array.isArray(node.attributes)
      ? node.attributes.filter((item): item is string => typeof item === 'string')
      : undefined,
    childNodeCount:
      typeof node.childNodeCount === 'number' ? node.childNodeCount : undefined,
    children: Array.isArray(node.children)
      ? node.children.map(asDomNode).filter((child): child is DomNode => Boolean(child))
      : undefined
  }
}

function replaceChildren(root: DomNode | null, parentId: number, nodes: DomNode[]): DomNode | null {
  if (!root) return root
  if (root.nodeId === parentId) return { ...root, children: nodes }
  if (!root.children?.length) return root
  return {
    ...root,
    children: root.children.map((child) => replaceChildren(child, parentId, nodes) ?? child)
  }
}

function nodeLabel(node: DomNode): string {
  if (node.nodeType === 9) return '#document'
  if (node.nodeType === 10) return `<!DOCTYPE ${node.nodeName}>`
  if (node.nodeType === 3) {
    return `#text ${node.nodeValue?.trim().slice(0, 48) || ''}`.trim()
  }
  if (node.nodeType === 8) return `<!--${node.nodeValue?.slice(0, 40) ?? ''}-->`
  const attrs = attributesOf(node)
  const id = attrs.id ? `#${attrs.id}` : ''
  const classes = attrs.class
    ? attrs.class
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((name) => `.${name}`)
        .join('')
    : ''
  return `${node.nodeName.toLowerCase()}${id}${classes}`
}

function findFirstElement(node: DomNode, name: string): DomNode | null {
  if (node.nodeType === 1 && node.nodeName.toLowerCase() === name.toLowerCase()) return node
  for (const child of node.children ?? []) {
    const found = findFirstElement(child, name)
    if (found) return found
  }
  return null
}

function attributesOf(node: DomNode): Record<string, string> {
  const out: Record<string, string> = {}
  const values = node.attributes ?? []
  for (let index = 0; index + 1 < values.length; index += 2) {
    out[values[index]] = values[index + 1]
  }
  return out
}

function attributeDrafts(node: DomNode): AttributeDraft[] {
  const values = node.attributes ?? []
  const drafts: AttributeDraft[] = []
  for (let index = 0; index + 1 < values.length; index += 2) {
    drafts.push({ name: values[index], value: values[index + 1] })
  }
  return drafts
}

function collectStyleRules(response: GuestDebuggerResult): StyleRule[] {
  if (!response.ok) return []
  const payload = asRecord(response.result)
  if (!payload) return []
  const rules: StyleRule[] = []
  const inline = asRecord(payload.inlineStyle)
  if (inline) {
    const rule = normalizeStyleRule(inline, 'element.style', 'inline', 'inline')
    if (rule) rules.push(rule)
  }

  const matched = Array.isArray(payload.matchedCSSRules) ? payload.matchedCSSRules : []
  matched.forEach((entry, index) => {
    const match = asRecord(entry)
    const rule = asRecord(match?.rule)
    if (!rule) return
    const selectors = asRecord(rule.selectorList)
    const label = String(selectors?.text ?? rule.origin ?? `rule ${index + 1}`)
    const normalized = normalizeStyleRule(
      asRecord(rule.style),
      label,
      String(rule.origin ?? 'regular'),
      `matched-${index}`
    )
    if (normalized) rules.push(normalized)
  })

  const inherited = Array.isArray(payload.inherited) ? payload.inherited : []
  inherited.forEach((block, blockIndex) => {
    const inheritedMatches = asRecord(block)?.matchedCSSRules
    if (!Array.isArray(inheritedMatches)) return
    inheritedMatches.forEach((entry, index) => {
      const rule = asRecord(asRecord(entry)?.rule)
      if (!rule) return
      const selectors = asRecord(rule.selectorList)
      const label = String(selectors?.text ?? `inherited rule ${index + 1}`)
      const normalized = normalizeStyleRule(
        asRecord(rule.style),
        `inherited from ${label}`,
        String(rule.origin ?? 'regular'),
        `inherited-${blockIndex}-${index}`
      )
      if (normalized) rules.push(normalized)
    })
  })
  return rules
}

function normalizeStyleRule(
  style: Record<string, unknown> | null,
  label: string,
  origin: string,
  key: string
): StyleRule | null {
  if (!style) return null
  const cssText =
    typeof style.cssText === 'string'
      ? style.cssText
      : Array.isArray(style.cssProperties)
        ? style.cssProperties
            .map((property) => asRecord(property))
            .filter((property): property is Record<string, unknown> => Boolean(property))
            .map((property) => {
              const name = String(property.name ?? '')
              const value = String(property.value ?? '')
              return name && value ? `${name}: ${value};` : ''
            })
            .filter(Boolean)
            .join('\n')
        : ''
  const range = asRange(style.range)
  return {
    key,
    label,
    origin,
    cssText,
    styleSheetId: typeof style.styleSheetId === 'string' ? style.styleSheetId : null,
    range
  }
}

function collectComputed(response: GuestDebuggerResult): ComputedProperty[] {
  if (!response.ok) return []
  const payload = asRecord(response.result)
  const properties = Array.isArray(payload?.computedStyle) ? payload.computedStyle : []
  return properties
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({ name: String(entry.name ?? ''), value: String(entry.value ?? '') }))
    .filter((entry) => entry.name)
}

function collectBoxModel(response: GuestDebuggerResult): BoxModel | null {
  if (!response.ok) return null
  const payload = asRecord(response.result)
  const model = asRecord(payload?.model)
  if (!model) return null
  return {
    content: numberArray(model.content),
    padding: numberArray(model.padding),
    border: numberArray(model.border),
    margin: numberArray(model.margin),
    width: Number(model.width) || 0,
    height: Number(model.height) || 0
  }
}

function asRange(value: unknown): StyleRange | null {
  const range = asRecord(value)
  if (!range) return null
  return {
    startLine: Number(range.startLine) || 0,
    startColumn: Number(range.startColumn) || 0,
    endLine: Number(range.endLine) || 0,
    endColumn: Number(range.endColumn) || 0
  }
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item))
    : []
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function formatEdges(values: number[]): string {
  if (values.length < 8) return 'n/a'
  return [values[1], values[3], values[5], values[7]].map((value) => `${Math.round(value)}px`).join(' ')
}
