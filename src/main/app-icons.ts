import { deflateSync } from 'node:zlib'
import { nativeImage, type NativeImage } from 'electron'
import type { AppIconStyle } from '../shared/appearance'

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

function styleAccent(style: AppIconStyle): string {
  if (style === 'violet') return '#8b9cff'
  if (style === 'amber') return '#ffb44a'
  if (style === 'mono') return '#d7deea'
  if (style === 'neon') return '#a3e635'
  return '#2dd4bf'
}

/** A self-contained icon generator so every style is real without shipping external assets. */
export function appIconFor(style: AppIconStyle): NativeImage {
  const pixels = new Uint8Array(SIZE * SIZE * 4)
  const accent = rgba(styleAccent(style))
  const background = rgba(style === 'mono' ? '#30343c' : '#0b0d10')
  const light = rgba('#f2f5fa')
  const radius = 54
  const center = SIZE / 2
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const offset = (y * SIZE + x) * 4
      const cornerX = Math.max(radius - x, x - (SIZE - 1 - radius), 0)
      const cornerY = Math.max(radius - y, y - (SIZE - 1 - radius), 0)
      const inside =
        x >= 0 &&
        y >= 0 &&
        x < SIZE &&
        y < SIZE &&
        (cornerX === 0 || cornerY === 0 || cornerX ** 2 + cornerY ** 2 <= radius ** 2)
      if (!inside) continue
      pixels.set(background, offset)
      const dx = x - center
      const dy = y - center
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance > 61 && distance < 72) pixels.set(accent, offset)
      if (
        (Math.abs(dx) < 8 && distance < 42) ||
        (Math.abs(dy) < 8 && distance < 42)
      ) {
        pixels.set(distance < 8 ? light : accent, offset)
      }
      const bracket =
        (Math.abs(dx) > 79 && Math.abs(dx) < 88 && Math.abs(dy) < 58) ||
        (Math.abs(dy) > 79 && Math.abs(dy) < 88 && Math.abs(dx) < 58)
      if (bracket) pixels.set(accent, offset)
    }
  }
  return nativeImage.createFromBuffer(encodePng(pixels))
}
