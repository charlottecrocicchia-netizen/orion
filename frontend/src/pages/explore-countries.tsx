import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { countryFlag, formatCompactEur, formatInt } from "@/lib/format";

export function ExploreCountriesPage() {
  const { t, i18n } = useTranslation();
  const { data, isPending } = useQuery({ queryKey: ["countries"], queryFn: api.countries });

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 pt-10">
      <p className="text-sm font-medium text-accent">{t("explore.title")}</p>
      <h1 className="display-tight mt-1 text-[clamp(28px,4vw,40px)] font-semibold">
        {t("explore.countriesTitle")}
      </h1>

      <div className="mt-8">
        {isPending
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="mt-3 h-12 w-full" />)
          : data?.map((country, index) => (
              <Link
                key={country.code}
                to={`/explore/countries/${country.code}`}
                className="group flex items-baseline gap-4 border-b border-border-soft py-3.5 transition-colors hover:bg-surface/60"
              >
                <span className="tnum w-7 text-right text-[13px] text-muted-foreground">
                  {index + 1}
                </span>
                <span aria-hidden="true" className="text-lg leading-none">
                  {countryFlag(country.code)}
                </span>
                <span className="font-medium group-hover:text-accent">{country.name}</span>
                {country.eu_member ? (
                  <span className="rounded border px-1.5 py-px text-[10px] uppercase text-muted-foreground">
                    {t("country.euMember")}
                  </span>
                ) : null}
                <span className="tnum ml-auto whitespace-nowrap text-sm text-muted-foreground">
                  {formatInt(country.projects_count, i18n.language)}{" "}
                  {t("org.projects").toLowerCase()}
                </span>
                <span className="display-tight tnum w-24 whitespace-nowrap text-right text-[16px] font-semibold">
                  {formatCompactEur(country.funding_eur, i18n.language)}
                </span>
              </Link>
            ))}
      </div>
    </div>
  );
}
