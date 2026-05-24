export interface Card {
  file: string
  display: string
}

export interface SummaryResponse {
  summary: string
  remaining: number
  error?: string
}

export interface StoredReading {
  _id: string
  cardName: string
  summary: string
  drawnAt: number
}

export interface ReadingsResponse {
  readings: StoredReading[]
  hasMore: boolean
  error?: string
}
