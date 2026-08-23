import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

import { useMeasure } from "@/hooks/use-measure";
import type { ExploreSeries } from "@/lib/api";
import { formatValue, isMoneyUnit, moneySymbol, seriesLabel, wrapLabel } from "@/lib/format";
import { clipSeriesSegments, niceTicks, robustDomain } from "@/lib/trend";

/* Categorical series palette — six distinct hues in a fixed order, anchored on
   the brand ultramarine, validated per theme (CVD separation + contrast) with
   the dataviz validator. Color follows the entity, never its rank. */
const SERIES_COLORS = [
  "var(--color-series-1)",
  "var(--color-series-2)",
  "var(--color-series-3)",
  "var(--color-series-4)",
  "var(--color-series-5)",
  "var(--color-series-6)",
];

interface Tip {
  x: number;
  y: number;
  lines: string[];
}

function TipBox({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 max-w-[260px] rounded-lg bg-foreground px-3 py-2 text-[12px] leading-relaxed text-background shadow-key"
      style={{
        left: tip.x,
        top: tip.y,
        transform: `translate(${tip.x > 480 ? "calc(-100% - 10px)" : "10px"}, -50%)`,
      }}
    >
      {tip.lines.map((line) => (
        <div key={line} className="whitespace-nowrap">
          {line}
        </div>
      ))}
    </div>
  );
}

function ChartShell({
  children,
  height,
}: {
  children: (width: number) => ReactNode;
  height: number;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  return (
    <div ref={ref} className="relative w-full" style={{ minHeight: height }}>
      {width > 0 ? children(width) : null}
    </div>
  );
}

/* ————— Horizontal bars (HTML: native truncation, native a11y) ————— */

export function BarsChart({
  series,
  unit,
  ariaLabel,
}: {
  series: ExploreSeries[];
  unit: string;
  ariaLabel: string;
}) {
  const { t, i18n } = useTranslation();
  const max = Math.max(...series.map((s) => s.value ?? 0), 1);
  return (
    <div role="img" aria-label={ariaLabel}>
      {series.map((serie) => {
        const label = seriesLabel(serie, t);
        const value = formatValue(serie.value, unit, i18n.language);
        return (
          <div
            key={String(serie.key)}
            tabIndex={0}
            aria-label={`${label} — ${value}`}
            className="group flex items-center gap-4 rounded-md px-1 py-2 outline-offset-2 hover:bg-surface/60"
          >
            <span className="w-[220px] shrink-0 text-[13.5px] leading-snug">{label}</span>
            <span className="relative h-[14px] min-w-0 flex-1 overflow-hidden rounded-[4px] bg-surface">
              <span
                className="absolute inset-y-0 left-0 rounded-[4px] bg-gradient-to-r from-accent to-gradient-to transition-[width] duration-700"
                style={{ width: `${Math.max(((serie.value ?? 0) / max) * 100, 0.8)}%` }}
              />
            </span>
            <span className="tnum w-24 shrink-0 text-right text-[13.5px] font-medium">
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ————— Multi-line / area chart ————— */

export function LinesChart({
  series,
  unit,
  ariaLabel,
  unavailableYears,
  unavailableLabel,
  colorOf,
  fullRange = false,
  onFullRange,
}: {
  series: ExploreSeries[];
  unit: string;
  ariaLabel: string;
  /** Reference Engine (arbitrage A1) : les années SANS chiffre real restent
   *  sur l'axe — hachurées, jamais tronquées, jamais un faux zéro.
   *  Absence de chiffre real ≠ absence de l'année ni des projets. */
  unavailableYears?: number[];
  unavailableLabel?: string;
  /** La couleur suit l'ENTITÉ, jamais son rang (doctrine ci-dessus) :
   *  quand la page masque des séries (légende interactive), elle passe
   *  ici la couleur d'origine de chaque clé pour qu'un masquage ne
   *  repeigne jamais les courbes restantes. */
  colorOf?: (key: string) => string;
  /** Échelle d'affichage de la croissance (recette R2) : true = échelle
   *  intégrale. Porté par l'URL (`range=full`) via la page — jamais un
   *  état local : une URL copiée reproduit l'échelle vue. */
  fullRange?: boolean;
  /** Absent = vue rejouée en lecture (deck, dossier) : l'échelle
   *  s'applique, la mention reste, l'action n'apparaît pas. */
  onFullRange?: (full: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [tip, setTip] = useState<Tip | null>(null);
  const clipId = useId();
  const H = 380;
  // The right pad hosts the end-of-line labels, wrapped in full — wide
  // enough for a 24-character line (recette rule: no truncated text).
  const PAD = { top: 16, right: 172, bottom: 28, left: 64 };

  const years = [
    ...new Set(series.flatMap((s) => (s.points ?? []).map((p) => p.year))),
  ].sort((a, b) => a - b);
  const maxValue = Math.max(
    ...series.flatMap((s) => (s.points ?? []).map((p) => p.value ?? 0)),
    1,
  );
  // Le domaine descend sous zéro quand les valeurs le font (croissance
  // annuelle, R2) : une baisse se DESSINE, jamais écrasée sur l'axe.
  // Les montants restent calés sur zéro — leur plancher historique.
  const minValue = Math.min(
    ...series.flatMap((s) => (s.points ?? []).map((p) => p.value ?? 0)),
    0,
  );
  // Croissance annuelle : domaine d'affichage robuste (clôtures de
  // Tukey, lib/trend.ts). null = les clôtures ne mordent pas → échelle
  // complète, aucun contrôle. Les valeurs exactes restent partout.
  const robust =
    unit === "growth"
      ? robustDomain(
          series.flatMap((s) => (s.points ?? []).map((p) => p.value)).filter(
            (v): v is number => v != null,
          ),
        )
      : null;
  const clamped = robust != null && !fullRange;
  const axisMax = clamped ? robust.max : maxValue;
  const axisMin = clamped ? robust.min : minValue;
  const overflows = clamped
    ? series.flatMap((s, index) =>
        (s.points ?? [])
          .filter((p) => p.value != null && (p.value > axisMax || p.value < axisMin))
          .map((p) => ({ serie: s, index, year: p.year, value: p.value as number })),
      )
    : [];
  if (years.length < 2) return null;

  return (
    <ChartShell height={H}>
      {(width) => {
        const single = series.length === 1;
        const padRight = single ? 24 : PAD.right;
        const x = (year: number) =>
          PAD.left +
          ((year - years[0]) * (width - PAD.left - padRight)) /
            Math.max(years[years.length - 1] - years[0], 1);
        const y = (value: number) =>
          H - PAD.bottom - ((value - axisMin) / (axisMax - axisMin)) * (H - PAD.top - PAD.bottom);
        const byYear = (year: number) =>
          series
            .map((serie) => ({
              serie,
              value: (serie.points ?? []).find((p) => p.year === year)?.value ?? null,
            }))
            .filter((entry) => entry.value != null);

        // End-of-line labels anchor on each series' recent peak (the last data
        // year is usually a near-zero stub), then cascade apart and clamp.
        // Long labels wrap to two lines — never truncated — and the cascade
        // reserves the extra line's height.
        const anchor = (serie: ExploreSeries) => {
          const values = (serie.points ?? []).filter((p) => p.value != null).slice(-6);
          const peak = Math.max(...values.map((p) => p.value ?? 0), 0);
          // Échelle robuste : l'ancre du label reste DANS le domaine
          // affiché — un pic hors échelle n'expédie pas son étiquette
          // hors du cadre.
          return Math.min(Math.max(peak, axisMin), axisMax);
        };
        const endLabels = series
          .map((serie, index) => ({
            serie,
            index,
            y: y(anchor(serie)),
            lines: wrapLabel(seriesLabel(serie, t), 22),
          }))
          .sort((a, b) => a.y - b.y);
        for (let i = 1; i < endLabels.length; i++) {
          const need = 15 + (endLabels[i - 1].lines.length - 1) * 12;
          if (endLabels[i].y - endLabels[i - 1].y < need) endLabels[i].y = endLabels[i - 1].y + need;
        }
        const last = endLabels[endLabels.length - 1];
        const overflow = (last ? last.y + (last.lines.length - 1) * 12 : 0) - (H - PAD.bottom - 6);
        if (overflow > 0) for (const label of endLabels) label.y -= overflow;

        const tickLabel = (value: number) =>
          isMoneyUnit(unit) && maxValue >= 995e6
            ? `${moneySymbol(unit)}${(value / 1e9).toLocaleString(i18n.language, { maximumFractionDigits: 1 })}B`
            : formatValue(value, unit, i18n.language);

        const step = years.length > 1 ? (x(years[1]) - x(years[0])) : 24;

        return (
          <>
            <svg viewBox={`0 0 ${width} ${H}`} width={width} height={H} role="img" aria-label={ariaLabel}>
              {/* Growth : graduations humaines alignées sur des pas ronds,
                  zéro TOUJOURS présent (repère sémantique — recette R2) ;
                  le domaine Tukey ne bouge pas. Ailleurs : fractions du
                  domaine, comportement historique. */}
              {(unit === "growth"
                ? niceTicks(axisMin, axisMax)
                : [0, 0.25, 0.5, 0.75, 1].map((f) => axisMin + f * (axisMax - axisMin))
              ).map((tick) => {
                return (
                  <g key={tick}>
                    <line
                      x1={PAD.left}
                      x2={width - padRight}
                      y1={y(tick)}
                      y2={y(tick)}
                      stroke="var(--color-border-soft)"
                    />
                    <text
                      x={PAD.left - 8}
                      y={y(tick) + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill="var(--color-muted-foreground)"
                      className="tnum"
                    >
                      {tickLabel(tick)}
                    </text>
                  </g>
                );
              })}
              {/* La ligne de zéro, à peine plus présente que la grille :
                  sous elle on recule, au-dessus on progresse — l'œil ne
                  doit jamais confondre (croissance annuelle, R2). */}
              {axisMin < 0 ? (
                <line
                  x1={PAD.left}
                  x2={width - padRight}
                  y1={y(0)}
                  y2={y(0)}
                  stroke="var(--color-border)"
                />
              ) : null}
              {years
                .filter((_, index) => index % Math.ceil(years.length / 8) === 0)
                .map((year) => (
                  <text
                    key={year}
                    x={x(year)}
                    y={H - 8}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--color-muted-foreground)"
                    className="tnum"
                  >
                    {year}
                  </text>
                ))}

              {/* La zone « indice non publié » (A1) : sobre,
                  hachurée, l'axe garde l'horizon nominal complet. */}
              {(() => {
                const unavailable = (unavailableYears ?? []).filter((year) =>
                  years.includes(year),
                );
                if (unavailable.length === 0) return null;
                const from = Math.max(x(Math.min(...unavailable)) - step / 2, PAD.left);
                const to = Math.min(x(Math.max(...unavailable)) + step / 2, width - padRight);
                if (to <= from) return null;
                return (
                  <g>
                    <defs>
                      <pattern
                        id="reference-unavailable-hatch"
                        width="6"
                        height="6"
                        patternUnits="userSpaceOnUse"
                        patternTransform="rotate(45)"
                      >
                        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-border)" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect
                      x={from}
                      y={PAD.top}
                      width={to - from}
                      height={H - PAD.top - PAD.bottom}
                      fill="url(#reference-unavailable-hatch)"
                      opacity="0.55"
                    />
                    {/* Le label, TOUJOURS présent (recette R1) : ancré au
                        bord droit de la bande, il déborde sobrement vers
                        la zone vide du graphique quand la bande est
                        étroite — jamais coupé, jamais dominant. */}
                    {unavailableLabel ? (
                      <text
                        x={to - 6}
                        y={PAD.top + 14}
                        textAnchor="end"
                        fontSize="10.5"
                        fill="var(--color-muted-foreground)"
                      >
                        {unavailableLabel}
                      </text>
                    ) : null}
                  </g>
                );
              })()}

              {/* Échelle robuste : les courbes se dessinent à leurs VRAIES
                  coordonnées et sortent du cadre par le clip — la pente
                  reste honnête, le marqueur de débordement dit la valeur
                  exacte au bord. */}
              {clamped ? (
                <defs>
                  <clipPath id={clipId}>
                    <rect
                      x={PAD.left}
                      y={PAD.top}
                      width={width - PAD.left - padRight}
                      height={H - PAD.top - PAD.bottom}
                    />
                  </clipPath>
                </defs>
              ) : null}
              {series.map((serie, index) => {
                const color =
                  colorOf?.(String(serie.key)) ?? SERIES_COLORS[index % SERIES_COLORS.length];
                const pts = (serie.points ?? []).filter((p) => p.value != null);
                const path = pts.map((p) => `${x(p.year).toFixed(1)},${y(p.value ?? 0).toFixed(1)}`);
                // Domaine resserré : la portion hors champ ne se TRACE pas
                // (recette R2) — chaque segment atteint la frontière puis
                // s'interrompt ; le marqueur dit la valeur exacte. x() est
                // linéaire en année : les croisements fractionnaires
                // tombent juste.
                const segments = clamped
                  ? clipSeriesSegments(
                      pts.map((p) => ({ year: p.year, value: p.value as number })),
                      axisMin,
                      axisMax,
                    ).map((segment) =>
                      segment.map((p) => `${x(p.year).toFixed(1)},${y(p.value).toFixed(1)}`),
                    )
                  : [path];
                return (
                  <g key={String(serie.key)} clipPath={clamped ? `url(#${clipId})` : undefined}>
                    {single ? (
                      <polygon
                        points={`${PAD.left},${y(0)} ${path.join(" ")} ${x(pts[pts.length - 1]?.year ?? years[0])},${y(0)}`}
                        fill="var(--color-accent-soft)"
                      />
                    ) : null}
                    {segments.map((segment, si) => (
                      <polyline
                        key={si}
                        points={segment.join(" ")}
                        fill="none"
                        stroke={color}
                        strokeWidth={index === 0 ? 2.4 : 1.8}
                        strokeLinejoin="round"
                      />
                    ))}
                  </g>
                );
              })}

              {/* Les débordements, dits au bord — valeur exacte au survol
                  et au lecteur d'écran, couleur de leur série. */}
              {overflows.map(({ serie, index, year, value }) => {
                const up = value > axisMax;
                const edge = up ? PAD.top + 5 : H - PAD.bottom - 5;
                const tipText = `${seriesLabel(serie, t)} ${year} — ${formatValue(value, unit, i18n.language)}`;
                return (
                  <path
                    key={`overflow-${String(serie.key)}-${year}`}
                    d={
                      up
                        ? `M ${x(year) - 4.5} ${edge + 4} L ${x(year) + 4.5} ${edge + 4} L ${x(year)} ${edge - 4} Z`
                        : `M ${x(year) - 4.5} ${edge - 4} L ${x(year) + 4.5} ${edge - 4} L ${x(year)} ${edge + 4} Z`
                    }
                    fill={colorOf?.(String(serie.key)) ?? SERIES_COLORS[index % SERIES_COLORS.length]}
                    role="img"
                    aria-label={tipText}
                  >
                    <title>{tipText}</title>
                  </path>
                );
              })}
              {!single &&
                endLabels.map(({ serie, index, y: labelY, lines }) => (
                  <text
                    key={String(serie.key)}
                    x={width - padRight + 10}
                    y={labelY + 4}
                    fontSize="12"
                    fontWeight={index === 0 ? 600 : 400}
                    fill={
                      colorOf?.(String(serie.key)) ?? SERIES_COLORS[index % SERIES_COLORS.length]
                    }
                  >
                    {lines.map((line, li) => (
                      <tspan key={li} x={width - padRight + 10} dy={li === 0 ? 0 : 12}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                ))}

              {/* one focusable hover column per year — the a11y + tooltip layer */}
              {years.map((year) => (
                <rect
                  key={year}
                  x={x(year) - step / 2}
                  y={PAD.top}
                  width={step}
                  height={H - PAD.top - PAD.bottom}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${year} — ${byYear(year)
                    .map(
                      (entry) =>
                        `${seriesLabel(entry.serie, t)} ${formatValue(entry.value, unit, i18n.language)}`,
                    )
                    .join(", ")}`}
                  onMouseEnter={() =>
                    setTip({
                      x: x(year),
                      y: 130,
                      lines: [
                        String(year),
                        ...byYear(year).map(
                          (entry) =>
                            `${seriesLabel(entry.serie, t)} · ${formatValue(entry.value, unit, i18n.language)}`,
                        ),
                      ],
                    })
                  }
                  onFocus={() =>
                    setTip({
                      x: x(year),
                      y: 130,
                      lines: [
                        String(year),
                        ...byYear(year).map(
                          (entry) =>
                            `${seriesLabel(entry.serie, t)} · ${formatValue(entry.value, unit, i18n.language)}`,
                        ),
                      ],
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                  onBlur={() => setTip(null)}
                />
              ))}
              {tip ? (
                <line
                  x1={tip.x}
                  x2={tip.x}
                  y1={PAD.top}
                  y2={H - PAD.bottom}
                  stroke="var(--color-border)"
                  strokeDasharray="3 4"
                />
              ) : null}
            </svg>
            {/* La mention sobre + l'action (recette R2) : présentation
                pure — calculs, API et CSV n'en savent rien ; l'URL porte
                l'état (`range=full`) pour que la vue se partage. */}
            {robust != null ? (
              <p className="mt-1 text-right text-[11.5px] text-muted-foreground">
                {clamped ? `${t("explorer.scale.outliers", { count: overflows.length })}` : ""}
                {onFullRange ? (
                  <>
                    {clamped ? " · " : ""}
                    <button
                      type="button"
                      aria-pressed={fullRange}
                      onClick={() => onFullRange(!fullRange)}
                      className="text-accent underline-offset-2 hover:underline"
                    >
                      {clamped ? t("explorer.scale.showFull") : t("explorer.scale.showRobust")}
                    </button>
                  </>
                ) : null}
              </p>
            ) : null}
            <TipBox tip={tip} />
          </>
        );
      }}
    </ChartShell>
  );
}
