import { useRef, useEffect } from "react"
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
  remaining: number | null
  onDrawCard: () => void
  onCardReady: () => void
}

export function CardView({
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
}: CardViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const isReversedRef = useRef(isReversed)
  isReversedRef.current = isReversed

  const renderCanvas = useCanvasRenderer(canvasRef, imageRef)
  const { isDragging, handlePointerDown, resetRotation } = useCardInteraction(
    canvasRef,
    isReversedRef
  )

  useEffect(() => {
    if (!cardFile) return
    const onResize = () => renderCanvas()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [cardFile, renderCanvas])

  useEffect(() => {
    if (!cardFile) return
    resetRotation()
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

  return (
    <div className="card-area">
      <div
        className="card-wrapper"
        style={{ perspective: "1200px" }}
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
      <p className="card-name">{cardName}</p>
      {isSummarizing && (
        <p className="summary-loading">Consulting the cards...</p>
      )}
      {summary && <p className="summary">{summary}</p>}
      {summaryError && <p className="summary-error">{summaryError}</p>}
      {remaining !== null && remaining < 3 && (
        <p className="remaining">
          {remaining} reading{remaining !== 1 ? "s" : ""} remaining this hour
        </p>
      )}
      <button
        className="draw-btn again-btn"
        onClick={onDrawCard}
        disabled={isDrawing}
      >
        {isDrawing ? "Drawing..." : "Pull another card"}
      </button>
    </div>
  )
}
