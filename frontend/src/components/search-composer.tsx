import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { api } from "@/lib/api";
import { buildCountryNames, countryMatches, stripAccents } from "@/lib/country-match";
import { BAR_CAPS, useDestinations } from "@/lib/destinations";
import type { DestinationGroup } from "@/lib/destinations";
import { countryFlag } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The composable search bar (conception validated 2026-08-02): type
 *  freely, every recognized criterion becomes a TYPED TAG — country,
 *  funder, programme, years — and what nothing recognizes stays free
 *  text (the bilingual search). No expert syntax: the typing comes from
 *  the suggestions, never from the user. The whole state lives in the
 *  page's URL params, so the existing facets pose tags for free and any
 *  composed question is shareable. APG combobox, same keyboard language
 *  as the palette; Backspace on an empty field removes the last tag.
 *
 *  Below the filters, the bar now also proposes DESTINATIONS (recette
 *  2026-08-03: "I type Safran and there is no obvious path to the
 *  Safran page") — organisation and project files, themes, countries —
 *  through the same shared intelligence as the ⌘K palette. Plain Enter
 *  keeps its validated meaning (entity tag, else free text); the
 *  destinations are one arrow press or a click away. */

interface Tag {
  key: "country" | "funder" | "programme" | "years" | "q";
  value: string;
  label: string;
  type: string;
  flag?: string;
}

interface Suggestion {
  id: string;
  label: string;
  type: string;
  flag?: string;
  go?: boolean;
  apply: () => void;
}

export function SearchComposer({
  kind,
  params,
  update,
  toggleMulti,
}: {
  kind: "projects" | "organisations";
  params: URLSearchParams;
  update: (patch: Record<string, string | null>) => void;
  toggleMulti: (key: string, value: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: countriesData } = useQuery({ queryKey: ["countries"], queryFn: api.countries });
  const { data: programmesData } = useQuery({
    queryKey: ["programmes"],
    queryFn: api.programmes,
    enabled: kind === "projects",
  });
  // Defensive: a misbehaving endpoint must degrade to "no suggestions",
  // never crash the page the bar lives on.
  const countries = useMemo(
    () => (Array.isArray(countriesData) ? countriesData : []),
    [countriesData],
  );
  const programmes = useMemo(
    () => (Array.isArray(programmesData) ? programmesData : []),
    [programmesData],
  );

  const displayNames = useMemo(
    () => new Intl.DisplayNames([i18n.language || "en"], { type: "region" }),
    [i18n.language],
  );
  // Names in EVERY match locale (fr, en, extensible) — "Allemagne" under
  // an English interface still poses the country tag (recette bug).
  const matchNames = useMemo(() => buildCountryNames(countries), [countries]);
  const countryName = (code: string) => {
    try {
      return displayNames.of(code) ?? code;
    } catch {
      return code;
    }
  };

  const funders = useMemo(() => {
    const seen = new Map<string, string>();
    for (const programme of programmes) {
      if (!seen.has(programme.funder_code)) seen.set(programme.funder_code, programme.funder_name);
    }
    return [...seen.entries()].map(([code, name]) => ({ code, name }));
  }, [programmes]);

  /* ——— tags, read straight from the URL ——— */
  const tags: Tag[] = useMemo(() => {
    const out: Tag[] = [];
    for (const code of params.getAll("country")) {
      out.push({
        key: "country",
        value: code,
        label: countryName(code),
        type: t("search.composer.typeCountry"),
        flag: countryFlag(code),
      });
    }
    for (const code of params.getAll("funder")) {
      out.push({
        key: "funder",
        value: code,
        label: funders.find((funder) => funder.code === code)?.name ?? code.toUpperCase(),
        type: t("search.composer.typeFunder"),
      });
    }
    for (const id of params.getAll("programme")) {
      out.push({
        key: "programme",
        value: id,
        label: programmes?.find((programme) => String(programme.id) === id)?.label ?? `#${id}`,
        type: t("search.composer.typeProgramme"),
      });
    }
    const from = params.get("year_from");
    const to = params.get("year_to");
    if (from || to) {
      out.push({
        key: "years",
        value: "",
        label: `${from ?? "…"} → ${to ?? "…"}`,
        type: t("search.composer.typeYears"),
      });
    }
    const q = params.get("q");
    if (q) {
      out.push({ key: "q", value: q, label: `« ${q} »`, type: t("search.composer.typeText") });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, funders, programmes, i18n.language, t]);

  const removeTag = (tag: Tag) => {
    if (tag.key === "years") update({ year_from: null, year_to: null });
    else if (tag.key === "q") update({ q: null });
    else toggleMulti(tag.key, tag.value);
    inputRef.current?.focus();
  };

  /* ——— suggestions for the current draft ——— */
  const suggestions: Suggestion[] = useMemo(() => {
    const needle = stripAccents(draft.trim());
    if (needle.length === 0) return [];
    const out: Suggestion[] = [];
    const done = () => {
      setDraft("");
      setActive(0);
      inputRef.current?.focus();
    };

    // Years: "2021" or "2019-2024" / "2019 → 2024".
    const range = /^(\d{4})\s*(?:[-–—>]|->|→)\s*(\d{4})$/.exec(draft.trim());
    const single = /^(19|20)\d{2}$/.test(draft.trim());
    if (range || single) {
      const from = range ? range[1] : draft.trim();
      const to = range ? range[2] : "";
      out.push({
        id: "sc-years",
        label: to ? `${from} → ${to}` : t("search.composer.yearsFrom", { year: from }),
        type: t("search.composer.typeYears"),
        apply: () => {
          update({ year_from: from, year_to: to || null });
          done();
        },
      });
    }

    const already = new Set(params.getAll("country"));
    for (const entry of countries) {
      if (out.length >= 8) break;
      if (already.has(entry.code)) continue;
      const localized = countryName(entry.code);
      if (countryMatches(matchNames.get(entry.code), needle)) {
        out.push({
          id: `sc-c-${entry.code}`,
          label: localized,
          type: t("search.composer.typeCountry"),
          flag: countryFlag(entry.code),
          apply: () => {
            toggleMulti("country", entry.code);
            done();
          },
        });
      }
    }

    if (kind === "projects") {
      const activeFunders = new Set(params.getAll("funder"));
      for (const funder of funders) {
        if (out.length >= 8) break;
        if (activeFunders.has(funder.code)) continue;
        if (stripAccents(funder.name).includes(needle) || stripAccents(funder.code).includes(needle)) {
          out.push({
            id: `sc-f-${funder.code}`,
            label: funder.name,
            type: t("search.composer.typeFunder"),
            apply: () => {
              toggleMulti("funder", funder.code);
              done();
            },
          });
        }
      }
      const activeProgrammes = new Set(params.getAll("programme"));
      let shown = 0;
      for (const programme of programmes) {
        if (out.length >= 8 || shown >= 3) break;
        if (activeProgrammes.has(String(programme.id))) continue;
        if (
          stripAccents(programme.label).includes(needle) ||
          stripAccents(programme.code ?? "").includes(needle)
        ) {
          shown += 1;
          out.push({
            id: `sc-p-${programme.id}`,
            label: programme.label,
            type: t("search.composer.typeProgramme"),
            apply: () => {
              toggleMulti("programme", String(programme.id));
              done();
            },
          });
        }
      }
    }

    // Free text LAST (recette 2026-08-02): when the typing matches an
    // ENTITY, plain Enter poses the tag — "Allemagne" means the country,
    // not a word. Arrow keys still reach the text option.
    out.push({
      id: "sc-text",
      label: t(
        kind === "projects" ? "search.composer.freeText" : "search.composer.freeTextOrgs",
        { q: draft.trim() },
      ),
      type: t("search.composer.typeText"),
      apply: () => {
        update({ q: draft.trim() });
        done();
      },
    });

    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, countries, programmes, funders, matchNames, params, kind, i18n.language, t]);

  // The destinations — the palette's intelligence, one arrow press away.
  const destinations = useDestinations(draft, {
    enabled: focused,
    caps: BAR_CAPS,
    idPrefix: "sc-go",
  });
  const goType = (group: DestinationGroup) =>
    group === "projects"
      ? t("search.composer.typeGoProject")
      : group === "organisations"
        ? t("search.composer.typeGoOrg")
        : group === "themes"
          ? t("search.composer.typeGoTheme")
          : t("search.composer.typeGoCountry");
  const all: Suggestion[] = useMemo(
    () => [
      ...suggestions,
      ...destinations.map((destination) => ({
        id: destination.id,
        label: destination.label,
        type: goType(destination.group),
        flag: destination.flag,
        go: true,
        apply: () => navigate(destination.to),
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestions, destinations, navigate, t],
  );

  const open = focused && all.length > 0;

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && open) {
      event.preventDefault();
      setActive((current) => (current + 1) % all.length);
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      setActive((current) => (current - 1 + all.length) % all.length);
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      (all[active] ?? all[0]).apply();
    } else if (event.key === "Escape" && open) {
      setFocused(false);
    } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-[18px] border bg-background px-4 py-3 transition-shadow duration-200",
          focused ? "shadow-key ring-2 ring-accent" : "",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <span aria-hidden="true" className="text-muted-foreground">
          ⌕
        </span>
        {tags.map((tag) => (
          <span
            key={`${tag.key}-${tag.value}`}
            className="tag-pop inline-flex items-baseline gap-2 rounded-full bg-accent-soft py-1.5 pl-3 pr-1.5 text-[13.5px] font-medium text-accent"
          >
            <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] opacity-70">
              {tag.type}
            </span>
            {tag.flag ? <span aria-hidden="true">{tag.flag}</span> : null}
            <span className="leading-snug">{tag.label}</span>
            <button
              type="button"
              aria-label={t("search.composer.removeTag", { label: tag.label })}
              onClick={(event) => {
                event.stopPropagation();
                removeTag(tag);
              }}
              className="grid h-5 w-5 place-items-center rounded-full text-[11px] opacity-55 transition-opacity hover:bg-accent/15 hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls="sc-listbox"
          aria-activedescendant={open ? all[active]?.id : undefined}
          aria-label={t(
            kind === "projects" ? "search.composer.placeholder" : "search.composer.placeholderOrgs",
          )}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setActive(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onKeyDown={onKeyDown}
          placeholder={
            tags.length === 0
              ? t(
                  kind === "projects"
                    ? "search.composer.placeholder"
                    : "search.composer.placeholderOrgs",
                )
              : ""
          }
          className="min-w-[160px] flex-1 bg-transparent py-1 text-[15.5px] outline-none placeholder:text-muted-foreground"
        />
      </div>

      {open ? (
        <div
          id="sc-listbox"
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+8px)] z-30 max-w-[520px] rounded-xl border bg-background p-1.5 shadow-key"
        >
          {all.map((suggestion, index) => (
            <div key={suggestion.id}>
              {suggestion.go && !all[index - 1]?.go ? (
                <div
                  role="presentation"
                  className="mt-1 border-t border-border-soft px-3.5 pb-1 pt-2.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-foreground"
                >
                  {t("search.composer.groupGoTo")}
                </div>
              ) : null}
              <div
                id={suggestion.id}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => suggestion.apply()}
                className={cn(
                  "flex cursor-pointer items-baseline gap-2.5 rounded-lg px-3.5 py-2.5 text-[14px]",
                  index === active
                    ? "bg-accent-soft text-accent shadow-[inset_2.5px_0_0_var(--color-accent)]"
                    : "",
                )}
              >
                {suggestion.flag ? <span aria-hidden="true">{suggestion.flag}</span> : null}
                <span className="min-w-0 leading-snug">{suggestion.label}</span>
                <span className="ml-auto whitespace-nowrap font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-foreground">
                  {suggestion.go ? `→ ${suggestion.type}` : suggestion.type}
                </span>
              </div>
            </div>
          ))}
          <p className="px-3.5 pb-1 pt-2 text-[10.5px] text-muted-foreground">
            {t("search.composer.hint")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
