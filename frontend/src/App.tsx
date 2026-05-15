import { useState, useRef, useCallback } from "react"
import { CARDS } from "./data/cards"
import { CONVEX_SITE_URL } from "./data/constants"
import { CardView } from "./components/CardView"
import type { SummaryResponse } from "./types"
import "./App.css"

export default function App() {
  const [cardFile, setCardFile] = useState<string | null>(null)
  const [cardName, setCardName] = useState("")
  const [isDrawing, setIsDrawing] = useState(false)
  const [isReversed, setIsReversed] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)

  const isReversedRef = useRef(false)

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

    setIsSummarizing(true)
    fetch(`${CONVEX_SITE_URL}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardName: name }),
    })
      .then(async (res) => {
        const data: SummaryResponse = await res.json()
        if (!res.ok) {
          setSummaryError(data.error || "Unknown error")
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

  const handleCardReady = useCallback(() => {
    setIsDrawing(false)
  }, [])

  return (
    <div className="app">
      {!cardFile ? (
        <div className="idle-content">
          <h1 className="title">Virgo</h1>
          <p className="subtitle">What question is on your mind?</p>
          <button className="draw-btn" onClick={drawCard} disabled={isDrawing}>
            Pull a card
          </button>
        </div>
      ) : (
        <>
          <h1 className="title">Virgo</h1>
          <CardView
            cardFile={cardFile}
            cardName={cardName}
            isReversed={isReversed}
            isDrawing={isDrawing}
            isSummarizing={isSummarizing}
            summary={summary}
            summaryError={summaryError}
            remaining={remaining}
            onDrawCard={drawCard}
            onCardReady={handleCardReady}
          />
        </>
      )}

      <p className="blessing">blessed by the Creator of All That Is</p>
    </div>
  )
}
