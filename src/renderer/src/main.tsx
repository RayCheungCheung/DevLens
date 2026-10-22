import { createRoot } from 'react-dom/client'
import { App } from '@renderer/App'
import { DevToolsEasterEgg } from '@renderer/components/DevToolsEasterEgg'
import { BrowserEasterEggs } from '@renderer/components/BrowserEasterEggs'
import '@renderer/styles/index.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('DevLens shell could not find the #root element.')
}

// No StrictMode: <webview> is an imperative, out-of-process element and the double
// mount pass in development would attach and detach the guests on every load.
createRoot(container).render(
  <>
    <App />
    <DevToolsEasterEgg />
    <BrowserEasterEggs />
  </>
)
