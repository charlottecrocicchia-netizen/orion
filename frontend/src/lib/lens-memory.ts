/** La mémoire d'entrée (révision D4, arbitrage ① du 2026-08-20).
 *
 *  Sa règle, gravée : elle ne s'applique QU'À l'arrivée sur la racine
 *  nue — elle pré-cadre ou saute la salle. Elle ne réécrit JAMAIS une
 *  URL qui porte déjà son contexte, et un geste évident en sort :
 *  repasser par la Lens Room. L'URL reste la seule vérité — la
 *  mémoire n'est qu'un raccourci d'entrée.
 *
 *  Valeurs : un slug de lentille, ou "all" (le corpus entier est un
 *  choix de plein droit, jamais un défaut honteux). */

const KEY = "orion.lens.entry";
export const ENTRY_ALL = "all";

export function readEntry(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeEntry(value: string): void {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* stockage indisponible : la salle redeviendra la porte — honnête */
  }
}

export function clearEntry(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* rien à effacer */
  }
}
