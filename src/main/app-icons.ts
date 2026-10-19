import { deflateSync } from 'node:zlib'
import { nativeImage, type NativeImage } from 'electron'
import { appIconDesign, type AppIconColor, type AppIconShape, type AppIconStyle } from '../shared/app-icon-art'

const SIZE = 256

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const name = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, Buffer.from(data), crc])
}

function encodePng(pixels: Uint8Array): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(SIZE, 0)
  header.writeUInt32BE(SIZE, 4)
  header[8] = 8
  header[9] = 6
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
  for (let y = 0; y < SIZE; y += 1) {
    const offset = y * (SIZE * 4 + 1)
    raw[offset] = 0
    Buffer.from(pixels.buffer, pixels.byteOffset + y * SIZE * 4, SIZE * 4).copy(raw, offset + 1)
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array())
  ])
}

function rgba(hex: string, alpha = 255): [number, number, number, number] {
  const value = hex.replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
    alpha
  ]
}

const SAMPLE = 3
const RASTER = SIZE * SAMPLE
const UNITS = 100
const PIXELS_PER_UNIT = RASTER / UNITS

function roundedDistance(x: number, y: number, rect: { x: number; y: number; width: number; height: number; radius: number }): number {
  const halfWidth = rect.width / 2
  const halfHeight = rect.height / 2
  const radius = Math.min(rect.radius, halfWidth, halfHeight)
  const qx = Math.abs(x - (rect.x + halfWidth)) - halfWidth + radius
  const qy = Math.abs(y - (rect.y + halfHeight)) - halfHeight + radius
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
}

function segmentDistance(x: number, y: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared))
  return Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t))
}

function polygonContains(x: number, y: number, points: [number, number][]): boolean {
  let inside = false
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const [xi, yi] = points[index]
    const [xj, yj] = points[previous]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function polygonDistance(x: number, y: number, points: [number, number][], closed: boolean): number {
  let distance = Number.POSITIVE_INFINITY
  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index - 1]
    const [x2, y2] = points[index]
    distance = Math.min(distance, segmentDistance(x, y, x1, y1, x2, y2))
  }
  if (closed && points.length > 2) {
    const [x1, y1] = points[points.length - 1]
    const [x2, y2] = points[0]
    distance = Math.min(distance, segmentDistance(x, y, x1, y1, x2, y2))
  }
  return distance
}

function blend(pixels: Uint8Array, index: number, color: [number, number, number, number], opacity: number): void {
  const sourceAlpha = (color[3] / 255) * opacity
  if (sourceAlpha <= 0) return
  const destinationAlpha = pixels[index + 3] / 255
  const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha)
  if (outputAlpha <= 0) return
  for (let channel = 0; channel < 3; channel += 1) {
    pixels[index + channel] = Math.round(
      (color[channel] * sourceAlpha + pixels[index + channel] * destinationAlpha * (1 - sourceAlpha)) / outputAlpha
    )
  }
  pixels[index + 3] = Math.round(outputAlpha * 255)
}

function shapeBounds(shape: AppIconShape): { left: number; top: number; right: number; bottom: number } {
  if (shape.kind === 'circle') {
    const reach = shape.r + (shape.width ?? 0) / 2 + 1
    return { left: shape.cx - reach, top: shape.cy - reach, right: shape.cx + reach, bottom: shape.cy + reach }
  }
  if (shape.kind === 'rect') {
    const reach = (shape.strokeWidth ?? 0) / 2 + 1
    return { left: shape.x - reach, top: shape.y - reach, right: shape.x + shape.width + reach, bottom: shape.y + shape.height + reach }
  }
  if (shape.kind === 'line') {
    const reach = shape.width / 2 + 1
    return { left: Math.min(shape.x1, shape.x2) - reach, top: Math.min(shape.y1, shape.y2) - reach, right: Math.max(shape.x1, shape.x2) + reach, bottom: Math.max(shape.y1, shape.y2) + reach }
  }
  const reach = (shape.width ?? 0) / 2 + 1
  return {
    left: Math.min(...shape.points.map(([x]) => x)) - reach,
    top: Math.min(...shape.points.map(([, y]) => y)) - reach,
    right: Math.max(...shape.points.map(([x]) => x)) + reach,
    bottom: Math.max(...shape.points.map(([, y]) => y)) + reach
  }
}

function paintShape(
  pixels: Uint8Array,
  shape: AppIconShape,
  palette: Record<AppIconColor, [number, number, number, number]>
): void {
  const bounds = shapeBounds(shape)
  const left = Math.max(0, Math.floor(bounds.left * PIXELS_PER_UNIT))
  const top = Math.max(0, Math.floor(bounds.top * PIXELS_PER_UNIT))
  const right = Math.min(RASTER, Math.ceil(bounds.right * PIXELS_PER_UNIT))
  const bottom = Math.min(RASTER, Math.ceil(bounds.bottom * PIXELS_PER_UNIT))
  const opacity = shape.opacity ?? 1
  for (let py = top; py < bottom; py += 1) {
    for (let px = left; px < right; px += 1) {
      const x = (px + 0.5) / PIXELS_PER_UNIT
      const y = (py + 0.5) / PIXELS_PER_UNIT
      let fill = false
      let stroke = false
      let fillColor: AppIconColor | undefined
      let strokeColor: AppIconColor | undefined
      if (shape.kind === 'circle') {
        const distance = Math.hypot(x - shape.cx, y - shape.cy)
        fill = shape.fill !== undefined && distance <= shape.r
        stroke = shape.stroke !== undefined && shape.width !== undefined && Math.abs(distance - shape.r) <= shape.width / 2
        fillColor = shape.fill
        strokeColor = shape.stroke
      } else if (shape.kind === 'rect') {
        const distance = roundedDistance(x, y, { x: shape.x, y: shape.y, width: shape.width, height: shape.height, radius: shape.radius ?? 0 })
        fill = shape.fill !== undefined && distance <= 0
        stroke = shape.stroke !== undefined && shape.strokeWidth !== undefined && Math.abs(distance) <= shape.strokeWidth / 2
        fillColor = shape.fill
        strokeColor = shape.stroke
      } else if (shape.kind === 'line') {
        stroke = segmentDistance(x, y, shape.x1, shape.y1, shape.x2, shape.y2) <= shape.width / 2
        strokeColor = shape.stroke
      } else {
        fill = Boolean(shape.fill) && polygonContains(x, y, shape.points)
        stroke = shape.stroke !== undefined && shape.width !== undefined && polygonDistance(x, y, shape.points, shape.kind === 'polygon') <= shape.width / 2
        fillColor = shape.fill
        strokeColor = shape.stroke
      }
      const offset = (py * RASTER + px) * 4
      if (fill && fillColor) blend(pixels, offset, palette[fillColor], opacity)
      if (stroke && strokeColor) blend(pixels, offset, palette[strokeColor], opacity)
    }
  }
}

function downsample(supersampled: Uint8Array): Uint8Array {
  const pixels = new Uint8Array(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let alpha = 0
      let red = 0
      let green = 0
      let blue = 0
      for (let sy = 0; sy < SAMPLE; sy += 1) {
        for (let sx = 0; sx < SAMPLE; sx += 1) {
          const offset = ((y * SAMPLE + sy) * RASTER + (x * SAMPLE + sx)) * 4
          const a = supersampled[offset + 3] / 255
          alpha += a
          red += supersampled[offset] * a
          green += supersampled[offset + 1] * a
          blue += supersampled[offset + 2] * a
        }
      }
      const target = (y * SIZE + x) * 4
      if (alpha > 0) {
        pixels[target] = Math.round(red / alpha)
        pixels[target + 1] = Math.round(green / alpha)
        pixels[target + 2] = Math.round(blue / alpha)
        pixels[target + 3] = Math.round((alpha / (SAMPLE * SAMPLE)) * 255)
      }
    }
  }
  return pixels
}

/** Every style has its own vector artwork, rendered here so the OS icon matches the picker. */
export function appIconPng(style: AppIconStyle): Buffer {
  const design = appIconDesign(style)
  const palette: Record<AppIconColor, [number, number, number, number]> = {
    accent: rgba(design.palette.accent),
    paper: rgba(design.palette.paper),
    ink: rgba(design.palette.ink),
    muted: rgba(design.palette.muted)
  }
  const background = rgba(design.background)
  const supersampled = new Uint8Array(RASTER * RASTER * 4)
  for (let y = 0; y < RASTER; y += 1) {
    for (let x = 0; x < RASTER; x += 1) {
      const px = (x + 0.5) / PIXELS_PER_UNIT
      const py = (y + 0.5) / PIXELS_PER_UNIT
      if (roundedDistance(px, py, { x: 0, y: 0, width: 100, height: 100, radius: 22 }) <= 0) {
        blend(supersampled, (y * RASTER + x) * 4, background, 1)
      }
    }
  }
  for (const shape of design.shapes) paintShape(supersampled, shape, palette)
  return encodePng(downsample(supersampled))
}

export function appIconFor(style: AppIconStyle): NativeImage {
  return nativeImage.createFromBuffer(appIconPng(style))
}
