import { useState, useRef, useCallback, useEffect } from "react"
import { CARDS } from "./data/cards"
import { fetchReadings, summarizeCard } from "./lib/api"
import { BackIcon } from "./components/BackIcon"
import { CardView } from "./components/CardView"
import { PastReadings } from "./components/PastReadings"
import { parseCardName } from "./utils/parseCardName"
import type { StoredReading } from "./types"
import "./App.css"

const PAST_READINGS_PREVIEW = 3

export default function App() {
  const [cardFile, setCardFile] = useState<string | null>(null)
  const [cardName, setCardName] = useState("")
  const [isDrawing, setIsDrawing] = useState(false)
  const [isReversed, setIsReversed] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [viewingPast, setViewingPast] = useState(false)

  const [pastReadings, setPastReadings] = useState<StoredReading[]>([])
  const [pastHasMore, setPastHasMore] = useState(false)
  const [showAllPastReadings, setShowAllPastReadings] = useState(false)
  const [chromeActionsSlot, setChromeActionsSlot] = useState<HTMLElement | null>(null)

  const isReversedRef = useRef(false)
  const drawnAtRef = useRef<number>(0)

  const loadPastReadings = useCallback(async (showAll: boolean) => {
    try {
      const limit = showAll ? 100 : PAST_READINGS_PREVIEW
      const { readings, hasMore } = await fetchReadings(limit)
      setPastReadings(readings)
      setPastHasMore(hasMore)
    } catch {
      // Past readings are optional; fail silently on the homepage.
    }
  }, [])

  useEffect(() => {
    void loadPastReadings(showAllPastReadings)
  }, [showAllPastReadings, loadPastReadings])

  useEffect(() => {
    if (cardFile) {
      void loadPastReadings(showAllPastReadings)
    }
  }, [cardFile, showAllPastReadings, loadPastReadings])

  useEffect(() => {
    if (!cardFile) {
      setChromeActionsSlot(null)
    }
  }, [cardFile])

  const drawCard = useCallback(() => {
    setViewingPast(false)
    setIsDrawing(true)
    setSummary(null)
    setSummaryError(null)
    setRemaining(null)
    drawnAtRef.current = Date.now()
    const idx = Math.floor(Math.random() * CARDS.length)
    const card = CARDS[idx]
    const reversed = Math.random() < 0.5
    const name = reversed ? `Reversed ${card.display}` : card.display
    setCardFile(card.file)
    setCardName(name)
    setIsReversed(reversed)
    isReversedRef.current = reversed

    setIsSummarizing(true)
    summarizeCard(name, drawnAtRef.current)
      .then((data) => {
        setSummary(data.summary)
        setRemaining(data.remaining)
        void loadPastReadings(showAllPastReadings)
      })
      .catch((err: Error) => {
        setSummaryError(
          err.message || "Could not connect to the reading service.",
        )
      })
      .finally(() => {
        setIsSummarizing(false)
      })
  }, [loadPastReadings, showAllPastReadings])

  const handleCardReady = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const openPastReading = useCallback((reading: StoredReading) => {
    const parsed = parseCardName(reading.cardName)
    if (!parsed) return
    setViewingPast(true)
    setCardFile(parsed.file)
    setCardName(reading.cardName)
    setIsReversed(parsed.reversed)
    isReversedRef.current = parsed.reversed
    setSummary(reading.summary)
    setSummaryError(null)
    setRemaining(null)
    setIsDrawing(false)
    setIsSummarizing(false)
  }, [])

  const backToHome = useCallback(() => {
    setViewingPast(false)
    setCardFile(null)
    setCardName("")
    setSummary(null)
    setSummaryError(null)
    setRemaining(null)
  }, [])

  const handleSeeMorePast = useCallback(() => {
    setShowAllPastReadings(true)
  }, [])

  const pastReadingsSection = (
    <PastReadings
      readings={pastReadings}
      hasMore={pastHasMore}
      showAll={showAllPastReadings}
      onSelect={openPastReading}
      onSeeMore={handleSeeMorePast}
    />
  )

  const appTitle = (
    <h1 className="title">
      <button
        type="button"
        className="title-btn"
        onClick={backToHome}
        aria-label="Back to home"
      >
        Virgo
      </button>
    </h1>
  )

  return (
    <div className={`app${cardFile ? " app--reading" : ""}`}>
      {!cardFile ? (
        <div className="idle-content">
          {appTitle}
          <p className="subtitle">What question is on your mind?</p>
          <button className="draw-btn" onClick={drawCard} disabled={isDrawing}>
            Pull a card
          </button>
          {pastReadingsSection}
        </div>
      ) : (
        <>
          <header className="reading-chrome">
            <div className="reading-chrome__toolbar">
              <div className="reading-chrome__slot reading-chrome__slot--start">
                <button
                  type="button"
                  className="chrome-btn back-btn"
                  onClick={backToHome}
                  aria-label="Back to home"
                >
                  <BackIcon />
                </button>
              </div>
              <div className="reading-chrome__center">{appTitle}</div>
              <div
                className="reading-chrome__slot reading-chrome__slot--end"
                ref={setChromeActionsSlot}
              />
            </div>
          </header>
          <div className="reading-view">
            <CardView
              chromeActionsSlot={chromeActionsSlot}
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
              hideDrawAnother={viewingPast}
            />
            {pastReadingsSection}
          </div>
        </>
      )}

      <p className="blessing">blessed by the Creator of All That Is</p>
    </div>
  )
}
