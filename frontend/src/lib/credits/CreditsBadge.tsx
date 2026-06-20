import { useCreditsBalance } from "./react";

export function CreditsBadge() {
  const { balance, isLoading } = useCreditsBalance();

  if (isLoading || balance === undefined) {
    return null;
  }

  return (
    <span className="credits-badge" title="SDEE3 credits balance">
      {balance.toLocaleString()} credits
    </span>
  );
}
