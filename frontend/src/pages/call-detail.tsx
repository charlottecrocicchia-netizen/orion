import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { api, type CallBudgetAction, type CallDetail } from "@/lib/api";
import {
  brusselsDate,
  brusselsInstant,
  daysLeft,
  deadlineUrgency,
  splitDescriptionSections,
} from "@/lib/calls";
import { formatCompactEur, formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

/** /calls/:id — la fiche appel, structurée (E1.1). Le haut de page ne
 *  bouge pas ; le texte source cesse d'être un mur : il est découpé en
 *  sections navigables AUX INTITULÉS DU DOCUMENT (structure interprétée,
 *  contenu jamais reformulé). La zone droite devient la colonne
 *  contextuelle — « En un coup d'œil », classification Orion — et
 *  l'architecture accueillera les « Acteurs historiques » d'E2 en y
 *  ajoutant simplement un bloc : aucune refonte, aucun placeholder. */

const PROSE =
  "max-w-[70ch] text-[14.5px] leading-relaxed [&_a]:text-accent [&_a]:underline-offset-2 hover:[&_a]:underline [&_li]:mt-1 [&_p]:mt-3 [&_p:first-child]:mt-0 [&_table]:mt-3 [&_table]:w-full [&_td]:border-b [&_td]:border-border-soft [&_td]:py-1 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5";

/** Les actions budgétaires DU topic : budgetTopicActionMap liste tout
 *  l'appel, seules les lignes au préfixe du topic le concernent. */
function topicActions(call: CallDetail): CallBudgetAction[] {
  const map = call.budget_overview?.budgetTopicActionMap ?? {};
  const prefix = call.identifier.toUpperCase();
  return Object.values(map)
    .flat()
    .filter((action) => (action.action ?? "").toUpperCase().startsWith(prefix));
}

function GlanceRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-soft py-2 last:border-b-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="tnum text-right text-[13px] font-medium">{children}</dd>
    </div>
  );
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

  const sections = useMemo(
    () => (call?.description_html ? splitDescriptionSections(call.description_html) : []),
    [call?.description_html],
  );

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-[1080px] space-y-4 px-6 pt-12">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!call) {
    return (
      <div className="mx-auto w-full max-w-[1080px] px-6 pt-12">
        <p className="text-[14.5px] text-muted-foreground">{t("calls.notFound")}</p>
        <Link to="/calls" className="mt-4 inline-block text-[13px] text-accent hover:underline">
          ‹ {t("calls.back")}
        </Link>
      </div>
    );
  }

  const remaining = call.status === "open" ? daysLeft(call.next_deadline) : null;
  const urgency = deadlineUrgency(remaining);
  const actions = topicActions(call);
  const titled = sections.filter((section) => section.title);
  // « Dans ce document » : les intitulés du texte source + les blocs de
  // la fiche — seulement quand il y a réellement où naviguer.
  const anchors: { id: string; label: string }[] = [
    ...titled.map((section, index) => ({ id: `doc-${index}`, label: section.title as string })),
    ...(actions.length ? [{ id: "budget", label: t("calls.budgetTitle") }] : []),
    ...(call.conditions_html ? [{ id: "conditions", label: t("calls.conditions") }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-[1080px] px-6 pt-12">
      <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
        <Link to="/calls" className="text-accent underline-offset-2 hover:underline">
          {t("calls.title")}
        </Link>
        <span aria-hidden="true"> › </span>
        <span className="font-mono text-[12px]" translate="no">
          {call.identifier}
        </span>
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
          <span
            className={cn(
              "tnum text-[12.5px]",
              urgency === "critical" ? "font-medium text-accent" : "text-muted-foreground",
            )}
          >
            {t("calls.daysLeft", { count: remaining })}
          </span>
        ) : null}
      </div>
      <h1 className="display-tight mt-3 max-w-[26ch] text-[clamp(24px,3.4vw,34px)] font-semibold leading-tight [text-wrap:balance]">
        {call.title ?? call.identifier}
      </h1>
      <p className="mt-2 text-[13.5px] text-muted-foreground">
        {call.framework_programme?.label ?? call.framework_programme?.code}
        {call.call_code ? (
          <>
            {" · "}
            {t("calls.parentCall")}{" "}
            <span className="font-mono text-[12px]" translate="no">
              {call.call_code}
            </span>
          </>
        ) : null}
      </p>

      <div className="mt-8 flex flex-col gap-10 border-t pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-x-14">
        {/* ---- La colonne contextuelle. Un bloc de plus (E2) s'y
                ajoutera sans refonte. ---- */}
        <aside className="min-w-0 lg:order-2">
          <section aria-label={t("calls.glance")}>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {t("calls.glance")}
            </h2>
            <dl className="mt-2">
              <GlanceRow label={t("calls.glanceStatus")}>
                {t(`calls.status.${call.status}`)}
                {remaining != null ? (
                  <span className={cn("block text-[11.5px] font-normal", urgency === "critical" ? "text-accent" : "text-muted-foreground")}>
                    {t("calls.daysLeft", { count: remaining })}
                  </span>
                ) : null}
              </GlanceRow>
              {call.budget_max_eur != null ? (
                <GlanceRow label={t("calls.budgetContribution")}>
                  {call.budget_min_eur != null && call.budget_min_eur !== call.budget_max_eur
                    ? `${formatCompactEur(call.budget_min_eur, locale)} – ${formatCompactEur(call.budget_max_eur, locale)}`
                    : formatCompactEur(call.budget_max_eur, locale)}
                </GlanceRow>
              ) : null}
              {call.expected_grants ? (
                <GlanceRow label={t("calls.budgetGrants")}>
                  {formatInt(call.expected_grants, locale)}
                </GlanceRow>
              ) : null}
              {call.types_of_action?.length ? (
                <GlanceRow label={t("calls.actionTypes")}>
                  <span className="font-normal">{call.types_of_action.join(", ")}</span>
                </GlanceRow>
              ) : null}
              <GlanceRow label={t("calls.openingDate")}>
                {brusselsDate(call.opening_date, locale)}
              </GlanceRow>
              <GlanceRow label={t("calls.deadlines")}>
                {call.deadline_dates.length
                  ? call.deadline_dates.map((d) => (
                      <span key={d} className="block">
                        {brusselsInstant(d, locale)}
                      </span>
                    ))
                  : "—"}
                <span className="block text-[10.5px] font-normal text-muted-foreground">
                  {t("calls.brusselsTime")}
                  {call.deadline_model ? ` · ${call.deadline_model}` : ""}
                </span>
              </GlanceRow>
            </dl>
          </section>

          {/* La LECTURE Orion — bloc distinct, étiqueté, son pourquoi. */}
          {call.lens_tags.length ? (
            <section
              aria-label={t("calls.orionReading")}
              className="mt-8 rounded-xl border border-accent/30 bg-accent-soft/20 p-4"
            >
              <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
                {t("calls.orionReading")}
              </h2>
              <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                {t("calls.orionReadingDesc")}
              </p>
              <ul className="mt-2.5 space-y-2">
                {call.lens_tags.map((tag) => (
                  <li key={tag.lens} className="text-[13px]">
                    <Link
                      to={`/explore?sector=${tag.lens}`}
                      className="font-medium text-accent underline-offset-2 hover:underline"
                    >
                      {t(`lens.${tag.lens}.name`, { defaultValue: tag.lens })}
                    </Link>
                    <span className="block text-[11.5px] text-muted-foreground">
                      {tag.tag === "core" ? t("calls.tagCore") : t("calls.tagEnabling")}
                      {tag.rule ? (
                        <>
                          {" · "}
                          {t("calls.whyRule")}{" "}
                          <span className="font-mono text-[10.5px]" translate="no">
                            {tag.rule}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {anchors.length >= 2 ? (
            <nav aria-label={t("calls.inThisDocument")} className="mt-8 hidden lg:block">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("calls.inThisDocument")}
              </h2>
              <ul className="mt-2 space-y-1.5 border-l border-border-soft pl-3">
                {anchors.map((anchor) => (
                  <li key={anchor.id}>
                    <a
                      href={`#${anchor.id}`}
                      className="block text-[12.5px] leading-snug text-muted-foreground transition-colors hover:text-accent"
                    >
                      {anchor.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </aside>

        {/* ---- Le document officiel. ---- */}
        <div className="min-w-0 lg:order-1">
          {sections.map((section, index) => (
            <section
              key={index}
              id={section.title ? `doc-${titled.indexOf(section)}` : undefined}
              className={cn("scroll-mt-24", index > 0 && "mt-8")}
            >
              {section.title ? (
                <h2 className="border-b border-border-soft pb-1.5 text-[15px] font-semibold">
                  {section.title}
                </h2>
              ) : null}
              <div
                className={cn(PROSE, section.title && "mt-3")}
                dangerouslySetInnerHTML={{ __html: section.html }}
              />
            </section>
          ))}

          {actions.length ? (
            <section id="budget" aria-label={t("calls.budgetTitle")} className="mt-10 scroll-mt-24 border-t pt-6">
              <h2 className="text-[15px] font-semibold">{t("calls.budgetTitle")}</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
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

          {call.conditions_html ? (
            <details id="conditions" className="mt-8 scroll-mt-24 border-t pt-6">
              <summary className="cursor-pointer text-[15px] font-semibold">
                {t("calls.conditions")}
              </summary>
              <div
                className={cn(PROSE, "mt-3 text-[13.5px] text-muted-foreground")}
                dangerouslySetInnerHTML={{ __html: call.conditions_html }}
              />
            </details>
          ) : null}

          {call.tags?.length || call.keywords?.length ? (
            <p className="mt-8 flex flex-wrap gap-2">
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

          <div className="mt-10 border-t pt-5">
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
            <footer className="mb-4 mt-6 text-[12px] leading-relaxed text-muted-foreground">
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
      </div>
    </div>
  );
}
