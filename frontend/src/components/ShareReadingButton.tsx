import { useCallback, useState } from "react"
import { cardSrc } from "../lib/cardAsset"
import { renderShareImage } from "../lib/renderShareImage"
import { shareReadingBlob, ShareDismissedError } from "../lib/shareReading"
import { ShareIcon } from "./ShareIcon"

interface ShareReadingButtonProps {
  cardFile: string
  cardName: string
  isReversed: boolean
  summary: string
  onShareError?: (message: string | null) => void
}

function loadCardImage(file: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Could not load card image"))
    img.src = cardSrc(file)
  })
}

export function ShareReadingButton({
  cardFile,
  cardName,
  isReversed,
  summary,
  onShareError,
}: ShareReadingButtonProps) {
  const [isSharing, setIsSharing] = useState(false)

  const handleShare = useCallback(async () => {
    setIsSharing(true)
    onShareError?.(null)

    try {
      const image = await loadCardImage(cardFile)
      const blob = await renderShareImage({
        image,
        cardName,
        summary,
        isReversed,
      })
      await shareReadingBlob(blob)
    } catch (err) {
      if (err instanceof ShareDismissedError) {
        return
      }
      onShareError?.("Could not share your reading. Please try again.")
    } finally {
      setIsSharing(false)
    }
  }, [cardFile, cardName, summary, isReversed, onShareError])

  return (
    <button
      type="button"
      className={`chrome-btn share-btn${isSharing ? " share-btn--busy" : ""}`}
      onClick={handleShare}
      disabled={isSharing}
      aria-label={isSharing ? "Sharing reading" : "Share reading"}
    >
      <ShareIcon />
    </button>
  )
}
