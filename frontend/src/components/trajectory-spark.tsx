import { useLayoutEffect, useRef, useState } from "react";

import { useRevealProgress } from "@/hooks/use-reveal-progress";

/** The record pages' trajectory — the entity's yearly funding drawn as one
 *  ultramarine line on entry (doctrine: "courbe temporelle SVG qui se
 *  dessine à l'entrée"), quiet by design: no axis, first/last year only,
 *  the peak dotted. The tables below carry the exact reading. */
export function TrajectorySpark({ data }: { data: { year: number; amount_eur: number }[] }) {
  const lineRef = useRef<SVGPolylineElement>(null);
  const [length, setLength] = useState(0);
  const { ref, progress } = useRevealProgress(data.length > 1, 1000);

  useLayoutEffect(() => {
    setLength(lineRef.current?.getTotalLength?.() ?? 0);
  }, [data.length]);

  if (data.length < 2) return null;

  const W = 640;
  const H = 64;
  const PAD = 4;
  const max = Math.max(...data.map((d) => d.amount_eur), 1);
  const xs = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(data.length - 1, 1);
  const ys = (v: number) => H - PAD - (v / max) * (H - 2 * PAD - 6);
  const points = data.map((d, i) => ({ x: xs(i), y: ys(d.amount_eur), ...d }));
  const peak = points.reduce((a, b) => (b.amount_eur > a.amount_eur ? b : a), points[0]);

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="block w-full" aria-hidden="true">
        <polyline
          ref={lineRef}
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.6"
          strokeOpacity="0.75"
          opacity={length === 0 && progress < 1 ? 0 : 1}
          strokeDasharray={length > 0 ? length : undefined}
          strokeDashoffset={length > 0 ? length * (1 - progress) : 0}
        />
        <circle
          cx={peak.x}
          cy={peak.y}
          r="3"
          fill="var(--color-accent)"
          opacity={progress > 0.8 ? 1 : 0}
          style={{ transition: "opacity 0.3s ease" }}
        />
        <text x={points[0].x} y={H + 13} fontSize="10.5" fill="var(--color-muted-foreground)">
          {points[0].year}
        </text>
        <text
          x={points[points.length - 1].x}
          y={H + 13}
          textAnchor="end"
          fontSize="10.5"
          fill="var(--color-muted-foreground)"
        >
          {points[points.length - 1].year}
        </text>
      </svg>
    </div>
  );
}
