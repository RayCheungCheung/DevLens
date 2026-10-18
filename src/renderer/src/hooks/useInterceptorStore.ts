import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CapturedRequest,
  InterceptorRule,
  InterceptorSnapshot,
  PausedRequest,
  RequestEvent,
  ResumeRequestPayload
} from '@shared/types'

const MAX_REQUESTS = 500

export interface InterceptorStore {
  /** Newest first: the interceptor is a triage surface. */
  requests: CapturedRequest[]
  paused: PausedRequest[]
  rules: InterceptorRule[]
  state: InterceptorSnapshot['state']
  ready: boolean
  setEnabled: (enabled: boolean) => void
  setPauseAll: (pauseAll: boolean) => void
  addRule: (rule: Omit<InterceptorRule, 'id' | 'hits'>) => void
  updateRule: (id: string, patch: Partial<InterceptorRule>) => void
  removeRule: (id: string) => void
  toggleRule: (id: string) => void
  resume: (payload: ResumeRequestPayload) => void
  drop: (id: string) => void
  clear: () => void
}

/**
 * Mirrors the main process interceptor: batched request events in, control calls out.
 * Rules always come from the main process snapshot, so hit counters stay truthful while
 * the "new rule" form keeps its own draft state.
 *
 * `enabled` follows the same rule as the log store: in normal mode the renderer only listens
 * while the WImH overlay is open, because that is the only time main is recording at all.
 */
export function useInterceptorStore(enabled = true): InterceptorStore {
  const [requests, setRequests] = useState<CapturedRequest[]>([])
  const [paused, setPaused] = useState<PausedRequest[]>([])
  const [rules, setRules] = useState<InterceptorRule[]>([])
  const [state, setState] = useState<InterceptorSnapshot['state']>({
    enabled: true,
    pauseAll: false,
    pausedCount: 0,
    capturedCount: 0,
    maxPaused: 25,
    pauseTimeoutMs: 20000
  })
  const [ready, setReady] = useState(false)

  const byId = useRef(new Map<string, CapturedRequest>())

  const applySnapshot = useCallback((snapshot: InterceptorSnapshot) => {
    setState(snapshot.state)
    setRules(snapshot.rules)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    void window.devlens.interceptorState().then((snapshot) => {
      if (!cancelled) applySnapshot(snapshot)
    })

    const offEvents = window.devlens.onInterceptorEvents((events: RequestEvent[]) => {
      let listChanged = false

      for (const event of events) {
        if (event.type === 'start' || event.type === 'update') {
          byId.current.set(event.request.id, event.request)
          listChanged = true
        } else if (event.type === 'paused') {
          setPaused((current) => [
            event.paused,
            ...current.filter((item) => item.id !== event.paused.id)
          ])
        } else if (event.type === 'resumed') {
          setPaused((current) => current.filter((item) => item.id !== event.id))
        } else if (event.type === 'rules') {
          setRules(event.rules)
        }
      }

      if (listChanged) {
        const next = [...byId.current.values()].sort((a, b) => b.startedAt - a.startedAt)
        if (next.length > MAX_REQUESTS) {
          for (const dropped of next.slice(MAX_REQUESTS)) byId.current.delete(dropped.id)
        }
        setRequests(next.slice(0, MAX_REQUESTS))
      }
    })

    const offState = window.devlens.onInterceptorState(applySnapshot)

    return () => {
      cancelled = true
      offEvents()
      offState()
    }
  }, [applySnapshot, enabled])

  const setEnabled = useCallback(
    (enabled: boolean) => {
      void window.devlens.interceptorSetEnabled(enabled).then(applySnapshot)
    },
    [applySnapshot]
  )

  const setPauseAll = useCallback(
    (pauseAll: boolean) => {
      void window.devlens.interceptorSetPauseAll(pauseAll).then(applySnapshot)
    },
    [applySnapshot]
  )

  const commitRules = useCallback(
    (next: InterceptorRule[]) => {
      setRules(next)
      void window.devlens.interceptorSetRules(next).then(applySnapshot)
    },
    [applySnapshot]
  )

  const addRule = useCallback(
    (rule: Omit<InterceptorRule, 'id' | 'hits'>) => {
      commitRules([...rules, { ...rule, id: `rule-${Date.now()}`, hits: 0 }])
    },
    [commitRules, rules]
  )

  const updateRule = useCallback(
    (id: string, patch: Partial<InterceptorRule>) => {
      commitRules(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)))
    },
    [commitRules, rules]
  )

  const removeRule = useCallback(
    (id: string) => {
      commitRules(rules.filter((rule) => rule.id !== id))
    },
    [commitRules, rules]
  )

  const toggleRule = useCallback(
    (id: string) => {
      commitRules(rules.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)))
    },
    [commitRules, rules]
  )

  const resume = useCallback((payload: ResumeRequestPayload) => {
    window.devlens.interceptorResume(payload)
  }, [])

  const drop = useCallback((id: string) => {
    window.devlens.interceptorDrop(id)
  }, [])

  const clear = useCallback(() => {
    byId.current.clear()
    setRequests([])
    void window.devlens.interceptorClear().then(applySnapshot)
  }, [applySnapshot])

  return useMemo(
    () => ({
      requests,
      paused,
      rules,
      state,
      ready,
      setEnabled,
      setPauseAll,
      addRule,
      updateRule,
      removeRule,
      toggleRule,
      resume,
      drop,
      clear
    }),
    [
      requests,
      paused,
      rules,
      state,
      ready,
      setEnabled,
      setPauseAll,
      addRule,
      updateRule,
      removeRule,
      toggleRule,
      resume,
      drop,
      clear
    ]
  )
}
