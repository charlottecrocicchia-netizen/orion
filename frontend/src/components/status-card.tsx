import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Health {
  status: string;
  version: string;
  checks: Record<string, string>;
}

async function fetchHealth(): Promise<Health> {
  const res = await fetch("/api/health");
  // A 503 (degraded) still carries a valid health payload.
  return (await res.json()) as Health;
}

type CheckState = "ok" | "down" | "unknown";

function Dot({ state }: { state: CheckState }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 rounded-full",
        state === "ok" && "bg-success",
        state === "down" && "bg-destructive",
        state === "unknown" && "bg-muted-foreground/40",
      )}
    />
  );
}

function Row({ label, state, text }: { label: string; state: CheckState; text: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-medium">
        <Dot state={state} />
        {text}
      </span>
    </div>
  );
}

export function StatusCard() {
  const { t } = useTranslation();
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });

  const apiState: CheckState = isError ? "down" : data ? "ok" : "unknown";
  const dbState: CheckState =
    isError || !data ? "unknown" : data.checks.database === "ok" ? "ok" : "down";
  const stateText = (state: CheckState) =>
    state === "ok" ? t("status.ok") : state === "down" ? t("status.down") : "—";

  return (
    <Card className="mx-auto w-full max-w-sm text-left">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("status.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <>
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </>
        ) : (
          <>
            <Row label={t("status.api")} state={apiState} text={stateText(apiState)} />
            <Row label={t("status.database")} state={dbState} text={stateText(dbState)} />
            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">{t("status.version")}</span>
              <span className="font-mono text-xs">{data?.version ?? "—"}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
