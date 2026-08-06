/** Tarot card image aspect ratio (width / height). */
const CARD_IMAGE_ASPECT = 300 / 527

const FRAME_BORDER_TOTAL = 16
const MOBILE_LAYOUT_MAX_WIDTH = 768
const MAX_CARD_WIDTH = 320

export function getCardTargetWidth(): number {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const fromWidth = Math.min(vw * 0.55, MAX_CARD_WIDTH)

  if (vw > MOBILE_LAYOUT_MAX_WIDTH) {
    return fromWidth
  }

  // Mobile column layout: reserve space for toolbar, title, and text below.
  const chromeHeight = vh <= 750 ? 280 : 220
  const maxFrameHeight = Math.max(vh - chromeHeight, vh * 0.48)
  const fromHeight = (maxFrameHeight - FRAME_BORDER_TOTAL) * CARD_IMAGE_ASPECT

  return Math.min(fromWidth, fromHeight)
}
