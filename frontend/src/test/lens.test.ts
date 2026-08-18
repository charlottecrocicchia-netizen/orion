import { describe, expect, it } from "vitest";

import { decideLensState, withoutLens, type LensRegistry } from "@/lib/lens";

const READY: LensRegistry = { status: "ready", slugs: ["space"] };
const PENDING: LensRegistry = { status: "pending" };

/** Les quatre états de l'autorité de lentille (invariant ①, 2026-08-18)
 *  et la grammaire scalaire stricte (U5 renforcé). */
describe("la décision de lentille", () => {
  it("sans paramètre, la vue n'est pas cadrée", () => {
    expect(decideLensState([], READY)).toEqual({ kind: "none" });
  });

  it("une valeur publiée cadre la vue", () => {
    expect(decideLensState(["space"], READY)).toEqual({
      kind: "valid",
      lens: { value: "space", slug: "space", coreOnly: false },
    });
    expect(decideLensState(["space-direct"], READY)).toMatchObject({
      kind: "valid",
      lens: { slug: "space", coreOnly: true },
    });
  });

  it("une valeur inconnue est refusée — jamais un repli sur le corpus", () => {
    expect(decideLensState(["martien"], READY)).toEqual({ kind: "invalid", value: "martien" });
  });

  it("une valeur vide est refusée : le paramètre a été envoyé", () => {
    expect(decideLensState([""], READY)).toEqual({ kind: "invalid", value: "" });
  });

  it("deux occurrences sont refusées, jamais réduites à l'une d'elles", () => {
    expect(decideLensState(["space", "martien"], READY)).toEqual({
      kind: "invalid",
      value: "space,martien",
      reason: "multiple_values",
    });
    // Même deux valeurs VALIDES : la vue est scalaire.
    expect(decideLensState(["space", "space-direct"], READY)).toMatchObject({
      kind: "invalid",
      reason: "multiple_values",
    });
  });

  it("une panne du registre n'est JAMAIS un refus, ni une absence", () => {
    // Le cas qui compte : registre illisible ET valeur inconnue. Sans
    // la distinction, un incident d'infrastructure ferait mentir des
    // liens justes — ici, le front s'abstient et laisse l'API trancher.
    expect(decideLensState(["martien"], PENDING)).toEqual({ kind: "pending" });
    expect(decideLensState(["space"], PENDING)).toEqual({ kind: "pending" });
    // Mais la syntaxe, elle, se juge sans le registre.
    expect(decideLensState(["a", "b"], PENDING)).toMatchObject({ kind: "invalid" });
    expect(decideLensState([""], PENDING)).toMatchObject({ kind: "invalid" });
    expect(decideLensState([], PENDING)).toEqual({ kind: "none" });
  });
});

describe("la porte de sortie du refus", () => {
  it("retire la lentille et PRÉSERVE tout le reste de l'URL", () => {
    expect(
      withoutLens("/explore", "?metric=projects&by=country&sector=martien&q=hydrogen&year_from=2020"),
    ).toBe("/explore?metric=projects&by=country&q=hydrogen&year_from=2020");
  });

  it("retire TOUTES les occurrences du paramètre", () => {
    expect(withoutLens("/projects", "?sector=a&q=x&sector=b")).toBe("/projects?q=x");
  });

  it("sans autre paramètre, il ne reste que le chemin", () => {
    expect(withoutLens("/explore", "?sector=martien")).toBe("/explore");
  });
});
