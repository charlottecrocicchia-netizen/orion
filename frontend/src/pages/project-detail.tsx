import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";

import { ExploreExits } from "@/components/explore-exits";
import { KpiStatic } from "@/components/kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { countryFlag, formatCompactEur, formatInt, formatOrgName } from "@/lib/format";

/** The badge names the site the link actually opens — CORDIS for the EU
 *  frameworks, ANR for the French corpus, RePORTER for NIH. A badge that
 *  lies about its source is worse than no badge (recette 2026-08-03: a
 *  NIH project wore CORDIS colours). */
function sourceSite(source: string): string {
  if (source.startsWith("anr")) return "ANR";
  if (source.startsWith("nih")) return "RePORTER";
  return "CORDIS";
}

export function ProjectDetailPage() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const { data, isPending } = useQuery({
    queryKey: ["project", id],
    queryFn: () => api.project(id),
  });
  const uiLang = i18n.language.startsWith("fr") ? "fr" : "en";
  const [lang, setLang] = useState<string | null>(null);

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-[980px] px-6 pt-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-6 h-28 w-full" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }
  if (!data) return null;

  const text =
    data.texts.find((entry) => entry.lang === (lang ?? uiLang)) ??
    data.texts.find((entry) => entry.lang === data.title_lang) ??
    data.texts[0];
  const otherLangs = data.texts.map((entry) => entry.lang).filter((l) => l !== text?.lang);
  const coordinator = data.participants.find((p) => p.role === "coordinator");
  const programme = data.programme_chain[data.programme_chain.length - 1];
  const root = data.programme_chain[0];

  return (
    <div className="mx-auto w-full max-w-[980px] px-6 pt-12">
      <nav className="text-[13px] text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/projects" className="transition-colors hover:text-foreground">
          {t("nav.projects")}
        </Link>{" "}
        › <span>{data.acronym ?? data.source_id}</span>
      </nav>

      <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        {data.acronym ? (
          <span className="display-tight text-lg font-semibold text-accent">{data.acronym}</span>
        ) : null}
        {data.status ? (
          <span className="rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            {data.status}
          </span>
        ) : null}
        {/* The source of truth, worn proudly — the data's credibility. */}
        {data.url ? (
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            aria-label={t("project.viewSource", { site: sourceSite(data.source) })}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11.5px] transition-colors hover:border-accent hover:text-accent"
          >
            {sourceSite(data.source)} · {data.source_id}
            <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>
      <h1 className="display-tight mt-1 max-w-[28ch] text-[clamp(24px,3.4vw,34px)] font-semibold leading-tight">
        {text?.title ?? data.title}
      </h1>

      <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <KpiStatic
          value={formatCompactEur(data.funding_amount_eur, i18n.language)}
          label={t("project.funding")}
          // Convention ④ (sources registry): a converted euro never
          // travels mute — the native award and its dated rate show.
          note={
            data.funding_amount_native != null && data.funding_currency && data.conversion
              ? t("project.converted", {
                  amount: new Intl.NumberFormat(i18n.language, {
                    style: "currency",
                    currency: data.funding_currency,
                    maximumFractionDigits: 0,
                    notation: "compact",
                  }).format(data.funding_amount_native),
                  year: data.conversion.year,
                })
              : undefined
          }
        />
        <KpiStatic
          value={formatCompactEur(data.total_cost_eur, i18n.language)}
          label={t("project.totalCost")}
        />
        <KpiStatic
          value={
            data.start_date && data.end_date
              ? `${data.start_date.slice(0, 4)} – ${data.end_date.slice(0, 4)}`
              : (data.start_date?.slice(0, 4) ?? "—")
          }
          label={t("project.duration")}
        />
        <KpiStatic value={programme?.code ?? "—"} label={t("project.programme")} />
      </div>

      {text?.abstract ? (
        <section className="mt-14 max-w-[75ch]">
          <div className="mb-2 flex items-center gap-3">
            <h2 className="text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
              {t("project.abstract")}
            </h2>
            <span className="rounded border px-1.5 text-[10px] uppercase text-muted-foreground">
              {text.lang}
            </span>
            {otherLangs.map((other) => (
              <button
                key={other}
                type="button"
                onClick={() => setLang(other)}
                className="text-[12px] text-accent underline-offset-2 hover:underline"
              >
                {other.toUpperCase()}
              </button>
            ))}
          </div>
          <p className="leading-relaxed text-foreground/90">{text.abstract}</p>
        </section>
      ) : null}

      <section className="mt-14">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
          {t("project.participants", { count: data.participants.length })}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-[.08em] text-muted-foreground">
                <th className="py-2 pr-3 font-medium">{t("search.organisationsTab")}</th>
                <th className="py-2 pr-3 font-medium">{t("org.role")}</th>
                <th className="py-2 pr-3 font-medium">{t("search.filters.country")}</th>
                <th className="py-2 text-right font-medium">{t("org.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {data.participants.map((p) => (
                <tr key={`${p.organisation_id}-${p.role}-${p.amount_eur}`} className="border-b border-border-soft">
                  <td className="py-3 pr-3">
                    <Link
                      to={`/organisations/${p.organisation_id}`}
                      className="hover:underline underline-offset-2"
                    >
                      {formatOrgName(p.name)}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3">
                    {p.role === "coordinator" ? (
                      <span className="font-medium text-accent">{t("project.coordinator")}</span>
                    ) : (
                      <span className="text-muted-foreground">{t("project.participant")}</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {p.country ? (
                      <>
                        <span aria-hidden="true">{countryFlag(p.country)}</span> {p.country}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="tnum py-3 text-right">
                    {formatCompactEur(p.amount_eur, i18n.language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.topics.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
            {t("project.topics")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.topics.map((topic) => (
              <span key={topic.code} className="rounded-full bg-surface px-3 py-1 text-[12.5px]">
                {topic.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {data.attribution ? (
        <p className="mt-8 text-[12px] text-muted-foreground">{data.attribution}</p>
      ) : null}

      <ExploreExits
        exits={[
          ...(coordinator
            ? [
                {
                  label: formatOrgName(coordinator.name),
                  to: `/organisations/${coordinator.organisation_id}`,
                },
              ]
            : []),
          ...(root ? [{ label: root.label ?? root.code, to: `/explore/programmes/${root.id}` }] : []),
          ...data.participants
            .filter((p) => p.country)
            .slice(0, 2)
            .map((p) => ({
              label: `${t("explore.countriesTitle")} · ${p.country}`,
              to: `/explore/countries/${p.country}`,
            })),
          {
            label: t("explore.allProjects"),
            to: data.acronym ? `/projects?q=${encodeURIComponent(data.acronym)}` : "/projects",
          },
        ].filter(
          (exit, index, all) => all.findIndex((other) => other.to === exit.to) === index,
        )}
      />
      <span className="sr-only">{formatInt(data.participants.length, i18n.language)}</span>
    </div>
  );
}
