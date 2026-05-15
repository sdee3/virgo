import { useCallback, type RefObject } from "react"

export function useCanvasRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  imageRef: RefObject<HTMLImageElement | null>
) {
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
    const shadowBlur = Math.round(20 / scale)

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
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)"
    ctx.shadowBlur = shadowBlur

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
    ctx.restore()
  }, [canvasRef, imageRef])

  return renderCanvas
}
