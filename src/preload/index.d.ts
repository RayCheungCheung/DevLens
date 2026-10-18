import type { DevLensApi } from '../shared/api'

declare global {
  interface Window {
    devlens: DevLensApi
  }
}

export {}
