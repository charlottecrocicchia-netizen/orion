/** L'erreur d'API porte le CODE du refus, pas seulement son numéro.
 *  Le Reference Engine refuse une vue avec un motif nommé (`422
 *  ppp_year_unavailable`, `ppp_requires_single_award_year`…) et la
 *  surface doit dire lequel : sans le `detail`, tous les refus d'une
 *  famille se ressembleraient et le message serait faux une fois sur
 *  deux. */
export class ApiError extends Error {
  // Champs déclarés puis assignés : `erasableSyntaxOnly` interdit les
  // propriétés de paramètre, qui ne s'effacent pas à la compilation.
  status: number;
  detail: string | null;

  constructor(status: number, detail: string | null, url: string) {
    super(`${url}: HTTP ${status}${detail ? ` (${detail})` : ""}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let detail: string | null = null;
    try {
      const body = (await res.json()) as { detail?: unknown };
      // Le 422 natif de FastAPI porte une LISTE ; les refus de doctrine
      // portent une chaîne. Ne garder que la seconde forme.
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* corps absent ou non JSON : le statut suffit */
    }
    throw new ApiError(res.status, detail, url);
  }
  return (await res.json()) as T;
}

export interface Overview {
  totals: {
    projects: number;
    organisations: number;
    participations: number;
    funding_eur: number;
    countries: number;
  };
  lenses: {
    slug: string;
    rank: number;
    version: number;
    core: number;
    enabling: number;
  }[];
  /** La série annuelle agrégée — la courbe du hero public, aucune
   *  maille sous l'année. */
  funding_by_year: { year: number; amount_eur: number }[];
  /** Les pays couverts (code, nom, région) — la teinte du globe en
   *  preview, JAMAIS un montant. */
  coverage: { code: string; name: string; region: string | null }[];
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
  /** Le registre des lentilles PUBLIÉES, en ordre de rang (M0/M1) —
   *  l'API est le registre du front, qui n'a aucune liste en dur. */
  lenses: LensMeta[];
  /** Les projets lus par PLUSIEURS lentilles publiées (D3) — le
   *  recouvrement n'a de sens qu'à deux lentilles. */
  overlap_projects: number;
}

export interface LensMeta {
  slug: string;
  family_key: string;
  rank: number;
  /** La version de méthodologie en vigueur. */
  version: number;
  /** Le journal des versions — date et avant/après chiffré. */
  changelog: {
    version: number;
    changed_on: string;
    before: { core: number; enabling: number; funding_eur: number };
    after: { core: number; enabling: number; funding_eur: number };
  }[];
  /** Le dernier passage réussi du chargeur de CETTE lentille. */
  last_run_at: string | null;
  /** Le compte des règles, posé par le chargeur — jamais écrit à la main. */
  rules: {
    total: number;
    programme: number;
    theme: number;
    text: number;
    review: number;
  };
  core: number;
  enabling: number;
  core_funding_eur: number;
  funding_eur: number;
  organisations: number;
  groups: number;
  by_year: { year: number; amount_eur: number }[];
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
  /** `usd` n'existe qu'en mode real ré-exprimé en dollars — le symbole
   *  affiché suit TOUJOURS cette unité, jamais un « € » codé en dur.
   *  `index` et `growth` ne viennent JAMAIS de l'API : ce sont les
   *  unités posées par la transformation TREND côté client
   *  (lib/trend.ts) — plus des montants monétaires. */
  unit:
    | "eur"
    | "usd"
    | "count"
    | "pct"
    | "index"
    | "growth"
    | "gdppct"
    | "eurcap"
    | "usdcap"
    | "intl";
  basis: "participants" | "projects";
  series: ExploreSeries[];
  total: number | null;
  /** Reference Engine (R1) — présent UNIQUEMENT en mode real : la part
   *  du périmètre affiché exclue du calcul (indice non publié, date
   *  manquante), chiffrée dynamiquement par l'API — jamais codée en
   *  dur. Les montants d'exclusion restent en EUR NOMINAL. */
  excluded?: {
    projects: number;
    amount_eur_nominal: number;
    /** Dictionnaire OUVERT de motifs précis (R0 § D13) : real porte
     *  no_index_year/no_date/no_currency_index ; gdp et capita ajoutent
     *  no_jurisdiction, no_gdp_year, no_population_year, no_rate_year.
     *  Les motifs porteurs d'années alimentent la bande hachurée. */
    reasons: Record<
      string,
      { projects: number; amount_eur_nominal: number; years?: number[] }
    >;
  };
  meta: {
    limit: number;
    compare: string[] | null;
    q: string | null;
    country: string | null;
    programme?: number | null;
    programme_label?: string | null;
    /** Reference Engine (R1) — présent uniquement en mode real : le
     *  référentiel de lecture (grammaire R0 § D10 : base = année de
     *  référence, cur = devise d'affichage, bases = années que le
     *  serveur peut honorer, vintages = millésimes d'indices lus). */
    reference?: {
      mode: "real" | "gdp" | "capita" | "ppp";
      /** ECONOMIC SCALE : la perspective FORCÉE par la dimension. */
      perspective?: "funder" | "recipient";
      /** ECONOMIC SCALE : le dénominateur macro et sa provenance. */
      denominator?: {
        concept: string;
        source: string;
        series_code: string;
        vintage: string;
      };
      base?: number;
      cur?: string;
      bases?: number[];
      vintages?: Record<string, string>;
      series?: Record<string, string>;
      /** PURCHASING POWER : l'année d'attribution cadrée — le mode
       *  n'existe que sur une seule (§ 4.4), et elle n'est PAS un
       *  paramètre d'URL (elle vient du filtre temporel). */
      year?: number;
      /** PURCHASING POWER : part convertible de la valeur affichée. */
      coverage?: number;
      rates_source: string;
    };
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
    /** Groupes : l'attribué aux entités légales (fait juridique). */
    attributed_funding_eur?: number;
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
  countries?: {
    code: string;
    region: string | null;
    entities: number;
    funding_eur: number;
  }[];
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
  groups: {
    id: number;
    name: string;
    country: string | null;
    entities: number;
  }[];
  organisations: { id: number; name: string; country: string | null }[];
  projects: { id: number; acronym: string | null; title: string }[];
}

export interface GroupHub {
  id: number;
  name: string;
  country: string | null;
  lei: string | null;
  totals: {
    entities: number;
    projects: number;
    /** L'EXPOSITION par participation — pactes JV appliqués (67/33). */
    funding_eur: number;
    /** L'ATTRIBUÉ aux entités légales — le fait juridique, non pondéré. */
    attributed_funding_eur: number;
    countries: number;
  };
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
    top_themes: {
      key: string;
      label: string | null;
      amount_eur: number;
      projects: number;
    }[];
    signals: {
      accelerating_theme?: {
        key: string;
        label: string | null;
        growth_pct: number;
      } | null;
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
    /** Ce que l'entité a REÇU (fait juridique, non pondéré). */
    attributed_eur: number;
    share_pct: number;
  }[];
  countries: {
    code: string;
    region: string | null;
    entities: number;
    funding_eur: number;
  }[];
}

/** R5B — la surface dédiée `Share of NSF award obligations`. Métrique
 *  INDÉPENDANTE (R5A § 19.3) : rien ici ne passe par `value=` ni par le
 *  Reference Engine. `/meta` liste les FY de la dernière vintage — le
 *  sélecteur n'offre QUE les `available` (jamais un choix qui finirait
 *  en 422, même doctrine que ppp-years). */
export interface NsfObligationsMeta {
  vintage: string | null;
  years: {
    fy: number;
    official_total_usd: number;
    coverage: number;
    available: boolean;
  }[];
}

export interface NsfObligationsPerFy {
  fy: number;
  official_total_usd: number;
  joinable_usd: number;
  unjoinable_usd: number;
  coverage: number;
}

export interface NsfObligationsAggregate {
  metric: string;
  vintage: string;
  fiscal_years: number[];
  /** Le total OFFICIEL (« Award Obligation Amount ») — le dénominateur
   *  ne boucle jamais à 100 % des parts visibles, et doit le dire. */
  denominator_usd: number;
  joinable_usd: number;
  /** La part du dénominateur qu'Orion ne voit pas — affichée, jamais
   *  masquée, jamais renormalisée (R5A § 20.1 C3). */
  unjoinable_usd: number;
  coverage: number;
  per_fy: NsfObligationsPerFy[];
  by?: string;
  /** Déjà triés par obligations décroissantes : le Top de la surface se
   *  classe par la grandeur R5 elle-même (R5A § 19.5). */
  buckets?: {
    key: string;
    label: string | null;
    amount_usd: number;
    share_pct: number;
  }[];
  bucket_count?: number;
}

export const api = {
  explore: (params: URLSearchParams) =>
    get<ExploreResponse>(`/api/explore/aggregate?${params}`),
  /** B2 — la chaîne de l'argent public (moteur B1). Identifiants
   *  stables : URL = vue reproductible. */
  chainFunders: () => get<ChainFundersIndex>("/api/chain/funders"),
  chainFunder: (code: string) =>
    get<ChainFunderNode>(`/api/chain/funder/${encodeURIComponent(code)}`),
  chainProgramme: (id: string, params: URLSearchParams) =>
    get<ChainProgrammeNode>(`/api/chain/programme/${id}?${params}`),
  chainCall: (id: string, params: URLSearchParams) =>
    get<ChainCallNode>(`/api/chain/call/${id}?${params}`),
  chainProject: (id: string) => get<ChainProjectNode>(`/api/chain/project/${id}`),
  chainOrganisation: (id: string) =>
    get<ChainOrganisationNode>(`/api/chain/organisation/${id}`),
  chainCountry: (code: string) =>
    get<ChainCountryNode>(`/api/chain/country/${encodeURIComponent(code)}`),
  suggest: (q: string) =>
    get<SuggestResponse>(`/api/search/suggest?q=${encodeURIComponent(q)}`),
  organisationPartners: (id: string) =>
    get<OrganisationPartner[]>(`/api/organisations/${id}/partners`),
  organisationPartnerCountries: (id: string) =>
    get<PartnerCountry[]>(`/api/organisations/${id}/partner-countries`),
  countryFlows: () => get<CountryFlow[]>("/api/countries/flows?limit=200"),
  compareOrganisations: (ids: string[]) =>
    get<CompareResponse>(`/api/compare/organisations?ids=${ids.join("~")}`),
  stats: () => get<Stats>("/api/stats"),
  /** Le seul endpoint public de données (pivot 2026-08-22) : les
   *  chiffres généraux de la landing — totaux et carte de visite des
   *  lentilles, rien qui se fouille. */
  overview: () => get<Overview>("/api/public/overview"),
  news: () => get<NewsItem[]>("/api/news"),
  searchProjects: (params: URLSearchParams) =>
    get<ProjectSearchResponse>(`/api/search/projects?${params}`),
  searchOrganisations: (params: URLSearchParams) =>
    get<OrganisationSearchResponse>(`/api/search/organisations?${params}`),
  project: (id: string) => get<ProjectDetail>(`/api/projects/${id}`),
  organisation: (id: string) =>
    get<OrganisationDetail>(`/api/organisations/${id}`),
  organisationProjects: (id: string, params: URLSearchParams) =>
    get<PortfolioResponse>(`/api/organisations/${id}/projects?${params}`),
  countries: () => get<CountryIndexEntry[]>("/api/countries"),
  /** PURCHASING POWER (R4) : les années que le mode peut honorer. Le
   *  sélecteur n'en propose aucune autre — offrir une année sans
   *  référence mènerait l'utilisateur à un refus (R0 § D6). */
  pppYears: () => get<{ years: number[] }>("/api/explore/ppp-years"),
  /** R5B : l'axe de la surface s'écrit `fy=` — jamais `time=` (§ 19.4). */
  nsfObligationsMeta: () =>
    get<NsfObligationsMeta>("/api/nsf-obligations/meta"),
  nsfObligationsAggregate: (params: URLSearchParams) =>
    get<NsfObligationsAggregate>(`/api/nsf-obligations/aggregate?${params}`),
  regions: () => get<RegionSummary[]>("/api/regions"),
  group: (id: string) => get<GroupHub>(`/api/groups/${id}`),
  country: (code: string) => get<CountryHub>(`/api/countries/${code}`),
  programmes: () => get<ProgrammeIndexEntry[]>("/api/programmes"),
  programme: (id: string) => get<ProgrammeHub>(`/api/programmes/${id}`),
  sources: () => get<SourcesResponse>("/api/sources"),
  health: () => get<Health>("/api/health"),
  calls: (params: URLSearchParams) =>
    get<CallsResponse>(`/api/calls?${params}`),
  call: (id: string) => get<CallDetail>(`/api/calls/${id}`),
  callProgrammes: () => get<CallProgrammesResponse>("/api/calls/programmes"),
  callHistoricalActors: (id: string) =>
    get<CallHistoricalActors>(`/api/calls/${id}/historical-actors`),
  organisationCallOpportunities: (id: string) =>
    get<CallOpportunities>(`/api/organisations/${id}/call-opportunities`),
};

/** E3 V1 — les opportunités STRUCTURELLES d'une organisation : appels
 *  ouverts/à venir dont la famille contient son historique. Composantes
 *  décomposées, AUCUN score agrégé (la pondération est un arbitrage de
 *  méthode à venir). Wording strictement historique. */
export interface CallOpportunities {
  opportunities: {
    call_topic_id: number;
    identifier: string;
    title: string | null;
    status: "open" | "upcoming";
    next_deadline: string | null;
    opening_date: string | null;
    basis: "exact" | "identifier_family";
    family: string | null;
    components: {
      projects: number;
      coordinations: number;
      last_active_year: number | null;
      co_participants: number;
    };
  }[];
  meta: {
    /** La seule valeur que l'interface consomme — les phrases de
     *  méthode vivent en i18n, jamais servies par l'API (bug de
     *  recette du 2026-08-22 : du français en interface anglaise). */
    min_projects: number;
    bases: string;
    unit: string;
    eligibility: string;
    ranking: string;
    wording: string;
  };
}

/** E2 V1 — la lecture historique d'un appel : UN niveau de preuve par
 *  réponse (exact › famille par identifiant › famille par code gardée),
 *  jamais mélangés. Wording strictement historique — rien ne prédit. */
export interface CallHistoricalActors {
  level: "exact" | "identifier_family" | "code_family" | null;
  family: string | null;
  historical: { calls: number; projects: number };
  actors: {
    organisation_id: number;
    name: string;
    country: string | null;
    projects: number;
    coordinations: number;
    period: { from: number | null; to: number | null };
    programmes: string[];
    contributions_eur: number | null;
  }[];
  reason?:
    "no_comparable_history" | "below_threshold" | "family_too_transversal";
  meta: {
    min_projects: number;
    unit: string;
    amounts: string;
    corpus: string;
    wording: string;
  };
}

/** La lecture Orion d'un appel — V1 structurelle : la règle `call` qui
 *  a mordu voyage avec le tag, c'est le « pourquoi » affiché. */
export interface CallLensTag {
  lens: string;
  tag: "core" | "enabling";
  rule: string | null;
}

export interface CallRow {
  id: number;
  identifier: string;
  title: string | null;
  call_code: string | null;
  framework_programme: { code: string; label: string | null } | null;
  /** Le statut AFFICHÉ, dérivé des dates côté serveur — jamais le seul
   *  code source (« aucun appel clos présenté comme ouvert »). */
  status: "open" | "upcoming" | "closed";
  /** Le fait source, visible en provenance. */
  source_status: { code: string | null; label: string | null };
  opening_date: string | null;
  deadline_dates: string[];
  next_deadline: string | null;
  deadline_model: string | null;
  types_of_action: string[] | null;
  budget_min_eur: number | null;
  budget_max_eur: number | null;
  expected_grants: number | null;
  lens_tags: CallLensTag[];
  url: string | null;
}

export interface CallsMeta {
  last_synced_at: string | null;
  attribution: string;
}

export interface CallsResponse {
  total: number;
  results: CallRow[];
  meta: CallsMeta;
}

export interface CallBudgetAction {
  action?: string;
  expectedGrants?: number;
  minContribution?: number;
  maxContribution?: number;
  plannedOpeningDate?: string;
  deadlineModel?: string;
  deadlineDates?: string[];
}

export interface CallDetail extends CallRow {
  keywords: string[] | null;
  tags: string[] | null;
  cross_cutting: string[] | null;
  description_html: string | null;
  conditions_html: string | null;
  budget_overview: {
    budgetTopicActionMap?: Record<string, CallBudgetAction[]>;
  } | null;
  last_seen_at: string | null;
  meta: CallsMeta;
}

export interface CallProgrammeEntry {
  code: string;
  label: string;
  topics: number;
}

export interface CallProgrammesResponse {
  programmes: CallProgrammeEntry[];
}

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
  /** Les appartenances de lentille — plusieurs possibles (D1) : la
   *  fiche projet est la surface du chevauchement. Publiées seulement. */
  lens_tags: { lens: string; tag: "core" | "enabling" }[];
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
  funding_by_year: {
    year: number;
    amount_eur: number;
    coordinated_eur: number;
    projects: number;
  }[];
  top_programmes: { code: string; label: string; amount_eur: number }[];
  top_themes: {
    key: string;
    label: string;
    amount_eur: number;
    projects: number;
  }[];
  signals: {
    accelerating_theme: {
      key: string;
      label: string;
      growth_pct: number;
    } | null;
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
  top_organisations: {
    id: number;
    name: string;
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
  sources: {
    source: string;
    projects: number;
    last_success_at: string | null;
  }[];
}

export interface Health {
  status: string;
  version: string;
  checks: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/* B2 — la chaîne de l'argent public (moteur B1, /api/chain/*).       */
/* Le moteur FAIT FOI : l'interface lit ses clés stables (measure.key,
 * provenance, statuts) et pose ses propres libellés i18n dessus — les
 * textes français du moteur (label, basis, reason) ne sont JAMAIS
 * affichés tels quels (règle du 2026-08-22 : les phrases vivent en
 * i18n, pas dans l'API). Aucune logique comptable n'est recalculée
 * côté client. */

export type ChainLevel =
  | "funder"
  | "programme"
  | "call"
  | "project"
  | "participation"
  | "beneficiary"
  | "organisation"
  | "country";

export type ChainProvenance = "source_fact" | "derived" | "orion_analysis";

export interface ChainMeasure {
  key: string | null;
  accounting_nature: string | null;
  provenance: ChainProvenance | null;
  currency: "EUR" | "USD" | null;
  /** Prose du moteur (FR) — documentation API, jamais rendue. */
  label?: string;
  basis?: string;
  period?: string;
  semantics?: string;
}

export interface ChainCoverage {
  with_amount: number;
  unknown_amount: number;
}

export interface ChainEurObserved {
  amount: number | null;
  excluded_no_rate?: number;
  provenance: ChainProvenance;
  currency: "EUR";
}

export interface ChainAggregate {
  measure: ChainMeasure;
  amount: number | null;
  projects: number;
  coverage: ChainCoverage;
  amount_eur_observed: ChainEurObserved;
}

export interface ChainCrumb {
  level: ChainLevel;
  id: number | string;
  code?: string;
  label?: string | null;
  /** B2.2 — la trace financière servie par le moteur : un deep-link
   *  porte la même trace qu'une descente par clics. */
  amount?: number | null;
  currency?: string | null;
  share_of_parent?: number | null;
  comparability?: "ok" | "unknown_amount" | "transversal_call" | "not_applicable" | null;
}

export interface ChainNodeShare {
  ratio: number | null;
  comparability: "ok" | "unknown_amount" | "transversal_call";
  parent: { level: ChainLevel; label: string | null };
}

export interface ChainNavEntry {
  level: ChainLevel;
  status: "allowed" | "restricted" | "not_available";
  reason: string | null;
}

export interface ChainNavigation {
  down: ChainNavEntry[];
  up: ChainNavEntry[];
}

export interface ChainChildItem {
  level: ChainLevel;
  id: number;
  code?: string;
  label?: string | null;
  projects?: number;
  amount: number | null;
  coverage?: ChainCoverage;
  measure_key?: string;
  source?: string;
  source_id?: string;
  scope?: string;
}

export interface ChainChildren {
  level: ChainLevel;
  total: number;
  items: ChainChildItem[];
  coverage?: ChainCoverage;
  directly_on_parent?: number;
  no_call_projects?: number;
  restriction?: string;
}

interface ChainNodeBase {
  ancestors: ChainCrumb[];
  navigation: ChainNavigation;
  restrictions: string[];
  share_of_parent?: ChainNodeShare | null;
}

export interface ChainFundersIndex {
  funders: {
    level: "funder";
    id: string;
    label: string;
    aggregate: ChainAggregate;
  }[];
  cross_funder_total: { available: boolean; reason: string };
}

export interface ChainFunderNode extends ChainNodeBase {
  node: {
    level: "funder";
    id: string;
    label: string;
    currency: string;
  };
  aggregate: ChainAggregate | null;
  children: ChainChildren;
}

export interface ChainProgrammeNode extends ChainNodeBase {
  node: {
    level: "programme";
    id: number;
    code: string;
    label: string | null;
    funder: string;
    parent: ChainCrumb;
  };
  aggregate: ChainAggregate;
  children: ChainChildren;
}

export interface ChainCallNode extends ChainNodeBase {
  node: { level: "call"; id: number; code: string; label: string; funder: string };
  context: { programme_id: number; restriction: string } | null;
  programmes: { level: "programme"; id: number; code: string; projects: number }[];
  aggregate: ChainAggregate;
  children: ChainChildren;
}

export interface ChainParticipationItem {
  level: "participation" | "beneficiary";
  organisation: { level: "organisation"; id: number; label: string };
  role: string | null;
  country: string | null;
  source_uid: string;
  semantics: "funding_share" | "beneficiary_marker" | "constituent_award";
  amount?: number | null;
  amount_eur_observed?: ChainEurObserved;
  measure_key?: string;
  amount_note?: string;
}

export interface ChainReconciliation {
  status:
    | "exact"
    | "gap"
    | "children_exceed_parent"
    | "no_parent_amount"
    | "no_children_amounts"
    | "not_applicable";
  reason: string | null;
  parent_amount: number | null;
  children_known_sum: number | null;
  unallocated: number | null;
  unknown_children: number | null;
  coverage: { with_amount: number; total: number } | null;
}

export interface ChainAnnualObligations {
  measure: ChainMeasure;
  vintage: string;
  fiscal_years: { fy: number; amount: number | null }[];
  window_sum: number | null;
  comparability: { with_cumulative_total: "incompatible"; reason: string };
}

export interface ChainProjectNode extends ChainNodeBase {
  node: {
    level: "project";
    id: number;
    source: string;
    source_id: string;
    label: string;
    title: string;
    funder: string;
    start_date: string | null;
    end_date: string | null;
    parent: ChainCrumb | null;
    programme:
      | (ChainCrumb & {
          attribution: { provenance: ChainProvenance | null; basis: string | null };
        })
      | null;
  };
  measure: ChainMeasure & { amount: number | null };
  amount_eur_observed: ChainEurObserved;
  total_cost: {
    amount: number | null;
    status: "available" | "unknown" | "not_available";
    provenance_note?: string;
    measure?: ChainMeasure;
  } | null;
  children: {
    level: "participation" | "beneficiary";
    total: number;
    measure: ChainMeasure;
    items: ChainParticipationItem[];
  };
  reconciliation: ChainReconciliation;
  annual_obligations?: ChainAnnualObligations | null;
}

export interface ChainFunderBlock {
  funder: string;
  measure: ChainMeasure;
  amount: number | null;
  projects: number;
  participations: number;
  coverage: ChainCoverage;
  amount_eur_observed: ChainEurObserved;
}

export interface ChainOrganisationNode extends ChainNodeBase {
  node: {
    level: "organisation";
    id: number;
    label: string;
    country: string | null;
  };
  by_funder: ChainFunderBlock[];
  cross_funder_total: { available: boolean; reason: string };
}

export interface ChainCountryNode extends ChainNodeBase {
  node: { level: "country"; id: string; label: string };
  organisations: number;
  by_funder: ChainFunderBlock[];
  cross_funder_total: { available: boolean; reason: string };
}
