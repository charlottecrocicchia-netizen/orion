import { beforeEach, expect, test } from "vitest";

import {
  addToDossier,
  moveDossierItem,
  readDossier,
  removeFromDossier,
  setDossierTitle,
  updateDossierItem,
} from "../lib/dossier";

beforeEach(() => {
  // Reset through the public API — the in-module cache is authoritative
  // (jsdom's localStorage here lacks clear()).
  for (const item of [...readDossier().items]) removeFromDossier(item.id);
  setDossierTitle("");
});

test("collects once per view, reorders and edits in place", () => {
  expect(addToDossier("by=funder&split=0", "Funders")).toBe(true);
  expect(addToDossier("?by=funder&split=0", "Funders again")).toBe(false); // same view
  expect(addToDossier("by=theme&split=1", "Themes")).toBe(true);
  expect(readDossier().items.map((item) => item.title)).toEqual(["Funders", "Themes"]);

  moveDossierItem(readDossier().items[1].id, -1);
  expect(readDossier().items.map((item) => item.title)).toEqual(["Themes", "Funders"]);

  const first = readDossier().items[0];
  updateDossierItem(first.id, { title: "The race", note: "margin voice" });
  expect(readDossier().items[0].title).toBe("The race");
  expect(readDossier().items[0].note).toBe("margin voice");

  setDossierTitle("Hydrogen — August 2026");
  expect(readDossier().title).toBe("Hydrogen — August 2026");

  removeFromDossier(first.id);
  expect(readDossier().items).toHaveLength(1);
});
