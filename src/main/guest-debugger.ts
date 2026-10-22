import { webContents, type WebContents } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  GuestDebuggerEvent,
  GuestDebuggerRequest,
  GuestDebuggerResult
} from '../shared/types'
import { knownGuests } from './guests'
import { isMonitoringEnabled } from './mode'

type Emit = (channel: string, payload: unknown) => void

interface DebuggerSession {
  contents: WebContents
  onMessage: (
    event: Electron.Event,
    method: string,
    params: Record<string, unknown>,
    sessionId: string
  ) => void
  onDetach: (event: Electron.Event, reason: string) => void
}

const sessions = new Map<number, DebuggerSession>()
const ALLOWED_METHOD = /^(DOM|CSS|Runtime|Network|Storage|Page|Overlay|Log|Security|Emulation)\./
const EVENT_BATCH_MS = 40
const EVENT_BATCH_LIMIT = 80
let eventQueue: GuestDebuggerEvent[] = []
let eventTimer: NodeJS.Timeout | null = null
let emit: Emit = () => {}

export function configureGuestDebugger(emitter: Emit): void {
  emit = emitter
}

function queueEvent(event: GuestDebuggerEvent): void {
  eventQueue.push(event)
  if (eventQueue.length >= EVENT_BATCH_LIMIT) {
    flushEvents()
    return
  }
  if (eventTimer) return
  eventTimer = setTimeout(flushEvents, EVENT_BATCH_MS)
  eventTimer.unref()
}

function flushEvents(): void {
  if (eventTimer) {
    clearTimeout(eventTimer)
    eventTimer = null
  }
  if (eventQueue.length === 0) return
  const batch = eventQueue
  eventQueue = []
  emit(IPC.guestDebuggerEvent, batch)
}

function teardown(guestId: number, detach: boolean): void {
  const session = sessions.get(guestId)
  if (!session) return
  sessions.delete(guestId)
  const { contents } = session
  if (contents.isDestroyed()) return
  contents.debugger.removeListener('message', session.onMessage)
  contents.debugger.removeListener('detach', session.onDetach)
  if (detach && contents.debugger.isAttached()) {
    try {
      contents.debugger.detach()
    } catch {
      /* The target may have navigated away or already detached. */
    }
  }
}

function attach(guestId: number): DebuggerSession {
  const existing = sessions.get(guestId)
  if (existing && !existing.contents.isDestroyed()) return existing

  if (!knownGuests().has(guestId)) throw new Error('This page is not a registered DevLens guest.')
  if (!isMonitoringEnabled()) throw new Error('Embedded DevTools are available in dev mode.')

  const contents = webContents.fromId(guestId)
  if (!contents || contents.isDestroyed()) throw new Error('The inspected page is no longer open.')
  if (contents.debugger.isAttached()) {
    throw new Error('Another debugger is already attached. Close the external DevTools window first.')
  }

  contents.debugger.attach('1.3')
  const onMessage: DebuggerSession['onMessage'] = (_event, method, params) => {
    const event: GuestDebuggerEvent = {
      guestId,
      method,
      params:
        params && typeof params === 'object'
          ? (params as Record<string, unknown>)
          : {}
    }
    queueEvent(event)
  }

  const onDetach: DebuggerSession['onDetach'] = (_event, reason) => {
    sessions.delete(guestId)
    contents.debugger.removeListener('message', onMessage)
    contents.debugger.removeListener('detach', onDetach)
    queueEvent({
      guestId,
      method: 'Debugger.detached',
      params: { reason }
    } satisfies GuestDebuggerEvent)
  }

  const session: DebuggerSession = { contents, onMessage, onDetach }
  sessions.set(guestId, session)
  contents.debugger.on('message', onMessage)
  contents.debugger.on('detach', onDetach)

  contents.once('destroyed', () => teardown(guestId, false))
  return session
}

export async function sendGuestDebuggerCommand(
  request: GuestDebuggerRequest
): Promise<GuestDebuggerResult> {
  const guestId = Math.trunc(Number(request?.webContentsId))
  const method = String(request?.method ?? '').trim()
  if (!Number.isFinite(guestId) || guestId <= 0) {
    return { ok: false, result: null, error: 'A valid guest id is required.' }
  }
  if (!ALLOWED_METHOD.test(method)) {
    return { ok: false, result: null, error: `CDP domain is not allowed: ${method || '(empty)'}` }
  }

  try {
    const session = attach(guestId)
    const result = await session.contents.debugger.sendCommand(
      method,
      request.params && typeof request.params === 'object' ? request.params : {}
    )
    return { ok: true, result: result ?? {}, error: null }
  } catch (error) {
    return {
      ok: false,
      result: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export function detachGuestDebugger(guestId: number): boolean {
  const id = Math.trunc(Number(guestId))
  if (!Number.isFinite(id) || id <= 0) return false
  const existed = sessions.has(id)
  teardown(id, true)
  return existed
}
