/**
 * Smart omnibox grammar.
 *
 * Parsing and suggestion building live in a pure module so the toolbar, the dropdown and
 * (for tests) plain Node can all agree on what a line of input means. Nothing here touches
 * Electron: an action describes *what* to do, the shell decides how.
 */

import {
  defaultOmniboxEntries,
  entryUrl,
  normalizeKeyword,
  type DefaultEngineRef,
  type OmniboxEntry,
  type OmniboxSources
} from './omnibox-settings'
import { internalRouteLabel, internalRouteOf, type InternalRouteId } from './routes'

export type SearchEngineId =
  | 'google'
  | 'brave'
  | 'duckduckgo'
  | 'bing'
  | 'wikipedia'
  | 'perplexity'
export type PlatformHubId = 'github' | 'reddit' | 'amazon' | 'cve'
export type OmniboxPanelTarget = 'recon' | 'design' | 'interceptor' | 'defense'
export type OmniboxCommandId = 'port' | 'clear-cache' | 'sandbox' | 'wimh' | 'profile'

export interface SearchEngine {
  id: SearchEngineId
  label: string
  /** Token used after the `@` prefix. */
  token: string
  /** Spelled-out forms the operator can type instead of the short token. */
  aliases?: string[]
  build: (query: string) => string
}

export interface PlatformHub {
  id: PlatformHubId
  label: string
  /** Token used after the `#` prefix. */
  token: string
  /** Spelled-out forms the operator can type instead of the short token. */
  aliases?: string[]
  build: (query: string) => string
}

export const SEARCH_ENGINES: SearchEngine[] = [
  {
    id: 'google',
    label: 'Google',
    token: 'g',
    aliases: ['google'],
    build: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: 'brave',
    label: 'Brave',
    token: 'b',
    aliases: ['brave'],
    build: (query) => `https://search.brave.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: 'duckduckgo',
    label: 'DuckDuckGo',
    token: 'd',
    aliases: ['duckduckgo', 'ddg'],
    build: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
  },
  {
    id: 'bing',
    label: 'Bing',
    token: 'bi',
    aliases: ['bing'],
    build: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: 'wikipedia',
    label: 'Wikipedia',
    token: 'w',
    aliases: ['wiki', 'wikipedia'],
    build: (query) =>
      `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    token: 'p',
    aliases: ['perplexity'],
    build: (query) => `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`
  }
]

export const PLATFORM_HUBS: PlatformHub[] = [
  {
    id: 'github',
    label: 'GitHub',
    token: 'g',
    aliases: ['github', 'gh'],
    build: (query) => `https://github.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: 'reddit',
    label: 'Reddit',
    token: 'r',
    aliases: ['reddit'],
    build: (query) => `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`
  },
  {
    id: 'amazon',
    label: 'Amazon',
    token: 'amz',
    aliases: ['amazon', 'a'],
    build: (query) => `https://www.amazon.com/s?k=${encodeURIComponent(query)}`
  },
  {
    id: 'cve',
    label: 'CVE database',
    token: 'cve',
    aliases: ['cveorg'],
    build: (query) => `https://www.cve.org/CVERecord/SearchResults?query=${encodeURIComponent(query)}`
  }
]

export const DEFAULT_SEARCH_ENGINE: SearchEngineId = 'duckduckgo'

/** Every built-in engine id, in table order: what "a built-in" means to a validator. */
export const SEARCH_ENGINE_IDS: SearchEngineId[] = SEARCH_ENGINES.map((engine) => engine.id)

/** Panel aliases for the `>` mode switcher, most specific first. */
const PANEL_ALIASES: { tokens: string[]; panel: OmniboxPanelTarget; label: string }[] = [
  { tokens: ['sec', 'security', 'recon', 'report'], panel: 'recon', label: 'Security & recon' },
  { tokens: ['design', 'css', 'style'], panel: 'design', label: 'Live design & CSS' },
  { tokens: ['intercept', 'interceptor', 'http', 'network'], panel: 'interceptor', label: 'HTTP interceptor' },
  { tokens: ['defense', 'defence', 'wimh', 'hardened'], panel: 'defense', label: 'Extreme defense mode' }
]

export type OmniboxAction =
  | { kind: 'navigate'; url: string; label: string }
  | { kind: 'search'; url: string; engine: SearchEngineId; query: string; label: string }
  /**
   * A row the operator added: an engine of their own (`@yt cats`) or a site shortcut (`@gh`).
   *
   * It is its own kind rather than a `search` with an engine id because the two are not the same
   * thing: `search` means "a built-in engine with a brand mark", and this one means "whatever
   * template the profile stored", which has no mark of its own and is drawn with the site's
   * favicon instead.
   */
  | { kind: 'entry'; url: string; entryId: string; query: string; label: string }
  /** One of the shell's own pages (`devlens:settings/search`). */
  | { kind: 'internal'; route: InternalRouteId; url: string; label: string }
  | { kind: 'hub-search'; url: string; hub: PlatformHubId; query: string; label: string }
  | { kind: 'ghost'; url: string | null; label: string }
  | { kind: 'panel'; panel: OmniboxPanelTarget; label: string }
  | { kind: 'find'; selector: string; label: string }
  /**
   * `%` - switch to a tab that is already open. `tabId` is filled in by the shell, which is the
   * only layer that knows the tab strip; a null id means nothing matched.
   */
  | { kind: 'tab'; tabId: string | null; url: string | null; query: string; label: string }
  | { kind: 'command'; command: OmniboxCommandId; value: string | null; url?: string; label: string }
  /** Fills the input with a prefix instead of running anything. */
  | { kind: 'insert'; text: string; label: string }

export interface SuggestionInput {
  query: string
  /** Visited pages with their local visit counts, newest first. */
  history: { url: string; title: string; lastVisitedAt: number; visitCount?: number }[]
  /** Tabs that are open right now, for the `%` switcher. */
  tabs?: { id: string; url: string | null; title: string }[]
  /** Saved pages: ranked like history, with a bonus so a bookmark outranks a pass-through. */
  bookmarks?: { url: string; title: string }[]
  /** URLs already seen in this session, newest first. */
  sessionUrls: string[]
  defaultEngine?: DefaultEngineRef
  /** The operator's own engines and shortcuts, matched by keyword alongside the built-ins. */
  entries?: OmniboxEntry[]
  /**
   * Which classes of local row the dropdown may draw from. The settings page turns these into
   * Firefox's suggestion checkboxes; a switched-off class is not *hidden*, it is never built.
   */
  sources?: Partial<OmniboxSources>
  /** Offer the prefix hints before local history rather than ranked in with it. */
  suggestFirst?: boolean
  limit?: number
  /** Injected clock, so ranking stays deterministic in tests. */
  now?: number
}

export type SuggestionIcon =
  | 'search'
  | 'globe'
  | 'history'
  | 'ghost'
  | 'panel'
  | 'find'
  | 'tab'
  | 'command'
  | 'hub'

export interface OmniboxSuggestion {
  id: string
  kind: 'action' | 'history' | 'session' | 'hint'
  title: string
  subtitle: string
  icon: SuggestionIcon
  /**
   * The brand mark to draw in place of the generic `icon`, when there is one.
   *
   * An engine row without this is a magnifying glass, and a list of magnifying glasses does not
   * tell anyone which engine they are about to search with. The row keeps `icon` as its fallback
   * for the ranks that have no brand of their own.
   */
  mark?: PrefixBadgeIcon
  /**
   * A favicon for a row the operator added, as a `data:` URL resolved by the shell.
   *
   * A custom engine has no brand of ours to draw, and inventing one would be worse than showing
   * the site's own icon - so the shell fetches the origin's favicon through the same pipeline the
   * tab strip uses and hands it here. It is an image, never a normalised path: nothing of the
   * operator's is redrawn.
   */
  iconUrl?: string
  /** Set on rows that come from the operator's own list, so the shell can attach `iconUrl`. */
  entryId?: string
  /** True for the row that stands for the profile's default search engine. */
  defaultEngine?: boolean
  action: OmniboxAction
  /** Provider suggestion that must be run, not edited. */
  fillOnly?: boolean
  /** Ranking score for local entries; higher wins. Prefix actions leave it undefined. */
  score?: number
  /** How the query lined up with this entry's host, used to decide the promoted slot. */
  hostMatch?: 'prefix' | 'word' | 'substring' | 'acronym' | null
  /**
   * Inline completion for this entry: the text the remainder of the address represents, and
   * the full value that Tab/Right-arrow should put in the omnibox.
   */
  completion?: { ghost: string; value: string }
}

export function engineById(id: SearchEngineId): SearchEngine {
  return SEARCH_ENGINES.find((engine) => engine.id === id) ?? SEARCH_ENGINES[SEARCH_ENGINES.length - 1]
}

/**
 * The engine the field will actually search with.
 *
 * A profile can point "the default engine" at one of the built-ins or at an engine of its own, and
 * everything downstream - the bare-query path, the `@` cheat sheet's first row, the ghost
 * session's fallback, the dropdown's "default" chip - has to read the same answer. Resolving it
 * once, here, is what keeps those from disagreeing.
 */
export interface SearchTarget {
  /** The built-in this points at, or null when the profile defined the engine itself. */
  engineId: SearchEngineId | null
  label: string
  /** Token after `@`, without the `@`. */
  token: string
  mark: PrefixBadgeIcon | null
  entry: OmniboxEntry | null
  build: (query: string) => string
}

export function resolveSearchTarget(
  ref: DefaultEngineRef | undefined,
  entries: OmniboxEntry[] = defaultOmniboxEntries()
): SearchTarget {
  const wanted = ref ?? DEFAULT_SEARCH_ENGINE
  const engines = entries.filter((entry) => entry.kind === 'engine')
  const entry =
    engines.find((candidate) => candidate.id === wanted) ??
    engines.find((candidate) => candidate.id === `builtin:${wanted}`) ??
    engines[0]
  if (entry) {
    return {
      engineId: entry.builtInEngine ?? null,
      label: entry.label,
      token: entry.keyword,
      mark: entry.builtInEngine ? engineMark(entry.builtInEngine) : null,
      entry,
      build: (query) => entryUrl(entry, query)
    }
  }
  /* An operator may delete every engine. Bare text still needs a deterministic safety net. */
  const fallback = engineById(DEFAULT_SEARCH_ENGINE)
  return {
    engineId: fallback.id,
    label: fallback.label,
    token: fallback.token,
    mark: engineMark(fallback.id),
    entry: null,
    build: fallback.build
  }
}

/** The stored row for a keyword within one prefix family. */
function entryByKeyword(
  token: string,
  entries: OmniboxEntry[] = defaultOmniboxEntries(),
  kind?: OmniboxEntry['kind']
): OmniboxEntry | undefined {
  const wanted = normalizeKeyword(token)
  if (!wanted) return undefined
  return entries.find(
    (entry) =>
      entry.keyword === wanted &&
      entry.keyword.length > 0 &&
      (!kind || entry.kind === kind)
  )
}

/**
 * True when the value should be treated as an address rather than a query.
 *
 * Deliberately conservative: a bare word stays a search, a dotted name, a host:port pair,
 * an IP or anything with a scheme becomes a URL. That matches what browser users expect
 * and keeps `how to center a div` out of the address bar.
 */
export function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || /\s/.test(trimmed)) return false

  // Windows paths first: "C:\x" is not the "C:" scheme.
  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) return true
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) return true
  if (/^(mailto|tel|data|about|file|blob|chrome|devtools|view-source):/i.test(trimmed)) return true
  // host:port, which is what `localhost:3000` actually is - not the "localhost" scheme.
  if (/^[a-zA-Z0-9.\-]+:\d{1,5}(\/|$|\?|#)/.test(trimmed) || /^[a-zA-Z0-9.\-]+:\d{1,5}$/.test(trimmed)) {
    return true
  }
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(trimmed)) return true
  // dotted hosts with an optional port, path or query
  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:\d{1,5})?([/?#].*)?$/.test(trimmed)) return true

  return false
}

/** Turns an address-like value into a URL the webview can load. */
export function toUrl(value: string): string {
  const trimmed = value.trim()
  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) return `file:///${trimmed.replace(/\\/g, '/')}`
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) return trimmed
  if (/^(mailto|tel|data|about|file|blob|chrome|devtools|view-source):/i.test(trimmed)) return trimmed
  return `http://${trimmed}`
}

/** Wraps a bare word or phrase in the default search engine. */
export function toSearchUrl(query: string, engine: SearchEngineId = DEFAULT_SEARCH_ENGINE): string {
  return engineById(engine).build(query)
}

/**
 * Parses one line of omnibox input.
 *
 * Returns null when the input is empty or a prefix is still incomplete (`@g` with no
 * query) - the dropdown offers hints for those states, but Enter has nothing to run.
 */
export function parseOmnibox(
  raw: string,
  /** Either the id the profile searches with, or the target it already resolved to. */
  defaultEngine: DefaultEngineRef | SearchTarget = DEFAULT_SEARCH_ENGINE,
  entries: OmniboxEntry[] = defaultOmniboxEntries()
): OmniboxAction | null {
  const input = raw.trim()
  if (!input) return null

  // The shell's own pages come first: `devlens:` is its name for a page, not a query to search
  // for, and no prefix or address rule below should get the chance to reinterpret it.
  const route = internalRouteOf(input)
  if (route) {
    return {
      kind: 'internal',
      route,
      url: input,
      label: internalRouteLabel(route)
    }
  }

  const target =
    typeof defaultEngine === 'string' ? resolveSearchTarget(defaultEngine, entries) : defaultEngine
  if (input.startsWith('@')) return parseEnginePrefix(input, target, entries)
  if (input.startsWith('#')) return parseShortcutPrefix(input, entries, target)
  if (input.startsWith('*')) return parseGhostPrefix(input, target)
  if (input.startsWith('>')) return parsePanelPrefix(input)
  if (input.startsWith('&')) return parseFindPrefix(input)
  if (input.startsWith(':')) return parseCommandPrefix(input)
  if (input.startsWith('%')) return parseTabPrefix(input)

  if (looksLikeUrl(input)) {
    const url = toUrl(input)
    return { kind: 'navigate', url, label: `Open ${url}` }
  }
  return {
    kind: 'search',
    url: target.build(input),
    engine: target.engineId ?? DEFAULT_SEARCH_ENGINE,
    query: input,
    label: `Search ${target.label} for "${input}"`
  }
}

function parseEnginePrefix(
  input: string,
  target: SearchTarget,
  entries: OmniboxEntry[]
): OmniboxAction | null {
  const match = /^@(\S*)\s*([\s\S]*)$/.exec(input)
  if (!match) return null

  const token = match[1] ?? ''
  const rest = (match[2] ?? '').trim()
  const custom = entryByKeyword(token, entries, 'engine')

  if (!rest || !custom) {
    if (!rest) return null
    // An unknown token is treated as part of the query so a typo still searches.
    const query = `${token} ${rest}`.trim()
    return {
      kind: 'search',
      url: target.build(query),
      engine: target.engineId ?? DEFAULT_SEARCH_ENGINE,
      query,
      label: `Search ${target.label} for "${query}"`
    }
  }

  /**
   * The stored engine substitutes the query. Its position in the engine list is its evaluation
   * order; duplicate triggers are resolved to the first row, which makes reordering meaningful.
   */
  return {
    kind: 'entry',
    url: entryUrl(custom, rest),
    entryId: custom.id,
    query: rest,
    label: `Search ${custom.label} for "${rest}"`
  }
}

function parseShortcutPrefix(
  input: string,
  entries: OmniboxEntry[],
  target: SearchTarget
): OmniboxAction | null {
  const match = /^#(\S*)\s*([\s\S]*)$/.exec(input)
  if (!match) return null

  const token = match[1] ?? ''
  const rest = (match[2] ?? '').trim()
  const shortcut = entryByKeyword(token, entries, 'shortcut')
  if (shortcut) {
    return {
      kind: 'entry',
      url: shortcut.template,
      entryId: shortcut.id,
      query: rest,
      label: `Open ${shortcut.label}`
    }
  }

  if (!token) return null
  const query = `${token} ${rest}`.trim()
  return {
    kind: 'search',
    url: target.build(query),
    engine: target.engineId ?? DEFAULT_SEARCH_ENGINE,
    query,
    label: `Search ${target.label} for "${query}"`
  }
}

function parseGhostPrefix(input: string, target: SearchTarget): OmniboxAction | null {
  const rest = input.slice(1).trim()
  if (!rest) {
    // Bare `*` enters the isolated session on the page already open.
    return { kind: 'ghost', url: null, label: 'Enter ghost session' }
  }
  const url = looksLikeUrl(rest) ? toUrl(rest) : target.build(rest)
  return { kind: 'ghost', url, label: `Ghost session: ${url}` }
}

function parsePanelPrefix(input: string): OmniboxAction | null {
  const token = input.slice(1).trim().toLowerCase()
  if (!token) return null
  const match = PANEL_ALIASES.find((alias) => alias.tokens.includes(token))
  if (!match) return null
  return { kind: 'panel', panel: match.panel, label: `Open ${match.label}` }
}

function parseFindPrefix(input: string): OmniboxAction | null {
  const selector = input.slice(1).trim()
  if (!selector) return null
  return { kind: 'find', selector, label: `Highlight "${selector}"` }
}

/**
 * `%` - jump to an open tab.
 *
 * The parser can only say "switch to whatever matches this"; resolving the winner needs the tab
 * strip, which lives in the shell. Bare `%` lists every open tab.
 */
function parseTabPrefix(input: string): OmniboxAction | null {
  const query = input.slice(1).trim()
  return {
    kind: 'tab',
    tabId: null,
    url: null,
    query,
    label: query ? `Switch to a tab matching "${query}"` : 'Switch to an open tab'
  }
}

function parseCommandPrefix(input: string): OmniboxAction | null {
  const body = input.slice(1).trim()
  if (!body) return null

  const portMatch = /^(?:port\s*)?(\d{1,5})$/i.exec(body)
  if (portMatch) {
    const port = Number(portMatch[1])
    if (port > 0 && port <= 65535) {
      return {
        kind: 'command',
        command: 'port',
        value: String(port),
        url: `http://localhost:${port}`,
        label: `Open http://localhost:${port}`
      }
    }
    return null
  }

  if (/^(clear-cache|clearcache|clear)$/i.test(body)) {
    return { kind: 'command', command: 'clear-cache', value: null, label: 'Clear session cache and storage' }
  }
  if (/^sandbox$/i.test(body)) {
    return { kind: 'command', command: 'sandbox', value: null, label: 'Open a sandboxed window' }
  }
  // Defense is privacy, not monitoring: the overlay is deliberately reachable in both modes.
  if (/^(wimh|defense|defence)$/i.test(body)) {
    return {
      kind: 'command',
      command: 'wimh',
      value: null,
      label: 'Toggle the WImH defense overlay'
    }
  }
  // Identity: opens the profile selector again, in-session.
  if (/^(profile|profiles|user|whoami)$/i.test(body)) {
    return {
      kind: 'command',
      command: 'profile',
      value: null,
      label: 'Switch profile'
    }
  }
  return null
}

/**
 * Builds the dropdown contents for the current input.
 *
 * Ordering: prefix routing and cheat sheets first, then local entries ranked by score. A
 * high-confidence local match (someone typing the start of a host they visit often) is
 * promoted above the generic search row, which is what makes Enter and the inline completion
 * agree with each other.
 *
 * Everything here is pure and synchronous over data the caller already holds in memory: no
 * network, no disk, no clock beyond the `now` the caller passes in.
 */
export function buildSuggestions(input: SuggestionInput): OmniboxSuggestion[] {
  const limit = input.limit ?? 8
  const entries = input.entries ?? defaultOmniboxEntries()
  const target = resolveSearchTarget(input.defaultEngine, entries)
  const raw = input.query
  const trimmed = raw.trim()
  const suggestions: OmniboxSuggestion[] = []
  const now = input.now ?? Date.now()
  const sources: OmniboxSources = {
    history: true,
    bookmarks: true,
    tabs: true,
    actions: true,
    recentSearches: true,
    ...input.sources
  }

  if (!trimmed) {
    return recentSuggestions(
      sources.history || sources.recentSearches ? input.history : [],
      sources.recentSearches ? input.sessionUrls : [],
      limit,
      sources.bookmarks ? input.bookmarks ?? [] : [],
      target
    )
  }

  // A bare prefix still means something for `*` (ghost session) and nothing for the rest,
  // so the parsed action always goes first and the cheat sheet follows it.
  const prefixOnly = trimmed.length === 1 && '@#>:*&%'.includes(trimmed)
  const action = parseOmnibox(raw, target, entries)
  const prefixRoute = /^[@#>:*&%]/.test(trimmed)

  /**
   * `%` never navigates: it switches. The rows are the tabs that are open right now, ranked with
   * the same scorer the rest of the omnibox uses, and the shell turns a chosen row into a tab
   * activation - so Enter focuses an existing tab instead of opening a second copy of it.
   */
  if (action?.kind === 'tab') {
    if (!sources.tabs) return []
    const matches = rankOpenTabs(action.query, input.tabs ?? [], limit)
    if (matches.length === 0) {
      return [
        {
          id: 'primary',
          kind: 'action',
          title: action.query ? `No open tab matches "${action.query}"` : 'No other tab is open',
          subtitle: 'open a page first, then switch to it with %',
          icon: 'tab',
          action
        }
      ]
    }
    return matches
  }
  const actionEntry =
    action?.kind === 'entry'
      ? entries.find((entry) => entry.id === action.entryId) ?? null
      : null
  const actionSuggestion: OmniboxSuggestion | null =
    action && action.kind !== 'insert'
      ? {
          id: 'primary',
          kind: 'action',
          title: suggestionTitle(action),
          subtitle: suggestionSubtitle(action, trimmed),
          icon: iconFor(action),
          /* The engine that will run the search, so the top row wears its logo. */
          mark:
            action.kind === 'search'
              ? engineMark(action.engine) ?? undefined
              : actionEntry?.builtInEngine
                ? engineMark(actionEntry.builtInEngine) ?? undefined
                : undefined,
          /* A row of the operator's own: the shell adds the site's favicon by this id. */
          entryId: action.kind === 'entry' ? action.entryId : undefined,
          action
        }
      : null

  // Local matches are ranked whether or not a prefix was typed; only the placement changes.
  const local = rankLocalEntries({
    query: trimmed,
    history: sources.history ? input.history : [],
    bookmarks: sources.bookmarks ? input.bookmarks ?? [] : [],
    sessionUrls: sources.recentSearches ? input.sessionUrls : [],
    now,
    limit
  })

  // A URL the user is clearly typing out wins the top slot: Enter and Tab then mean the same
  // thing Chrome makes them mean, and the search row stays available right below it.
  // Someone typing the start of a host they visit often is going there, not searching for it.
  const strongHost = local[0]?.hostMatch === 'prefix' || local[0]?.hostMatch === 'word'
  const promoted = !prefixRoute && (strongHost || Boolean(local[0]?.completion)) ? local[0] : null

  if (promoted || actionSuggestion) {
    if (promoted) suggestions.push(promoted)
    if (actionSuggestion) {
      suggestions.push({
        ...actionSuggestion,
        id: promoted ? 'primary-action' : 'primary'
      })
    }
  }

  // Cheat sheets: a bare prefix, or a partially typed token (`>de`, `#am`).
  if (sources.actions && (prefixOnly || /^[>#@:]\S*$/.test(trimmed))) {
    suggestions.push(...prefixHints(trimmed[0], trimmed, target, entries))
  }

  /**
   * "Show search suggestions before browsing history": the operator's answer to a preference that
   * is really about order, so it is applied as an order - the prefix rows keep their relative
   * places and the local entries follow, instead of the two being scored against each other.
   */
  for (const entry of local) {
    if (suggestions.length >= limit) break
    if (suggestions.some((item) => item.id === entry.id)) continue
    suggestions.push(entry)
  }

  if (input.suggestFirst) {
    const weight = (suggestion: OmniboxSuggestion): number =>
      suggestion.kind === 'hint' || suggestion.kind === 'action' ? 0 : 1
    // Stable within each class, so ranking still decides who leads history.
    return [...suggestions].sort((a, b) => weight(a) - weight(b)).slice(0, limit)
  }

  return suggestions.slice(0, limit)
}

/* ------------------------------------------------------------------ *
 * Prefix badges
 * ------------------------------------------------------------------ */

/** Which mark the field paints for a recognised prefix. */
export type PrefixBadgeIcon =
  | 'google'
  | 'brave'
  | 'duckduckgo'
  | 'bing'
  | 'wikipedia'
  | 'perplexity'
  | 'github'
  | 'reddit'
  | 'amazon'
  /** A row the operator added: no brand of ours, so the site's favicon is drawn instead. */
  | 'custom'
  | 'cve'
  | 'terminal'
  | 'shield'
  | 'ghost'
  | 'finder'
  | 'tabs'

export interface PrefixBadge {
  /** The literal text the badge stands for, e.g. `@g ` - also the chip's identity in tests. */
  token: string
  /** Human name, used as the chip's tooltip. */
  label: string
  icon: PrefixBadgeIcon
  /**
   * Set when the badge stands for a row the operator added, so the leading slot can draw the
   * site's favicon in place of a mark this shell does not have.
   */
  entryId?: string
  /** Character count the chip replaces, so it can be exactly as wide as the text it covers. */
  chars: number
}

/** Command tokens the field can badge, labelled the same way the cheat sheet labels them. */
const COMMAND_TOKENS: Record<string, string> = {
  port: 'Open http://localhost:<port>',
  'clear-cache': 'Clear cache and storage',
  sandbox: 'Open a sandboxed window',
  wimh: 'WImH defense overlay',
  defense: 'WImH defense overlay',
  defence: 'WImH defense overlay',
  profile: 'Switch profile',
  user: 'Switch profile'
}

/**
 * Resolves the leading prefix of the field into a badge, or null when there is nothing to
 * paint.
 *
 * Only a *complete* token gets a badge: `@g` and `@g ` do, `@gi` does not, because the operator
 * is still spelling the token out. Nothing here changes the text - the input keeps the raw
 * line and the chip is painted over the characters it stands for. That is also what makes
 * Backspace feel right: delete the space and the token is incomplete again, so the chip
 * disappears and the plain text is right there to edit.
 */
export function resolvePrefixBadge(value: string, entries: OmniboxEntry[] = []): PrefixBadge | null {
  const match = /^([@#>:*&%])([^\s]*)(\s?)/.exec(value)
  if (!match) return null

  const [, prefix, token, space] = match
  const lower = token.toLowerCase()
  const chars = prefix.length + token.length + space.length

  if (token) {
    if (prefix === '@') {
      const engine = entryByKeyword(lower, entries, 'engine')
      if (engine) {
        return {
          token: value.slice(0, chars),
          label: `Search ${engine.label}`,
          icon: engine.builtInEngine ?? 'custom',
          entryId: engine.id,
          chars
        }
      }
    }
    if (prefix === '#') {
      const shortcut = entryByKeyword(lower, entries, 'shortcut')
      if (shortcut) {
        return {
          token: value.slice(0, chars),
          label: `Open ${shortcut.label}`,
          icon: 'custom',
          entryId: shortcut.id,
          chars
        }
      }
    }
    if (prefix === '>') {
      const panel = PANEL_ALIASES.find((alias) => alias.tokens.includes(lower))
      if (panel) {
        return { token: value.slice(0, chars), label: panel.label, icon: 'shield', chars }
      }
    }
    if (prefix === ':') {
      const command = COMMAND_TOKENS[lower]
      if (command) {
        return { token: value.slice(0, chars), label: command, icon: 'terminal', chars }
      }
    }
    return null
  }

  // The single-character prefixes carry their meaning on their own: `*` is the ghost session
  // and `&` is the DOM finder.
  if (prefix === '*') {
    return { token: value.slice(0, chars), label: 'Ghost session', icon: 'ghost', chars }
  }
  if (prefix === '&') {
    return { token: value.slice(0, chars), label: 'DOM finder', icon: 'finder', chars }
  }
  if (prefix === '%') {
    return { token: value.slice(0, chars), label: 'Switch to an open tab', icon: 'tabs', chars }
  }
  return null
}

/* ------------------------------------------------------------------ *
 * Local ranking
 * ------------------------------------------------------------------ */

export interface RankInput {
  query: string
  history: { url: string; title: string; visitCount?: number; lastVisitedAt: number }[]
  bookmarks: { url: string; title: string }[]
  sessionUrls: string[]
  now: number
  limit: number
}

/** How the query lined up with the text, best first. */
type MatchKind = 'prefix' | 'word' | 'substring' | 'acronym'

const MATCH_POINTS: Record<MatchKind, number> = {
  prefix: 1000,
  word: 700,
  substring: 300,
  acronym: 220
}

/** Field weights: the host matters most, then the title, then the rest of the URL. */
const FIELD_WEIGHT = { host: 1, title: 0.92, url: 0.8 } as const

/** Frequency contributes at most this many points; fifty visits is "enough". */
const FREQUENCY_CAP = 50
const FREQUENCY_POINTS = 6
/** Recency half-life: a visit a week old is worth a third of one from today. */
const RECENCY_HALF_LIFE_HOURS = 168
const RECENCY_POINTS = 320
/** A saved bookmark beats an equally ranked page that merely scrolled past. */
const BOOKMARK_BONUS = 140
/** URLs already seen in this session are warm, but not as warm as a real visit count. */
const SESSION_POINTS = 180

/**
 * Ranks local entries for a query: match quality first, then how often and how recently the
 * page was visited. Deterministic - ties break on recency, then on URL - so the same input
 * always produces the same order.
 */
export function rankLocalEntries(input: RankInput): OmniboxSuggestion[] {
  const tokens = input.query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0)
  if (tokens.length === 0) return []

  const bookmarkUrls = new Set(input.bookmarks.map((bookmark) => bookmark.url))
  const sessionSet = new Set(input.sessionUrls)

  const seen = new Set<string>()
  const candidates: OmniboxSuggestion[] = []

  for (const entry of input.history) {
    if (seen.has(entry.url)) continue
    const scored = scoreEntry({
      url: entry.url,
      title: entry.title,
      visitCount: entry.visitCount ?? 1,
      lastVisitedAt: entry.lastVisitedAt,
      tokens,
      now: input.now,
      bookmarked: bookmarkUrls.has(entry.url),
      fromSession: sessionSet.has(entry.url)
    })
    if (!scored) continue
    seen.add(entry.url)
    candidates.push(scored)
  }

  // Bookmarks that predate this history file still deserve to be findable.
  for (const bookmark of input.bookmarks) {
    if (seen.has(bookmark.url)) continue
    const scored = scoreEntry({
      url: bookmark.url,
      title: bookmark.title,
      visitCount: 1,
      lastVisitedAt: input.now,
      tokens,
      now: input.now,
      bookmarked: true
    })
    if (!scored) continue
    seen.add(bookmark.url)
    candidates.push(scored)
  }

  for (const url of input.sessionUrls) {
    if (seen.has(url)) continue
    const scored = scoreEntry({
      url,
      title: url,
      visitCount: 1,
      lastVisitedAt: input.now,
      tokens,
      now: input.now,
      bookmarked: false,
      fromSession: sessionSet.has(url)
    })
    if (!scored) continue
    seen.add(url)
    candidates.push(scored)
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return (b.score ?? 0) - (a.score ?? 0)
    return a.id.localeCompare(b.id)
  })

  return candidates.slice(0, Math.max(input.limit, 1))
}

interface ScoreEntryInput {
  url: string
  title: string
  visitCount: number
  lastVisitedAt: number
  tokens: string[]
  now: number
  bookmarked: boolean
  fromSession?: boolean
}

/**
 * Ranks the tabs that are open right now for the `%` switcher.
 *
 * It is the same scorer the history and bookmark rows use - match quality first, then how well
 * the token lines up with the host - so `%y` finds YouTube whether the tab is titled that way or
 * only its address says so. Tab order in the strip breaks ties, which keeps the list stable.
 */
export function rankOpenTabs(
  query: string,
  tabs: { id: string; url: string | null; title: string }[],
  limit = 8
): OmniboxSuggestion[] {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0)

  const ranked = tabs
    .map((tab, index) => {
      const url = tab.url ?? ''
      const label = tab.title || url || 'New tab'
      const host = url ? hostOfUrl(url) : ''

      // No query yet: every open tab, in strip order.
      if (tokens.length === 0) return { tab, score: tabs.length - index, hostMatch: null as MatchKind | null, index }

      let total = 0
      let hostMatch: MatchKind | null = null
      for (const token of tokens) {
        const fromHost = bestMatch(host, token)
        const fromTitle = bestMatch(label.toLowerCase(), token)
        const fromUrl = bestMatch(url.toLowerCase(), token)
        const best = [
          fromHost && { points: fromHost.points * FIELD_WEIGHT.host, position: fromHost.position },
          fromTitle && { points: fromTitle.points * FIELD_WEIGHT.title, position: fromTitle.position },
          fromUrl && { points: fromUrl.points * FIELD_WEIGHT.url, position: fromUrl.position }
        ]
          .filter((entry): entry is { points: number; position: number } => entry !== null)
          .sort((a, b) => b.points - a.points)[0]

        if (!best) return null
        if (fromHost) hostMatch = fromHost.kind
        total += best.points + Math.max(0, 40 - best.position)
      }
      return { tab, score: total, hostMatch, index }
    })
    .filter((entry): entry is { tab: { id: string; url: string | null; title: string }; score: number; hostMatch: MatchKind | null; index: number } => entry !== null)
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index))
    .slice(0, Math.max(limit, 1))

  return ranked.map(({ tab, score, hostMatch }) => {
    const url = tab.url ?? ''
    const label = tab.title || url || 'New tab'
    return {
      id: `tab:${tab.id}`,
      kind: 'session' as const,
      title: label,
      subtitle: url || 'new tab page',
      icon: 'tab' as const,
      score,
      hostMatch,
      action: { kind: 'tab' as const, tabId: tab.id, url: tab.url, query, label: `Switch to ${label}` }
    }
  })
}

/** Scores one entry, or returns null when any token fails to match anywhere. */
function scoreEntry(input: ScoreEntryInput): OmniboxSuggestion | null {
  const host = hostOfUrl(input.url)
  const display = displayUrl(input.url)

  let total = 0
  let hostMatchKind: MatchKind | null = null
  for (const token of input.tokens) {
    const hostMatch = bestMatch(host, token)
    const titleMatch = bestMatch(input.title.toLowerCase(), token)
    // The URL field is matched with its scheme: someone who types `https://git` means the URL.
    const urlMatch = bestMatch(input.url.toLowerCase(), token)
    const best = [
      hostMatch && { points: hostMatch.points * FIELD_WEIGHT.host, position: hostMatch.position },
      titleMatch && { points: titleMatch.points * FIELD_WEIGHT.title, position: titleMatch.position },
      urlMatch && { points: urlMatch.points * FIELD_WEIGHT.url, position: urlMatch.position }
    ]
      .filter((candidate): candidate is { points: number; position: number } => candidate !== null)
      .sort((a, b) => b.points - a.points)[0]

    if (!best) return null
    if (hostMatch) hostMatchKind = hostMatch.kind
    // Earlier matches in the string are more likely to be what the user is typing.
    total += best.points + Math.max(0, 40 - best.position)
  }

  const frequency = Math.min(input.visitCount, FREQUENCY_CAP) * FREQUENCY_POINTS
  const ageHours = Math.max(0, (input.now - input.lastVisitedAt) / 3_600_000)
  const recency = RECENCY_POINTS * Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS)
  const bonus = (input.bookmarked ? BOOKMARK_BONUS : 0) + (input.fromSession ? SESSION_POINTS : 0)

  const score = Math.round(total + frequency + recency + bonus)
  const completion = completionFor(display, input.url, input.tokens.join(' '))

  return {
    id: `local:${input.url}`,
    kind: input.fromSession ? 'session' : 'history',
    title: input.title || display,
    subtitle: input.url,
    icon: input.bookmarked ? 'history' : input.fromSession ? 'globe' : 'history',
    action: { kind: 'navigate', url: input.url, label: `Open ${input.url}` },
    score,
    hostMatch: hostMatchKind,
    ...(completion ? { completion } : {})
  }
}

/** Best match for one token against one field. */
function bestMatch(
  haystack: string,
  token: string
): { points: number; position: number; kind: MatchKind } | null {
  if (!haystack) return null

  const position = haystack.indexOf(token)
  if (position < 0) {
    return acronymMatch(haystack, token)
  }
  if (position === 0) return { points: MATCH_POINTS.prefix, position, kind: 'prefix' }
  if (/[\s\-._/:?#&=]/.test(haystack[position - 1] ?? '')) {
    return { points: MATCH_POINTS.word, position, kind: 'word' }
  }
  return { points: MATCH_POINTS.substring, position, kind: 'substring' }
}

/** "gh" matches "github.com" the way it matches a filename prefix shortlist. */
function acronymMatch(
  haystack: string,
  token: string
): { points: number; position: number; kind: MatchKind } | null {
  if (token.length > 5) return null
  const initials = haystack
    .split(/[\s\-._/:?#&=]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0])
    .join('')
  const position = initials.indexOf(token)
  return position >= 0 ? { points: MATCH_POINTS.acronym, position, kind: 'acronym' } : null
}

/**
 * Inline completion for the typed text, based only on what is already in memory.
 *
 * The comparison runs against the display form (no scheme), which is what the omnibox shows,
 * so the ghost suffix reads as a continuation of what was typed.
 */
function completionFor(
  display: string,
  url: string,
  query: string
): { ghost: string; value: string } | null {
  const typed = query.trim().toLowerCase()
  if (typed.length < 2 || /\s/.test(query.trim())) return null

  /**
   * The typed text may skip the parts the omnibox does not show: `www.` and the scheme. The
   * ghost is whatever follows the typed text in the matching form, so appending it to the
   * input always reads as a valid address, and accepting fills in the real stored URL.
   */
  const forms = [
    display,
    display.replace(/^www\./i, ''),
    url,
    url.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  ]

  for (const form of forms) {
    if (!form.toLowerCase().startsWith(typed)) continue
    const ghost = form.slice(typed.length)
    if (ghost.length > 0) return { ghost, value: url }
  }
  return null
}

/** Address without its scheme and trailing slash, as the omnibox displays it. */
export function displayUrl(url: string): string {
  const trimmed = url.replace(/^https?:\/\//i, '')
  return trimmed.length > 1 ? trimmed.replace(/\/$/, '') : trimmed
}

function hostOfUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'file:' ? parsed.pathname : parsed.host
  } catch {
    return url
  }
}

function recentSuggestions(
  history: SuggestionInput['history'],
  sessionUrls: string[],
  limit: number,
  bookmarks: { url: string; title: string }[],
  target: SearchTarget
): OmniboxSuggestion[] {
  /**
   * An empty field is still ranked, not just "newest first": the pages someone opens all day
   * belong above the one they glanced at yesterday, and a star makes a page sticky.
   */
  const bookmarkUrls = new Set(bookmarks.map((bookmark) => bookmark.url))
  const now = Date.now()

  const entries = [
    ...history.map((entry) => ({
      url: entry.url,
      title: entry.title || displayUrl(entry.url),
      visitCount: entry.visitCount ?? 1,
      lastVisitedAt: entry.lastVisitedAt,
      fromSession: sessionUrls.includes(entry.url),
      bookmarked: bookmarkUrls.has(entry.url)
    })),
    // Bookmarks outside the history window still show up.
    ...bookmarks
      .filter((bookmark) => !history.some((entry) => entry.url === bookmark.url))
      .map((bookmark) => ({
        url: bookmark.url,
        title: bookmark.title || displayUrl(bookmark.url),
        visitCount: 1,
        lastVisitedAt: now,
        fromSession: sessionUrls.includes(bookmark.url),
        bookmarked: true
      }))
  ]

  const ranked = entries
    .map((entry) => {
      const ageHours = Math.max(0, (now - entry.lastVisitedAt) / 3_600_000)
      const recency = RECENCY_POINTS * Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS)
      const frequency = Math.min(entry.visitCount, FREQUENCY_CAP) * FREQUENCY_POINTS
      const bonus = (entry.bookmarked ? BOOKMARK_BONUS : 0) + (entry.fromSession ? SESSION_POINTS : 0)
      return { ...entry, score: Math.round(recency + frequency + bonus) }
    })
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : b.lastVisitedAt - a.lastVisitedAt))
    .slice(0, Math.max(limit, 1))

  const recent: OmniboxSuggestion[] = ranked.map((entry) => ({
    id: `local:${entry.url}`,
    kind: entry.fromSession ? 'session' : 'history',
    title: entry.title,
    subtitle: entry.fromSession ? 'seen in this session' : entry.url,
    icon: entry.fromSession ? 'globe' : 'history',
    action: { kind: 'navigate', url: entry.url, label: `Open ${entry.url}` },
    score: entry.score
  }))

  /**
   * The engine goes first.
   *
   * An empty field is the one moment the omnibox is asking "where to?", and the answer the browser
   * already knows - the profile's default engine - belongs at the top, highlighted, rather than
   * being something the operator has to remember. Picking it fills the prefix, so the next thing
   * typed is a query and Enter runs it.
   */
  return [defaultEngineRow(target), ...recent].slice(0, Math.max(1, limit))
}

/** The row that stands for the default engine, in the cheat sheet and on an empty field. */
function defaultEngineRow(target: SearchTarget): OmniboxSuggestion {
  return {
    id: `hint:@${target.token}`,
    kind: 'hint',
    title: target.label,
    subtitle: `@${target.token} - the default engine for this profile`,
    icon: 'search',
    mark: target.mark ?? undefined,
    entryId: target.entry?.id,
    defaultEngine: true,
    action: { kind: 'insert', text: `@${target.token} `, label: `Search ${target.label}` }
  }
}

/**
 * The brand mark for an engine.
 *
 * An identity map by value, but a *typed* one: it is the one place that says "these six search
 * engines are also the six marks the field knows how to draw", so a new engine fails to compile
 * here rather than rendering as a magnifying glass.
 */
export function engineMark(id: SearchEngineId): PrefixBadgeIcon | null {
  switch (id) {
    case 'google':
      return 'google'
    case 'brave':
      return 'brave'
    case 'duckduckgo':
      return 'duckduckgo'
    case 'bing':
      return 'bing'
    case 'wikipedia':
      return 'wikipedia'
    case 'perplexity':
      return 'perplexity'
    default:
      return null
  }
}

/** Cheat sheet for a prefix, optionally filtered by what has been typed. */
function prefixHints(
  prefix: string,
  filter = '',
  target: SearchTarget = resolveSearchTarget(DEFAULT_SEARCH_ENGINE),
  entries: OmniboxEntry[] = []
): OmniboxSuggestion[] {
  const needle = filter.slice(1).toLowerCase()
  const hints: OmniboxSuggestion[] = []

  const add = (
    token: string,
    title: string,
    subtitle: string,
    icon: SuggestionIcon,
    needsQuery = true,
    extra?: { mark?: PrefixBadgeIcon | null; defaultEngine?: boolean; entryId?: string }
  ): void => {
    if (needle && !token.startsWith(needle)) return
    hints.push({
      id: `hint:${prefix}${token}`,
      kind: 'hint',
      title,
      subtitle,
      icon,
      /* A brand mark when the row has one, so a list of engines is a list of logos. */
      /* A null mark means "this engine has no brand of its own": leave the generic icon. */
      mark: extra?.mark ?? undefined,
      entryId: extra?.entryId,
      defaultEngine: extra?.defaultEngine,
      action: { kind: 'insert', text: `${prefix}${token}${needsQuery ? ' ' : ''}`, label: title }
    })
  }

  if (prefix === '@') {
    /* The engine list's stored order is the operator's evaluation order. */
    for (const entry of entries.filter((candidate) => candidate.kind === 'engine')) {
      add(
        entry.keyword,
        entry.label,
        `@${entry.keyword} - search ${entry.label}`,
        'search',
        true,
        {
          mark: entry.builtInEngine ? engineMark(entry.builtInEngine) : null,
          defaultEngine: entry.id === target.entry?.id,
          entryId: entry.builtInEngine ? undefined : entry.id
        }
      )
    }
  } else if (prefix === '#') {
    for (const entry of entries.filter((candidate) => candidate.kind === 'shortcut')) {
      add(
        entry.keyword,
        entry.label,
        `#${entry.keyword} - open ${entry.template}`,
        'globe',
        false,
        { entryId: entry.id }
      )
    }
  } else if (prefix === '>') {
    add('sec', '>sec', 'security & recon panel', 'panel', false)
    add('design', '>design', 'live design & CSS panel', 'panel', false)
    add('intercept', '>intercept', 'HTTP interceptor panel', 'panel', false)
    add('defense', '>defense', 'WImH extreme defense mode', 'panel', false)
  } else if (prefix === ':') {
    add('port', ':port', 'open http://localhost:<port>', 'command')
    add('clear-cache', ':clear-cache', 'clear cache and storage', 'command', false)
    add('sandbox', ':sandbox', 'open a sandboxed window', 'command', false)
    add('wimh', ':wimh', 'WImH defense overlay - works in normal mode too', 'command', false)
    add('profile', ':profile', 'switch profile (who is using DevLens?)', 'command', false)
  } else if (prefix === '*') {
    add('', '*', 'ghost session for a URL or query', 'ghost')
  } else if (prefix === '&') {
    add('', '&', 'highlight DOM matches in the active viewport', 'find')
  } else if (prefix === '%') {
    add('', '%', 'switch to a tab that is already open', 'tab')
  }

  return hints
}

function suggestionTitle(action: OmniboxAction): string {
  switch (action.kind) {
    case 'navigate':
      return action.url
    case 'search':
      return `${engineById(action.engine).label}: ${action.query}`
    case 'entry':
      return action.label
    case 'internal':
      return action.label
    case 'hub-search':
      return `${PLATFORM_HUBS.find((hub) => hub.id === action.hub)?.label ?? 'Hub'}: ${action.query}`
    case 'ghost':
      return action.url ? `Ghost: ${action.url}` : 'Enter ghost session'
    case 'panel':
      return action.label
    case 'find':
      return `Highlight ${action.selector}`
    case 'tab':
      return action.label
    case 'command':
      return action.label
    default:
      return action.label
  }
}

function suggestionSubtitle(action: OmniboxAction, raw: string): string {
  switch (action.kind) {
    case 'navigate':
      return 'open in both viewports'
    case 'search':
      return `${action.url}`
    case 'entry':
      return action.url
    case 'internal':
      return `DevLens page - ${action.url}`
    case 'hub-search':
      return `${PLATFORM_HUBS.find((hub) => hub.id === action.hub)?.label ?? 'hub'} - ${action.url}`
    case 'ghost':
      return 'isolated session, trackers blocked'
    case 'panel':
      return 'switch sidebar tool'
    case 'find':
      return 'search the active viewport DOM'
    case 'tab':
      return 'switch to this tab'
    case 'command':
      return action.command === 'port' ? (action.url ?? '') : 'developer command'
    default:
      return raw
  }
}

function iconFor(action: OmniboxAction): SuggestionIcon {
  switch (action.kind) {
    case 'navigate':
      return 'globe'
    case 'search':
      return 'search'
    case 'entry':
      return 'globe'
    case 'internal':
      return 'panel'
    case 'hub-search':
      return 'hub'
    case 'ghost':
      return 'ghost'
    case 'panel':
      return 'panel'
    case 'find':
      return 'find'
    case 'tab':
      return 'tab'
    case 'command':
      return 'command'
    default:
      return 'globe'
  }
}

