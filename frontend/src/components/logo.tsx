import { BRAND } from "@/lib/brand";

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4.5 19 10 12.5l4.5 1L19.5 5"
          fill="none"
          stroke="var(--color-accent)"
          strokeOpacity=".45"
          strokeWidth="1.3"
        />
        <circle cx="4.5" cy="19" r="1.6" fill="var(--color-foreground)" />
        <circle cx="10" cy="12.5" r="1.6" fill="var(--color-foreground)" />
        <circle cx="14.5" cy="13.5" r="1.6" fill="var(--color-foreground)" />
        <circle cx="19.5" cy="5" r="2" fill="var(--color-accent)" />
      </svg>
      <span className="display-tight text-[17px] font-semibold">{BRAND}</span>
    </div>
  );
}
