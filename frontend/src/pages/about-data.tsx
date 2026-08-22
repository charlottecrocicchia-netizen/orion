import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { lensWords, usePublishedLenses } from "@/lib/lens";
import { formatCompactEur, formatInt } from "@/lib/format";

const SOURCE_LABELS: Record<string, string> = {
  "cordis-horizon": "CORDIS · Horizon Europe",
  "cordis-h2020": "CORDIS · Horizon 2020",
  "cordis-fp7": "CORDIS · FP7",
  nih: "NIH RePORTER · États-Unis",
  nsf: "NSF · États-Unis",
  gleif: "GLEIF · identité des entités",
  wikidata: "Wikidata · rattachements de groupes",
  ecb: "BCE · taux de change annuels",
  calls: "EU Funding & Tenders · appels à venir",
};

export function AboutDataPage() {
  const { t, i18n } = useTranslation();
  const lenses = usePublishedLenses();
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const { data: sources, isPending } = useQuery({ queryKey: ["sources"], queryFn: api.sources });
  const { data: health } = useQuery({ queryKey: ["health"], queryFn: api.health, retry: false });

  const dateFmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });

  return (
    <div className="mx-auto w-full max-w-[760px] px-6 pt-10">
      <h1 className="display-tight text-[clamp(28px,4vw,40px)] font-semibold">{t("about.title")}</h1>
      <p className="mt-3 max-w-[60ch] text-muted-foreground">{t("about.intro")}</p>

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
          {t("about.source")}s
        </h2>
        {isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-[.08em] text-muted-foreground">
                <th className="py-2 pr-3 font-medium">{t("about.source")}</th>
                <th className="py-2 pr-3 text-right font-medium">{t("about.projects")}</th>
                <th className="py-2 text-right font-medium">{t("about.updated")}</th>
              </tr>
            </thead>
            <tbody>
              {sources?.sources.map((source) => (
                <tr key={source.source} className="border-b border-border-soft">
                  <td className="py-2.5 pr-3">{SOURCE_LABELS[source.source] ?? source.source}</td>
                  <td className="tnum py-2.5 pr-3 text-right">
                    {formatInt(source.projects, i18n.language)}
                  </td>
                  <td className="tnum py-2.5 text-right text-muted-foreground">
                    {source.last_success_at
                      ? dateFmt.format(new Date(source.last_success_at))
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
          {t("about.licences")}
        </h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            © European Union, CORDIS —{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              CC BY 4.0
            </a>
          </li>
          <li>
            © Union européenne, portail EU Funding & Tenders (appels à venir) —{" "}
            <a
              href="https://commission.europa.eu/legal-notice_en"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              CC BY 4.0
            </a>
          </li>
          <li>
            NIH RePORTER — données fédérales américaines,{" "}
            <a
              href="https://reporter.nih.gov/faq"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              domaine public
            </a>{" "}
            · montants convertis aux taux annuels BCE
          </li>
          <li>
            NSF — données fédérales américaines,{" "}
            <a
              href="https://www.nsf.gov/policies/digital"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              domaine public
            </a>{" "}
            · « Courtesy: U.S. National Science Foundation » · montants convertis aux taux
            annuels BCE
          </li>
          <li>
            GLEIF (identité des entités) et Wikidata (rattachements de groupes) —{" "}
            <a
              href="https://creativecommons.org/publicdomain/zero/1.0/"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              CC0
            </a>
          </li>
          <li>
            {/* Les noms des régions européennes — la nomenclature passe
                notre registre, la géométrie GISCO en est exclue : des
                régions nommées, jamais dessinées. */}
            Eurostat — nomenclature NUTS (noms des régions), © Union européenne,{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              CC BY 4.0
            </a>{" "}
            · codes et noms seulement — aucune géométrie
          </li>
        </ul>
      </section>

      {/* Un bloc MÉTHODE par lentille publiée (M1.3) — périmètres,
          méthode, règles, dernier passage. Générique de structure,
          curé de contenu : les mots d'une lentille sont sa curation,
          et tout passe par l'i18n (invariant gravé). */}
      {lenses.map((lens) => {
        const words = lensWords(lens.slug, t);
        const about = (key: string, fallback: string) =>
          t(`lens.${lens.slug}.about.${key}`, { defaultValue: fallback });
        return (
          <section className="mt-10" key={lens.slug} aria-label={words.name}>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
              {t("about.lensTitle", { lens: words.name })}
            </h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>{about("method", t("about.lensMethodFallback", { lens: words.name }))}</p>
              <p>
                {t("about.lensPerimeters")}{" "}
                <b className="font-medium text-foreground/80">«&nbsp;{words.direct}&nbsp;»</b>
                {" — "}
                {about("direct", t("about.lensDirectFallback"))} ;{" "}
                {t("about.and")}{" "}
                <b className="font-medium text-foreground/80">«&nbsp;{words.enabling}&nbsp;»</b>
                {" — "}
                {about("enabling", t("about.lensEnablingFallback"))}.{" "}
                {t("about.lensUrls", {
                  direct: `sector=${lens.slug}-direct`,
                  enabling: `sector=${lens.slug}`,
                })}
              </p>
              <p>
                {lens.rules.total > 0
                  ? t(lens.rules.review > 0 ? "about.lensRulesWithReview" : "about.lensRules", {
                      total: lens.rules.total,
                      programme: lens.rules.programme,
                      theme: lens.rules.theme,
                      text: lens.rules.text,
                      review: lens.rules.review,
                    })
                  : null}{" "}
                {lens.last_run_at
                  ? t("about.lensLastRun", { date: dateFmt.format(new Date(lens.last_run_at)) })
                  : null}
              </p>
              {/* Le journal de méthodologie (S1) : un changement de
                  règles qui déplace des chiffres publics se montre —
                  sa date, sa raison, son avant/après. */}
              {lens.changelog.map((entry) => (
                <p key={entry.version} className="border-l-2 border-border-soft pl-3">
                  <b className="font-medium text-foreground/80">
                    {t("about.lensVersion", { version: entry.version })}
                  </b>{" "}
                  · {dateFmt.format(new Date(entry.changed_on))} —{" "}
                  {t(`lens.${lens.slug}.changelog.v${entry.version}`, { defaultValue: "" })}{" "}
                  {entry.before.core === entry.after.core &&
                  entry.before.enabling === entry.after.enabling &&
                  entry.before.funding_eur === entry.after.funding_eur
                    ? // La NAISSANCE d'une lentille : le run mesure un
                      // avant/après identiques (rien ne bougeait, elle
                      // devenait simplement publique). On dit l'état,
                      // jamais un mouvement nul.
                      t("about.lensPublishedWith", {
                        core: formatInt(entry.after.core, i18n.language),
                        enabling: formatInt(entry.after.enabling, i18n.language),
                        funding: formatCompactEur(entry.after.funding_eur, i18n.language),
                      })
                    : t("about.lensBeforeAfter", {
                        coreBefore: formatInt(entry.before.core, i18n.language),
                        enablingBefore: formatInt(entry.before.enabling, i18n.language),
                        fundingBefore: formatCompactEur(entry.before.funding_eur, i18n.language),
                        coreAfter: formatInt(entry.after.core, i18n.language),
                        enablingAfter: formatInt(entry.after.enabling, i18n.language),
                        fundingAfter: formatCompactEur(entry.after.funding_eur, i18n.language),
                      })}
                </p>
              ))}
            </div>
          </section>
        );
      })}

      {/* Le recouvrement n'a de sens qu'à DEUX lentilles publiées — sinon
          il n'apparaît pas du tout : jamais un compteur qui attend. */}
      {lenses.length > 1 && stats ? (
        <section className="mt-10" aria-label={t("about.overlapTitle")}>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
            {t("about.overlapTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("about.overlapBody", { count: stats.overlap_projects })}
          </p>
        </section>
      ) : null}

      {/* La convention temporelle des groupes. Elle se DÉCLARE : les
          participations sont historiques, la consolidation décrit la
          propriété d'aujourd'hui. Sans cette phrase, un lecteur informé
          prend la convention pour une erreur. */}
      {/* ① (2026-08-19) : la question qu'un lecteur d'Horizon se
          posera devant les cartes — participer n'est pas être financé. */}
      <section className="mt-10" aria-label={t("about.thirdCountriesTitle")}>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
          {t("about.thirdCountriesTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("about.thirdCountriesBody")}</p>
      </section>

      <section className="mt-10" aria-label={t("about.groupsTitle")}>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
          {t("about.groupsTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("about.groupsTemporal")}</p>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
          {t("about.systemStatus")}
        </h2>
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">{t("about.api")} · </span>
            <span className={health ? "text-foreground" : "text-muted-foreground"}>
              {health ? t("about.operational") : t("about.down")}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{t("about.database")} · </span>
            <span>
              {health?.checks.database === "ok" ? t("about.operational") : t("about.down")}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{t("about.version")} · </span>
            <span className="tnum">{health?.version ?? "—"}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
