import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CARDS } from "../data/cards"
import { cardSrc } from "../lib/cardAsset"
import { drawCardFrame, getCardFrameDimensions } from "../lib/drawCardFrame"

const FAN_COUNT = 5
const MOBILE_MAX_WIDTH = 768
const MIN_HEIGHT = 600
const FAN_ROTATIONS = [-26, -13, 0, 13, 26]
const FAN_OFFSETS_X = [-72, -36, 0, 36, 72]
const VISIBLE_FRACTION = 0.8
const TUCKED_FRACTION = 1 - VISIBLE_FRACTION

function matchesFannedCardsViewport() {
  return (
    window.innerWidth <= MOBILE_MAX_WIDTH &&
    window.innerHeight > MIN_HEIGHT
  )
}

export function useShowFannedCards() {
  const [show, setShow] = useState(matchesFannedCardsViewport)
  useEffect(() => {
    const onResize = () => setShow(matchesFannedCardsViewport())
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return show
}

/** Max distance from bottom anchor to top of a rotated card. */
function rotatedReach(cardW: number, cardH: number, rotationDeg: number) {
  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const hw = cardW / 2
  let maxUp = 0
  for (const [x, y] of [
    [-hw, -cardH],
    [hw, -cardH],
    [-hw, 0],
    [hw, 0],
  ]) {
    const yRot = -x * sin + y * cos
    maxUp = Math.max(maxUp, -yRot)
  }
  return maxUp
}

function getFanReach(cardW: number, cardH: number) {
  return Math.max(
    ...FAN_ROTATIONS.map((deg) => rotatedReach(cardW, cardH, deg)),
  )
}

function pickRandomCards(count: number) {
  const picked: (typeof CARDS)[number][] = []
  const used = new Set<number>()
  while (picked.length < count) {
    const idx = Math.floor(Math.random() * CARDS.length)
    if (!used.has(idx)) {
      used.add(idx)
      picked.push(CARDS[idx])
    }
  }
  return picked
}

interface FannedCardProps {
  file: string
  rotation: number
  offsetX: number
  zIndex: number
  onDimensions: (width: number, height: number) => void
}

function FannedCard({
  file,
  rotation,
  offsetX,
  zIndex,
  onDimensions,
}: FannedCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img?.naturalWidth) return

    const dpr = window.devicePixelRatio || 1
    const targetW = Math.min(window.innerWidth * 0.38, 160)
    const scale = targetW / img.naturalWidth
    const dims = getCardFrameDimensions(img, scale)

    canvas.width = Math.round(dims.width * dpr)
    canvas.height = Math.round(dims.height * dpr)
    canvas.style.width = `${dims.width}px`
    canvas.style.height = `${dims.height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, dims.width, dims.height)
    drawCardFrame(ctx, img, { scale, glossOpacity: 0 })
    onDimensions(dims.width, dims.height)
  }, [onDimensions])

  useEffect(() => {
    const img = new window.Image()
    img.onload = () => {
      imageRef.current = img
      render()
    }
    img.src = cardSrc(file)
    return () => {
      imageRef.current = null
    }
  }, [file, render])

  useEffect(() => {
    window.addEventListener("resize", render)
    return () => window.removeEventListener("resize", render)
  }, [render])

  return (
    <canvas
      ref={canvasRef}
      className="fanned-cards__card"
      style={{
        zIndex,
        ["--fan-rotation" as string]: `${rotation}deg`,
        ["--fan-offset-x" as string]: `${offsetX}px`,
      }}
      aria-hidden="true"
    />
  )
}

export function FannedCards() {
  const show = useShowFannedCards()
  const cards = useMemo(() => pickRandomCards(FAN_COUNT), [])
  const [cardDims, setCardDims] = useState({ width: 0, height: 0 })

  const handleDimensions = useCallback((width: number, height: number) => {
    setCardDims((prev) => ({
      width: Math.max(prev.width, width),
      height: Math.max(prev.height, height),
    }))
  }, [])

  if (!show) return null

  const fanReach =
    cardDims.height > 0
      ? getFanReach(cardDims.width, cardDims.height)
      : 0
  const visibleHeight = fanReach > 0 ? fanReach * VISIBLE_FRACTION : 0

  return (
    <div
      className="fanned-cards"
      style={{
        height: visibleHeight > 0 ? `${visibleHeight}px` : 0,
      }}
      aria-hidden="true"
    >
      <div
        className="fanned-cards__fan"
        style={
          fanReach > 0 ? { bottom: `${-fanReach * TUCKED_FRACTION}px` } : undefined
        }
      >
        {cards.map((card, i) => (
          <FannedCard
            key={card.file}
            file={card.file}
            rotation={FAN_ROTATIONS[i]}
            offsetX={FAN_OFFSETS_X[i]}
            zIndex={i}
            onDimensions={handleDimensions}
          />
        ))}
      </div>
    </div>
  )
}
