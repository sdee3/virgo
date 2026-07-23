import { useState, useRef, useCallback, useEffect, type AnimationEvent } from "react"
import { useQuery } from "convex/react"
import { CARDS } from "./data/cards"
import { fetchReadings, summarizeCard } from "./lib/api"
import { BackIcon } from "./components/BackIcon"
import { CardView } from "./components/CardView"
import { ShareReadingButton } from "./components/ShareReadingButton"
import { CreditsPage } from "./components/CreditsPage"
import { PastReadingsPage } from "./components/PastReadingsPage"
import { FannedCards, useShowFannedCards } from "./components/FannedCards"
import { UserMenu } from "./components/UserMenu"
import { useIdentity } from "./lib/identityContext"
import { getAuthToken } from "./lib/authToken"
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
import { IDLE_EXIT_MS } from "./lib/cardAsset"
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
  const [shareError, setShareError] = useState<string | null>(null)
  const [idleExiting, setIdleExiting] = useState(false)

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
      setShareError(null)
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
      setIdleExiting(false)
      setSummary(null)
      setSummaryError(
        `Not enough credits. You need ${tarotCost.toLocaleString()} credits but have ${balance.balance.toLocaleString()}.`,
      )
      setRemaining(null)
      return
    }

    // From the idle homepage, keep the top chrome mounted so it can slide up
    // and fade out while the drawn card enters underneath.
    if (!cardFile) {
      setIdleExiting(true)
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
    void (async () => {
      if (identityCreditsEnabled && isSignedIn) {
        const token = await getAuthToken()
        if (!token) {
          setIsDrawing(false)
          setIsSummarizing(false)
          setSummaryError(
            "Sign-in is still loading. Please wait a moment and try again.",
          )
          return
        }
      }

      try {
        const data = await summarizeCard(name, drawnAtRef.current)
        setSummary(data.summary)
        setRemaining(data.remaining)
        void refreshCreditsBalance()
        void loadPastReadings(showAllPastReadings)
      } catch (err: unknown) {
        void refreshCreditsBalance()
        setSummaryError(
          err instanceof Error
            ? err.message
            : "Could not connect to the reading service.",
        )
      } finally {
        setIsSummarizing(false)
      }
    })()
  }, [
    balance,
    cardFile,
    isSignedIn,
    loadPastReadings,
    showAllPastReadings,
    tarotCost,
  ])

  const handleCardReady = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const handleIdleExitEnd = useCallback(
    (event: AnimationEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return
      if (event.animationName !== "idle-exit-up") return
      setIdleExiting(false)
    },
    []
  )

  useEffect(() => {
    if (!idleExiting) return
    const timeoutId = window.setTimeout(() => {
      setIdleExiting(false)
    }, IDLE_EXIT_MS + 100)
    return () => window.clearTimeout(timeoutId)
  }, [idleExiting])

  const openPastReading = useCallback((reading: StoredReading) => {
    const parsed = parseCardName(reading.cardName)
    if (!parsed) return
    setPageView("home")
    setViewingPast(true)
    setIdleExiting(false)
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
    setIdleExiting(false)
    setCardFile(null)
    setCardName("")
    setSummary(null)
    setSummaryError(null)
    setRemaining(null)
  }, [])

  const openPastReadingsPage = useCallback(() => {
    setShowAllPastReadings(true)
    setPageView("past-readings")
    setIdleExiting(false)
    setCardFile(null)
    setCardName("")
    setSummary(null)
    setSummaryError(null)
    setRemaining(null)
    setViewingPast(false)
  }, [])

  const openCreditsPage = useCallback(() => {
    setPageView("credits")
    setIdleExiting(false)
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
  const showIdleShell = isHomepage || idleExiting
  const showFannedCards = useShowFannedCards()
  const userMenu = (
    <UserMenu onPastReading={openPastReadingsPage} onCredits={openCreditsPage} />
  )

  const blessing = (
    <p className="blessing">blessed by the Creator of All That Is</p>
  )

  return (
    <div
      className={`app${!isHomepage ? " app--reading" : ""}${showIdleShell ? " app--idle" : ""}${showIdleShell && showFannedCards ? " app--fanned" : ""}${idleExiting ? " app--idle-exiting" : ""}`}
    >
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
      ) : (
        <>
          {showIdleShell && (
            <div
              className={`idle-shell${idleExiting ? " idle-shell--exiting" : ""}`}
            >
              <div
                className={`idle-top${idleExiting ? " idle-top--exiting" : ""}`}
                style={
                  idleExiting
                    ? { animationDuration: `${IDLE_EXIT_MS}ms` }
                    : undefined
                }
                onAnimationEnd={handleIdleExitEnd}
              >
                <header className="reading-chrome">
                  <div className="reading-chrome__toolbar">
                    <div className="reading-chrome__slot reading-chrome__slot--start" />
                    <div className="reading-chrome__center" />
                    <div className="reading-chrome__slot reading-chrome__slot--end">
                      {userMenu}
                    </div>
                  </div>
                </header>
                <div className="idle-content">
                  {appTitle}
                  <p className="subtitle">What question is on your mind?</p>
                  <button
                    className="draw-btn"
                    onClick={drawCard}
                    disabled={
                      isDrawing ||
                      idleExiting ||
                      (isSignedIn && !creditsKnown) ||
                      !hasEnoughCredits
                    }
                  >
                    Pull a card
                  </button>
                  {identityCreditsEnabled &&
                  isSignedIn &&
                  creditsKnown &&
                  !hasEnoughCredits ? (
                    <p className="subtitle subtitle--error">
                      Not enough credits for a reading (
                      {tarotCost.toLocaleString()} required).{" "}
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
              </div>
              {showFannedCards ? (
                <div
                  className={`idle-footer${idleExiting ? " idle-footer--exiting" : ""}`}
                  style={
                    idleExiting
                      ? { animationDuration: `${IDLE_EXIT_MS}ms` }
                      : undefined
                  }
                >
                  {blessing}
                  <FannedCards />
                </div>
              ) : (
                <div
                  className={idleExiting ? "idle-blessing--exiting" : undefined}
                  style={
                    idleExiting
                      ? { animationDuration: `${IDLE_EXIT_MS}ms` }
                      : undefined
                  }
                >
                  {blessing}
                </div>
              )}
            </div>
          )}

          {cardFile && (
            <>
              <header
                className={`reading-chrome${idleExiting ? " reading-chrome--enter" : ""}`}
              >
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
                  <div className="reading-chrome__slot reading-chrome__slot--end">
                    {summary && !isSummarizing ? (
                      <ShareReadingButton
                        cardFile={cardFile}
                        cardName={cardName}
                        isReversed={isReversed}
                        summary={summary}
                        onShareError={setShareError}
                      />
                    ) : null}
                  </div>
                </div>
              </header>
              <div className="reading-view">
                <CardView
                  cardFile={cardFile}
                  cardName={cardName}
                  isReversed={isReversed}
                  isDrawing={isDrawing}
                  isSummarizing={isSummarizing}
                  summary={summary}
                  summaryError={summaryError}
                  shareError={shareError}
                  remaining={remaining}
                  onDrawCard={drawCard}
                  onCardReady={handleCardReady}
                  hideDrawAnother={viewingPast}
                  animateReveal={!viewingPast}
                />
              </div>
            </>
          )}
        </>
      )}

      {!isHomepage && !idleExiting && blessing}
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
