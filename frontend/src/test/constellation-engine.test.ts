/** B2.7 — le moteur de transition de la Constellation Trace, contre
 *  l'addendum technique : états explicites, LCP, transaction visuelle,
 *  réponses obsolètes ignorées, previews hors du chemin committé,
 *  déterminisme absolu (mêmes entrées → mêmes états). Une transition
 *  jolie mais non déterministe n'est pas acceptable. */

import { describe, expect, it } from "vitest";

import {
  ConstellationEngine,
  constellationKey,
  diffPaths,
  type ConstellationNode,
} from "@/lib/constellation-engine";

const n = (level: string, id: string): ConstellationNode => ({ level, id });

const EC = n("funder", "ec");
const H2020 = n("programme", "h2020");
const ERC = n("programme", "erc");
const CALL = n("call", "call");
const MARS = n("project", "mars");
const MSCA = n("programme", "msca");
const CALL2 = n("call", "call2");

describe("constellation engine — diffPaths (LCP)", () => {
  it("l'exemple canonique de l'addendum : persist/exit/enter/pivot", () => {
    const diff = diffPaths([EC, H2020, ERC, CALL, MARS], [EC, H2020, MSCA, CALL2]);
    expect(diff.persist.map(constellationKey)).toEqual(["funder:ec", "programme:h2020"]);
    expect(diff.exit.map(constellationKey)).toEqual([
      "programme:erc",
      "call:call",
      "project:mars",
    ]);
    expect(diff.enter.map(constellationKey)).toEqual(["programme:msca", "call:call2"]);
    expect(diff.pivot && constellationKey(diff.pivot)).toBe("programme:h2020");
  });

  it("forward simple : tout persiste, un nœud entre", () => {
    const diff = diffPaths([EC], [EC, H2020]);
    expect(diff.persist).toHaveLength(1);
    expect(diff.exit).toHaveLength(0);
    expect(diff.enter.map(constellationKey)).toEqual(["programme:h2020"]);
    expect(diff.pivot).toEqual(EC);
  });

  it("retour ancêtre : la branche profonde sort, rien n'entre", () => {
    const diff = diffPaths([EC, H2020, ERC], [EC, H2020]);
    expect(diff.exit.map(constellationKey)).toEqual(["programme:erc"]);
    expect(diff.enter).toHaveLength(0);
    expect(diff.pivot).toEqual(H2020);
  });

  it("branches de longueurs différentes, racine changée : aucun pivot", () => {
    const diff = diffPaths([EC, H2020], [n("funder", "nih"), n("programme", "ai")]);
    expect(diff.persist).toHaveLength(0);
    expect(diff.pivot).toBeNull();
    expect(diff.exit).toHaveLength(2);
    expect(diff.enter).toHaveLength(2);
  });

  it("déterminisme : mêmes chemins → même diff, toujours", () => {
    const a = diffPaths([EC, H2020, ERC], [EC, H2020, MSCA]);
    const b = diffPaths([EC, H2020, ERC], [EC, H2020, MSCA]);
    expect(a).toEqual(b);
  });
});

describe("constellation engine — transactions et phases", () => {
  it("descente : loading_target → exiting? → repositioning → entering → idle", () => {
    const engine = new ConstellationEngine([EC]);
    const tx = engine.beginNavigation("programme:h2020");
    expect(engine.state.phase).toBe("loading_target");
    // La géométrie courante est conservée pendant le chargement.
    expect(engine.state.committedPath).toEqual([EC]);
    const plan = engine.commitPath(tx, [EC, H2020]);
    expect(plan?.phases).toEqual(["repositioning", "entering"]);
    expect(engine.state.committedPath).toEqual([EC, H2020]);
    expect(engine.state.phase).toBe("repositioning");
    expect(engine.advance()).toBe("entering");
    expect(engine.advance()).toBe("idle");
    expect(engine.state.plan).toBeNull();
  });

  it("remontée : exiting → repositioning → idle (rien n'entre)", () => {
    const engine = new ConstellationEngine([EC, H2020, ERC]);
    const tx = engine.beginNavigation("programme:h2020");
    const plan = engine.commitPath(tx, [EC, H2020]);
    expect(plan?.phases).toEqual(["exiting", "repositioning"]);
    expect(engine.advance()).toBe("repositioning");
    expect(engine.advance()).toBe("idle");
  });

  it("commit sans changement : transaction valide, aucune phase à jouer", () => {
    const engine = new ConstellationEngine([EC, H2020]);
    const tx = engine.beginNavigation("programme:h2020");
    const plan = engine.commitPath(tx, [EC, H2020]);
    expect(plan).not.toBeNull();
    expect(plan?.phases).toEqual([]);
    expect(engine.state.phase).toBe("idle");
  });

  it("clics rapides successifs : la première réponse devient obsolète", () => {
    const engine = new ConstellationEngine([EC]);
    const txA = engine.beginNavigation("programme:erc");
    const txB = engine.beginNavigation("programme:msca");
    // La réponse de A arrive — elle est IGNORÉE : rien ne bouge.
    expect(engine.commitPath(txA, [EC, ERC])).toBeNull();
    expect(engine.state.committedPath).toEqual([EC]);
    expect(engine.state.phase).toBe("loading_target");
    expect(engine.state.pendingTargetKey).toBe("programme:msca");
    // La réponse de B commit normalement.
    const plan = engine.commitPath(txB, [EC, MSCA]);
    expect(plan?.enter.map(constellationKey)).toEqual(["programme:msca"]);
    expect(engine.state.committedPath).toEqual([EC, MSCA]);
  });

  it("clic A → clic B → réponse A APRÈS B : B reste le focus", () => {
    const engine = new ConstellationEngine([EC]);
    const txA = engine.beginNavigation("programme:erc");
    const txB = engine.beginNavigation("programme:msca");
    engine.commitPath(txB, [EC, MSCA]);
    // A répond en retard : aucune transaction en attente ne le porte.
    expect(engine.commitPath(txA, [EC, ERC])).toBeNull();
    expect(engine.state.committedPath).toEqual([EC, MSCA]);
  });

  it("interruption pendant une animation : jamais d'entering permanent ni de fantôme", () => {
    const engine = new ConstellationEngine([EC]);
    const tx1 = engine.beginNavigation("programme:h2020");
    engine.commitPath(tx1, [EC, H2020]);
    engine.advance(); // entering en cours…
    expect(engine.state.phase).toBe("entering");
    // …nouvelle intention : la structure précédente est déjà la
    // vérité, l'animation est simplement abandonnée.
    const tx2 = engine.beginNavigation("programme:erc");
    expect(engine.state.phase).toBe("loading_target");
    expect(engine.state.plan).toBeNull();
    const plan = engine.commitPath(tx2, [EC, H2020, ERC]);
    // Le diff part du chemin committé complet — aucun nœud fantôme.
    expect(plan?.persist.map(constellationKey)).toEqual(["funder:ec", "programme:h2020"]);
    expect(plan?.exit).toHaveLength(0);
    expect(plan?.enter.map(constellationKey)).toEqual(["programme:erc"]);
  });

  it("advance hors animation : inoffensif", () => {
    const engine = new ConstellationEngine([EC]);
    expect(engine.advance()).toBe("idle");
    engine.beginNavigation("programme:h2020");
    expect(engine.advance()).toBe("loading_target");
  });

  it("settle (reduced motion) : atterrissage immédiat, cible en charge préservée", () => {
    const engine = new ConstellationEngine([EC]);
    const tx = engine.beginNavigation("programme:h2020");
    engine.commitPath(tx, [EC, H2020]);
    expect(engine.state.phase).not.toBe("idle");
    engine.settle();
    expect(engine.state.phase).toBe("idle");
    expect(engine.state.plan).toBeNull();
    // Pendant un chargement, settle n'invente pas d'état stable.
    engine.beginNavigation("programme:erc");
    engine.settle();
    expect(engine.state.phase).toBe("loading_target");
    expect(engine.state.pendingTargetKey).toBe("programme:erc");
  });

  it("previews : révélées, retirées — committedPath jamais touché", () => {
    const engine = new ConstellationEngine([EC, H2020]);
    engine.showPreviewBranches([ERC, MSCA]);
    expect(engine.state.previewBranches).toHaveLength(2);
    expect(engine.state.committedPath).toEqual([EC, H2020]);
    expect(engine.state.phase).toBe("idle");
    engine.clearPreviewBranches();
    expect(engine.state.previewBranches).toHaveLength(0);
    // Une sélection réelle efface les previews.
    engine.showPreviewBranches([ERC]);
    const tx = engine.beginNavigation("programme:erc");
    engine.commitPath(tx, [EC, H2020, ERC]);
    expect(engine.state.previewBranches).toHaveLength(0);
  });

  it("déterminisme de bout en bout : mêmes appels → mêmes états", () => {
    const run = () => {
      const engine = new ConstellationEngine([EC, H2020, ERC, CALL, MARS]);
      const tx = engine.beginNavigation("programme:msca");
      const plan = engine.commitPath(tx, [EC, H2020, MSCA, CALL2]);
      const phases = [engine.state.phase];
      while (engine.state.phase !== "idle") phases.push(engine.advance());
      return { plan, phases, state: engine.state };
    };
    expect(run()).toEqual(run());
  });
});
