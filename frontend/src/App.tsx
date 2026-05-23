import { useState, useRef, useCallback, useEffect } from "react"
import { CARDS } from "./data/cards"
import { CardView } from "./components/CardView"
import { PreviousReadings } from "./components/PreviousReadings"
import { fetchPreviousReadings, summarizeCard } from "./lib/api"
import type { StoredReading } from "./types"
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
  const [previousReadings, setPreviousReadings] = useState<StoredReading[]>([])

  const isReversedRef = useRef(false)

  const loadPreviousReadings = useCallback(() => {
    fetchPreviousReadings()
      .then((data) => setPreviousReadings(data.readings))
      .catch(() => setPreviousReadings([]))
  }, [])

  useEffect(() => {
    loadPreviousReadings()
  }, [loadPreviousReadings])

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
    summarizeCard(name)
      .then((data) => {
        setSummary(data.summary)
        setRemaining(data.remaining)
        loadPreviousReadings()
      })
      .catch((err: Error) => {
        setSummaryError(
          err.message || "Could not connect to the reading service.",
        )
      })
      .finally(() => {
        setIsSummarizing(false)
      })
  }, [loadPreviousReadings])

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
          <PreviousReadings readings={previousReadings} />
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
          <PreviousReadings readings={previousReadings} />
        </>
      )}

      <p className="blessing">blessed by the Creator of All That Is</p>
    </div>
  )
}
