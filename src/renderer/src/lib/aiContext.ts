import type { ReconSnapshot } from '@shared/recon'
import type { AiContextChip, ConsoleLogEntry, NetworkEntry } from '@shared/types'

interface BuildChipsInput {
  snapshot: ReconSnapshot
  consoleEntries: ConsoleLogEntry[]
  failedRequests: NetworkEntry[]
  css: string
  designMode: boolean
}

const MAX_CHIP_CHARS = 6000

/**
 * Turns the session into prompt attachments.
 *
 * Everything a model needs to reason about the page is summarised here instead of dumping
 * raw captures: digests are ordered worst-first and capped, so a chatty page cannot crowd
 * out the actual problem.
 */
export function buildAiChips(input: BuildChipsInput): AiContextChip[] {
  const chips: AiContextChip[] = []
  const errors = input.consoleEntries.filter((entry) => entry.level === 'error')
  const warnings = input.consoleEntries.filter((entry) => entry.level === 'warn')

  chips.push({
    id: 'console',
    label: `console ${input.consoleEntries.length}`,
    body: clip(
      [
        `Console output captured from the live viewports (${errors.length} error, ${warnings.length} warning):`,
        ...[...errors, ...warnings, ...input.consoleEntries].slice(0, 40).map(formatConsoleLine)
      ].join('\n')
    )
  })

  chips.push({
    id: 'network',
    label: `failed requests ${input.failedRequests.length}`,
    body: clip(
      input.failedRequests.length === 0
        ? 'No failed requests were captured.'
        : [
            'Requests that failed or returned a non-2xx status:',
            ...input.failedRequests.slice(-40).map(
              (entry) =>
                `- [${entry.viewId}] ${entry.method} ${entry.url} -> ${
                  entry.statusCode ?? 'ERROR'
                }${entry.error ? ` (${entry.error})` : ''}${
                  entry.durationMs !== null ? ` in ${entry.durationMs}ms` : ''
                }`
            )
          ].join('\n')
    )
  })

  chips.push({
    id: 'inventory',
    label: `hosts ${input.snapshot.totals.hosts} / endpoints ${input.snapshot.totals.endpoints}`,
    body: clip(
      [
        `Target: ${input.snapshot.targetUrl}`,
        `Requests captured: ${input.snapshot.totals.requests} (blocked by rules: ${input.snapshot.totals.blocked})`,
        '',
        'Hosts:',
        ...input.snapshot.hosts
          .slice(0, 15)
          .map((host) => `- ${host.host} - ${host.requests} request(s), ${host.endpoints} endpoint(s)`),
        '',
        'Endpoints:',
        ...input.snapshot.endpoints.slice(0, 25).map((endpoint) => {
          const params = endpoint.queryKeys.length > 0 ? ` query: ${endpoint.queryKeys.join(',')}` : ''
          return `- ${endpoint.method} ${endpoint.path} (${endpoint.calls} call(s), status ${
            endpoint.statusCodes.join('/') || 'n/a'
          })${params}`
        }),
        '',
        'Assets by type:',
        ...input.snapshot.assets.map((asset) => `- ${asset.resourceType}: ${asset.count}`)
      ].join('\n')
    )
  })

  if (input.snapshot.rules.length > 0) {
    chips.push({
      id: 'rules',
      label: `interceptor rules ${input.snapshot.rules.length}`,
      body: input.snapshot.rules
        .map(
          (rule) =>
            `- ${rule.enabled ? 'enabled' : 'disabled'} ${rule.kind} "${rule.pattern}"${
              rule.header ? ` ${rule.header}${rule.value ? `=${rule.value}` : ''}` : ''
            }${rule.target ? ` -> ${rule.target}` : ''} (${rule.hits} hit(s))`
        )
        .join('\n')
    })
  }

  if (input.css.trim() || input.designMode) {
    const cssBlock = input.css.trim() ? ['```css', input.css.trim(), '```'] : []
    chips.push({
      id: 'design',
      label: input.designMode ? 'design mode + css' : 'css overrides',
      body: clip(
        [
          `Design mode (document.designMode) is ${input.designMode ? 'on' : 'off'}.`,
          input.css.trim() ? 'CSS injected into the live viewports:' : 'No CSS overrides applied.',
          ...cssBlock
        ].join('\n')
      )
    })
  }

  return chips
}

function formatConsoleLine(entry: ConsoleLogEntry): string {
  const source = entry.sourceUrl ? ` (${entry.sourceUrl}:${entry.line})` : ''
  return `- [${entry.viewId}] ${entry.level}: ${entry.message}${source}`
}

function clip(body: string): string {
  return body.length > MAX_CHIP_CHARS
    ? `${body.slice(0, MAX_CHIP_CHARS)}\n... (${body.length - MAX_CHIP_CHARS} characters trimmed)`
    : body
}
