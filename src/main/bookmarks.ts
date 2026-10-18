import { clipboard as systemClipboard } from 'electron'
import { dialog, type BrowserWindow } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import {
  parseBookmarkFile,
  toJsonBookmarks,
  toNetscapeBookmarks,
  type ParsedBookmark
} from '../shared/bookmarks-file'
import type {
  BookmarkDropPosition,
  BookmarkEntry,
  BookmarkLocation,
  BookmarkNode,
  BookmarkNodeKind,
  BookmarkOptions,
  BookmarkSnapshot,
  BookmarkTree
} from '../shared/types'
import { activeProfileId } from './profiles'
import { profileFile } from './storage'

/**
 * Bookmarks.
 *
 * Kept in the user data directory next to the history file, per profile, and never sent anywhere.
 *
 * The store is a small tree: three ordered roots (the toolbar, the menu and "other"), folders
 * inside them, separators, and links. Order *is* the array order, so dragging an item on the bar
 * rewrites the same list that is written to disk - there is no separate "sort order" that could
 * drift from what the operator sees.
 *
 * Everything the rest of the app asks for comes out of one snapshot: the flat list of links
 * (which the omnibox ranks and the new tab dashboard tiles), the tree the bar draws, and the two
 * bar preferences. One mutation, one snapshot, one broadcast - the two views of the same store
 * cannot disagree about what changed.
 */

/** Bound on how much a profile can accumulate; a bookmarks file is not a database. */
const LIMIT = 300

interface StoredFile {
  version: 2
  tree: BookmarkTree
  options: BookmarkOptions
}

const EMPTY_OPTIONS: BookmarkOptions = { toolbarVisible: false, showOtherBookmarks: false }

let tree: BookmarkTree = { toolbar: [], menu: [], other: [] }
let options: BookmarkOptions = { ...EMPTY_OPTIONS }
/**
 * Store version.
 *
 * Every mutation bumps it, and the renderer keeps the newest snapshot it has seen: a mutation
 * both answers its caller and broadcasts, and without this a late answer could undo a change
 * that had already been applied.
 */
let revision = 0
/** Which profile this list belongs to; switching identity forces a re-read. */
let loadedFor: string | null = null
/** Pending write with its target file frozen at schedule time, so it cannot cross profiles. */
let saveTimer: NodeJS.Timeout | null = null
let pendingSave: { file: string; payload: string } | null = null

/**
 * The bookmark clipboard.
 *
 * Cut and copy remember the node itself, not just its address, so a folder can be moved with the
 * same two keystrokes as a link. The address also goes to the system clipboard, because that is
 * what makes "copy" useful outside the browser.
 */
let clipboardNode: { node: BookmarkNode; cut: boolean } | null = null

function storeFile(): string {
  return profileFile('bookmarks.json')
}

function newId(kind: BookmarkNodeKind): string {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/* ------------------------------------------------------------------ *
 * Reading and writing
 * ------------------------------------------------------------------ */

function normaliseLocation(value: unknown): BookmarkLocation {
  return value === 'menu' || value === 'other' || value === 'toolbar' ? value : 'toolbar'
}

/** Drops anything malformed rather than letting it reach the renderer. */
function sanitiseNode(input: unknown): BookmarkNode | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Partial<BookmarkNode>
  const kind: BookmarkNodeKind =
    raw.kind === 'folder' || raw.kind === 'separator' ? raw.kind : 'bookmark'
  const id = typeof raw.id === 'string' && raw.id ? raw.id : newId(kind)
  const addedAt = typeof raw.addedAt === 'number' ? raw.addedAt : Date.now()

  if (kind === 'separator') return { id, kind, addedAt }
  if (kind === 'folder') {
    const children = Array.isArray(raw.children)
      ? raw.children.map(sanitiseNode).filter((node): node is BookmarkNode => node !== null)
      : []
    const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'New folder'
    return { id, kind, addedAt, title, children }
  }
  if (typeof raw.url !== 'string') return null
  return {
    id,
    kind: 'bookmark',
    addedAt,
    url: raw.url,
    title: typeof raw.title === 'string' && raw.title ? raw.title : raw.url
  }
}

function sanitiseRoot(input: unknown): BookmarkNode[] {
  if (!Array.isArray(input)) return []
  return input.map(sanitiseNode).filter((node): node is BookmarkNode => node !== null)
}

/**
 * Reads a store file of either generation.
 *
 * Version 1 was a flat array of links with a `location` each. Those are exactly the entries the
 * operator already chose to keep, so they are folded into the roots in their original order -
 * what was on the bar stays on the bar, in the same sequence.
 */
function parseStore(raw: string): { tree: BookmarkTree; options: BookmarkOptions } {
  const parsed = JSON.parse(raw) as unknown
  if (Array.isArray(parsed)) {
    const next: BookmarkTree = { toolbar: [], menu: [], other: [] }
    parsed.forEach((entry, index) => {
      const candidate = entry as Partial<BookmarkEntry>
      if (typeof candidate?.url !== 'string') return
      next[normaliseLocation(candidate.location)].push({
        id: `migrated-${index}`,
        kind: 'bookmark',
        addedAt: typeof candidate.addedAt === 'number' ? candidate.addedAt : Date.now(),
        url: candidate.url,
        title: typeof candidate.title === 'string' && candidate.title ? candidate.title : candidate.url
      })
    })
    return { tree: next, options: { ...EMPTY_OPTIONS } }
  }

  const file = parsed as Partial<StoredFile>
  const roots = (file?.tree ?? {}) as Partial<BookmarkTree>
  return {
    tree: {
      toolbar: sanitiseRoot(roots.toolbar),
      menu: sanitiseRoot(roots.menu),
      other: sanitiseRoot(roots.other)
    },
    options: {
      toolbarVisible: file?.options?.toolbarVisible === true,
      showOtherBookmarks: file?.options?.showOtherBookmarks === true
    }
  }
}

function load(): void {
  const profileId = activeProfileId()
  if (loadedFor === profileId) return
  loadedFor = profileId
  tree = { toolbar: [], menu: [], other: [] }
  options = { ...EMPTY_OPTIONS }
  try {
    const file = storeFile()
    if (!existsSync(file)) return
    const raw = readFileSync(file, 'utf-8')
    const parsed = parseStore(raw)
    tree = parsed.tree
    options = parsed.options
    /**
     * A file from the previous generation is upgraded on the spot.
     *
     * Not lazily on the next change: the two shapes are different enough that leaving the old
     * one on disk means the next reader has to know about both, and a half-written file would be
     * that much harder to reason about. One read, one write, and the format is unambiguous.
     */
    if (!raw.trimStart().startsWith('{')) scheduleSave()
  } catch (error) {
    console.warn('[devlens] could not read bookmarks', error)
    tree = { toolbar: [], menu: [], other: [] }
    options = { ...EMPTY_OPTIONS }
  }
}

function payload(): string {
  const file: StoredFile = { version: 2, tree, options }
  return JSON.stringify(file, null, 2)
}

function scheduleSave(): void {
  // Every caller of this is a mutation (or the one-time format upgrade), so this is the single
  // place that has to remember the store changed - and a new mutation cannot forget it.
  revision += 1
  pendingSave = { file: storeFile(), payload: payload() }
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    const job = pendingSave
    pendingSave = null
    if (!job) return
    try {
      writeFileSync(job.file, job.payload, 'utf-8')
    } catch (error) {
      console.warn('[devlens] could not persist bookmarks', error)
    }
  }, 250)
}

/** Writes any queued save now: a profile switch must not swallow the previous profile's write. */
export function flushBookmarks(): void {
  if (!saveTimer) return
  clearTimeout(saveTimer)
  saveTimer = null
  const job = pendingSave
  pendingSave = null
  if (!job) return
  try {
    writeFileSync(job.file, job.payload, 'utf-8')
  } catch (error) {
    console.warn('[devlens] could not persist bookmarks', error)
  }
}

/* ------------------------------------------------------------------ *
 * Reading the tree
 * ------------------------------------------------------------------ */

function cloneNode(node: BookmarkNode): BookmarkNode {
  return {
    ...node,
    children: node.children?.map(cloneNode)
  }
}

function cloneTree(): BookmarkTree {
  return {
    toolbar: tree.toolbar.map(cloneNode),
    menu: tree.menu.map(cloneNode),
    other: tree.other.map(cloneNode)
  }
}

/** Every link, depth first, in the order the bar would draw them. */
function links(nodes: BookmarkNode[], root: BookmarkLocation, folderId: string | null): BookmarkEntry[] {
  const out: BookmarkEntry[] = []
  for (const node of nodes) {
    if (node.kind === 'bookmark' && node.url) {
      out.push({
        url: node.url,
        title: node.title || node.url,
        addedAt: node.addedAt,
        location: root,
        folderId
      })
      continue
    }
    if (node.kind === 'folder') out.push(...links(node.children ?? [], root, node.id))
  }
  return out
}

export function listBookmarks(): BookmarkEntry[] {
  load()
  return [
    ...links(tree.toolbar, 'toolbar', null),
    ...links(tree.menu, 'menu', null),
    ...links(tree.other, 'other', null)
  ].slice(0, LIMIT)
}

export function bookmarkSnapshot(): BookmarkSnapshot {
  load()
  return { revision, entries: listBookmarks(), tree: cloneTree(), options: { ...options } }
}

/** Marks the store changed. Called by every mutation, after it has changed something. */
function countNodes(nodes: BookmarkNode[]): number {
  return nodes.reduce(
    (total, node) => total + 1 + (node.kind === 'folder' ? countNodes(node.children ?? []) : 0),
    0
  )
}

function totalNodes(): number {
  return countNodes(tree.toolbar) + countNodes(tree.menu) + countNodes(tree.other)
}

/* ------------------------------------------------------------------ *
 * Finding things
 * ------------------------------------------------------------------ */

/** Removes and returns the node with this id, wherever it is. */
function detach(id: string): BookmarkNode | null {
  for (const root of ['toolbar', 'menu', 'other'] as BookmarkLocation[]) {
    const found = detachFrom(tree[root], id)
    if (found) return found
  }
  return null
}

function detachFrom(nodes: BookmarkNode[], id: string): BookmarkNode | null {
  const index = nodes.findIndex((node) => node.id === id)
  if (index >= 0) return nodes.splice(index, 1)[0]
  for (const node of nodes) {
    if (node.kind !== 'folder') continue
    const found = detachFrom(node.children ?? [], id)
    if (found) return found
  }
  return null
}

/** The list a node lives in, plus where in it. Used for drops and for insert-after. */
function locate(id: string): { nodes: BookmarkNode[]; index: number } | null {
  for (const root of ['toolbar', 'menu', 'other'] as BookmarkLocation[]) {
    const found = locateIn(tree[root], id)
    if (found) return found
  }
  return null
}

function locateIn(nodes: BookmarkNode[], id: string): { nodes: BookmarkNode[]; index: number } | null {
  const index = nodes.findIndex((node) => node.id === id)
  if (index >= 0) return { nodes, index }
  for (const node of nodes) {
    if (node.kind !== 'folder') continue
    const found = locateIn(node.children ?? [], id)
    if (found) return found
  }
  return null
}

/** A folder, by id. Only folders can be a drop target's parent. */
function folderById(id: string): BookmarkNode | null {
  const found = locate(id)
  return found?.nodes[found.index]?.kind === 'folder' ? found.nodes[found.index] : null
}

/** True when `parentId` is the folder itself or one of its descendants. */
function containsNode(parent: BookmarkNode, id: string): boolean {
  return (parent.children ?? []).some(
    (node) => node.id === id || (node.kind === 'folder' && containsNode(node, id))
  )
}

/**
 * The container a location names.
 *
 * A location is either one of the three roots or the id of a folder. Folders are why the editor
 * can file a page "into Dev stuff on the toolbar" instead of only "onto the toolbar".
 */
function containerFor(location: string | undefined): { nodes: BookmarkNode[]; folderId: string | null } {
  const value = (location ?? 'toolbar').trim()
  const folder = value ? folderById(value) : null
  if (folder) {
    if (!folder.children) folder.children = []
    return { nodes: folder.children, folderId: folder.id }
  }
  return { nodes: tree[normaliseLocation(value)], folderId: null }
}

function findByUrl(url: string): { nodes: BookmarkNode[]; index: number; node: BookmarkNode } | null {
  for (const root of ['toolbar', 'menu', 'other'] as BookmarkLocation[]) {
    const found = findByUrlIn(tree[root], url)
    if (found) return found
  }
  return null
}

function findByUrlIn(
  nodes: BookmarkNode[],
  url: string
): { nodes: BookmarkNode[]; index: number; node: BookmarkNode } | null {
  const index = nodes.findIndex((node) => node.kind === 'bookmark' && node.url === url)
  if (index >= 0) return { nodes, index, node: nodes[index] }
  for (const node of nodes) {
    if (node.kind !== 'folder') continue
    const found = findByUrlIn(node.children ?? [], url)
    if (found) return found
  }
  return null
}

/* ------------------------------------------------------------------ *
 * Mutations
 * ------------------------------------------------------------------ */

/** The store is bounded by node count: a runaway drag loop should not fill the disk. */
function enforceLimit(): void {
  while (totalNodes() > LIMIT) {
    const removed = detach(tree.toolbar[0]?.id ?? tree.menu[0]?.id ?? tree.other[0]?.id ?? '')
    if (!removed) break
  }
}

/**
 * Saves a page, or updates the one already saved under that address.
 *
 * This is what the add-bookmark editor calls: the operator chose a name and a place, and both are
 * stored as given. A page already saved keeps its position when only its name changes; choosing a
 * different place moves it there.
 */
export function saveBookmark(input: {
  url: string
  title?: string
  location?: string
}): BookmarkSnapshot {
  load()
  const url = normalise(input.url)
  if (!url) return bookmarkSnapshot()

  const target = containerFor(input.location)
  const title = input.title?.trim() || url
  const existing = findByUrl(url)

  if (existing) {
    existing.node.title = title
    if (target.nodes !== existing.nodes) {
      existing.nodes.splice(existing.index, 1)
      target.nodes.push(existing.node)
    }
  } else {
    target.nodes.push({ id: newId('bookmark'), kind: 'bookmark', addedAt: Date.now(), url, title })
  }

  enforceLimit()
  scheduleSave()
  return bookmarkSnapshot()
}

/** Forgets one page, wherever it is filed. */
export function removeBookmark(url: string): BookmarkSnapshot {
  load()
  const target = normalise(url)
  if (target) {
    const found = findByUrl(target)
    if (found) found.nodes.splice(found.index, 1)
  }
  scheduleSave()
  return bookmarkSnapshot()
}

/** Forgets one node: a link, a folder with its contents, or a separator. */
export function removeNode(id: string): BookmarkSnapshot {
  load()
  detach(id)
  scheduleSave()
  return bookmarkSnapshot()
}

export function renameNode(id: string, title: string): BookmarkSnapshot {
  load()
  const found = locate(id)
  const node = found?.nodes[found.index]
  const name = title.trim()
  if (node && name && node.kind !== 'separator') {
    node.title = name
    scheduleSave()
  }
  return bookmarkSnapshot()
}

/** Adds the page, or removes it when it is already saved. Returns the new snapshot. */
export function toggleBookmark(input: { url: string; title?: string }): BookmarkSnapshot {
  load()
  const url = normalise(input.url)
  if (!url) return bookmarkSnapshot()
  const existing = findByUrl(url)
  if (existing) {
    existing.nodes.splice(existing.index, 1)
    scheduleSave()
    return bookmarkSnapshot()
  }
  tree.toolbar.push({
    id: newId('bookmark'),
    kind: 'bookmark',
    addedAt: Date.now(),
    url,
    title: input.title?.trim() || url
  })
  enforceLimit()
  scheduleSave()
  return bookmarkSnapshot()
}

export function createFolder(input: { title?: string; location?: string }): BookmarkSnapshot {
  load()
  const target = containerFor(input.location)
  const title = input.title?.trim() || 'New folder'
  target.nodes.push({ id: newId('folder'), kind: 'folder', addedAt: Date.now(), title, children: [] })
  enforceLimit()
  scheduleSave()
  return bookmarkSnapshot()
}

export function createSeparator(input: { location?: string }): BookmarkSnapshot {
  load()
  const target = containerFor(input.location)
  target.nodes.push({ id: newId('separator'), kind: 'separator', addedAt: Date.now() })
  enforceLimit()
  scheduleSave()
  return bookmarkSnapshot()
}

/**
 * Moves one node next to, or into, another.
 *
 * The three positions are the three things a drag can mean: drop before an item, after it, or
 * into a folder. Dropping a folder into itself (or into one of its own folders) is refused here
 * rather than in the UI, because that is the one move that would detach a subtree from the tree.
 */
export function moveNode(input: {
  id: string
  targetId?: string | null
  position?: BookmarkDropPosition
}): BookmarkSnapshot {
  load()
  const id = String(input.id ?? '')
  const targetId = input.targetId ? String(input.targetId) : null
  if (!id || id === targetId) return bookmarkSnapshot()

  const moving = locate(id)
  const node = moving?.nodes[moving.index]
  if (!moving || !node) return bookmarkSnapshot()

  if (targetId) {
    const target = locate(targetId)
    const anchor = target?.nodes[target.index]
    if (!target || !anchor) return bookmarkSnapshot()
    // A folder dropped into itself, or into anything below it, would take the tree with it.
    if (node.kind === 'folder' && (anchor.id === node.id || containsNode(node, anchor.id))) {
      return bookmarkSnapshot()
    }
    moving.nodes.splice(moving.index, 1)
    const where = locate(targetId)
    if (!where) return bookmarkSnapshot()
    if (input.position === 'inside') {
      const folder = where.nodes[where.index]
      if (folder.kind === 'folder') {
        folder.children = [...(folder.children ?? []), node]
      } else {
        // "Inside" a link is not a thing a bar can draw: it lands after it instead.
        where.nodes.splice(where.index + 1, 0, node)
      }
    } else {
      where.nodes.splice(where.index + (input.position === 'after' ? 1 : 0), 0, node)
    }
  } else {
    // No target means the end of the bar: the gesture for "put it last".
    moving.nodes.splice(moving.index, 1)
    tree.toolbar.push(node)
  }

  scheduleSave()
  return bookmarkSnapshot()
}

/* ------------------------------------------------------------------ *
 * Cut / copy / paste
 * ------------------------------------------------------------------ */

export async function clipboardAction(input: {
  action: 'copy' | 'cut' | 'paste'
  id?: string
  location?: string
}): Promise<{ snapshot: BookmarkSnapshot; message: string; text: string | null }> {
  load()

  if (input.action === 'paste') {
    // A node moved with cut/copy wins; otherwise the address on the system clipboard is the
    // thing the operator meant, which is also what makes "copy a link, paste a bookmark" work.
    const held = clipboardNode
    if (held) {
      const target = containerFor(input.location)
      const node = cloneNode(held.node)
      node.id = newId(node.kind)
      if (node.kind === 'folder') {
        node.children = (node.children ?? []).map((child) => ({
          ...child,
          id: newId(child.kind)
        }))
      }
      target.nodes.push(node)
      if (held.cut) clipboardNode = null
      enforceLimit()
      scheduleSave()
      return { snapshot: bookmarkSnapshot(), message: 'pasted', text: null }
    }
    const text = (await systemClipboard.readText()).trim()
    if (!text) return { snapshot: bookmarkSnapshot(), message: 'the clipboard is empty', text: null }
    const pasted = pasteUrl(text, input.location)
    return { snapshot: pasted.snapshot, message: pasted.message, text: null }
  }

  const found = locate(String(input.id ?? ''))
  const node = found?.nodes[found.index]
  if (!found || !node) return { snapshot: bookmarkSnapshot(), message: 'nothing to copy', text: null }

  clipboardNode = { node: cloneNode(node), cut: input.action === 'cut' }
  const text =
    node.kind === 'bookmark' ? (node.url ?? '') : node.kind === 'folder' ? (node.title ?? '') : ''
  if (input.action === 'cut') {
    // Detaching the original is the whole point of a cut; it comes back with Paste.
    found.nodes.splice(found.index, 1)
    scheduleSave()
  }
  const what = node.kind === 'bookmark' ? (node.title ?? node.url ?? 'link') : node.kind
  return {
    snapshot: bookmarkSnapshot(),
    message: input.action === 'cut' ? `cut ${what}` : `copied ${what}`,
    text
  }
}

/** Remembers a URL the renderer read from the system clipboard, as a paste fallback. */
export function pasteUrl(url: string, location?: string): { snapshot: BookmarkSnapshot; message: string } {
  load()
  const target = containerFor(location)
  const clean = normalise(url)
  if (!clean) return { snapshot: bookmarkSnapshot(), message: 'the clipboard holds no address' }
  if (findByUrl(clean)) return { snapshot: bookmarkSnapshot(), message: 'that address is already saved' }
  target.nodes.push({
    id: newId('bookmark'),
    kind: 'bookmark',
    addedAt: Date.now(),
    url: clean,
    title: clean
  })
  enforceLimit()
  scheduleSave()
  return { snapshot: bookmarkSnapshot(), message: 'pasted from the clipboard' }
}

/** True when the bookmark clipboard holds something; the menu greys "Paste" otherwise. */
export function clipboardHasNode(): boolean {
  return clipboardNode !== null
}

export function setBookmarkOptions(input: Partial<BookmarkOptions>): BookmarkSnapshot {
  load()
  if (typeof input.toolbarVisible === 'boolean') options.toolbarVisible = input.toolbarVisible
  if (typeof input.showOtherBookmarks === 'boolean') {
    options.showOtherBookmarks = input.showOtherBookmarks
  }
  scheduleSave()
  return bookmarkSnapshot()
}

/* ------------------------------------------------------------------ *
 * Import and export
 * ------------------------------------------------------------------ */

/**
 * Where the dialogs would go, when they must not.
 *
 * A caller that already knows the file passes it; otherwise `DEVLENS_BOOKMARKS_IMPORT` /
 * `DEVLENS_BOOKMARKS_EXPORT` name it; otherwise the operator picks it in a native dialog. The
 * environment is the same affordance `DEVLENS_REPORT_DIR` gives the report exporter, and it is
 * the only way a headless run can exercise the *menu* path, which has no argument to pass.
 */
function presetPath(name: 'DEVLENS_BOOKMARKS_IMPORT' | 'DEVLENS_BOOKMARKS_EXPORT'): string | null {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : null
}

/**
 * The extensions an import or an export is allowed to touch.
 *
 * The renderer can name a path, which makes it worth being strict about what it names: a bookmark
 * file is one of three extensions, and a path that is not cannot be used to read something else
 * through this door.
 */
const BOOKMARK_EXTENSIONS = ['.html', '.htm', '.json']

function isBookmarkPath(file: string): boolean {
  const lower = file.toLowerCase()
  return BOOKMARK_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

const IMPORT_FILTERS = [
  { name: 'Bookmark files', extensions: ['html', 'htm', 'json'] },
  { name: 'All files', extensions: ['*'] }
]

const EXPORT_FILTERS = [
  { name: 'Bookmark HTML', extensions: ['html'] },
  { name: 'DevLens JSON', extensions: ['json'] }
]

/** Turns what a file declared into real nodes, with fresh ids. */
function toNodes(parsed: ParsedBookmark[]): BookmarkNode[] {
  return parsed.map((node) => {
    if (node.kind === 'folder') {
      return {
        id: newId('folder'),
        kind: 'folder' as const,
        addedAt: node.addedAt ?? Date.now(),
        title: node.title ?? 'Folder',
        children: toNodes(node.children ?? [])
      }
    }
    return {
      id: newId('bookmark'),
      kind: 'bookmark' as const,
      addedAt: node.addedAt ?? Date.now(),
      url: node.url,
      title: node.title || node.url
    }
  })
}

/**
 * Merges nodes into a container, skipping what is already saved.
 *
 * Addresses are the identity: importing the same file twice adds nothing the second time, and a
 * bookmarked page that is already on the bar is not moved or renamed by an import. Folders always
 * come across as folders, even when every link inside them was already known - an empty folder
 * named "Reading" is information the file carried.
 */
function mergeNodes(
  target: BookmarkNode[],
  incoming: BookmarkNode[],
  known: Set<string>
): { added: number; skipped: number } {
  let added = 0
  let skipped = 0

  for (const node of incoming) {
    if (node.kind === 'bookmark') {
      const url = node.url ?? ''
      if (!url || known.has(url)) {
        skipped += 1
        continue
      }
      known.add(url)
      target.push(node)
      added += 1
      continue
    }
    const children = node.children ?? []
    if (children.length === 0) {
      target.push(node)
      added += 1
      continue
    }
    // Merge into a fresh list and keep *that* as the folder's contents: the duplicates inside it
    // were never added, so the folder cannot smuggle them in through its own children array.
    const kept: BookmarkNode[] = []
    const nested = mergeNodes(kept, children, known)
    skipped += nested.skipped
    // A folder that brought nothing new is not worth a row; one that did keeps its name.
    if (nested.added === 0) continue
    target.push({ ...node, children: kept })
    added += 1
  }

  return { added, skipped }
}

export interface ImportResult {
  ok: boolean
  file: string | null
  imported: number
  skipped: number
  snapshot: BookmarkSnapshot
  error: string | null
}

export async function importBookmarks(input: {
  location?: string
  /** Read this file instead of asking. */
  file?: string
  parent?: BrowserWindow | null
}): Promise<ImportResult> {
  load()
  let file = input.file?.trim() || presetPath('DEVLENS_BOOKMARKS_IMPORT')

  try {
    if (!file) {
      const options: Electron.OpenDialogOptions = {
        title: 'Import bookmarks',
        buttonLabel: 'Import',
        properties: ['openFile'],
        filters: IMPORT_FILTERS
      }
      const picked = input.parent
        ? await dialog.showOpenDialog(input.parent, options)
        : await dialog.showOpenDialog(options)
      if (picked.canceled || picked.filePaths.length === 0) {
        return { ok: false, file: null, imported: 0, skipped: 0, snapshot: bookmarkSnapshot(), error: null }
      }
      file = picked.filePaths[0]
    }

    if (!isBookmarkPath(file)) {
      return {
        ok: false,
        file,
        imported: 0,
        skipped: 0,
        snapshot: bookmarkSnapshot(),
        error: 'a bookmark file is .html, .htm or .json'
      }
    }

    const text = readFileSync(file, 'utf-8')
    /**
     * A parse failure is reported as one sentence, never as the parser's own message: a JSON error
     * quotes the file it failed on, and this path can be reached with a path the renderer named.
     */
    let parsed: ReturnType<typeof parseBookmarkFile>
    try {
      parsed = parseBookmarkFile(text)
    } catch {
      return {
        ok: false,
        file,
        imported: 0,
        skipped: 0,
        snapshot: bookmarkSnapshot(),
        error: 'that file could not be read as a bookmark file'
      }
    }
    if (parsed.nodes.length === 0) {
      return {
        ok: false,
        file,
        imported: 0,
        skipped: 0,
        snapshot: bookmarkSnapshot(),
        error: 'that file holds no bookmarks DevLens can read'
      }
    }

    const target = containerFor(input.location)
    const known = new Set(listBookmarks().map((entry) => entry.url))
    const outcome = mergeNodes(target.nodes, toNodes(parsed.nodes), known)
    enforceLimit()
    scheduleSave()
    return {
      ok: true,
      file,
      imported: outcome.added,
      skipped: outcome.skipped,
      snapshot: bookmarkSnapshot(),
      error: null
    }
  } catch (error) {
    return {
      ok: false,
      file,
      imported: 0,
      skipped: 0,
      snapshot: bookmarkSnapshot(),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export interface ExportResult {
  ok: boolean
  file: string | null
  format: 'html' | 'json' | null
  count: number
  error: string | null
}

/**
 * Writes the whole profile's bookmarks out.
 *
 * The extension the operator chose decides the format - the dialog offers both, and a file named
 * `.json` is a JSON file whatever filter was showing when they typed the name.
 */
export async function exportBookmarks(input?: {
  /** Write here instead of asking. */
  file?: string
  parent?: BrowserWindow | null
}): Promise<ExportResult> {
  load()
  let file = input?.file?.trim() || presetPath('DEVLENS_BOOKMARKS_EXPORT')

  try {
    if (!file) {
      const options: Electron.SaveDialogOptions = {
        title: 'Export bookmarks',
        buttonLabel: 'Export',
        defaultPath: `devlens-bookmarks-${new Date().toISOString().slice(0, 10)}.html`,
        filters: EXPORT_FILTERS
      }
      const picked = input?.parent
        ? await dialog.showSaveDialog(input.parent, options)
        : await dialog.showSaveDialog(options)
      if (picked.canceled || !picked.filePath) {
        return { ok: false, file: null, format: null, count: 0, error: null }
      }
      file = picked.filePath
    }

    if (!isBookmarkPath(file)) {
      return { ok: false, file, format: null, count: 0, error: 'a bookmark file is .html, .htm or .json' }
    }
    const format: 'html' | 'json' = file.toLowerCase().endsWith('.json') ? 'json' : 'html'
    const count = listBookmarks().length
    const payload =
      format === 'json' ? toJsonBookmarks(cloneTree()) : toNetscapeBookmarks(cloneTree())
    writeFileSync(file, payload, 'utf-8')
    return { ok: true, file, format, count, error: null }
  } catch (error) {
    return {
      ok: false,
      file,
      format: null,
      count: 0,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

function normalise(url: string): string | null {
  const trimmedUrl = url.trim()
  if (!trimmedUrl) return null
  try {
    const parsed = new URL(trimmedUrl)
    parsed.hash = ''
    return ['http:', 'https:', 'file:'].includes(parsed.protocol) ? parsed.toString() : null
  } catch {
    return null
  }
}
