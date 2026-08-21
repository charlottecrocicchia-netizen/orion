import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { WORLD_GLYPHS } from "@/components/lens-glyphs";
import { LensGlass, ROOM_TOKENS, RoomBackdrop } from "@/components/lens-shelf";
import { Logo } from "@/components/logo";
import { formatCompactEur, formatInt } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { lensWords, usePublishedLenses } from "@/lib/lens";
import { ENTRY_ALL, writeEntry } from "@/lib/lens-memory";
import { playWorldReveal } from "@/lib/world-reveal";

/** La Lens Room — scène optique (feu vert du 2026-08-20, prototype
 *  validé). La PORTE d'Orion : des verres wireframe flottent, on en
 *  choisit un, il vient devant l'œil et on voit le monde à travers —
 *  le vrai monde : la navigation part tout de suite, la révélation
 *  s'ouvre par-dessus la home réelle (arbitrage : rien de simulé).
 *
 *  Un clic = entrer (900 ms, interruptible). Changer de monde ailleurs
 *  rejoue la même scène en 380 ms : un seul langage. La salle reste
 *  sombre dans les deux thèmes, pseudo-3D CSS/SVG, zéro dépendance —
 *  le budget d'une porte. `prefers-reduced-motion` fige tout. */

// Profondeurs, phases et dérives : partagées avec la landing (lens-shelf).

export function LensRoomPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lenses = usePublishedLenses();
  const room = lenses.filter((lens) => WORLD_GLYPHS[lens.slug]);
  // Le corpus entier : SES chiffres sont servis, jamais écrits.
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `ORION — ${t("lensRoom.title")}`;
  }, [t, i18n.language]);

  // La parallaxe : le CHAMP respire avec le pointeur — jamais les
  // verres : une cible cliquable ne fuit pas sous le curseur (qualité
  // du geste, 2026-08-20). Transform-only, rAF, reduced-motion coupé.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (event: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const dx = event.clientX / window.innerWidth - 0.5;
        const dy = event.clientY / window.innerHeight - 0.5;
        stage.querySelectorAll<HTMLElement>("[data-depth]").forEach((el) => {
          const z = Number(el.dataset.depth);
          el.style.setProperty("--par-x", `${(-dx * 26 * z).toFixed(1)}px`);
          el.style.setProperty("--par-y", `${(-dy * 18 * z).toFixed(1)}px`);
        });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [room.length]);

  // LE GESTE : un clic entre. La mémoire s'écrit (raccourci de racine),
  // la navigation part, la révélation s'ouvre depuis le verre choisi —
  // sur le monde RÉEL qui rend dessous.
  // LE GESTE (recette du 2026-08-20, second retour) : la transition
  // UNIQUE des trois verres est le GROSSISSEMENT — l'anneau teinté au
  // monde qui grandit depuis la lentille et ouvre la page. La
  // navigation part immédiatement : la vraie home rend dessous,
  // l'anneau s'ouvre par-dessus — jamais un sas. Reduced-motion :
  // navigation directe, rien ne joue. L'avion et la fusée vivent
  // désormais sur la home cadrée, en ornement d'arrivée.
  const enter = (slug: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    writeEntry(slug);
    playWorldReveal({
      slug,
      duration: 600,
      origin: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        radius: rect.width / 2,
      },
    });
    navigate(slug === ENTRY_ALL ? "/" : `/?sector=${slug}`);
  };

  return (
    <div
      style={ROOM_TOKENS}
      className="flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground"
    >
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/" aria-label={t("lensRoom.backHome")}>
          <Logo />
        </Link>
      </header>

      <main
        ref={stageRef}
        className="relative mx-auto flex w-full max-w-[1240px] flex-1 flex-col justify-center px-6 pb-16"
      >
        <RoomBackdrop parallax />

        <div className="text-center">
          <h1 className="display-tight text-[clamp(28px,4.6vw,54px)] font-medium">
            {t("lensRoom.title")}
          </h1>
          <p className="mt-3 text-[15px] text-muted-foreground">{t("lensRoom.sub")}</p>
        </div>

        {/* Les verres — composition ample, jamais une grille. */}
        <div className="mt-12 flex flex-col items-center justify-center gap-8 md:flex-row md:items-stretch md:gap-4">
          {room.map((lens) => {
            const words = lensWords(lens.slug, t);
            return (
              <LensGlass
                key={lens.slug}
                slug={lens.slug}
                name={words.name}
                ariaLabel={t("lensRoom.enterLens", { lens: words.name })}
                onClick={(event) => enter(lens.slug, event)}
                figures={
                  <>
                    {t("lensRoom.projects", {
                      count: lens.core + lens.enabling,
                      formatted: formatInt(lens.core + lens.enabling, i18n.language),
                    })}
                    <span className="mx-2 text-muted-foreground/50">·</span>
                    {formatCompactEur(lens.funding_eur, i18n.language)}
                  </>
                }
              />
            );
          })}

          {/* Tout le corpus — le troisième monde, avec SON objet. */}
          <LensGlass
            slug="all"
            name={t("lensRoom.allName")}
            ariaLabel={t("lensRoom.enterAll")}
            onClick={(event) => enter(ENTRY_ALL, event)}
            figures={
              stats
                ? t("lensRoom.allFigures", {
                    formatted: formatInt(stats.totals.projects, i18n.language),
                  })
                : " "
            }
          />
        </div>
      </main>
    </div>
  );
}
