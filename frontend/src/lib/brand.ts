/** The visible brand, in ONE place (Vega lesson U2: renaming was a
 *  nightmare because the name lived everywhere). Sourced from .env so a
 *  rebrand is a one-line change; i18n strings interpolate {{brand}} from
 *  the same constant, index.html reads %VITE_APP_BRAND%. */
export const BRAND: string = import.meta.env.VITE_APP_BRAND ?? "Orion";
