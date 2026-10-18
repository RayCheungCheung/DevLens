import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { Widget } from '@renderer/components/dashboard/Widget'

interface Zone {
  id: string
  city: string
  timeZone: string
  note: string
}

/**
 * Developer-centric zones: where this browser was built, and the three places a build, a review
 * or a handover usually has to line up with.
 */
const ZONES: Zone[] = [
  { id: 'macao', city: 'Macao', timeZone: 'Asia/Macau', note: 'UTC+8' },
  { id: 'tokyo', city: 'Tokyo', timeZone: 'Asia/Tokyo', note: 'UTC+9' },
  { id: 'london', city: 'London', timeZone: 'Europe/London', note: 'UTC+0/+1' },
  { id: 'sf', city: 'San Francisco', timeZone: 'America/Los_Angeles', note: 'UTC-8/-7' }
]

interface Reading {
  time: string
  day: string
  /** True when this zone is already on tomorrow's date. */
  tomorrow: boolean
}

/**
 * Formats one instant in one zone.
 *
 * `Intl` rather than a hard-coded offset: London and San Francisco change offset twice a year, and
 * a dashboard that is wrong for half the year is worse than no dashboard. The formatter is built
 * per render rather than cached, because a cache keyed by zone would go stale exactly when the
 * clocks move.
 */
function read(now: Date, zone: Zone): Reading | null {
  try {
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now)
    const day = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone.timeZone,
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    }).format(now)
    const here = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', day: '2-digit' }).format(now)
    const there = new Intl.DateTimeFormat('en-CA', { timeZone: zone.timeZone, day: '2-digit' }).format(now)
    return { time, day, tomorrow: there !== here }
  } catch {
    return null
  }
}

/**
 * World clocks.
 *
 * One interval for the whole widget rather than one per zone, and the interval is torn down with
 * the card: a dashboard that is showing stops ticking the moment it is replaced by a page.
 */
export function WorldClocks() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <Widget
      icon={Clock}
      title="World clocks"
      note={new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(now)}
    >
      <ul data-testid="world-clocks" className="flex flex-col divide-y divide-[var(--devlens-hairline)]">
        {ZONES.map((zone) => {
          const reading = read(now, zone)
          return (
            <li key={zone.id} className="flex items-baseline gap-2 py-1 first:pt-0 last:pb-0">
              <span className="min-w-0 flex-1 truncate text-[11px] text-ink-300" title={zone.city}>
                {zone.city}
              </span>
              <span className="hidden shrink-0 font-mono text-[10px] text-ink-600 @lg:inline">
                {zone.note}
              </span>
              <span
                data-testid={`clock-${zone.id}`}
                className="shrink-0 font-mono text-[13px] tabular-nums text-ink-100"
              >
                {reading?.time ?? '--:--:--'}
              </span>
              {/* The date is the first thing to go when the card is narrow: the time is the
                  reading, the day is context. */}
              <span className="hidden w-[74px] shrink-0 truncate text-right font-mono text-[9px] text-ink-600 @2xl:block">
                {reading ? `${reading.day}${reading.tomorrow ? ' +1' : ''}` : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </Widget>
  )
}
