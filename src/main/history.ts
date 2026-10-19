import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import type { HistoryEntry } from '../shared/types'
import { activeProfileId } from './profiles'
import { profileFile } from './storage'
import { preferencesNow } from './preferences'

/**
 * Visited pages, kept small and local.
 *
 * Only addresses worth revisiting are stored (http/https/file), the list is de-duplicated
 * by URL and newest-first, and it is written to the user data directory on a short debounce
 * so a crash never loses more than a moment of browsing.
 */
const STORAGE_CAP = 500
const SAVE_DEBOUNCE_MS = 400

let entries: HistoryEntry[] = []
/** Which profile the in-memory list belongs to; a switch forces a re-read. */
let loadedFor: string | null = null
/**
 * Pending write, with the file it belongs to captured up front.
 *
 * Resolving the path when the timer fires would send a save that was queued for one profile into
 * whichever profile happened to be active by then - the one way a page could cross between
 * identities on disk. The path and the payload are therefore frozen together.
 */
let saveTimer: NodeJS.Timeout | null = null
let pendingSave: { file: string; payload: string } | null = null

function historyFile(): string {
  return profileFile('history.json')
}

/**
 * Loads the active profile's history, reloading whenever the profile changed.
 *
 * This is the hot-swap: switching identity drops the previous list from memory before the new
 * one is read, so no page from one profile can ever be suggested - or written - in another.
 */
function load(): void {
  const profileId = activeProfileId()
  if (loadedFor === profileId) return
  loadedFor = profileId
  entries = []
  try {
    const file = historyFile()
    if (!existsSync(file)) return
    const parsed = JSON.parse(readFileSync(file, 'utf-8')) as HistoryEntry[]
    entries = Array.isArray(parsed) ? parsed.filter(isUsable).slice(0, STORAGE_CAP) : []
  } catch (error) {
    console.warn('[devlens] could not read browsing history', error)
    entries = []
  }
}

function scheduleSave(): void {
  pendingSave = { file: historyFile(), payload: JSON.stringify(entries.slice(0, STORAGE_CAP)) }
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    const job = pendingSave
    pendingSave = null
    if (!job) return
    try {
      writeFileSync(job.file, job.payload, 'utf-8')
    } catch (error) {
      console.warn('[devlens] could not persist browsing history', error)
    }
  }, SAVE_DEBOUNCE_MS)
}

/**
 * Writes any queued save right now.
 *
 * Called before the active profile changes, so a page visited a moment before the switch lands
 * in the profile that was open - not in the one that is about to be.
 */
export function flushHistory(): void {
  if (!saveTimer) return
  clearTimeout(saveTimer)
  saveTimer = null
  const job = pendingSave
  pendingSave = null
  if (!job) return
  try {
    writeFileSync(job.file, job.payload, 'utf-8')
  } catch (error) {
    console.warn('[devlens] could not persist browsing history', error)
  }
}

/**
 * Records one visit.
 *
 * `private` is the bypass a private tab takes, and it is checked *here* rather than only at the
 * IPC door: a caller that forgets to look at the tab would otherwise be able to write a private
 * visit down and put it in tomorrow's omnibox suggestions. The function answers whether it
 * stored anything, so the caller can count the refusal.
 */
export function historyAdd(input: { url: string; title?: string; private?: boolean }): boolean {
  if (input.private) return false
  if (preferencesNow().privacy.historyPolicy === 'never') return false
  load()
  const url = normalise(input.url)
  if (!url) return false

  const existing = entries.find((entry) => entry.url === url)
  if (existing) {
    existing.visitCount += 1
    existing.lastVisitedAt = Date.now()
    if (input.title) existing.title = input.title
    entries = [existing, ...entries.filter((entry) => entry.url !== url)]
  } else {
    entries = [
      {
        url,
        title: input.title?.trim() || url,
        visitCount: 1,
        lastVisitedAt: Date.now()
      },
      ...entries
    ].slice(0, STORAGE_CAP)
  }
  scheduleSave()
  return true
}

export function historyList(limit: number): HistoryEntry[] {
  load()
  return entries.slice(0, Math.max(0, limit))
}

export function historyClear(): void {
  entries = []
  loadedFor = activeProfileId()
  scheduleSave()
}

/** Drops visits older than a retention window and returns how many records remain. */
export function historyPrune(days: number): number {
  load()
  const safeDays = Math.min(3650, Math.max(1, Math.round(days)))
  const cutoff = Date.now() - safeDays * 24 * 60 * 60 * 1000
  entries = entries.filter((entry) => entry.lastVisitedAt >= cutoff)
  scheduleSave()
  return entries.length
}

/** Keeps only visits whose host belongs to one of the supplied origins. */
export function historyKeepOrigins(origins: string[]): number {
  load()
  const hosts = new Set<string>()
  for (const origin of origins) {
    try {
      hosts.add(new URL(origin).host.toLowerCase())
    } catch {
      /* an unusable origin keeps nothing */
    }
  }
  entries = hosts.size
    ? entries.filter((entry) => {
        try {
          return hosts.has(new URL(entry.url).host.toLowerCase())
        } catch {
          return false
        }
      })
    : []
  scheduleSave()
  return entries.length
}

function normalise(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) return null
    // Fragments are noise in a suggestion list.
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return null
  }
}

function isUsable(entry: HistoryEntry): boolean {
  return typeof entry?.url === 'string' && typeof entry?.lastVisitedAt === 'number'
}
