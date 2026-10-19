import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { basename } from 'node:path'
import { IDE_PRESETS, type IdeOption } from '../shared/ide'

const run = promisify(execFile)
let cached: IdeOption[] | null = null

async function windowsScheme(scheme: string): Promise<string | null> {
  try {
    const { stdout } = await run(
      'reg.exe',
      ['query', `HKCR\\${scheme}\\shell\\open\\command`, '/ve'],
      { windowsHide: true, timeout: 1500, encoding: 'utf8' }
    )
    const line = stdout
      .split(/\r?\n/)
      .find((entry) => /REG_SZ|REG_EXPAND_SZ/i.test(entry))
    const value = line?.replace(/^.*?REG_(?:EXPAND_)?SZ\s+/i, '').trim()
    if (!value) return null
    const quoted = /^"([^"]+)"/.exec(value)
    return quoted?.[1] ?? value.split(/\s+/)[0] ?? null
  } catch {
    return null
  }
}

async function unixCommand(command: string): Promise<string | null> {
  try {
    const { stdout } = await run('which', [command], {
      timeout: 1500,
      encoding: 'utf8'
    })
    return stdout.trim() || null
  } catch {
    return null
  }
}

/** Detects editors through OS URI registrations, so every listed option is launchable. */
export async function listIdeOptions(): Promise<IdeOption[]> {
  if (cached) return cached
  cached = await Promise.all(
    IDE_PRESETS.map(async (preset) => {
      const executable =
        process.platform === 'win32'
          ? await windowsScheme(preset.scheme)
          : await unixCommand(preset.command)
      return {
        id: preset.id,
        label: preset.label,
        scheme: preset.scheme,
        installed: Boolean(executable),
        detail: executable ? basename(executable) : null
      }
    })
  )
  return cached
}

export async function schemeForIde(id: string): Promise<string | null> {
  const options = await listIdeOptions()
  return options.find((option) => option.id === id && option.installed)?.scheme ?? null
}
