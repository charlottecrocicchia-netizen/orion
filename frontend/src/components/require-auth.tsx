import { Navigate, Outlet, useLocation } from "react-router";

import { useMe } from "@/lib/auth";

/** LA frontière front (pivot du 2026-08-22 : Orion est une application
 *  privée). Un seul garde, posé comme route-parent de TOUTES les vues
 *  applicatives — pas de protections dispersées composant par
 *  composant. L'URL demandée est conservée : après connexion, on
 *  revient exactement là où on allait.
 *
 *  Ceinture et bretelles seulement : la vraie sécurité est côté
 *  serveur (middleware /api fermé par défaut) — sans session, l'API ne
 *  répond rien, que le front cache ou non un écran. */
export function RequireAuth() {
  const { me, loading } = useMe();
  const location = useLocation();

  if (loading) return null;
  if (!me) {
    const from = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?from=${from}`} replace />;
  }
  return <Outlet />;
}
