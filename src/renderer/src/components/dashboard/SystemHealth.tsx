import { Activity, Cpu, HardDrive, MemoryStick, Radio } from 'lucide-react'
import { Widget } from '@renderer/components/dashboard/Widget'
import type { ReactNode } from 'react'

interface SystemHealthProps {
  requests: number
  failures: number
  consoleErrors: number
  tracked: number
}

interface PerformanceMemory {
  usedJSHeapSize?: number
  jsHeapSizeLimit?: number
}

function megabytes(bytes: number | undefined): string {
  if (!Number.isFinite(bytes) || !bytes) return '--'
  return `${Math.round(bytes / 1024 / 1024)} MB`
}

/** Browser and session facts, kept local and read directly from the current process. */
export function SystemHealth({ requests, failures, consoleErrors, tracked }: SystemHealthProps) {
  const navigatorWithMemory = navigator as Navigator & {
    deviceMemory?: number
    hardwareConcurrency?: number
  }
  const memory = (
    performance as Performance & { memory?: PerformanceMemory }
  ).memory
  const heap = memory?.usedJSHeapSize
  const heapLimit = memory?.jsHeapSizeLimit
  const pressure = heap && heapLimit ? Math.min(100, Math.round((heap / heapLimit) * 100)) : null

  return (
    <Widget icon={Activity} title="System health" note={`${navigator.onLine ? 'online' : 'offline'} - local readings`}>
      <div className="grid grid-cols-2 gap-1.5">
        <HealthCell
          icon={<Cpu size={11} />}
          label="CPU threads"
          value={String(navigatorWithMemory.hardwareConcurrency ?? '--')}
        />
        <HealthCell
          icon={<HardDrive size={11} />}
          label="Device RAM"
          value={navigatorWithMemory.deviceMemory ? `${navigatorWithMemory.deviceMemory} GB` : '--'}
        />
        <HealthCell
          icon={<MemoryStick size={11} />}
          label="JS heap"
          value={heap ? megabytes(heap) : '--'}
          detail={pressure === null ? undefined : `${pressure}%`}
        />
        <HealthCell
          icon={<Radio size={11} />}
          label="Requests"
          value={String(requests)}
          detail={`${failures} failed`}
        />
        <HealthCell label="Console errors" value={String(consoleErrors)} />
        <HealthCell label="Trackers blocked" value={String(tracked)} />
      </div>
    </Widget>
  )
}

function HealthCell({
  icon,
  label,
  value,
  detail
}: {
  icon?: ReactNode
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="rounded bg-white/[0.03] px-2 py-1.5">
      <span className="flex items-center gap-1 font-mono text-[13px] text-ink-100">
        {icon}
        {value}
      </span>
      <span className="block truncate text-[9px] uppercase tracking-wide text-ink-500">
        {label}
        {detail ? ` - ${detail}` : ''}
      </span>
    </div>
  )
}
