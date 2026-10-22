import { join } from 'node:path'
import { app } from 'electron'

/**
 * The on-disk directory for one profile. This is kept in a dependency-free module so both
 * the storage readers and the profile deleter can use the same canonical path without an
 * import cycle.
 */
export function profileDataDirPathFor(profileId: string): string {
  const id = String(profileId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'default'
  return join(app.getPath('userData'), 'profiles', id)
}

