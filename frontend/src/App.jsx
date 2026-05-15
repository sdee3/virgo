import { useState, useRef, useEffect, useCallback } from "react"
import "./App.css"

const SUITS = ["Cups", "Pentacles", "Swords", "Wands"]
const RANKS = [
  "Ace",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Page",
  "Knight",
  "Queen",
  "King",
]

const MAJOR_ARCANA = [
  ["00", "The Fool"],
  ["01", "The Magician"],
  ["02", "The High Priestess"],
  ["03", "The Empress"],
  ["04", "The Emperor"],
  ["05", "The Hierophant"],
  ["06", "The Lovers"],
  ["07", "The Chariot"],
  ["08", "Strength"],
  ["09", "The Hermit"],
  ["10", "Wheel of Fortune"],
  ["11", "Justice"],
  ["12", "The Hanged Man"],
  ["13", "Death"],
  ["14", "Temperance"],
  ["15", "The Devil"],
  ["16", "The Tower"],
  ["17", "The Star"],
  ["18", "The Moon"],
  ["19", "The Sun"],
  ["20", "Judgement"],
  ["21", "The World"],
]

function buildCardList() {
  const cards = []
  for (const [num, name] of MAJOR_ARCANA) {
    cards.push({
      file: `${num}-${name.replace(/\s+/g, "")}.png`,
      display: name,
    })
  }
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      const rankNum = String(i + 1).padStart(2, "0")
      cards.push({
        file: `${suit}${rankNum}.png`,
        display: `${RANKS[i]} of ${suit}`,
      })
    }
  }
  return cards
}

const CARDS = buildCardList()

function getCardName(file) {
  const card = CARDS.find((c) => c.file === file)
  return card ? card.display : file.replace(".png", "").replace(/^\d+-/, "")
}

const CONVEX_SITE_URL = "https://tangible-impala-518.convex.site"

export default function App() {
  const [cardFile, setCardFile] = useState(null)
  const [cardName, setCardName] = useState("")
  const [isDrawing, setIsDrawing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isReversed, setIsReversed] = useState(false)
  const [summary, setSummary] = useState(null)
  const [summaryError, setSummaryError] = useState(null)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [remaining, setRemaining] = useState(null)

  const canvasRef = useRef(null)
  const imageRef = useRef(null)
  const renderCanvasRef = useRef(null)

  const dragRotationRef = useRef({ x: 0, y: 0 })
  const swayRef = useRef(0)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const startTimeRef = useRef(0)
  const isReversedRef = useRef(false)

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext("2d")
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
  }, [])

  renderCanvasRef.current = renderCanvas

  const drawCard = useCallback(() => {
    setIsDrawing(true)
    setSummary(null)
    setSummaryError(null)
    setRemaining(null)
    const idx = Math.floor(Math.random() * CARDS.length)
    const card = CARDS[idx]
    const reversed = Math.random() < 0.5
    const name = reversed ? `Reversed ${card.display}` : card.display
    setCardFile(card.file)
    setCardName(name)
    setIsReversed(reversed)
    isReversedRef.current = reversed

    const img = new window.Image()
    img.onload = () => {
      imageRef.current = img
      setIsDrawing(false)
      requestAnimationFrame(() => renderCanvasRef.current())
    }
    img.src = `/cards/${card.file}`

    setIsSummarizing(true)
    fetch(`${CONVEX_SITE_URL}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardName: name }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setSummaryError(data.error)
        } else {
          setSummary(data.summary)
          setRemaining(data.remaining)
        }
      })
      .catch(() => {
        setSummaryError("Could not connect to the reading service.")
      })
      .finally(() => {
        setIsSummarizing(false)
      })
  }, [])

  useEffect(() => {
    if (!cardFile) return
    const rx = (Math.random() - 0.5) * 6
    const ry = (Math.random() - 0.5) * 6
    dragRotationRef.current = { x: rx, y: ry }
    swayRef.current = 0
    startTimeRef.current = Date.now()
  }, [cardFile])

  useEffect(() => {
    if (!cardFile) return
    const onResize = () => renderCanvasRef.current()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [cardFile])

  useEffect(() => {
    if (!cardFile) return

    let rafId

    const tick = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      swayRef.current = Math.sin(elapsed * 0.8) * 6

      const canvas = canvasRef.current
      if (canvas && canvas.isConnected) {
        const base = dragRotationRef.current
        const displayY = Math.max(-30, Math.min(30, base.y + swayRef.current))

        const rev = isReversedRef.current ? " rotate(180deg)" : ""
        canvas.style.transform = `translateZ(0) rotateX(${base.x}deg) rotateY(${displayY}deg)${rev}`
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [cardFile])

  const handlePointerDown = useCallback((e) => {
    isDraggingRef.current = true
    setIsDragging(true)
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDraggingRef.current) return

      const dx = e.clientX - lastPointerRef.current.x
      const dy = e.clientY - lastPointerRef.current.y
      lastPointerRef.current = { x: e.clientX, y: e.clientY }

      const rot = dragRotationRef.current
      dragRotationRef.current = {
        x: Math.max(-30, Math.min(30, rot.x + dy * 0.4)),
        y: Math.max(-30, Math.min(30, rot.y + dx * 0.4)),
      }
    }

    const handlePointerUp = () => {
      isDraggingRef.current = false
      setIsDragging(false)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerUp)
    }
  }, [])

  return (
    <div className="app">
      <h1 className="title">Virgo</h1>
      <p className="subtitle">What question is on your mind?</p>

      {!cardFile && (
        <button className="draw-btn" onClick={drawCard} disabled={isDrawing}>
          Pull a card
        </button>
      )}

      {cardFile && (
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
              {remaining} reading{remaining !== 1 ? "s" : ""} remaining this
              hour
            </p>
          )}
          <button
            className="draw-btn again-btn"
            onClick={drawCard}
            disabled={isDrawing}
          >
            {isDrawing ? "Drawing..." : "Pull another card"}
          </button>
        </div>
      )}

      <p className="blessing">blessed by the Creator of All That Is</p>
    </div>
  )
}
