const OPACITY_THRESHOLD = 0.005

/** Frame styling in output pixels — matches ~8px border at the 320px-wide on-site card. */
const FRAME_BORDER_PX = 8
const FRAME_CORNER_RADIUS_PX = 12
const FRAME_SHADOW_BLUR_PX = 28
const FRAME_SHADOW_OFFSET_Y_PX = 4

export interface CardFrameDimensions {
  imageW: number
  imageH: number
  border: number
  cr: number
  shadowBlur: number
  width: number
  height: number
}

export function getCardFrameDimensions(
  img: HTMLImageElement,
  scale: number
): CardFrameDimensions {
  const imageW = Math.round(img.naturalWidth * scale)
  const imageH = Math.round(img.naturalHeight * scale)
  const border = FRAME_BORDER_PX
  const cr = FRAME_CORNER_RADIUS_PX
  const shadowBlur = FRAME_SHADOW_BLUR_PX
  return {
    imageW,
    imageH,
    border,
    cr,
    shadowBlur,
    width: imageW + border * 2,
    height: imageH + border * 2,
  }
}

export interface DrawCardFrameOptions {
  scale: number
  glossOpacity?: number
  glossPos?: { x: number; y: number }
}

export interface DrawCardFrameAtSizeOptions {
  imageW: number
  imageH: number
  glossOpacity?: number
  glossPos?: { x: number; y: number }
}

function paintCardFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dims: CardFrameDimensions,
  glossOpacity: number,
  glossPos: { x: number; y: number }
): void {
  const { imageW, imageH, border, cr, shadowBlur, width: bw, height: bh } = dims

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  ctx.save()
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)"
  ctx.shadowBlur = shadowBlur
  ctx.shadowOffsetY = FRAME_SHADOW_OFFSET_Y_PX

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

  if (glossOpacity > OPACITY_THRESHOLD) {
    const gx = border + glossPos.x * imageW
    const gy = border + glossPos.y * imageH
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
}

export function frameDimensionsForImageSize(
  imageW: number,
  imageH: number
): CardFrameDimensions {
  const border = FRAME_BORDER_PX
  const cr = FRAME_CORNER_RADIUS_PX
  const shadowBlur = FRAME_SHADOW_BLUR_PX
  return {
    imageW,
    imageH,
    border,
    cr,
    shadowBlur,
    width: imageW + border * 2,
    height: imageH + border * 2,
  }
}

export function drawCardFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  options: DrawCardFrameOptions
): CardFrameDimensions {
  const { scale, glossOpacity = 0, glossPos = { x: 0.5, y: 0.5 } } = options
  const dims = getCardFrameDimensions(img, scale)
  paintCardFrame(ctx, img, dims, glossOpacity, glossPos)
  return dims
}

/** Draw a card face into a fixed image box (used to match front/back flip faces). */
export function drawCardFrameAtSize(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  options: DrawCardFrameAtSizeOptions
): CardFrameDimensions {
  const {
    imageW,
    imageH,
    glossOpacity = 0,
    glossPos = { x: 0.5, y: 0.5 },
  } = options
  const dims = frameDimensionsForImageSize(imageW, imageH)
  paintCardFrame(ctx, img, dims, glossOpacity, glossPos)
  return dims
}
