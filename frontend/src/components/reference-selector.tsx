import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { moneySymbol } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Le sélecteur de lecture du Reference Engine (R0 § D5, option A) —
 *  LE contrôle, dans sa forme définitive dès R1 : un bouton qui dit la
 *  lecture courante en toutes lettres, un panneau groupé avec une
 *  phrase humaine par mode, les paramètres secondaires révélés sous le
 *  mode choisi (§ D6). R1 ne porte que le groupe VALUE (Nominal /
 *  Real value) ; les groupes suivants s'ajoutent ici, jamais un
 *  contrôle de plus.
 *
 *  Règles gravées : jamais d'option grisée — une année de référence
 *  n'est proposée que si le serveur l'honore (`bases`, meta) ; le choix
 *  écrit l'URL (grammaire `value/base/cur`), jamais un état local. */

export interface ReferenceChange {
  value: string;
  base: number | null;
  cur: string;
}

export function ReferenceSelector({
  value,
  base,
  cur,
  bases,
  resolvedBase,
  onChange,
}: {
  value: string;
  base: number | null;
  cur: string;
  /** Années de référence que le serveur peut honorer (meta.reference.bases). */
  bases: number[];
  /** L'année réellement utilisée par la réponse courante (meta.reference.base). */
  resolvedBase: number | null;
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

  const real = value === "real";
  const year = base ?? resolvedBase;
  const curCode = cur || "EUR";
  const symbol = moneySymbol(curCode.toLowerCase());
  const currentLabel = real
    ? t("explorer.reference.unit", { year: year ?? "", cur: curCode, symbol }).trim()
    : t("explorer.reference.nominal");

  const pick = (mode: "" | "real") =>
    onChange(
      mode === "real"
        ? { value: "real", base: year ?? null, cur }
        : { value: "", base: null, cur: "" },
    );

  const modes: { key: "" | "real"; name: string; hint: string }[] = [
    {
      key: "",
      name: t("explorer.reference.nominal"),
      hint: t("explorer.reference.nominalHint"),
    },
    {
      key: "real",
      name: t("explorer.reference.real"),
      hint: t("explorer.reference.realHint"),
    },
  ];

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
          <p className="mt-2.5 px-1 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {t("explorer.reference.groupValue")}
          </p>
          <div
            role="radiogroup"
            aria-label={t("explorer.reference.groupValue")}
            className="mt-1"
            onKeyDown={(event) => {
              if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) {
                event.preventDefault();
                pick(real ? "" : "real");
              }
            }}
          >
            {modes.map((mode) => (
              <div key={mode.key || "nominal"}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={real === (mode.key === "real")}
                  tabIndex={real === (mode.key === "real") ? 0 : -1}
                  onClick={() => pick(mode.key)}
                  className={cn(
                    "block w-full rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-surface",
                    real === (mode.key === "real") && "bg-surface",
                  )}
                >
                  <span
                    className={cn(
                      "block text-[13.5px]",
                      real === (mode.key === "real") && "font-medium text-accent",
                    )}
                  >
                    {mode.name}
                  </span>
                  <span className="block text-[12px] text-muted-foreground">{mode.hint}</span>
                </button>
                {/* Les paramètres du mode choisi, révélés SOUS lui —
                    seulement les siens (R0 § D6). */}
                {mode.key === "real" && real ? (
                  <div className="mb-1 ml-2.5 mt-0.5 space-y-2 border-l pl-3 pt-1">
                    <label className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="text-muted-foreground">
                        {t("explorer.reference.refYear")}
                      </span>
                      {bases.length > 1 ? (
                        <select
                          value={year ?? ""}
                          onChange={(event) =>
                            onChange({ value: "real", base: Number(event.target.value), cur })
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
                        <b className="tnum font-medium">{year ?? "…"}</b>
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
                                value: "real",
                                base: year ?? null,
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
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
