import { useTranslation } from "react-i18next";

import { useCountUp } from "@/hooks/use-count-up";
import { formatCompactEur, formatInt } from "@/lib/format";

interface KpiProps {
  value: number | null;
  label: string;
  kind?: "int" | "eur";
  hero?: boolean;
  /** When set, the shared reveal (StatHero) drives the figure instead of
   *  the built-in count-up — one synchronized gesture. */
  progress?: number;
}

export function Kpi({ value, label, kind = "int", hero = false, progress }: KpiProps) {
  const { i18n } = useTranslation();
  const animated = useCountUp(progress == null ? value : null);
  const shown = progress == null ? animated : value == null ? null : value * progress;
  const text =
    kind === "eur"
      ? formatCompactEur(shown, i18n.language)
      : formatInt(shown == null ? null : Math.round(shown), i18n.language);

  return (
    <div>
      <div
        className={
          hero
            ? "display-tight tnum text-[34px] font-semibold"
            : "display-tight tnum text-[28px] font-semibold"
        }
      >
        {text}
      </div>
      <div className="mt-0.5 text-[13px] text-muted-foreground">{label}</div>
    </div>
  );
}

export function KpiStatic({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="display-tight tnum text-[28px] font-semibold">{value}</div>
      <div className="mt-0.5 text-[13px] text-muted-foreground">{label}</div>
    </div>
  );
}
