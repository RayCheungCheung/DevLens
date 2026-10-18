import { AI_PROVIDER_DEFAULTS, type ResolvedAiConfig } from '../shared/config'
import type { AiAskRequest, AiAskResult, AiProviderInfo, AiStreamEvent } from '../shared/types'

type Emit = (event: AiStreamEvent) => void

/** Reasoning modes only change the budget; providers get one consistent prompt shape. */
const MODE_BUDGET: Record<AiAskRequest['mode'], number> = {
  Fast: 400,
  Balanced: 900,
  Deep: 1800
}

const SYSTEM_PROMPT = [
  'You are the DevLens debugger, embedded in a browser used for web development and security review.',
  'You receive page context captured from one or two live viewports: console output, failed requests,',
  'an asset inventory and any CSS overrides the operator applied.',
  'Answer with concise markdown: a short diagnosis, the evidence you used, then concrete next steps.',
  'Never invent requests, hosts, values or line numbers that are not present in the context.',
  'When the evidence is insufficient, say exactly which capture you would need.'
].join(' ')

const active = new Map<string, AbortController>()

export function describeProvider(config: ResolvedAiConfig): AiProviderInfo {
  const needsKey = config.provider === 'openai'
  const configured = !needsKey || Boolean(config.apiKey)
  const detail = configured
    ? `${config.provider} - ${config.model}${config.baseUrl ? ` @ ${config.baseUrl}` : ' (local)'}`
    : `${config.provider} needs ${config.apiKeyEnv} in the environment`

  return {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    configured,
    detail
  }
}

/**
 * Starts a completion. The promise resolves as soon as the stream is registered, so the
 * renderer can follow the tokens through the `aiStream` channel while this runs on.
 */
export function ask(request: AiAskRequest, config: ResolvedAiConfig, emit: Emit): AiAskResult {
  const streamId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const controller = new AbortController()
  active.set(streamId, controller)

  const model = config.model || AI_PROVIDER_DEFAULTS[config.provider].model
  const budget = MODE_BUDGET[request.mode]

  void runCompletion({ streamId, request, config, model, budget, emit, signal: controller.signal })
    .catch((error: unknown) => {
      // runCompletion reports its own failures; this is only a last-resort net.
      emit({ streamId, type: 'error', error: describeError(error) })
    })
    .finally(() => active.delete(streamId))

  return { streamId, provider: config.provider, model }
}

export function abort(streamId: string): boolean {
  const controller = active.get(streamId)
  if (!controller) return false
  controller.abort()
  active.delete(streamId)
  return true
}

interface RunInput {
  streamId: string
  request: AiAskRequest
  config: ResolvedAiConfig
  model: string
  budget: number
  emit: Emit
  signal: AbortSignal
}

async function runCompletion(input: RunInput): Promise<void> {
  const { streamId, config, emit, signal } = input
  emit({ streamId, type: 'start', provider: config.provider, model: input.model })

  try {
    if (config.provider === 'mock') {
      await streamMock(input)
    } else if (config.provider === 'ollama') {
      await streamOllama(input)
    } else {
      await streamOpenAiCompatible(input)
    }
    emit({ streamId, type: 'done', provider: config.provider, model: input.model })
  } catch (error) {
    if (signal.aborted) {
      emit({ streamId, type: 'done', text: '\n\n_(stopped)_' })
      return
    }
    emit({ streamId, type: 'error', error: describeError(error) })
  }
}

/* ------------------------------------------------------------------ *
 * Mock provider: no network, deterministic, still useful for the demo.
 * ------------------------------------------------------------------ */

async function streamMock(input: RunInput): Promise<void> {
  const answer = buildMockAnswer(input.request)
  // Stream in small pieces so the transcript behaves exactly like a remote provider.
  for (const piece of answer.match(/[\s\S]{1,24}/g) ?? []) {
    if (input.signal.aborted) return
    input.emit({ streamId: input.streamId, type: 'delta', text: piece })
    await delay(8)
  }
}

function buildMockAnswer(request: AiAskRequest): string {
  const lines: string[] = []
  lines.push(`## Mock analysis (${request.mode} reasoning)`)
  lines.push('')
  lines.push(`**Asked:** ${request.prompt}`)
  lines.push('')
  lines.push(`**Active viewport:** \`${request.viewport}\``)
  lines.push('')

  if (request.chips.length === 0) {
    lines.push('No context was attached, so there is nothing to correlate yet.')
  } else {
    lines.push('**Attached evidence**')
    lines.push('')
    for (const chip of request.chips) {
      lines.push(`- **${chip.label}** - ${summarise(chip.body)}`)
    }
  }

  lines.push('')
  lines.push('**What I would check next**')
  lines.push('')
  lines.push('- Reproduce the failure with one viewport active so the log stream is unambiguous.')
  lines.push('- Compare the failing request against its successful neighbours: status, headers and payload size.')
  lines.push('- Hold the request in the Interceptor, edit the suspected header, then resume it to confirm the cause.')
  lines.push('- Replay the exact payload from the Repeater to separate a client bug from a server bug.')
  lines.push('')
  lines.push(
    '> This is the offline mock provider. Set `ai.provider` to `ollama` or `openai` in `devlens.config.json` (or set `DEVLENS_AI_BASE_URL`) to send this prompt, with the same attached context, to a real model.'
  )
  lines.push('')
  return lines.join('\n')
}

function summarise(body: string): string {
  const lines = body.split('\n').filter((line) => line.trim())
  const first = lines[0]?.replace(/^[-*]\s*/, '').slice(0, 160) ?? 'empty'
  return lines.length > 1 ? `${first} (+${lines.length - 1} more line(s))` : first
}

/* ------------------------------------------------------------------ *
 * OpenAI compatible provider (OpenAI, LM Studio, llama.cpp server, vLLM ...)
 * ------------------------------------------------------------------ */

async function streamOpenAiCompatible(input: RunInput): Promise<void> {
  const baseUrl = input.config.baseUrl ?? AI_PROVIDER_DEFAULTS.openai.baseUrl
  if (!baseUrl) throw new Error('No base URL configured for the openai provider.')
  if (!input.config.apiKey) {
    throw new Error(
      `No API key found. Export ${input.config.apiKeyEnv} or set DEVLENS_AI_API_KEY before starting DevLens.`
    )
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${input.config.apiKey}`
    },
    body: JSON.stringify({
      model: input.model,
      stream: true,
      temperature: input.config.temperature,
      max_tokens: input.budget,
      messages: buildMessages(input.request)
    }),
    signal: input.signal
  })

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} - ${(await response.text()).slice(0, 400)}`)
  }
  if (!response.body) throw new Error('The provider returned an empty response body.')

  for await (const line of readLines(response.body)) {
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (payload === '[DONE]') break
    try {
      const parsed = JSON.parse(payload) as {
        choices?: { delta?: { content?: string } }[]
      }
      const text = parsed.choices?.[0]?.delta?.content
      if (text) input.emit({ streamId: input.streamId, type: 'delta', text })
    } catch {
      // A partial or non-JSON keepalive line: ignore it and keep reading.
    }
  }
}

/* ------------------------------------------------------------------ *
 * Ollama (local models)
 * ------------------------------------------------------------------ */

async function streamOllama(input: RunInput): Promise<void> {
  const baseUrl = input.config.baseUrl ?? AI_PROVIDER_DEFAULTS.ollama.baseUrl
  if (!baseUrl) throw new Error('No base URL configured for the ollama provider.')

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: input.model,
      stream: true,
      messages: buildMessages(input.request),
      options: { temperature: input.config.temperature, num_predict: input.budget }
    }),
    signal: input.signal
  })

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} - ${(await response.text()).slice(0, 400)}`)
  }
  if (!response.body) throw new Error('The provider returned an empty response body.')

  for await (const line of readLines(response.body)) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean; error?: string }
      if (parsed.error) throw new Error(parsed.error)
      const text = parsed.message?.content
      if (text) input.emit({ streamId: input.streamId, type: 'delta', text })
      if (parsed.done) break
    } catch (error) {
      if (error instanceof Error && !/JSON/.test(error.message)) throw error
    }
  }
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function buildMessages(request: AiAskRequest): { role: 'system' | 'user'; content: string }[] {
  const context = request.chips
    .map((chip) => `### ${chip.label}\n${clip(chip.body, 8000)}`)
    .join('\n\n')

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        'Captured page context:',
        '',
        context || '(no context attached)',
        '',
        `Active viewport: ${request.viewport}`,
        '',
        `Task: ${request.prompt}`
      ].join('\n')
    }
  ]
}

/** Incremental UTF-8 line reader for SSE and NDJSON streams. */
async function* readLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let index = buffer.indexOf('\n')
      while (index >= 0) {
        yield buffer.slice(0, index).replace(/\r$/, '')
        buffer = buffer.slice(index + 1)
        index = buffer.indexOf('\n')
      }
    }
    if (buffer.trim()) yield buffer
  } finally {
    reader.releaseLock()
  }
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}\n... (${value.length - max} characters trimmed)` : value
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.cause ? `${error.message} (${String(error.cause)})` : error.message
  }
  return String(error)
}
