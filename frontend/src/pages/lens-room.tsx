import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";

import { Logo } from "@/components/logo";
import { formatCompactEur, formatInt } from "@/lib/format";
import { lensWords, usePublishedLenses } from "@/lib/lens";
import { cn } from "@/lib/utils";

/** La Lens Room (chantier 2026-08-19, vision docs/vision-lens-room.md,
 *  décisions fondatrice ①-④). Une page dédiée, un moment immersif — la
 *  home reste l'entrée fonctionnelle. DEUX objets seulement, réels,
 *  servis par le registre publié : les lentilles vides ou futures
 *  n'existent pas à l'écran — règle d'honnêteté définitive.
 *
 *  La salle est SOMBRE dans les deux thèmes, comme une salle de
 *  projection : les tokens du thème sombre sont posés localement sur sa
 *  racine, le système de thème global n'est pas touché.
 *
 *  Le geste est celui de la carte (loi du projet) : le premier clic
 *  SÉLECTIONNE (le focus entre dans l'URL — chaque état est
 *  reproductible), le second DESCEND vers l'explorateur cadré. */

/** Les tokens de la salle : le thème sombre d'index.css, verbatim. */
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

/** L'orbite — le symbole de la lentille spatiale : une ellipse
 *  inclinée, un corps central discret, un satellite-point qui la
 *  parcourt. Wireframe, trait fin — jamais une fusée. */
function OrbitGlyph({ awake }: { awake: boolean }) {
  return (
    <svg viewBox="0 0 320 320" className="h-full w-full" aria-hidden="true">
      <g stroke="var(--foreground)" fill="none" strokeWidth="1.1">
        <circle cx="160" cy="160" r="26" strokeOpacity=".55" />
        <circle cx="160" cy="160" r="3" fill="var(--foreground)" stroke="none" />
        {/* L'ellipse orbitale, inclinée — elle se dessine à l'éveil. */}
        <ellipse
          cx="160"
          cy="160"
          rx="126"
          ry="54"
          strokeOpacity=".8"
          transform="rotate(-24 160 160)"
          pathLength={1}
          className={cn("lens-room-draw", awake && "lens-room-draw-awake")}
        />
        <ellipse
          cx="160"
          cy="160"
          rx="88"
          ry="112"
          strokeOpacity=".18"
          transform="rotate(-24 160 160)"
        />
      </g>
      {/* Le satellite : un point en accent qui parcourt l'orbite. */}
      <circle r="4" fill="var(--accent)" className={cn(awake && "lens-room-orbiter")}>
        <animateMotion
          dur="9s"
          repeatCount="indefinite"
          path="M 44.9 211.2 A 126 54 24 1 1 275.1 108.8 A 126 54 24 1 1 44.9 211.2 Z"
        />
      </circle>
    </svg>
  );
}

/** Le profil d'aile — le symbole de la lentille aéronautique : un
 *  profil en coupe réduit à ses lignes, trois flux qui le contournent.
 *  Abstrait, technique — jamais un avion. */
function WingGlyph({ awake }: { awake: boolean }) {
  return (
    <svg viewBox="0 0 320 320" className="h-full w-full" aria-hidden="true">
      <g fill="none" strokeWidth="1.1">
        {/* Les flux : trois lignes qui passent, défilement continu. */}
        {[104, 160, 216].map((y, i) => (
          <path
            key={y}
            d={
              i === 1
                ? "M 6 160 C 70 160 88 130 160 130 C 232 130 250 160 314 160"
                : `M 6 ${y} C 84 ${y} 116 ${y + (i === 0 ? 14 : -14)} 160 ${y + (i === 0 ? 14 : -14)} C 204 ${y + (i === 0 ? 14 : -14)} 236 ${y} 314 ${y}`
            }
            stroke="var(--accent)"
            strokeOpacity=".38"
            strokeDasharray="7 9"
            className={cn(awake && "lens-room-flow")}
            style={{ animationDelay: `${i * 0.45}s` }}
          />
        ))}
        {/* Le profil : extrados, intrados, corde — trois traits. */}
        <path
          d="M 56 176 C 92 138 180 126 264 152 C 228 174 120 186 56 176 Z"
          stroke="var(--foreground)"
          strokeOpacity=".85"
          pathLength={1}
          className={cn("lens-room-draw", awake && "lens-room-draw-awake")}
        />
        <path d="M 56 176 L 264 152" stroke="var(--foreground)" strokeOpacity=".3" />
      </g>
    </svg>
  );
}

const GLYPHS: Record<string, (props: { awake: boolean }) => React.ReactElement> = {
  space: OrbitGlyph,
  aviation: WingGlyph,
};

export function LensRoomPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const lenses = usePublishedLenses();
  // Seuls les objets DESSINÉS existent : une lentille publiée sans son
  // glyphe n'apparaît pas ici (la graine e2e en publie une synthétique).
  const room = lenses.filter((lens) => GLYPHS[lens.slug]);
  const focus = params.get("focus");
  const focused = room.find((lens) => lens.slug === focus) ?? null;

  // L'identité composée (D5, actée à la publication d'Aviation) : le
  // titre du document la porte aussi.
  useEffect(() => {
    document.title = focused
      ? `ORION / ${lensWords(focused.slug, t).name.toUpperCase()}`
      : `ORION — ${t("lensRoom.title")}`;
  }, [focused, t, i18n.language]);

  return (
    <div
      style={ROOM_TOKENS}
      className="flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground"
    >
      {/* Le header minimal de la salle : ORION ramène à l'entrée
          fonctionnelle. Pas de nav — le moment est distinct. */}
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/" aria-label={t("lensRoom.backHome")}>
          <Logo />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col justify-center px-6 pb-16">
        {/* L'identité composée — le second terme suit le focus. */}
        <h1 className="display-tight text-center text-[clamp(28px,4.6vw,56px)] font-medium">
          ORION
          <span
            aria-hidden={!focused}
            className={cn(
              "inline-block transition-all duration-500",
              focused ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0",
            )}
          >
            {focused ? (
              <>
                <span className="mx-3 text-muted-foreground/60">/</span>
                <span className="text-accent">
                  {lensWords(focused.slug, t).name.toUpperCase()}
                </span>
              </>
            ) : null}
          </span>
        </h1>
        <p className="mt-3 text-center text-[15px] text-muted-foreground">
          {focused ? t("lensRoom.subFocused") : t("lensRoom.sub")}
        </p>

        {/* Deux grands objets, composition ample — jamais une grille. */}
        <div className="mt-14 flex flex-col items-stretch justify-center gap-10 md:flex-row md:gap-6">
          {room.map((lens) => {
            const words = lensWords(lens.slug, t);
            const Glyph = GLYPHS[lens.slug];
            const isFocused = focused?.slug === lens.slug;
            const dimmed = focused !== null && !isFocused;
            return (
              <button
                key={lens.slug}
                type="button"
                aria-pressed={isFocused}
                aria-label={
                  isFocused
                    ? t("lensRoom.enterLens", { lens: words.name })
                    : t("lensRoom.focusLens", { lens: words.name })
                }
                onClick={() => {
                  // La règle de la carte : sélectionner, puis descendre.
                  if (isFocused) {
                    navigate(`/explore?sector=${lens.slug}&by=country&split=0`);
                  } else {
                    setParams({ focus: lens.slug });
                  }
                }}
                className={cn(
                  "group flex flex-1 flex-col items-center rounded-2xl px-6 py-10 text-center transition-all duration-500",
                  "hover:bg-surface/60 focus-visible:outline-2 focus-visible:outline-accent",
                  isFocused && "bg-surface/60",
                  dimmed && "scale-[.94] opacity-40 hover:opacity-70",
                )}
              >
                <div
                  className={cn(
                    "h-[240px] w-[240px] transition-transform duration-500 md:h-[300px] md:w-[300px]",
                    isFocused && "scale-105",
                  )}
                >
                  <Glyph awake />
                </div>
                <span className="display-tight mt-6 text-[22px] font-medium">{words.name}</span>
                <span className="mt-2 text-[14px] text-muted-foreground tabular-nums">
                  {t("lensRoom.projects", {
                    count: lens.core + lens.enabling,
                    formatted: formatInt(lens.core + lens.enabling, i18n.language),
                  })}
                  <span className="mx-2 text-muted-foreground/50">·</span>
                  {formatCompactEur(lens.funding_eur, i18n.language)}
                </span>
                <span
                  className={cn(
                    "mt-5 text-[14px] font-medium text-accent transition-opacity duration-300",
                    isFocused ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                  )}
                >
                  {t("lensRoom.enter")} →
                </span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
