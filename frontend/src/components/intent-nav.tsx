import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import { useCarriedLens, withLens } from "@/lib/lens";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/** The intent navigation (site architecture, validated 2026-08-02): four
 *  verbs instead of table names — Discover, Analyse, Build, Workspace.
 *  Every entry carries its one-line description (that line teaches the
 *  product) and future doors carry a DATED mono badge — never an unmarked
 *  "coming soon", never a dead link. APG disclosure pattern: one panel
 *  open at a time, Escape closes and returns focus, outside click and
 *  route change close. */

interface Entry {
  to?: string;
  label: string;
  desc: string;
  badge?: string;
  isNew?: boolean;
  /** A future feature named honestly — visible, dated, not clickable. */
  disabled?: boolean;
  /** Quiet last line, separated by a hairline. */
  foot?: boolean;
}

function useIntents(): { key: string; label: string; entries: Entry[] }[] {
  const { t } = useTranslation();
  return [
    {
      key: "discover",
      label: t("nav.discover"),
      entries: [
        { to: "/projects", label: t("nav.projects"), desc: t("nav.menu.projectsDesc") },
        {
          to: "/organisations",
          label: t("nav.organisations"),
          desc: t("nav.menu.organisationsDesc"),
        },
        {
          to: "/explore/countries",
          label: t("nav.menu.countries"),
          desc: t("nav.menu.countriesDesc"),
        },
        {
          to: "/explore/programmes",
          label: t("nav.menu.programmes"),
          desc: t("nav.menu.programmesDesc"),
        },
        {
          to: "/explore/themes",
          label: t("nav.menu.themes"),
          desc: t("nav.menu.themesDesc"),
          isNew: true,
        },
        {
          to: "/calls",
          label: t("nav.menu.calls"),
          desc: t("nav.menu.callsDesc"),
        },
        {
          to: "/about-data",
          label: t("nav.menu.aboutData"),
          desc: t("nav.menu.aboutDataDesc"),
          foot: true,
        },
      ],
    },
    {
      key: "analyse",
      label: t("nav.analyse"),
      entries: [
        {
          to: "/analyses",
          label: t("nav.menu.analyses"),
          desc: t("nav.menu.analysesDesc"),
          isNew: true,
        },
        { to: "/explore", label: t("nav.explore"), desc: t("nav.menu.explorerDesc") },
        {
          to: "/nsf-obligations",
          label: t("nav.menu.nsfObligations"),
          desc: t("nav.menu.nsfObligationsDesc"),
          isNew: true,
        },
        { to: "/compare", label: t("nav.menu.compare"), desc: t("nav.menu.compareDesc") },
        {
          to: "/explore?by=theme&split=1",
          label: t("nav.menu.themeTrends"),
          desc: t("nav.menu.themeTrendsDesc"),
        },
      ],
    },
    {
      key: "build",
      label: t("nav.build"),
      entries: [
        { to: "/dossier", label: t("nav.menu.dossier"), desc: t("nav.menu.dossierDesc") },
        {
          label: t("nav.menu.sharedReports"),
          desc: t("nav.menu.sharedReportsDesc"),
          badge: t("nav.menu.p6Badge"),
          disabled: true,
        },
      ],
    },
    {
      key: "workspace",
      label: t("nav.workspace"),
      entries: [
        {
          to: "/workspace",
          label: t("nav.menu.workspaceHome"),
          desc: t("nav.menu.workspaceDesc"),
          badge: t("nav.menu.p6Badge"),
        },
        {
          label: t("nav.menu.alerts"),
          desc: t("nav.menu.alertsDesc"),
          badge: t("nav.menu.alertsBadge"),
          disabled: true,
        },
        { label: t("nav.menu.urlNote"), desc: t("nav.menu.urlNoteDesc"), disabled: true, foot: true },
      ],
    },
  ];
}

export function IntentNav() {
  // La lentille transportée (lot navigation) : chaque entrée du header
  // conserve le cadre de la vue courante — l'URL reste la vérité.
  const carried = useCarriedLens();
  const intents = useIntents();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setOpen(null);
  }, [pathname, search]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        buttonsRef.current[open]?.focus();
        setOpen(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="flex items-center gap-1 text-sm">
      {intents.map((intent) => (
        <div key={intent.key} className="relative">
          <button
            ref={(el) => {
              buttonsRef.current[intent.key] = el;
            }}
            type="button"
            aria-expanded={open === intent.key}
            aria-controls={`nav-${intent.key}`}
            onClick={() => setOpen(open === intent.key ? null : intent.key)}
            className={cn(
              "rounded-full px-3 py-1.5 font-medium transition-colors",
              open === intent.key
                ? "bg-surface text-accent"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {intent.label}
            <span aria-hidden="true" className="ml-1 text-[9px] opacity-50">
              ▾
            </span>
          </button>
          {open === intent.key ? (
            <div
              id={`nav-${intent.key}`}
              className="absolute left-0 top-[calc(100%+10px)] z-40 w-[340px] rounded-2xl border bg-background p-2 shadow-key"
            >
              {intent.entries.map((entry) => {
                const body = (
                  <>
                    <span className="flex items-baseline gap-2.5">
                      <span
                        className={cn(
                          "whitespace-nowrap text-[14px] font-medium",
                          entry.disabled && "text-muted-foreground",
                        )}
                      >
                        {entry.label}
                      </span>
                      {entry.isNew ? (
                        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-accent">
                          {`✧`}
                        </span>
                      ) : null}
                      {entry.badge ? (
                        <span className="ml-auto whitespace-nowrap rounded-md bg-accent-soft px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.05em] text-accent">
                          {entry.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                      {entry.desc}
                    </span>
                  </>
                );
                const rowClass = cn(
                  "block rounded-lg px-3.5 py-2.5",
                  entry.foot && "mt-1.5 border-t border-border-soft pt-3",
                );
                // La surface R5 (/nsf-obligations) ignore la lentille :
                // l'URL rejouable ne la transporte pas — lui donner
                // l'apparence d'un effet serait un mensonge d'URL.
                return entry.to ? (
                  <Link
                    key={entry.label}
                    to={entry.to === "/nsf-obligations" ? entry.to : withLens(entry.to, carried)}
                    className={cn(rowClass, "transition-colors hover:bg-surface")}
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={entry.label} className={rowClass} aria-disabled="true">
                    {body}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
