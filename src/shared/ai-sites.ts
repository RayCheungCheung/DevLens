/**
 * The AI sites the assistant panel hosts.
 *
 * Shared rather than renderer-only because the *choice* of provider is a profile preference: the
 * main process stores it, the dock draws its branding, and the panel opens on it. One table, so
 * the label on the dock button and the URL in the embedded guest cannot drift apart.
 */

export type AiSiteId = 'gemini' | 'deepseek' | 'chatgpt' | 'claude'

export interface AiSite {
  id: AiSiteId
  label: string
  url: string
  host: string
  /**
   * Tailwind class for the provider's accent, used to tint its inline mark.
   *
   * The mark itself is drawn in the renderer (`AiMark.tsx`) rather than fetched: a dock icon that
   * needs a CDN is a dock icon that is blank offline, and a stalled request on every remount is a
   * worse trade than drawing four small shapes.
   */
  accent: string
}

export const AI_SITES: readonly AiSite[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    url: 'https://gemini.google.com/',
    host: 'gemini.google.com',
    accent: 'text-sky-300'
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    url: 'https://chat.deepseek.com/',
    host: 'chat.deepseek.com',
    accent: 'text-indigo-300'
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    url: 'https://chatgpt.com/',
    host: 'chatgpt.com',
    accent: 'text-emerald-300'
  },
  {
    id: 'claude',
    label: 'Anthropic Claude',
    url: 'https://claude.ai/',
    host: 'claude.ai',
    accent: 'text-orange-300'
  }
]

export const DEFAULT_AI_SITE: AiSiteId = 'gemini'

export function isAiSiteId(value: unknown): value is AiSiteId {
  return typeof value === 'string' && AI_SITES.some((site) => site.id === value)
}

export function aiSite(id: AiSiteId): AiSite {
  return AI_SITES.find((site) => site.id === id) ?? AI_SITES[0]
}

/**
 * One partition per provider per profile.
 *
 * The provider's own login stays where it belongs - a Gemini session is not a ChatGPT session -
 * and a preference set while using "Work" cannot leak an identity into "Personal".
 */
export function aiPartition(profileId: string, site: AiSiteId): string {
  const profile = (profileId || 'default').replace(/[^a-zA-Z0-9_-]/g, '-')
  return `persist:devlens-ai-${profile}-${site}`
}

