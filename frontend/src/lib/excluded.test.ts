import { describe, expect, it } from "vitest";

import { REASON_KEYS } from "@/lib/excluded";
import i18n from "@/i18n";

/** La carte motif → clé i18n est le point de passage OBLIGÉ des
 *  exclusions : la note ⓘ ignore silencieusement tout motif qu'elle n'y
 *  trouve pas (`if (!key) return null`). Un motif ajouté côté API sans
 *  son entrée ici disparaîtrait de l'écran sans qu'aucun e2e ne
 *  bronche — l'exclusion serait muette, ce que la doctrine interdit. */
describe("excluded · la carte des motifs ne perd personne", () => {
  const PPP_MOTIFS = [
    "no_country",
    "no_jurisdiction_series",
    "no_reference_year",
  ];

  it("couvre les trois motifs du pouvoir d'achat", () => {
    for (const motif of PPP_MOTIFS) {
      expect(REASON_KEYS[motif], motif).toBeTruthy();
    }
  });

  it("ne confond jamais territoire jamais couvert et année manquante", () => {
    expect(REASON_KEYS.no_jurisdiction_series).not.toBe(
      REASON_KEYS.no_reference_year,
    );
  });

  it("chaque motif a sa phrase dans les deux langues", () => {
    for (const [motif, key] of Object.entries(REASON_KEYS)) {
      for (const lang of ["en", "fr"] as const) {
        // Les motifs porteurs de comptes n'existent qu'en formes de
        // pluriel : `exists` sur la clé nue rendrait false à tort.
        const present =
          i18n.exists(`explorer.reference.${key}`, { lng: lang }) ||
          i18n.exists(`explorer.reference.${key}_one`, { lng: lang });
        expect(present, `${lang}/${motif} → ${key}`).toBe(true);
      }
    }
  });
});
