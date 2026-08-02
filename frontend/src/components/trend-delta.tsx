import { cn } from "@/lib/utils";

/** Recent momentum beside an amount — the last three complete years against
 *  the three before, the same window as the home's momentum signals. The
 *  arrow carries the direction so color never stands alone (CVD-safe); a
 *  quiet period label keeps the claim honest. */
export function TrendDelta({
  series,
  className,
}: {
  series: { year: number; amount_eur: number }[];
  className?: string;
}) {
  const value = (year: number) => series.find((p) => p.year === year)?.amount_eur ?? 0;
  const recent = value(2022) + value(2023) + value(2024);
  const before = value(2019) + value(2020) + value(2021);
  if (before <= 0 || recent <= 0) {
    return (
      <span className={cn("tnum block text-[11px] text-muted-foreground/60", className)}>—</span>
    );
  }
  const growth = Math.round(((recent - before) / before) * 100);
  return (
    <span
      className={cn(
        "tnum block whitespace-nowrap text-[11px]",
        growth >= 0 ? "text-success" : "text-muted-foreground",
        className,
      )}
    >
      {growth >= 0 ? "↑" : "↓"} {Math.abs(growth)}&nbsp;%{" "}
      <span className="text-muted-foreground/70">2022-24</span>
    </span>
  );
}
