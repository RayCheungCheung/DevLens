/**
 * The bookmark file formats.
 *
 * Two of them, because that is what the world uses: the Netscape bookmark HTML every browser has
 * written since 1997 (Chrome, Firefox, Safari and Edge all still export it), and DevLens's own
 * JSON. The parsing lives here rather than in the main process so it is pure - no Electron, no
 * filesystem, no dialogs - and can be reasoned about, and tested, on its own.
 */

import type { BookmarkNode } from './types'

const MAX_BOOKMARK_URL = 8192
const MAX_BOOKMARK_TITLE = 300
const MAX_PARSED_NODES = 5000
const MAX_FOLDER_DEPTH = 32

/** A node read out of a file. Ids are assigned by the store when it is merged in. */
export interface ParsedBookmark {
  kind: 'bookmark' | 'folder'
  url?: string
  title?: string
  addedAt?: number
  children?: ParsedBookmark[]
}

export interface ParseResult {
  nodes: ParsedBookmark[]
  /** Counted so the UI can say "12 imported, 3 already there" without re-walking the file. */
  links: number
}

/* ------------------------------------------------------------------ *
 * Netscape bookmark HTML
 * ------------------------------------------------------------------ */

/** The entity set a bookmark file actually contains, plus the numeric form. */
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const point = Number(code)
      return Number.isInteger(point) &&
        point > 0 &&
        point <= 0x10ffff &&
        !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : '\ufffd'
    })
    .replace(/&amp;/gi, '&')
}

/** One URL policy for imports, the bookmark store, and exported links. */
export function safeBookmarkUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_BOOKMARK_URL) return null
  try {
    const parsed = new URL(trimmed)
    if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) return null
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return null
  }
}

function safeTitle(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, MAX_BOOKMARK_TITLE)
    : fallback
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** `HREF="..."` from an attribute soup, in whatever order and quoting the file used. */
function attribute(attributes: string, name: string): string | null {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const match = pattern.exec(attributes)
  if (!match) return null
  return decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')
}

/**
 * Reads a Netscape bookmark file.
 *
 * A token walk rather than a DOM parse: the format is a flat sequence of `<DT><H3>` folder
 * headers, `<DT><A>` links and `<DL>`/`</DL>` nesting markers, and the main process has no DOM to
 * hand. Anything unrecognised (descriptions, icons, the `<p>` Firefox sprinkles around) is
 * skipped, which is exactly what an importer should do with it.
 */
export function parseNetscapeBookmarks(html: string): ParseResult {
  const nodes: ParsedBookmark[] = []
  /** Open folders, innermost last. The first entry is the implicit file root. */
  const stack: { children: ParsedBookmark[] }[] = [{ children: nodes }]
  let links = 0

  const token = /<DT\s*>\s*<H3([^>]*)>([\s\S]*?)<\/H3\s*>|<DT\s*>\s*<A\s+([^>]*)>([\s\S]*?)<\/A\s*>|<DL[^>]*>|<\/DL\s*>/gi

  for (let match = token.exec(html); match; match = token.exec(html)) {
    const [whole, h3Attributes, h3Text, aAttributes, aText] = match
    const current = stack[stack.length - 1]

    if (/^<DL/i.test(whole)) {
      // A `<DL>` opens the folder the preceding `<H3>` just declared; if there was none, it is the
      // file's outer list and the current level simply stays.
      const last = current.children[current.children.length - 1]
      if (last?.kind === 'folder' && !last.children) {
        last.children = []
        stack.push(last as { children: ParsedBookmark[] })
      }
      continue
    }

    if (/^<\/DL/i.test(whole)) {
      if (stack.length > 1) stack.pop()
      continue
    }

    if (aAttributes !== undefined) {
      const url = safeBookmarkUrl(attribute(aAttributes, 'HREF'))
      if (!url) continue
      const added = attribute(aAttributes, 'ADD_DATE')
      const title = safeTitle(decodeEntities(aText), url)
      current.children.push({
        kind: 'bookmark',
        url,
        title,
        addedAt: added ? Number(added) * 1000 || undefined : undefined
      })
      links += 1
      continue
    }

    if (h3Text !== undefined) {
      const added = attribute(h3Attributes, 'ADD_DATE')
      current.children.push({
        kind: 'folder',
        title: safeTitle(decodeEntities(h3Text), 'Folder'),
        addedAt: added ? Number(added) * 1000 || undefined : undefined
      })
    }
    if (links >= MAX_PARSED_NODES) break
  }

  return { nodes: stripEmptyFolders(nodes), links }
}

/** A folder header with no list under it is not a folder; drop it rather than exporting a husk. */
function stripEmptyFolders(nodes: ParsedBookmark[]): ParsedBookmark[] {
  const out: ParsedBookmark[] = []
  for (const node of nodes) {
    if (node.kind === 'folder') {
      const children = stripEmptyFolders(node.children ?? [])
      if (children.length === 0) continue
      out.push({ ...node, children })
      continue
    }
    out.push(node)
  }
  return out
}

/** Renders the tree the way every browser can read it back. */
export function toNetscapeBookmarks(input: {
  toolbar: BookmarkNode[]
  menu: BookmarkNode[]
  other: BookmarkNode[]
}): string {
  const seconds = (ms: number): string => String(Math.floor(ms / 1000))
  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file.',
    '     It will be read and overwritten.',
    '     DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>'
  ]

  const writeNodes = (nodes: BookmarkNode[], depth: number): void => {
    for (const node of nodes) {
      if (node.kind === 'separator') continue
      const pad = '    '.repeat(depth)
      if (node.kind === 'folder') {
        lines.push(`${pad}<DT><H3 ADD_DATE="${seconds(node.addedAt)}">${escapeText(node.title ?? 'Folder')}</H3>`)
        lines.push(`${pad}<DL><p>`)
        writeNodes(node.children ?? [], depth + 1)
        lines.push(`${pad}</DL><p>`)
        continue
      }
      if (!node.url) continue
      lines.push(
        `${pad}<DT><A HREF="${escapeAttribute(node.url)}" ADD_DATE="${seconds(node.addedAt)}">${escapeText(node.title ?? node.url)}</A>`
      )
    }
  }

  const roots: [string, BookmarkNode[]][] = [
    ['Bookmarks Toolbar', input.toolbar],
    ['Bookmarks Menu', input.menu],
    ['Other Bookmarks', input.other]
  ]
  for (const [label, nodes] of roots) {
    if (nodes.length === 0) continue
    lines.push(`    <DT><H3>${label}</H3>`)
    lines.push('    <DL><p>')
    writeNodes(nodes, 2)
    lines.push('    </DL><p>')
  }

  lines.push('</DL><p>')
  return `${lines.join('\n')}\n`
}

/* ------------------------------------------------------------------ *
 * DevLens JSON
 * ------------------------------------------------------------------ */

/**
 * Reads a DevLens JSON dump, or a hand-written list of links.
 *
 * Three shapes are accepted because all three exist in the wild by now: the store file
 * (`{version: 2, tree}`), a snapshot (`{entries, tree}`), and the flat array an earlier DevLens
 * wrote. Anything else is an error the caller can explain.
 */
export function parseJsonBookmarks(text: string): ParseResult {
  const parsed = JSON.parse(text) as unknown

  const budget = { nodes: 0 }
  const fromNode = (input: unknown, depth = 0): ParsedBookmark | null => {
    if (!input || typeof input !== 'object' || depth > MAX_FOLDER_DEPTH) return null
    if (budget.nodes >= MAX_PARSED_NODES) return null
    const raw = input as Record<string, unknown>
    if (raw.kind === 'folder' || Array.isArray(raw.children)) {
      const children = (Array.isArray(raw.children) ? raw.children : [])
        .map((child) => fromNode(child, depth + 1))
        .filter((node): node is ParsedBookmark => node !== null)
      if (budget.nodes >= MAX_PARSED_NODES) return null
      budget.nodes += 1
      return {
        kind: 'folder',
        title: safeTitle(raw.title, 'Folder'),
        addedAt: typeof raw.addedAt === 'number' ? raw.addedAt : undefined,
        children
      }
    }
    const url = safeBookmarkUrl(raw.url)
    if (!url) return null
    budget.nodes += 1
    return {
      kind: 'bookmark',
      url,
      title: safeTitle(raw.title, url),
      addedAt: typeof raw.addedAt === 'number' ? raw.addedAt : undefined
    }
  }

  const fromList = (list: unknown[]): ParsedBookmark[] =>
    list
      .slice(0, MAX_PARSED_NODES)
      .map((node) => fromNode(node))
      .filter((node): node is ParsedBookmark => node !== null)

  let nodes: ParsedBookmark[] = []
  if (Array.isArray(parsed)) {
    nodes = fromList(parsed)
  } else if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    const tree = (record.tree ?? record) as Record<string, unknown>
    const roots = ['toolbar', 'menu', 'other'].filter((root) => Array.isArray(tree?.[root]))
    if (roots.length > 0) {
      // A store's three roots are folded into one list of folders, so an import that lands in a
      // folder still says which root it came from without inventing three destinations for it.
      for (const root of roots) {
        const children = fromList(tree[root] as unknown[])
        if (children.length === 0) continue
        nodes.push({
          kind: 'folder',
          title: root === 'toolbar' ? 'Bookmarks Toolbar' : root === 'menu' ? 'Bookmarks Menu' : 'Other Bookmarks',
          children
        })
      }
    } else if (Array.isArray(record.entries)) {
      nodes = fromList(record.entries)
    }
  }

  return { nodes: stripEmptyFolders(nodes), links: countLinks(nodes) }
}

function countLinks(nodes: ParsedBookmark[]): number {
  return nodes.reduce(
    (total, node) => total + (node.kind === 'folder' ? countLinks(node.children ?? []) : 1),
    0
  )
}

/** The JSON DevLens writes: the same shape it stores, so an export is re-importable as-is. */
export function toJsonBookmarks(tree: {
  toolbar: BookmarkNode[]
  menu: BookmarkNode[]
  other: BookmarkNode[]
}): string {
  return `${JSON.stringify(
    {
      version: 2,
      generator: 'DevLens',
      exportedAt: new Date().toISOString(),
      tree
    },
    null,
    2
  )}\n`
}

/** Picks the reader from what the file looks like, so the importer never has to be told. */
export function parseBookmarkFile(text: string): ParseResult {
  const trimmed = text.trimStart()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return parseJsonBookmarks(text)
  return parseNetscapeBookmarks(text)
}
