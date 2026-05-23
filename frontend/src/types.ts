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
  cardName: string
  summary: string
  createdAt: number
}

export interface ReadingsResponse {
  readings: StoredReading[]
  error?: string
}
