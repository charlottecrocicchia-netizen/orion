import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatInt } from "@/lib/format";

const SOURCE_LABELS: Record<string, string> = {
  "cordis-horizon": "CORDIS · Horizon Europe",
  "cordis-h2020": "CORDIS · Horizon 2020",
  "cordis-fp7": "CORDIS · FP7",
  nih: "NIH RePORTER · États-Unis",
  nsf: "NSF · États-Unis",
  gleif: "GLEIF · identité des entités",
  wikidata: "Wikidata · rattachements de groupes",
  ecb: "BCE · taux de change annuels",
};

export function AboutDataPage() {
  const { t, i18n } = useTranslation();
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

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
          La lentille spatiale
        </h2>
        {/* Exigence fondatrice (2026-08-17) : la définition des deux
            périmètres figure en clair ici, pas seulement en code. */}
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Le secteur spatial est identifié projet par projet par une
            lentille <b className="font-medium text-foreground/80">versionnée et auditable</b> —
            23 règles, chacune avec sa preuve : 4 règles de programme
            (FP7-SPACE, le volet spatial d&rsquo;H2020, l&rsquo;astronomie NSF…),
            5 règles de thème (par code euroSciVoc, jamais par libellé) et
            14 motifs de texte validés à la main et cadrés par source.
            Rien de gonflé, rien de supprimé : chaque exécution retague le
            corpus entier depuis le fichier de règles.
          </p>
          <p>
            Deux périmètres en découlent, toujours nommés à l&rsquo;écran :{" "}
            <b className="font-medium text-foreground/80">« Spatial direct »</b> —
            les projets au cœur du spatial (lanceurs, satellites, débris,
            observation de la Terre…) ; et{" "}
            <b className="font-medium text-foreground/80">« Spatial + habilitant »</b> —
            le cœur plus les technologies habilitantes, taguées
            &laquo;&nbsp;enabling&nbsp;&raquo; par la lentille
            (ingénierie aérospatiale au sens large, microgravité,
            géospatial-atmosphérique). Une vue cadrée porte son périmètre
            en chip, et l&rsquo;URL le dit (« sector=space-direct » /
            « sector=space »).
          </p>
        </div>
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
