import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, session } from 'electron'
import type { BrowserProfile, ProfileAvatar } from '../shared/types'

/**
 * Browser profiles.
 *
 * A profile is a persistent Electron partition, so cookies, localStorage, IndexedDB and
 * cached sessions are bound to it and never leak into another identity. The registry is a
 * small JSON file in the user data directory; the built-in profile keeps the original
 * partition so an existing login survives the upgrade to profiles.
 */
const BUILTIN_ID = 'default'
const LIMIT = 12
/** Glyphs the selector offers, so a stored avatar is always one this build can draw. */
const AVATARS: ProfileAvatar[] = ['user', 'briefcase', 'laptop', 'flask', 'shield', 'ghost', 'star']

let profiles: BrowserProfile[] = []
let activeId = BUILTIN_ID
let loaded = false
let saveTimer: NodeJS.Timeout | null = null
let defaultPartition = 'persist:devlens-viewport'
/**
 * "Always ask on startup" is on by default: picking an identity is a deliberate act, and a
 * shared machine should never silently open somebody else's session. It is a browser-wide
 * setting that lives with the registry rather than inside a profile.
 */
let askOnStartup = true
/** Partitions already handed to the interceptor, so nothing is instrumented twice. */
const instrumented = new Set<string>()

export function configureProfiles(input: { defaultPartition: string; knownPartitions: string[] }): void {
  defaultPartition = input.defaultPartition
  for (const partition of input.knownPartitions) instrumented.add(partition)
}

function stateFile(): string {
  return join(app.getPath('userData'), 'profiles.json')
}

function load(): void {
  if (loaded) return
  loaded = true

  try {
    const file = stateFile()
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, 'utf-8')) as {
        profiles?: BrowserProfile[]
        activeId?: string
        askOnStartup?: boolean
      }
      profiles = Array.isArray(parsed.profiles) ? parsed.profiles.slice(0, LIMIT) : []
      activeId = typeof parsed.activeId === 'string' ? parsed.activeId : BUILTIN_ID
      askOnStartup = parsed.askOnStartup !== false
    }
  } catch (error) {
    console.warn('[devlens] could not read the profile registry', error)
  }

  if (!profiles.some((profile) => profile.id === BUILTIN_ID)) {
    profiles = [
      {
        id: BUILTIN_ID,
        name: 'Default',
        partition: defaultPartition,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        active: true,
        removable: false
      },
      ...profiles
    ]
  }

  if (!profiles.some((profile) => profile.id === activeId)) activeId = BUILTIN_ID
}

function scheduleSave(): void {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    writeRegistry()
  }, 250)
}

function writeRegistry(): void {
  try {
    writeFileSync(
      stateFile(),
      JSON.stringify({ profiles, activeId, askOnStartup }, null, 2),
      'utf-8'
    )
  } catch (error) {
    console.warn('[devlens] could not persist the profile registry', error)
  }
}

/**
 * Writes the registry now.
 *
 * The debounce would otherwise lose the last change when the app is closed straight after it -
 * unchecking the startup prompt and quitting is exactly that case.
 */
export function flushProfileRegistry(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  writeRegistry()
}

function slug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
  return cleaned.length > 0 ? cleaned : 'profile'
}

function withActiveFlag(list: BrowserProfile[]): BrowserProfile[] {
  return list.map((profile) => ({ ...profile, active: profile.id === activeId }))
}

export function listProfiles(): BrowserProfile[] {
  load()
  return withActiveFlag(profiles)
}

export function activeProfile(): BrowserProfile {
  load()
  return profiles.find((profile) => profile.id === activeId) ?? profiles[0]
}

/**
 * The id of the active profile.
 *
 * Per-profile storage resolves its directory from this, so it is deliberately a plain function
 * rather than a cached value: switching profiles has to redirect the next file read.
 */
export function activeProfileId(): string {
  load()
  return profiles.some((profile) => profile.id === activeId) ? activeId : BUILTIN_ID
}

export function askOnStartupNow(): boolean {
  load()
  return askOnStartup
}

export function setAskOnStartup(next: boolean): boolean {
  load()
  askOnStartup = next
  scheduleSave()
  return askOnStartup
}

export function activeProfilePartition(): string {
  return activeProfile()?.partition ?? defaultPartition
}

export function createProfile(
  rawName: string | { name?: string; avatar?: ProfileAvatar }
): BrowserProfile[] {
  load()
  const input = typeof rawName === 'string' ? { name: rawName } : rawName
  const name = (input?.name ?? '').trim().slice(0, 32) || `Profile ${profiles.length + 1}`
  const id = `${slug(name)}-${Math.random().toString(36).slice(2, 6)}`

  profiles = [
    ...profiles,
    {
      id,
      name,
      partition: `persist:devlens-profile-${id}`,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      active: false,
      removable: true,
      avatar: AVATARS.includes(input?.avatar as ProfileAvatar)
        ? (input.avatar as ProfileAvatar)
        : 'user'
    }
  ].slice(0, LIMIT)

  scheduleSave()
  return withActiveFlag(profiles)
}

export function switchProfile(id: string): BrowserProfile[] {
  load()
  const target = profiles.find((profile) => profile.id === id)
  if (!target) return withActiveFlag(profiles)

  activeId = target.id
  profiles = profiles.map((profile) =>
    profile.id === target.id ? { ...profile, lastUsedAt: Date.now() } : profile
  )
  scheduleSave()
  return withActiveFlag(profiles)
}

/** Deleting wipes the profile's storage: a removed identity leaves nothing behind. */
export async function deleteProfile(id: string): Promise<BrowserProfile[]> {
  load()
  const target = profiles.find((profile) => profile.id === id)
  if (!target || !target.removable || target.id === activeId) return withActiveFlag(profiles)

  try {
    const ses = session.fromPartition(target.partition, { cache: true })
    await ses.clearStorageData()
    await ses.clearCache()
    await ses.clearAuthCache()
  } catch (error) {
    console.warn('[devlens] could not wipe the deleted profile', error)
  }

  profiles = profiles.filter((profile) => profile.id !== id)
  instrumented.delete(target.partition)
  scheduleSave()
  return withActiveFlag(profiles)
}

export function markInstrumented(partition: string): boolean {
  if (instrumented.has(partition)) return false
  instrumented.add(partition)
  return true
}
