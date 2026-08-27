/** B2.4 — les routes-OUTIL (Focus Trace Workspace, conception
 *  § 15.8) : une surface de travail, pas une page éditoriale. Sur ces
 *  routes le Layout ne rend pas le footer et garde l'Outlet monté
 *  d'une étape à l'autre — c'est l'attention qui se déplace dans la
 *  hiérarchie, jamais « une nouvelle page ». */
export function isWorkspaceRoute(pathname: string): boolean {
  return pathname === "/money" || pathname.startsWith("/money/");
}
