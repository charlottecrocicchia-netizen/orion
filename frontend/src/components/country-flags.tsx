import { countryFlag } from "@/lib/format";

/** A quiet row of flags, capped, with a "+N" tail. */
export function CountryFlags({ codes, max = 4 }: { codes: string[]; max?: number }) {
  if (codes.length === 0) return null;
  const shown = codes.slice(0, max);
  const rest = codes.length - shown.length;
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {shown.map((code) => (
        <span key={code} title={code} className="text-[13px] leading-none">
          {countryFlag(code)}
        </span>
      ))}
      {rest > 0 ? <span className="ml-0.5 text-[11px] text-muted-foreground">+{rest}</span> : null}
    </span>
  );
}
