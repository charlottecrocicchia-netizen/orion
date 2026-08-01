import { useEffect, useState } from "react";

interface Point {
  year: number;
  amount_eur: number;
}

export function YearBars({ data }: { data: Point[] }) {
  const [ready, setReady] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.amount_eur), 1);
  const peakYear = data.reduce((a, b) => (b.amount_eur > a.amount_eur ? b : a)).year;

  return (
    <div>
      <div className="flex h-[120px] items-end gap-[5px]" aria-hidden="true">
        {data.map((d) => (
          <div
            key={d.year}
            className={
              d.year === peakYear
                ? "flex-1 origin-bottom rounded-t-md bg-gradient-to-b from-accent to-gradient-to transition-transform duration-1000"
                : "flex-1 origin-bottom rounded-t-md bg-border transition-transform duration-1000"
            }
            style={{
              height: `${Math.max((d.amount_eur / max) * 100, 2)}%`,
              transform: ready ? "scaleY(1)" : "scaleY(0)",
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex gap-[5px]">
        {data.map((d) => (
          <span
            key={d.year}
            className="tnum flex-1 text-center text-[10px] text-muted-foreground"
          >
            {String(d.year).slice(2)}
          </span>
        ))}
      </div>
    </div>
  );
}
