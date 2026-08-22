import { describe, expect, it } from "vitest";

import {
  brusselsDayMonth,
  callFamilyLabel,
  deadlineUrgency,
  splitDescriptionSections,
} from "@/lib/calls";

describe("callFamilyLabel", () => {
  it("extrait programme et destination, années et numéros écartés", () => {
    expect(callFamilyLabel("HORIZON-CL4-2027-SPACE-03-12")).toBe("HORIZON-CL4 · SPACE");
    expect(callFamilyLabel("HORIZON-JU-CLEAN-AVIATION-2026-04-FTA-05")).toBe(
      "HORIZON-JU · CLEAN · AVIATION",
    );
    expect(callFamilyLabel("ERC-2026-ADG")).toBe("ERC-ADG");
  });
  it("reste honnête sur les identifiants hors motif", () => {
    expect(callFamilyLabel("EuropeAid/186614/DD/ACT/Multi")).toBe("EuropeAid-DD · ACT · Multi");
    expect(callFamilyLabel("12345")).toBe("12345");
  });
});

describe("deadlineUrgency", () => {
  it("nomme les registres sans juger", () => {
    expect(deadlineUrgency(3)).toBe("critical");
    expect(deadlineUrgency(7)).toBe("critical");
    expect(deadlineUrgency(21)).toBe("soon");
    expect(deadlineUrgency(90)).toBeNull();
    expect(deadlineUrgency(null)).toBeNull();
  });
});

describe("brusselsDayMonth", () => {
  it("rend jour et mois en heure de Bruxelles, dans l'ordre de la locale", () => {
    expect(brusselsDayMonth("2026-08-26T15:00:00+00:00", "en-GB")).toBe("26 AUG");
    expect(brusselsDayMonth("2026-08-26T15:00:00+00:00", "en")).toBe("AUG 26");
    expect(brusselsDayMonth("2026-08-26T15:00:00+00:00", "fr")).toBe("26 AOÛT");
    expect(brusselsDayMonth(null, "en")).toBeNull();
  });
});

describe("splitDescriptionSections", () => {
  it("découpe au motif « paragraphe court finissant par : » (Clean Aviation réel)", () => {
    const html =
      "<p>Expected Outcome:</p><p>Development and demonstration of a cryo-cooled motor inverter.</p>";
    const sections = splitDescriptionSections(html);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Expected Outcome");
    expect(sections[0].html).toContain("cryo-cooled");
  });

  it("découpe au motif « paragraphe tout en gras » (ERC réel), préambule conservé", () => {
    const html =
      "<p>Expected Outcome:</p>" +
      "<p><strong><em>Objectives and profile of the Principal Investigator</em></strong></p>" +
      "<p>The objective of the Advanced Grant…</p>" +
      "<p><strong><em>Size of ERC Advanced Grants</em></strong></p>" +
      "<p>Advanced Grants may be awarded…</p>";
    const sections = splitDescriptionSections(html);
    expect(sections.map((s) => s.title)).toEqual([
      "Expected Outcome",
      "Objectives and profile of the Principal Investigator",
      "Size of ERC Advanced Grants",
    ]);
    expect(sections[1].html).toContain("Advanced Grant…");
  });

  it("un gras d'emphase DANS un paragraphe n'est jamais un titre", () => {
    const html = "<p>Un montant de <strong>EUR 2 500 000</strong> est prévu.</p>";
    const sections = splitDescriptionSections(html);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBeNull();
  });

  it("sans structure détectée : une seule section, texte intact", () => {
    const html = "<p>Un seul paragraphe descriptif, sans intitulés.</p>";
    expect(splitDescriptionSections(html)).toEqual([{ title: null, html }]);
  });
});
