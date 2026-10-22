/**
 * Network-target classification for main-process fetches.
 *
 * A renderer may hand main a URL that came from a page (favicons are the clearest
 * example). Chromium would apply CORS and private-network checks to a page fetch;
 * Node's fetch does not, so the main process has to make the decision explicitly.
 */

export type AddressClass =
  | 'public'
  | 'loopback'
  | 'private'
  | 'link-local'
  | 'metadata'
  | 'reserved'
  | 'invalid'

const METADATA_HOSTS = new Set([
  'metadata',
  'metadata.google.internal',
  'metadata.azure.com',
  'instance-data'
])

/** Strip IPv6 brackets and the trailing root dot used by DNS names. */
export function normalizeNetworkHost(value: string): string {
  return value.trim().toLowerCase().replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '')
}

export function isMetadataHostname(value: string): boolean {
  const host = normalizeNetworkHost(value)
  return METADATA_HOSTS.has(host)
}

export function isLoopbackHostname(value: string): boolean {
  const host = normalizeNetworkHost(value)
  return host === 'localhost' || host.endsWith('.localhost') || classifyAddress(host) === 'loopback'
}

/** Host literals that can only be reached on this machine or a directly attached network. */
export function isLocalHostLiteral(value: string): boolean {
  const kind = classifyAddress(value)
  return kind === 'loopback' || kind === 'private' || kind === 'link-local'
}

/**
 * Classify an IP literal. Hostnames return `invalid`; DNS resolution belongs to the
 * caller because the pure shared module has no I/O.
 */
export function classifyAddress(value: string): AddressClass {
  const address = normalizeNetworkHost(value)
  if (!address) return 'invalid'

  if (isMetadataHostname(address)) return 'metadata'
  if (address === 'localhost' || address.endsWith('.localhost')) return 'loopback'

  if (address.includes(':')) return classifyIpv6(address)
  return classifyIpv4(address)
}

function classifyIpv4(value: string): AddressClass {
  const parts = value.split('.')
  if (parts.length !== 4) return 'invalid'
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : -1))
  if (octets.some((part) => part < 0 || part > 255)) return 'invalid'
  const [a, b, c] = octets

  // Alibaba Cloud's metadata service sits inside the carrier-grade NAT range.
  if (value === '100.100.100.200') return 'metadata'
  if (a === 0) return 'reserved'
  if (a === 10) return 'private'
  if (a === 100 && b >= 64 && b <= 127) return 'private'
  if (a === 127) return 'loopback'
  if (a === 169 && b === 254) return 'metadata'
  if (a === 172 && b >= 16 && b <= 31) return 'private'
  if (a === 192 && b === 0 && c === 0) return 'reserved'
  if (a === 192 && b === 0 && c === 2) return 'reserved'
  if (a === 192 && b === 168) return 'private'
  if (a === 198 && (b === 18 || b === 19)) return 'reserved'
  if (a === 198 && b === 51 && c === 100) return 'reserved'
  if (a === 203 && b === 0 && c === 113) return 'reserved'
  if (a >= 224) return 'reserved'
  return 'public'
}

function classifyIpv6(value: string): AddressClass {
  const address = value.split('%')[0] ?? value
  if (address === '::' || address === '0:0:0:0:0:0:0:0') return 'reserved'
  if (address === '::1' || address === '0:0:0:0:0:0:0:1') return 'loopback'
  if (/^fd00:ec2::254$/i.test(address)) return 'metadata'

  // IPv4-mapped IPv6 is still the underlying IPv4 target.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address)
  if (mapped?.[1]) return classifyIpv4(mapped[1])

  const firstGroup = (address.split(':').find((part) => part.length > 0) ?? '').padStart(4, '0')
  const firstByte = Number.parseInt(firstGroup.slice(0, 2), 16)
  if (!Number.isFinite(firstByte)) return 'invalid'
  if (firstByte === 0xfe && /^fe[89ab]/i.test(firstGroup)) return 'link-local'
  if (firstByte === 0xfc || firstByte === 0xfd) return 'private'
  if (firstByte === 0xff) return 'reserved'
  if (/^2001:0?db8:/i.test(address)) return 'reserved'
  return 'public'
}

/**
 * Whether one resolved target may be fetched for a main-process resource.
 *
 * Metadata endpoints are never allowed, even when the caller opted into private
 * networking: a developer browser may legitimately read a local image, but it must not
 * turn a page-controlled icon into a cloud credential request.
 */
export function isAllowedRemoteAddress(
  address: string,
  allowPrivateNetwork = false
): boolean {
  const kind = classifyAddress(address)
  if (kind === 'metadata' || kind === 'reserved' || kind === 'invalid') return false
  if (kind === 'public') return true
  return allowPrivateNetwork && (kind === 'loopback' || kind === 'private' || kind === 'link-local')
}

