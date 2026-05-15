import { useCallback, useRef, useEffect, type RefObject } from "react"

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

    const imageW = img.naturalWidth
    const imageH = img.naturalHeight

    const border = Math.round(8 / scale)
    const cr = Math.round(12 / scale)
    const shadowBlur = Math.round(28 / scale)

    canvas.width = imageW + border * 2
    canvas.height = imageH + border * 2
    canvas.style.width = `${canvas.width * scale}px`
    canvas.style.height = `${canvas.height * scale}px`

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const bw = canvas.width
    const bh = canvas.height

    ctx.save()
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)"
    ctx.shadowBlur = shadowBlur
    ctx.shadowOffsetY = Math.round(4 / scale)

    ctx.beginPath()
    ctx.moveTo(cr, 0)
    ctx.lineTo(bw - cr, 0)
    ctx.quadraticCurveTo(bw, 0, bw, cr)
    ctx.lineTo(bw, bh - cr)
    ctx.quadraticCurveTo(bw, bh, bw - cr, bh)
    ctx.lineTo(cr, bh)
    ctx.quadraticCurveTo(0, bh, 0, bh - cr)
    ctx.lineTo(0, cr)
    ctx.quadraticCurveTo(0, 0, cr, 0)
    ctx.closePath()

    ctx.fillStyle = "rgba(255, 255, 230, 0.92)"
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.beginPath()
    ctx.rect(border, border, imageW, imageH)
    ctx.clip()
    ctx.drawImage(img, border, border, imageW, imageH)

    const glossOpacity = glossOpacityRef.current
    if (glossOpacity > OPACITY_THRESHOLD) {
      const pos = glossPosRef.current
      const gx = border + pos.x * imageW
      const gy = border + pos.y * imageH
      const radius = Math.max(imageW, imageH) * 1.6

      ctx.save()
      ctx.beginPath()
      ctx.rect(border, border, imageW, imageH)
      ctx.clip()

      const gloss = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius)
      gloss.addColorStop(0, `rgba(255, 255, 255, ${0.09 * glossOpacity})`)
      gloss.addColorStop(0.3, `rgba(255, 255, 255, ${0.05 * glossOpacity})`)
      gloss.addColorStop(0.7, "rgba(255, 255, 255, 0)")
      gloss.addColorStop(1, "rgba(255, 255, 255, 0)")
      ctx.fillStyle = gloss
      ctx.fillRect(border, border, imageW, imageH)

      ctx.restore()
    }

    ctx.restore()
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
