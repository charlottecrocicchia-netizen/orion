import { useMeasure } from "@/hooks/use-measure";
import type { OrganisationPartner } from "@/lib/api";
import { formatOrgName } from "@/lib/format";

/** The collaboration constellation: the organisation at the center, its
 *  recurring partners around it, edge weight and star size following the
 *  shared-project count. Laid out in real pixels (text keeps a constant,
 *  readable size at every width). Decorative twin of the adjacent list,
 *  which carries the real links and the accessible reading — hence
 *  aria-hidden. */
export function PartnerGraph({
  center,
  partners,
}: {
  center: string;
  partners: OrganisationPartner[];
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  if (partners.length < 2) return null;

  const H = 330;
  const maxShared = Math.max(...partners.map((p) => p.shared_projects), 1);
  const shown = partners.slice(0, 8);

  return (
    <div ref={ref} className="w-full" aria-hidden="true">
      {width > 240 ? (
        (() => {
          const CX = width / 2;
          const CY = H / 2;
          const R = Math.min(width * 0.3, 118);
          const nodes = shown.map((partner, index) => {
            const angle = (index / shown.length) * 2 * Math.PI - Math.PI / 2;
            return {
              partner,
              x: CX + R * Math.cos(angle),
              y: CY + R * Math.sin(angle),
              right: Math.cos(angle) >= -0.05,
              weight: partner.shared_projects / maxShared,
            };
          });
          const short = (name: string) =>
            formatOrgName(name).slice(0, Math.max(Math.floor((width / 2 - R) / 6.2), 10));
          return (
            <svg viewBox={`0 0 ${width} ${H}`} width={width} height={H}>
              {nodes.map(({ partner, x, y, weight }) => (
                <line
                  key={`edge-${partner.id}`}
                  x1={CX}
                  y1={CY}
                  x2={x}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeWidth={0.75 + weight * 2.5}
                />
              ))}
              {nodes.map(({ partner, x, y, right, weight }) => (
                <g key={partner.id}>
                  <circle cx={x} cy={y} r={3 + weight * 4} fill="var(--color-foreground)" />
                  <text
                    x={right ? x + 10 : x - 10}
                    y={y + 4}
                    textAnchor={right ? "start" : "end"}
                    fontSize="11"
                    fill="var(--color-muted-foreground)"
                  >
                    {short(partner.name)}
                  </text>
                </g>
              ))}
              <circle cx={CX} cy={CY} r="7" fill="var(--color-accent)" />
              <text
                x={CX}
                y={CY + 24}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="var(--color-accent)"
              >
                {formatOrgName(center).slice(0, 28)}
              </text>
            </svg>
          );
        })()
      ) : null}
    </div>
  );
}
