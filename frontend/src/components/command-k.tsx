import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { PALETTE_CAPS, useDebouncedValue, useDestinations } from "@/lib/destinations";
import type { DestinationGroup } from "@/lib/destinations";
import { cn } from "@/lib/utils";

/** The command palette, grown into a real APG combobox (Vega lesson U7:
 *  "the search didn't understand what people typed"). As you type it
 *  suggests projects (by acronym), organisations (typo-tolerant, server
 *  trigram), themes and countries (closed vocabularies matched locally,
 *  accent-insensitive, localized via i18n and Intl.DisplayNames) — the
 *  matching extracted into the SHARED destination intelligence
 *  (lib/destinations), the same one the visible bars consume. Arrow
 *  keys drive aria-activedescendant; Enter opens the active option —
 *  full-text search stays the default first option, so the old reflex
 *  (type, Enter) behaves exactly as before. */

const STARTERS = ["Hydrogen", "Artificial intelligence", "Batteries", "Quantum", "Carbon capture"];

type Group = "full" | DestinationGroup;

interface Option {
  id: string;
  group: Group;
  label: string;
  sub?: string;
  flag?: string;
  to: string;
}

interface CommandKProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandK({ open, onOpenChange }: CommandKProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const debounced = useDebouncedValue(q);
  const destinations = useDestinations(q, {
    enabled: open,
    caps: PALETTE_CAPS,
    idPrefix: "ck-opt",
  });

  const options = useMemo<Option[]>(() => {
    const term = q.trim();
    if (term.length < 2) return [];
    return [
      {
        id: "ck-opt-full",
        group: "full" as Group,
        label: t("ck.fullSearch", { q: term }),
        to: `/projects?q=${encodeURIComponent(term)}`,
      },
      ...destinations,
    ];
  }, [q, destinations, t]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      } else if (event.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [debounced]);

  useEffect(() => {
    const id = options[active]?.id;
    if (id) listRef.current?.querySelector(`#${id}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, options]);

  if (!open) return null;

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (options.length === 0 ? 0 : (current + 1) % options.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) =>
        options.length === 0 ? 0 : (current - 1 + options.length) % options.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = options[active] ?? options[0];
      if (target) go(target.to);
      else if (q.trim()) go(`/projects?q=${encodeURIComponent(q.trim())}`);
    }
  };

  const groupLabel = (group: Group) =>
    group === "projects"
      ? t("ck.groupProjects")
      : group === "organisations"
        ? t("ck.groupOrganisations")
        : group === "themes"
          ? t("ck.groupThemes")
          : t("ck.groupCountries");

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/15 backdrop-blur-[2px]"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("searchPlaceholder")}
        onClick={(event) => event.stopPropagation()}
        className="page-enter mx-auto mt-[16vh] w-[min(600px,calc(100vw-32px))] overflow-hidden rounded-2xl border bg-background shadow-key"
      >
        <div className="flex items-center gap-3 border-b px-5">
          <span aria-hidden="true" className="text-muted-foreground">
            ⌕
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={onInputKeyDown}
            type="text"
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls="ck-listbox"
            aria-activedescendant={options[active]?.id}
            aria-autocomplete="list"
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-transparent py-4 text-[17px] outline-none placeholder:text-muted-foreground"
          />
        </div>

        {options.length > 0 ? (
          <div ref={listRef} className="max-h-[46vh] overflow-y-auto py-2">
            <div id="ck-listbox" role="listbox" aria-label={t("searchPlaceholder")}>
              {options.map((option, index) => (
                <div key={option.id}>
                  {index > 0 && option.group !== options[index - 1].group ? (
                    <div
                      role="presentation"
                      className="text-label px-5 pb-1 pt-3 uppercase text-muted-foreground"
                    >
                      {groupLabel(option.group)}
                    </div>
                  ) : null}
                  <div
                    id={option.id}
                    role="option"
                    aria-selected={index === active}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(option.to)}
                    className={cn(
                      "mx-2 flex cursor-pointer items-baseline gap-2.5 rounded-lg px-3 py-2.5 text-[14.5px]",
                      // The active option must be UNMISSABLE in both themes
                      // (recette 2026-08-02: "the arrows don't seem to
                      // work" — they did; the highlight was too faint,
                      // especially in dark): soft bg + a hard accent bar.
                      index === active
                        ? "bg-accent-soft text-accent shadow-[inset_2.5px_0_0_var(--color-accent)]"
                        : "",
                    )}
                  >
                    {option.flag ? <span aria-hidden="true">{option.flag}</span> : null}
                    <span className="min-w-0 leading-snug">{option.label}</span>
                    {option.sub ? (
                      <span className="min-w-0 flex-1 text-[12px] leading-snug text-muted-foreground">
                        {option.sub}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <span className="sr-only" role="status">
              {t("ck.suggestCount", { count: options.length })}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 px-5 py-4">
            {STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => go(`/projects?q=${encodeURIComponent(starter.toLowerCase())}`)}
                className="rounded-full bg-surface px-3.5 py-1.5 text-[13px] transition-colors hover:bg-accent-soft hover:text-accent"
              >
                {starter}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-4 border-t px-5 py-2.5 text-[11px] text-muted-foreground">
          <span>↑↓</span>
          <span>↵</span>
          <span>esc</span>
        </div>
      </div>
    </div>
  );
}
