import { useState } from "react";
import type { ReactNode } from "react";
import { BackIcon } from "./BackIcon";
import { useIdentity } from "../lib/identityContext";
import { VIRGO_READING_CREDIT_COST } from "../lib/credits/constants";
import {
  useCreditsBalance,
  useCreditsCatalog,
  useCreditsLedger,
  useIdentityCreditsClient,
} from "../lib/credits/react";
import type { CreditPack, CreditPriceKey } from "../lib/credits/identityApi";

interface CreditsPageProps {
  onBack: () => void;
  toolbarEnd?: ReactNode;
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatLedgerReason(reason: string): string {
  if (reason.startsWith("stripe:")) return "Credit purchase";
  if (reason.startsWith("welcome:")) return "Welcome bonus";
  if (reason.includes("tarot") || reason.includes("summary")) {
    return "Tarot reading";
  }
  return reason;
}

function ProductCard({
  product,
  priceLabel,
  loading,
  onBuy,
}: {
  product: CreditPack;
  priceLabel: string;
  loading: boolean;
  onBuy: () => void;
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
  );
}

export function CreditsPage({ onBack, toolbarEnd }: CreditsPageProps) {
  const { isSignedIn, signIn } = useIdentity();
  const client = useIdentityCreditsClient();
  const { balance, isLoading: balanceLoading } = useCreditsBalance();
  const { catalog, isLoading: catalogLoading } = useCreditsCatalog();
  const { entries, isLoading: ledgerLoading, hasMore, loadMore } =
    useCreditsLedger();
  const [loadingKey, setLoadingKey] = useState<CreditPriceKey | "portal" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      return "Purchase complete — your balance will update shortly.";
    }
    if (params.get("checkout") === "cancelled") {
      return "Checkout was cancelled.";
    }
    return null;
  });

  const creditsAvailable = Boolean(client);
  const returnUrl = `${window.location.origin}${window.location.pathname}`;

  async function startCheckout(priceKey: CreditPriceKey) {
    if (!client) return;
    if (!isSignedIn) {
      signIn();
      return;
    }

    setLoadingKey(priceKey);
    setError(null);
    try {
      const { url } = await client.createCheckoutSession({
        priceKey,
        successUrl: `${returnUrl}?checkout=success`,
        cancelUrl: `${returnUrl}?checkout=cancelled`,
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoadingKey(null);
    }
  }

  async function openPortal() {
    if (!client) return;
    if (!isSignedIn) {
      signIn();
      return;
    }

    setLoadingKey("portal");
    setError(null);
    try {
      const { url } = await client.createBillingPortalSession({ returnUrl });
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not open billing portal",
      );
      setLoadingKey(null);
    }
  }

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

      <div className="credits-page__content">
        {!creditsAvailable ? (
          <p className="credits-page__notice">
            Credits are not configured for this environment.
          </p>
        ) : (
          <>
            <section className="credits-section credits-section--hero">
              <p className="credits-section__eyebrow">SDEE3 Credits</p>
              <p className="credits-section__lead">
                One balance works across Virgo and other SDEE3 apps.
              </p>
              {isSignedIn ? (
                <p className="credits-balance">
                  {balanceLoading || balance === undefined ? (
                    "Loading balance…"
                  ) : (
                    <>
                      Current balance:{" "}
                      <span className="credits-balance__amount">
                        {balance.toLocaleString()} credits
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
              <p className="credits-page__alert credits-page__alert--error">
                {error}
              </p>
            ) : null}

            {catalogLoading || catalog === undefined ? (
              <p className="credits-page__notice">Loading purchase options…</p>
            ) : (
              <>
                <section className="credits-section">
                  <h2 className="credits-section__heading">Monthly subscriptions</h2>
                  <div className="credits-products credits-products--grid">
                    {catalog.subscriptions.map((product) => (
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
                    {catalog.packs.map((product) => (
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
                      {loadingKey === "portal"
                        ? "Opening…"
                        : "Manage subscription"}
                    </button>
                  </div>
                ) : null}
              </>
            )}

            {isSignedIn ? (
              <section className="credits-section">
                <h2 className="credits-section__heading">Transaction history</h2>
                {ledgerLoading && entries.length === 0 ? (
                  <p className="credits-page__notice">Loading transactions…</p>
                ) : entries.length === 0 ? (
                  <p className="credits-page__notice">No transactions yet.</p>
                ) : (
                  <>
                    <ul className="credits-ledger">
                      {entries.map((entry) => (
                        <li key={entry._id} className="credits-ledger__item">
                          <div className="credits-ledger__main">
                            <span className="credits-ledger__reason">
                              {formatLedgerReason(entry.reason)}
                            </span>
                            <span className="credits-ledger__date">
                              {formatDate(entry.createdAt)}
                            </span>
                          </div>
                          <span
                            className={`credits-ledger__amount${
                              entry.amount >= 0
                                ? " credits-ledger__amount--credit"
                                : " credits-ledger__amount--debit"
                            }`}
                          >
                            {entry.amount >= 0 ? "+" : ""}
                            {entry.amount.toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {hasMore ? (
                      <button
                        type="button"
                        className="credits-page__load-more"
                        onClick={loadMore}
                        disabled={ledgerLoading}
                      >
                        {ledgerLoading ? "Loading…" : "Load more"}
                      </button>
                    ) : null}
                  </>
                )}
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
