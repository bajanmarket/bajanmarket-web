// Shared formatting helpers for CI dashboards.
export function formatMoneyCents(cents: number | null | undefined, currency = "BBD") {
  if (cents == null) return "—";
  const value = cents / 100;
  return new Intl.NumberFormat("en-BB", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-BB").format(n);
}

export function formatPercent(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n}%`;
}
