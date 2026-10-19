export const APP_ICON_CATEGORIES = [
  { id: 'all', label: 'All icons' },
  { id: 'standard', label: 'Standard' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'retro', label: 'Retro' },
  { id: 'special', label: 'Special' }
] as const

export type AppIconCategory = Exclude<(typeof APP_ICON_CATEGORIES)[number]['id'], 'all'>
export type AppIconColor = 'accent' | 'paper' | 'ink' | 'muted'
export const APP_ICON_STYLE_IDS = [
  'default',
  'orbit',
  'prism',
  'aperture',
  'monogram',
  'focus',
  'slash',
  'blocks',
  'terminal',
  'floppy',
  'pixel',
  'sunburst',
  'bolt',
  'circuit',
  'wave',
  'constellation',
  'lensy'
] as const
export type AppIconStyle = (typeof APP_ICON_STYLE_IDS)[number]

export type AppIconShape =
  | {
      kind: 'circle'
      cx: number
      cy: number
      r: number
      fill?: AppIconColor
      stroke?: AppIconColor
      width?: number
      opacity?: number
    }
  | {
      kind: 'rect'
      x: number
      y: number
      width: number
      height: number
      radius?: number
      fill?: AppIconColor
      stroke?: AppIconColor
      strokeWidth?: number
      opacity?: number
    }
  | {
      kind: 'line'
      x1: number
      y1: number
      x2: number
      y2: number
      stroke: AppIconColor
      width: number
      opacity?: number
    }
  | {
      kind: 'polygon' | 'polyline'
      points: [number, number][]
      fill?: AppIconColor
      stroke?: AppIconColor
      width?: number
      opacity?: number
    }

export interface AppIconDesign {
  id: AppIconStyle
  label: string
  category: AppIconCategory
  background: string
  palette: Record<AppIconColor, string>
  shapes: AppIconShape[]
}

const lines = (
  segments: [number, number, number, number][],
  stroke: AppIconColor,
  width = 4,
  opacity = 1
): AppIconShape[] =>
  segments.map(([x1, y1, x2, y2]) => ({ kind: 'line', x1, y1, x2, y2, stroke, width, opacity }))

const polygon = (
  points: [number, number][],
  fill?: AppIconColor,
  stroke?: AppIconColor,
  width = 3,
  opacity = 1
): AppIconShape => ({ kind: 'polygon', points, fill, stroke, width, opacity })

const radial = (cx: number, cy: number, angle: number, radius: number): [number, number] => [
  cx + Math.cos((angle * Math.PI) / 180) * radius,
  cy + Math.sin((angle * Math.PI) / 180) * radius
]

const sparkle = (cx: number, cy: number, radius: number): AppIconShape[] => [
  {
    kind: 'polygon',
    points: [radial(cx, cy, -90, radius), radial(cx, cy, 0, radius), radial(cx, cy, 90, radius), radial(cx, cy, 180, radius)],
    fill: 'paper'
  },
  { kind: 'circle', cx, cy, r: radius * 0.27, fill: 'accent' }
]

const terminalShapes: AppIconShape[] = [
  { kind: 'rect', x: 18, y: 22, width: 64, height: 56, radius: 11, fill: 'ink', stroke: 'paper', strokeWidth: 3 },
  { kind: 'line', x1: 19, y1: 37, x2: 81, y2: 37, stroke: 'muted', width: 2 },
  { kind: 'circle', cx: 28, cy: 30, r: 2.4, fill: 'accent' },
  { kind: 'circle', cx: 36, cy: 30, r: 2.4, fill: 'paper', opacity: 0.7 },
  { kind: 'circle', cx: 44, cy: 30, r: 2.4, fill: 'muted' },
  ...lines([[32, 48, 42, 56], [42, 56, 32, 64]], 'accent', 4.5),
  { kind: 'line', x1: 50, y1: 64, x2: 66, y2: 64, stroke: 'paper', width: 4.5 }
]

const pixelPattern = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...']
const pixelShapes: AppIconShape[] = pixelPattern.flatMap((row, y) =>
  [...row].flatMap((cell, x) =>
    cell === '#'
      ? [{ kind: 'rect' as const, x: 20 + x * 9, y: 22 + y * 9, width: 8, height: 8, radius: 1, fill: 'accent' as const }]
      : []
  )
)

const waveShapes: AppIconShape[] = [0, 1, 2].map((row) => ({
  kind: 'polyline' as const,
  points: Array.from({ length: 25 }, (_, index) => {
    const x = 16 + index * 2.85
    const y = 35 + row * 16 + Math.sin((index / 24) * Math.PI * 2 + row * 0.65) * 7
    return [x, y] as [number, number]
  }),
  stroke: row === 1 ? 'paper' : 'accent',
  width: row === 1 ? 4 : 5.5,
  opacity: row === 1 ? 0.78 : 1
}))

const circuitLines = lines(
  [
    [23, 30, 23, 48],
    [23, 48, 43, 48],
    [43, 48, 43, 61],
    [77, 25, 77, 42],
    [77, 42, 58, 42],
    [58, 42, 58, 58],
    [34, 77, 50, 77],
    [50, 77, 50, 64],
    [67, 77, 81, 77]
  ],
  'accent',
  3.5
)

const BASE_APP_ICON_STYLES: AppIconDesign[] = [
  {
    id: 'default',
    label: 'DevLens',
    category: 'standard',
    background: '#0b1718',
    palette: { accent: '#2dd4bf', paper: '#ecfeff', ink: '#0f172a', muted: '#155e63' },
    shapes: [
      ...lines([[24, 20, 20, 20], [20, 20, 20, 24], [76, 20, 80, 20], [80, 20, 80, 24], [20, 76, 20, 80], [20, 80, 24, 80], [76, 80, 80, 80], [80, 80, 80, 76]], 'accent', 4),
      { kind: 'circle', cx: 50, cy: 50, r: 18, stroke: 'paper', width: 4.5 },
      { kind: 'circle', cx: 50, cy: 50, r: 4, fill: 'accent' },
      ...lines([[50, 24, 50, 29], [50, 71, 50, 76], [24, 50, 29, 50], [71, 50, 76, 50]], 'accent', 3)
    ]
  },
  {
    id: 'orbit',
    label: 'Orbit',
    category: 'standard',
    background: '#111827',
    palette: { accent: '#60a5fa', paper: '#f8fafc', ink: '#172554', muted: '#334155' },
    shapes: [
      { kind: 'circle', cx: 51, cy: 51, r: 25, fill: 'ink' },
      { kind: 'circle', cx: 51, cy: 51, r: 32, stroke: 'accent', width: 3, opacity: 0.85 },
      { kind: 'circle', cx: 51, cy: 51, r: 16, fill: 'accent' },
      { kind: 'line', x1: 31, y1: 57, x2: 67, y2: 44, stroke: 'muted', width: 3 },
      { kind: 'circle', cx: 78, cy: 33, r: 5, fill: 'paper' },
      { kind: 'circle', cx: 24, cy: 69, r: 4, fill: 'paper', opacity: 0.82 }
    ]
  },
  {
    id: 'prism',
    label: 'Prism',
    category: 'standard',
    background: '#2a0f24',
    palette: { accent: '#f472b6', paper: '#fff1f7', ink: '#4c1d3a', muted: '#9d174d' },
    shapes: [
      polygon([[50, 16], [84, 79], [16, 79]], 'ink', 'accent', 5),
      polygon([[50, 36], [69, 68], [31, 68]], 'paper'),
      { kind: 'line', x1: 50, y1: 16, x2: 50, y2: 36, stroke: 'accent', width: 4 },
      { kind: 'circle', cx: 50, cy: 18, r: 4, fill: 'paper' }
    ]
  },
  {
    id: 'aperture',
    label: 'Aperture',
    category: 'standard',
    background: '#17120a',
    palette: { accent: '#fbbf24', paper: '#fffbeb', ink: '#292524', muted: '#92400e' },
    shapes: [
      { kind: 'circle', cx: 50, cy: 50, r: 32, stroke: 'paper', width: 4 },
      ...Array.from({ length: 6 }, (_, index) => {
        const angle = index * 60
        return polygon([
          radial(50, 50, angle, 9),
          radial(50, 50, angle, 28),
          radial(50, 50, angle + 52, 28),
          radial(50, 50, angle + 22, 9)
        ], 'accent', 'ink', 1, index % 2 ? 0.62 : 0.95)
      }),
      { kind: 'circle', cx: 50, cy: 50, r: 8, fill: 'ink', stroke: 'accent', width: 2 }
    ]
  },
  {
    id: 'monogram',
    label: 'Monogram',
    category: 'minimal',
    background: '#fef3c7',
    palette: { accent: '#0ea5e9', paper: '#ffffff', ink: '#111827', muted: '#f59e0b' },
    shapes: [
      { kind: 'rect', x: 20, y: 25, width: 32, height: 50, radius: 4, fill: 'ink' },
      { kind: 'circle', cx: 52, cy: 50, r: 25, fill: 'ink' },
      { kind: 'circle', cx: 52, cy: 50, r: 13, fill: 'paper' },
      { kind: 'circle', cx: 52, cy: 50, r: 4.5, fill: 'accent' },
      { kind: 'rect', x: 73, y: 22, width: 7, height: 56, radius: 3.5, fill: 'accent' }
    ]
  },
  {
    id: 'focus',
    label: 'Focus',
    category: 'minimal',
    background: '#111113',
    palette: { accent: '#fb7185', paper: '#fff1f2', ink: '#27272a', muted: '#881337' },
    shapes: [
      ...lines([[18, 30, 18, 18], [18, 18, 30, 18], [82, 30, 82, 18], [82, 18, 70, 18], [18, 70, 18, 82], [18, 82, 30, 82], [82, 70, 82, 82], [82, 82, 70, 82]], 'accent', 3.5),
      { kind: 'circle', cx: 50, cy: 50, r: 22, stroke: 'paper', width: 3 },
      { kind: 'circle', cx: 50, cy: 50, r: 12, stroke: 'accent', width: 3 },
      { kind: 'rect', x: 46, y: 46, width: 8, height: 8, radius: 1.5, fill: 'paper' }
    ]
  },
  {
    id: 'slash',
    label: 'Slash',
    category: 'minimal',
    background: '#f8fafc',
    palette: { accent: '#fb923c', paper: '#ffffff', ink: '#0f172a', muted: '#fdba74' },
    shapes: [
      { kind: 'line', x1: 27, y1: 76, x2: 40, y2: 24, stroke: 'accent', width: 10 },
      { kind: 'line', x1: 47, y1: 76, x2: 60, y2: 24, stroke: 'ink', width: 10 },
      { kind: 'line', x1: 67, y1: 76, x2: 80, y2: 24, stroke: 'accent', width: 10, opacity: 0.38 }
    ]
  },
  {
    id: 'blocks',
    label: 'Blocks',
    category: 'minimal',
    background: '#0d211a',
    palette: { accent: '#34d399', paper: '#ecfdf5', ink: '#022c22', muted: '#065f46' },
    shapes: [
      { kind: 'rect', x: 20, y: 20, width: 25, height: 25, radius: 5, fill: 'accent' },
      polygon([[69, 19], [82, 32], [69, 45], [56, 32]], 'paper'),
      { kind: 'rect', x: 20, y: 55, width: 25, height: 25, radius: 5, fill: 'muted' },
      { kind: 'rect', x: 55, y: 55, width: 25, height: 25, radius: 5, fill: 'accent', opacity: 0.55 }
    ]
  },
  {
    id: 'terminal',
    label: 'Terminal',
    category: 'retro',
    background: '#081014',
    palette: { accent: '#22d3ee', paper: '#ecfeff', ink: '#164e63', muted: '#0e7490' },
    shapes: terminalShapes
  },
  {
    id: 'floppy',
    label: 'Floppy',
    category: 'retro',
    background: '#1f2937',
    palette: { accent: '#fbbf24', paper: '#f8fafc', ink: '#0f172a', muted: '#94a3b8' },
    shapes: [
      polygon([[22, 18], [67, 18], [81, 32], [81, 82], [19, 82], [19, 18]], 'ink', 'paper', 3),
      { kind: 'rect', x: 50, y: 18, width: 17, height: 23, radius: 2, fill: 'muted', stroke: 'paper', strokeWidth: 2 },
      { kind: 'rect', x: 60, y: 22, width: 4, height: 9, radius: 1, fill: 'ink' },
      { kind: 'rect', x: 28, y: 49, width: 44, height: 22, radius: 2, fill: 'paper' },
      { kind: 'line', x1: 34, y1: 56, x2: 65, y2: 56, stroke: 'accent', width: 3 },
      { kind: 'line', x1: 34, y1: 63, x2: 56, y2: 63, stroke: 'accent', width: 3, opacity: 0.55 }
    ]
  },
  {
    id: 'pixel',
    label: 'Pixel',
    category: 'retro',
    background: '#14213d',
    palette: { accent: '#a3e635', paper: '#f7fee7', ink: '#1a2e05', muted: '#4d7c0f' },
    shapes: pixelShapes
  },
  {
    id: 'sunburst',
    label: 'Sunburst',
    category: 'retro',
    background: '#2b1606',
    palette: { accent: '#fb923c', paper: '#fff7ed', ink: '#431407', muted: '#9a3412' },
    shapes: [
      ...Array.from({ length: 12 }, (_, index) => {
        const angle = index * 30
        const [x1, y1] = radial(50, 50, angle, 24)
        const [x2, y2] = radial(50, 50, angle, 35)
        return { kind: 'line' as const, x1, y1, x2, y2, stroke: 'accent' as const, width: 5 }
      }),
      { kind: 'circle', cx: 50, cy: 50, r: 16, fill: 'paper', stroke: 'accent', width: 4 },
      { kind: 'circle', cx: 50, cy: 50, r: 6, fill: 'ink', stroke: 'accent', width: 2 }
    ]
  },
  {
    id: 'bolt',
    label: 'Bolt',
    category: 'special',
    background: '#171717',
    palette: { accent: '#facc15', paper: '#fefce8', ink: '#262626', muted: '#a16207' },
    shapes: [
      { kind: 'circle', cx: 50, cy: 50, r: 36, stroke: 'muted', width: 1.5, opacity: 0.55 },
      polygon([[59, 13], [25, 53], [46, 53], [38, 87], [76, 42], [54, 42]], 'accent', 'paper', 2.5),
      polygon([[56, 20], [39, 42], [54, 42], [48, 63], [64, 39], [49, 39]], 'paper', undefined, 0, 0.34),
      { kind: 'circle', cx: 22, cy: 27, r: 2.2, fill: 'paper', opacity: 0.72 },
      { kind: 'circle', cx: 79, cy: 72, r: 1.8, fill: 'paper', opacity: 0.6 }
    ]
  },
  {
    id: 'circuit',
    label: 'Circuit',
    category: 'special',
    background: '#062a2a',
    palette: { accent: '#5eead4', paper: '#f0fdfa', ink: '#134e4a', muted: '#0f766e' },
    shapes: [
      ...circuitLines,
      { kind: 'circle', cx: 43, cy: 61, r: 5, fill: 'paper', stroke: 'accent', width: 2 },
      { kind: 'circle', cx: 58, cy: 58, r: 4, fill: 'paper', stroke: 'accent', width: 2 },
      { kind: 'circle', cx: 50, cy: 64, r: 4, fill: 'accent' },
      { kind: 'circle', cx: 23, cy: 30, r: 4, fill: 'paper' },
      { kind: 'circle', cx: 77, cy: 25, r: 4, fill: 'paper' },
      { kind: 'circle', cx: 34, cy: 77, r: 4, fill: 'paper' },
      { kind: 'circle', cx: 67, cy: 77, r: 4, fill: 'paper' }
    ]
  },
  {
    id: 'wave',
    label: 'Wave',
    category: 'special',
    background: '#071b33',
    palette: { accent: '#38bdf8', paper: '#e0f2fe', ink: '#0c4a6e', muted: '#075985' },
    shapes: waveShapes
  },
  {
    id: 'constellation',
    label: 'Constellation',
    category: 'special',
    background: '#19122e',
    palette: { accent: '#c4b5fd', paper: '#f5f3ff', ink: '#2e1065', muted: '#6d28d9' },
    shapes: [
      ...lines([[28, 70, 38, 32], [38, 32, 55, 50], [55, 50, 74, 28], [74, 28, 68, 74], [68, 74, 55, 50]], 'accent', 2, 0.58),
      ...sparkle(38, 32, 8),
      ...sparkle(55, 50, 6),
      ...sparkle(74, 28, 7),
      ...sparkle(68, 74, 5),
      { kind: 'circle', cx: 28, cy: 70, r: 3, fill: 'paper' }
    ]
  },
  {
    id: 'lensy',
    label: 'Lensy',
    category: 'special',
    background: '#061719',
    palette: { accent: '#2dd4bf', paper: '#ecfeff', ink: '#081014', muted: '#0f766e' },
    shapes: [
      ...lines([[35, 33, 35, 24], [85, 33, 85, 24]], 'accent', 4.5),
      { kind: 'rect', x: 24, y: 29, width: 72, height: 69, radius: 24, fill: 'ink', stroke: 'accent', strokeWidth: 2.5 },
      { kind: 'rect', x: 32, y: 37, width: 56, height: 53, radius: 18, fill: 'ink', stroke: 'muted', strokeWidth: 2 },
      { kind: 'circle', cx: 49, cy: 58, r: 9, fill: 'accent' },
      { kind: 'circle', cx: 49, cy: 58, r: 4, fill: 'paper' },
      { kind: 'circle', cx: 72, cy: 58, r: 3.2, fill: 'accent' },
      { kind: 'polyline', points: [[49, 72], [60, 81], [71, 72]], stroke: 'paper', width: 3 },
      ...lines([[33, 85, 33, 94], [87, 85, 87, 94]], 'accent', 3.5),
      polygon([[97, 40], [99.2, 44.8], [104, 47], [99.2, 49.2], [97, 54], [94.8, 49.2], [90, 47], [94.8, 44.8]], 'paper', undefined, 0, 0.86)
    ]
  }
]

const eyes = (
  cx: number,
  cy: number,
  gap: number,
  radius: number,
  fill: AppIconColor
): AppIconShape[] => [
  { kind: 'circle', cx: cx - gap / 2, cy, r: radius, fill },
  { kind: 'circle', cx: cx + gap / 2, cy, r: radius, fill }
]

const tail = (
  points: [number, number][],
  stroke: AppIconColor,
  width = 2
): AppIconShape[] => [
  { kind: 'polyline', points, stroke, width },
  {
    kind: 'circle',
    cx: points[points.length - 1][0],
    cy: points[points.length - 1][1],
    r: width * 0.8,
    fill: stroke
  }
]

/** Different Lensy easter eggs, one per icon, drawn as if peeking into the artwork. */
export const APP_ICON_EASTER_EGGS: Record<AppIconStyle, AppIconShape[]> = {
  default: [
    { kind: 'rect', x: 88, y: 84, width: 14, height: 12, radius: 6, fill: 'ink', stroke: 'accent', strokeWidth: 1.5 },
    ...eyes(95, 89, 4, 1.1, 'paper'),
    { kind: 'polyline', points: [[93, 94], [96, 96], [98, 94]], stroke: 'paper', width: 1.2 }
  ],
  orbit: tail([[75, 82], [86, 88], [92, 83], [97, 87]], 'accent', 2),
  prism: [
    { kind: 'rect', x: 83, y: 76, width: 15, height: 12, radius: 6, fill: 'ink', stroke: 'paper', strokeWidth: 1.2 },
    ...eyes(90.5, 81, 4.5, 1.1, 'paper')
  ],
  aperture: [
    ...eyes(50, 49, 6, 1.4, 'paper'),
    { kind: 'polyline', points: [[47, 53], [50, 55], [53, 53]], stroke: 'paper', width: 1.2 }
  ],
  monogram: [
    ...eyes(52, 47, 6, 1.3, 'accent'),
    { kind: 'polyline', points: [[49, 52], [52, 54], [55, 52]], stroke: 'ink', width: 1.2 }
  ],
  focus: eyes(50, 50, 3, 0.9, 'accent'),
  slash: tail([[20, 82], [13, 87], [10, 79]], 'accent', 2),
  blocks: [
    { kind: 'rect', x: 45, y: 45, width: 10, height: 10, radius: 4, fill: 'ink', stroke: 'paper', strokeWidth: 1 },
    ...eyes(50, 50, 3.5, 0.9, 'accent')
  ],
  terminal: tail([[82, 74], [91, 84], [87, 92]], 'accent', 2),
  floppy: [
    ...eyes(62, 58, 4, 1, 'accent'),
    { kind: 'polyline', points: [[60, 62], [62, 64], [64, 62]], stroke: 'accent', width: 1.1 }
  ],
  pixel: [
    { kind: 'rect', x: 82, y: 80, width: 4, height: 4, radius: 0.7, fill: 'accent' },
    { kind: 'rect', x: 87, y: 85, width: 3.5, height: 3.5, radius: 0.6, fill: 'paper', opacity: 0.8 },
    { kind: 'rect', x: 91, y: 89, width: 3, height: 3, radius: 0.5, fill: 'accent', opacity: 0.55 }
  ],
  sunburst: [
    { kind: 'rect', x: 78, y: 78, width: 16, height: 14, radius: 6, fill: 'ink', stroke: 'accent', strokeWidth: 1.2 },
    ...eyes(86, 84, 4.5, 1.1, 'paper')
  ],
  bolt: tail([[70, 82], [80, 87], [88, 82], [94, 88]], 'accent', 2),
  circuit: [
    ...eyes(50, 63, 5, 1, 'ink'),
    { kind: 'polyline', points: [[47, 67], [50, 69], [53, 67]], stroke: 'ink', width: 1.1 }
  ],
  wave: [
    { kind: 'rect', x: 59, y: 16, width: 12, height: 10, radius: 4, fill: 'ink', stroke: 'accent', strokeWidth: 1.2 },
    ...eyes(65, 20.5, 4, 0.9, 'paper')
  ],
  constellation: [
    ...eyes(68, 73, 4, 0.9, 'ink'),
    { kind: 'polyline', points: [[66, 77], [68, 79], [70, 77]], stroke: 'ink', width: 1 }
  ],
  lensy: tail([[91, 86], [101, 94], [108, 86]], 'accent', 2)
}

export const APP_ICON_STYLES: AppIconDesign[] = BASE_APP_ICON_STYLES.map((design) => ({
  ...design,
  shapes: [...design.shapes, ...APP_ICON_EASTER_EGGS[design.id]]
}))

const LEGACY_ICON_STYLES: Record<string, AppIconStyle> = {
  violet: 'orbit',
  amber: 'sunburst',
  mono: 'monogram',
  neon: 'pixel'
}

export function normalizeAppIconStyle(value: unknown): AppIconStyle {
  if (typeof value !== 'string') return 'default'
  if (APP_ICON_STYLES.some((style) => style.id === value)) return value as AppIconStyle
  return LEGACY_ICON_STYLES[value] ?? 'default'
}

export function appIconDesign(style: AppIconStyle): AppIconDesign {
  return APP_ICON_STYLES.find((entry) => entry.id === style) ?? APP_ICON_STYLES[0]
}
