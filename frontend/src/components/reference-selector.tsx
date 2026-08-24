import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { moneySymbol } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Le sélecteur de lecture du Reference Engine (R0 § D5, option A) —
 *  LE contrôle, dans sa forme définitive depuis R1 : un bouton qui dit
 *  la lecture courante en toutes lettres, un panneau groupé avec une
 *  phrase humaine par mode, les paramètres secondaires révélés sous le
 *  mode choisi (§ D6). R2 ajoute le groupe TREND (Index 100, Annual
 *  growth) — un groupe de plus dans le MÊME panneau, jamais un
 *  contrôle de plus, et seulement sur les vues à axe temporel
 *  (« le contrôle n'offre que ce que la vue peut honorer », § D4).
 *
 *  Règles gravées : jamais d'option grisée — une année (de référence
 *  ou de base) n'est proposée que si elle est réellement exploitable ;
 *  le choix écrit l'URL, jamais un état local ; changer de mode repart
 *  sur les défauts du mode (l'année de référence de real et l'année de
 *  base d'index sont deux paramètres différents qui partagent `base`,
 *  R0 § D10 — jamais recyclés de l'un vers l'autre). */

export interface ReferenceChange {
  value: string;
  base: number | null;
  cur: string;
}

interface Mode {
  key: string;
  name: string;
  hint: string;
}

export function ReferenceSelector({
  value,
  base,
  cur,
  bases,
  resolvedBase,
  temporal,
  indexBases,
  scaleAvailable = false,
  onChange,
}: {
  value: string;
  base: number | null;
  cur: string;
  /** Années de référence honorées par le serveur pour `real` (meta.reference.bases). */
  bases: number[];
  /** L'année de référence réellement utilisée par la réponse courante. */
  resolvedBase: number | null;
  /** La vue a un axe temporel : le groupe TREND existe. */
  temporal: boolean;
  /** Années de base exploitables pour Index 100 (fenêtre visible). */
  indexBases: number[];
  /** ECONOMIC SCALE (R3) : le groupe existe quand la vue a un
   *  dénominateur résoluble. Le panneau choisit la QUESTION —
   *  micro-description d'une ligne au plus ; la perspective, la
   *  formule et les sources vivent dans ⓘ Reference (verrou de
   *  recette R3). */
  scaleAvailable?: boolean;
  onChange: (next: ReferenceChange) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const refYear = base ?? resolvedBase;
  const curCode = cur || "EUR";
  const symbol = moneySymbol(curCode.toLowerCase());
  const currentLabel =
    value === "real"
      ? t("explorer.reference.unit", { year: refYear ?? "", cur: curCode, symbol }).trim()
      : value === "gdp"
        ? t("explorer.reference.gdpMode")
        : value === "capita"
          ? t("explorer.reference.capitaCurrent", {
              year: refYear ?? "",
              cur: curCode,
              symbol,
            }).trim()
          : value === "index"
            ? t("explorer.reference.indexCurrent", { base: base ?? indexBases[0] ?? "…" })
            : value === "growth"
              ? t("explorer.reference.growthMode")
              : t("explorer.reference.nominal");

  // Changer de mode repart sur SES défauts — jamais l'année d'un autre
  // mode recyclée en silence. Re-cliquer le mode courant ne touche rien
  // (une devise ou une base choisies ne se perdent pas sur un clic).
  const pick = (mode: string) => {
    if (mode === value) return;
    if (mode === "real" || mode === "capita" || mode === "gdp")
      onChange({ value: mode, base: null, cur: "" });
    else if (mode === "index") onChange({ value: "index", base: indexBases[0] ?? null, cur: "" });
    else if (mode === "growth") onChange({ value: "growth", base: null, cur: "" });
    else onChange({ value: "", base: null, cur: "" });
  };

  const groups: { key: string; label: string; modes: Mode[] }[] = [
    {
      key: "value",
      label: t("explorer.reference.groupValue"),
      modes: [
        { key: "", name: t("explorer.reference.nominal"), hint: t("explorer.reference.nominalHint") },
        { key: "real", name: t("explorer.reference.real"), hint: t("explorer.reference.realHint") },
      ],
    },
    ...(scaleAvailable
      ? [
          {
            key: "scale",
            label: t("explorer.reference.groupScale"),
            modes: [
              {
                key: "gdp",
                name: t("explorer.reference.gdpMode"),
                hint: t("explorer.reference.gdpHint"),
              },
              {
                key: "capita",
                name: t("explorer.reference.capitaMode"),
                hint: t("explorer.reference.capitaHint"),
              },
            ],
          },
        ]
      : []),
    ...(temporal
      ? [
          {
            key: "trend",
            label: t("explorer.reference.groupTrend"),
            modes: [
              {
                key: "index",
                name: t("explorer.reference.indexMode"),
                hint: t("explorer.reference.indexHint"),
              },
              {
                key: "growth",
                name: t("explorer.reference.growthMode"),
                hint: t("explorer.reference.growthHint"),
              },
            ],
          },
        ]
      : []),
  ];
  const flatModes = groups.flatMap((group) => group.modes.map((mode) => mode.key));

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[12px] transition-colors hover:border-accent hover:text-accent"
      >
        <span className="text-muted-foreground">{t("explorer.reference.viewAs")}</span>
        <b className="font-medium">{currentLabel}</b>
        <span aria-hidden="true" className="text-[0.7em] opacity-60">
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t("explorer.reference.panelTitle")}
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-[300px] rounded-xl border bg-background p-3 text-left shadow-key"
        >
          <p className="px-1 text-[13px] font-medium">{t("explorer.reference.panelTitle")}</p>
          <div
            role="radiogroup"
            aria-label={t("explorer.reference.panelTitle")}
            onKeyDown={(event) => {
              const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
              if (step == null) return;
              event.preventDefault();
              const at = flatModes.indexOf(value);
              pick(flatModes[(at + step + flatModes.length) % flatModes.length]);
            }}
          >
            {groups.map((group) => (
              <div key={group.key}>
                <p className="mt-2.5 px-1 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  {group.label}
                </p>
                <div className="mt-1">
                  {group.modes.map((mode) => (
                    <div key={mode.key || "nominal"}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={value === mode.key}
                        tabIndex={value === mode.key ? 0 : -1}
                        onClick={() => pick(mode.key)}
                        className={cn(
                          "block w-full rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-surface",
                          value === mode.key && "bg-surface",
                        )}
                      >
                        <span
                          className={cn(
                            "block text-[13.5px]",
                            value === mode.key && "font-medium text-accent",
                          )}
                        >
                          {mode.name}
                        </span>
                        <span className="block text-[12px] text-muted-foreground">{mode.hint}</span>
                      </button>
                      {/* Les paramètres du mode choisi, révélés SOUS lui —
                          seulement les siens (R0 § D6). */}
                      {(mode.key === "real" || mode.key === "capita") && value === mode.key ? (
                        <div className="mb-1 ml-2.5 mt-0.5 space-y-2 border-l pl-3 pt-1">
                          <label className="flex items-center justify-between gap-3 text-[12.5px]">
                            <span className="text-muted-foreground">
                              {t("explorer.reference.refYear")}
                            </span>
                            {bases.length > 1 ? (
                              <select
                                value={refYear ?? ""}
                                onChange={(event) =>
                                  onChange({ value, base: Number(event.target.value), cur })
                                }
                                className="rounded-lg border bg-background px-2 py-1 text-[12.5px]"
                              >
                                {bases.map((candidate) => (
                                  <option key={candidate} value={candidate}>
                                    {candidate}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <b className="tnum font-medium">{refYear ?? "…"}</b>
                            )}
                          </label>
                          <div className="flex items-center justify-between gap-3 text-[12.5px]">
                            <span className="text-muted-foreground">
                              {t("explorer.reference.displayCur")}
                            </span>
                            <div
                              role="radiogroup"
                              aria-label={t("explorer.reference.displayCur")}
                              className="flex gap-0.5 rounded-full border p-0.5"
                            >
                              {["EUR", "USD"].map((candidate) => (
                                <button
                                  key={candidate}
                                  type="button"
                                  role="radio"
                                  aria-checked={curCode === candidate}
                                  onClick={() =>
                                    onChange({
                                      value,
                                      base: refYear ?? null,
                                      cur: candidate === "EUR" ? "" : candidate,
                                    })
                                  }
                                  className={cn(
                                    "rounded-full px-2.5 py-0.5 text-[12px]",
                                    curCode === candidate
                                      ? "bg-foreground text-background"
                                      : "text-muted-foreground transition-colors hover:text-foreground",
                                  )}
                                >
                                  {candidate}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {mode.key === "index" && value === "index" ? (
                        <div className="mb-1 ml-2.5 mt-0.5 border-l pl-3 pt-1">
                          <label className="flex items-center justify-between gap-3 text-[12.5px]">
                            <span className="text-muted-foreground">
                              {t("explorer.reference.baseYear")}
                            </span>
                            {indexBases.length > 1 ? (
                              <select
                                value={base ?? indexBases[0]}
                                onChange={(event) =>
                                  onChange({
                                    value: "index",
                                    base: Number(event.target.value),
                                    cur: "",
                                  })
                                }
                                className="rounded-lg border bg-background px-2 py-1 text-[12.5px]"
                              >
                                {indexBases.map((candidate) => (
                                  <option key={candidate} value={candidate}>
                                    {candidate}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <b className="tnum font-medium">{base ?? indexBases[0] ?? "…"}</b>
                            )}
                          </label>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
