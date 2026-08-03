import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatCompactEur } from "@/lib/format";

/** The organisation's yearly timeline with the ROLE split (lot 4 bis):
 *  coordinated euros stacked over participated euros, one thin bar per
 *  year — series-1 under series-2, fixed order, 2px surface gaps, the
 *  top segment rounded at the data end. Hovering a year raises its
 *  tooltip (total, both roles, project count — the second measure lives
 *  HERE, never on a second axis). Identity is never color-alone: the
 *  legend names both roles and the tooltip spells them out. */

interface YearRow {
  year: number;
  amount_eur: number;
  coordinated_eur: number;
  projects: number;
}

const H = 190;
const PAD_TOP = 14;

export function RoleTimeline({ data }: { data: YearRow[] }) {
  const { t, i18n } = useTranslation();
  const [hover, setHover] = useState<number | null>(null);

  const rows = useMemo(() => data.filter((row) => row.year >= 2005), [data]);
  const max = Math.max(...rows.map((row) => row.amount_eur), 1);

  if (rows.length === 0) return null;
  const hovered = hover != null ? rows.find((row) => row.year === hover) : null;

  return (
    <div>
      <div className="flex items-center gap-5 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-series-1" />
          {t("org.roleCoordinated")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-series-2" />
          {t("org.roleParticipated")}
        </span>
        {/* One readout, one place — the hovered year spelled out role by
            role (a floating tooltip collided with the stat row above). */}
        <span aria-live="polite" className="tnum ml-auto text-right">
          {hovered ? (
            <>
              <b className="font-semibold text-foreground">{hovered.year}</b>
              {" · "}
              <span aria-hidden="true" className="mx-1 inline-block h-2 w-2 rounded-[2px] bg-series-1" />
              {formatCompactEur(hovered.coordinated_eur, i18n.language)}
              {" · "}
              <span aria-hidden="true" className="mx-1 inline-block h-2 w-2 rounded-[2px] bg-series-2" />
              {formatCompactEur(hovered.amount_eur - hovered.coordinated_eur, i18n.language)}
              {" · "}
              {t("org.timelineProjects", { count: hovered.projects })}
            </>
          ) : (
            " "
          )}
        </span>
      </div>
      <div
        role="img"
        aria-label={t("org.timelineAria")}
        className="mt-3 flex items-end gap-[3px]"
        style={{ height: H }}
        onPointerLeave={() => setHover(null)}
      >
        {rows.map((row) => {
          const total = Math.max((row.amount_eur / max) * (H - PAD_TOP), 3);
          const coordinated = row.amount_eur > 0 ? (row.coordinated_eur / row.amount_eur) * total : 0;
          const participated = Math.max(total - coordinated, 0);
          const active = hover === row.year;
          return (
            <div
              key={row.year}
              onPointerEnter={() => setHover(row.year)}
              className="group relative flex h-full min-w-0 flex-1 flex-col items-stretch justify-end"
              title={`${row.year} — ${formatCompactEur(row.amount_eur, i18n.language)}`}
            >
              {/* top segment carries the rounded data end */}
              {participated > 0.5 ? (
                <div
                  className="rounded-t-[4px] bg-series-2 transition-opacity"
                  style={{ height: participated, opacity: active || hover == null ? 1 : 0.55 }}
                />
              ) : null}
              {coordinated > 0.5 ? (
                <div
                  className={
                    "bg-series-1 transition-opacity" +
                    (participated > 0.5 ? " mt-[2px]" : " rounded-t-[4px]")
                  }
                  style={{ height: coordinated, opacity: active || hover == null ? 1 : 0.55 }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="tnum mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{rows[0].year}</span>
        <span>{rows[rows.length - 1].year}</span>
      </div>
    </div>
  );
}
