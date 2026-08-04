import { useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/lib/api";
import { countryFlag, formatCompactEur, formatInt, formatOrgName, themeLabel, useCountryName } from "@/lib/format";
import { isRegion, REGION_ORDER, regionColor } from "@/lib/regions";
import { Skeleton } from "@/components/ui/skeleton";
import { TrajectorySpark } from "@/components/trajectory-spark";
import { WorldMap } from "@/components/world-map";

/** The GROUP file (recette fondatrice, 2026-08-04) — the identity layer
 *  becomes a product surface, read in the acts grammar of the record
 *  pages: one consolidated view of every legal entity, then the world
 *  map of where the group lives (the charter vision: entities clickable
 *  one by one or by region).
 *
 *  Honesty carried from the backend: a co-signed project counts ONCE in
 *  the totals; shares are stated on the group's own total and may sum
 *  beyond 100 % — the page says so in the margin. */

function ActHeader({ index, title, phrase }: { index: string; title: string; phrase: string }) {
  return (
    <div className="mb-7">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">
        {index}
      </p>
      <h2 className="font-display mt-1.5 text-[clamp(21px,2.5vw,28px)] font-[560] tracking-[-0.02em]">
        {title}
      </h2>
      <p className="mt-1 max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">{phrase}</p>
    </div>
  );
}

export function GroupHubPage() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const countryName = useCountryName();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const { data: hub, isPending, isError } = useQuery({
    queryKey: ["group", id],
    queryFn: () => api.group(id),
  });

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-[980px] px-6 pt-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-8 h-24 w-full" />
        <Skeleton className="mt-8 h-72 w-full" />
      </div>
    );
  }
  if (isError || !hub) {
    return (
      <div className="mx-auto w-full max-w-[980px] px-6 pt-16">
        <p className="font-display text-[clamp(22px,2.6vw,30px)] font-[560]">
          {t("notFound.title")}
        </p>
        <Link to="/projects" className="mt-3 inline-block text-[14px] text-accent underline-offset-4 hover:underline">
          {t("notFound.back")}
        </Link>
      </div>
    );
  }

  const displayName = formatOrgName(hub.name);
  const trajectory = hub.trajectory.map((row) => ({ year: row.year, amount_eur: row.funding_eur }));
  // The map derives from the corpus the hub returned — never a hardcoded
  // list (the engraved rule applies to the group file too).
  const mapCountries = hub.countries.map((row) => ({
    code: row.code,
    name: countryName(row.code),
    eu_member: false,
    region: row.region,
    projects_count: row.entities,
    funding_eur: row.funding_eur,
  }));
  const presentRegions = REGION_ORDER.filter((slug) =>
    hub.countries.some((row) => row.region === slug),
  );
  const visibleEntities = hub.entities.filter((entity) => {
    if (selectedCountry) return entity.country === selectedCountry;
    if (selectedRegion) return entity.region === selectedRegion;
    return true;
  });

  const pickCountry = (code: string) => {
    setSelectedRegion(null);
    setSelectedCountry((current) => (current === code ? current : code));
  };
  const pickRegion = (slug: string | null) => {
    setSelectedCountry(null);
    setSelectedRegion(slug);
  };

  return (
    <div className="mx-auto w-full max-w-[980px] px-6 pt-12">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
        <span className="rounded-full border border-accent/50 bg-accent-soft px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-accent">
          {t("group.badge")}
        </span>
        <span>{t("group.headerLine", { count: hub.totals.entities })}</span>
        {hub.country ? <span>{countryFlag(hub.country)} {countryName(hub.country)}</span> : null}
        {hub.lei ? (
          <span className="font-mono normal-case tracking-normal">
            {t("group.lei")} {hub.lei}
          </span>
        ) : null}
      </p>

      <h1 className="display-tight mt-1.5 max-w-[26ch] text-[clamp(26px,3.6vw,38px)] font-semibold leading-tight">
        {displayName}
      </h1>

      {/* The record hero — the consolidated total as a display figure,
          its trajectory drawing itself on entry (doctrine step 4). */}
      <div className="mt-9 max-w-[680px]">
        <div className="font-display tnum text-[clamp(40px,5vw,58px)] font-[520] leading-none tracking-[-0.028em]">
          {formatCompactEur(hub.totals.funding_eur, i18n.language)}
        </div>
        <div className="mt-1.5 text-[13px] text-muted-foreground">{t("group.totalFunding")}</div>
        <div className="mt-6">
          <TrajectorySpark data={trajectory} />
        </div>
      </div>

      {/* Act 01 — the group as one: distinct-project totals and the
          themes the whole group works on. */}
      <section className="mt-16 border-t pt-10">
        <ActHeader
          index={`01 · ${t("group.actConsolidatedKicker")}`}
          title={t("group.actConsolidated")}
          phrase={t("group.actConsolidatedPhrase")}
        />
        <div className="grid gap-x-10 gap-y-5 sm:grid-cols-3">
          {(
            [
              [hub.totals.projects, t("group.statProjects")],
              [hub.totals.entities, t("group.statEntities")],
              [hub.totals.countries, t("group.statCountries")],
            ] as const
          ).map(([value, label]) => (
            <div key={label}>
              <span className="tnum font-display text-[clamp(22px,2.6vw,30px)] font-[560] tracking-[-0.02em]">
                {formatInt(value, i18n.language)}
              </span>
              <p className="mt-1 text-[13px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        {hub.themes.length > 0 ? (
          <div className="mt-9">
            <p className="text-[13px] font-medium text-muted-foreground">{t("group.themesTitle")}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {hub.themes.map((theme) => (
                <li
                  key={theme.key}
                  className="rounded-full border px-3 py-1 text-[13px] text-foreground/85"
                >
                  {themeLabel(theme.key, theme.label, t)}
                  <span className="tnum ml-2 text-[12px] text-muted-foreground">
                    {formatInt(theme.projects, i18n.language)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Act 02 — where the group lives: its entities on the world map,
          readable one by one or by region (the charter vision). */}
      <section className="mt-16 border-t pt-10">
        <ActHeader
          index={`02 · ${t("group.actMapKicker")}`}
          title={t("group.actMap")}
          phrase={t("group.actMapPhrase")}
        />

        {hub.entities.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">{t("group.empty")}</p>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label={t("group.actMapKicker")}>
              <button
                type="button"
                onClick={() => pickRegion(null)}
                aria-pressed={selectedRegion == null && selectedCountry == null}
                className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${
                  selectedRegion == null && selectedCountry == null
                    ? "border-foreground/50 bg-foreground/5 font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("group.regionAll")}
              </button>
              {presentRegions.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  onClick={() => pickRegion(selectedRegion === slug ? null : slug)}
                  aria-pressed={selectedRegion === slug}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] transition-colors ${
                    selectedRegion === slug
                      ? "border-foreground/50 bg-foreground/5 font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: regionColor(slug) }}
                  />
                  {t(`regions.${slug}`)}
                </button>
              ))}
            </div>

            <WorldMap
              countries={mapCountries}
              flows={[]}
              legendLabel={t("group.mapLegend")}
              countLabel={(count) => t("ck.groupEntities", { count })}
              selected={selectedCountry}
              onSelect={pickCountry}
            />

            <ul className="mt-10 divide-y">
              {visibleEntities.map((entity) => (
                <li key={entity.id} className="py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <div className="min-w-0">
                      <Link
                        to={`/organisations/${entity.id}`}
                        className="text-[15px] font-medium underline-offset-4 hover:underline"
                      >
                        {entity.country ? `${countryFlag(entity.country)} ` : ""}
                        {formatOrgName(entity.name)}
                      </Link>
                      {entity.is_jv ? (
                        <span className="ml-2 rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                          {t("group.jv")}
                        </span>
                      ) : null}
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {t("group.methodNote", {
                          method: entity.method,
                          pct: Math.round(entity.confidence * 100),
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="tnum font-display text-[17px] font-[560]">
                        {formatCompactEur(entity.funding_eur, i18n.language)}
                      </span>
                      <p className="tnum mt-0.5 text-[12px] text-muted-foreground">
                        {t("group.entityShare", {
                          pct: entity.share_pct.toLocaleString(i18n.language),
                        })}
                        {" · "}
                        {t("search.projectsCount", { count: entity.projects })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-border/60">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(entity.share_pct, 100)}%`,
                        background:
                          entity.region && isRegion(entity.region)
                            ? regionColor(entity.region)
                            : "var(--color-accent)",
                        opacity: 0.66,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-[62ch] text-[12.5px] leading-relaxed text-muted-foreground">
              {t("group.shareNote")}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
