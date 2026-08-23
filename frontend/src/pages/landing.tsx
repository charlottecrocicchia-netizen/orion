import { Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { LensGlass, RoomBackdrop } from "@/components/lens-shelf";
import { ROOM_TOKENS } from "@/lib/lens-room";
import { StatHero } from "@/components/stat-hero";
import { WorldGlobe } from "@/components/world-globe";
import { api } from "@/lib/api";
import type { CountryIndexEntry } from "@/lib/api";
import { lensWords } from "@/lib/lens";
import { formatInt } from "@/lib/format";
import { EditorialEntry } from "@/pages/home";
import { useRevealProgress } from "@/hooks/use-reveal-progress";

/** La landing publique (pivot 2026-08-22, refonte DA 2026-08-22) : la
 *  FAÇADE du produit, composée des primitives d'Orion — jamais un
 *  second design system. Le rythme est celui de la vraie home : hero
 *  aéré (StatHero, compteurs, constellation), rupture encre (les trois
 *  portes), la salle des verres (Lens Room), le globe en couverture,
 *  les sources en filets fins, un CTA final.
 *
 *  Frontière : tout vient du SEUL endpoint public (overview — totaux,
 *  série annuelle, lentilles, couverture sans montants) ; chaque
 *  interaction applicative part au login en conservant la destination.
 *  Reduced-motion : chaque primitive gère déjà le sien. */

const CTA =
  "rounded-full bg-foreground px-5 py-2.5 text-[14px] font-medium text-background transition-opacity hover:opacity-90";

function signInTo(path: string): string {
  return `/login?from=${encodeURIComponent(path)}`;
}

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["overview"], queryFn: api.overview });
  // La tuile encre entre en scène comme sur la home (Apple entrance) —
  // reduced motion la pose instantanément.
  const tile = useRevealProgress(true, 850);

  const years = data?.funding_by_year ?? [];
  const from = years[0]?.year;
  const to = years[years.length - 1]?.year;

  // La couverture SANS montants : le globe teinte les pays couverts,
  // uniformément — les entrées ne portent aucun chiffre (preview).
  const coverage: CountryIndexEntry[] = (data?.coverage ?? []).map((c) => ({
    code: c.code,
    name: c.name,
    region: c.region,
    eu_member: false,
    funding_eur: 0,
    projects_count: 0,
  })) as CountryIndexEntry[];

  return (
    <div>
      {/* — Acte 1 : le hero Orion, nourri de la surface publique — */}
      <section className="flex min-h-[calc(100dvh-64px)] flex-col justify-center bg-background px-6 pb-10 text-center">
        <div className="mx-auto w-full max-w-[1240px]">
          <p className="mb-4 text-sm font-medium text-accent">{t("landing.eyebrow")}</p>
          {data ? (
            <>
              <StatHero
                funding={data.totals.funding_eur}
                sub={from && to ? t("landing.heroSub", { from, to }) : t("landing.heroSubBare")}
                basis={t("landing.heroBasis")}
                kpis={[
                  { value: data.totals.projects, label: t("hero.projects") },
                  { value: data.totals.organisations, label: t("hero.organisations") },
                  { value: data.totals.countries, label: t("hero.countries") },
                ]}
                years={years}
              />
              <p className="mt-7">
                <Link to="/login" className={CTA}>
                  {t("auth.signIn")} →
                </Link>
              </p>
              <p className="mt-4 text-[13px] text-muted-foreground">{t("landing.invite")}</p>
            </>
          ) : null}
        </div>
      </section>

      {/* — Acte 2 : la rupture encre — les trois portes, en preview — */}
      <section className="dark overflow-hidden bg-surface text-foreground">
        <div
          ref={tile.ref}
          style={{
            opacity: 0.25 + 0.75 * tile.progress,
            transform: `translateY(${((1 - tile.progress) * 64).toFixed(1)}px)`,
          }}
          className="mx-auto w-full max-w-[1240px] px-6 py-20 sm:py-28"
        >
          <h2 className="font-display max-w-[16ch] text-[clamp(30px,4.6vw,52px)] font-[540] leading-[1.06] tracking-[-0.024em]">
            {t("home.ask")}
          </h2>
          <div className="mt-12">
            <EditorialEntry
              to={signInTo("/explore")}
              title={t("nav.discover")}
              desc={t("landing.doorDiscover")}
              figure={t("landing.doorSignIn")}
            />
            <EditorialEntry
              to={signInTo("/compare")}
              title={t("nav.analyse")}
              desc={t("landing.doorAnalyse")}
              figure={t("landing.doorSignIn")}
            />
            <EditorialEntry
              to={signInTo("/dossier")}
              title={t("nav.build")}
              desc={t("landing.doorBuild")}
              figure={t("landing.doorSignIn")}
            />
          </div>
        </div>
      </section>

      {/* — Acte 3 : la salle des verres — la Lens Room en façade — */}
      <section
        style={ROOM_TOKENS}
        className="relative overflow-x-clip bg-background text-foreground"
      >
        <RoomBackdrop />
        <div className="relative mx-auto w-full max-w-[1240px] px-6 py-20 sm:py-28">
          <div className="text-center">
            <h2 className="display-tight text-[clamp(26px,4vw,44px)] font-medium">
              {t("lensRoom.sub")}
            </h2>
            <p className="mt-3 text-[15px] text-muted-foreground">{t("landing.lensesLead")}</p>
          </div>
          <div className="mt-12 flex flex-col items-center justify-center gap-8 md:flex-row md:items-stretch md:gap-4">
            {(data?.lenses ?? []).map((lens) => {
              const words = lensWords(lens.slug, t);
              return (
                <LensGlass
                  key={lens.slug}
                  slug={lens.slug}
                  name={words.name}
                  ariaLabel={t("lensRoom.enterLens", { lens: words.name })}
                  onClick={() => navigate(signInTo(`/?sector=${lens.slug}`))}
                  figures={t("lensRoom.projects", {
                    count: lens.core + lens.enabling,
                    formatted: formatInt(lens.core + lens.enabling, i18n.language),
                  })}
                />
              );
            })}
            {data ? (
              <LensGlass
                slug="all"
                name={t("lensRoom.allName")}
                ariaLabel={t("lensRoom.enterAll")}
                onClick={() => navigate(signInTo("/"))}
                figures={t("lensRoom.allFigures", {
                  formatted: formatInt(data.totals.projects, i18n.language),
                })}
              />
            ) : null}
          </div>
        </div>
      </section>

      {/* — Acte 4 : le monde du financement — la couverture, en globe — */}
      <section className="bg-background px-6 py-20 sm:py-24">
        <div className="mx-auto w-full max-w-[1240px]">
          <div className="mx-auto max-w-[62ch] text-center">
            <h2 className="font-display text-[clamp(26px,3.6vw,40px)] font-[540] tracking-[-0.022em]">
              {t("landing.globeTitle")}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              {t("landing.globeLead")}
            </p>
          </div>
          {coverage.length > 0 ? (
            <div className="mx-auto mt-10 max-w-[880px]">
              <WorldGlobe
                countries={coverage}
                preview
                mode="select"
                onOpenCountry={(code) => navigate(signInTo(`/explore/countries/${code}`))}
              />
            </div>
          ) : null}
        </div>
      </section>

      {/* — Acte 5 : les sources, en filets fins — */}
      <section className="px-6 pb-4">
        <div className="mx-auto w-full max-w-[880px] border-y border-border-soft py-14 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {t("landing.sourcesEyebrow")}
          </p>
          <p className="display-tight mx-auto mt-4 max-w-[26ch] text-[clamp(20px,2.6vw,28px)] font-medium leading-snug">
            {t("landing.sourcesTitle")}
          </p>
          <p className="tnum mt-5 text-[14px] text-muted-foreground">CORDIS · NIH · NSF</p>
          <p className="mt-2 text-[13.5px] text-muted-foreground">{t("landing.sourcesLine")}</p>
        </div>
      </section>

      {/* — Acte 6 : l'entrée — */}
      <section className="px-6 py-20 text-center">
        <h2 className="display-tight text-[clamp(24px,3.4vw,36px)] font-medium">
          {t("landing.finalTitle")}
        </h2>
        <p className="mt-7">
          <Link to="/login" className={CTA}>
            {t("auth.signIn")} →
          </Link>
        </p>
      </section>
    </div>
  );
}
