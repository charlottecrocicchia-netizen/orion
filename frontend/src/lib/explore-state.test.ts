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

/** La grammaire du Reference Engine (R0 § D10) : `value=real&base=2025
 *  &cur=USD` — identifiants stables non traduits, défauts omis, jamais
 *  de combinaison incohérente formée en silence. */
describe("explore-state · mode de lecture (value/base/cur)", () => {
  it("nominal par défaut : aucun paramètre, aucun envoi API", () => {
    const state = readState(new URLSearchParams("by=country"));
    expect(state.value).toBe("");
    expect(state.base).toBeNull();
    expect(state.cur).toBe("");
    const api = toApiParams(state);
    expect(api.has("value")).toBe(false);
    expect(api.has("base")).toBe(false);
    expect(api.has("cur")).toBe(false);
  });

  it("value=real&base=2025&cur=USD voyage vers l'API sous les mêmes noms", () => {
    const state = readState(new URLSearchParams("value=real&base=2025&cur=USD"));
    expect(state.value).toBe("real");
    expect(state.base).toBe(2025);
    expect(state.cur).toBe("USD");
    const api = toApiParams(state);
    expect(api.get("value")).toBe("real");
    expect(api.get("base")).toBe("2025");
    expect(api.get("cur")).toBe("USD");
  });

  it("cur=EUR explicite se normalise vers le défaut omis", () => {
    const state = readState(new URLSearchParams("value=real&base=2025&cur=EUR"));
    expect(state.cur).toBe("");
    expect(toApiParams(state).has("cur")).toBe(false);
  });

  it("base et cur hors mode real sont ignorés — jamais de combinaison incohérente", () => {
    const state = readState(new URLSearchParams("base=2025&cur=USD"));
    expect(state.value).toBe("");
    expect(state.base).toBeNull();
    expect(state.cur).toBe("");
  });

  it("un mode inconnu retombe sur le nominal", () => {
    expect(readState(new URLSearchParams("value=constant")).value).toBe("");
    expect(readState(new URLSearchParams("value=reel")).value).toBe("");
  });

  it("composition avec la légende : value=real&base=2025&cur=USD&hidden=US", () => {
    const state = readState(
      new URLSearchParams("by=country&split=1&value=real&base=2025&cur=USD&hidden=US"),
    );
    expect(state.hidden).toEqual(["US"]);
    expect(state.value).toBe("real");
    const api = toApiParams(state);
    // Le référentiel atteint l'API ; le masquage jamais — deux questions
    // orthogonales (R0 § D9), composables dans la même URL rejouable.
    expect(api.get("value")).toBe("real");
    expect(api.get("base")).toBe("2025");
    expect(api.get("cur")).toBe("USD");
    expect(api.has("hidden")).toBe(false);
  });
});
