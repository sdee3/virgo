import type { StoredReading } from "../types"

interface PreviousReadingsProps {
  readings: StoredReading[]
}

function formatWhen(createdAt: number): string {
  return new Date(createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function PreviousReadings({ readings }: PreviousReadingsProps) {
  if (readings.length === 0) return null

  return (
    <section className="previous-readings" aria-label="Your previous readings">
      <h2 className="previous-readings-title">Your previous readings</h2>
      <ul className="previous-readings-list">
        {readings.map((reading) => (
          <li
            key={`${reading.createdAt}-${reading.cardName}`}
            className="previous-reading-item"
          >
            <p className="previous-reading-card">{reading.cardName}</p>
            <p className="previous-reading-summary">{reading.summary}</p>
            <time
              className="previous-reading-time"
              dateTime={new Date(reading.createdAt).toISOString()}
            >
              {formatWhen(reading.createdAt)}
            </time>
          </li>
        ))}
      </ul>
    </section>
  )
}
