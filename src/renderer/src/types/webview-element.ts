/**
 * Minimal typing for Electron's <webview> element.
 *
 * Electron ships `Electron.WebviewTag`, but pulling the Electron typings into the
 * DOM-only renderer project would drag `node` types along. Declaring the subset we
 * actually call keeps the renderer type-safe and independent.
 */
export interface GuestFailLoadEvent extends Event {
  errorCode: number
  errorDescription: string
  validatedURL: string
  isMainFrame: boolean
}

export interface GuestNavigateEvent extends Event {
  url: string
  isMainFrame?: boolean
}

export interface GuestIpcMessageEvent extends Event {
  channel: string
  args: unknown[]
}

export interface DevLensWebviewElement extends HTMLElement {
  src: string
  loadURL(url: string, options?: { httpReferrer?: string; userAgent?: string }): Promise<void>
  reload(): void
  stop(): void
  goBack(): void
  goForward(): void
  canGoBack(): boolean
  canGoForward(): boolean
  isLoading(): boolean
  getTitle(): string
  getURL(): string
  getWebContentsId(): number
  /** Send an IPC message into the guest preload (see src/preload/webview.ts). */
  send(channel: string, ...args: unknown[]): void
  /**
   * Injects CSS into the guest document and resolves with a key for removeInsertedCSS.
   * The stylesheet belongs to the loaded document, so it has to be re-injected after
   * a navigation (the frame does that for us).
   */
  insertCSS(css: string): Promise<string>
  removeInsertedCSS(key: string): Promise<void>
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>
  /** Silences the guest without touching its document. */
  setAudioMuted(muted: boolean): void
  isAudioMuted(): boolean
  openDevTools(): void
}
