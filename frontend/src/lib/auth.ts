import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { DossierItem } from "@/lib/dossier";

/** Le socle comptes (lot 1) : lien magique + cookie de session opaque.
 *  Tout est même-origine — le cookie voyage seul, aucun token côté JS.
 *  La demande de lien répond pareil quoi qu'il arrive (anti-énumération) :
 *  l'interface ne peut donc jamais dire « compte inconnu », et c'est voulu. */

export interface Me {
  email: string;
  display_name: string | null;
  workspaces: { id: number; name: string; role: string }[];
}

export interface SavedDossierMeta {
  id: number;
  title: string;
  created_at: string;
  items_count: number;
}

export interface SavedDossier {
  id: number;
  title: string;
  created_at: string;
  items: DossierItem[];
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const auth = {
  /** 200 constant ; `dev_link` n'existe qu'en mode dev (ORION_AUTH_DEV). */
  requestLink: (email: string) =>
    request<{ status: string; dev_link?: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  /** Lecture sans consommation (verrou 2) : l'adresse masquée d'abord. */
  preview: (token: string) =>
    request<{ email_masked: string; same_browser: boolean }>("/api/auth/verify/preview", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  verify: (token: string) =>
    request<{ email: string }>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  logout: () => request<{ status: string }>("/api/auth/logout", { method: "POST" }),
  deleteAccount: () => request<{ status: string }>("/api/me", { method: "DELETE" }),
  keepDossier: (workspaceId: number, title: string, items: DossierItem[]) =>
    request<{ id: number }>(`/api/workspaces/${workspaceId}/dossiers`, {
      method: "POST",
      body: JSON.stringify({ title, items }),
    }),
  listDossiers: (workspaceId: number) =>
    request<{ dossiers: SavedDossierMeta[] }>(`/api/workspaces/${workspaceId}/dossiers`),
  getDossier: (workspaceId: number, dossierId: number) =>
    request<SavedDossier>(`/api/workspaces/${workspaceId}/dossiers/${dossierId}`),
  deleteDossier: (workspaceId: number, dossierId: number) =>
    request<void>(`/api/workspaces/${workspaceId}/dossiers/${dossierId}`, {
      method: "DELETE",
    }),
};

/** L'identité de la session — null si anonyme. Une seule requête,
 *  partagée par le header, la page dossier et l'espace. */
export function useMe() {
  const { data, isPending, isFetching } = useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      // Toute défaillance (401, réseau, harnais de test sans /api/me)
      // rend l'état ANONYME — le header ne s'effondre jamais.
      try {
        const res = await fetch("/api/me");
        if (!res.ok) return null;
        const body = (await res.json()) as Me;
        // Un corps qui n'a pas la forme d'une identité = anonyme.
        if (typeof body?.email !== "string" || !Array.isArray(body?.workspaces)) return null;
        return body;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  // Un refetch APRÈS invalidation (connexion, déconnexion) compte comme
  // « en cours » tant qu'aucune identité n'est là : sinon le garde de
  // route tranche sur la donnée périmée et vole la redirection du deep
  // link (course constatée en e2e, 2026-08-22).
  return { me: data ?? null, loading: isPending || (isFetching && data == null) };
}

export function useInvalidateMe() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["me"] });
}

/** La déconnexion pose l'identité à null IMMÉDIATEMENT : attendre le
 *  refetch laisse un rendu transitoire « encore connecté » dont les
 *  redirections (home nue → salle → login) volent l'atterrissage sur
 *  la landing (constaté en e2e, 2026-08-22). */
export function useClearMe() {
  const client = useQueryClient();
  return () => {
    client.setQueryData(["me"], null);
    client.invalidateQueries({ queryKey: ["me"] });
  };
}

/** Le workspace personnel du lot 1 : le premier (et seul) de la liste. */
export function personalWorkspace(me: Me | null): { id: number; name: string } | null {
  return me?.workspaces[0] ?? null;
}
