import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface Point {
  year: number;
  amount_eur: number;
}

/** The signature element of direction D: the real yearly funding curve drawn
 *  as a constellation — stars sized by amount, the peak year accented. */
export function Constellation({ data }: { data: Point[] }) {
  const { i18n } = useTranslation();
  const lineRef = useRef<SVGPolylineElement>(null);

  const W = 1120;
  const H = 190;
  const PAD = 10;
  const max = Math.max(...data.map((d) => d.amount_eur), 1);
  const xs = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(data.length - 1, 1);
  const ys = (v: number) => H - PAD - (v / max) * (H - 2 * PAD - 14);
  const points = data.map((d, i) => ({ x: xs(i), y: ys(d.amount_eur), ...d }));
  const peak = points.reduce((a, b) => (b.amount_eur > a.amount_eur ? b : a), points[0]);

  useEffect(() => {
    const line = lineRef.current;
    if (!line || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const length = line.getTotalLength();
    line.style.strokeDasharray = String(length);
    line.style.strokeDashoffset = String(length);
    line.getBoundingClientRect();
    line.style.transition = "stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)";
    requestAnimationFrame(() => {
      line.style.strokeDashoffset = "0";
    });
  }, [data.length]);

  if (data.length < 2) return null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 24}`}
      className="mx-auto block w-full max-w-[1120px]"
      role="img"
      aria-label="Funding per year"
    >
      <polyline
        ref={lineRef}
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth="1"
      />
      {points.map((p) => (
        <circle
          key={p.year}
          cx={p.x}
          cy={p.y}
          r={p === peak ? 4 : 2 + (2.2 * p.amount_eur) / max}
          fill={p === peak ? "var(--color-accent)" : "var(--color-foreground)"}
        />
      ))}
      <text
        x={peak.x - 12}
        y={peak.y + 4}
        textAnchor="end"
        className="tnum"
        fill="var(--color-accent)"
        fontSize="12"
        fontWeight="600"
      >
        €{(peak.amount_eur / 1e9).toLocaleString(i18n.language, { maximumFractionDigits: 1 })}B
      </text>
      {[0, Math.floor(points.length / 2), points.length - 1].map((i) => (
        <text
          key={points[i].year}
          x={points[i].x}
          y={H + 18}
          textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
          fill="var(--color-muted-foreground)"
          fontSize="11"
        >
          {points[i].year}
        </text>
      ))}
    </svg>
  );
}
