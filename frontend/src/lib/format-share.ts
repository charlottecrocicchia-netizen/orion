/** Le formatage d'une part (%) partagé entre le focus analytique et
 *  la Constellation Trace. Une part réelle mais minuscule ne
 *  s'affiche JAMAIS « 0 % » — un zéro qui n'en est pas un (esprit
 *  I4) : elle devient « < 0,1 % ». */
export function pct(share: number, locale: string): string {
  if (share > 0 && share < 0.05) {
    return `< ${(0.1).toLocaleString(locale, { maximumFractionDigits: 1 })} %`;
  }
  return `${share.toLocaleString(locale, { maximumFractionDigits: 1 })} %`;
}
