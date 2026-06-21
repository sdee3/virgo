import { useAuth } from "@clerk/react"
import { useQuery } from "convex/react"
import {
  identityApi,
  IdentityConvexScope,
  identityConvex,
  identityCreditsEnabled,
  useIdentityUserReady,
} from "../identitySetup"

function CreditsBadgeInner() {
  const { isSignedIn } = useAuth()
  const identityReady = useIdentityUserReady()
  const balance = useQuery(
    identityApi.credits.queries.getBalance,
    isSignedIn && identityReady ? {} : "skip",
  )

  if (!isSignedIn || balance === undefined) {
    return null
  }

  return (
    <span className="credits-badge" title="SDEE3 credits balance">
      {balance.balance.toLocaleString()} credits
    </span>
  )
}

export function CreditsBadge() {
  if (!identityCreditsEnabled) {
    return null
  }

  return (
    <IdentityConvexScope identityConvex={identityConvex}>
      <CreditsBadgeInner />
    </IdentityConvexScope>
  )
}
