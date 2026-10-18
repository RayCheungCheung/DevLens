import type { LocalServer, LocalServerScan } from '../shared/types'

/**
 * Local dev server discovery.
 *
 * Probes the ports dev tooling actually binds to (Vite, Next, CRA, Storybook, Flask,
 * Django, plus the usual Docker-published database and broker ports), reads the Server
 * header and the page title, and reports what answered. A port that refuses the connection
 * is simply not reachable - nothing is inferred about containers or processes we cannot see.
 */
const PROBE_PORTS: { port: number; label: string; service: string | null }[] = [
  { port: 3000, label: 'Dev server', service: 'Next.js / Node' },
  { port: 3001, label: 'Dev server', service: 'Next.js / Node' },
  { port: 4000, label: 'Dev server', service: 'GraphQL / Node' },
  { port: 4200, label: 'Dev server', service: 'Angular' },
  { port: 5000, label: 'Dev server', service: 'Flask / .NET' },
  { port: 5173, label: 'Vite', service: 'Vite' },
  { port: 5174, label: 'Vite', service: 'Vite' },
  { port: 5175, label: 'Vite', service: 'Vite' },
  { port: 6006, label: 'Storybook', service: 'Storybook' },
  { port: 7000, label: 'Dev server', service: null },
  { port: 8000, label: 'Dev server', service: 'Django / PHP' },
  { port: 8080, label: 'Dev server', service: 'HTTP alt / Tomcat' },
  { port: 8888, label: 'Notebook', service: 'Jupyter' },
  { port: 9000, label: 'Dev server', service: null },
  { port: 1234, label: 'Dev server', service: null },
  { port: 5432, label: 'Database', service: 'PostgreSQL (docker)' },
  { port: 6379, label: 'Cache', service: 'Redis (docker)' },
  { port: 3306, label: 'Database', service: 'MySQL (docker)' },
  { port: 27017, label: 'Database', service: 'MongoDB (docker)' },
  { port: 9200, label: 'Search', service: 'Elasticsearch (docker)' },
  { port: 5672, label: 'Broker', service: 'RabbitMQ (docker)' },
  { port: 1080, label: 'Proxy', service: 'Mailhog' }
]

const PROBE_TIMEOUT_MS = 900
const TITLE_LIMIT = 4096

let inFlight: Promise<LocalServerScan> | null = null

/** Scans every candidate port in parallel; repeated calls share one in-flight scan. */
export function scanLocalServers(pinned: { url: string; label: string }[] = []): Promise<LocalServerScan> {
  if (inFlight) return inFlight
  const started = Date.now()

  inFlight = (async (): Promise<LocalServerScan> => {
    const results = await Promise.all(PROBE_PORTS.map(probePort))
    const reachable = results.filter((server): server is LocalServer => server !== null)

    const pinnedServers: LocalServer[] = pinned.map((entry) => {
      const existing = reachable.find((server) => server.url === entry.url)
      if (existing) return { ...existing, pinned: true, label: entry.label, source: 'pinned' }
      return {
        url: entry.url,
        host: 'localhost',
        port: Number(new URL(entry.url).port || 80),
        label: entry.label,
        service: null,
        status: null,
        reachable: false,
        title: null,
        source: 'pinned',
        pinned: true
      }
    })

    const merged = [
      ...pinnedServers,
      ...reachable.filter((server) => !pinnedServers.some((entry) => entry.url === server.url))
    ]

    return { scannedAt: started, probed: PROBE_PORTS.length, servers: merged }
  })().finally(() => {
    inFlight = null
  })

  return inFlight
}

async function probePort(entry: { port: number; label: string; service: string | null }): Promise<LocalServer | null> {
  const url = `http://127.0.0.1:${entry.port}/`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { accept: 'text/html,application/json;q=0.9,*/*;q=0.8' }
    })

    const contentType = response.headers.get('content-type') ?? ''
    const title = contentType.includes('text/html') ? await readTitle(response) : null

    return {
      url,
      host: '127.0.0.1',
      port: entry.port,
      label: entry.label,
      service: response.headers.get('server') ?? entry.service,
      status: response.status,
      reachable: true,
      title,
      source: 'probe',
      pinned: false
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Reads just enough of the body to find the document title. */
async function readTitle(response: Response): Promise<string | null> {
  try {
    const text = (await response.text()).slice(0, TITLE_LIMIT)
    const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text)
    if (!match) return null
    const title = match[1].replace(/\s+/g, ' ').trim()
    return title.length > 0 ? title.slice(0, 80) : null
  } catch {
    return null
  }
}
