import type { CapturedRequest, ConsoleLogEntry, InterceptorRule, NetworkEntry, ViewportId } from './types'

/** Derived, report-ready view of everything DevLens has observed. */
export interface ReconHost {
  host: string
  requests: number
  documents: number
  endpoints: number
  firstSeen: number
}

export interface ReconEndpoint {
  method: string
  path: string
  host: string
  calls: number
  statusCodes: number[]
  queryKeys: string[]
  hasBody: boolean
  viewIds: ViewportId[]
}

export interface ReconAssetGroup {
  resourceType: string
  count: number
  samplePaths: string[]
}

export interface ReconFinding {
  severity: 'info' | 'low' | 'medium'
  title: string
  detail: string
}

export interface ReconSnapshot {
  generatedAt: number
  targetUrl: string
  viewports: { viewId: ViewportId; width: number; height: number; url: string }[]
  totals: {
    requests: number
    failures: number
    blocked: number
    consoleErrors: number
    consoleWarnings: number
    hosts: number
    endpoints: number
  }
  hosts: ReconHost[]
  endpoints: ReconEndpoint[]
  assets: ReconAssetGroup[]
  failures: { url: string; method: string; status: number | null; error: string | null; viewId: ViewportId | null }[]
  /** Flat log of everything captured, used by the report appendix. */
  requestLog: ReconLogRow[]
  console: { level: string; message: string; sourceUrl: string; line: number; viewId: ViewportId; timestamp: number }[]
  rules: InterceptorRule[]
  design: {
    designMode: boolean
    cssLines: number
    css: string
  }
  findings: ReconFinding[]
}

export interface ReconLogRow {
  startedAt: number
  method: string
  url: string
  statusCode: number | null
  resourceType: string
  viewId: ViewportId | null
  error: string | null
  durationMs: number | null
  blockedByRule: string | null
}

/** Resource types that represent calls into the application rather than static assets. */
const ENDPOINT_TYPES = new Set(['xhr', 'fetch', 'document', 'mainFrame', 'subFrame', 'webSocket'])

export interface BuildSnapshotInput {
  targetUrl: string
  requests: CapturedRequest[]
  consoleEntries: ConsoleLogEntry[]
  failedRequests: NetworkEntry[]
  rules: InterceptorRule[]
  viewports: { viewId: ViewportId; width: number; height: number; url: string }[]
  design: { designMode: boolean; css: string }
}

/** Folds raw captures into the host/endpoint/asset inventory a report needs. */
export function buildReconSnapshot(input: BuildSnapshotInput): ReconSnapshot {
  const hosts = new Map<string, ReconHost>()
  const endpoints = new Map<string, ReconEndpoint>()
  const assets = new Map<string, ReconAssetGroup>()
  const failures: ReconSnapshot['failures'] = []

  for (const request of input.requests) {
    let parsed: URL | null = null
    try {
      parsed = new URL(request.url)
    } catch {
      parsed = null
    }
    const host = parsed?.host ?? request.url
    const path = parsed ? `${parsed.pathname}${parsed.search}` : request.url
    const isEndpoint = ENDPOINT_TYPES.has(request.resourceType)

    const hostEntry = hosts.get(host) ?? {
      host,
      requests: 0,
      documents: 0,
      endpoints: 0,
      firstSeen: request.startedAt
    }
    hostEntry.requests += 1
    hostEntry.firstSeen = Math.min(hostEntry.firstSeen, request.startedAt)
    if (request.resourceType === 'document' || request.resourceType === 'mainFrame') {
      hostEntry.documents += 1
    }
    if (isEndpoint) hostEntry.endpoints += 1
    hosts.set(host, hostEntry)

    if (isEndpoint) {
      const key = `${request.method} ${parsed?.pathname ?? path}`
      const endpoint = endpoints.get(key) ?? {
        method: request.method,
        path: parsed?.pathname ?? path,
        host,
        calls: 0,
        statusCodes: [],
        queryKeys: [],
        hasBody: false,
        viewIds: []
      }
      endpoint.calls += 1
      if (request.statusCode !== null && !endpoint.statusCodes.includes(request.statusCode)) {
        endpoint.statusCodes.push(request.statusCode)
      }
      for (const key2 of parsed?.searchParams.keys() ?? []) {
        if (!endpoint.queryKeys.includes(key2)) endpoint.queryKeys.push(key2)
      }
      endpoint.hasBody = endpoint.hasBody || request.hasBody
      if (request.viewId && !endpoint.viewIds.includes(request.viewId)) endpoint.viewIds.push(request.viewId)
      endpoints.set(key, endpoint)
    }

    const group = assets.get(request.resourceType) ?? {
      resourceType: request.resourceType,
      count: 0,
      samplePaths: []
    }
    group.count += 1
    if (group.samplePaths.length < 8 && path && !group.samplePaths.includes(path)) {
      group.samplePaths.push(path)
    }
    assets.set(request.resourceType, group)

    if (request.error || (request.statusCode !== null && request.statusCode >= 400)) {
      failures.push({
        url: request.url,
        method: request.method,
        status: request.statusCode,
        error: request.error,
        viewId: request.viewId
      })
    }
  }

  const consoleEntries = input.consoleEntries.map((entry) => ({
    level: entry.level,
    message: entry.message,
    sourceUrl: entry.sourceUrl,
    line: entry.line,
    viewId: entry.viewId,
    timestamp: entry.timestamp
  }))

  const snapshot: ReconSnapshot = {
    generatedAt: Date.now(),
    targetUrl: input.targetUrl,
    viewports: input.viewports,
    totals: {
      requests: input.requests.length,
      failures: failures.length,
      blocked: input.requests.filter((request) => request.blockedByRule).length,
      consoleErrors: input.consoleEntries.filter((entry) => entry.level === 'error').length,
      consoleWarnings: input.consoleEntries.filter((entry) => entry.level === 'warn').length,
      hosts: hosts.size,
      endpoints: endpoints.size
    },
    hosts: [...hosts.values()].sort((a, b) => b.requests - a.requests),
    endpoints: [...endpoints.values()].sort((a, b) => b.calls - a.calls),
    assets: [...assets.values()].sort((a, b) => b.count - a.count),
    failures,
    requestLog: input.requests
      .map((request) => ({
        startedAt: request.startedAt,
        method: request.method,
        url: request.url,
        statusCode: request.statusCode,
        resourceType: request.resourceType,
        viewId: request.viewId,
        error: request.error,
        durationMs: request.durationMs,
        blockedByRule: request.blockedByRule
      }))
      .sort((a, b) => a.startedAt - b.startedAt),
    console: consoleEntries,
    rules: input.rules,
    design: {
      designMode: input.design.designMode,
      cssLines: input.design.css ? input.design.css.split('\n').filter((line) => line.trim()).length : 0,
      css: input.design.css
    },
    findings: []
  }

  snapshot.findings = deriveFindings(snapshot, input.failedRequests)
  return snapshot
}

/** Small, deterministic observations. No scoring, no false confidence. */
function deriveFindings(
  snapshot: ReconSnapshot,
  failedRequests: NetworkEntry[]
): ReconFinding[] {
  const findings: ReconFinding[] = []

  if (snapshot.endpoints.length > 0 && snapshot.targetUrl.startsWith('http://')) {
    findings.push({
      severity: 'medium',
      title: 'Target is served over plain HTTP',
      detail: `Content was loaded from ${snapshot.targetUrl} without transport security.`
    })
  }

  const authEndpoints = snapshot.endpoints.filter((endpoint) =>
    /(login|auth|token|session|signin|oauth)/i.test(endpoint.path)
  )
  if (authEndpoints.length > 0) {
    findings.push({
      severity: 'info',
      title: 'Authentication surface discovered',
      detail: authEndpoints
        .map((endpoint) => `${endpoint.method} ${endpoint.path} (${endpoint.calls} call(s))`)
        .join(', ')
    })
  }

  const mutating = snapshot.endpoints.filter((endpoint) =>
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(endpoint.method)
  )
  if (mutating.length > 0) {
    findings.push({
      severity: 'info',
      title: 'State-changing endpoints observed',
      detail: `${mutating.length} endpoint(s) accept write methods and are candidates for manual authorization testing.`
    })
  }

  if (snapshot.totals.consoleErrors > 0) {
    findings.push({
      severity: 'low',
      title: 'Uncaught console errors',
      detail: `${snapshot.totals.consoleErrors} console error(s) were captured; they often expose stack traces or internal paths.`
    })
  }

  const serverErrors = failedRequests.filter((entry) => (entry.statusCode ?? 0) >= 500)
  if (serverErrors.length > 0) {
    findings.push({
      severity: 'low',
      title: 'Server error responses',
      detail: `${serverErrors.length} response(s) returned 5xx, which may leak stack traces: ${serverErrors
        .slice(0, 5)
        .map((entry) => entry.url)
        .join(', ')}`
    })
  }

  const thirdParty = snapshot.hosts.filter((host) => host.host !== hostOf(snapshot.targetUrl))
  if (thirdParty.length > 0) {
    findings.push({
      severity: 'info',
      title: 'Third-party origins contacted',
      detail: `${thirdParty.length} external host(s) received traffic from the page: ${thirdParty
        .slice(0, 8)
        .map((host) => host.host)
        .join(', ')}`
    })
  } else {
    findings.push({
      severity: 'info',
      title: 'Single-origin session',
      detail: 'All captured traffic stayed on the target origin.'
    })
  }

  return findings
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
