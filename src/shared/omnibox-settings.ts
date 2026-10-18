/**
 * The operator's omnibox configuration.
 *
 * Search engines and site shortcuts are separate ordered collections because they use different
 * prefixes and different semantics: `@` always searches through a `%s` template, while `#` always
 * opens a fixed site address. Shipping built-ins as ordinary entries means the same edit, delete
 * and reorder path applies to every row - there is no protected row hiding behind the UI.
 *
 * The shape is JSON because it lives in the profile's `preferences.json`: per profile, local, and
 * small. Main validates every entry on the way in.
 */

import type { SearchEngineId } from './omnibox'

export type OmniboxEntryKind = 'engine' | 'shortcut'
export type DefaultEngineRef = string

export interface OmniboxEntry {
  /** Stable identity used by the default-engine selector and suggestion favicons. */
  id: string
  label: string
  /** Trigger without its `@` or `#`, lower case and whitespace-free. */
  keyword: string
  /** A `%s` query template for engines; a fixed URL for shortcuts. */
  template: string
  kind: OmniboxEntryKind
  /** Built-in brand metadata. Editing the row keeps its logo without locking the row. */
  builtInEngine?: SearchEngineId
  postData?: string
  suggestionsUrl?: string
}

/** Which classes of local row the dropdown may offer. */
export interface OmniboxSources {
  history: boolean
  bookmarks: boolean
  tabs: boolean
  actions: boolean
  recentSearches: boolean
}

export interface OmniboxSettings {
  /** Points at an ordered engine entry. */
  defaultEngine: DefaultEngineRef
  engines: OmniboxEntry[]
  shortcuts: OmniboxEntry[]
  showSearchTerms: boolean
  suggestFirst: boolean
  sources: OmniboxSources
}

export const DEFAULT_OMNIBOX_ENGINES: OmniboxEntry[] = [
  {
    id: 'builtin:duckduckgo',
    label: 'DuckDuckGo',
    keyword: 'd',
    template: 'https://duckduckgo.com/?q=%s',
    kind: 'engine',
    builtInEngine: 'duckduckgo'
  },
  {
    id: 'builtin:perplexity',
    label: 'Perplexity',
    keyword: 'p',
    template: 'https://www.perplexity.ai/search?q=%s',
    kind: 'engine',
    builtInEngine: 'perplexity'
  },
  {
    id: 'builtin:brave',
    label: 'Brave',
    keyword: 'b',
    template: 'https://search.brave.com/search?q=%s',
    kind: 'engine',
    builtInEngine: 'brave'
  },
  {
    id: 'builtin:wikipedia',
    label: 'Wikipedia',
    keyword: 'w',
    template: 'https://en.wikipedia.org/wiki/Special:Search?search=%s',
    kind: 'engine',
    builtInEngine: 'wikipedia'
  },
  {
    id: 'builtin:bing',
    label: 'Bing',
    keyword: 'bi',
    template: 'https://www.bing.com/search?q=%s',
    kind: 'engine',
    builtInEngine: 'bing'
  },
  {
    id: 'builtin:google',
    label: 'Google',
    keyword: 'g',
    template: 'https://www.google.com/search?q=%s',
    kind: 'engine',
    builtInEngine: 'google'
  }
]

export const DEFAULT_SITE_SHORTCUTS: OmniboxEntry[] = [
  {
    id: 'shortcut:youtube',
    label: 'YouTube',
    keyword: 'yt',
    template: 'https://www.youtube.com/',
    kind: 'shortcut'
  },
  {
    id: 'shortcut:github',
    label: 'GitHub',
    keyword: 'gh',
    template: 'https://github.com/',
    kind: 'shortcut'
  },
  {
    id: 'shortcut:notion',
    label: 'Notion',
    keyword: 'notion',
    template: 'https://www.notion.so/',
    kind: 'shortcut'
  },
  {
    id: 'shortcut:reddit',
    label: 'Reddit',
    keyword: 'r',
    template: 'https://www.reddit.com/',
    kind: 'shortcut'
  },
  {
    id: 'shortcut:amazon',
    label: 'Amazon',
    keyword: 'amz',
    template: 'https://www.amazon.com/',
    kind: 'shortcut'
  },
  {
    id: 'shortcut:cve',
    label: 'CVE database',
    keyword: 'cve',
    template: 'https://www.cve.org/',
    kind: 'shortcut'
  }
]

export const DEFAULT_OMNIBOX_SETTINGS: OmniboxSettings = {
  defaultEngine: 'builtin:duckduckgo',
  engines: DEFAULT_OMNIBOX_ENGINES.map((entry) => ({ ...entry })),
  shortcuts: DEFAULT_SITE_SHORTCUTS.map((entry) => ({ ...entry })),
  showSearchTerms: true,
  suggestFirst: false,
  sources: {
    history: true,
    bookmarks: true,
    tabs: true,
    actions: true,
    recentSearches: true
  }
}

/** Defaults in one list for the parser and suggestion builder. */
export function defaultOmniboxEntries(): OmniboxEntry[] {
  return [
    ...DEFAULT_OMNIBOX_ENGINES.map((entry) => ({ ...entry })),
    ...DEFAULT_SITE_SHORTCUTS.map((entry) => ({ ...entry }))
  ]
}

/** Both user-visible lists in storage order. */
export function omniboxEntries(settings: Pick<OmniboxSettings, 'engines' | 'shortcuts'>): OmniboxEntry[] {
  return [...settings.engines, ...settings.shortcuts]
}

export function cloneOmniboxSettings(settings: OmniboxSettings): OmniboxSettings {
  return {
    ...settings,
    engines: settings.engines.map((entry) => ({ ...entry })),
    shortcuts: settings.shortcuts.map((entry) => ({ ...entry })),
    sources: { ...settings.sources }
  }
}

/** The prefix a kind is typed with. */
export function entryPrefix(kind: OmniboxEntryKind): '@' | '#' {
  return kind === 'engine' ? '@' : '#'
}

/** A template with `%s` searches; one without it is a shortcut. */
export function entryKind(template: string): OmniboxEntryKind {
  return template.includes('%s') ? 'engine' : 'shortcut'
}

/** Normalises a trigger: no marker, lower case, no whitespace. */
export function normalizeKeyword(value: string): string {
  return value.trim().replace(/^[@#]+/, '').replace(/\s+/g, '').toLowerCase()
}

export function entryUrl(entry: Pick<OmniboxEntry, 'template' | 'kind'>, query = ''): string {
  if (entry.kind !== 'engine') return entry.template
  return entry.template.replaceAll('%s', encodeURIComponent(query))
}

export function normalizeTemplate(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) || trimmed.startsWith('file:')) return trimmed
  return `https://${trimmed.replace(/^\/+/, '')}`
}

export function entryId(kind: OmniboxEntryKind, keyword: string, label: string): string {
  const slug = (keyword || label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${kind}:${slug || 'entry'}`
}

export function entryFromDraft(
  draft: {
    label: string
    keyword: string
    template: string
    postData?: string
    suggestionsUrl?: string
  },
  kind: OmniboxEntryKind
): OmniboxEntry | null {
  const template = normalizeTemplate(draft.template)
  const keyword = normalizeKeyword(draft.keyword)
  if (!template || !keyword) return null
  if (kind === 'engine' && !template.includes('%s')) return null
  if (kind === 'shortcut' && template.includes('%s')) return null

  const label = draft.label.trim() || template.replace(/^https?:\/\//, '').split('/')[0]
  const postData = draft.postData?.trim()
  const suggestionsUrl = draft.suggestionsUrl?.trim()
  return {
    id: entryId(kind, keyword, label),
    label,
    keyword,
    template,
    kind,
    ...(postData && kind === 'engine' ? { postData } : {}),
    ...(suggestionsUrl && kind === 'engine'
      ? { suggestionsUrl: normalizeTemplate(suggestionsUrl) }
      : {})
  }
}

/** Keeps a stored default valid against the ordered engine list. */
export function resolveDefaultEngine(settings: OmniboxSettings): DefaultEngineRef {
  if (settings.engines.some((entry) => entry.id === settings.defaultEngine)) {
    return settings.defaultEngine
  }
  return settings.engines[0]?.id ?? ''
}

/** Controls the order and identity of every persisted row. */
export function sanitizeOmniboxEntries(
  rawEntries: unknown,
  kind: OmniboxEntryKind
): OmniboxEntry[] {
  const entries: OmniboxEntry[] = []
  const ids = new Set<string>()
  for (const raw of Array.isArray(rawEntries) ? rawEntries : []) {
    if (!raw || typeof raw !== 'object') continue
    const candidate = raw as Partial<OmniboxEntry>
    const template = normalizeTemplate(String(candidate.template ?? ''))
    if (!template) continue
    if (kind === 'engine' && !template.includes('%s')) continue
    if (kind === 'shortcut' && template.includes('%s')) continue

    const keyword = normalizeKeyword(String(candidate.keyword ?? ''))
    if (!keyword) continue
    const label =
      String(candidate.label ?? '').trim() ||
      template.replace(/^https?:\/\//, '').split('/')[0]
    const id =
      typeof candidate.id === 'string' && candidate.id.trim()
        ? candidate.id.trim()
        : entryId(kind, keyword, label)
    if (ids.has(id)) continue
    ids.add(id)

    const postData =
      kind === 'engine' && typeof candidate.postData === 'string'
        ? candidate.postData.trim()
        : ''
    const suggestionsUrl =
      kind === 'engine' && typeof candidate.suggestionsUrl === 'string'
        ? candidate.suggestionsUrl.trim()
        : ''
    const builtInEngine =
      kind === 'engine' && typeof candidate.builtInEngine === 'string'
        ? candidate.builtInEngine
        : undefined

    entries.push({
      id,
      label,
      keyword,
      template,
      kind,
      ...(builtInEngine ? { builtInEngine: builtInEngine as SearchEngineId } : {}),
      ...(postData ? { postData } : {}),
      ...(suggestionsUrl ? { suggestionsUrl: normalizeTemplate(suggestionsUrl) } : {})
    })
  }
  return entries
}
