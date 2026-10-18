import type { ReconSnapshot } from './recon'

export interface ReportOptions {
  includeSummary: boolean
  includeHosts: boolean
  includeEndpoints: boolean
  includeAssets: boolean
  includeFailures: boolean
  includeConsole: boolean
  includeRequests: boolean
  includeDesign: boolean
  includeRules: boolean
}

export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  includeSummary: true,
  includeHosts: true,
  includeEndpoints: true,
  includeAssets: true,
  includeFailures: true,
  includeConsole: true,
  includeRequests: true,
  includeDesign: true,
  includeRules: true
}

/** Markdown report, ordered so the most useful sections come first. */
export function renderMarkdown(snapshot: ReconSnapshot, options: ReportOptions): string {
  const lines: string[] = []
  const stamp = new Date(snapshot.generatedAt).toISOString()

  lines.push('# DevLens recon report')
  lines.push('')
  lines.push(`- Target: \`${snapshot.targetUrl}\``)
  lines.push(`- Generated: ${stamp}`)
  lines.push('- Tool: DevLens developer browser (dual-viewport capture)')
  lines.push('')

  if (options.includeSummary) {
    lines.push('## Summary')
    lines.push('')
    lines.push('| Metric | Value |')
    lines.push('| --- | --- |')
    lines.push(`| Requests captured | ${snapshot.totals.requests} |`)
    lines.push(`| Distinct hosts | ${snapshot.totals.hosts} |`)
    lines.push(`| Endpoints (xhr/fetch/document) | ${snapshot.totals.endpoints} |`)
    lines.push(`| Failed requests | ${snapshot.totals.failures} |`)
    lines.push(`| Requests blocked by rules | ${snapshot.totals.blocked} |`)
    lines.push(`| Console errors | ${snapshot.totals.consoleErrors} |`)
    lines.push(`| Console warnings | ${snapshot.totals.consoleWarnings} |`)
    lines.push('')
    lines.push('### Viewports')
    lines.push('')
    for (const viewport of snapshot.viewports) {
      lines.push(`- \`${viewport.viewId}\` ${viewport.width}x${viewport.height} - ${viewport.url || 'no page'}`)
    }
    lines.push('')
    if (snapshot.findings.length > 0) {
      lines.push('### Observations')
      lines.push('')
      for (const finding of snapshot.findings) {
        lines.push(`- **${finding.title}** (${finding.severity}) - ${finding.detail}`)
      }
      lines.push('')
    }
  }

  if (options.includeHosts && snapshot.hosts.length > 0) {
    lines.push('## Hosts')
    lines.push('')
    lines.push('| Host | Requests | Documents | Endpoints | First seen |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const host of snapshot.hosts) {
      lines.push(
        `| \`${host.host}\` | ${host.requests} | ${host.documents} | ${host.endpoints} | ${new Date(
          host.firstSeen
        ).toISOString()} |`
      )
    }
    lines.push('')
  }

  if (options.includeEndpoints && snapshot.endpoints.length > 0) {
    lines.push('## Endpoints')
    lines.push('')
    lines.push('Query parameter names are listed because they are the usual injection points.')
    lines.push('')
    for (const endpoint of snapshot.endpoints) {
      const params = endpoint.queryKeys.length > 0 ? endpoint.queryKeys.join(', ') : 'none'
      lines.push(`### \`${endpoint.method} ${endpoint.path}\``)
      lines.push('')
      lines.push(`- Host: \`${endpoint.host}\``)
      lines.push(`- Calls: ${endpoint.calls}`)
      lines.push(`- Status codes: ${endpoint.statusCodes.length > 0 ? endpoint.statusCodes.join(', ') : 'n/a'}`)
      lines.push(`- Query parameters: ${params}`)
      lines.push(`- Request body observed: ${endpoint.hasBody ? 'yes' : 'no'}`)
      lines.push(`- Seen in viewports: ${endpoint.viewIds.join(', ') || 'n/a'}`)
      lines.push('')
    }
  }

  if (options.includeAssets && snapshot.assets.length > 0) {
    lines.push('## Assets by type')
    lines.push('')
    for (const asset of snapshot.assets) {
      lines.push(`- **${asset.resourceType}** - ${asset.count}`)
      for (const sample of asset.samplePaths) lines.push(`  - \`${sample}\``)
    }
    lines.push('')
  }

  if (options.includeFailures && snapshot.failures.length > 0) {
    lines.push('## Failed requests')
    lines.push('')
    lines.push('| Method | Status | Viewport | URL | Error |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const failure of snapshot.failures) {
      lines.push(
        `| ${failure.method} | ${failure.status ?? 'ERR'} | ${failure.viewId ?? 'n/a'} | \`${failure.url}\` | ${
          failure.error ?? ''
        } |`
      )
    }
    lines.push('')
  }

  if (options.includeConsole && snapshot.console.length > 0) {
    lines.push('## Console output')
    lines.push('')
    for (const entry of snapshot.console) {
      const source = entry.sourceUrl ? ` (${entry.sourceUrl}:${entry.line})` : ''
      lines.push(`- \`${entry.level}\` [${entry.viewId}] ${entry.message}${source}`)
    }
    lines.push('')
  }

  if (options.includeRules && snapshot.rules.length > 0) {
    lines.push('## Interceptor rules')
    lines.push('')
    for (const rule of snapshot.rules) {
      const extra = [rule.header, rule.value, rule.target].filter(Boolean).join(' -> ')
      lines.push(
        `- \`${rule.kind}\` ${rule.enabled ? '' : '(disabled) '}\`${rule.pattern}\` ${
          extra ? `- ${extra}` : ''
        } - ${rule.hits} hit(s)`
      )
    }
    lines.push('')
  }

  if (options.includeDesign) {
    lines.push('## Live design session')
    lines.push('')
    lines.push(`- Design mode: ${snapshot.design.designMode ? 'enabled' : 'disabled'}`)
    lines.push(`- CSS override lines: ${snapshot.design.cssLines}`)
    if (snapshot.design.css.trim()) {
      lines.push('')
      lines.push('```css')
      lines.push(snapshot.design.css.trim())
      lines.push('```')
    }
    lines.push('')
  }

  if (options.includeRequests && snapshot.endpoints.length >= 0) {
    lines.push('## Captured request log')
    lines.push('')
    lines.push('| Time | Method | Status | Type | Viewport | URL |')
    lines.push('| --- | --- | --- | --- | --- | --- |')
    for (const request of snapshot.requestLog) {
      lines.push(
        `| ${new Date(request.startedAt).toISOString()} | ${request.method} | ${
          request.statusCode ?? (request.error ? 'ERR' : '-')
        } | ${request.resourceType} | ${request.viewId ?? 'n/a'} | \`${request.url}\` |`
      )
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push(
    'Captured with DevLens. Only test systems you are authorized to assess; the request log may contain credentials and session identifiers.'
  )
  lines.push('')

  return lines.join('\n')
}

export function renderJson(snapshot: ReconSnapshot, options: ReportOptions): string {
  const filtered: Record<string, unknown> = {
    generatedAt: new Date(snapshot.generatedAt).toISOString(),
    target: snapshot.targetUrl,
    tool: 'DevLens'
  }

  if (options.includeSummary) {
    filtered.totals = snapshot.totals
    filtered.viewports = snapshot.viewports
    filtered.findings = snapshot.findings
  }
  if (options.includeHosts) filtered.hosts = snapshot.hosts
  if (options.includeEndpoints) filtered.endpoints = snapshot.endpoints
  if (options.includeAssets) filtered.assets = snapshot.assets
  if (options.includeFailures) filtered.failures = snapshot.failures
  if (options.includeConsole) filtered.console = snapshot.console
  if (options.includeRules) filtered.rules = snapshot.rules
  if (options.includeDesign) filtered.design = snapshot.design
  if (options.includeRequests) filtered.requestLog = snapshot.requestLog

  return `${JSON.stringify(filtered, null, 2)}\n`
}
