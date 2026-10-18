import { useEffect, useRef, useState, type RefObject } from 'react'

export interface ElementSize {
  width: number
  height: number
}

/** Observes an element's box so viewports can be scaled to fit the canvas. */
export function useElementSize<T extends HTMLElement>(): {
  ref: RefObject<T | null>
  size: ElementSize
} {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height }
      )
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, size }
}
