import { describe, expect, it } from "vitest";

import { readState, toApiParams } from "@/lib/explore-state";

/** La grammaire `hidden=` (chantier légende, 2026-08-22) : identifiants
 *  canoniques dans l'URL, et JAMAIS transmis à l'API — masquer une
 *  série est un état de présentation, le backend rend les mêmes
 *  données. */
describe("explore-state · séries masquées", () => {
  it("lit hidden= en clés canoniques, tilde-séparées", () => {
    const state = readState(new URLSearchParams("by=country&hidden=US~DE"));
    expect(state.hidden).toEqual(["US", "DE"]);
  });

  it("sans paramètre : aucune série masquée (comportement historique)", () => {
    expect(readState(new URLSearchParams("by=country")).hidden).toEqual([]);
    expect(readState(new URLSearchParams("hidden=")).hidden).toEqual([]);
  });

  it("hidden n'atteint JAMAIS l'API — présentation pure", () => {
    const state = readState(new URLSearchParams("by=country&hidden=US~DE&metric=funding"));
    const api = toApiParams(state);
    expect(api.has("hidden")).toBe(false);
    expect(api.get("by")).toBe("country");
  });

  it("un paramètre étranger dans l'URL ne perturbe pas la grammaire", () => {
    const state = readState(new URLSearchParams("hidden=US&unknown=1"));
    expect(state.hidden).toEqual(["US"]);
    expect(toApiParams(state).has("hidden")).toBe(false);
  });
});
