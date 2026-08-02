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
}

export const STORIES: Story[] = [
  {
    key: "hydrogen",
    params: "metric=funding&by=programme&q=hydrogen&view=treemap&limit=12",
    deck: [
      { params: "metric=funding&by=year&q=hydrogen", titleKey: "explorer.stories.hydrogen.a1" },
      {
        params: "metric=funding&by=programme&q=hydrogen&view=treemap&limit=12",
        titleKey: "explorer.stories.hydrogen.a2",
      },
      {
        params: "metric=funding&by=country&split=0&q=hydrogen&limit=8",
        titleKey: "explorer.stories.hydrogen.a3",
      },
      {
        params: "metric=funding&by=organisation&split=0&q=hydrogen&limit=8",
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
        params: "metric=funding&by=programme&split=0&country=GB&limit=8",
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
  { key: "topFrance", params: "metric=funding&by=organisation&country=FR&limit=10" },
  { key: "recentThemes", params: "metric=funding&by=theme&time=2021..2027&limit=10" },
  { key: "frameworks", params: "metric=funding&by=programme&split=1&limit=4" },
  { key: "quantum", params: "metric=funding&by=year&q=quantum" },
  { key: "coordination", params: "metric=coordination&by=country&limit=10" },
];
