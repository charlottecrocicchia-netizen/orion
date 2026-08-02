import { Link } from "react-router";

/** The elegant phase placeholder (site architecture, fondatrice rules
 *  2026-08-02): a REAL page for a dated future — what arrives, said
 *  plainly over a barely-there ultramarine wash; the bridge to what
 *  already exists; one honest closing line. Refined, not blocky: subtle
 *  gradient, hairlines, soft staggered reveals — no filled slabs, no
 *  form, no waiting list. */

export function PhasePlaceholder({
  eyebrow,
  title,
  titleAccent,
  when,
  features,
  bridgeTitle,
  bridge,
  honest,
}: {
  eyebrow: string;
  /** Title before the gradient words. */
  title: string;
  /** The words wearing the brand gradient. */
  titleAccent: string;
  when: string;
  features: { name: string; desc: string }[];
  bridgeTitle: string;
  bridge: { to: string; label: string }[];
  honest: string;
}) {
  return (
    <div className="relative overflow-hidden">
      {/* The wash: one quiet radial of the brand ultramarine, nothing else. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[-240px] -z-10 h-[560px]"
        style={{
          background:
            "radial-gradient(560px 380px at 50% 0%, color-mix(in srgb, var(--color-accent) 9%, transparent), transparent 70%)",
        }}
      />
      <div className="mx-auto w-full max-w-[760px] px-6 pb-10 pt-20">
        <p
          className="phase-reveal font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
          style={{ animationDelay: "0ms" }}
        >
          {eyebrow}
        </p>
        <h1
          className="phase-reveal display-tight mt-4 max-w-[18ch] text-[clamp(34px,5vw,52px)] font-[520] leading-[1.04] tracking-[-0.026em]"
          style={{ animationDelay: "60ms" }}
        >
          {title} <span className="hero-gradient">{titleAccent}</span>
        </h1>
        <p
          className="phase-reveal mt-4 font-mono text-[12.5px] text-muted-foreground"
          style={{ animationDelay: "120ms" }}
        >
          {when}
        </p>

        <div className="mt-14">
          {features.map((feature, index) => (
            <div
              key={feature.name}
              className="phase-reveal flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-border-soft py-4 first:border-t-0"
              style={{ animationDelay: `${180 + index * 70}ms` }}
            >
              <span className="min-w-[220px] text-[16px] font-semibold">{feature.name}</span>
              <span className="text-[14px] leading-relaxed text-muted-foreground">
                {feature.desc}
              </span>
            </div>
          ))}
        </div>

        <div
          className="phase-reveal mt-14 border-t pt-8"
          style={{ animationDelay: `${180 + features.length * 70 + 80}ms` }}
        >
          <p className="text-[13px] font-semibold tracking-[0.01em]">{bridgeTitle}</p>
          <ul className="mt-3 space-y-1.5">
            {bridge.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="text-[14.5px] text-accent underline-offset-2 hover:underline"
                >
                  {link.label} →
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p
          className="phase-reveal mt-12 text-[12.5px] italic text-muted-foreground"
          style={{ animationDelay: `${180 + features.length * 70 + 160}ms` }}
        >
          {honest}
        </p>
      </div>
    </div>
  );
}
