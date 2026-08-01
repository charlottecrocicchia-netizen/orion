import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import type { FormEvent } from "react";

const SUGGESTIONS = ["Hydrogen", "Artificial intelligence", "Batteries", "Quantum", "Carbon capture"];

interface CommandKProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandK({ open, onOpenChange }: CommandKProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const go = (q: string) => {
    onOpenChange(false);
    navigate(q ? `/projects?q=${encodeURIComponent(q)}` : "/projects");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    go(String(new FormData(event.currentTarget).get("q") ?? "").trim());
  };

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
        className="page-enter mx-auto mt-[16vh] w-[min(600px,calc(100vw-32px))] overflow-hidden rounded-2xl border bg-background shadow-[0_24px_80px_rgba(29,29,31,.18)] dark:shadow-[0_24px_80px_rgba(0,0,0,.6)]"
      >
        <form onSubmit={submit} className="flex items-center gap-3 border-b px-5">
          <span aria-hidden="true" className="text-muted-foreground">
            ⌕
          </span>
          <input
            ref={inputRef}
            name="q"
            type="text"
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            className="w-full bg-transparent py-4 text-[17px] outline-none placeholder:text-muted-foreground"
          />
        </form>
        <div className="flex flex-wrap gap-2 px-5 py-4">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => go(suggestion.toLowerCase())}
              className="rounded-full bg-surface px-3.5 py-1.5 text-[13px] transition-colors hover:bg-accent-soft hover:text-accent"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-4 border-t px-5 py-2.5 text-[11px] text-muted-foreground">
          <span>↵ {t("search.projectsTab")}</span>
          <span>esc</span>
        </div>
      </div>
    </div>
  );
}
