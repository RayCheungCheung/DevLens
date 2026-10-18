import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { app, dialog, type BrowserWindow } from 'electron'
import type { WorkspaceEntry } from '../shared/types'

/**
 * Recent project workspaces.
 *
 * A small MRU list in the user data directory. Each entry carries what can be read cheaply
 * from the folder - the package name and the framework that owns the dev server - because
 * that is what makes a workspace card useful at a glance. The active entry is the root that
 * click-to-source and "Open in VS Code" resolve against.
 */
const LIMIT = 12

let entries: WorkspaceEntry[] = []
let activePath = ''
let loaded = false
let saveTimer: NodeJS.Timeout | null = null

function stateFile(): string {
  return join(app.getPath('userData'), 'workspaces.json')
}

function loadWorkspaces(defaultRoot: string): void {
  if (loaded) return
  loaded = true

  try {
    const file = stateFile()
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, 'utf-8')) as { entries?: WorkspaceEntry[]; active?: string }
      entries = Array.isArray(parsed.entries) ? parsed.entries.slice(0, LIMIT) : []
      activePath = typeof parsed.active === 'string' ? parsed.active : ''
    }
  } catch (error) {
    console.warn('[devlens] could not read the workspace list', error)
  }

  if (defaultRoot && !entries.some((entry) => entry.path === defaultRoot)) {
    entries = [...entries, describe(defaultRoot)].slice(0, LIMIT)
  }

  // An explicit root (config file or DEVLENS_WORKSPACE_ROOT) always wins over whatever was
  // last active, so a scripted run starts where it asked to start.
  const explicit = process.env.DEVLENS_WORKSPACE_ROOT
  if (explicit && existsSync(explicit)) {
    activePath = resolve(explicit)
    if (!entries.some((entry) => entry.path === activePath)) {
      entries = [describe(activePath), ...entries].slice(0, LIMIT)
    }
    return
  }

  if (!activePath || !entries.some((entry) => entry.path === activePath)) {
    activePath = defaultRoot || entries[0]?.path || ''
  }
}

function scheduleSave(): void {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      writeFileSync(stateFile(), JSON.stringify({ entries, active: activePath }, null, 2), 'utf-8')
    } catch (error) {
      console.warn('[devlens] could not persist the workspace list', error)
    }
  }, 300)
}

/** Reads what a workspace declares about itself, without any project-specific guessing. */
function describe(path: string): WorkspaceEntry {
  const entry: WorkspaceEntry = {
    path,
    name: basename(path) || path,
    packageName: null,
    framework: null,
    lastOpenedAt: Date.now(),
    active: false
  }

  try {
    const manifestPath = join(path, 'package.json')
    if (!existsSync(manifestPath)) return entry

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      name?: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    entry.packageName = manifest.name ?? null

    const deps = { ...manifest.dependencies, ...manifest.devDependencies }
    const known: [string, string][] = [
      ['next', 'Next.js'],
      ['nuxt', 'Nuxt'],
      ['@angular/core', 'Angular'],
      ['svelte', 'Svelte'],
      ['vite', 'Vite'],
      ['electron', 'Electron'],
      ['expo', 'Expo'],
      ['react-scripts', 'Create React App'],
      ['astro', 'Astro'],
      ['remix', 'Remix'],
      ['react', 'React']
    ]
    entry.framework = known.find(([dependency]) => dependency in deps)?.[1] ?? null
  } catch {
    /* unreadable manifest: the folder name is still useful */
  }

  return entry
}

export function listWorkspaces(defaultRoot: string): WorkspaceEntry[] {
  loadWorkspaces(defaultRoot)
  return entries.map((entry) => ({ ...entry, active: entry.path === activePath }))
}

export function activeWorkspace(defaultRoot: string): string {
  loadWorkspaces(defaultRoot)
  return activePath || defaultRoot
}

export function addWorkspace(input: string, defaultRoot: string): WorkspaceEntry[] {
  loadWorkspaces(defaultRoot)
  const path = resolve(input)
  if (!existsSync(path)) return listWorkspaces(defaultRoot)

  const existing = entries.find((entry) => entry.path === path)
  const next = existing
    ? { ...existing, lastOpenedAt: Date.now() }
    : describe(path)

  entries = [next, ...entries.filter((entry) => entry.path !== path)].slice(0, LIMIT)
  scheduleSave()
  return listWorkspaces(defaultRoot)
}

export function removeWorkspace(path: string, defaultRoot: string): WorkspaceEntry[] {
  loadWorkspaces(defaultRoot)
  entries = entries.filter((entry) => entry.path !== resolve(path))
  if (!entries.some((entry) => entry.path === activePath)) {
    activePath = defaultRoot
  }
  scheduleSave()
  return listWorkspaces(defaultRoot)
}

export function setActiveWorkspace(path: string, defaultRoot: string): WorkspaceEntry[] {
  loadWorkspaces(defaultRoot)
  const target = resolve(path)
  if (!entries.some((entry) => entry.path === target)) addWorkspace(target, defaultRoot)
  activePath = target
  entries = entries.map((entry) => ({ ...entry, lastOpenedAt: entry.path === target ? Date.now() : entry.lastOpenedAt }))
  scheduleSave()
  return listWorkspaces(defaultRoot)
}

export async function pickWorkspace(
  defaultRoot: string,
  parent: BrowserWindow | null
): Promise<WorkspaceEntry[]> {
  const options: Electron.OpenDialogOptions = {
    title: 'Add a workspace to DevLens',
    properties: ['openDirectory']
  }
  const result = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return listWorkspaces(defaultRoot)
  return addWorkspace(result.filePaths[0], defaultRoot)
}

/** Keeps `active` flags truthful in the value returned to the renderer. */
export function markActive(list: WorkspaceEntry[]): WorkspaceEntry[] {
  return list.map((entry) => ({ ...entry, active: entry.path === activePath }))
}
