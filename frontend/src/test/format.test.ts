import { expect, test } from "vitest";

import { formatCompactEur, formatOrgName, orgTypeKey } from "../lib/format";

test("formatOrgName sentence-cases shouting names, keeps acronyms and place names", () => {
  expect(formatOrgName("CENTRE NATIONAL DE LA RECHERCHE SCIENTIFIQUE CNRS")).toBe(
    "Centre national de la recherche scientifique CNRS",
  );
  expect(formatOrgName("COMMISSARIAT A L ENERGIE ATOMIQUE ET AUX ENERGIES ALTERNATIVES")).toBe(
    "Commissariat a l energie atomique et aux energies alternatives",
  );
  expect(formatOrgName("CNRS - DELEGATION REGIONALE MIDI-PYRENEES")).toBe(
    "CNRS - Delegation regionale Midi-Pyrenees",
  );
  expect(formatOrgName("AIRBUS OPERATIONS SAS")).toBe("Airbus operations SAS");
  expect(formatOrgName("FRAUNHOFER GESELLSCHAFT ZUR FOERDERUNG DER ANGEWANDTEN FORSCHUNG EV")).toBe(
    "Fraunhofer gesellschaft zur foerderung der angewandten forschung EV",
  );
});

test("formatOrgName leaves mixed-case and very short names untouched", () => {
  expect(formatOrgName("Institut Pasteur")).toBe("Institut Pasteur");
  expect(formatOrgName("CEA")).toBe("CEA");
  expect(formatOrgName("Fraunhofer Gesellschaft")).toBe("Fraunhofer Gesellschaft");
});

test("orgTypeKey folds both taxonomies into canonical keys", () => {
  expect(orgTypeKey("REC")).toBe("research");
  expect(orgTypeKey("Université")).toBe("university");
  expect(orgTypeKey("PME (petite et moyenne entreprise)")).toBe("sme");
  expect(orgTypeKey(null)).toBeNull();
  expect(orgTypeKey("quelque chose d'inconnu")).toBe("other");
});

test("formatCompactEur scales through k, M and B", () => {
  expect(formatCompactEur(387_000, "en")).toBe("€387k");
  expect(formatCompactEur(8_400_000, "en")).toBe("€8.4M");
  expect(formatCompactEur(211_000_000_000, "en")).toBe("€211B");
  expect(formatCompactEur(null, "en")).toBe("—");
});
