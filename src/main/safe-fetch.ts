import { lookup } from 'node:dns/promises'
import {
  classifyAddress,
  isAllowedRemoteAddress,
  isMetadataHostname,
  normalizeNetworkHost
} from '../shared/network-safety'

const MAX_REDIRECTS = 5

export interface SafeFetchOptions {
  accept?: string
  allowPrivateNetwork?: boolean
  headers?: Record<string, string>
  maxBytes: number
  timeoutMs: number
  userAgent?: string
}

export interface SafeFetchResult {
  bytes: Buffer
  finalUrl: string
  mime: string
}

/**
 * Fetch one HTTP(S) resource with the browser-like checks Node fetch lacks.
 *
 * Redirects are followed manually so every new target is checked, and the body is read
 * with a byte ceiling rather than buffered first and rejected afterwards.
 */
export async function fetchRemoteResource(
  input: string,
  options: SafeFetchOptions
): Promise<SafeFetchResult> {
  let current = parseHttpUrl(input)

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertNetworkTarget(current, options.allowPrivateNetwork === true)
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs),
      headers: {
        ...(options.accept ? { accept: options.accept } : {}),
        ...(options.userAgent ? { 'user-agent': options.userAgent } : {}),
        ...options.headers
      }
    })

    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
      if (redirect === MAX_REDIRECTS) {
        throw new Error('The resource redirected too many times.')
      }
      current = parseHttpUrl(new URL(response.headers.get('location') ?? '', current).toString())
      continue
    }
    if (!response.ok) throw new Error(`The server returned ${response.status}.`)

    const bytes = await readLimitedBody(response, options.maxBytes)
    return {
      bytes,
      finalUrl: current.toString(),
      mime: normalizeMime(response.headers.get('content-type') ?? '')
    }
  }

  throw new Error('The resource redirected too many times.')
}

function parseHttpUrl(value: string): URL {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('The resource URL is malformed.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported link protocol: ${parsed.protocol}`)
  }
  if (parsed.username || parsed.password) {
    throw new Error('Credential-bearing resource URLs are not allowed.')
  }
  return parsed
}

async function assertNetworkTarget(url: URL, allowPrivateNetwork: boolean): Promise<void> {
  const host = normalizeNetworkHost(url.hostname)
  if (!host || isMetadataHostname(host)) {
    throw new Error('The resource target is not allowed.')
  }

  const literal = classifyAddress(host)
  if (literal !== 'invalid') {
    if (!isAllowedRemoteAddress(host, allowPrivateNetwork)) {
      throw new Error('The resource points to a private or reserved network address.')
    }
    return
  }

  let addresses: { address: string }[]
  try {
    addresses = await lookup(host, { all: true, verbatim: true })
  } catch {
    throw new Error('The resource host could not be resolved.')
  }
  if (addresses.length === 0) throw new Error('The resource host had no network address.')
  if (addresses.some((entry) => !isAllowedRemoteAddress(entry.address, allowPrivateNetwork))) {
    throw new Error('The resource resolves to a private or reserved network address.')
  }
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<Buffer> {
  const headerLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(headerLength) && headerLength > maxBytes) {
    await response.body?.cancel().catch(() => undefined)
    throw new Error(`The resource is larger than ${formatLimit(maxBytes)}.`)
  }

  const reader = response.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw new Error(`The resource is larger than ${formatLimit(maxBytes)}.`)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total)
}

function normalizeMime(value: string): string {
  const mime = value.split(';', 1)[0]?.trim().toLowerCase() ?? ''
  return /^[a-z0-9!#$&^_.+*-]+\/[a-z0-9!#$&^_.+*-]+$/.test(mime)
    ? mime
    : 'application/octet-stream'
}

function formatLimit(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
    : `${Math.round(bytes / 1024)} KB`
}

