import { useSyncExternalStore } from "react";

/** The session dossier (lot 4, validated mockup v2): collected Explorer
 *  views, assembled into one editorial page and taken away. A SESSION
 *  object by decision — it lives in this browser (localStorage), accounts
 *  make it durable in P6. Every mutation notifies subscribers so the
 *  header counter stays live. */

export interface DossierItem {
  id: string;
  /** Explorer URL search string (no leading "?") — the view IS a URL. */
  params: string;
  title: string;
  note: string;
  addedAt: string;
}

export interface Dossier {
  title: string;
  items: DossierItem[];
}

const KEY = "orion.dossier.v1";
const EVENT = "orion:dossier";
const EMPTY: Dossier = { title: "", items: [] };

let cache: Dossier | null = null;

function read(): Dossier {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Dossier) : EMPTY;
    cache = {
      title: typeof parsed.title === "string" ? parsed.title : "",
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: Dossier): void {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the in-memory dossier still works for the tab.
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function readDossier(): Dossier {
  return read();
}

/** Adds a view once — the same params never stack up. Returns false when
 *  the view was already collected. */
export function addToDossier(params: string, title: string): boolean {
  const dossier = read();
  const clean = params.replace(/^\?/, "");
  if (dossier.items.some((item) => item.params === clean)) return false;
  write({
    ...dossier,
    items: [
      ...dossier.items,
      {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        params: clean,
        title,
        note: "",
        addedAt: new Date().toISOString().slice(0, 10),
      },
    ],
  });
  return true;
}

export function removeFromDossier(id: string): void {
  const dossier = read();
  write({ ...dossier, items: dossier.items.filter((item) => item.id !== id) });
}

/** Whether this exact view is already in the dossier — the collect
 *  buttons reflect it and become toggles (recette 2026-08-04 : « je ne
 *  peux plus retirer un bloc une fois ajouté » — once added, the button
 *  must know how to undo, right where the hand is). */
export function isCollected(params: string): boolean {
  const clean = params.replace(/^\?/, "");
  return read().items.some((item) => item.params === clean);
}

export function removeByParams(params: string): void {
  const clean = params.replace(/^\?/, "");
  const dossier = read();
  write({ ...dossier, items: dossier.items.filter((item) => item.params !== clean) });
}

export function updateDossierItem(
  id: string,
  changes: Partial<Pick<DossierItem, "title" | "note">>,
): void {
  const dossier = read();
  write({
    ...dossier,
    items: dossier.items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
  });
}

export function moveDossierItem(id: string, delta: -1 | 1): void {
  const dossier = read();
  const index = dossier.items.findIndex((item) => item.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= dossier.items.length) return;
  const items = [...dossier.items];
  [items[index], items[target]] = [items[target], items[index]];
  write({ ...dossier, items });
}

export function setDossierTitle(title: string): void {
  write({ ...read(), title });
}

function subscribe(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      cache = null;
      callback();
    }
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDossier(): Dossier {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function useIsCollected(params: string): boolean {
  const dossier = useSyncExternalStore(subscribe, read, () => EMPTY);
  const clean = params.replace(/^\?/, "");
  return dossier.items.some((item) => item.params === clean);
}
