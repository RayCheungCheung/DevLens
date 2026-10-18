import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const shared = resolve(__dirname, 'src/shared')
const preload = resolve(__dirname, 'src/preload')

/**
 * electron-vite compiles three independent targets:
 *  - main:    the Node/Electron main process (window + IPC + CDP/system calls)
 *  - preload: the trusted bridges (shell bridge + guest bridge for <webview>)
 *  - renderer: the React UI shell served by Vite (HMR in dev)
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': shared } },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': shared } },
    build: {
      rollupOptions: {
        // Two preloads: one for the DevLens shell, one injected into every webview guest.
        input: {
          index: resolve(preload, 'index.ts'),
          webview: resolve(preload, 'webview.ts')
        },
        // Sandboxed renderers cannot load ESM preloads, so emit CommonJS.
        output: { format: 'cjs', entryFileNames: '[name].js' }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        '@shared': shared
      }
    },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    }
  }
})
