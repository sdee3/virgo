import { useRef, useEffect, useState, useCallback } from "react"
import { CARD_BACK_SRC, CARD_REVEAL_MS, cardSrc } from "../lib/cardAsset"
import {
  drawCardFrameAtSize,
  frameDimensionsForImageSize,
  getCardFrameDimensions,
} from "../lib/drawCardFrame"
import { useCanvasRenderer } from "../hooks/useCanvasRenderer"
import { useCardInteraction } from "../hooks/useCardInteraction"

interface CardViewProps {
  cardFile: string
  cardName: string
  isReversed: boolean
  isDrawing: boolean
  isSummarizing: boolean
  summary: string | null
  summaryError: string | null
  shareError?: string | null
  remaining: number | null
  onDrawCard: () => void
  onCardReady: () => void
  hideDrawAnother?: boolean
  /** When false, skip the draw-in / flip reveal (e.g. past readings). */
  animateReveal?: boolean
}

export function CardView({
  cardFile,
  cardName,
  isReversed,
  isDrawing,
  isSummarizing,
  summary,
  summaryError,
  shareError = null,
  remaining,
  onDrawCard,
  onCardReady,
  hideDrawAnother = false,
  animateReveal = true,
}: CardViewProps) {
  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const motionRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const backImageRef = useRef<HTMLImageElement | null>(null)

  const [isRevealing, setIsRevealing] = useState(animateReveal)
  const [faceSize, setFaceSize] = useState<{
    width: number
    height: number
  } | null>(null)
  const revealFinishedRef = useRef(false)

  const interactionEnabled = !isRevealing
  const {
    isDragging,
    isHovered,
    glossPosRef,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerMove,
    handlePointerDown,
    resetRotation,
  } = useCardInteraction(motionRef, interactionEnabled)
  const showGlossy = interactionEnabled && (isHovered || isDragging)
  const renderCanvas = useCanvasRenderer(
    frontCanvasRef,
    imageRef,
    showGlossy,
    glossPosRef
  )

  const renderBackFace = useCallback((imageW: number, imageH: number) => {
    const canvas = backCanvasRef.current
    const img = backImageRef.current
    if (!canvas || !img?.naturalWidth) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const dims = frameDimensionsForImageSize(imageW, imageH)

    canvas.width = Math.round(dims.width * dpr)
    canvas.height = Math.round(dims.height * dpr)
    canvas.style.width = `${dims.width}px`
    canvas.style.height = `${dims.height}px`

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, dims.width, dims.height)
    drawCardFrameAtSize(ctx, img, { imageW, imageH, glossOpacity: 0 })
    setFaceSize({ width: dims.width, height: dims.height })
  }, [])

  const finishReveal = useCallback(() => {
    if (revealFinishedRef.current) return
    revealFinishedRef.current = true
    setIsRevealing(false)
    resetRotation()
    onCardReady()
  }, [onCardReady, resetRotation])

  useEffect(() => {
    if (!cardFile) return
    const onResize = () => {
      renderCanvas()
      const front = imageRef.current
      if (!front?.naturalWidth) return
      const targetW = Math.min(window.innerWidth * 0.55, 320)
      const scale = targetW / front.naturalWidth
      const dims = getCardFrameDimensions(front, scale)
      renderBackFace(dims.imageW, dims.imageH)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [cardFile, renderCanvas, renderBackFace])

  useEffect(() => {
    revealFinishedRef.current = false
    setFaceSize(null)
    setIsRevealing(animateReveal)
    if (!animateReveal) {
      resetRotation()
    }
  }, [cardFile, animateReveal, resetRotation])

  useEffect(() => {
    if (!cardFile) return

    let cancelled = false
    let frontReady = false
    let backReady = false

    const tryStart = () => {
      if (cancelled || !frontReady || !backReady) return
      const front = imageRef.current
      if (!front?.naturalWidth) return

      const targetW = Math.min(window.innerWidth * 0.55, 320)
      const scale = targetW / front.naturalWidth
      const dims = getCardFrameDimensions(front, scale)
      renderBackFace(dims.imageW, dims.imageH)
      requestAnimationFrame(() => renderCanvas())

      if (!animateReveal) {
        finishReveal()
      }
    }

    const frontImg = new window.Image()
    frontImg.onload = () => {
      if (cancelled) return
      imageRef.current = frontImg
      frontReady = true
      tryStart()
    }
    frontImg.src = cardSrc(cardFile)

    const backImg = new window.Image()
    backImg.onload = () => {
      if (cancelled) return
      backImageRef.current = backImg
      backReady = true
      tryStart()
    }
    backImg.src = CARD_BACK_SRC

    return () => {
      cancelled = true
      imageRef.current = null
    }
  }, [
    cardFile,
    animateReveal,
    renderCanvas,
    renderBackFace,
    finishReveal,
  ])

  // Safety net if animationend is missed (tab backgrounded, etc.).
  useEffect(() => {
    if (!isRevealing || !faceSize) return
    const timeoutId = window.setTimeout(
      () => finishReveal(),
      CARD_REVEAL_MS + 150
    )
    return () => window.clearTimeout(timeoutId)
  }, [isRevealing, faceSize, finishReveal])

  const handleRevealEnd = useCallback(
    (event: React.AnimationEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return
      if (
        event.animationName !== "card-draw-in-desktop" &&
        event.animationName !== "card-draw-in-mobile"
      ) {
        return
      }
      finishReveal()
    },
    [finishReveal]
  )

  const playReveal = isRevealing && faceSize !== null

  return (
    <div className={`card-area${isRevealing ? " card-area--revealing" : ""}`}>
      <div
        className="card-wrapper"
        style={{ perspective: "1200px" }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
      >
        <div
          ref={motionRef}
          className={`card-motion${playReveal ? " card-motion--revealing" : ""}`}
          style={{
            ...(playReveal
              ? { animationDuration: `${CARD_REVEAL_MS}ms` }
              : undefined),
            visibility: faceSize ? "visible" : "hidden",
          }}
          onAnimationEnd={handleRevealEnd}
        >
          <div
            className="card-faces"
            style={
              faceSize
                ? { width: faceSize.width, height: faceSize.height }
                : undefined
            }
          >
            <canvas
              ref={backCanvasRef}
              className="card-canvas card-face card-face--back"
              aria-hidden="true"
            />
            <canvas
              ref={frontCanvasRef}
              className={`card-canvas card-face card-face--front${isReversed ? " card-face--reversed" : ""}`}
              style={{
                cursor: isRevealing
                  ? "default"
                  : isDragging
                    ? "grabbing"
                    : "grab",
                touchAction: "none",
              }}
            />
          </div>
        </div>
      </div>
      <div
        className={`card-text${isRevealing ? " card-text--hidden" : ""}`}
        aria-hidden={isRevealing}
      >
        <p className="card-name">{cardName}</p>
        {isSummarizing && (
          <p className="summary-loading">Consulting the cards...</p>
        )}
        {summary && <p className="summary">{summary}</p>}
        {summaryError && <p className="summary-error">{summaryError}</p>}
        {shareError && <p className="summary-error">{shareError}</p>}
        {remaining !== null && remaining < 3 && (
          <p className="remaining">
            {remaining} reading{remaining !== 1 ? "s" : ""} remaining this hour
          </p>
        )}
        {!hideDrawAnother && (
          <button
            className="draw-btn again-btn"
            onClick={onDrawCard}
            disabled={isDrawing || isRevealing}
          >
            {isDrawing || isRevealing ? "Drawing..." : "Pull another card"}
          </button>
        )}
      </div>
    </div>
  )
}
