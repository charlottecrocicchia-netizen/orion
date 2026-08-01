import { Link } from "react-router";
import { useTranslation } from "react-i18next";

export interface Exit {
  label: string;
  to: string;
  hint?: string;
}

/** The no-dead-end block: every deep page ends with exits to keep exploring. */
export function ExploreExits({ exits }: { exits: Exit[] }) {
  const { t } = useTranslation();
  if (exits.length === 0) return null;
  return (
    <section className="mt-14 border-t pt-8">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-[.1em] text-muted-foreground">
        {t("explore.exits")}
      </h2>
      <div className="flex flex-wrap gap-2.5">
        {exits.map((exit) => (
          <Link
            key={exit.to + exit.label}
            to={exit.to}
            className="group rounded-full border px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent"
          >
            {exit.label}
            {exit.hint ? (
              <span className="ml-2 text-muted-foreground group-hover:text-accent/70">
                {exit.hint}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
