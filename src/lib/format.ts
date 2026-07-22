export function formatMoney(n: number | string | null | undefined, symbol = "GH₵") {
  const v = Number(n ?? 0);
  return `${symbol} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
