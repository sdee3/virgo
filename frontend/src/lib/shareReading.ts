const SHARE_FILENAME = "virgo-reading.png"

export class ShareDismissedError extends Error {
  constructor() {
    super("Share dismissed")
    this.name = "ShareDismissedError"
  }
}

function downloadBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = SHARE_FILENAME
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function shareReadingBlob(blob: Blob): Promise<void> {
  const file = new File([blob], SHARE_FILENAME, { type: "image/png" })

  if (typeof navigator.share === "function") {
    const shareData: ShareData = {
      files: [file],
      title: "Virgo reading",
    }

    if (navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData)
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          throw new ShareDismissedError()
        }
        throw err
      }
    }
  }

  downloadBlob(blob)
}
