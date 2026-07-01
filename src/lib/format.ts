export function formatBBD(price: number | string, currency = "BBD"): string {
  const n = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(n)) return `${currency} —`;
  return new Intl.NumberFormat("en-BB", {
    style: "currency",
    currency,
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export function formatRelative(dateIso: string): string {
  const now = Date.now();
  const then = new Date(dateIso).getTime();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(dateIso).toLocaleDateString("en-BB", { month: "short", day: "numeric" });
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
