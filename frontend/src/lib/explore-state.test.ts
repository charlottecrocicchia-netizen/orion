import { describe, expect, it } from "vitest";

import {
  pppAvailable,
  pppRefusalCause,
  pppViewEligible,
  readState,
  resolveView,
  toApiParams,
} from "@/lib/explore-state";

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
    const state = readState(
      new URLSearchParams("by=country&hidden=US~DE&metric=funding"),
    );
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
    const state = readState(
      new URLSearchParams("value=real&base=2025&cur=USD"),
    );
    expect(state.value).toBe("real");
    expect(state.base).toBe(2025);
    expect(state.cur).toBe("USD");
    const api = toApiParams(state);
    expect(api.get("value")).toBe("real");
    expect(api.get("base")).toBe("2025");
    expect(api.get("cur")).toBe("USD");
  });

  it("cur=EUR explicite se normalise vers le défaut omis", () => {
    const state = readState(
      new URLSearchParams("value=real&base=2025&cur=EUR"),
    );
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

  it("TREND (R2) : index garde base, growth l'élimine, la devise leur est étrangère", () => {
    const index = readState(
      new URLSearchParams("by=year&value=index&base=2015&cur=USD"),
    );
    expect(index.value).toBe("index");
    expect(index.base).toBe(2015);
    expect(index.cur).toBe("");
    const growth = readState(
      new URLSearchParams("by=year&value=growth&base=2015"),
    );
    expect(growth.value).toBe("growth");
    expect(growth.base).toBeNull();
  });

  it("TREND voyage vers l'API en value=real, sans base ni cur — le backend ignore index/growth", () => {
    for (const query of ["value=index&base=2015", "value=growth"]) {
      const api = toApiParams(
        readState(new URLSearchParams(`by=year&${query}`)),
      );
      expect(api.get("value")).toBe("real");
      expect(api.has("base")).toBe(false);
      expect(api.has("cur")).toBe(false);
    }
  });

  it("range=full : lu en growth seulement, jamais envoyé à l'API (recette R2)", () => {
    const growth = readState(
      new URLSearchParams("by=year&value=growth&range=full"),
    );
    expect(growth.range).toBe("full");
    expect(toApiParams(growth).has("range")).toBe(false);
    // Étranger à tout autre mode : éliminé à la lecture.
    expect(
      readState(new URLSearchParams("by=year&value=index&base=2021&range=full"))
        .range,
    ).toBe("");
    expect(
      readState(new URLSearchParams("by=year&value=real&range=full")).range,
    ).toBe("");
    expect(readState(new URLSearchParams("by=year&range=full")).range).toBe("");
    // Absent = domaine robuste par défaut.
    expect(readState(new URLSearchParams("by=year&value=growth")).range).toBe(
      "",
    );
  });

  it("range=full compose avec hidden — aucun des deux n'atteint l'API", () => {
    const state = readState(
      new URLSearchParams(
        "by=country&split=1&value=growth&range=full&hidden=US",
      ),
    );
    expect(state.range).toBe("full");
    expect(state.hidden).toEqual(["US"]);
    const api = toApiParams(state);
    expect(api.get("value")).toBe("real");
    expect(api.has("range")).toBe(false);
    expect(api.has("hidden")).toBe(false);
  });

  it("TREND compose avec la légende : value=index&base=2015&hidden=US", () => {
    const state = readState(
      new URLSearchParams("by=country&split=1&value=index&base=2015&hidden=US"),
    );
    expect(state.hidden).toEqual(["US"]);
    expect(state.value).toBe("index");
    expect(state.base).toBe(2015);
    expect(toApiParams(state).has("hidden")).toBe(false);
  });

  it("TREND sur vue temporelle : lines et table seulement — jamais de donut ni de carte", () => {
    const state = readState(
      new URLSearchParams("by=country&split=1&value=growth"),
    );
    const { availableViews, view, temporal } = resolveView(state);
    expect(temporal).toBe(true);
    expect(availableViews).toEqual(["lines", "table"]);
    expect(view).toBe("lines");
  });

  it("ECONOMIC SCALE (R3) : gdp nu, capita avec base et cur — mêmes noms vers l'API", () => {
    const gdp = readState(
      new URLSearchParams("by=funder&value=gdp&base=2025&cur=USD"),
    );
    expect(gdp.value).toBe("gdp");
    // base et cur sont étrangers au % PIB : éliminés à la lecture.
    expect(gdp.base).toBeNull();
    expect(gdp.cur).toBe("");
    const gdpApi = toApiParams(gdp);
    expect(gdpApi.get("value")).toBe("gdp");
    expect(gdpApi.has("base")).toBe(false);

    const capita = readState(
      new URLSearchParams("by=country&value=capita&base=2025&cur=USD"),
    );
    expect(capita.base).toBe(2025);
    expect(capita.cur).toBe("USD");
    const capitaApi = toApiParams(capita);
    expect(capitaApi.get("value")).toBe("capita");
    expect(capitaApi.get("base")).toBe("2025");
    expect(capitaApi.get("cur")).toBe("USD");
  });

  it("ECONOMIC SCALE : vues restreintes — lignes en temporel, barres sinon, jamais de donut ni carte", () => {
    const bars = resolveView(
      readState(new URLSearchParams("by=country&value=gdp")),
    );
    expect(bars.availableViews).toEqual(["bars", "table"]);
    expect(bars.mappable).toBe(false);
    const lines = resolveView(
      readState(new URLSearchParams("by=funder&split=1&value=capita")),
    );
    expect(lines.availableViews).toEqual(["lines", "table"]);
  });

  it("ECONOMIC SCALE compose avec hidden — le masquage n'atteint jamais l'API", () => {
    const state = readState(
      new URLSearchParams("by=country&value=gdp&hidden=US"),
    );
    expect(state.hidden).toEqual(["US"]);
    const api = toApiParams(state);
    expect(api.get("value")).toBe("gdp");
    expect(api.has("hidden")).toBe(false);
  });

  it("composition avec la légende : value=real&base=2025&cur=USD&hidden=US", () => {
    const state = readState(
      new URLSearchParams(
        "by=country&split=1&value=real&base=2025&cur=USD&hidden=US",
      ),
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

/** PURCHASING POWER (R4) : un seul paramètre, une seule année, quatre
 *  dimensions. La grammaire ne doit jamais encoder une notion
 *  méthodologique qui n'existe pas — ni année de référence, ni devise
 *  d'affichage, ni perspective. */
describe("explore-state · pouvoir d'achat (value=ppp)", () => {
  it("voyage vers l'API en un seul paramètre", () => {
    const state = readState(
      new URLSearchParams("by=country&time=2023..2023&value=ppp"),
    );
    expect(state.value).toBe("ppp");
    const api = toApiParams(state);
    expect(api.get("value")).toBe("ppp");
    expect(api.get("year_from")).toBe("2023");
    expect(api.get("year_to")).toBe("2023");
  });

  it("canonicalise : base, cur et perspective sont étrangers au mode", () => {
    const state = readState(
      new URLSearchParams(
        "by=country&time=2023..2023&value=ppp&base=2025&cur=USD&perspective=funder",
      ),
    );
    expect(state.base).toBeNull();
    expect(state.cur).toBe("");
    expect(state).not.toHaveProperty("perspective");
    const api = toApiParams(state);
    expect(api.has("base")).toBe(false);
    expect(api.has("cur")).toBe(false);
    expect(api.has("perspective")).toBe(false);
  });

  it("un mode voisin mal orthographié retombe en nominal", () => {
    for (const raw of ["PPP", "ppp-adjusted", "purchasing"]) {
      expect(readState(new URLSearchParams(`value=${raw}`)).value).toBe("");
    }
  });

  it("le mode ne touche jamais au filtre temporel", () => {
    const nominal = readState(
      new URLSearchParams("by=country&time=2023..2023"),
    );
    const ppp = readState(
      new URLSearchParams("by=country&time=2023..2023&value=ppp"),
    );
    expect(ppp.from).toBe(nominal.from);
    expect(ppp.to).toBe(nominal.to);
  });
});

describe("explore-state · éligibilité de la vue au pouvoir d'achat", () => {
  const base = (query: string) => readState(new URLSearchParams(query));

  it("exige une année d'attribution unique", () => {
    expect(pppViewEligible(base("by=country&time=2023..2023"))).toBe(true);
    expect(pppViewEligible(base("by=country&time=2020..2023"))).toBe(false);
    // Sans borne : la fenêtre ne résout pas une année. Le test est
    // STRICT — un repli sur les bornes du corpus rendrait « sans borne »
    // indiscernable de « toute la fenêtre ».
    expect(pppViewEligible(base("by=country"))).toBe(false);
  });

  it("n'existe que sur les dimensions au grain participation", () => {
    for (const by of ["country", "region", "organisation", "orgtype"]) {
      expect(pppViewEligible(base(`by=${by}&time=2023..2023`))).toBe(true);
    }
    for (const by of ["year", "funder", "programme", "subdivision", "theme"]) {
      expect(pppViewEligible(base(`by=${by}&time=2023..2023`))).toBe(false);
    }
  });

  it("n'existe que pour la métrique monétaire, et jamais éclatée", () => {
    expect(
      pppViewEligible(base("by=country&time=2023..2023&metric=projects")),
    ).toBe(false);
    expect(pppViewEligible(base("by=country&time=2023..2023&split=1"))).toBe(
      false,
    );
  });
});

/** Défaut de recette R4B (2026-08-25) : le sélecteur proposait le
 *  pouvoir d'achat sur 2026, année dont AUCUNE juridiction ne publie la
 *  référence. « Le contrôle n'offre que ce que la vue peut honorer »
 *  (R0 § D6) : la disponibilité réelle entre dans le prédicat, et elle
 *  vient du serveur — jamais d'une année codée en dur, sans quoi le
 *  comportement deviendrait faux le jour où 2026 sera publiée. */
describe("explore-state · le pouvoir d'achat n'est offert que s'il existe", () => {
  const ANNEES_PUBLIEES = [2021, 2022, 2023, 2024, 2025];
  const vue = (query: string) => readState(new URLSearchParams(query));

  it("2023 : année publiée → le mode est offert", () => {
    expect(
      pppAvailable(vue("by=country&time=2023..2023"), ANNEES_PUBLIEES),
    ).toBe(true);
  });

  it("2025 : offert malgré une couverture partielle", () => {
    // Quelques territoires manquent à l'appel en 2025 ; l'ANNÉE, elle,
    // est publiée. La couverture partielle se dit dans la note, elle ne
    // retire pas le mode.
    expect(
      pppAvailable(vue("by=country&time=2025..2025"), ANNEES_PUBLIEES),
    ).toBe(true);
  });

  it("2026 et 2027 : aucune référence → le mode n'est pas offert", () => {
    expect(
      pppAvailable(vue("by=country&time=2026..2026"), ANNEES_PUBLIEES),
    ).toBe(false);
    expect(
      pppAvailable(vue("by=country&time=2027..2027"), ANNEES_PUBLIEES),
    ).toBe(false);
  });

  it("plusieurs années : le mode n'est pas offert, même toutes publiées", () => {
    expect(
      pppAvailable(vue("by=country&time=2022..2023"), ANNEES_PUBLIEES),
    ).toBe(false);
  });

  it("années inconnues du client : rien n'est offert tant qu'on ne sait pas", () => {
    // Mieux vaut un contrôle qui apparaît tard qu'un contrôle qui mène
    // à un refus.
    expect(pppAvailable(vue("by=country&time=2023..2023"), undefined)).toBe(
      false,
    );
  });

  it("le jour où 2026 sera publiée, le mode apparaîtra sans toucher au code", () => {
    expect(
      pppAvailable(vue("by=country&time=2026..2026"), [
        ...ANNEES_PUBLIEES,
        2026,
      ]),
    ).toBe(true);
  });

  it("l'éligibilité de la VUE reste distincte de la disponibilité", () => {
    // 2026 : la vue est bien structurée (une année, bonne dimension) —
    // c'est la RÉFÉRENCE qui manque. La distinction décide du message :
    // un refus prédictif dirait « choisissez une année », ce qui serait
    // faux ; il faut laisser l'API répondre `ppp_year_unavailable`.
    expect(pppViewEligible(vue("by=country&time=2026..2026"))).toBe(true);
    expect(pppViewEligible(vue("by=country&time=2022..2023"))).toBe(false);
    expect(pppViewEligible(vue("by=year&time=2026..2026"))).toBe(false);
  });
});

/** Défaut trouvé à la contre-vérification de clôture R4 (2026-08-25) :
 *  le refus prédictif disait toujours « choisissez une année », même
 *  quand l'année était bonne et que c'était la dimension, la métrique
 *  ou l'éclatement qui empêchait le mode. Un clic sur une autre
 *  métrique depuis une vue PPP suffisait — la phrase accusait alors
 *  l'utilisateur d'une erreur qu'il n'avait pas commise. */
describe("explore-state · le refus nomme la bonne cause", () => {
  const vue = (query: string) => readState(new URLSearchParams(query));

  it("aucune cause quand la vue porte le mode", () => {
    expect(pppRefusalCause(vue("by=country&time=2023..2023"))).toBeNull();
  });

  it("fenêtre pluriannuelle ou sans borne → c'est l'année", () => {
    expect(pppRefusalCause(vue("by=country&time=2022..2023"))).toBe("year");
    expect(pppRefusalCause(vue("by=country"))).toBe("year");
  });

  it("année bonne mais dimension interdite → c'est la VUE, pas l'année", () => {
    expect(pppRefusalCause(vue("by=funder&time=2023..2023"))).toBe("view");
    expect(pppRefusalCause(vue("by=programme&time=2023..2023"))).toBe("view");
    expect(pppRefusalCause(vue("by=subdivision&time=2023..2023"))).toBe("view");
  });

  it("année bonne mais métrique non monétaire → c'est la VUE", () => {
    expect(pppRefusalCause(vue("by=country&time=2023..2023&metric=projects"))).toBe("view");
  });

  it("année bonne mais série éclatée → c'est la VUE", () => {
    expect(pppRefusalCause(vue("by=country&time=2023..2023&split=1"))).toBe("view");
  });
});
