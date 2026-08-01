export function formatCompactEur(value: number | null | undefined, locale: string): string {
  if (value == null) return "—";
  const abs = Math.abs(value);
  const fmt = (n: number, unit: string, digits: number) =>
    `€${n.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 })}${unit}`;
  if (abs >= 995e8) return fmt(value / 1e9, "B", 0);
  if (abs >= 1e9) return fmt(value / 1e9, "B", 1);
  if (abs >= 1e6) return fmt(value / 1e6, "M", 1);
  if (abs >= 1e3) return fmt(value / 1e3, "k", 0);
  return fmt(value, "", 0);
}

export function formatInt(value: number | null | undefined, locale: string): string {
  if (value == null) return "—";
  return value.toLocaleString(locale);
}

export function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

export function yearsRange(from: number | null, to: number | null): string {
  if (from == null && to == null) return "—";
  if (from != null && to != null) return from === to ? String(from) : `${from} – ${to}`;
  return String(from ?? to);
}
