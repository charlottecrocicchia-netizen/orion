import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { api, type CallBudgetAction, type CallDetail } from "@/lib/api";
import { brusselsDate, brusselsInstant, daysLeft } from "@/lib/calls";
import { formatCompactEur, formatInt } from "@/lib/format";

/** /calls/:id — la fiche appel (E1). Structurée pour qu'E2 (« qui a
 *  gagné les appels similaires », par le code d'appel) et E3 (le bloc
 *  analyse) s'y insèrent sans refonte. Les trois vérités restent à
 *  leur place : le fait source en corps de fiche, la lecture Orion dans
 *  son bloc étiqueté, la provenance en pied. */

/** Les actions budgétaires DU topic : budgetTopicActionMap liste tout
 *  l'appel, seules les lignes au préfixe du topic le concernent. */
function topicActions(call: CallDetail): CallBudgetAction[] {
  const map = call.budget_overview?.budgetTopicActionMap ?? {};
  const prefix = call.identifier.toUpperCase();
  return Object.values(map)
    .flat()
    .filter((action) => (action.action ?? "").toUpperCase().startsWith(prefix));
}

export function CallDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { data: call, isPending } = useQuery({
    queryKey: ["call", id],
    queryFn: () => api.call(id ?? ""),
    enabled: Boolean(id),
  });

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-[880px] space-y-4 px-6 pt-12">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!call) {
    return (
      <div className="mx-auto w-full max-w-[880px] px-6 pt-12">
        <p className="text-[14.5px] text-muted-foreground">{t("calls.notFound")}</p>
        <Link to="/calls" className="mt-4 inline-block text-[13px] text-accent hover:underline">
          ‹ {t("calls.back")}
        </Link>
      </div>
    );
  }

  const remaining = call.status === "open" ? daysLeft(call.next_deadline) : null;
  const actions = topicActions(call);

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 pt-12">
      <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
        <Link to="/calls" className="text-accent underline-offset-2 hover:underline">
          {t("calls.title")}
        </Link>
        <span aria-hidden="true"> › </span>
        <span className="font-mono text-[12px]">{call.identifier}</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span
          className={
            call.status === "open"
              ? "inline-flex rounded-full border border-accent/50 bg-accent-soft/40 px-3 py-0.5 text-[12.5px] font-medium text-foreground"
              : "inline-flex rounded-full border border-border px-3 py-0.5 text-[12.5px] text-muted-foreground"
          }
        >
          {t(`calls.status.${call.status}`)}
        </span>
        {remaining != null ? (
          <span className="tnum text-[12.5px] text-muted-foreground">
            {t("calls.daysLeft", { count: remaining })}
          </span>
        ) : null}
      </div>
      <h1 className="display-tight mt-3 text-[clamp(24px,3.4vw,34px)] font-semibold leading-tight">
        {call.title ?? call.identifier}
      </h1>
      <p className="mt-2 text-[13.5px] text-muted-foreground">
        {call.framework_programme?.label ?? call.framework_programme?.code}
        {call.call_code ? (
          <>
            {" · "}
            {t("calls.parentCall")} <span className="font-mono text-[12px]">{call.call_code}</span>
          </>
        ) : null}
      </p>

      {/* Les dates officielles — le fait source. */}
      <section aria-label={t("calls.datesTitle")} className="mt-8 border-t pt-5">
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-3">
          <div>
            <dt className="text-[12px] uppercase tracking-wide text-muted-foreground">
              {t("calls.openingDate")}
            </dt>
            <dd className="tnum mt-1 text-[14.5px] font-medium">
              {brusselsDate(call.opening_date, locale)}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] uppercase tracking-wide text-muted-foreground">
              {t("calls.deadlines")}
            </dt>
            <dd className="tnum mt-1 text-[14.5px] font-medium">
              {call.deadline_dates.length
                ? call.deadline_dates.map((d) => (
                    <span key={d} className="block">
                      {brusselsInstant(d, locale)}
                    </span>
                  ))
                : "—"}
              <span className="block text-[11.5px] font-normal text-muted-foreground">
                {t("calls.brusselsTime")}
                {call.deadline_model ? ` · ${call.deadline_model}` : ""}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[12px] uppercase tracking-wide text-muted-foreground">
              {t("calls.actionTypes")}
            </dt>
            <dd className="mt-1 text-[14.5px]">
              {call.types_of_action?.length ? call.types_of_action.join(", ") : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Le budget par action — vertical, jamais de barres horizontales. */}
      {actions.length ? (
        <section aria-label={t("calls.budgetTitle")} className="mt-8 border-t pt-5">
          <h2 className="text-[15px] font-semibold">{t("calls.budgetTitle")}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b text-left text-[12px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">{t("calls.budgetAction")}</th>
                  <th className="tnum py-2 pr-4 text-right font-medium">
                    {t("calls.budgetContribution")}
                  </th>
                  <th className="tnum py-2 text-right font-medium">{t("calls.budgetGrants")}</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((action, index) => (
                  <tr key={index} className="border-b border-border-soft align-baseline">
                    <td className="py-2 pr-4">{action.action ?? "—"}</td>
                    <td className="tnum whitespace-nowrap py-2 pr-4 text-right">
                      {action.minContribution && action.maxContribution
                        ? action.minContribution === action.maxContribution
                          ? formatCompactEur(action.maxContribution, locale)
                          : `${formatCompactEur(action.minContribution, locale)} – ${formatCompactEur(action.maxContribution, locale)}`
                        : "—"}
                    </td>
                    <td className="tnum py-2 text-right">
                      {action.expectedGrants ? formatInt(action.expectedGrants, locale) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Description et conditions — HTML sanitizé côté serveur. */}
      {call.description_html ? (
        <section aria-label={t("calls.description")} className="mt-8 border-t pt-5">
          <h2 className="text-[15px] font-semibold">{t("calls.description")}</h2>
          <div
            className="prose-orion mt-3 max-w-[70ch] text-[14.5px] leading-relaxed [&_a]:text-accent [&_a]:underline-offset-2 hover:[&_a]:underline [&_li]:mt-1 [&_p]:mt-3 [&_table]:mt-3 [&_table]:w-full [&_td]:border-b [&_td]:border-border-soft [&_td]:py-1 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: call.description_html }}
          />
        </section>
      ) : null}
      {call.conditions_html ? (
        <details className="mt-6 border-t pt-5">
          <summary className="cursor-pointer text-[15px] font-semibold">
            {t("calls.conditions")}
          </summary>
          <div
            className="mt-3 max-w-[70ch] text-[13.5px] leading-relaxed text-muted-foreground [&_a]:text-accent [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: call.conditions_html }}
          />
        </details>
      ) : null}

      {/* Mots-clés du portail — le fait source, en pastilles sobres. */}
      {call.tags?.length || call.keywords?.length ? (
        <p className="mt-6 flex flex-wrap gap-2">
          {(call.tags ?? call.keywords ?? []).map((word) => (
            <span
              key={word}
              className="rounded-full bg-surface px-2.5 py-0.5 text-[12px] text-muted-foreground"
            >
              {word}
            </span>
          ))}
        </p>
      ) : null}

      {/* La LECTURE Orion — bloc distinct, étiqueté, avec son pourquoi. */}
      {call.lens_tags.length ? (
        <section
          aria-label={t("calls.orionReading")}
          className="mt-8 rounded-xl border border-accent/30 bg-accent-soft/20 p-5"
        >
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-accent">
            {t("calls.orionReading")}
          </h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">{t("calls.orionReadingDesc")}</p>
          <ul className="mt-3 space-y-2">
            {call.lens_tags.map((tag) => (
              <li key={tag.lens} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link
                  to={`/explore?sector=${tag.lens}`}
                  className="text-[14px] font-medium text-accent underline-offset-2 hover:underline"
                >
                  {t(`lens.${tag.lens}.name`, { defaultValue: tag.lens })}
                </Link>
                <span className="text-[12.5px] text-muted-foreground">
                  {tag.tag === "core" ? t("calls.tagCore") : t("calls.tagEnabling")}
                  {tag.rule ? (
                    <>
                      {" · "}
                      {t("calls.whyRule")} <span className="font-mono text-[11.5px]">{tag.rule}</span>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* La sortie officielle + la provenance. */}
      <div className="mt-8 border-t pt-5">
        {call.url ? (
          <a
            href={call.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[13.5px] font-medium text-white transition-opacity hover:opacity-90"
          >
            {t("calls.viewSource")} →
          </a>
        ) : null}
        <footer className="mb-4 mt-6 font-mono text-[11px] leading-relaxed text-muted-foreground">
          <p>
            {t("calls.sourceStatus")} : {call.source_status.label ?? call.source_status.code ?? "—"}
            {call.last_seen_at
              ? ` · ${t("calls.lastSeen", {
                  date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                    new Date(call.last_seen_at),
                  ),
                })}`
              : ""}
          </p>
          <p>{t("calls.attribution")}</p>
        </footer>
      </div>
    </div>
  );
}
