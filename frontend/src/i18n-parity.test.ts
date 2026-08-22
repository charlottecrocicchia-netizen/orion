import { describe, expect, it } from "vitest";

import i18n from "@/i18n";

/** Le filet i18n (bug de recette E3, 2026-08-22) : deux régressions à
 *  rendre impossibles — une clé posée dans un espace de noms en une
 *  seule langue (elle s'affiche brute dans l'autre), et des arbres
 *  EN/FR qui divergent en silence. EN = entièrement EN, FR =
 *  entièrement FR : la première condition est que CHAQUE clé existe
 *  des deux côtés, au même endroit. */

function keyPaths(node: unknown, prefix = ""): string[] {
  if (typeof node !== "object" || node === null) return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    keyPaths(value, prefix ? `${prefix}.${key}` : key),
  );
}

/** Exceptions DÉCLARÉES, jamais silencieuses : `themes.*` n'existe
 *  qu'en français PAR CONSTRUCTION — ce sont les traductions des
 *  libellés euroSciVoc, dont l'anglais vient de la donnée elle-même. */
const FR_ONLY_PREFIXES = ["themes."];

describe("parité des arbres de traduction", () => {
  const en = keyPaths(i18n.getResourceBundle("en", "translation")).sort();
  const fr = keyPaths(i18n.getResourceBundle("fr", "translation")).sort();

  it("chaque clé anglaise existe en français, au même chemin", () => {
    const missing = en.filter((key) => !fr.includes(key));
    expect(missing).toEqual([]);
  });

  it("chaque clé française existe en anglais, au même chemin", () => {
    const missing = fr.filter(
      (key) => !en.includes(key) && !FR_ONLY_PREFIXES.some((p) => key.startsWith(p)),
    );
    expect(missing).toEqual([]);
  });
});
