import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const XOR_KEY = Uint8Array.from([
  0x6c, 0x65, 0x6e, 0x73, 0x2d, 0x66, 0x6f, 0x63, 0x75, 0x73, 0x2d, 0x32, 0x30, 0x32, 0x36
])

const ENCRYPTED_COPY =
  'F0caGlkKCkFPUXRdRRJQAxAAFw0SBwZVG0RWVFdYTAkLHV5ITU9XEUJWSRAMTjEGEkMNTxoaBg1UX0AWCR0eH0IUBg0SU2lXRn5TAhZOBEQSB0MBG0gSRF1ZABZOGllGGAIGU09HWV5CTAMBAQNGLBYHGkJBWUZPTAwdU0UJGEMQBUhASRJUCREaFl9GBg0BFl9UUVFTTAcLFEQIHE1VOEhXQBJfAhYeFk4SBg0SXw1ZVVdGTAYcFkwSBg0SXw1TXlYWBwALAw0HAUMQCkgSX0dCTAMBAQ0SBwZVF0hGUVtaH0tMXw8VBgQbEllHQlcUVkc5GlkOTwIFA19XU1tXGAwBHQFGPQIMU0xcVBJCBABON0gQIwYbAA1GVVNbTklMEkESTVlXP0hcQ0saTBEGFg0iChU5FkNBEF9XHwYBBwFGHwYQGERcVxJCBBcBBkoOTwJVEExfVUBXTAkLHV5EEg=='

const ENCRYPTED_MASCOT =
  'UBYYFA0eAg8bABAQWEZCHF9BXFoRGE0CQANdQlUZXlVeQwIVGQRXU1pbVEZeUUdcRx1ETwsQGkpaRA8UXlFeUQ0QBgYCMUJKDRAGTFVOQh9WT1JHQw8SQl1aCVhMGkABTUMUAURTHV5XDgACTg8qCg0GCgESRFpTTCELBWEDARBVHkxBU11CTltSF0gAHF1JH0RcVVNEKxcPF0QDARdVGkkPElBZCBxMU1VXUkFFUQ1LAQ8UXEdOCx9bTVJXU1QADRAHTltSAFkJH0MaFUtBVUYLTlVMU14SABNYEEJeX0ALTkZcF0lSDQVXXBMOQ0ZZHEUBFUsVChdIURwQEEFCAxVDEEIKABFIUQ4CVgUAWgBMXBNaQA8cHUhTQnVEDQEHFkMSUV8HEklbUV5xHgQKGkgIG0McFxAQV15ZG0dQT14SABNVHEtUQ1dCUUdeUQ0VGwwFXk5dXF1EUUdNRkgDDgdBUQ1BRF1GQQoeEk4PGxpIUQMHEh0IUBYaHF1GAAUTAEhGDRAHTkUdB0IWQgAaH0JADRAVWQALEklSTUMGB0JCHV1GDQYHB1RbTVNXXBMOH0BXCAwPH2oUDgccFkNGDg4ZCAAIABNaDAoHEEFXEFFOUUdYQw9GDBpIURsDEhJEUUdbRg9GCQoZHxAQRUBaREYJH0IRRkFaTRFCUUZeTAFTUWBVWkNGQHsAAn8OWUVdQHtUXUFVAFlAX1lTUUdNRkgDDgdBUQ1BREBZBwBDBEQCGwtIURgQEEFCHgoFFgAKBg0QEExCDRBEAxAAFw9JUV8WGl9RXFcWDx1TUR5TTUMWChAQAgIUTBdTUR5IWkFVFUReXA8UTwRdFhtVWkFaTRFRWUBVAABOEFVbTVtAUQ1RSQ8UXlVMU19bTVBbRg8SVltaAFhMUExVClVGRg8dDg5ECQYaU1VbTVFBUQ1LDRAEVUdOBEQCGwtIURoAEhJeCQwJG1lbTVVMUQ1ASA8UXlFMU0sPAw9IUVhAXBoVDgoKCgRETxABAUJZVQ8UT1xXFRsDW0FVAFlAX1lTQRIHF1kOUkFHXRgQHwwKHgANBw0eUkFGQQ8SSQ8UX1JMU1oPCxcdTg8HBhAWBAAHFEUSUkFAQA8SQkoLTlRWUQ0ABg8ZTg8RAAUHXFRdUQ0VGxEaGEgPEhEDCQAPFxlETxABAUJZVR9BBQEaGxBEXUFaTRFRWUBVAABOEFVbTVdMUQ1RSQ8UWV1MU19bTVpXU0tbXF4LTkZcF0lSDQVXXBMOU1tEDwkLU04eUkFBSg8SU0sLTlBWUQ0UUkFBUQ1UWV5aUUdNFk4ACgUTUQIMDFFfHgYCFg0FF15XRB8QEFFPUUdbSw9GHV5XQAMAEhJQBQkCTg9FWgYQEkkGEh0IUBUPB0VGC15XPhkLEAUEPVNeUxVXT1REUxoAEhJQBQkCTg8IAA0QUQ1BREBZBwBTUQ4DDAUQFUsQEEFCHgoFFgARBgcBGxAQAxAWHxEcHEYDQg8cHUhRUUILThcBBkMCTUxLT11TRFoWCFhMPh5VT1tAJRQGfQoBTF1bJRRSTUMGB19dW1cLTkZcF0lSDQVXU15GQl1dCUgZGkkSB15XRw8SQ0ZEAw4LXkEPAQYWEl0PEkBZGQsKUQJYUxMUB0USVA8UIVxWUx5eA1FbQQ0GHgoWWEtWUx9IXU5BXRUSAhwEQVdAQQ1SQVtYQQMAHQYYVEhaXRVLXU1HUxkcCB8EQlcUUQ0ABg8ZTg8RUQFTWlZbUQJYUwAcAU5eVRJVFFhMQRxETwAMTg8GCRAWHlhMQQNTTUMTGkFeDRAVDVYLRR5TTUxLT11TRFoWCFhMPhxST1tFHxwcBBIFQlROQANXT1JbRwABHgMWXUtaPxxST1tMHwADHgYbX0tfXh5IXk5EXRkSAxwHQVRAR1dETwUcH0EPEhEDCQAPFxlEQF1JXF5EVww='

const UNLOCK_CODE = 'focus-the-lens'

interface HiddenCopy {
  title: string
  body: string
  signature: string
  alt: string
}

interface Surprise {
  copy: HiddenCopy
  image: string
}

declare global {
  interface Window {
    __devlens_debug?: {
      unlock: (command: string) => boolean
    }
  }
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function decryptBytes(value: string): Uint8Array {
  const encrypted = decodeBase64(value)
  for (let index = 0; index < encrypted.length; index += 1) {
    encrypted[index] ^= XOR_KEY[index % XOR_KEY.length]
  }
  return encrypted
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function isHiddenCopy(value: unknown): value is HiddenCopy {
  if (!value || typeof value !== 'object') return false
  const copy = value as Record<string, unknown>
  return ['title', 'body', 'signature', 'alt'].every(
    (key) => typeof copy[key] === 'string' && copy[key].length > 0
  )
}

function openSurprise(): Surprise {
  const copy: unknown = JSON.parse(new TextDecoder().decode(decryptBytes(ENCRYPTED_COPY)))
  if (!isHiddenCopy(copy)) throw new Error('Malformed hidden payload')

  const mascot = decryptBytes(ENCRYPTED_MASCOT)
  return {
    copy,
    image: `data:image/svg+xml;base64,${encodeBase64(mascot)}`
  }
}

/**
 * A deliberately quiet developer-console surprise.
 *
 * The displayed copy and mascot artwork exist here only as XOR-encrypted Base64. The debug API
 * is non-enumerable, and the payload is decrypted only when the console command is accepted.
 */
export function DevToolsEasterEgg() {
  const [surprise, setSurprise] = useState<Surprise | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const debugApi = Object.freeze({
      unlock: (command: string): boolean => {
        if (command !== UNLOCK_CODE) {
          console.warn('[DevLens] The debug channel stayed locked.')
          return false
        }

        try {
          setSurprise(openSurprise())
          console.info('[DevLens] The debug channel is open.')
          return true
        } catch (error) {
          console.error('[DevLens] The hidden payload could not be decoded.', error)
          return false
        }
      }
    })

    Object.defineProperty(window, '__devlens_debug', {
      configurable: true,
      enumerable: false,
      value: debugApi
    })

    return () => {
      if (window.__devlens_debug === debugApi) delete window.__devlens_debug
    }
  }, [])

  useEffect(() => {
    if (!surprise) return
    closeButtonRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setSurprise(null)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [surprise])

  if (!surprise) return null

  return (
    <div
      className="devlens-easter-egg fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      onMouseDown={() => setSurprise(null)}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="devlens-hidden-message-title"
        data-testid="devlens-devtools-easter-egg"
        className="relative w-full max-w-[520px] overflow-hidden rounded-2xl border border-[var(--devlens-accent-line)] bg-[color-mix(in_srgb,var(--color-ink-950)_94%,var(--devlens-accent)_6%)] px-6 pb-6 pt-5 text-center shadow-[0_30px_90px_rgba(0,0,0,0.6)] sm:px-10 sm:pb-8 sm:pt-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--devlens-accent)]">
            DevTools channel
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close hidden developer message"
            onClick={() => setSurprise(null)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--devlens-hairline)] text-ink-400 transition-colors hover:border-[var(--devlens-accent-line)] hover:bg-white/5 hover:text-ink-100"
          >
            <X size={14} />
          </button>
        </div>

        <div className="mt-2 flex justify-center">
          <img
            src={surprise.image}
            alt={surprise.copy.alt}
            width={176}
            height={176}
            draggable={false}
            className="h-[176px] w-[176px] select-none drop-shadow-[0_16px_30px_rgba(45,212,191,0.22)]"
          />
        </div>

        <h2
          id="devlens-hidden-message-title"
          className="mx-auto mt-2 max-w-[390px] text-[22px] font-semibold leading-tight text-ink-100"
        >
          {surprise.copy.title}
        </h2>
        <p className="mx-auto mt-3 max-w-[410px] text-[12px] leading-6 text-ink-300">
          {surprise.copy.body}
        </p>
        <p className="mt-5 font-mono text-[10px] tracking-wide text-[var(--devlens-accent)]">
          {surprise.copy.signature}
        </p>
      </section>
    </div>
  )
}
