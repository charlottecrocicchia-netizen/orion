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

/** L'urgence d'une échéance, en registres nommés — le rythme visuel de
 *  la liste (E1.1). Les seuils sont d'affichage, jamais un jugement. */
export function deadlineUrgency(days: number | null): "critical" | "soon" | null {
  if (days == null) return null;
  if (days <= 7) return "critical";
  if (days <= 30) return "soon";
  return null;
}

/** Le jour et le mois d'une échéance, heure de Bruxelles, pour la tête
 *  de rythme (« 26 AUG » / « 26 AOÛT »). */
export function brusselsDayMonth(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    day: "numeric",
    month: "short",
  })
    .format(new Date(iso))
    .replace(/\.$/, "")
    .toUpperCase();
}

/** Le label technique d'un topic, dérivé de son identifiant — un
 *  AFFICHAGE restructuré de la donnée source, jamais une invention :
 *  « HORIZON-CL4-2027-SPACE-03-12 » → « HORIZON-CL4 · SPACE ». Les
 *  années et les numéros de queue sont du versionnement, pas du sens. */
export function callFamilyLabel(identifier: string): string {
  const tokens = identifier
    .split(/[-/]/)
    .filter((token) => /[A-Za-z]/.test(token) && !/^20\d{2}$/.test(token));
  if (tokens.length === 0) return identifier;
  const head = tokens.slice(0, 2).join("-");
  const rest = tokens.slice(2, 4);
  return [head, ...rest].join(" · ");
}

export interface DescriptionSection {
  /** L'intitulé VERBATIM du document source (« : » final retiré), ou
   *  null pour le préambule sans titre. */
  title: string | null;
  html: string;
}

const HEADING_MAX_CHARS = 80;

function isHeadingParagraph(node: Element): boolean {
  if (node.tagName !== "P") return false;
  const text = (node.textContent ?? "").trim();
  if (!text || text.length > HEADING_MAX_CHARS) return false;
  if (text.endsWith(":")) return true;
  // Un paragraphe ENTIÈREMENT en gras est un titre de structure du
  // document (motif ERC constaté : <p><strong><em>…</em></strong></p>).
  const strong = node.querySelector(":scope > strong");
  return strong !== null && (strong.textContent ?? "").trim() === text;
}

/** Découpe le HTML sanitizé d'une description en sections navigables en
 *  RÉUTILISANT les intitulés du document source — interprétation de la
 *  STRUCTURE, jamais du contenu : 100 % texte officiel, zéro
 *  reformulation. Sans intitulé détecté, une seule section sans titre. */
export function splitDescriptionSections(html: string): DescriptionSection[] {
  if (typeof DOMParser === "undefined") return [{ title: null, html }];
  const body = new DOMParser().parseFromString(html, "text/html").body;
  const sections: DescriptionSection[] = [];
  let current: DescriptionSection = { title: null, html: "" };
  for (const node of Array.from(body.children)) {
    if (isHeadingParagraph(node)) {
      if (current.html.trim() || current.title) sections.push(current);
      current = {
        title: (node.textContent ?? "").trim().replace(/:$/, "").trim(),
        html: "",
      };
    } else {
      current.html += node.outerHTML;
    }
  }
  if (current.html.trim() || current.title) sections.push(current);
  return sections.length ? sections : [{ title: null, html }];
}
