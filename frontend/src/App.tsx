import { useState, useRef, useCallback, useEffect } from "react"
import { CARDS } from "./data/cards"
import { fetchReadings, summarizeCard } from "./lib/api"
import { BackIcon } from "./components/BackIcon"
import { CardView } from "./components/CardView"
import { PastReadingsPage } from "./components/PastReadingsPage"
import { FannedCards, useShowFannedCards } from "./components/FannedCards"
import { UserMenu } from "./components/UserMenu"
import { parseCardName } from "./utils/parseCardName"
import type { StoredReading } from "./types"
import "./App.css"

type PageView = "home" | "past-readings"

const PAST_READINGS_PREVIEW = 3
const PAST_READINGS_FULL = 100

export default function App() {
  const [pageView, setPageView] = useState<PageView>("home")
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
      const limit = showAll ? PAST_READINGS_FULL : PAST_READINGS_PREVIEW
      const { readings, hasMore } = await fetchReadings(limit)
      setPastReadings(readings)
      setPastHasMore(hasMore)
    } catch {
      // Past readings are optional; fail silently.
    }
  }, [])

  useEffect(() => {
    const showAll = pageView === "past-readings" || showAllPastReadings
    void loadPastReadings(showAll)
  }, [pageView, showAllPastReadings, loadPastReadings])

  useEffect(() => {
    if (cardFile) {
      const showAll = pageView === "past-readings" || showAllPastReadings
      void loadPastReadings(showAll)
    }
  }, [cardFile, pageView, showAllPastReadings, loadPastReadings])

  useEffect(() => {
    if (!cardFile) {
      setChromeActionsSlot(null)
    }
  }, [cardFile])

  const drawCard = useCallback(() => {
    setPageView("home")
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
    setPageView("home")
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
    setPageView("home")
    setViewingPast(false)
    setCardFile(null)
    setCardName("")
    setSummary(null)
    setSummaryError(null)
    setRemaining(null)
  }, [])

  const openPastReadingsPage = useCallback(() => {
    setShowAllPastReadings(true)
    setPageView("past-readings")
    setCardFile(null)
    setCardName("")
    setSummary(null)
    setSummaryError(null)
    setRemaining(null)
    setViewingPast(false)
  }, [])

  const handleSeeMorePast = useCallback(() => {
    setShowAllPastReadings(true)
  }, [])

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

  const showPastReadingsPage = pageView === "past-readings" && !cardFile
  const isHomepage = !cardFile && pageView === "home"
  const showFannedCards = useShowFannedCards()
  const userMenu = <UserMenu onPastReading={openPastReadingsPage} />

  const blessing = (
    <p className="blessing">blessed by the Creator of All That Is</p>
  )

  return (
    <div
      className={`app${!isHomepage ? " app--reading" : ""}${isHomepage ? " app--idle" : ""}${isHomepage && showFannedCards ? " app--fanned" : ""}`}
    >
      {isHomepage && <div className="app-topbar">{userMenu}</div>}

      {showPastReadingsPage ? (
        <PastReadingsPage
          readings={pastReadings}
          hasMore={pastHasMore}
          showAll={showAllPastReadings}
          onBack={backToHome}
          onSelect={openPastReading}
          onSeeMore={handleSeeMorePast}
          toolbarEnd={userMenu}
        />
      ) : !cardFile ? (
        <>
          <div className="idle-content">
            {appTitle}
            <p className="subtitle">What question is on your mind?</p>
            <button className="draw-btn" onClick={drawCard} disabled={isDrawing}>
              Pull a card
            </button>
          </div>
          {showFannedCards ? (
            <div className="idle-footer">
              {blessing}
              <FannedCards />
            </div>
          ) : (
            blessing
          )}
        </>
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
          </div>
        </>
      )}

      {!isHomepage && blessing}
    </div>
  )
}
