/** La coupe des labels À L'UNITÉ DE SENS (acquis B2.7 § 15.12 ter,
 *  réutilisé par le fil d'Ariane et les colonnes proportionnelles) :
 *  le nom complet s'il tient, sinon une coupe AVANT la parenthèse ou
 *  le qualificatif (« Horizon 2020 », jamais « Horizon 2020
 *  (2014-2… »), sinon le premier segment, en dernier recours le code
 *  stable du moteur — un code trop long se coupe à une FRONTIÈRE de
 *  segment (« HORIZON-EIC-2021… »), jamais en plein segment. Le nom
 *  complet reste dans l'accessibilité (title + libellé du lien) et
 *  dans le panneau analytique. */
export function displayLabel(
  node: { label: string; code?: string },
  maxWidth: number,
  fontPx: number,
): string {
  // Coefficient volontairement conservateur (0,58 em/caractère) : il
  // vaut mieux couper à l'unité de sens un nom qui aurait tenu que
  // laisser le filet CSS tronquer en pleine parenthèse.
  const fits = (text: string) => text.length * fontPx * 0.58 + 8 <= maxWidth;
  const stripped = node.label.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const beforeParen = node.label.split(" (")[0].trim();
  const firstSegment = node.label.split(" - ")[0].trim();
  for (const candidate of [node.label, stripped, beforeParen, firstSegment]) {
    if (candidate && fits(candidate)) return candidate;
  }
  const last = node.code ?? firstSegment;
  if (fits(last)) return last;
  const segments = last.split("-");
  for (let n = segments.length - 1; n >= 2; n -= 1) {
    const prefix = `${segments.slice(0, n).join("-")}…`;
    if (fits(prefix)) return prefix;
  }
  return last;
}
