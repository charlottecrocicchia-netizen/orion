/** The curated entry points: each story is an Explorer URL state. A story
 *  carrying a `deck` opens as ANGLES (lot 3): the same question under
 *  several looks, slid horizontally — every angle itself a full Explorer
 *  state, hence a URL. Stories without a deck stay simple links. */

export interface AngleSlide {
  /** Explorer URL state for this angle. */
  params: string;
  /** i18n key of the editorial title. */
  titleKey: string;
}

export interface Story {
  key: string;
  params: string;
  deck?: AngleSlide[];
  /** Le slug de la lentille dont ce deck raconte le monde (M1.1). La
   *  bibliothèque groupe alors les decks par lentille publiée, en ordre
   *  de rang — les généralistes restent dessous, jamais retirés. */
  lens?: string;
}

export const STORIES: Story[] = [
  // ——— Les decks spatiaux (lot 3) — chaque angle porte son périmètre
  // dans l'adresse : la loi du chip vaut aussi pour les decks.
  {
    key: "spaceMoney",
    lens: "space",
    params: "metric=funding&by=year&sector=space",
    deck: [
      { params: "metric=funding&by=year&sector=space", titleKey: "explorer.stories.spaceMoney.a1" },
      {
        params: "metric=funding&by=programme&sector=space&view=donut&limit=6",
        titleKey: "explorer.stories.spaceMoney.a2",
      },
      {
        params: "metric=funding&by=country&split=0&sector=space&limit=8",
        titleKey: "explorer.stories.spaceMoney.a3",
      },
      {
        params: "metric=funding&by=organisation&split=1&sector=space&limit=6",
        titleKey: "explorer.stories.spaceMoney.a4",
      },
    ],
  },
  {
    // Le deck qui ENSEIGNE la distinction : mêmes vues, deux périmètres.
    // Les courbes se lisent en séquence ; les cartes jumelles sont la
    // vraie comparaison — leurs paliers log NOMMÉS sont fixes, donc les
    // deux vues partagent la même échelle (l'écart comme récit).
    key: "spaceDirect",
    lens: "space",
    params: "metric=funding&by=year&sector=space",
    deck: [
      {
        params: "metric=funding&by=year&sector=space",
        titleKey: "explorer.stories.spaceDirect.a1",
      },
      {
        params: "metric=funding&by=year&sector=space-direct",
        titleKey: "explorer.stories.spaceDirect.a2",
      },
      {
        params: "metric=funding&by=country&split=0&sector=space&limit=8",
        titleKey: "explorer.stories.spaceDirect.a3",
      },
      {
        params: "metric=funding&by=country&split=0&sector=space-direct&limit=8",
        titleKey: "explorer.stories.spaceDirect.a4",
      },
      {
        params: "metric=funding&by=theme&split=0&sector=space&limit=7",
        titleKey: "explorer.stories.spaceDirect.a5",
      },
    ],
  },
  {
    key: "spaceRising",
    lens: "space",
    params: "metric=funding&by=organisation&split=1&sector=space&limit=5&view=bump",
    deck: [
      {
        params: "metric=funding&by=organisation&split=1&sector=space&limit=5&view=bump",
        titleKey: "explorer.stories.spaceRising.a1",
      },
      {
        params: "metric=funding&by=organisation&split=1&sector=space&limit=7&view=delta",
        titleKey: "explorer.stories.spaceRising.a2",
      },
      {
        params: "metric=funding&by=country&split=1&sector=space&limit=5&view=bump",
        titleKey: "explorer.stories.spaceRising.a3",
      },
    ],
  },
  // ——— Les decks aéronautiques (A2, 2026-08-19) — le modèle des
  // spatiaux, cadrés sector=aviation. PAS de miroir du deck
  // « direct vs habilitant » : l'entrée unique vaut aussi ici — tant
  // qu'Aviation n'a aucun habilitant, ce deck n'aurait pas d'objet.
  {
    key: "aviationMoney",
    lens: "aviation",
    params: "metric=funding&by=year&sector=aviation",
    deck: [
      {
        params: "metric=funding&by=year&sector=aviation",
        titleKey: "explorer.stories.aviationMoney.a1",
      },
      {
        params: "metric=funding&by=programme&sector=aviation&view=donut&limit=6",
        titleKey: "explorer.stories.aviationMoney.a2",
      },
      {
        params: "metric=funding&by=country&split=0&sector=aviation&limit=8",
        titleKey: "explorer.stories.aviationMoney.a3",
      },
      {
        params: "metric=funding&by=organisation&split=1&sector=aviation&limit=6",
        titleKey: "explorer.stories.aviationMoney.a4",
      },
    ],
  },
  {
    key: "aviationRising",
    lens: "aviation",
    params: "metric=funding&by=organisation&split=1&sector=aviation&limit=5&view=bump",
    deck: [
      {
        params: "metric=funding&by=organisation&split=1&sector=aviation&limit=5&view=bump",
        titleKey: "explorer.stories.aviationRising.a1",
      },
      {
        params: "metric=funding&by=organisation&split=1&sector=aviation&limit=7&view=delta",
        titleKey: "explorer.stories.aviationRising.a2",
      },
      {
        params: "metric=funding&by=country&split=1&sector=aviation&limit=5&view=bump",
        titleKey: "explorer.stories.aviationRising.a3",
      },
    ],
  },
  {
    // Clean Aviation et le pari du vol propre : la famille Clean pèse
    // 60 % du financement de la lentille (CS1 0,8 → CS2 1,8 →
    // Clean Aviation 1,2 Md€ dès 2022) ; l'hydrogène 0,6 Md€,
    // l'électrique 1,6 — mesuré le 2026-08-19. Les angles suivent le
    // motif, cadré aviation — la loi du deck hydrogène généraliste.
    key: "aviationClean",
    lens: "aviation",
    params: "metric=funding&by=year&q=hydrogen&sector=aviation",
    deck: [
      {
        params: "metric=funding&by=year&q=hydrogen&sector=aviation",
        titleKey: "explorer.stories.aviationClean.a1",
      },
      {
        params: "metric=funding&by=organisation&split=1&q=electric&sector=aviation&limit=6",
        titleKey: "explorer.stories.aviationClean.a2",
      },
      {
        params: "metric=funding&by=programme&q=hydrogen&sector=aviation&view=donut&limit=6",
        titleKey: "explorer.stories.aviationClean.a3",
      },
      {
        params: "metric=funding&by=country&split=0&q=hydrogen&sector=aviation&limit=8",
        titleKey: "explorer.stories.aviationClean.a4",
      },
    ],
  },
  {
    key: "hydrogen",
    params: "metric=funding&by=programme&q=hydrogen&view=donut&limit=6",
    deck: [
      { params: "metric=funding&by=year&q=hydrogen", titleKey: "explorer.stories.hydrogen.a1" },
      // The interactive donut (doctrine amendment 2026-08-02): six slices,
      // an honest "others", click drills into a framework's sub-programmes.
      {
        params: "metric=funding&by=programme&q=hydrogen&view=donut&limit=6",
        titleKey: "explorer.stories.hydrogen.a2",
      },
      {
        params: "metric=funding&by=country&split=0&q=hydrogen&limit=8",
        titleKey: "explorer.stories.hydrogen.a3",
      },
      // Who gets funded reads as trajectories, not a static ranking
      // (recette 2026-08-02).
      {
        params: "metric=funding&by=organisation&split=1&q=hydrogen&limit=6",
        titleKey: "explorer.stories.hydrogen.a4",
      },
      {
        params: "metric=funding&by=country&split=1&q=hydrogen&limit=5&view=bump",
        titleKey: "explorer.stories.hydrogen.a5",
      },
    ],
  },
  {
    key: "brexit",
    params: "metric=funding&by=country&split=1&compare=GB~FR",
    deck: [
      {
        params: "metric=funding&by=country&split=1&compare=GB~FR",
        titleKey: "explorer.stories.brexit.a1",
      },
      {
        params: "metric=funding&by=country&split=1&limit=6&view=bump",
        titleKey: "explorer.stories.brexit.a2",
      },
      {
        params: "metric=funding&by=programme&split=0&country=GB&view=donut&limit=6",
        titleKey: "explorer.stories.brexit.a3",
      },
    ],
  },
  {
    key: "themeRace",
    params: "metric=funding&by=theme&split=1&limit=5",
    deck: [
      {
        params: "metric=funding&by=theme&split=1&limit=5",
        titleKey: "explorer.stories.themeRace.a1",
      },
      {
        params: "metric=funding&by=theme&split=1&limit=6&view=bump",
        titleKey: "explorer.stories.themeRace.a2",
      },
      // Before/after replaces the static ranked bars (fondatrice,
      // 2026-08-02): the dumbbell teaches who GAINED ground, not just who
      // is big.
      {
        params: "metric=funding&by=theme&split=1&limit=7&view=delta",
        titleKey: "explorer.stories.themeRace.a3",
      },
    ],
  },
  // The French corpus left the product with the ANR (2026-08-03); the
  // slot now carries the question the international market asks first.
  { key: "topFrance", params: "metric=funding&by=country&split=1&compare=US~FR~DE" },
  { key: "recentThemes", params: "metric=funding&by=theme&time=2021..2027&limit=10" },
  { key: "frameworks", params: "metric=funding&by=programme&split=1&limit=4" },
  { key: "quantum", params: "metric=funding&by=year&q=quantum" },
  { key: "coordination", params: "metric=coordination&by=country&limit=10" },
];
