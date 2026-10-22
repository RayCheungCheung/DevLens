import assert from 'node:assert/strict'
import {
  buildSuggestions,
  parseOmnibox,
  rankLocalEntries,
  resolvePrefixBadge,
  shouldArmShortcutSearch
} from '../src/shared/omnibox'
import {
  DEFAULT_OMNIBOX_SETTINGS,
  entryUrl,
  sanitizeOmniboxEntries
} from '../src/shared/omnibox-settings'
import {
  parseJsonBookmarks,
  parseNetscapeBookmarks,
  safeBookmarkUrl
} from '../src/shared/bookmarks-file'
import {
  classifyClipboardText,
  redactSecret,
  redactUrlSecrets
} from '../src/shared/clipboard'
import {
  handlerForMime,
  normalizeContentType,
  safeDownloadFilename,
  sanitizeDownloadPreferences
} from '../src/shared/downloads'
import {
  DEFAULT_HOTKEY_BINDINGS,
  findHotkeyConflict,
  sanitizeHotkeyPreferences
} from '../src/shared/hotkeys'
import {
  MOBILE_DEVICES,
  deviceViewport
} from '../src/shared/config'
import { DEFAULT_MOBILE_SETTINGS as DEFAULT_MOBILE_STATE } from '../src/shared/preferences'
import { privateTabPartition, isPrivateTabPartition } from '../src/shared/private-tab'
import { aiPartition } from '../src/shared/ai-sites'
import { youtubeVideoId } from '../src/shared/youtube'
import {
  internalRouteOf,
  settingsCategoryOf,
  SETTINGS_CATEGORY_IDS
} from '../src/shared/routes'
import {
  classifyAddress,
  isAllowedRemoteAddress,
  isMetadataHostname
} from '../src/shared/network-safety'
import { fetchRemoteResource } from '../src/main/safe-fetch'

async function main(): Promise<void> {
let checks = 0
const pass = (): void => {
  checks += 1
}

let seed = 0x41c6ce57
const random = (): number => {
  seed ^= seed << 13
  seed ^= seed >>> 17
  seed ^= seed << 5
  return (seed >>> 0) / 0x100000000
}
const chars =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 /\\:#?&=%._-<>\"\'\u0000\u001f😀'
const randomText = (max = 160): string =>
  Array.from({ length: Math.floor(random() * max) }, () =>
    chars[Math.floor(random() * chars.length)]
  ).join('')

const safeProtocols = new Set(['http:', 'https:', 'file:', 'devlens:', 'about:', 'blob:', 'data:'])
for (let index = 0; index < 8000; index += 1) {
  const input = randomText(220)
  const action = parseOmnibox(input, DEFAULT_OMNIBOX_SETTINGS.defaultEngine)
  if (action && 'url' in action && action.url) {
    let protocol = ''
    try {
      protocol = new URL(action.url).protocol
    } catch {
      // Relative/internal URLs are valid for parser actions that do not navigate.
    }
    if (protocol) assert.ok(safeProtocols.has(protocol), `unsafe protocol ${protocol}`)
    assert.ok(!/^\s*javascript:/i.test(action.url), 'javascript URL reached an action')
  }
  const suggestions = buildSuggestions({
    query: input,
    history: [],
    sessionUrls: [],
    limit: 8
  })
  assert.ok(Array.isArray(suggestions))
  pass()
}

assert.equal(shouldArmShortcutSearch('#yt'), true)
assert.equal(shouldArmShortcutSearch('#yt '), false)
assert.equal(shouldArmShortcutSearch('#yt cats'), false)
assert.equal(
  entryUrl(DEFAULT_OMNIBOX_SETTINGS.shortcuts.find((entry) => entry.keyword === 'yt')!, 'cats'),
  'https://www.youtube.com/results?search_query=cats'
)
assert.equal(resolvePrefixBadge('#r ', DEFAULT_OMNIBOX_SETTINGS.shortcuts)?.icon, 'custom')
assert.equal(rankLocalEntries({
  query: '<img onerror=alert(1)>',
  history: [],
  bookmarks: [],
  sessionUrls: [],
  now: Date.now(),
  limit: 5
}).length, 0)
pass()

for (let index = 0; index < 4000; index += 1) {
  const text = randomText(300)
  classifyClipboardText(text)
  const redacted = redactUrlSecrets(text)
  assert.equal(typeof redacted.url, 'string')
  pass()
}

assert.equal(classifyClipboardText('AKIAABCDEFGHIJKLMNOP').secret, true)
assert.match(redactSecret('sk-abcdefghijklmnopqrstuvwxyz012345'), /^<redacted:/)
const redactedUrl = redactUrlSecrets(
  'https://example.test/cb?access_token=supersecret&code=abc123&safe=ok'
)
assert.ok(redactedUrl.redacted.includes('access_token'))
assert.ok(!redactedUrl.url.includes('supersecret'))
assert.ok(!redactedUrl.url.includes('abc123'))
pass()

for (let index = 0; index < 4000; index += 1) {
  const name = safeDownloadFilename(randomText(180))
  assert.ok(!/[\\/]/.test(name))
  assert.notEqual(name, '.')
  assert.notEqual(name, '..')
  pass()
}
assert.equal(safeDownloadFilename('../../CON.txt').toLowerCase().startsWith('_con'), true)
assert.equal(normalizeContentType('text/html'), 'text/html')
assert.equal(normalizeContentType('javascript'), null)
assert.ok(
  ['open', 'save', 'ask', 'system'].includes(
    handlerForMime(sanitizeDownloadPreferences({}), 'text/html')
  )
)
pass()

for (let index = 0; index < 1000; index += 1) {
  const html = `<DT><H3>${randomText(40)}</H3><DL><DT><A HREF="${randomText(
    80
  )}">${randomText(80)}</A></DL>`
  const parsed = parseNetscapeBookmarks(html)
  assert.ok(Array.isArray(parsed.nodes))
  pass()
}
const dangerousJson = parseJsonBookmarks(
  JSON.stringify({
    entries: [{ title: '</script><script>alert(1)</script>', url: 'javascript:alert(1)' }]
  })
)
assert.equal(dangerousJson.nodes.length, 0)
assert.equal(safeBookmarkUrl('javascript:alert(1)'), null)
assert.equal(safeBookmarkUrl('data:text/html,<script>alert(1)</script>'), null)
assert.equal(safeBookmarkUrl('https://example.test/page#fragment'), 'https://example.test/page')
assert.doesNotThrow(() =>
  parseNetscapeBookmarks('<DT><A HREF="https://example.test/">bad &#999999999;</A>')
)
pass()

const fuzzedHotkeys = sanitizeHotkeyPreferences({
  bindings: { ...DEFAULT_HOTKEY_BINDINGS, 'new-tab': 'NotARealShortcut+++<script>' }
})
assert.equal(typeof fuzzedHotkeys.bindings['new-tab'], 'string')
assert.equal(findHotkeyConflict(DEFAULT_HOTKEY_BINDINGS, 'new-tab', DEFAULT_HOTKEY_BINDINGS['new-tab']), null)
pass()

for (const device of MOBILE_DEVICES) {
  const viewport = deviceViewport(device)
  assert.ok(viewport.width > 0)
  assert.ok(viewport.height > 0)
  assert.ok(viewport.dpr > 0)
  pass()
}
assert.ok(DEFAULT_MOBILE_STATE.deviceId)

assert.equal(isPrivateTabPartition(privateTabPartition('../../bad id')), true)
assert.ok(aiPartition('../../profile<script>', 'gemini').startsWith('persist:devlens-ai-'))
assert.equal(youtubeVideoId('https://evil.test/watch?v=abcdefghijk'), null)
assert.equal(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
pass()

for (const category of SETTINGS_CATEGORY_IDS) {
  assert.equal(settingsCategoryOf(` DEVLENS:SETTINGS/${category.toUpperCase()}/ `), category)
  assert.equal(internalRouteOf(`devlens:settings/${category}`), 'settings')
  pass()
}
assert.equal(internalRouteOf('javascript:alert(1)'), null)

const maliciousEntries = sanitizeOmniboxEntries(
  Array.from({ length: 1000 }, (_, index) => ({
    id: `<id-${index}>`,
    label: randomText(400),
    keyword: ` ${randomText(20)} `,
    template: `https://example.test/${index}?q=%s`
  })),
  'engine'
)
assert.ok(maliciousEntries.length <= 1000)
assert.ok(maliciousEntries.every((entry) => entry.template.includes('%s')))
pass()

const addressCases: Array<[string, ReturnType<typeof classifyAddress>, boolean]> = [
  ['127.0.0.1', 'loopback', false],
  ['10.1.2.3', 'private', false],
  ['172.31.9.8', 'private', false],
  ['192.168.1.10', 'private', false],
  ['169.254.169.254', 'metadata', false],
  ['100.100.100.200', 'metadata', false],
  ['8.8.8.8', 'public', true],
  ['::1', 'loopback', false],
  ['fd00:ec2::254', 'metadata', false],
  ['fe80::1', 'link-local', false],
  ['2606:4700:4700::1111', 'public', true]
]
for (const [address, expected, allowedAsPublicNetwork] of addressCases) {
  assert.equal(classifyAddress(address), expected, address)
  assert.equal(isAllowedRemoteAddress(address, false), allowedAsPublicNetwork, address)
}
assert.equal(isAllowedRemoteAddress('192.168.1.10', true), true)
assert.equal(isAllowedRemoteAddress('169.254.169.254', true), false)
assert.equal(isMetadataHostname('metadata.google.internal'), true)
assert.equal(isMetadataHostname('metadata.google.internal.evil.test'), false)
pass()

for (let index = 0; index < 1000; index += 1) {
  const octets = Array.from({ length: 4 }, () => Math.floor(random() * 256)).join('.')
  assert.ok(classifyAddress(octets) !== 'invalid')
  pass()
}
await assert.rejects(
  fetchRemoteResource('http://169.254.169.254/latest/meta-data/', {
    maxBytes: 1024,
    timeoutMs: 1000
  }),
  /private or reserved/
)
await assert.rejects(
  fetchRemoteResource('http://user:password@example.test/private', {
    maxBytes: 1024,
    timeoutMs: 1000
  }),
  /Credential-bearing/
)
await assert.rejects(
  fetchRemoteResource('data:text/plain,secret', {
    maxBytes: 1024,
    timeoutMs: 1000
  }),
  /Unsupported link protocol/
)
pass()

console.log(`PASS ${checks} pure stress checks`)
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
