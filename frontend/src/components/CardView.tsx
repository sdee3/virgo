import { useRef, useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { useCanvasRenderer } from "../hooks/useCanvasRenderer"
import { useCardInteraction } from "../hooks/useCardInteraction"
import { renderShareImage } from "../lib/renderShareImage"
import { shareReadingBlob, ShareDismissedError } from "../lib/shareReading"
import { ShareIcon } from "./ShareIcon"

interface CardViewProps {
  chromeActionsSlot: HTMLElement | null
  cardFile: string
  cardName: string
  isReversed: boolean
  isDrawing: boolean
  isSummarizing: boolean
  summary: string | null
  summaryError: string | null
  remaining: number | null
  onDrawCard: () => void
  onCardReady: () => void
  hideDrawAnother?: boolean
}

export function CardView({
  chromeActionsSlot,
  cardFile,
  cardName,
  isReversed,
  isDrawing,
  isSummarizing,
  summary,
  summaryError,
  remaining,
  onDrawCard,
  onCardReady,
  hideDrawAnother = false,
}: CardViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const isReversedRef = useRef(isReversed)
  isReversedRef.current = isReversed

  const [isSharing, setIsSharing] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  const { isDragging, isHovered, glossPosRef, handlePointerEnter, handlePointerLeave, handlePointerMove, handlePointerDown, resetRotation } = useCardInteraction(
    canvasRef,
    isReversedRef
  )
  const showGlossy = isHovered || isDragging
  const renderCanvas = useCanvasRenderer(canvasRef, imageRef, showGlossy, glossPosRef)

  const canShare = Boolean(summary) && !isSummarizing

  const handleShare = useCallback(async () => {
    const img = imageRef.current
    if (!img || !summary) return

    setIsSharing(true)
    setShareError(null)

    try {
      const blob = await renderShareImage({
        image: img,
        cardName,
        summary,
        isReversed,
      })
      await shareReadingBlob(blob)
    } catch (err) {
      if (err instanceof ShareDismissedError) {
        return
      }
      setShareError("Could not share your reading. Please try again.")
    } finally {
      setIsSharing(false)
    }
  }, [cardName, summary, isReversed])

  useEffect(() => {
    if (!cardFile) return
    const onResize = () => renderCanvas()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [cardFile, renderCanvas])

  useEffect(() => {
    if (!cardFile) return
    resetRotation()
    setShareError(null)
  }, [cardFile, resetRotation])

  useEffect(() => {
    if (!cardFile) return
    const img = new window.Image()
    img.onload = () => {
      imageRef.current = img
      onCardReady()
      requestAnimationFrame(() => renderCanvas())
    }
    img.src = `/cards/${cardFile}`
  }, [cardFile, onCardReady, renderCanvas])

  const shareButton =
    canShare && chromeActionsSlot
      ? createPortal(
          <button
            type="button"
            className={`chrome-btn share-btn${isSharing ? " share-btn--busy" : ""}`}
            onClick={handleShare}
            disabled={isSharing}
            aria-label={isSharing ? "Sharing reading" : "Share reading"}
          >
            <ShareIcon />
          </button>,
          chromeActionsSlot
        )
      : null

  return (
    <>
      {shareButton}
      <div className="card-area">
      <div
        className="card-wrapper"
        style={{ perspective: "1200px" }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
      >
        <canvas
          ref={canvasRef}
          className="card-canvas"
          style={{
            cursor: isDragging ? "grabbing" : "grab",
            touchAction: "none",
          }}
        />
      </div>
      <div className="card-text">
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
            disabled={isDrawing}
          >
            {isDrawing ? "Drawing..." : "Pull another card"}
          </button>
        )}
      </div>
      </div>
    </>
  )
}
