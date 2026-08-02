import { useTranslation } from "react-i18next";

import type { ExploreResponse } from "@/lib/api";
import { formatValue, seriesLabel } from "@/lib/format";

/** The accessible twin of every Explorer chart — extracted (lot 3) so the
 *  page board and the Angles slides share one table. */
export function ExploreTable({ data, temporal }: { data: ExploreResponse; temporal: boolean }) {
  const { t, i18n } = useTranslation();
  if (temporal) {
    const years = [
      ...new Set(data.series.flatMap((s) => (s.points ?? []).map((p) => p.year))),
    ].sort((a, b) => a - b);
    return (
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-[.08em]">
              <th className="py-2 pr-3">{t("org.year")}</th>
              {data.series.map((serie) => (
                <th key={String(serie.key)} className="py-2 pr-3 text-right">
                  {seriesLabel(serie, t)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year} className="border-b border-border-soft transition-colors hover:bg-surface/60">
                <td className="tnum py-2 pr-3">{year}</td>
                {data.series.map((serie) => (
                  <td key={String(serie.key)} className="tnum py-2 pr-3 text-right">
                    {formatValue(
                      (serie.points ?? []).find((p) => p.year === year)?.value,
                      data.unit,
                      i18n.language,
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-[.08em]">
          <th className="py-2 pr-3">{t("explorer.tableKey")}</th>
          <th className="py-2 text-right">{t("explorer.tableValue")}</th>
        </tr>
      </thead>
      <tbody>
        {data.series.map((serie) => (
          <tr key={String(serie.key)} className="border-b border-border-soft transition-colors hover:bg-surface/60">
            <td className="py-2 pr-3">{seriesLabel(serie, t)}</td>
            <td className="tnum py-2 text-right font-medium">
              {formatValue(serie.value, data.unit, i18n.language)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
