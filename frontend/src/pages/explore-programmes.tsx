import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatCompactEur } from "@/lib/format";

const VISIBLE_DEFAULT = 12;

export function ExploreProgrammesPage() {
  const { t, i18n } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const { data, isPending } = useQuery({ queryKey: ["programmes"], queryFn: api.programmes });
  const visible = showAll ? data : data?.slice(0, VISIBLE_DEFAULT);

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 pt-12">
      <p className="text-sm font-medium text-accent">{t("explore.title")}</p>
      <h1 className="display-tight mt-1 text-[clamp(28px,4vw,40px)] font-semibold">
        {t("explore.programmesTitle")}
      </h1>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {isPending
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
          : visible?.map((programme) => (
              <Link
                key={programme.id}
                to={`/explore/programmes/${programme.id}`}
                className="group lift rounded-2xl border p-5 hover:border-accent"
              >
                <p className="text-[11px] uppercase tracking-[.08em] text-muted-foreground">
                  {programme.funder_name}
                </p>
                <h2 className="mt-1 text-[17px] font-medium group-hover:text-accent">
                  {programme.label}
                </h2>
                <div className="mt-4 flex items-baseline gap-4">
                  <span className="display-tight tnum text-[22px] font-semibold">
                    {formatCompactEur(programme.funding_eur, i18n.language)}
                  </span>
                  <span className="tnum text-[13px] text-muted-foreground">
                    {t("search.projectsCount", { count: programme.projects_count })}
                  </span>
                </div>
              </Link>
            ))}
      </div>
      {!showAll && (data?.length ?? 0) > VISIBLE_DEFAULT ? (
        <div className="mt-6 text-center">
          <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
            {t("explore.showAll", { count: data?.length ?? 0 })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
