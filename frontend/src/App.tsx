import { useState, useRef, useCallback, useEffect } from "react"
import { useQuery } from "convex/react"
import { CARDS } from "./data/cards"
import { fetchReadings, summarizeCard } from "./lib/api"
import { BackIcon } from "./components/BackIcon"
import { CardView } from "./components/CardView"
import { CreditsPage } from "./components/CreditsPage"
import { PastReadingsPage } from "./components/PastReadingsPage"
import { FannedCards, useShowFannedCards } from "./components/FannedCards"
import { UserMenu } from "./components/UserMenu"
import { useIdentity } from "./lib/identityContext"
import { VIRGO_READING_CREDIT_COST } from "./lib/credits/constants"
import {
  identityApi,
  IdentityConvexScope,
  identityConvex,
  identityCreditsEnabled,
  refreshCreditsBalance,
  useIdentityUserReady,
} from "./lib/identitySetup"
import { parseCardName } from "./utils/parseCardName"
import type { StoredReading } from "./types"
import "./App.css"

type PageView = "home" | "past-readings" | "credits"

const PAST_READINGS_PREVIEW = 3
const PAST_READINGS_FULL = 100

function AppInner() {
  const { isSignedIn } = useIdentity()
  const identityReady = useIdentityUserReady()
  const balance = useQuery(
    identityApi.credits.queries.getBalance,
    identityCreditsEnabled && isSignedIn && identityReady ? {} : "skip",
  )
  const catalog = useQuery(
    identityApi.credits.products.getCatalog,
    identityCreditsEnabled ? {} : "skip",
  )
  const tarotCost =
    catalog?.actionCosts.virgo_tarot_draw ?? VIRGO_READING_CREDIT_COST
  const creditsKnown = !identityCreditsEnabled || !isSignedIn || balance !== undefined
  const hasEnoughCredits =
    !identityCreditsEnabled ||
    !isSignedIn ||
    balance === undefined ||
    balance.balance >= tarotCost
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
  }, [pageView, showAllPastReadings, loadPastReadings, isSignedIn])

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
    if (
      identityCreditsEnabled &&
      isSignedIn &&
      balance !== undefined &&
      balance.balance < tarotCost
    ) {
      setPageView("home")
      setViewingPast(false)
      setCardFile(null)
      setCardName("")
      setIsDrawing(false)
      setIsSummarizing(false)
      setSummary(null)
      setSummaryError(
        `Not enough credits. You need ${tarotCost.toLocaleString()} credits but have ${balance.balance.toLocaleString()}.`,
      )
      setRemaining(null)
      return
    }

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
        void refreshCreditsBalance()
        void loadPastReadings(showAllPastReadings)
      })
      .catch((err: Error) => {
        void refreshCreditsBalance()
        setSummaryError(
          err.message || "Could not connect to the reading service.",
        )
      })
      .finally(() => {
        setIsSummarizing(false)
      })
  }, [
    balance,
    isSignedIn,
    loadPastReadings,
    showAllPastReadings,
    tarotCost,
  ])

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

  const openCreditsPage = useCallback(() => {
    setPageView("credits")
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
  const showCreditsPage = pageView === "credits" && !cardFile
  const isHomepage = !cardFile && pageView === "home"
  const showFannedCards = useShowFannedCards()
  const userMenu = (
    <UserMenu onPastReading={openPastReadingsPage} onCredits={openCreditsPage} />
  )

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
      ) : showCreditsPage ? (
        <CreditsPage onBack={backToHome} toolbarEnd={userMenu} />
      ) : !cardFile ? (
        <>
          <div className="idle-content">
            {appTitle}
            <p className="subtitle">What question is on your mind?</p>
            <button
              className="draw-btn"
              onClick={drawCard}
              disabled={isDrawing || (isSignedIn && !creditsKnown) || !hasEnoughCredits}
            >
              Pull a card
            </button>
            {identityCreditsEnabled &&
            isSignedIn &&
            creditsKnown &&
            !hasEnoughCredits ? (
              <p className="subtitle subtitle--error">
                Not enough credits for a reading ({tarotCost.toLocaleString()}{" "}
                required).{" "}
                <button
                  type="button"
                  className="subtitle-link"
                  onClick={openCreditsPage}
                >
                  Top up credits
                </button>
              </p>
            ) : null}
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

export default function App() {
  if (identityCreditsEnabled) {
    return (
      <IdentityConvexScope identityConvex={identityConvex}>
        <AppInner />
      </IdentityConvexScope>
    )
  }

  return <AppInner />
}
