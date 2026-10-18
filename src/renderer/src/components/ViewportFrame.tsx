import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react'
import { IPC } from '@shared/ipc'
import type { ScrollSyncMessage, ViewportId, ViewportPhase } from '@shared/types'
import type { FindResult } from '@shared/types'
import type { PageContextMenuPayload } from '@shared/types'
import type {
  DevLensWebviewElement,
  GuestFailLoadEvent,
  GuestIpcMessageEvent,
  GuestNavigateEvent
} from '@renderer/types/webview-element'
import { IconButton } from '@renderer/components/IconButton'

export interface ViewportStatus {
  phase: ViewportPhase
  isLoading: boolean
  url: string
  title: string
  error: string | null
  canGoBack: boolean
  canGoForward: boolean
}

export interface ViewportHandle {
  loadUrl: (url: string) => void
  reload: () => void
  goBack: () => void
  goForward: () => void
  /** Push a scroll ratio coming from the twin viewport into this guest. */
  applyScroll: (ratio: number) => void
  /** Live CSS override for this guest. Empty string clears it. */
  applyCss: (css: string) => Promise<{ ok: boolean; error: string | null }>
  /** Live design mode (document.designMode) for this guest. */
  setDesignMode: (enabled: boolean) => void
  /** `& <selector>`: highlight matches in this guest, or clear with an empty selector. */
  find: (selector: string) => void
  /** Silence this guest, or let it speak again. */
  setAudioMuted: (muted: boolean) => void
  /** This guest's `webContents` id, for commands main has to run *in* the page. */
  guestId: () => number | null
  /**
   * Run a script in the page's own context and resolve with its answer.
   *
   * Used by the cookie & storage inspector, which has to read `localStorage` where it actually
   * lives - the guest document - rather than through the shell. The script is a string so callers
   * cannot smuggle a captured closure into the guest.
   */
  evaluate: (script: string) => Promise<unknown>
  openGuestDevTools: () => void
}

interface ViewportFrameProps {
  viewId: ViewportId
  title: string
  initialUrl: string
  guestPreloadUrl: string
  partition: string
  /**
   * Requested guest viewport size in CSS pixels. A `null` height means "fill the canvas";
   * a width with a null height becomes a maximum width (the frame still shrinks to fit).
   */
  width: number | null
  height: number | null
  /**
   * Scale applied to a fixed-size guest so it fits the canvas. The shell computes this
   * from the canvas box, never from this frame: a frame whose width depends on its own
   * scale would shrink itself a little on every layout pass.
   */
  fitScale?: number
  /**
   * The emulated device's pixel ratio, for the chrome and for the guest.
   *
   * Electron's `<webview>` has no per-view device-scale-factor, so this is not faked with a zoom -
   * a zoom would change the CSS viewport and make the preview lie about layout. What the page gets
   * is the honest consequence of the number (viewport = resolution / dpr), and the number itself is
   * on screen next to the size.
   */
  dpr?: number
  /**
   * A physical hinge down the middle of the emulated device.
   *
   * Drawn as a gap rather than a hairline: content laid across a fold is not separated, it is *not
   * there*, so the guest is told the gap's width and the seam is painted where the hardware has it.
   */
  hinge?: boolean
  /** Which layout the foldable is emulated in, for the guest's `data-devlens-fold` hint. */
  foldState?: 'main' | 'cover' | 'dual'
  status: ViewportStatus
  active: boolean
  onActivate: (viewId: ViewportId) => void
  onScroll: (viewId: ViewportId, message: ScrollSyncMessage) => void
  onStatusPatch: (viewId: ViewportId, patch: Partial<ViewportStatus>) => void
  /**
   * A guest attached, with the partition it is on.
   *
   * The partition rides along because main needs it to create this guest's popups on the *same*
   * session. It is the frame's own prop, so it is the value the webview element was built with -
   * not something a later tab switch could have changed.
   */
  onGuestAttached: (viewId: ViewportId, guestId: number, partition: string) => void
  /** Live viewport size in CSS pixels, for the status bar and the recon report. */
  onMeasured?: (viewId: ViewportId, size: { width: number; height: number }) => void
  /** Result of a `& <selector>` finder run inside this guest. */
  onFindResult?: (result: FindResult) => void
  /**
   * A right-click inside this guest, with the inspection the page's bridge already did.
   *
   * The frame passes it up with its own `viewId`: the page cannot know which viewport it is in,
   * and the shell needs to know which frame a paste or a "back" belongs to.
   */
  onContextMenu?: (payload: Omit<PageContextMenuPayload, 'viewId'>) => void
  /**
   * Normal mode renders a single pane with no developer chrome: no header, no device
   * selector, no frame border - the page fills the workspace.
   */
  chrome?: boolean
  /** False while normal mode is active: the guest refuses design mode and the finder. */
  devCapabilities?: boolean
  /**
   * On-demand inspection lease. Granted while the WImH overlay is open, so normal mode can
   * borrow design mode and the finder for that panel without leaving dev capabilities on.
   */
  inspectionLease?: boolean
  /**
   * Live overrides as props, so the shell stays the source of truth: a frame that is
   * remounted (a session swap) seeds itself from these and replays them after navigation.
   */
  overrideCss?: string
  overrideDesignMode?: boolean
  /** Header extras (device picker, width picker, ...). */
  headerExtras?: ReactNode
}

/** Guests are scaled down to fit the canvas, never resized: the CSS viewport stays exact. */
const FRAME_BASE = 'flex min-h-0 flex-col rounded-lg border bg-neutral-900/40 transition-colors'

export const ViewportFrame = forwardRef<ViewportHandle, ViewportFrameProps>(function ViewportFrame(
  {
    viewId,
    title,
    initialUrl,
    guestPreloadUrl,
    partition,
    width,
    height,
    fitScale = 1,
    dpr,
    hinge = false,
    foldState,
    status,
    active,
    onActivate,
    onScroll,
    onStatusPatch,
    onGuestAttached,
    onMeasured,
    onFindResult,
    onContextMenu,
    overrideCss = '',
    overrideDesignMode = false,
    chrome = true,
    devCapabilities = true,
    inspectionLease = false,
    headerExtras
  },
  handleRef
) {
  const webviewRef = useRef<DevLensWebviewElement | null>(null)
  const [fitToCanvas, setFitToCanvas] = useState(true)
  const [guestBox, setGuestBox] = useState({ width: 0, height: 0 })

  /**
   * The page a frame is born with. React would otherwise rewrite the `src` attribute whenever
   * the shell's idea of the URL changes (in-page navigation, tab title sync), and every rewrite
   * makes Electron navigate again. Navigation after mount goes through the handle instead.
   */
  const initialSrc = useRef(initialUrl)

  /**
   * Live overrides are remembered here, not in the shell: inserted CSS and design mode
   * both belong to a single document, so they must be replayed after a navigation.
   */
  const overrides = useRef<{ css: string; cssKey: string | null; designMode: boolean }>({
    css: '',
    cssKey: null,
    designMode: false
  })
  /** Electron refuses webview.send/insertCSS until the guest has attached and fired dom-ready. */
  const readyRef = useRef(false)

  const sendToGuest = useCallback((channel: string, payload: unknown): boolean => {
    const guest = webviewRef.current
    if (!guest || !readyRef.current) return false
    try {
      guest.send(channel, payload)
      return true
    } catch {
      return false
    }
  }, [])

  /**
   * The mode is pushed on mount, on every change, on dom-ready and after each load. A single
   * push can lose a race (the guest is not ready yet, or the prop changed between the load and
   * the effect), so the latest value is kept in a ref that every path reads.
   */
  const modeRef = useRef({ dev: devCapabilities, inspection: inspectionLease })
  useLayoutEffect(() => {
    modeRef.current = { dev: devCapabilities, inspection: inspectionLease }
  })
  /** The fold state, kept for the same reason: a load in flight must not lose the current one. */
  /* Computed here rather than further down: the fold push needs it, and one expression is one
     source of truth for what the hinge is worth. */
  const hingeWidth = hinge ? Math.max(6, Math.round((width ?? 0) * 0.02)) : 0
  const foldRef = useRef({ state: foldState ?? 'main', hinge: hingeWidth })
  useLayoutEffect(() => {
    foldRef.current = { state: foldState ?? 'main', hinge: hingeWidth }
  })

  const pushMode = useCallback((): void => {
    sendToGuest(IPC.viewportMode, modeRef.current)
  }, [sendToGuest])

  /** The fold hint follows the same rule as the mode: pushed, replayed on every load, never lost. */
  const pushFold = useCallback((): void => {
    sendToGuest(IPC.viewportFold, { state: foldRef.current.state, hinge: foldRef.current.hinge })
  }, [sendToGuest])

  useEffect(() => {
    pushMode()
  }, [devCapabilities, inspectionLease, pushMode])

  // Latest callbacks, so the webview listeners are attached exactly once.
  const callbacks = useRef({
    onScroll,
    onStatusPatch,
    onGuestAttached,
    onMeasured,
    onFindResult,
    onContextMenu
  })
  useLayoutEffect(() => {
    callbacks.current = {
      onScroll,
      onStatusPatch,
      onGuestAttached,
      onMeasured,
      onFindResult,
      onContextMenu
    }
  })

  const fixed = width !== null && height !== null
  const scale = fixed && fitToCanvas ? fitScale : 1
  useEffect(() => {
    pushFold()
  }, [foldState, hingeWidth, pushFold])
  const sizeLabel =
    guestBox.width && guestBox.height
      ? `${guestBox.width} x ${guestBox.height}`
      : 'measuring'
  const zoomLabel = fixed && scale < 0.995 ? ` (${Math.round(scale * 100)}%)` : ''

  /** Injects (or clears) the operator's CSS override through the webview API. */
  const applyCss = useCallback(async (css: string): Promise<{ ok: boolean; error: string | null }> => {
    const guest = webviewRef.current
    overrides.current.css = css
    // Deferred rather than failed: the frame replays both overrides on every load.
    if (!guest || !readyRef.current) return { ok: true, error: null }

    try {
      const staleKey = overrides.current.cssKey
      overrides.current.cssKey = null
      if (staleKey) await guest.removeInsertedCSS(staleKey).catch(() => undefined)
      if (!css.trim()) return { ok: true, error: null }
      overrides.current.cssKey = await guest.insertCSS(css)
      return { ok: true, error: null }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }, [])

  /** document.designMode lives in the guest, applied through its preload bridge. */
  const applyDesignMode = useCallback((enabled: boolean): void => {
    overrides.current.designMode = enabled
    sendToGuest(IPC.viewportDesignMode, { enabled })
  }, [sendToGuest])

  /**
   * The shell owns the override state; these effects push it into the guest and keep the
   * frame's replay ref in step, so a remounted frame (session swap) starts consistent.
   */
  useEffect(() => {
    void applyCss(overrideCss)
  }, [applyCss, overrideCss])

  useEffect(() => {
    applyDesignMode(overrideDesignMode)
  }, [applyDesignMode, overrideDesignMode])

  useImperativeHandle(
    handleRef,
    (): ViewportHandle => ({
      loadUrl: (url: string) => {
        const guest = webviewRef.current
        if (!guest) return
        void guest.loadURL(url).catch((error: unknown) => {
          callbacks.current.onStatusPatch(viewId, {
            phase: 'failed',
            error: error instanceof Error ? error.message : String(error)
          })
        })
      },
      reload: () => webviewRef.current?.reload(),
      goBack: () => {
        const guest = webviewRef.current
        if (guest?.canGoBack()) guest.goBack()
      },
      goForward: () => {
        const guest = webviewRef.current
        if (guest?.canGoForward()) guest.goForward()
      },
      applyScroll: (ratio: number) => {
        sendToGuest(IPC.viewportApplyScroll, { ratio })
      },
      applyCss: (css: string) => applyCss(css),
      setDesignMode: (enabled: boolean) => applyDesignMode(enabled),
      find: (selector: string) => {
        sendToGuest(IPC.viewportFind, {
          selector,
          clear: selector.trim().length === 0
        })
      },
      /** `<webview>` exposes this directly; the guest keeps its state, only the audio stops. */
      setAudioMuted: (muted: boolean) => {
        try {
          webviewRef.current?.setAudioMuted(muted)
        } catch {
          /* the guest may not be attached yet */
        }
      },
      /** No guest yet is not an error: the context menu simply has nothing to command. */
      guestId: () => {
        try {
          return webviewRef.current?.getWebContentsId() ?? null
        } catch {
          return null
        }
      },
      evaluate: (script: string) => {
        const guest = webviewRef.current
        if (!guest) return Promise.reject(new Error('no guest attached'))
        return guest.executeJavaScript(script)
      },
      openGuestDevTools: () => webviewRef.current?.openDevTools()
    }),
    [viewId]
  )

  useEffect(() => {
    const guest = webviewRef.current
    if (!guest) return

    // Report the live viewport size, so the header always states the truth even when a
    // preset width has to shrink to fit the canvas.
    const measure = (): void => {
      const size = { width: guest.offsetWidth, height: guest.offsetHeight }
      callbacks.current.onMeasured?.(viewId, size)
      setGuestBox((current) =>
        current.width === size.width && current.height === size.height ? current : size
      )
    }
    const sizeObserver = new ResizeObserver(measure)
    sizeObserver.observe(guest)
    measure()

    // `getWebContentsId` throws before the guest is attached; retry on `did-attach`.
    const registerGuest = (): void => {
      try {
        callbacks.current.onGuestAttached(viewId, guest.getWebContentsId(), partition)
      } catch {
        /* not attached yet */
      }
    }

    const handleReady = (): void => {
      readyRef.current = true
      // From this moment the guest can receive messages: hand it the current mode and fold state.
      pushMode()
      pushFold()
    }

    const readNavigationState = (): Partial<ViewportStatus> => {
      try {
        return {
          canGoBack: guest.canGoBack(),
          canGoForward: guest.canGoForward(),
          url: guest.getURL(),
          title: guest.getTitle()
        }
      } catch {
        return {}
      }
    }

    const handleIpcMessage = (event: Event): void => {
      const detail = event as GuestIpcMessageEvent
      if (detail.channel === IPC.viewportScroll) {
        const [message] = detail.args as [ScrollSyncMessage]
        if (message) callbacks.current.onScroll(viewId, message)
        return
      }
      if (detail.channel === IPC.viewportFindResult) {
        const [result] = detail.args as [FindResult]
        // The guest cannot know which frame it belongs to; the frame does.
        if (result) callbacks.current.onFindResult?.({ ...result, viewId })
        return
      }
      if (detail.channel === IPC.viewportContextMenu) {
        const [payload] = detail.args as [Omit<PageContextMenuPayload, 'viewId'>]
        if (payload) callbacks.current.onContextMenu?.(payload)
      }
    }

    const handleStart = (): void =>
      callbacks.current.onStatusPatch(viewId, { phase: 'loading', isLoading: true, error: null })

    const handleStop = (): void =>
      callbacks.current.onStatusPatch(viewId, {
        phase: 'ready',
        isLoading: false,
        ...readNavigationState()
      })

    const handleNavigate = (event: Event): void => {
      const detail = event as GuestNavigateEvent
      callbacks.current.onStatusPatch(viewId, {
        url: detail.url,
        phase: 'ready',
        error: null,
        ...readNavigationState()
      })
    }

    const handleFail = (event: Event): void => {
      const detail = event as GuestFailLoadEvent
      if (!detail.isMainFrame || detail.errorCode === -3) return
      callbacks.current.onStatusPatch(viewId, {
        phase: 'failed',
        isLoading: false,
        error: `${detail.errorDescription} (${detail.errorCode})`
      })
    }

    guest.addEventListener('did-attach', registerGuest)
    guest.addEventListener('dom-ready', handleReady)
    guest.addEventListener('dom-ready', registerGuest)
    guest.addEventListener('did-start-loading', handleStart)
    guest.addEventListener('did-stop-loading', handleStop)
    guest.addEventListener('did-navigate', handleNavigate)
    guest.addEventListener('did-fail-load', handleFail)
    guest.addEventListener('ipc-message', handleIpcMessage)

    // Live CSS and design mode belong to the loaded document, so replay them whenever the
    // guest navigates: the operator should never have to re-apply their session.
    const replayOverrides = (): void => {
      if (overrides.current.css.trim()) void applyCss(overrides.current.css)
      if (overrides.current.designMode) applyDesignMode(true)
      pushMode()
      pushFold()
    }
    guest.addEventListener('did-finish-load', replayOverrides)

    // The element is usually attached before this effect runs.
    registerGuest()
    const frame = window.requestAnimationFrame(registerGuest)

    return () => {
      window.cancelAnimationFrame(frame)
      readyRef.current = false
      sizeObserver.disconnect()
      guest.removeEventListener('did-attach', registerGuest)
      guest.removeEventListener('dom-ready', handleReady)
      guest.removeEventListener('dom-ready', registerGuest)
      guest.removeEventListener('did-start-loading', handleStart)
      guest.removeEventListener('did-stop-loading', handleStop)
      guest.removeEventListener('did-navigate', handleNavigate)
      guest.removeEventListener('did-fail-load', handleFail)
      guest.removeEventListener('ipc-message', handleIpcMessage)
      guest.removeEventListener('did-finish-load', replayOverrides)
    }
  }, [viewId, applyCss, applyDesignMode, pushMode, sendToGuest])

  const guestSurfaceStyle = fixed
    ? {
        width: `${width}px`,
        height: `${height}px`,
        transform: `scale(${scale})`,
        transformOrigin: 'top left'
      }
    : { width: '100%', height: '100%' }

  return (
    <section
      onMouseDown={() => onActivate(viewId)}
      className={[
        FRAME_BASE,
        chrome
          ? active
            ? 'border-teal-400/50'
            : 'border-white/10 hover:border-white/20'
          : 'rounded-none border-transparent bg-transparent',
        fixed ? 'shrink-0' : 'min-w-[320px] flex-1'
      ].join(' ')}
      style={
        fixed
          ? { width: bodyWrapperWidth(width, scale) }
          : width !== null
            ? { maxWidth: `${width}px` }
            : undefined
      }
    >
      {chrome && (
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-white/10 px-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-neutral-300">
          <span
            className={[
              'h-1.5 w-1.5 rounded-full',
              status.phase === 'failed'
                ? 'bg-rose-400'
                : status.isLoading
                  ? 'animate-pulse bg-amber-400'
                  : 'bg-teal-400'
            ].join(' ')}
          />
          {title}
        </span>
        <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-neutral-500">
          {sizeLabel}
          {zoomLabel}
          {dpr ? ` @${dpr}x` : ''}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-600">
          {status.title || status.url}
        </span>
        {headerExtras}
        {fixed && (
          <IconButton
            label={fitToCanvas ? 'Show at 100%' : 'Fit to canvas'}
            pressed={fitToCanvas}
            onClick={() => setFitToCanvas((value) => !value)}
          >
            {fitToCanvas ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </IconButton>
        )}
        <IconButton label={`Reload ${title}`} onClick={() => webviewRef.current?.reload()}>
          <RefreshCw size={13} />
        </IconButton>
      </header>
      )}

      <div
        className={[
          'flex min-h-0 flex-1',
          fixed ? 'items-start justify-center overflow-hidden p-2' : 'overflow-hidden'
        ].join(' ')}
      >
        <div
          className={
            fixed ? 'relative overflow-hidden rounded-md bg-white shadow-lg' : 'h-full w-full'
          }
          style={
            fixed
              ? { width: wrapperWidth(width, scale), height: wrapperHeight(height, scale) }
              : undefined
          }
        >
          <div
            className={fixed ? 'overflow-hidden rounded-md bg-white' : 'h-full w-full'}
            style={guestSurfaceStyle}
          >
            {/* `allowpopups` is what lets `window.open` reach the main process at all: without it
                Chromium refuses the request inside the guest, and an OAuth button does nothing. The
                attribute only *permits the attempt* - `setWindowOpenHandler` in `main/guests.ts` is
                the gate, and it allows exactly an http(s) popup (a real child window, so
                `window.opener` survives) or routes a tab request to the tab strip.

                The value is an empty *attribute* (that is how Electron reads the switch), which is
                why it is cast: React's typing for the custom element says boolean, and a boolean
                `true` is dropped for this element by the JSX runtime. */}
            <webview
              ref={webviewRef}
              src={initialSrc.current}
              partition={partition}
              preload={guestPreloadUrl}
              allowpopups={'' as unknown as boolean}
              webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
              title={`DevLens ${title} viewport`}
            />
          </div>
          {/* The hinge: a band across the middle of the emulated screen, scaled with it. The page
              is told the same width through `--devlens-fold-hinge`, so a layout that avoids the
              seam in the preview is avoiding it for the same reason it would on the hardware. */}
          {hinge && fixed && (
            <div
              data-testid="device-hinge"
              aria-hidden="true"
              className="pointer-events-none absolute top-0 bottom-0 left-1/2 -translate-x-1/2"
              style={{
                width: Math.max(4, Math.round(hingeWidth * scale)),
                background:
                  'linear-gradient(90deg, rgba(15,18,24,0.92), rgba(90,98,110,0.55), rgba(15,18,24,0.92))'
              }}
            />
          )}
        </div>
      </div>
    </section>
  )
})

function wrapperWidth(width: number, scale: number): number {
  return Math.round(width * scale)
}

function wrapperHeight(height: number, scale: number): number {
  return Math.round(height * scale)
}

function bodyWrapperWidth(width: number, scale: number): number {
  // Frame width = scaled guest + inner padding + border.
  return wrapperWidth(width, scale) + 19
}
