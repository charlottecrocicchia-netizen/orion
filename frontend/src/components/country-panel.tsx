import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import mapData from "@/lib/europe-map.json";
import photoRegistry from "@/lib/country-photos.json";
import { api } from "@/lib/api";
import type { CountryFlow, CountryIndexEntry } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  countryFlag,
  formatCompactEur,
  formatInt,
  themeLabel,
} from "@/lib/format";

/** The country panel (validated V1): the country's photo under an
 *  ink→ultramarine duotone and a veil, parchment text above, one full CTA
 *  to the country file. Photos come exclusively from the vetted registry
 *  (country-photos.json — per-image Wikimedia licence audit, CC BY credit
 *  rendered from it); countries not yet curated get the abstract duotone
 *  fallback. Esc closes; focus lands on the heading when it opens. */

interface CountryPhoto {
  file: string;
  author: string;
  licence: string;
  source: string;
}

const PHOTOS = (photoRegistry as { photos: Record<string, CountryPhoto> }).photos;
const MAP = mapData as {
  width: number;
  height: number;
  countries: { code: string; path: string; cx: number; cy: number }[];
};

export function CountryPanel({
  code,
  entry,
  rank,
  flows,
  onClose,
}: {
  code: string;
  entry: CountryIndexEntry;
  rank: number;
  flows: CountryFlow[];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const photo: CountryPhoto | undefined = PHOTOS[code];
  const [photoFailed, setPhotoFailed] = useState(false);
  const silhouette = MAP.countries.find((country) => country.code === code);

  const { data: themes } = useQuery({
    queryKey: ["panel-themes", code],
    queryFn: () =>
      api.explore(
        new URLSearchParams({ metric: "funding", by: "theme", country: code, limit: "3" }),
      ),
  });

  useEffect(() => {
    // preventScroll: plain focus() scrolls the page to the heading — the
    // founder's "the page jumps on every click".
    headingRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const partners = flows
    .filter((flow) => flow.a === code || flow.b === code)
    .sort((x, y) => y.amount_eur - x.amount_eur);
  const partnerCount = new Set(partners.map((f) => (f.a === code ? f.b : f.a))).size;
  const topPartners = partners.slice(0, 3).map((flow) => (flow.a === code ? flow.b : flow.a));
  const maxTheme = Math.max(...(themes?.series ?? []).map((s) => s.value ?? 0), 1);

  return (
    <aside
      aria-label={entry.name}
      className="relative flex flex-col overflow-hidden rounded-3xl border text-[#f5f5f7]"
    >
      {/* The photo layer — grayscale under an ultramarine tint (the duotone
          contract), or the abstract duotone when no vetted photo exists. */}
      {/* The photo speaks for itself (founder's call — the duotone tint is
          gone): natural colors under a neutral ink scrim, just enough for
          the parchment text and the CTA. If the growing curation ever turns
          patchwork, a light uniform grade comes back — not the blue flood.
          EAGER on purpose: the panel is user-triggered and shows one image;
          lazy-loading inside a fixed/animated ancestor is the classic
          silent-failure family (recette 2026-08-02, photos reported blank).
          If the image still fails, the abstract gradient takes over rather
          than leaving a bare ink slab. */}
      <div aria-hidden="true" className="absolute inset-0 bg-[#1d1d1f]">
        {photo && !photoFailed ? (
          <img
            src={photo.file}
            alt=""
            decoding="async"
            onError={() => setPhotoFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          // No curated photo yet: an OWNED composition, not a gap — the
          // country's own silhouette as a light watermark over the deep
          // ultramarine ramp (recette 2026-08-02: the fallback must read
          // as an elegant choice).
          <div className="h-full w-full bg-gradient-to-b from-[#3b5cff] via-[#1c2f9e] to-[#101d5e]">
            {silhouette ? (
              <svg
                viewBox={`0 0 ${MAP.width} ${MAP.height}`}
                preserveAspectRatio="xMidYMid slice"
                className="h-full w-full"
              >
                <g
                  transform={`translate(${MAP.width / 2}, ${MAP.height / 2}) scale(3) translate(${-silhouette.cx}, ${-silhouette.cy})`}
                >
                  <path
                    d={silhouette.path}
                    fill="#fff"
                    fillOpacity="0.08"
                    stroke="#fff"
                    strokeOpacity="0.3"
                    strokeWidth="0.7"
                  />
                </g>
              </svg>
            ) : null}
          </div>
        )}
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-[rgba(29,29,31,.34)] via-[rgba(29,29,31,.44)] to-[rgba(29,29,31,.78)]"
      />

      <div className="relative flex-1 p-8 pb-6">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("home.panelClose")}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-white/35 bg-[rgba(29,29,31,.4)] text-[13px] text-white/90 transition-colors hover:bg-[rgba(29,29,31,.7)]"
        >
          ✕
        </button>

        <div className="flex items-baseline gap-3">
          <span aria-hidden="true" className="text-[28px]">
            {countryFlag(code)}
          </span>
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-[clamp(26px,2.6vw,34px)] font-semibold tracking-[-0.022em] outline-none"
          >
            {entry.name}
          </h3>
        </div>
        <p className="mt-2 max-w-[42ch] text-[14.5px] leading-relaxed text-white/85">
          <b className="font-semibold text-white">{t("home.panelRank", { count: rank })}</b>
          {" — "}
          {t("home.panelHook", {
            amount: formatCompactEur(entry.funding_eur, i18n.language),
            projects: formatInt(entry.projects_count, i18n.language),
          })}
        </p>

        <div className="mt-6 flex gap-8">
          <div>
            <div className="tnum text-[22px] font-semibold tracking-[-0.02em]">
              {formatCompactEur(entry.funding_eur, i18n.language)}
            </div>
            <div className="mt-0.5 text-[12px] text-white/70">{t("home.panelFunding")}</div>
          </div>
          <div>
            <div className="tnum text-[22px] font-semibold tracking-[-0.02em]">
              {formatInt(entry.projects_count, i18n.language)}
            </div>
            <div className="mt-0.5 text-[12px] text-white/70">{t("home.panelProjects")}</div>
          </div>
          <div>
            <div className="tnum text-[22px] font-semibold tracking-[-0.02em]">
              {formatInt(partnerCount, i18n.language)}
            </div>
            <div className="mt-0.5 text-[12px] text-white/70">{t("home.panelPartnersCount")}</div>
          </div>
        </div>

        <p className="mt-7 text-label uppercase text-white/80">{t("home.panelThemes")}</p>
        {themes ? (
          <div className="mt-2.5 space-y-2.5">
            {themes.series.map((serie) => (
              <div
                key={String(serie.key)}
                className="grid grid-cols-[158px_minmax(0,1fr)_70px] items-center gap-2.5 text-[12.5px]"
              >
                <span className="leading-snug">
                  {themeLabel(String(serie.key), serie.label, t)}
                </span>
                <span
                  className="h-2 rounded-full bg-gradient-to-r from-[#8b9aff] to-[#dfe4ff]"
                  style={{ width: `${(100 * (serie.value ?? 0)) / maxTheme}%` }}
                />
                <span className="tnum text-right text-white/70">
                  {formatCompactEur(serie.value, i18n.language)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Skeleton className="mt-2.5 h-[76px] w-full bg-white/10" />
        )}

        {topPartners.length > 0 ? (
          <>
            <p className="mt-6 text-label uppercase text-white/80">{t("home.panelPartners")}</p>
            <p className="mt-2 flex gap-5 text-[13.5px] text-white/85">
              {topPartners.map((partner, index) => (
                <span key={partner} className={index === 0 ? "font-semibold text-white" : undefined}>
                  <span aria-hidden="true">{countryFlag(partner)}</span> {partner}
                </span>
              ))}
            </p>
          </>
        ) : null}

        <Link
          to={`/explore/countries/${code}`}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5.5 py-3 text-[15px] font-medium text-[#1d1d1f] transition-transform hover:translate-x-0.5"
        >
          {t("home.panelOpen", { name: entry.name })} →
        </Link>

        {photo && !photoFailed ? (
          <p className="mt-5 font-mono text-[9.5px] tracking-[.03em] text-white/55">
            {t("home.panelPhotoCredit", { author: photo.author, licence: photo.licence })}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
