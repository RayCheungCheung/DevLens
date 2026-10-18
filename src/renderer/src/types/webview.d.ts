import type { Ref, CSSProperties } from 'react'
import type { DevLensWebviewElement } from '@renderer/types/webview-element'

/**
 * Electron's <webview> is a custom element, so React's JSX needs to learn about it.
 * Only the props DevLens actually renders are declared.
 */
interface WebviewProps {
  src?: string
  partition?: string
  preload?: string
  /** Guest webPreferences, e.g. "contextIsolation=yes,nodeIntegration=no". */
  webpreferences?: string
  allowpopups?: string
  id?: string
  title?: string
  style?: CSSProperties
  ref?: Ref<DevLensWebviewElement>
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      webview: WebviewProps
    }
  }
}
