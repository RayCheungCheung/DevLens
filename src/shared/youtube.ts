/**
 * YouTube watch-page helpers: detection, video-id extraction and the picture-in-picture
 * commands the shell evaluates inside the guest.
 *
 * The PiP commands live here as strings, in the same shape as every other page script in
 * this codebase: the frame's `evaluate` handle only accepts a script string, so the caller
 * cannot smuggle a closure into the guest. They run with a user gesture, which is what lets
 * the shell - not the operator - lift the video into the PiP window on a tab switch.
 */

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be'
])

/** The id never leaks past its length. */
const VIDEO_ID_MAX = 11

export function youtubeVideoId(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (!YOUTUBE_HOSTS.has(parsed.host.toLowerCase())) return null

  if (parsed.host.endsWith('youtu.be')) {
    const id = parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? ''
    return id.slice(0, VIDEO_ID_MAX) || null
  }

  const fromQuery = parsed.searchParams.get('v')
  if (fromQuery) return fromQuery.slice(0, VIDEO_ID_MAX) || null

  const match = parsed.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,15})/)
  return match ? match[1] : null
}

/** True when the URL carries a video id the shell can lift into a PiP window. */
export function isYouTubeWatchUrl(url: string): boolean {
  return youtubeVideoId(url) !== null
}

/**
 * Enter PiP for the page's main video.
 *
 * A paused or ended video refuses PiP (and would not be worth lifting), so the command is
 * skipped rather than forced. A request that cannot be made - no PiP support, no video -
 * answers honestly instead of throwing. Idempotent: a tab already in PiP is left alone.
 */
export const YOUTUBE_PIP_ON_SCRIPT = `(async () => {
  const video = document.querySelector('video')
  if (!video || !video.requestPictureInPicture) return 'unavailable'
  if (document.pictureInPictureElement === video) return 'active'
  if (video.paused || video.ended) return 'skipped'
  try {
    const result = video.requestPictureInPicture()
    if (result && result.then) return result.then(() => 'active', () => 'failed')
    return 'active'
  } catch {
    return 'failed'
  }
})()`

/** Put the video back in the page: the opposite of the leaving switch. */
export const YOUTUBE_PIP_OFF_SCRIPT = `(async () => {
  const element = document.pictureInPictureElement
  if (!element) return 'inactive'
  try {
    const result = document.exitPictureInPicture()
    if (result && result.then) return result.then(() => 'inactive', () => 'failed')
    return 'inactive'
  } catch {
    return 'failed'
  }
})()`
