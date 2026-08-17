async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface Stats {
  totals: {
    projects: number;
    organisations: number;
    participations: number;
    funding_eur: number;
    countries: number;
  };
  funding_by_year: { year: number; amount_eur: number }[];
  /** La lentille spatiale (V1) : les compteurs de preuve de la home. */
  space: { core: number; adjacent: number; core_funding_eur: number };
}

export interface ProjectHit {
  id: number;
  acronym: string | null;
  title: string;
  source: string;
  funding_amount_eur: number | null;
  start_year: number | null;
  end_year: number | null;
  programme_root: string | null;
  programme_root_id: number | null;
  participations_count: number;
  countries: string[];
  snippet: string | null;
}

export interface ProjectSearchResponse {
  total: number;
  results: ProjectHit[];
  facets: {
    funders: { code: string; label: string; count: number }[];
    programmes: { id: number; code: string; label: string; count: number }[];
    countries: { code: string; count: number }[];
    years: { year: number; count: number }[];
  };
}

export interface OrganisationHit {
  id: number;
  name: string;
  country: string | null;
  org_type: string | null;
  projects_count: number;
  total_funding_eur: number | null;
  funding_by_year: { year: number; amount_eur: number }[];
}

export interface OrganisationSearchResponse {
  total: number;
  /** Les groupes qui répondent à la requête — en tête, jamais enterrés
   *  (recette 2026-08-04). L'opération annoncée remonte avec son compte. */
  groups: {
    id: number;
    name: string;
    country: string | null;
    entities: number;
    announced_entities: number;
    funding_eur: number;
  }[];
  results: OrganisationHit[];
  facets: {
    countries: { code: string; count: number }[];
    org_types: { code: string; count: number }[];
  };
}

export interface ExplorePoint {
  year: number;
  value: number | null;
}

export interface ExploreSeries {
  key: string | number;
  label: string | null;
  value?: number | null;
  points?: ExplorePoint[];
}

export interface ExploreResponse {
  metric: string;
  by: string;
  split: boolean;
  unit: "eur" | "count" | "pct";
  basis: "participants" | "projects";
  series: ExploreSeries[];
  total: number | null;
  meta: {
    limit: number;
    compare: string[] | null;
    q: string | null;
    country: string | null;
    programme?: number | null;
    programme_label?: string | null;
    /** La couverture de la VUE (lot E) : présente SEULEMENT quand la vue
     *  mélange des classes — la surface compose alors sa phrase. */
    coverage?: {
      classes: string[];
      funders: string[];
      uncovered: string[];
    } | null;
  };
}

export interface OrganisationPartner {
  id: number;
  name: string;
  country: string | null;
  org_type: string | null;
  shared_projects: number;
  partner_amount_eur: number | null;
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  source_code: string;
  published: string | null;
  image: string | null;
}

export interface CountryFlow {
  a: string;
  b: string;
  projects: number;
  amount_eur: number;
}

export interface CompareEntry {
  /** Organisation id (number) or group ref ("g<id>"). */
  id: number | string;
  /** Set by the mixed benchmark — groups compare beside organisations. */
  kind?: "organisation" | "group";
  entities?: number;
  name: string;
  country: string | null;
  org_type: string | null;
  kpis: {
    projects_count: number;
    total_funding_eur: number;
    coordinator_count: number;
    first_year: number | null;
    last_year: number | null;
  };
  funding_by_year: { year: number; amount_eur: number }[];
  top_themes: { key: string; label: string | null; projects: number }[];
  top_partners: OrganisationPartner[];
  /** Les programmes où l'entité est forte (écran d'analyse, 2026-08-05). */
  top_programmes: {
    id: number;
    label: string;
    funder: string | null;
    projects: number;
    funding_eur: number;
  }[];
  /** Géographie de l'entrée — présent pour les groupes seulement. */
  countries?: { code: string; region: string | null; entities: number; funding_eur: number }[];
}

export interface CompareResponse {
  entries: CompareEntry[];
  /** Qui travaille avec CHAQUE entité comparée — l'info du veilleur. */
  common_partners: {
    id: number;
    name: string;
    country: string | null;
    org_type: string | null;
    shared: Record<string, number>;
  }[];
}

export interface SuggestResponse {
  groups: { id: number; name: string; country: string | null; entities: number }[];
  organisations: { id: number; name: string; country: string | null }[];
  projects: { id: number; acronym: string | null; title: string }[];
}

export interface GroupHub {
  id: number;
  name: string;
  country: string | null;
  lei: string | null;
  totals: { entities: number; projects: number; funding_eur: number; countries: number };
  /** La note d'honnêteté : les homonymes du corpus hors périmètre. */
  coverage: { unattached_count: number; unattached_funding_eur: number };
  trajectory: { year: number; funding_eur: number }[];
  /** Trajectoire éclatée : top 5 entités + série « autres » (id null). */
  by_entity: {
    id: number | null;
    name: string | null;
    points: { year: number; funding_eur: number }[];
  }[];
  partners: OrganisationPartner[];
  watchpost: {
    top_themes: { key: string; label: string | null; amount_eur: number; projects: number }[];
    signals: {
      accelerating_theme?: { key: string; label: string | null; growth_pct: number } | null;
      new_partners?: { count: number; names: string[] } | null;
    };
    sources_count: number;
  };
  themes: { key: string; label: string | null; projects: number }[];
  entities: {
    id: number;
    name: string;
    country: string | null;
    region: string | null;
    method: string;
    confidence: number;
    is_jv: boolean;
    /** Le pacte de la coentreprise (67 → 67 %) — null hors JV. Les
     *  montants consolidés le portent (pondération, 2026-08-17). */
    share: number | null;
    /** active | announced | historical — l'annoncé est listé, jamais consolidé. */
    status: string;
    projects: number;
    /** La CONTRIBUTION pondérée de l'entité au consolidé du groupe. */
    funding_eur: number;
    share_pct: number;
  }[];
  countries: { code: string; region: string | null; entities: number; funding_eur: number }[];
}

export const api = {
  explore: (params: URLSearchParams) =>
    get<ExploreResponse>(`/api/explore/aggregate?${params}`),
  suggest: (q: string) => get<SuggestResponse>(`/api/search/suggest?q=${encodeURIComponent(q)}`),
  organisationPartners: (id: string) =>
    get<OrganisationPartner[]>(`/api/organisations/${id}/partners`),
  organisationPartnerCountries: (id: string) =>
    get<PartnerCountry[]>(`/api/organisations/${id}/partner-countries`),
  countryFlows: () => get<CountryFlow[]>("/api/countries/flows?limit=200"),
  compareOrganisations: (ids: string[]) =>
    get<CompareResponse>(`/api/compare/organisations?ids=${ids.join("~")}`),
  stats: () => get<Stats>("/api/stats"),
  news: () => get<NewsItem[]>("/api/news"),
  searchProjects: (params: URLSearchParams) =>
    get<ProjectSearchResponse>(`/api/search/projects?${params}`),
  searchOrganisations: (params: URLSearchParams) =>
    get<OrganisationSearchResponse>(`/api/search/organisations?${params}`),
  project: (id: string) => get<ProjectDetail>(`/api/projects/${id}`),
  organisation: (id: string) => get<OrganisationDetail>(`/api/organisations/${id}`),
  organisationProjects: (id: string, params: URLSearchParams) =>
    get<PortfolioResponse>(`/api/organisations/${id}/projects?${params}`),
  countries: () => get<CountryIndexEntry[]>("/api/countries"),
  regions: () => get<RegionSummary[]>("/api/regions"),
  group: (id: string) => get<GroupHub>(`/api/groups/${id}`),
  country: (code: string) => get<CountryHub>(`/api/countries/${code}`),
  programmes: () => get<ProgrammeIndexEntry[]>("/api/programmes"),
  programme: (id: string) => get<ProgrammeHub>(`/api/programmes/${id}`),
  sources: () => get<SourcesResponse>("/api/sources"),
  health: () => get<Health>("/api/health"),
};

export interface ProjectDetail {
  id: number;
  source: string;
  source_id: string;
  acronym: string | null;
  title: string;
  title_lang: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  total_cost_eur: number | null;
  funding_amount_eur: number | null;
  /** Native amount when the source did not pay in euros (convention ④). */
  funding_amount_native: number | null;
  funding_currency: string | null;
  conversion: { rate: number; year: number; source: string } | null;
  url: string | null;
  funder: { code: string; name: string } | null;
  programme_chain: { id: number; code: string; label: string | null }[];
  call: { code: string; title: string | null } | null;
  texts: { lang: string; title: string; abstract: string | null }[];
  topics: { scheme: string; code: string; label: string }[];
  participants: {
    organisation_id: number;
    name: string;
    role: string | null;
    country: string | null;
    amount_eur: number | null;
  }[];
  attribution: string | null;
}

export interface OrganisationDetail {
  id: number;
  name: string;
  country: string | null;
  city: string | null;
  org_type: string | null;
  website: string | null;
  identifiers: { scheme: string; value: string }[];
  kpis: {
    projects_count: number;
    total_funding_eur: number;
    coordinator_count: number;
    first_year: number | null;
    last_year: number | null;
  };
  funding_by_year: { year: number; amount_eur: number; coordinated_eur: number; projects: number }[];
  top_programmes: { code: string; label: string; amount_eur: number }[];
  top_themes: { key: string; label: string; amount_eur: number; projects: number }[];
  signals: {
    accelerating_theme: { key: string; label: string; growth_pct: number } | null;
    new_partners: { count: number; names: string[] } | null;
  };
  sources_count: number;
}

export interface PartnerCountry {
  country: string;
  partners: number;
  shared_projects: number;
}

export interface PortfolioResponse {
  total: number;
  results: {
    id: number;
    acronym: string | null;
    title: string;
    source: string;
    role: string | null;
    amount_eur: number | null;
    start_year: number | null;
    programme_code: string | null;
  }[];
}

export interface CountryIndexEntry {
  code: string;
  name: string;
  eu_member: boolean;
  /** La classe de couverture (lot E) : « funders » (un bailleur chargé
   *  finance ce pays en propre), « participations » (visible seulement
   *  par ses consortiums — budget domestique INVISIBLE, pas nul), ou
   *  « none ». Absente sur les mailles sous le pays. */
  coverage?: "funders" | "participations" | "none";
  coverage_funders?: string[];
  /** Manager region slug — served by the backend referential, the
   *  front never hardcodes geography (chantier régions, 2026-08-04). */
  region: string | null;
  projects_count: number;
  funding_eur: number;
}

export interface RegionSummary {
  region: string;
  countries: number;
  projects_count: number;
  funding_eur: number;
}

export interface CountryHub {
  code: string;
  name: string;
  eu_member: boolean;
  /** La maille sous le pays (lot D) : vide quand le référentiel n'en
   *  tient pas — la fiche décide alors de ne pas ouvrir de carte. */
  subdivisions: {
    code: string;
    name: string;
    projects_count: number;
    funding_eur: number;
  }[];
  kpis: {
    projects_count: number;
    organisations_count: number;
    funding_eur: number;
    coordinator_count: number;
  };
  funding_by_year: { year: number; amount_eur: number }[];
  top_organisations: { id: number; name: string; projects_count: number; funding_eur: number }[];
  top_projects: {
    id: number;
    acronym: string | null;
    title: string;
    funding_eur: number | null;
    start_year: number | null;
  }[];
}

export interface ProgrammeIndexEntry {
  id: number;
  code: string;
  label: string;
  funder_code: string;
  funder_name: string;
  projects_count: number;
  funding_eur: number;
}

export interface ProgrammeHub {
  id: number;
  code: string;
  label: string;
  kpis: {
    projects_count: number;
    funding_eur: number;
    first_year: number | null;
    last_year: number | null;
  };
  funding_by_year: { year: number; amount_eur: number }[];
  top_beneficiaries: {
    id: number;
    name: string;
    country: string | null;
    projects_count: number;
    funding_eur: number;
  }[];
  top_projects: {
    id: number;
    acronym: string | null;
    title: string;
    funding_eur: number | null;
    start_year: number | null;
  }[];
}

export interface SourcesResponse {
  totals: { projects: number; organisations: number; participations: number };
  sources: { source: string; projects: number; last_success_at: string | null }[];
}

export interface Health {
  status: string;
  version: string;
  checks: Record<string, string>;
}
