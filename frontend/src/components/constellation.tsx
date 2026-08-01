import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface Point {
  year: number;
  amount_eur: number;
}

/** The hero's curve — the real yearly funding constellation. The line wears
 *  the ultramarine accent (doctrine: "accent outremer sur la courbe") and is
 *  drawn by the shared reveal progress (stroke-dashoffset → 0) while the
 *  figure counts; stars light up as the line reaches them. */
export function Constellation({ data, progress = 1 }: { data: Point[]; progress?: number }) {
  const { i18n } = useTranslation();
  const lineRef = useRef<SVGPolylineElement>(null);
  const [length, setLength] = useState(0);

  // Measured before paint so the dash never flashes fully drawn.
  useLayoutEffect(() => {
    setLength(lineRef.current?.getTotalLength?.() ?? 0);
  }, [data.length]);

  const W = 1120;
  const H = 190;
  const PAD = 10;
  const max = Math.max(...data.map((d) => d.amount_eur), 1);
  const xs = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(data.length - 1, 1);
  const ys = (v: number) => H - PAD - (v / max) * (H - 2 * PAD - 14);
  const points = data.map((d, i) => ({ x: xs(i), y: ys(d.amount_eur), ...d }));
  const peak = points.reduce((a, b) => (b.amount_eur > a.amount_eur ? b : a), points[0]);

  if (data.length < 2) return null;

  const lastIndex = Math.max(points.length - 1, 1);
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
        stroke="var(--color-accent)"
        strokeWidth="1.4"
        strokeOpacity="0.6"
        opacity={length === 0 && progress < 1 ? 0 : 1}
        strokeDasharray={length > 0 ? length : undefined}
        strokeDashoffset={length > 0 ? length * (1 - progress) : 0}
      />
      {points.map((p, i) => (
        <circle
          key={p.year}
          cx={p.x}
          cy={p.y}
          r={p === peak ? 4 : 2 + (2.2 * p.amount_eur) / max}
          fill={p === peak ? "var(--color-accent)" : "var(--color-foreground)"}
          opacity={progress >= (i / lastIndex) * 0.92 ? 1 : 0}
          style={{ transition: "opacity 0.3s ease" }}
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
        opacity={progress > 0.85 ? 1 : 0}
        style={{ transition: "opacity 0.3s ease" }}
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
