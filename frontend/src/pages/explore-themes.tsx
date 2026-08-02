import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { ExplorePoint } from "@/lib/api";
import { formatCompactEur, themeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The themes index (site architecture §4.1) — the missing door: the 41
 *  euroSciVoc level-2 disciplines with their weight, their twenty-year
 *  spark and their before/after movement (the mature-windows convention
 *  shared with the watch-post and the dumbbell). Each row opens the
 *  Explorer pre-composed on that discipline's trajectory. Theme hubs
 *  stay a later phase; this page is the index that was missing. */

function matureDelta(points: ExplorePoint[], now: number): number | null {
  const mature = points
    .filter((point) => point.year <= now - 2 && point.value != null)
    .sort((a, b) => a.year - b.year);
  if (mature.length < 2) return null;
  const k = Math.min(3, Math.floor(mature.length / 2));
  const sum = (slice: ExplorePoint[]) =>
    slice.reduce((acc, point) => acc + (point.value ?? 0), 0);
  const before = sum(mature.slice(-2 * k, -k));
  const after = sum(mature.slice(-k));
  if (before <= 0) return after > 0 ? Number.POSITIVE_INFINITY : null;
  return ((after - before) / before) * 100;
}

function Spark({ points }: { points: ExplorePoint[] }) {
  const sorted = [...points].sort((a, b) => a.year - b.year);
  if (sorted.length < 2) return <span className="block h-[26px]" aria-hidden="true" />;
  const W = 132;
  const H = 26;
  const max = Math.max(...sorted.map((point) => point.value ?? 0), 1);
  const xs = (index: number) => (index * W) / (sorted.length - 1);
  const ys = (value: number) => H - 2 - (value / max) * (H - 5);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-[26px] w-[132px]" aria-hidden="true">
      <polyline
        points={sorted.map((point, index) => `${xs(index).toFixed(1)},${ys(point.value ?? 0).toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.4"
        strokeOpacity="0.7"
      />
    </svg>
  );
}

export function ExploreThemesPage() {
  const { t, i18n } = useTranslation();
  const [sort, setSort] = useState<"funding" | "delta">("funding");
  const { data, isPending } = useQuery({
    queryKey: ["themes-index"],
    queryFn: () =>
      api.explore(
        new URLSearchParams({ metric: "funding", by: "theme", split: "true", limit: "50" }),
      ),
  });
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.stats });

  const rows = useMemo(() => {
    const now = new Date().getFullYear();
    const corpus = stats?.totals.funding_eur ?? 0;
    const built = (data?.series ?? []).map((serie) => {
      const points = serie.points ?? [];
      const total = points.reduce((acc, point) => acc + (point.value ?? 0), 0);
      return {
        key: String(serie.key),
        label: themeLabel(String(serie.key), serie.label, t),
        points,
        total,
        share: corpus > 0 ? (100 * total) / corpus : null,
        delta: matureDelta(points, now),
      };
    });
    return built.sort((a, b) =>
      sort === "funding"
        ? b.total - a.total
        : (b.delta === Number.POSITIVE_INFINITY ? 1e9 : (b.delta ?? -1e9)) -
          (a.delta === Number.POSITIVE_INFINITY ? 1e9 : (a.delta ?? -1e9)),
    );
  }, [data, stats, sort, t]);

  const deltaText = (delta: number | null) =>
    delta == null
      ? "—"
      : delta === Number.POSITIVE_INFINITY
        ? t("explorer.deltaNew")
        : `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${Math.abs(Math.round(delta))} %`;

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 pt-12">
      <p className="text-sm font-medium text-accent">{t("explore.title")}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="display-tight text-[clamp(28px,4vw,40px)] font-semibold">
          {t("explore.themesTitle")}
        </h1>
        <div className="flex rounded-full bg-surface p-1 text-[12.5px]" role="group">
          {(["funding", "delta"] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={sort === candidate}
              onClick={() => setSort(candidate)}
              className={cn(
                "rounded-full px-3.5 py-1.5 transition-colors",
                sort === candidate
                  ? "border border-border bg-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(candidate === "funding" ? "explore.sortFunding" : "explore.sortDelta")}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 max-w-[62ch] text-[13.5px] text-muted-foreground">
        {t("explore.themesLead")} {t("explorer.multiTheme")}.
      </p>

      <div className="mt-8 pb-16">
        {isPending
          ? Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="mt-2.5 h-11 w-full" />
            ))
          : rows.map((row, index) => (
              <Link
                key={row.key}
                to={`/explore?by=theme&split=1&compare=${encodeURIComponent(row.key)}`}
                className="group grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-border-soft py-3 sm:grid-cols-[34px_minmax(0,1fr)_132px_72px_minmax(120px,auto)]"
              >
                <span
                  className={cn(
                    "display-tight tnum text-right text-[17px] font-semibold",
                    index === 0 ? "text-accent" : "text-muted-foreground/45",
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 text-[14.5px] leading-snug transition-colors group-hover:text-accent">
                  {row.label}
                </span>
                <span className="hidden sm:block">
                  <Spark points={row.points} />
                </span>
                <span
                  className={cn(
                    "tnum hidden text-right text-[13px] font-medium sm:block",
                    row.delta != null && row.delta < 0 ? "text-muted-foreground" : "text-accent",
                  )}
                >
                  {deltaText(row.delta)}
                </span>
                <span className="text-right">
                  <span className="display-tight tnum block whitespace-nowrap text-[15.5px] font-semibold">
                    {formatCompactEur(row.total, i18n.language)}
                  </span>
                  {row.share != null ? (
                    <span className="tnum block text-[11px] text-muted-foreground">
                      {t("explore.themesShare", {
                        pct: row.share.toLocaleString(i18n.language, {
                          maximumFractionDigits: row.share < 1 ? 1 : 0,
                        }),
                      })}
                    </span>
                  ) : null}
                </span>
              </Link>
            ))}
      </div>
    </div>
  );
}
