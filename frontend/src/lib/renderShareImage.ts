import { drawCardFrame, getCardFrameDimensions } from "./drawCardFrame"

const WIDTH = 1080
const HEIGHT = 1920
const PADDING = 72
const TEXT_MAX_WIDTH = WIDTH - PADDING * 2
/** Target width of the tarot card in the share image. */
const CARD_TARGET_W = 460
const LOGO_TOP_OFFSET = 0
const FOOTER_GAP = 48
const HEADER_GAP = 112
const SUMMARY_GAP = 36

const COLORS = {
  background: "#0f1b2d",
  title: "#f6d365",
  cardName: "#e8d8a0",
  summary: "#c8ceda",
  footer: "#7a8ca8",
}

const FONTS = {
  title: '700 112px "Cormorant Unicase", "Palatino Linotype", serif',
  cardName: '600 italic 48px "Nunito", "Segoe UI", sans-serif',
  summary: '400 32px "Nunito", "Segoe UI", sans-serif',
  footer: '300 italic 32px "Nunito", "Segoe UI", sans-serif',
}

const LINE_HEIGHTS = {
  cardName: 58,
  summary: 42,
  footer: 40,
  footerUrl: 36,
}

function footerBlockHeight(): number {
  return LINE_HEIGHTS.footer + FOOTER_LINE_GAP + LINE_HEIGHTS.footerUrl
}

function footerBlessedY(): number {
  return HEIGHT - PADDING - footerBlockHeight()
}

/** Matches .title-btn { text-transform: uppercase } in App.css */
const LOGO_TEXT = "VIRGO"
const FOOTER_BLESSING = "blessed by the Creator of All That Is"
const FOOTER_URL = "https://virgo.sdee3.com"
const FOOTER_LINE_GAP = 10

export interface RenderShareImageInput {
  image: HTMLImageElement
  cardName: string
  summary: string
  isReversed: boolean
}

interface ShareLayout {
  cardScale: number
  cardW: number
  cardH: number
  nameLines: string[]
  summaryLines: string[]
  titleHeight: number
  nameHeight: number
}

export interface ShareLayoutMetrics {
  logoToCardGap: number
  cardToNameGap: number
  nameToSummaryGap: number
  summaryToFooterGap: number
  cardWidth: number
  cardHeight: number
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ""

  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }

  if (line) {
    lines.push(line)
  }

  return lines
}

function truncateWithEllipsis(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  maxLines: number,
  maxWidth: number
): string[] {
  if (lines.length <= maxLines) {
    return lines
  }

  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]

  while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
    last = last.slice(0, -1)
  }

  kept[maxLines - 1] = `${last}…`
  return kept
}

function drawWrappedLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number
): void {
  let y = startY
  for (const line of lines) {
    ctx.fillText(line, x, y)
    y += lineHeight
  }
}

function measureWrappedHeight(lineCount: number, lineHeight: number): number {
  return lineCount > 0 ? lineCount * lineHeight : 0
}

function measureTitleHeight(ctx: CanvasRenderingContext2D): number {
  ctx.font = FONTS.title
  const metrics = ctx.measureText(LOGO_TEXT)
  return Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent)
}

function largestFittingCardScale(image: HTMLImageElement, maxCardH: number): number {
  let lo = 0.4
  let hi = CARD_TARGET_W / image.naturalWidth

  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    const dims = getCardFrameDimensions(image, mid)
    if (dims.height <= maxCardH) {
      lo = mid
    } else {
      hi = mid
    }
  }

  return lo
}

function resolveCardScale(image: HTMLImageElement, maxCardH: number): number {
  const scaleByWidth = CARD_TARGET_W / image.naturalWidth
  const dimsAtTarget = getCardFrameDimensions(image, scaleByWidth)
  if (dimsAtTarget.height <= maxCardH) {
    return scaleByWidth
  }
  return largestFittingCardScale(image, maxCardH)
}

function computeShareLayout(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cardName: string,
  summary: string
): ShareLayout {
  const titleHeight = measureTitleHeight(ctx)

  ctx.font = FONTS.cardName
  const nameLines = wrapText(ctx, cardName, TEXT_MAX_WIDTH)
  const nameHeight = measureWrappedHeight(nameLines.length, LINE_HEIGHTS.cardName)

  const stackTop = PADDING + LOGO_TOP_OFFSET
  const footerTop = footerBlessedY()
  const stackBottom = footerTop - FOOTER_GAP

  const maxCardH =
    stackBottom - stackTop - titleHeight - nameHeight - 2 * HEADER_GAP - SUMMARY_GAP

  const cardScale = resolveCardScale(image, maxCardH)
  const frameDims = getCardFrameDimensions(image, cardScale)

  const summaryStartY =
    stackTop + titleHeight + HEADER_GAP + frameDims.height + HEADER_GAP + nameHeight + SUMMARY_GAP

  ctx.font = FONTS.summary
  const wrappedSummary = wrapText(ctx, summary, TEXT_MAX_WIDTH)
  const summaryMaxLines = Math.max(
    1,
    Math.floor((stackBottom - summaryStartY) / LINE_HEIGHTS.summary)
  )
  const summaryLines = truncateWithEllipsis(ctx, wrappedSummary, summaryMaxLines, TEXT_MAX_WIDTH)

  return {
    cardScale,
    cardW: frameDims.width,
    cardH: frameDims.height,
    nameLines,
    summaryLines,
    titleHeight,
    nameHeight,
  }
}

/** Measures rendered spacing for tests and debugging. */
export function getShareLayoutMetrics(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cardName: string,
  summary: string
): ShareLayoutMetrics {
  const layout = computeShareLayout(ctx, image, cardName, summary)
  const stackTop = PADDING + LOGO_TOP_OFFSET
  const footerTop = footerBlessedY()

  const logoBottom = stackTop + layout.titleHeight
  const cardTop = logoBottom + HEADER_GAP
  const cardBottom = cardTop + layout.cardH
  const nameTop = cardBottom + HEADER_GAP
  const nameBottom = nameTop + layout.nameHeight
  const summaryTop = nameBottom + SUMMARY_GAP
  const summaryBottom = summaryTop + layout.summaryLines.length * LINE_HEIGHTS.summary

  return {
    logoToCardGap: HEADER_GAP,
    cardToNameGap: HEADER_GAP,
    nameToSummaryGap: SUMMARY_GAP,
    summaryToFooterGap: footerTop - summaryBottom,
    cardWidth: layout.cardW,
    cardHeight: layout.cardH,
  }
}

export async function renderShareImage({
  image,
  cardName,
  summary,
  isReversed,
}: RenderShareImageInput): Promise<Blob> {
  await document.fonts.ready

  const canvas = document.createElement("canvas")
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Could not create share image canvas")
  }

  ctx.fillStyle = COLORS.background
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.textAlign = "center"
  ctx.textBaseline = "top"

  const layout = computeShareLayout(ctx, image, cardName, summary)
  const { cardScale, cardW, cardH } = layout

  let y = PADDING + LOGO_TOP_OFFSET

  ctx.fillStyle = COLORS.title
  ctx.font = FONTS.title
  ctx.fillText(LOGO_TEXT, WIDTH / 2, y)
  y += layout.titleHeight + HEADER_GAP

  const cardX = (WIDTH - cardW) / 2
  ctx.save()
  ctx.translate(cardX + cardW / 2, y + cardH / 2)
  if (isReversed) {
    ctx.rotate(Math.PI)
  }
  ctx.translate(-cardW / 2, -cardH / 2)
  drawCardFrame(ctx, image, { scale: cardScale })
  ctx.restore()
  y += cardH + HEADER_GAP

  ctx.fillStyle = COLORS.cardName
  ctx.font = FONTS.cardName
  drawWrappedLines(ctx, layout.nameLines, WIDTH / 2, y, LINE_HEIGHTS.cardName)
  y += layout.nameHeight + SUMMARY_GAP

  ctx.fillStyle = COLORS.summary
  ctx.font = FONTS.summary
  drawWrappedLines(ctx, layout.summaryLines, WIDTH / 2, y, LINE_HEIGHTS.summary)

  const footerY = footerBlessedY()
  ctx.fillStyle = COLORS.footer
  ctx.font = FONTS.footer
  ctx.fillText(FOOTER_BLESSING, WIDTH / 2, footerY)
  ctx.fillText(FOOTER_URL, WIDTH / 2, footerY + LINE_HEIGHTS.footer + FOOTER_LINE_GAP)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error("Failed to generate share image"))
        }
      },
      "image/png",
      1
    )
  })
}
