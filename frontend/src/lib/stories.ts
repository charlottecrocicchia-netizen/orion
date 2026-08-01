/** The curated entry points: each story is an Explorer URL state. */
export interface Story {
  key: string;
  params: string;
}

export const STORIES: Story[] = [
  { key: "hydrogen", params: "metric=funding&by=programme&q=hydrogen&view=treemap&limit=12" },
  { key: "brexit", params: "metric=funding&by=country&split=1&compare=GB~FR" },
  { key: "topFrance", params: "metric=funding&by=organisation&country=FR&limit=10" },
  { key: "frameworks", params: "metric=funding&by=programme&split=1&limit=4" },
  { key: "quantum", params: "metric=funding&by=year&q=quantum" },
  { key: "coordination", params: "metric=coordination&by=country&limit=10" },
];
