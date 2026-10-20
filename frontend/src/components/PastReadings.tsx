import { formatDrawnAt } from "../utils/formatDrawnAt"
import type { StoredReading } from "../types"

interface PastReadingsProps {
  readings: StoredReading[]
  hasMore: boolean
  isLoadingMore: boolean
  onSelect: (reading: StoredReading) => void
  onSeeMore: () => void
  hideTitle?: boolean
}

export function PastReadings({
  readings,
  hasMore,
  isLoadingMore,
  onSelect,
  onSeeMore,
  hideTitle = false,
}: PastReadingsProps) {
  if (readings.length === 0) return null

  return (
    <section className="past-readings">
      {!hideTitle && <h2 className="past-readings-title">Past Readings</h2>}
      <ul className="past-readings-list">
        {readings.map((reading) => (
          <li key={reading._id}>
            <button
              type="button"
              className="past-reading-item"
              onClick={() => onSelect(reading)}
            >
              {formatDrawnAt(reading.drawnAt)}
            </button>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          className="past-readings-more"
          onClick={onSeeMore}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? "Loading…" : "See More"}
        </button>
      )}
    </section>
  )
}
