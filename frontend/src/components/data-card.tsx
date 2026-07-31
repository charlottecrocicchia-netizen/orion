import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SourceStatus {
  source: string;
  projects: number;
  last_success_at: string | null;
}

interface SourcesResponse {
  totals: { projects: number; organisations: number; participations: number };
  sources: SourceStatus[];
}

const SOURCE_LABELS: Record<string, string> = {
  "cordis-horizon": "Horizon Europe",
  "cordis-h2020": "Horizon 2020",
  "cordis-fp7": "FP7",
  anr: "ANR",
  ademe: "ADEME",
  life: "LIFE",
};

async function fetchSources(): Promise<SourcesResponse> {
  const res = await fetch("/api/sources");
  if (!res.ok) throw new Error(`sources: HTTP ${res.status}`);
  return (await res.json()) as SourcesResponse;
}

export function DataCard() {
  const { t, i18n } = useTranslation();
  const { data, isPending, isError } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
    refetchInterval: 60_000,
  });

  const number = new Intl.NumberFormat(i18n.language);
  const day = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });

  return (
    <Card className="w-full text-left">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("data.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <>
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </>
        ) : isError || !data ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : data.totals.projects === 0 ? (
          <p className="text-sm text-muted-foreground">{t("data.empty")}</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("data.projects")}</span>
              <span className="font-medium">{number.format(data.totals.projects)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("data.organisations")}</span>
              <span className="font-medium">{number.format(data.totals.organisations)}</span>
            </div>
            <div className="space-y-2 border-t pt-3">
              {data.sources.map((source) => (
                <div key={source.source} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {SOURCE_LABELS[source.source] ?? source.source}
                  </span>
                  <span className="font-mono">
                    {number.format(source.projects)}
                    {source.last_success_at
                      ? ` · ${day.format(new Date(source.last_success_at))}`
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
