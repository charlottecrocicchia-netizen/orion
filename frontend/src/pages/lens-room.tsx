import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { ConstellationGlyph, WORLD_GLYPHS } from "@/components/lens-glyphs";
import { Logo } from "@/components/logo";
import { formatCompactEur, formatInt } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { lensWords, usePublishedLenses } from "@/lib/lens";
import { ENTRY_ALL, writeEntry } from "@/lib/lens-memory";
import { playWorldReveal } from "@/lib/world-reveal";
import { worldTintVars } from "@/lib/world-tints";

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

const ROOM_TOKENS = {
  "--background": "#0b0d12",
  "--foreground": "#f5f5f7",
  "--accent": "#8b9aff",
  "--accent-soft": "#1b2040",
  "--muted-foreground": "#9d9da6",
  "--border": "rgba(255,255,255,0.14)",
  "--border-soft": "rgba(255,255,255,0.08)",
  "--surface": "#11141b",
} as React.CSSProperties;

/** Trois profondeurs (pseudo-3D) : échelle au repos + amplitude de
 *  parallaxe. Le monde du milieu est le plus proche de l'œil. */
const DEPTH: Record<string, number> = { space: 0.4, aviation: 0.9, all: 0.25 };
// Le DÉSACCORD (recette du 2026-08-20, troisième retour) : la phase de
// dérive de chaque verre est fixée à la main, écartée d'environ un
// demi-tour d'un verre à l'autre — un délai proportionnel au depth
// donnait des verres qui respiraient presque ensemble (corrélation
// mesurée : 0,77). L'œil doit voir trois flottements en désaccord.
const PHASE: Record<string, number> = { space: 0, aviation: 0.45, all: 0.8 };
const driftTime = (depth: number) => 5.5 + depth * 2.2;
const floatDelay = (slug: string, depth: number) =>
  -(PHASE[slug] ?? 0.5) * driftTime(depth);

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
        {/* Le monde d'Orion, flou, derrière les verres. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-50 blur-[1.5px]"
          data-depth="0.12"
          style={{ transform: "translate3d(var(--par-x,0),var(--par-y,0),0)" }}
          viewBox="0 0 1200 700"
          preserveAspectRatio="xMidYMid slice"
        >
          <g fill="currentColor">
            <circle cx="140" cy="120" r="1.6" /><circle cx="320" cy="520" r="1.3" />
            <circle cx="540" cy="90" r="1.2" /><circle cx="820" cy="600" r="1.6" />
            <circle cx="1020" cy="180" r="1.4" /><circle cx="1130" cy="420" r="1.2" />
            <circle cx="240" cy="330" r="1.1" /><circle cx="700" cy="260" r="1.1" />
            <circle cx="920" cy="380" r="1.3" />
          </g>
          <g stroke="var(--accent)" fill="none">
            <path d="M140 120 320 260 540 210 700 260 920 380 1130 420" strokeOpacity=".16" />
            <path d="M240 330 320 520 820 600" strokeOpacity=".1" />
          </g>
        </svg>

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
            const Glyph = WORLD_GLYPHS[lens.slug];
            const depth = DEPTH[lens.slug] ?? 0.5;
            return (
              <button
                key={lens.slug}
                type="button"
                aria-label={t("lensRoom.enterLens", { lens: words.name })}
                onClick={(event) => enter(lens.slug, event)}
                className="lens-hit group"
                style={{
                  ...worldTintVars(lens.slug),
                  "--rest-scale": String(0.88 + depth * 0.24),
                  "--drift-delay": `${(1 - depth) * 0.22}s`,
                  "--drift-time": `${driftTime(depth)}s`,
                  "--float-delay": `${floatDelay(lens.slug, depth)}s`,
                  "--float-x": `${8 + depth * 8}px`,
                  "--float-y": `${11 + depth * 6}px`,
                } as React.CSSProperties}
              >
                <span className="lens-glass">
                  <span aria-hidden="true" className="lens-glass-glyph">
                    <Glyph />
                  </span>
                  <span className="display-tight mt-4 text-[19px] font-medium">{words.name}</span>
                  <span className="mt-1.5 text-[13px] text-muted-foreground tabular-nums">
                    {t("lensRoom.projects", {
                      count: lens.core + lens.enabling,
                      formatted: formatInt(lens.core + lens.enabling, i18n.language),
                    })}
                    <span className="mx-2 text-muted-foreground/50">·</span>
                    {formatCompactEur(lens.funding_eur, i18n.language)}
                  </span>
                </span>
              </button>
            );
          })}

          {/* Tout le corpus — le troisième monde, avec SON objet. */}
          <button
            type="button"
            aria-label={t("lensRoom.enterAll")}
            onClick={(event) => enter(ENTRY_ALL, event)}
            className="lens-hit group"
            style={{
              "--rest-scale": String(0.88 + DEPTH.all * 0.24),
              "--drift-delay": `${(1 - DEPTH.all) * 0.22}s`,
              "--drift-time": `${driftTime(DEPTH.all)}s`,
              "--float-delay": `${floatDelay("all", DEPTH.all)}s`,
              "--float-x": `${8 + DEPTH.all * 8}px`,
              "--float-y": `${11 + DEPTH.all * 6}px`,
            } as React.CSSProperties}
          >
            <span className="lens-glass">
              <span aria-hidden="true" className="lens-glass-glyph">
                <ConstellationGlyph />
              </span>
              <span className="display-tight mt-4 text-[19px] font-medium">
                {t("lensRoom.allName")}
              </span>
              <span className="mt-1.5 text-[13px] text-muted-foreground tabular-nums">
                {stats
                  ? t("lensRoom.allFigures", {
                      formatted: formatInt(stats.totals.projects, i18n.language),
                    })
                  : " "}
              </span>
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}
