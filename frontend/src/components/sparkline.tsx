interface Point {
  year: number;
  amount_eur: number;
}

/** Tiny activity curve for list rows — shape over precision. */
export function Sparkline({ data }: { data: Point[] }) {
  if (data.length < 2) return null;
  const W = 72;
  const H = 22;
  const PAD = 2;
  const years = data.map((d) => d.year);
  const from = Math.min(...years);
  const to = Math.max(...years);
  const max = Math.max(...data.map((d) => d.amount_eur), 1);
  const byYear = new Map(data.map((d) => [d.year, d.amount_eur]));
  const points: { x: number; y: number }[] = [];
  for (let year = from; year <= to; year++) {
    const value = byYear.get(year) ?? 0;
    points.push({
      x: PAD + ((year - from) * (W - 2 * PAD)) / Math.max(to - from, 1),
      y: H - PAD - (value / max) * (H - 2 * PAD),
    });
  }
  const last = points[points.length - 1];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      aria-hidden="true"
      className="shrink-0 text-accent"
    >
      <polyline
        points={points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.75"
      />
      <circle cx={last.x} cy={last.y} r="2" fill="currentColor" />
    </svg>
  );
}
