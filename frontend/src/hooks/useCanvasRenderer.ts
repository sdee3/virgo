import { useCallback, useRef, useEffect, type RefObject } from "react"
import { drawCardFrame, getCardFrameDimensions } from "../lib/drawCardFrame"

const LERP_SPEED = 0.12
const OPACITY_THRESHOLD = 0.005

export function useCanvasRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  imageRef: RefObject<HTMLImageElement | null>,
  showGlossy: boolean,
  glossPosRef: RefObject<{ x: number; y: number }>
) {
  const glossOpacityRef = useRef(0)

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const targetW = Math.min(window.innerWidth * 0.55, 320)
    const scale = targetW / img.naturalWidth
    const dims = getCardFrameDimensions(img, scale)

    canvas.width = dims.width
    canvas.height = dims.height
    canvas.style.width = `${dims.width}px`
    canvas.style.height = `${dims.height}px`

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    drawCardFrame(ctx, img, {
      scale,
      glossOpacity: glossOpacityRef.current,
      glossPos: glossPosRef.current,
    })
  }, [canvasRef, imageRef, glossPosRef])

  useEffect(() => {
    let rafId: number | null = null

    const tick = () => {
      const target = showGlossy ? 1 : 0
      const current = glossOpacityRef.current
      const next = current + (target - current) * LERP_SPEED

      if (Math.abs(next - target) < OPACITY_THRESHOLD * 2) {
        glossOpacityRef.current = target
      } else {
        glossOpacityRef.current = next
      }

      renderCanvas()

      const done = Math.abs(glossOpacityRef.current - target) < OPACITY_THRESHOLD
      if (done && target === 0) {
        rafId = null
        return
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [showGlossy, renderCanvas])

  return renderCanvas
}
