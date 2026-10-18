import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { activeProfileId } from './profiles'

/**
 * Per-profile local storage.
 *
 * Everything DevLens keeps on disk about browsing - history, bookmarks, and anything added
 * later - lives under `userData/profiles/<profileId>/`. Two profiles therefore cannot read each
 * other's files by accident, and a profile that is deleted takes its own directory with it
 * instead of leaving records behind in a shared one.
 *
 * The path is resolved at call time rather than cached: switching profiles has to redirect the
 * very next read and write, which is what the stores below rely on.
 */
export function profileDataDir(): string {
  const id = activeProfileId()
  const dir = join(app.getPath('userData'), 'profiles', id)
  try {
    mkdirSync(dir, { recursive: true })
  } catch (error) {
    console.warn('[devlens] could not create the profile data directory', error)
  }
  return dir
}

/** Absolute path of a file inside the active profile's data directory. */
export function profileFile(name: string): string {
  return join(profileDataDir(), name)
}
