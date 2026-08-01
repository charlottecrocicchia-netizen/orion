/** Hair-thin proportional bar under an amount; max is the page maximum. */
export function AmountBar({ value, max }: { value: number | null; max: number }) {
  if (value == null || max <= 0) return null;
  const width = Math.max((value / max) * 100, 1.5);
  return (
    <div aria-hidden="true" className="mt-1.5 h-[3px] w-24 rounded-full bg-surface">
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent to-gradient-to"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
