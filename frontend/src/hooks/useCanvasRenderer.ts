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

    const dpr = window.devicePixelRatio || 1
    const targetW = Math.min(window.innerWidth * 0.55, 320)
    const scale = targetW / img.naturalWidth
    const dims = getCardFrameDimensions(img, scale)

    // Backing store is sized in physical pixels (CSS size * DPR) so the card
    // stays crisp on high-DPR screens; the context is then scaled so all
    // drawing math below stays in CSS-pixel units.
    canvas.width = Math.round(dims.width * dpr)
    canvas.height = Math.round(dims.height * dpr)
    canvas.style.width = `${dims.width}px`
    canvas.style.height = `${dims.height}px`

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, dims.width, dims.height)

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
