const dataUrl = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`

const lensy = dataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#031012"/><stop offset="0.55" stop-color="#072829"/><stop offset="1" stop-color="#0b3a36"/>
    </linearGradient>
    <radialGradient id="halo"><stop offset="0" stop-color="#2dd4bf" stop-opacity=".34"/><stop offset="1" stop-color="#2dd4bf" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <circle cx="1180" cy="355" r="390" fill="url(#halo)"/>
  <g stroke="#7dd3fc" stroke-opacity=".12">
    <path d="M0 120H1600M0 240H1600M0 360H1600M0 480H1600M0 600H1600M0 720H1600"/>
    <path d="M160 0V900M320 0V900M480 0V900M640 0V900M800 0V900M960 0V900M1120 0V900M1280 0V900M1440 0V900"/>
  </g>
  <g fill="none" stroke="#2dd4bf">
    <path d="M980 196v-34M1272 196v-34" stroke-width="10" stroke-linecap="round"/>
    <rect x="950" y="178" width="352" height="335" rx="112" stroke-width="12" fill="#071315"/>
    <rect x="990" y="218" width="272" height="255" rx="84" stroke-width="8" stroke="#0f766e" fill="#071315"/>
    <circle cx="1076" cy="326" r="44" fill="#2dd4bf" stroke="none"/>
    <circle cx="1076" cy="326" r="18" fill="#ecfeff" stroke="none"/>
    <circle cx="1190" cy="326" r="15" fill="#2dd4bf" stroke="none"/>
    <path d="M1064 398Q1124 442 1184 398" stroke="#ecfeff" stroke-width="13" stroke-linecap="round"/>
    <path d="M990 454v42M1262 454v42" stroke-width="10" stroke-linecap="round"/>
  </g>
  <path d="M0 760C240 705 390 820 640 760s390-82 640-18 280 54 320 24V900H0Z" fill="#041416" fill-opacity=".7"/>
  <g fill="#a3e635" opacity=".7">
    <circle cx="260" cy="210" r="5"/><circle cx="420" cy="135" r="3"/><circle cx="1370" cy="690" r="4"/><circle cx="1470" cy="220" r="3"/>
  </g>
</svg>`)

const neonGrid = dataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#10091f"/><stop offset=".62" stop-color="#26103d"/><stop offset="1" stop-color="#07131d"/></linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f9a8d4"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#sky)"/>
  <circle cx="800" cy="430" r="185" fill="url(#sun)" opacity=".85"/>
  <g stroke="#22d3ee" stroke-opacity=".42" fill="none">
    <path d="M0 510H1600"/><path d="M800 510L80 900M800 510L310 900M800 510L540 900M800 510L800 900M800 510L1060 900M800 510L1290 900M800 510L1520 900"/>
    <path d="M0 620H1600M0 755H1600" stroke="#f472b6" stroke-opacity=".28"/>
  </g>
  <path d="M0 510H1600V900H0Z" fill="#07131d" fill-opacity=".44"/>
</svg>`)

const oceanDusk = dataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#041323"/><stop offset=".5" stop-color="#0b3b57"/><stop offset="1" stop-color="#06151d"/></linearGradient></defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <circle cx="1240" cy="235" r="118" fill="#fbbf24" opacity=".82"/>
  <path d="M0 540C220 470 360 570 560 535s330-95 530-32 310 74 510 20V900H0Z" fill="#0e7490" opacity=".38"/>
  <path d="M0 650C260 570 390 700 640 650s380-85 620-16 260 55 340 22V900H0Z" fill="#155e75" opacity=".58"/>
  <path d="M0 780C300 710 440 820 720 770s430-70 880 14V900H0Z" fill="#082f49" opacity=".9"/>
  <g fill="none" stroke="#67e8f9" stroke-opacity=".38" stroke-width="3">
    <path d="M80 575C220 535 320 610 460 575"/><path d="M940 610C1100 570 1200 650 1510 590"/><path d="M440 720C590 685 690 750 840 720"/>
  </g>
</svg>`)

const emberCircuit = dataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs><radialGradient id="glow"><stop stop-color="#fb923c" stop-opacity=".28"/><stop offset="1" stop-color="#fb923c" stop-opacity="0"/></radialGradient></defs>
  <rect width="1600" height="900" fill="#140d08"/>
  <circle cx="1220" cy="420" r="430" fill="url(#glow)"/>
  <g fill="none" stroke="#f59e0b" stroke-opacity=".48" stroke-width="5">
    <path d="M80 180H420V300H610V450H840"/><path d="M120 760H360V620H620V540H780"/>
    <path d="M1480 190H1240V340H1080V470"/><path d="M1510 730H1260V620H1090V560"/>
  </g>
  <g fill="#fbbf24">
    <circle cx="420" cy="180" r="14"/><circle cx="610" cy="300" r="14"/><circle cx="360" cy="760" r="14"/><circle cx="620" cy="620" r="14"/>
    <circle cx="1240" cy="190" r="14"/><circle cx="1080" cy="340" r="14"/><circle cx="1260" cy="730" r="14"/><circle cx="1090" cy="620" r="14"/>
  </g>
  <g fill="none" stroke="#7c2d12" stroke-width="3" opacity=".8">
    <rect x="700" y="315" width="270" height="270" rx="42"/><rect x="770" y="385" width="130" height="130" rx="24"/>
  </g>
</svg>`)

const pixelMeadow = dataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="#071b16"/>
  <g fill="#065f46" opacity=".62">
    <rect x="0" y="540" width="1600" height="360"/><rect x="160" y="460" width="180" height="80"/><rect x="420" y="500" width="240" height="40"/><rect x="1120" y="450" width="320" height="90"/>
  </g>
  <g fill="#34d399">
    <rect x="80" y="300" width="36" height="36"/><rect x="124" y="268" width="44" height="44"/><rect x="176" y="312" width="30" height="30"/>
    <rect x="1320" y="250" width="46" height="46"/><rect x="1366" y="286" width="32" height="32"/><rect x="1290" y="310" width="28" height="28"/>
  </g>
  <g fill="#a3e635" opacity=".8">
    <rect x="620" y="590" width="30" height="30"/><rect x="660" y="560" width="40" height="40"/><rect x="710" y="606" width="26" height="26"/>
    <rect x="210" y="680" width="38" height="38"/><rect x="260" y="650" width="48" height="48"/><rect x="318" y="692" width="30" height="30"/>
  </g>
  <path d="M0 540H1600" stroke="#0f766e" stroke-width="6" opacity=".7"/>
</svg>`)

const blueprint = dataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="#071426"/>
  <g stroke="#38bdf8" stroke-opacity=".14">
    <path d="M0 90H1600M0 180H1600M0 270H1600M0 360H1600M0 450H1600M0 540H1600M0 630H1600M0 720H1600M0 810H1600"/>
    <path d="M90 0V900M180 0V900M270 0V900M360 0V900M450 0V900M540 0V900M630 0V900M720 0V900M810 0V900M900 0V900M990 0V900M1080 0V900M1170 0V900M1260 0V900M1350 0V900M1440 0V900M1530 0V900"/>
  </g>
  <g fill="none" stroke="#7dd3fc" stroke-width="4" opacity=".78">
    <rect x="250" y="170" width="740" height="480" rx="26"/><path d="M250 250H990"/><circle cx="292" cy="210" r="10"/><circle cx="330" cy="210" r="10"/><circle cx="368" cy="210" r="10"/>
    <rect x="330" y="330" width="230" height="210" rx="12"/><rect x="620" y="330" width="300" height="70" rx="10"/><rect x="620" y="440" width="220" height="100" rx="10"/>
  </g>
  <g stroke="#2dd4bf" stroke-width="3" opacity=".65"><circle cx="1240" cy="280" r="54"/><circle cx="1240" cy="280" r="14"/><path d="M1240 342V470L1130 580"/></g>
</svg>`)

export const WALLPAPER_PRESETS = [
  { id: 'lensy', label: 'Lensy Night', detail: 'Teal halo and the Lensy mascot.', image: lensy },
  { id: 'neon-grid', label: 'Neon Grid', detail: 'Retro-future perspective grid.', image: neonGrid },
  { id: 'ocean-dusk', label: 'Ocean Dusk', detail: 'Layered waves under a warm moon.', image: oceanDusk },
  { id: 'ember-circuit', label: 'Ember Circuit', detail: 'Warm traces across a dark board.', image: emberCircuit },
  { id: 'pixel-meadow', label: 'Pixel Meadow', detail: 'Blocky greens and quiet depth.', image: pixelMeadow },
  { id: 'blueprint', label: 'Blueprint', detail: 'Developer geometry on navy graph paper.', image: blueprint }
] as const

export type WallpaperPreset = (typeof WALLPAPER_PRESETS)[number]
export type WallpaperPresetId = 'none' | 'custom' | WallpaperPreset['id']

export function isWallpaperPresetId(value: unknown): value is WallpaperPresetId {
  return value === 'none' || value === 'custom' || WALLPAPER_PRESETS.some((preset) => preset.id === value)
}

export function wallpaperImage(id: WallpaperPresetId): string {
  return WALLPAPER_PRESETS.find((preset) => preset.id === id)?.image ?? ''
}

export function resolveLaunchpadWallpaper(selection: {
  wallpaperPreset: WallpaperPresetId
  wallpaper: string
}): string {
  if (selection.wallpaperPreset === 'custom') return selection.wallpaper
  return wallpaperImage(selection.wallpaperPreset)
}
