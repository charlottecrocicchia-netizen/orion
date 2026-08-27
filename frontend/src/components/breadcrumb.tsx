import { Fragment } from "react";
import { Link } from "react-router";

/** Le fil d'Ariane partagé (extrait pour B2, la première surface à
 *  profondeur variable). Sémantique ol/li + `aria-current="page"`,
 *  séparateur décoratif ; mêmes classes que les fils existants
 *  (`text-[13px] text-muted-foreground`, dernier segment en
 *  `text-foreground`) pour ne rien dépayser. */
export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 ? <li aria-hidden="true">›</li> : null}
              <li className="max-w-[32ch] truncate" title={item.label}>
                {item.to && !last ? (
                  <Link to={item.to} className="transition-colors hover:text-foreground">
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? "page" : undefined}
                    className={last ? "text-foreground" : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
