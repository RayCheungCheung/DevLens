/**
 * Clipboard secret classifier.
 *
 * Shared by the main-process sentinel (which watches the OS clipboard) and the renderer's
 * paste guard, so both agree on what counts as sensitive. Deterministic patterns plus an
 * entropy fallback: no network, nothing that changes between runs.
 */
export interface SecretVerdict {
  secret: boolean
  reason: string
}

const PATTERNS: { name: string; test: RegExp }[] = [
  { name: 'JSON Web Token', test: /^ey[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}$/ },
  { name: 'AWS access key id', test: /^(AKIA|ASIA|AGPA|AIDA)[A-Z0-9]{12,}$/ },
  { name: 'GitHub token', test: /^(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})$/ },
  { name: 'Slack token', test: /^xox[baprs]-[A-Za-z0-9-]{10,}$/ },
  { name: 'OpenAI style key', test: /^sk-[A-Za-z0-9_-]{20,}$/ },
  { name: 'Stripe key', test: /^(sk|pk|rk)_(live|test)_[A-Za-z0-9]{16,}$/ },
  { name: 'Google API key', test: /^AIza[0-9A-Za-z_-]{30,}$/ },
  { name: 'private key block', test: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'basic auth header', test: /^basic\s+[A-Za-z0-9+/=]{12,}$/i },
  { name: 'bearer token', test: /^bearer\s+[A-Za-z0-9._\-+/=]{20,}$/i },
  {
    name: 'credential assignment',
    test: /(?:password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*\S{8,}/i
  },
  { name: 'connection string with credentials', test: /^[a-z]+:\/\/[^\s:@]+:[^\s:@]{6,}@/i }
]

export function classifyClipboardText(text: string): SecretVerdict {
  const trimmed = text.trim()
  if (!trimmed) return { secret: false, reason: 'empty' }

  for (const pattern of PATTERNS) {
    if (pattern.test.test(trimmed)) return { secret: true, reason: pattern.name }
  }

  // One long opaque token, e.g. a session id or a hex digest.
  if (trimmed.length >= 24 && !/\s/.test(trimmed) && isHighEntropy(trimmed)) {
    return { secret: true, reason: `high entropy token (${trimmed.length} chars)` }
  }

  return { secret: false, reason: 'no credential pattern matched' }
}

/** Shannon entropy over the token's own alphabet, plus a character-class check. */
function isHighEntropy(value: string): boolean {
  const counts = new Map<string, number>()
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1)

  let entropy = 0
  for (const count of counts.values()) {
    const p = count / value.length
    entropy -= p * Math.log2(p)
  }

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((test) => test.test(value)).length
  return entropy >= 3.5 && classes >= 2
}

/** Replaces a secret with a stable, non-reversible marker for logs and captures. */
export function redactSecret(value: string): string {
  const { secret, reason } = classifyClipboardText(value)
  return secret ? `<redacted: ${reason}, ${value.length} chars>` : value
}

/** Query parameter names whose values should never be captured verbatim. */
const SENSITIVE_PARAMS =
  /^(token|access_token|id_token|api[_-]?key|key|secret|password|passwd|pwd|auth|authorization|session|sessionid|sig|signature|code)$/i

/**
 * Replaces the values of credential-shaped query parameters in a captured URL.
 *
 * Only the capture is rewritten - the request itself is untouched - so the operator still
 * sees which parameter carried a secret without the value reaching the UI, the report or an
 * AI prompt.
 */
export function redactUrlSecrets(url: string): { url: string; redacted: string[] } {
  try {
    const parsed = new URL(url)
    const redacted: string[] = []
    for (const key of [...parsed.searchParams.keys()]) {
      if (!SENSITIVE_PARAMS.test(key)) continue
      const value = parsed.searchParams.get(key) ?? ''
      if (value.length === 0) continue
      parsed.searchParams.set(key, `<redacted: ${value.length} chars>`)
      redacted.push(key)
    }
    return { url: redacted.length > 0 ? parsed.toString() : url, redacted }
  } catch {
    return { url, redacted: [] }
  }
}

/** Header names whose values are treated as credentials. */
export const SENSITIVE_HEADERS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-access-token',
  'x-csrf-token',
  'x-session-token',
  'api-key',
  'private-token'
]
