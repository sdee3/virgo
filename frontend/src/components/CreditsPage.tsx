import { useAuth } from "@clerk/react"
import { useAction, useQuery } from "convex/react"
import { useState, type ReactNode } from "react"
import { BackIcon } from "./BackIcon"
import { useIdentity } from "../lib/identityContext"
import { VIRGO_READING_CREDIT_COST } from "../lib/credits/constants"
import {
  identityApi,
  type CreditPack,
  type CreditPriceKey,
} from "../lib/identity-api"
import {
  IdentityConvexScope,
  identityCreditsEnabled,
} from "../lib/identityConvex"
import { useIdentityUserReady } from "../lib/identityUserSync"

interface CreditsPageProps {
  onBack: () => void
  toolbarEnd?: ReactNode
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

function ProductCard({
  product,
  priceLabel,
  loading,
  onBuy,
}: {
  product: CreditPack
  priceLabel: string
  loading: boolean
  onBuy: () => void
}) {
  return (
    <div className="credits-product">
      <div className="credits-product__info">
        <div className="credits-product__title">{product.label}</div>
        <div className="credits-product__price">{priceLabel}</div>
        <div className="credits-product__description">{product.description}</div>
      </div>
      <button
        type="button"
        className="credits-product__buy"
        onClick={onBuy}
        disabled={loading}
      >
        {loading ? "Redirecting…" : "Buy"}
      </button>
    </div>
  )
}

export function CreditsPage({ onBack, toolbarEnd }: CreditsPageProps) {
  if (!identityCreditsEnabled) {
    return (
      <CreditsPageShell onBack={onBack} toolbarEnd={toolbarEnd}>
        <p className="credits-page__notice">
          Credits are not configured for this environment.
        </p>
      </CreditsPageShell>
    )
  }

  return (
    <IdentityConvexScope>
      <CreditsPageInner onBack={onBack} toolbarEnd={toolbarEnd} />
    </IdentityConvexScope>
  )
}

function CreditsPageShell({
  onBack,
  toolbarEnd,
  children,
}: CreditsPageProps & { children: ReactNode }) {
  return (
    <div className="credits-page">
      <header className="reading-chrome">
        <div className="reading-chrome__toolbar">
          <div className="reading-chrome__slot reading-chrome__slot--start">
            <button
              type="button"
              className="chrome-btn back-btn"
              onClick={onBack}
              aria-label="Back to home"
            >
              <BackIcon />
            </button>
          </div>
          <div className="reading-chrome__center">
            <h1 className="credits-page__title">Credits</h1>
          </div>
          <div className="reading-chrome__slot reading-chrome__slot--end">
            {toolbarEnd}
          </div>
        </div>
      </header>
      <div className="credits-page__content">{children}</div>
    </div>
  )
}

function CreditsPageInner({ onBack, toolbarEnd }: CreditsPageProps) {
  const { isSignedIn, signIn } = useIdentity()
  const { isSignedIn: clerkSignedIn } = useAuth()
  const identityReady = useIdentityUserReady()
  const catalog = useQuery(identityApi.credits.products.getCatalog, {})
  const balance = useQuery(
    identityApi.credits.queries.getBalance,
    clerkSignedIn && identityReady ? {} : "skip",
  )
  const createCheckout = useAction(
    identityApi.credits.stripeCheckout.createCheckoutSession,
  )
  const createPortal = useAction(
    identityApi.credits.stripeCheckout.createBillingPortalSession,
  )
  const [loadingKey, setLoadingKey] = useState<CreditPriceKey | "portal" | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("checkout") === "success") {
      return "Purchase complete — your balance will update shortly."
    }
    if (params.get("checkout") === "cancelled") {
      return "Checkout was cancelled."
    }
    return null
  })

  const returnUrl = `${window.location.origin}${window.location.pathname}`
  const products = catalog ?? {
    packs: [],
    subscriptions: [],
    actionCosts: { virgo_tarot_draw: VIRGO_READING_CREDIT_COST, debates_llm_response: 200 },
  }

  async function startCheckout(priceKey: CreditPriceKey) {
    if (!isSignedIn || !identityReady) {
      signIn()
      return
    }

    setLoadingKey(priceKey)
    setError(null)
    try {
      const { url } = await createCheckout({
        priceKey,
        successUrl: `${returnUrl}?checkout=success`,
        cancelUrl: `${returnUrl}?checkout=cancelled`,
      })
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed")
      setLoadingKey(null)
    }
  }

  async function openPortal() {
    if (!isSignedIn || !identityReady) {
      signIn()
      return
    }

    setLoadingKey("portal")
    setError(null)
    try {
      const { url } = await createPortal({ returnUrl })
      window.location.href = url
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not open billing portal",
      )
      setLoadingKey(null)
    }
  }

  return (
    <CreditsPageShell onBack={onBack} toolbarEnd={toolbarEnd}>
      <section className="credits-section credits-section--hero">
        <p className="credits-section__eyebrow">SDEE3 Credits</p>
        <p className="credits-section__lead">
          One balance works across Virgo and other SDEE3 apps.
        </p>
        {isSignedIn ? (
          <p className="credits-balance">
            {balance === undefined ? (
              "Loading balance…"
            ) : (
              <>
                Current balance:{" "}
                <span className="credits-balance__amount">
                  {balance.balance.toLocaleString()} credits
                </span>
              </>
            )}
          </p>
        ) : (
          <p className="credits-page__notice">
            <button
              type="button"
              className="credits-page__sign-in"
              onClick={signIn}
            >
              Sign in
            </button>{" "}
            to view your balance and purchase credits.
          </p>
        )}
      </section>

      <section className="credits-section credits-section--cost">
        <h2 className="credits-section__heading">Virgo reading cost</h2>
        <p className="credits-cost-indicator">
          Each tarot reading in Virgo uses{" "}
          <span className="credits-cost-indicator__amount">
            {VIRGO_READING_CREDIT_COST.toLocaleString()} credits
          </span>
          .
        </p>
      </section>

      {checkoutNotice ? (
        <p className="credits-page__alert credits-page__alert--info">
          {checkoutNotice}
        </p>
      ) : null}

      {error ? (
        <p className="credits-page__alert credits-page__alert--error">{error}</p>
      ) : null}

      <section className="credits-section">
        <h2 className="credits-section__heading">Monthly subscriptions</h2>
        <div className="credits-products credits-products--grid">
          {products.subscriptions.map((product) => (
            <ProductCard
              key={product.key}
              product={product}
              priceLabel={`${formatUsd(product.priceUsd)} / month`}
              loading={loadingKey === product.key}
              onBuy={() => void startCheckout(product.key)}
            />
          ))}
        </div>
      </section>

      <section className="credits-section">
        <h2 className="credits-section__heading">One-time purchase</h2>
        <div className="credits-products">
          {products.packs.map((product) => (
            <ProductCard
              key={product.key}
              product={product}
              priceLabel={formatUsd(product.priceUsd)}
              loading={loadingKey === product.key}
              onBuy={() => void startCheckout(product.key)}
            />
          ))}
        </div>
      </section>

      {isSignedIn ? (
        <div className="credits-page__portal">
          <button
            type="button"
            className="credits-page__portal-btn"
            onClick={() => void openPortal()}
            disabled={loadingKey === "portal"}
          >
            {loadingKey === "portal" ? "Opening…" : "Manage subscription"}
          </button>
        </div>
      ) : null}

      <section className="credits-section">
        <h2 className="credits-section__heading">Transaction history</h2>
        <p className="credits-page__notice">Coming soon</p>
      </section>
    </CreditsPageShell>
  )
}
