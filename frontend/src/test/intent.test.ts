import { expect, test } from "vitest";

import { parseIntent } from "../lib/intent";

test("a bare term stays a classic project search", () => {
  expect(parseIntent("hydrogen", "en")).toEqual({ to: "projects", params: "q=hydrogen" });
  expect(parseIntent("hydrogène", "fr")).toEqual({ to: "projects", params: "q=hydrog%C3%A8ne" });
});

test("« par pays » opens the Explorer on the country dimension", () => {
  const intent = parseIntent("l'hydrogène par pays depuis 2020", "fr");
  expect(intent?.to).toBe("explore");
  const params = new URLSearchParams(intent?.params);
  expect(params.get("by")).toBe("country");
  expect(params.get("time")).toBe("2020..2027");
  expect(params.get("q")).toContain("hydrog");
});

test("coordination questions pick the coordination metric", () => {
  const intent = parseIntent("qui coordonne le quantique ?", "fr");
  expect(intent?.to).toBe("explore");
  const params = new URLSearchParams(intent?.params);
  expect(params.get("metric")).toBe("coordination");
  expect(params.get("q")).toBe("quantique");
});

test("two organisations around vs go to the benchmark resolver", () => {
  expect(parseIntent("CNRS vs Fraunhofer", "fr")).toEqual({
    to: "compare",
    params: "find=CNRS~Fraunhofer",
  });
});

test("two countries around vs open a compared Explorer view", () => {
  const intent = parseIntent("France vs Allemagne", "fr");
  expect(intent?.to).toBe("explore");
  const params = new URLSearchParams(intent?.params);
  expect(params.get("compare")).toBe("FR~DE");
  expect(params.get("by")).toBe("country");
});

test("english structure works too", () => {
  const intent = parseIntent("solar by theme since 2021", "en");
  expect(intent?.to).toBe("explore");
  const params = new URLSearchParams(intent?.params);
  expect(params.get("by")).toBe("theme");
  expect(params.get("time")).toBe("2021..2027");
  expect(params.get("q")).toBe("solar");
});
