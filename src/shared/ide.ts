export const IDE_PRESETS = [
  { id: 'vscode', label: 'Visual Studio Code', scheme: 'vscode', command: 'code' },
  { id: 'vscode-insiders', label: 'Visual Studio Code Insiders', scheme: 'vscode-insiders', command: 'code-insiders' },
  { id: 'vscodium', label: 'VSCodium', scheme: 'vscodium', command: 'codium' },
  { id: 'cursor', label: 'Cursor', scheme: 'cursor', command: 'cursor' },
  { id: 'codebuddy', label: 'CodeBuddy', scheme: 'codebuddy', command: 'codebuddy' },
  { id: 'codebuddycn', label: 'CodeBuddy CN', scheme: 'codebuddycn', command: 'codebuddycn' },
  { id: 'trae', label: 'Trae', scheme: 'trae', command: 'trae' },
  { id: 'windsurf', label: 'Windsurf', scheme: 'windsurf', command: 'windsurf' }
] as const

export type IdePresetId = (typeof IDE_PRESETS)[number]['id']
export type IdeId = IdePresetId

export interface IdeOption {
  id: IdePresetId
  label: string
  scheme: string
  installed: boolean
  detail: string | null
}

export function isIdeId(value: unknown): value is IdeId {
  return IDE_PRESETS.some((preset) => preset.id === value)
}

export function idePreset(id: IdePresetId) {
  return IDE_PRESETS.find((preset) => preset.id === id) ?? IDE_PRESETS[0]
}
