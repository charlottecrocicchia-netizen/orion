import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import type { FormEvent } from "react";

import { Constellation } from "@/components/constellation";
import { Kpi } from "@/components/kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/hooks/use-count-up";
import { api } from "@/lib/api";
import { formatInt } from "@/lib/format";

const TOPIC_CHIPS = ["Hydrogen", "Artificial intelligence", "Batteries", "Quantum", "Carbon capture"];

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

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isPending } = useQuery({ queryKey: ["stats"], queryFn: api.stats });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    navigate(q ? `/projects?q=${encodeURIComponent(q)}` : "/projects");
  };

  const years = data?.funding_by_year ?? [];
  const from = years[0]?.year;
  const to = years[years.length - 1]?.year;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-6 pb-4 pt-14 text-center">
      <p className="mb-4 text-sm font-medium text-accent">{t("hero.eyebrow")}</p>
      {isPending ? (
        <Skeleton className="mx-auto h-28 w-[420px] max-w-full" />
      ) : (
        <HeroFigure value={data?.totals.funding_eur ?? null} />
      )}
      <p className="mt-3 text-lg text-muted-foreground">
        {from && to ? t("hero.sub", { from, to }) : " "}
      </p>

      <div className="mt-8 flex justify-center gap-11">
        <Kpi value={data?.totals.projects ?? null} label={t("hero.projects")} hero />
        <Kpi value={data?.totals.organisations ?? null} label={t("hero.organisations")} hero />
        <Kpi value={data?.totals.countries ?? null} label={t("hero.countries")} hero />
      </div>

      <div className="mt-7">
        {isPending ? (
          <Skeleton className="mx-auto h-40 w-full max-w-[1120px]" />
        ) : (
          <Constellation data={years} />
        )}
      </div>

      <form onSubmit={submit} role="search" className="mx-auto mt-8 max-w-[640px]">
        <div className="flex items-center gap-3 rounded-2xl border bg-background px-5 py-4 shadow-[0_12px_40px_rgba(29,29,31,.06)] focus-within:ring-2 focus-within:ring-accent dark:shadow-none">
          <span aria-hidden="true" className="text-muted-foreground">
            ⌕
          </span>
          <input
            name="q"
            type="search"
            placeholder={t("searchPlaceholder")}
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
      </form>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {TOPIC_CHIPS.map((chip) => (
          <Link
            key={chip}
            to={`/projects?q=${encodeURIComponent(chip.toLowerCase())}`}
            className="rounded-full bg-surface px-3.5 py-1.5 text-[13px] transition-colors hover:bg-accent-soft hover:text-accent"
          >
            {chip}
          </Link>
        ))}
      </div>

      <div className="mx-auto mt-14 grid max-w-[980px] gap-3 text-left sm:grid-cols-3">
        <Link to="/explore" className="lift rounded-2xl border border-accent/35 p-5 hover:border-accent">
          <div className="font-medium text-accent">{t("explore.openExplorer")}</div>
          <div className="mt-1 text-sm text-muted-foreground">{t("explore.openExplorerHint")}</div>
        </Link>
        <Link
          to="/explore/countries"
          className="lift rounded-2xl border p-5 hover:border-accent"
        >
          <div className="font-medium">{t("explore.countries")}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {formatInt(data?.totals.countries ?? null, "en")} {t("hero.countries")}
          </div>
        </Link>
        <Link
          to="/explore/programmes"
          className="lift rounded-2xl border p-5 hover:border-accent"
        >
          <div className="font-medium">{t("explore.programmes")}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Horizon Europe · H2020 · FP7 · ANR
          </div>
        </Link>
      </div>
    </div>
  );
}
