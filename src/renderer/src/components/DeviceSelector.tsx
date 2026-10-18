import { useState } from 'react'
import { Bookmark, Ruler, Save, Trash2 } from 'lucide-react'
import {
  DEVICE_FAMILIES,
  MOBILE_DEVICES,
  customDevice,
  deviceViewport,
  type DeviceFoldState,
  type DeviceProfile
} from '@shared/config'
import type { MobilePreset, MobileSettings } from '@shared/preferences'

interface DeviceSelectorProps {
  settings: MobileSettings
  onChange: (patch: Partial<MobileSettings>) => void
  /** The profile the current selection resolves to, after saved presets and the custom size. */
  active: DeviceProfile
}

/**
 * The device picker: the matrix, the fold toggle, and the free-size controls.
 *
 * It replaces a plain `<select>` with the same idea plus the two things a foldable preview needs.
 * The list is grouped by family, a foldable's *states* are the same device in another layout (so
 * "flip it shut" is one click rather than a second entry to remember to pick), and a custom size
 * is a device like any other - the frame below this does not know or care that it was typed.
 *
 * The DPR is shown, not simulated: Electron's `<webview>` has no per-view device-scale-factor, and
 * claiming one would be a lie in a preview the operator is using to judge layout. What *is*
 * emulated is the thing that changes layout - the CSS viewport, which is resolution / DPR - and
 * the fold hint the guest can read.
 */
export function DeviceSelector({ settings, onChange, active }: DeviceSelectorProps) {
  const [presetName, setPresetName] = useState('')
  const viewport = deviceViewport(active, settings.fold[active.id])

  const savePreset = (): void => {
    const label = presetName.trim() || `${settings.custom.width}x${settings.custom.height}`
    const next: MobilePreset = {
      label,
      width: settings.custom.width,
      height: settings.custom.height
    }
    onChange({
      saved: [...settings.saved.filter((entry) => entry.label !== label), next],
      deviceId: `saved:${label}`
    })
    setPresetName('')
  }

  return (
    /* Wrapping rather than overflowing: a foldable's controls (picker, fold toggle, metrics, saved
       presets) are wider than a narrow window's toolbar row, and flex children that overflow their
       own line do not shrink politely - they overlap, which puts one control underneath another and
       makes it unclickable. */
    <div
      className="flex min-w-0 flex-wrap items-center gap-1.5"
      data-testid="device-selector"
      data-device={active.id}
    >
      <select
        value={settings.deviceId.startsWith('saved:') ? 'custom' : active.id}
        onChange={(event) => onChange({ deviceId: event.target.value })}
        aria-label="Device preset"
        data-testid="device-preset"
        className="h-6 max-w-[190px] rounded border border-white/10 bg-neutral-950/70 px-1 font-mono text-[10px] text-neutral-300 outline-none hover:border-white/20"
      >
        {DEVICE_FAMILIES.filter((family) => family.id !== 'custom').map((family) => (
          <optgroup key={family.id} label={family.label}>
            {MOBILE_DEVICES.filter((entry) => entry.family === family.id).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </optgroup>
        ))}
        <optgroup label="Custom">
          <option value="custom">Free size ({settings.custom.width}x{settings.custom.height})</option>
          {settings.saved.map((preset) => (
            <option key={preset.label} value={`saved:${preset.label}`}>
              {preset.label} ({preset.width}x{preset.height})
            </option>
          ))}
        </optgroup>
      </select>

      {/* The free-size controls, shown when the custom entry is the active one. */}
      {active.family === 'custom' && (
        <span className="flex items-center gap-1" data-testid="custom-size">
          <Ruler size={11} className="text-ink-500" />
          <input
            type="number"
            aria-label="Custom width"
            data-testid="custom-width"
            value={settings.custom.width}
            onChange={(event) =>
              onChange({ custom: { ...settings.custom, width: Number(event.target.value) } })
            }
            className="h-6 w-14 rounded border border-white/10 bg-neutral-950/70 px-1 font-mono text-[10px] text-neutral-300 outline-none"
          />
          <input
            type="number"
            aria-label="Custom height"
            data-testid="custom-height"
            value={settings.custom.height}
            onChange={(event) =>
              onChange({ custom: { ...settings.custom, height: Number(event.target.value) } })
            }
            className="h-6 w-14 rounded border border-white/10 bg-neutral-950/70 px-1 font-mono text-[10px] text-neutral-300 outline-none"
          />
          <input
            aria-label="Preset name"
            data-testid="preset-name"
            value={presetName}
            placeholder="name"
            onChange={(event) => setPresetName(event.target.value)}
            className="h-6 w-16 rounded border border-white/10 bg-neutral-950/70 px-1 font-mono text-[10px] text-neutral-300 outline-none"
          />
          <button
            type="button"
            aria-label="Save this size as a preset"
            data-testid="save-preset"
            onClick={savePreset}
            className="rounded p-1 text-ink-400 hover:bg-white/[0.06] hover:text-ink-100"
          >
            <Save size={11} />
          </button>
        </span>
      )}

      {settings.saved.length > 0 && (
        <span className="flex items-center gap-1" data-testid="saved-presets">
          {settings.saved.map((preset) => (
            <span
              key={preset.label}
              className="flex items-center gap-1 rounded border border-white/10 px-1 font-mono text-[9px] text-ink-400"
            >
              <Bookmark size={9} />
              {preset.label}
              <button
                type="button"
                aria-label={`Delete preset ${preset.label}`}
                data-testid={`delete-preset-${preset.label}`}
                onClick={() =>
                  onChange({
                    saved: settings.saved.filter((entry) => entry.label !== preset.label),
                    deviceId:
                      settings.deviceId === `saved:${preset.label}` ? 'custom' : settings.deviceId
                  })
                }
                className="text-ink-500 hover:text-rose-300"
              >
                <Trash2 size={9} />
              </button>
            </span>
          ))}
        </span>
      )}

      {/* What the page will actually be laid out in. */}
      <span
        data-testid="device-metrics"
        data-dpr={viewport.dpr}
        data-fold={viewport.state.id}
        className="shrink-0 rounded-md border border-[var(--devlens-hairline)] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-ink-400"
      >
        {Math.round(viewport.width)} x {Math.round(viewport.height)} CSS
        {' @'}
        {viewport.dpr}x
        {viewport.state.hinge ? ' - dual screen' : ''}
      </span>
    </div>
  )
}

/** The profile a settings snapshot resolves to, including saved presets and the custom size. */
export function resolveDevice(settings: MobileSettings): DeviceProfile {
  if (settings.deviceId.startsWith('saved:')) {
    const label = settings.deviceId.slice('saved:'.length)
    const saved = settings.saved.find((entry) => entry.label === label)
    if (saved) return customDevice(saved.width, saved.height, saved.label)
  }
  if (settings.deviceId === 'custom') {
    return customDevice(settings.custom.width, settings.custom.height)
  }
  return MOBILE_DEVICES.find((entry) => entry.id === settings.deviceId) ?? MOBILE_DEVICES[0]
}

/**
 * The fold toggle, in its own slot.
 *
 * It is a sibling of the picker rather than a child of it on purpose: the row's width depends on
 * how wide the emulated device is, and nesting one control inside a row that can overflow is how a
 * button ends up underneath its neighbour - which looks fine and cannot be clicked. Nothing here
 * overlaps anything, because nothing here shares a box with anything.
 */
export function FoldToggle({
  settings,
  onChange,
  active
}: {
  settings: MobileSettings
  onChange: (patch: Partial<MobileSettings>) => void
  active: DeviceProfile
}) {
  const states = active.states ?? []
  if (states.length < 2) return null
  const current = deviceViewport(active, settings.fold[active.id]).state.id
  return (
    <div
      role="radiogroup"
      aria-label="Fold state"
      data-testid="fold-toggle"
      className="flex shrink-0 overflow-hidden rounded border border-white/10"
    >
      {states.map((state) => {
        const on = state.id === current
        return (
          <button
            key={state.id}
            type="button"
            role="radio"
            aria-checked={on}
            data-testid={`fold-${state.id}`}
            title={`${state.label} - ${Math.round(state.resolution.width / state.dpr)}x${Math.round(
              state.resolution.height / state.dpr
            )} CSS`}
            onClick={() => onChange({ fold: { ...settings.fold, [active.id]: state.id } })}
            className={[
              'px-2 py-1 font-mono text-[10px] transition-colors',
              on
                ? 'bg-[var(--devlens-accent-soft)] text-[var(--devlens-accent)]'
                : 'text-ink-400 hover:bg-white/5'
            ].join(' ')}
          >
            {state.id === 'dual' ? 'Dual' : state.id === 'cover' ? 'Cover' : 'Main'}
          </button>
        )
      })}
    </div>
  )
}

export type { DeviceFoldState }
