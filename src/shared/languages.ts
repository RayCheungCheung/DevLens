/** Persistent language, translation and spell-check preferences. */

export interface OfflineLanguageModel {
  id: string
  label: string
  size: string
  installed: boolean
}

export interface LanguagePreferences {
  primaryLanguage: string
  fallbackLanguage: string
  followSystemLocale: boolean
  systemLocale: string
  webLanguages: string[]
  localTranslation: boolean
  autoTranslatePrompt: boolean
  offlineModels: OfflineLanguageModel[]
  spellCheck: boolean
  spellCheckLanguages: string[]
}

export const LANGUAGE_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'en-US', label: 'English (US)' },
  { id: 'en-HK', label: 'English (Hong Kong)' },
  { id: 'zh-TW', label: 'Chinese (Traditional)' },
  { id: 'zh-MO', label: 'Chinese (Macao)' },
  { id: 'zh-CN', label: 'Chinese (Simplified)' },
  { id: 'ja', label: 'Japanese' },
  { id: 'ko', label: 'Korean' }
] as const

export const DEFAULT_LANGUAGE_PREFERENCES: LanguagePreferences = {
  primaryLanguage: 'en',
  fallbackLanguage: 'zh-TW',
  followSystemLocale: true,
  systemLocale: 'en-HK',
  webLanguages: ['en-US', 'zh-TW', 'zh-CN'],
  localTranslation: true,
  autoTranslatePrompt: false,
  offlineModels: [
    { id: 'en-zh', label: 'English → Chinese', size: '42 MB', installed: false },
    { id: 'zh-en', label: 'Chinese → English', size: '38 MB', installed: false },
    { id: 'ja-en', label: 'Japanese → English', size: '46 MB', installed: false }
  ],
  spellCheck: true,
  spellCheckLanguages: ['en-US', 'zh-TW']
}
