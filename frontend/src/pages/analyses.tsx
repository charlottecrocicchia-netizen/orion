import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { lensWords, usePublishedLenses } from "@/lib/lens";
import { STORIES } from "@/lib/stories";

/** /analyses — the ready-made analyses get their own library (site
 *  architecture, lot B): the guided regime's storefront. Decks first as
 *  full editorial rows, simple views as a dense list — every entry is,
 *  as always, an Explorer URL. The Explorer keeps a short renvoi. */
export function AnalysesPage() {
  const { t } = useTranslation();
  // Une section par lentille PUBLIÉE qui a des decks, en ordre de rang
  // (M1.1) — les decks généralistes restent dessous, jamais retirés.
  // Aucune lentille n'est nommée ici : la bibliothèque suit le registre.
  const lenses = usePublishedLenses();
  const lensSections = lenses
    .map((lens) => ({
      slug: lens.slug,
      title: lensWords(lens.slug, t).name,
      stories: STORIES.filter((story) => story.deck && story.lens === lens.slug),
    }))
    .filter((section) => section.stories.length > 0);
  const decks = STORIES.filter((story) => story.deck && !story.lens);
  const simple = STORIES.filter((story) => !story.deck);

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 pt-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {t("analyses.eyebrow")}
      </p>
      <h1 className="display-tight mt-3 max-w-[22ch] text-[clamp(30px,4.2vw,44px)] font-[520] leading-[1.05] tracking-[-0.025em]">
        {t("analyses.title")}
      </h1>
      <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-muted-foreground">
        {t("analyses.lead")}
      </p>

      {lensSections.map((section) => (
      <section key={section.slug} className="mt-14" aria-label={section.title}>
        <h2 className="text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
          {section.title}
        </h2>
        {section.stories.map((story) => (
          <Link
            key={story.key}
            to={`/explore?angles=${story.key}`}
            className="group flex flex-wrap items-baseline gap-x-6 gap-y-1.5 border-t border-border-soft py-6 first:border-t-0 first:pt-4"
          >
            <span className="min-w-0">
              <span className="block text-[21px] font-semibold leading-snug transition-colors group-hover:text-accent">
                {t(`explorer.stories.${story.key}.title`)}
              </span>
              <span className="mt-1 block max-w-[56ch] text-[13.5px] leading-relaxed text-muted-foreground">
                {t(`explorer.stories.${story.key}.desc`)}
              </span>
            </span>
            <span className="ml-auto flex items-center gap-3 whitespace-nowrap">
              <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] text-muted-foreground">
                {t("explorer.angles.badge", { count: story.deck!.length })}
              </span>
              <span aria-hidden="true" className="text-accent">
                →
              </span>
            </span>
          </Link>
        ))}
      </section>
      ))}

      <section className="mt-16" aria-label={t("analyses.decksTitle")}>
        <h2 className="text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
          {t("analyses.decksTitle")}
        </h2>
        {decks.map((story) => (
          <Link
            key={story.key}
            to={`/explore?angles=${story.key}`}
            className="group flex flex-wrap items-baseline gap-x-6 gap-y-1.5 border-t border-border-soft py-6 first:border-t-0"
          >
            <span className="min-w-0">
              <span className="block text-[21px] font-semibold leading-snug transition-colors group-hover:text-accent">
                {t(`explorer.stories.${story.key}.title`)}
              </span>
              <span className="mt-1 block max-w-[56ch] text-[13.5px] leading-relaxed text-muted-foreground">
                {t(`explorer.stories.${story.key}.desc`)}
              </span>
            </span>
            <span className="ml-auto flex items-center gap-3 whitespace-nowrap">
              <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] text-muted-foreground">
                {t("explorer.angles.badge", { count: story.deck!.length })}
              </span>
              <span aria-hidden="true" className="text-accent">
                →
              </span>
            </span>
          </Link>
        ))}
      </section>

      <section className="mt-16 pb-16" aria-label={t("analyses.simpleTitle")}>
        <h2 className="text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
          {t("analyses.simpleTitle")}
        </h2>
        <div className="mt-3">
          {simple.map((story) => (
            <Link
              key={story.key}
              to={`/explore?${story.params}`}
              className="group flex items-baseline gap-4 border-t border-border-soft py-3.5 first:border-t-0"
            >
              <span className="text-[15.5px] font-medium transition-colors group-hover:text-accent">
                {t(`explorer.stories.${story.key}.title`)}
              </span>
              <span className="hidden min-w-0 text-[13px] text-muted-foreground sm:block">
                {t(`explorer.stories.${story.key}.desc`)}
              </span>
              <span aria-hidden="true" className="ml-auto text-accent">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
