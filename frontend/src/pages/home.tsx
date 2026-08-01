import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import type { FormEvent } from "react";

import { Constellation } from "@/components/constellation";
import { Kpi } from "@/components/kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/hooks/use-count-up";
import { api } from "@/lib/api";
import type { ExploreResponse } from "@/lib/api";
import { parseIntent } from "@/lib/intent";
import { formatInt, themeLabel } from "@/lib/format";

/** The home leads with the hero — the founder's call: the big number seizes
 *  first, the paths offer themselves below the fold. The orientation hall
 *  (question, doors, momentum) follows on scroll, untouched pending the
 *  design brief in progress. */

function HeroFigure({ value }: { value: number | null }) {
  const { i18n } = useTranslation();
  const animated = useCountUp(value, 1000);
  const text =
    animated == null
      ? "—"
      : `€${(animated / 1e9).toLocaleString(i18n.language, { maximumFractionDigits: 0 })}B`;
  return (
    <div className="display-tight hero-gradient tnum text-[clamp(64px,9vw,112px)] font-semibold leading-none">
      {text}
    </div>
  );
}

function useIntentNavigate() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  return (text: string) => {
    const intent = parseIntent(text, i18n.language);
    if (!intent) return;
    navigate(`/${intent.to === "projects" ? "projects" : intent.to}?${intent.params}`);
  };
}

/* ——— The doors' miniatures — our own graphics as iconography ——— */

function MiniTreemap() {
  return (
    <svg viewBox="0 0 150 88" className="w-[150px]" aria-hidden="true">
      <rect width="86" height="88" rx="7" fill="var(--color-accent)" fillOpacity="0.85" />
      <rect x="90" width="60" height="42" rx="7" fill="var(--color-accent)" fillOpacity="0.55" />
      <rect x="90" y="46" width="60" height="42" rx="7" fill="var(--color-accent)" fillOpacity="0.3" />
      <text x="10" y="20" fontSize="9" fill="#fff" fontWeight="600">
        informatique
      </text>
      <text x="10" y="32" fontSize="8.5" fill="#fff" opacity="0.85" className="tnum">
        €27,5 Md
      </text>
    </svg>
  );
}

function MiniConstellation() {
  return (
    <svg viewBox="0 0 150 88" className="w-[150px]" aria-hidden="true">
      <line x1="75" y1="44" x2="26" y2="16" stroke="var(--color-border)" strokeWidth="2.4" />
      <line x1="75" y1="44" x2="124" y2="14" stroke="var(--color-border)" strokeWidth="1.6" />
      <line x1="75" y1="44" x2="132" y2="58" stroke="var(--color-border)" strokeWidth="1.2" />
      <line x1="75" y1="44" x2="38" y2="72" stroke="var(--color-border)" strokeWidth="2" />
      <circle cx="26" cy="16" r="5" fill="var(--color-foreground)" />
      <circle cx="124" cy="14" r="4" fill="var(--color-foreground)" />
      <circle cx="132" cy="58" r="3.4" fill="var(--color-foreground)" />
      <circle cx="38" cy="72" r="4.5" fill="var(--color-foreground)" />
      <circle cx="75" cy="44" r="6.5" fill="var(--color-accent)" />
    </svg>
  );
}

function MiniLines() {
  return (
    <svg viewBox="0 0 150 88" className="w-[150px]" aria-hidden="true">
      <polyline
        fill="none"
        stroke="var(--color-series-1)"
        strokeWidth="2.4"
        points="8,64 38,50 68,54 98,30 128,36 144,22"
      />
      <polyline
        fill="none"
        stroke="var(--color-series-2)"
        strokeWidth="1.9"
        points="8,70 38,62 68,42 98,48 128,52 144,44"
      />
      <circle cx="144" cy="22" r="3" fill="var(--color-series-1)" />
      <circle cx="144" cy="44" r="3" fill="var(--color-series-2)" />
    </svg>
  );
}

function MiniCalls() {
  return (
    <svg viewBox="0 0 150 88" className="w-[150px]" aria-hidden="true">
      <rect x="14" y="10" width="122" height="16" rx="8" fill="var(--color-surface)" />
      <rect x="14" y="34" width="98" height="16" rx="8" fill="var(--color-surface)" />
      <rect x="14" y="58" width="110" height="16" rx="8" fill="var(--color-surface)" />
      <circle cx="129" cy="42" r="3" fill="var(--color-series-2)" />
    </svg>
  );
}

/* ——— Momentum: three computed signals, each a reason to enter ——— */

function growthOf(series: ExploreResponse["series"][number]): number | null {
  const value = (year: number) =>
    (series.points ?? []).find((p) => p.year === year)?.value ?? 0;
  const recent = value(2022) + value(2023) + value(2024);
  const before = value(2019) + value(2020) + value(2021);
  if (before <= 0 || recent <= 0) return null;
  return Math.round(((recent - before) / before) * 100);
}

export function HomePage() {
  const { t, i18n } = useTranslation();
  const go = useIntentNavigate();
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const { data: themeTrend } = useQuery({
    queryKey: ["signal-themes"],
    queryFn: () =>
      api.explore(new URLSearchParams({ metric: "funding", by: "theme", split: "true", limit: "8" })),
  });
  const { data: hydrogen } = useQuery({
    queryKey: ["signal-hydrogen"],
    queryFn: () =>
      api.explore(
        new URLSearchParams({ metric: "projects", by: "programme", q: "hydrogen", limit: "3" }),
      ),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    go(String(new FormData(event.currentTarget).get("q") ?? ""));
  };

  const themeSignal = (() => {
    const ranked = (themeTrend?.series ?? [])
      .map((serie) => ({ serie, growth: growthOf(serie) }))
      .filter((entry) => entry.growth != null && entry.growth > 0)
      .sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0));
    return ranked[0] ?? null;
  })();
  const hydrogenSignal = hydrogen?.series[0] ?? null;
  const examples = [t("home.example1"), t("home.example2"), t("home.example3")];

  const years = stats?.funding_by_year ?? [];
  const from = years[0]?.year;
  const to = years[years.length - 1]?.year;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-6 pb-4 pt-14">
      {/* The hero — big and proud, as before */}
      <section className="text-center">
        <p className="mb-4 text-sm font-medium text-accent">{t("hero.eyebrow")}</p>
        {stats ? (
          <HeroFigure value={stats.totals.funding_eur} />
        ) : (
          <Skeleton className="mx-auto h-28 w-[420px] max-w-full" />
        )}
        <p className="mt-3 text-lg text-muted-foreground">
          {from && to ? t("hero.sub", { from, to }) : " "}
        </p>
        <div className="mt-8 flex justify-center gap-11">
          <Kpi value={stats?.totals.projects ?? null} label={t("hero.projects")} hero />
          <Kpi value={stats?.totals.organisations ?? null} label={t("hero.organisations")} hero />
          <Kpi value={stats?.totals.countries ?? null} label={t("hero.countries")} hero />
        </div>
        <div className="mt-7">
          {stats ? (
            <Constellation data={years} />
          ) : (
            <Skeleton className="mx-auto h-40 w-full max-w-[1120px]" />
          )}
        </div>
      </section>

      {/* Below the fold: the orientation (pending the coming design brief) */}
      <section className="mt-20 text-center">
        <h1 className="display-tight text-[clamp(30px,4.4vw,46px)] font-semibold">
          {t("home.ask")}
        </h1>
        <form onSubmit={submit} role="search" className="mx-auto mt-6 max-w-[660px]">
          <div className="flex items-center gap-3 rounded-2xl border bg-background px-5 py-4 shadow-[0_12px_40px_rgba(29,29,31,.06)] focus-within:ring-2 focus-within:ring-accent dark:shadow-none">
            <span aria-hidden="true" className="text-muted-foreground">
              ⌕
            </span>
            <input
              name="q"
              type="search"
              placeholder={t("home.freeTextPlaceholder")}
              className="w-full bg-transparent text-[17px] outline-none placeholder:text-muted-foreground"
            />
          </div>
        </form>
        <p className="mt-3.5 text-[13px] text-muted-foreground">
          {t("home.try")}{" "}
          {examples.map((example, index) => (
            <button
              key={example}
              type="button"
              onClick={() => go(example)}
              className={
                "text-accent underline-offset-2 hover:underline" + (index > 0 ? " ml-3" : " ml-1")
              }
            >
              {example}
            </button>
          ))}
        </p>
      </section>

      {/* The four doors — living miniatures of their destinations */}
      <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/explore?by=theme&split=0&limit=10" className="lift rounded-[20px] border p-5 hover:border-accent">
          <div className="flex h-[92px] items-center justify-center">
            <MiniTreemap />
          </div>
          <h2 className="mt-3.5 text-[16.5px] font-semibold">{t("home.doorTheme")}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {t("home.doorThemeDesc")}
          </p>
        </Link>
        <Link to="/organisations" className="lift rounded-[20px] border p-5 hover:border-accent">
          <div className="flex h-[92px] items-center justify-center">
            <MiniConstellation />
          </div>
          <h2 className="mt-3.5 text-[16.5px] font-semibold">{t("home.doorOrg")}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {t("home.doorOrgDesc")}
          </p>
        </Link>
        <Link to="/explore/countries" className="lift rounded-[20px] border p-5 hover:border-accent">
          <div className="flex h-[92px] items-center justify-center">
            <MiniLines />
          </div>
          <h2 className="mt-3.5 text-[16.5px] font-semibold">{t("home.doorCountries")}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {t("home.doorCountriesDesc")}
          </p>
        </Link>
        <div className="rounded-[20px] border border-dashed p-5" aria-disabled="true">
          <div className="flex h-[92px] items-center justify-center opacity-45">
            <MiniCalls />
          </div>
          <h2 className="mt-3.5 text-[16.5px] font-semibold">{t("home.doorCalls")}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {t("home.doorCallsDesc")}
          </p>
          <span className="mt-2.5 inline-block rounded-full bg-surface px-2.5 py-1 text-[11px] text-muted-foreground">
            {t("home.doorCallsBadge")}
          </span>
        </div>
      </section>

      {/* Right now: computed momentum, each signal opens the analysis */}
      <section className="mt-14">
        <h2 className="text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
          {t("home.now")}
        </h2>
        <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
          {themeSignal ? (
            <Link
              to={`/explore?by=theme&split=1&compare=${encodeURIComponent(String(themeSignal.serie.key))}`}
              className="flex items-baseline gap-4 rounded-r-[14px] border-l-[3px] border-series-3 bg-surface px-5 py-3.5 transition-colors hover:bg-accent-soft"
            >
              <span className="tnum whitespace-nowrap text-[18px] font-semibold text-series-3">
                ↑ {themeSignal.growth} %
              </span>
              <span className="text-[13.5px] leading-snug">
                {t("home.signalTheme", {
                  theme: themeLabel(String(themeSignal.serie.key), themeSignal.serie.label, t),
                })}
                <small className="block text-[11.5px] text-muted-foreground">
                  {t("home.signalThemeHint")}
                </small>
              </span>
            </Link>
          ) : (
            <Skeleton className="h-[68px] w-full" />
          )}
          {hydrogenSignal ? (
            <Link
              to="/explore?by=programme&q=hydrogen&view=treemap&limit=12"
              className="flex items-baseline gap-4 rounded-r-[14px] border-l-[3px] border-series-2 bg-surface px-5 py-3.5 transition-colors hover:bg-accent-soft"
            >
              <span className="tnum whitespace-nowrap text-[18px] font-semibold text-series-2">
                {formatInt(Number(hydrogenSignal.value ?? 0), i18n.language)}
              </span>
              <span className="text-[13.5px] leading-snug">
                {t("home.signalHydrogen", {
                  programme: hydrogenSignal.label ?? String(hydrogenSignal.key),
                })}
                <small className="block text-[11.5px] text-muted-foreground">
                  {t("home.signalHydrogenHint")}
                </small>
              </span>
            </Link>
          ) : (
            <Skeleton className="h-[68px] w-full" />
          )}
        </div>
      </section>
    </div>
  );
}
