/** Helpers des appels (E1) — le fuseau officiel de soumission est celui
 *  de Bruxelles : l'API sert des instants UTC, l'affichage les traduit. */

export function brusselsDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    dateStyle: "medium",
  }).format(new Date(iso));
}

export function brusselsInstant(iso: string, locale: string): string {
  const date = new Date(iso);
  // Minuit UTC pile = une DATE publiée sans heure par le portail :
  // afficher « 02:00 » à Bruxelles fabriquerait une précision que la
  // source n'a pas donnée.
  const dateOnly =
    date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    dateStyle: "medium",
    ...(dateOnly ? {} : { timeStyle: "short" as const }),
  }).format(date);
}

export function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
