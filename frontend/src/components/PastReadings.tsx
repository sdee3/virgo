import { formatDrawnAt } from "../utils/formatDrawnAt"
import type { StoredReading } from "../types"

interface PastReadingsProps {
  readings: StoredReading[]
  hasMore: boolean
  showAll: boolean
  onSelect: (reading: StoredReading) => void
  onSeeMore: () => void
}

export function PastReadings({
  readings,
  hasMore,
  showAll,
  onSelect,
  onSeeMore,
}: PastReadingsProps) {
  if (readings.length === 0) return null

  return (
    <section className="past-readings">
      <h2 className="past-readings-title">Past Readings</h2>
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
      {hasMore && !showAll && (
        <button type="button" className="past-readings-more" onClick={onSeeMore}>
          See More
        </button>
      )}
    </section>
  )
}
