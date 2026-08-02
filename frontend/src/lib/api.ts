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
  meta: { limit: number; compare: string[] | null; q: string | null; country: string | null };
}

export interface OrganisationPartner {
  id: number;
  name: string;
  country: string | null;
  org_type: string | null;
  shared_projects: number;
  partner_amount_eur: number | null;
}

export interface CountryFlow {
  a: string;
  b: string;
  projects: number;
  amount_eur: number;
}

export interface CompareEntry {
  id: number;
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
}

export interface SuggestResponse {
  organisations: { id: number; name: string; country: string | null }[];
  projects: { id: number; acronym: string | null; title: string }[];
}

export const api = {
  explore: (params: URLSearchParams) =>
    get<ExploreResponse>(`/api/explore/aggregate?${params}`),
  suggest: (q: string) => get<SuggestResponse>(`/api/search/suggest?q=${encodeURIComponent(q)}`),
  organisationPartners: (id: string) =>
    get<OrganisationPartner[]>(`/api/organisations/${id}/partners`),
  countryFlows: () => get<CountryFlow[]>("/api/countries/flows?limit=200"),
  compareOrganisations: (ids: string[]) =>
    get<CompareEntry[]>(`/api/compare/organisations?ids=${ids.join("~")}`),
  stats: () => get<Stats>("/api/stats"),
  searchProjects: (params: URLSearchParams) =>
    get<ProjectSearchResponse>(`/api/search/projects?${params}`),
  searchOrganisations: (params: URLSearchParams) =>
    get<OrganisationSearchResponse>(`/api/search/organisations?${params}`),
  project: (id: string) => get<ProjectDetail>(`/api/projects/${id}`),
  organisation: (id: string) => get<OrganisationDetail>(`/api/organisations/${id}`),
  organisationProjects: (id: string, params: URLSearchParams) =>
    get<PortfolioResponse>(`/api/organisations/${id}/projects?${params}`),
  countries: () => get<CountryIndexEntry[]>("/api/countries"),
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
  funding_by_year: { year: number; amount_eur: number }[];
  top_programmes: { code: string; label: string; amount_eur: number }[];
  top_themes: { key: string; label: string; amount_eur: number; projects: number }[];
  signals: {
    accelerating_theme: { key: string; label: string; growth_pct: number } | null;
    new_partners: { count: number; names: string[] } | null;
  };
  sources_count: number;
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
  projects_count: number;
  funding_eur: number;
}

export interface CountryHub {
  code: string;
  name: string;
  eu_member: boolean;
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
