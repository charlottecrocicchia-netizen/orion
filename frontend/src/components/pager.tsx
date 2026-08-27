import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

/** Le pagineur Précédent/Suivant piloté par l'URL (extrait de la
 *  recherche pour être partagé avec B2) : `page=1` est retiré de
 *  l'URL, l'état vit dans les search params — jamais en mémoire. */
export function Pager({
  page,
  hasMore,
  update,
}: {
  page: number;
  hasMore: boolean;
  update: (patch: Record<string, string | null>) => void;
}) {
  const { t } = useTranslation();
  if (page === 1 && !hasMore) return null;
  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => update({ page: page > 2 ? String(page - 1) : null })}
      >
        ← {t("search.previous")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasMore}
        onClick={() => update({ page: String(page + 1) })}
      >
        {t("search.next")} →
      </Button>
    </div>
  );
}
