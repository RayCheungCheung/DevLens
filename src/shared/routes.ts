/**
 * DevLens's own pages.
 *
 * The shell is a browser, so its internal surfaces are addressed the way a browser addresses
 * things: a URL, typed in the same field, carried by the same tab model. `devlens:` is a scheme
 * the shell itself answers - nothing routes it, nothing loads it in a guest, and `toUrl()` never
 * sees it because the omnibox resolves an internal route before it decides "address or query".
 *
 * The id and the URL are deliberately different strings: the id is what the shell switches on,
 * the URL is what the operator types and what the address bar shows. Keeping the mapping in one
 * place is what stops a route from being spelled three ways.
 */

export type InternalRouteId = 'newtab' | 'omnibox-settings' | 'history' | 'settings' | 'bookmarks'

export const INTERNAL_ROUTES: Record<InternalRouteId, string> = {
  /** The dashboard is an empty tab's page; it has a URL for completeness, not for typing. */
  newtab: 'devlens:newtab',
  'omnibox-settings': 'devlens:settings/omnibox',
  /** This profile's visited pages, as a full tab surface - not just the dock's panel. */
  history: 'devlens:history',
  /** The profile settings hub; the omnibox section is one of its pages. */
  settings: 'devlens:settings',
  /** Saved bookmarks, as a full tab surface. */
  bookmarks: 'devlens:bookmarks'
}

const ROUTE_LABELS: Record<InternalRouteId, string> = {
  newtab: 'New tab',
  'omnibox-settings': 'Omnibox & Engines',
  history: 'History',
  settings: 'Settings',
  bookmarks: 'Bookmarks'
}

/** The URL for a route id - what a tab's address becomes. */
export function internalRouteUrl(route: InternalRouteId): string {
  return INTERNAL_ROUTES[route]
}

/** The human name of a route, for a tab title. */
export function internalRouteLabel(route: InternalRouteId): string {
  return ROUTE_LABELS[route]
}

/**
 * The route a URL names, or null when it is an ordinary address.
 *
 * Compared case-insensitively and without a trailing slash: an operator who types
 * `devlens:settings/omnibox/` meant the same page, and answering that with a search for the text
 * would be the shell pretending not to know its own name.
 */
export function internalRouteOf(url: string | null | undefined): InternalRouteId | null {
  if (!url) return null
  const normalized = url.trim().replace(/\/+$/, '').toLowerCase()
  for (const [route, value] of Object.entries(INTERNAL_ROUTES) as [InternalRouteId, string][]) {
    if (value.toLowerCase() === normalized) return route
  }
  return null
}

/**
 * The tab family a route belongs to.
 *
 * Settings sections are one control centre, not one tab each: opening `/omnibox` while another
 * settings section is already in a tab should retarget that tab rather than grow a second form.
 * Every other internal page keeps its own identity.
 */
export function internalRouteScopeOf(url: string | null | undefined): string | null {
  if (!url) return null
  const normalized = url.trim().replace(/\/+$/, '').toLowerCase()
  if (normalized === 'devlens:settings' || normalized.startsWith('devlens:settings/')) {
    return 'settings'
  }
  return internalRouteOf(url)
}

/** True when this URL is one of the shell's own pages. */
export function isInternalUrl(url: string | null | undefined): boolean {
  return internalRouteOf(url) !== null
}

/** Route ids whose page can be opened in a tab by the operator. */
export const OPENABLE_ROUTES: InternalRouteId[] = [
  'omnibox-settings',
  'history',
  'settings',
  'bookmarks'
]
