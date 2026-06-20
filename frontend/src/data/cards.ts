import type { Card } from "../types"

const SUITS = ["Cups", "Pentacles", "Swords", "Wands"] as const

const RANKS = [
  "Ace",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Page",
  "Knight",
  "Queen",
  "King",
] as const

const MAJOR_ARCANA: [string, string][] = [
  ["00", "The Fool"],
  ["01", "The Magician"],
  ["02", "The High Priestess"],
  ["03", "The Empress"],
  ["04", "The Emperor"],
  ["05", "The Hierophant"],
  ["06", "The Lovers"],
  ["07", "The Chariot"],
  ["08", "Strength"],
  ["09", "The Hermit"],
  ["10", "Wheel of Fortune"],
  ["11", "Justice"],
  ["12", "The Hanged Man"],
  ["13", "Death"],
  ["14", "Temperance"],
  ["15", "The Devil"],
  ["16", "The Tower"],
  ["17", "The Star"],
  ["18", "The Moon"],
  ["19", "The Sun"],
  ["20", "Judgement"],
  ["21", "The World"],
]

function buildCardList(): Card[] {
  const cards: Card[] = []
  for (const [num, name] of MAJOR_ARCANA) {
    cards.push({
      file: `${num}-${name.replace(/\s+/g, "")}.webp`,
      display: name,
    })
  }
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      const rankNum = String(i + 1).padStart(2, "0")
      cards.push({
        file: `${suit}${rankNum}.webp`,
        display: `${RANKS[i]} of ${suit}`,
      })
    }
  }
  return cards
}

export const CARDS: Card[] = buildCardList()

export function getCardName(file: string): string {
  const card = CARDS.find((c) => c.file === file)
  return card ? card.display : file.replace(/\.\w+$/, "").replace(/^\d+-/, "")
}
