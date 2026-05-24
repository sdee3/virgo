import { CARDS } from "../data/cards"

export function parseCardName(cardName: string): {
  file: string
  reversed: boolean
} | null {
  const reversed = cardName.startsWith("Reversed ")
  const display = reversed ? cardName.slice("Reversed ".length) : cardName
  const card = CARDS.find((c) => c.display === display)
  if (!card) return null
  return { file: card.file, reversed }
}
