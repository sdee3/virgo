import type { ReactNode } from "react"
import { BackIcon } from "./BackIcon"
import { PastReadings } from "./PastReadings"
import type { StoredReading } from "../types"

interface PastReadingsPageProps {
  readings: StoredReading[]
  hasMore: boolean
  isLoadingMore: boolean
  onBack: () => void
  onSelect: (reading: StoredReading) => void
  onSeeMore: () => void
  toolbarEnd?: ReactNode
}

export function PastReadingsPage({
  readings,
  hasMore,
  isLoadingMore,
  onBack,
  onSelect,
  onSeeMore,
  toolbarEnd,
}: PastReadingsPageProps) {
  return (
    <div className="past-readings-page">
      <header className="reading-chrome">
        <div className="reading-chrome__toolbar">
          <div className="reading-chrome__slot reading-chrome__slot--start">
            <button
              type="button"
              className="chrome-btn back-btn"
              onClick={onBack}
              aria-label="Back to home"
            >
              <BackIcon />
            </button>
          </div>
          <div className="reading-chrome__center">
            <h1 className="past-readings-page__title">Past Readings</h1>
          </div>
          <div className="reading-chrome__slot reading-chrome__slot--end">
            {toolbarEnd}
          </div>
        </div>
      </header>
      <div className="past-readings-page__content">
        {readings.length === 0 ? (
          <p className="past-readings-page__empty">No past readings yet.</p>
        ) : (
          <PastReadings
            readings={readings}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onSelect={onSelect}
            onSeeMore={onSeeMore}
            hideTitle
          />
        )}
      </div>
    </div>
  )
}
