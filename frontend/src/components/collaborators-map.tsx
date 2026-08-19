import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { useCarriedLens, withLens } from "@/lib/lens";
import { useTranslation } from "react-i18next";

import { useFlatMaps } from "@/lib/flat-geo";
import type { PartnerCountry } from "@/lib/api";
import { formatInt, useCountryName } from "@/lib/format";

/** WHERE the organisation's collaborators live (lot 4 bis, worldwide
 *  since the chantier régions): a choropleth stepped by SHARED PROJECTS
 *  — sequential, one hue, opacity steps, monotone by construction (a
 *  count, not euros: the region palette does not apply here). The map rule holds (fondatrice,
 *  2026-08-02): the FIRST activation selects a country (highlight, the
 *  summary line below), only a second activation of the selected one
 *  opens the country file; keyboard rides the same path. Partners
 *  beyond the map's frame are listed honestly below — never dropped in
 *  silence. */

// The WORLD scope (chantier régions): an organisation's American or
// Asian partners are data, not decor — plus the micro-territory dots
// (a partner in Singapore exists cartographically now).
const STAGE = { width: 900, height: 675 };
const STEPS = [0.12, 0.28, 0.46, 0.66, 0.88];

export function CollaboratorsMap({ data }: { data: PartnerCountry[] }) {
  const carried = useCarriedLens();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const countryName = useCountryName();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);

  const flatData = useFlatMaps();
  const world = useMemo(
    () => flatData?.scopes.world ?? { countries: [], points: [] },
    [flatData],
  );
  const byCode = useMemo(() => new Map(data.map((row) => [row.country, row])), [data]);
  const mapCodes = useMemo(
    () =>
      new Set([
        ...world.countries.map((country) => country.code),
        ...world.points.map((point) => point.code),
      ]),
    [world],
  );
  const onMap = useMemo(() => data.filter((row) => mapCodes.has(row.country)), [data, mapCodes]);
  const offMap = useMemo(() => data.filter((row) => !mapCodes.has(row.country)), [data, mapCodes]);

  const sorted = onMap.map((row) => row.shared_projects).sort((a, b) => a - b);
  const thresholds = [0.2, 0.4, 0.6, 0.8].map(
    (q) => sorted[Math.floor(q * (sorted.length - 1))] ?? 0,
  );
  const stepFor = (value: number) => {
    let index = 0;
    while (index < thresholds.length && value > thresholds[index]) index++;
    return STEPS[Math.min(index, STEPS.length - 1)];
  };

  const summary = selected ? byCode.get(selected) : null;

  const activate = (code: string) => {
    if (code !== selected) {
      setTip(null);
      setSelected(code);
      return;
    }
    navigate(withLens(`/explore/countries/${code}`, carried));
  };

  const moveTip = (event: React.MouseEvent, row: PartnerCountry | undefined, code: string) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      lines: row
        ? [
            countryName(code),
            `${t("org.mapPartners", { count: row.partners })} · ${t("org.mapShared", {
              count: row.shared_projects,
            })}`,
          ]
        : [countryName(code)],
    });
  };

  return (
    <div ref={wrapRef} className="relative">
      <svg viewBox={`0 0 ${STAGE.width} ${STAGE.height}`} className="w-full" role="group" aria-label={t("org.mapAria")}>
        {world.countries.map((country) => {
          const row = byCode.get(country.code);
          const isSelected = selected === country.code;
          return (
            <path
              key={country.code}
              d={country.path}
              data-code={country.code}
              role="button"
              aria-pressed={isSelected}
              tabIndex={0}
              aria-label={
                row
                  ? `${countryName(country.code)} — ${t("org.mapPartners", { count: row.partners })}`
                  : countryName(country.code)
              }
              fill={row ? "var(--color-accent)" : "var(--color-surface)"}
              fillOpacity={
                row ? (isSelected ? Math.min(stepFor(row.shared_projects) + 0.2, 0.95) : stepFor(row.shared_projects)) : 1
              }
              stroke={
                isSelected || hover === country.code
                  ? "var(--color-accent)"
                  : "var(--color-background)"
              }
              strokeWidth={isSelected ? 2 : hover === country.code ? 1.6 : 0.75}
              className="cursor-pointer outline-none transition-[fill-opacity] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              onMouseEnter={(event) => {
                setHover(country.code);
                moveTip(event, row, country.code);
              }}
              onMouseMove={(event) => moveTip(event, byCode.get(country.code), country.code)}
              onMouseLeave={() => {
                setHover(null);
                setTip(null);
              }}
              onClick={() => activate(country.code)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activate(country.code);
                }
              }}
            />
          );
        })}
        {world.points.map((point) => {
          const row = byCode.get(point.code);
          if (!row) return null;
          const isSelected = selected === point.code;
          return (
            <circle
              key={point.code}
              cx={point.cx}
              cy={point.cy}
              r={isSelected || hover === point.code ? 6.5 : 5}
              data-code={point.code}
              role="button"
              aria-pressed={isSelected}
              tabIndex={0}
              aria-label={`${countryName(point.code)} — ${t("org.mapPartners", { count: row.partners })}`}
              fill="var(--color-accent)"
              fillOpacity={Math.max(stepFor(row.shared_projects), 0.46)}
              stroke="var(--color-background)"
              strokeWidth={isSelected ? 2 : 1}
              className="cursor-pointer outline-none transition-[fill-opacity] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              onMouseEnter={(event) => {
                setHover(point.code);
                moveTip(event, row, point.code);
              }}
              onMouseMove={(event) => moveTip(event, row, point.code)}
              onMouseLeave={() => {
                setHover(null);
                setTip(null);
              }}
              onClick={() => activate(point.code)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activate(point.code);
                }
              }}
            />
          );
        })}
      </svg>
      {tip ? (
        <div
          className="pointer-events-none absolute z-10 max-w-[240px] rounded-lg border bg-background px-3 py-2 text-[12px] shadow-key"
          style={{ left: Math.min(tip.x + 14, (wrapRef.current?.clientWidth ?? 300) - 180), top: tip.y + 14 }}
        >
          <p className="font-semibold leading-snug">{tip.lines[0]}</p>
          {tip.lines[1] ? <p className="tnum mt-0.5 text-muted-foreground">{tip.lines[1]}</p> : null}
        </div>
      ) : null}
      {summary ? (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1.5 rounded-xl bg-surface px-4 py-2.5 text-[13px]">
          <b className="font-semibold">{countryName(summary.country)}</b>
          <span className="tnum text-muted-foreground">
            {t("org.mapPartners", { count: summary.partners })} ·{" "}
            {t("org.mapShared", { count: summary.shared_projects })}
          </span>
          <button
            type="button"
            onClick={() => navigate(withLens(`/explore/countries/${summary.country}`, carried))}
            className="ml-auto font-medium text-accent underline-offset-2 hover:underline"
          >
            {t("explorer.mapOpenCountry")} →
          </button>
        </div>
      ) : (
        <p className="mt-3 text-[11.5px] text-muted-foreground">{t("org.mapHint")}</p>
      )}
      {offMap.length > 0 ? (
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          {t("org.mapBeyond")}{" "}
          {offMap.slice(0, 6).map((row, index) => (
            <span key={row.country} className="tnum">
              {index > 0 ? " · " : ""}
              {countryName(row.country)} ({formatInt(row.partners, i18n.language)})
            </span>
          ))}
          {offMap.length > 6 ? ` · +${offMap.length - 6}` : ""}
        </p>
      ) : null}
    </div>
  );
}
