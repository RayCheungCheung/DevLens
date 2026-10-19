import { useEffect, useState } from 'react'
import { CloudSun, RefreshCw } from 'lucide-react'
import type { LaunchpadWeather } from '@shared/launchpad'
import { Widget, WidgetAction } from '@renderer/components/dashboard/Widget'

export function WeatherWidget({ place }: { place: string }) {
  const [weather, setWeather] = useState<LaunchpadWeather | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = (): void => {
    setLoading(true)
    void window.devlens
      .launchpadWeather(place)
      .then(setWeather)
      .catch((error: unknown) =>
        setWeather({
          ok: false,
          place,
          temperatureC: null,
          weather: null,
          windKph: null,
          error: error instanceof Error ? error.message : String(error)
        })
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    // The place is the only input; refresh is intentionally recreated with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place])

  return (
    <Widget
      icon={CloudSun}
      title="Weather"
      note={weather?.ok ? weather.place : place}
      action={
        <WidgetAction label="Refresh weather" onClick={refresh} disabled={loading}>
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </WidgetAction>
      }
    >
      {weather?.ok ? (
        <div className="flex items-end gap-3 py-1">
          <span className="font-mono text-[30px] leading-8 text-ink-100">
            {Math.round(weather.temperatureC ?? 0)}°
          </span>
          <span className="mb-1 min-w-0">
            <span className="block text-[11px] text-ink-200">{weather.weather}</span>
            <span className="block font-mono text-[9px] text-ink-500">
              wind {Math.round(weather.windKph ?? 0)} km/h
            </span>
          </span>
        </div>
      ) : (
        <p className="rounded border border-dashed border-[var(--devlens-hairline)] px-3 py-4 text-center text-[10px] text-ink-500">
          {loading ? 'Looking up local weather...' : weather?.error ?? 'Weather has not loaded yet.'}
        </p>
      )}
    </Widget>
  )
}
