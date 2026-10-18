import { Link2, Monitor, Smartphone, Unlink2 } from 'lucide-react'
import { DESKTOP_WIDTHS, MOBILE_DEVICES, deviceViewport } from '@shared/config'
import type { ViewportId } from '@shared/types'

interface ViewportPanelProps {
  activeView: ViewportId
  onActiveView: (view: ViewportId) => void
  /** The device the emulator is on, so this panel highlights the same one the frame is showing. */
  deviceId: string
  onDeviceIndex: (deviceId: string) => void
  /** System pages always use the full canvas, so the emulator controls are not mounted there. */
  available: boolean
  /** `null` means the desktop frame fills the canvas. */
  desktopWidth: number | null
  onDesktopWidth: (width: number | null) => void
  syncEnabled: boolean
  onSyncChange: (enabled: boolean) => void
}

/**
 * Responsive design mode.
 *
 * The two frames and their knobs, in one place: which pane has focus, which device the mobile
 * frame is pretending to be, how wide the desktop frame is, and whether the two scroll together.
 * Everything here is also reachable from the canvas headers - this is the deliberate, keyboard
 * friendly route to the same switches.
 */
export function ViewportPanel({
  activeView,
  onActiveView,
  deviceId,
  onDeviceIndex,
  available,
  desktopWidth,
  onDesktopWidth,
  syncEnabled,
  onSyncChange
}: ViewportPanelProps) {
  if (!available) {
    return (
      <div
        data-testid="viewport-panel-locked"
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
      >
        <h3 className="flex items-center gap-1.5 text-[11px] text-ink-200">
          <Monitor size={12} className="text-ink-500" />
          Responsive preview unavailable
        </h3>
        <p className="text-[10px] leading-4 text-ink-500">
          DevLens system pages always use the full window. Open a web page to preview it in the
          mobile and desktop viewports.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3" data-testid="viewport-panel">
      <section>
        <h3 className="text-[11px] text-ink-200">Active viewport</h3>
        <div
          role="group"
          aria-label="Active viewport"
          className="mt-2 flex items-center gap-1 rounded-lg bg-white/[0.02] p-0.5"
        >
          {(
            [
              { id: 'mobile' as ViewportId, label: 'Mobile', icon: Smartphone },
              { id: 'desktop' as ViewportId, label: 'Desktop', icon: Monitor }
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`viewport-focus-${option.id}`}
              aria-pressed={activeView === option.id}
              onClick={() => onActiveView(option.id)}
              className={[
                'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] transition-colors',
                activeView === option.id
                  ? 'bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                  : 'text-ink-400 hover:bg-white/5 hover:text-ink-200'
              ].join(' ')}
            >
              <option.icon size={13} />
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-[11px] text-ink-200">Mobile device</h3>
        <div className="mt-2 flex flex-col gap-1">
          {MOBILE_DEVICES.map((device) => (
            <button
              key={device.id}
              type="button"
              data-testid="viewport-device"
              data-device={device.id}
              aria-pressed={device.id === deviceId}
              onClick={() => {
                onDeviceIndex(device.id)
                onActiveView('mobile')
              }}
              className={[
                'flex min-w-0 items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors',
                device.id === deviceId
                  ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)]'
                  : 'border-[var(--devlens-hairline)] hover:bg-white/[0.03]'
              ].join(' ')}
            >
              <Smartphone size={11} className="shrink-0 text-ink-500" />
              <span className="min-w-0 flex-1 truncate text-[11px] text-ink-200">{device.label}</span>
              <span className="shrink-0 font-mono text-[9px] text-ink-600">
                {Math.round(deviceViewport(device).width)}x{Math.round(deviceViewport(device).height)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-[11px] text-ink-200">Desktop width</h3>
        <div className="mt-2 flex flex-wrap gap-1">
          {[null, ...DESKTOP_WIDTHS].map((width) => (
            <button
              key={width ?? 'fill'}
              type="button"
              data-testid="viewport-width"
              data-width={width ?? 'fill'}
              aria-pressed={desktopWidth === width}
              onClick={() => onDesktopWidth(width)}
              className={[
                'rounded border px-2 py-1 font-mono text-[10px] transition-colors',
                desktopWidth === width
                  ? 'border-[var(--devlens-accent-line)] bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                  : 'border-[var(--devlens-hairline)] text-ink-400 hover:bg-white/5 hover:text-ink-200'
              ].join(' ')}
            >
              {width ?? 'fill'}
            </button>
          ))}
        </div>
      </section>

      <section>
        <label className="flex items-center gap-2 text-[11px] text-ink-300">
          <input
            type="checkbox"
            data-testid="viewport-sync"
            checked={syncEnabled}
            onChange={(event) => onSyncChange(event.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--devlens-accent)]"
          />
          {syncEnabled ? <Link2 size={12} /> : <Unlink2 size={12} />}
          Scroll both viewports together
        </label>
        <p className="mt-1.5 text-[10px] leading-4 text-ink-600">
          The mobile frame is a real{' '}
          {Math.round(
            deviceViewport(MOBILE_DEVICES.find((entry) => entry.id === deviceId) ?? MOBILE_DEVICES[0])
              .width
          )}{' '}
          CSS px viewport,
          scaled to fit the canvas - the page never sees the scale.
        </p>
      </section>
    </div>
  )
}


