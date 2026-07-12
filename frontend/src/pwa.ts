import { registerSW } from "virtual:pwa-register"

declare const __BUILD_ID__: string

const BUILD_ID_URL = "/build-id.txt"

async function checkBuildId() {
  try {
    const response = await fetch(`${BUILD_ID_URL}?_=${Date.now()}`, {
      cache: "no-store",
    })
    if (!response.ok) return

    const remoteBuildId = (await response.text()).trim()
    if (remoteBuildId && remoteBuildId !== __BUILD_ID__) {
      location.reload()
    }
  } catch {
    // Ignore network errors — app requires connectivity anyway.
  }
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true)
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return
      void registration.update()
      void checkBuildId()
    })
  },
})

void checkBuildId()
