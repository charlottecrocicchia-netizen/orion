import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";

import "./i18n";

import { Layout } from "@/components/layout";
import { AboutDataPage } from "@/pages/about-data";
import { LensRoomPage } from "@/pages/lens-room";
import { AnalysesPage } from "@/pages/analyses";
import { CallDetailPage } from "@/pages/call-detail";
import { CallsPage } from "@/pages/calls";
import { CountryHubPage } from "@/pages/country-hub";
import { ExploreCountriesPage } from "@/pages/explore-countries";
import { ExploreProgrammesPage } from "@/pages/explore-programmes";
import { ExploreThemesPage } from "@/pages/explore-themes";
import { HomePage } from "@/pages/home";
import { NotFoundPage } from "@/pages/not-found";
import { NsfObligationsPage } from "@/pages/nsf-obligations";
import { MoneyTrailPage } from "@/pages/money-trail";
import { OrganisationHubPage } from "@/pages/organisation-hub";
import { GroupHubPage } from "@/pages/group-hub";
import { ProgrammeHubPage } from "@/pages/programme-hub";
import { ComparePage } from "@/pages/compare";
import { DossierPage } from "@/pages/dossier";
import { ExplorerPage } from "@/pages/explorer";
import { RegionHubPage } from "@/pages/region-hub";
import { ProjectDetailPage } from "@/pages/project-detail";
import { RequireAuth } from "@/components/require-auth";
import { useMe } from "@/lib/auth";
import { LandingPage } from "@/pages/landing";
import { LoginPage } from "@/pages/login";
import { LoginVerifyPage } from "@/pages/login-verify";
import { OrganisationsSearchPage, ProjectsSearchPage } from "@/pages/search";
import { SavedDossierPage } from "@/pages/saved-dossier";
import { WorkspacePage } from "@/pages/workspace";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** La racine à deux visages (pivot 2026-08-22) : anonyme → la landing
 *  publique ; connecté → la home applicative, inchangée. */
function RootPage() {
  const { me, loading } = useMe();
  if (loading) return null;
  return me ? <HomePage /> : <LandingPage />;
}

export function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* La Lens Room vit HORS du Layout (moment immersif) mais
            DERRIÈRE la frontière : option B du pivot — tout ce qui
            montre des données exige une session, la landing présente
            les lentilles elle-même. */}
        <Route element={<RequireAuth />}>
          <Route path="/lenses" element={<LensRoomPage />} />
        </Route>
        <Route element={<Layout />}>
          {/* L'entrée du produit — les SEULES routes publiques. */}
          <Route path="/" element={<RootPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/verify" element={<LoginVerifyPage />} />
          {/* LA frontière : toute vue applicative naît derrière elle,
              le motif inconnu (*) compris — une URL non prévue ne dit
              rien à un anonyme. */}
          <Route element={<RequireAuth />}>
            <Route path="/projects" element={<ProjectsSearchPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/organisations" element={<OrganisationsSearchPage />} />
            <Route path="/organisations/:id" element={<OrganisationHubPage />} />
            <Route path="/groups/:id" element={<GroupHubPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/dossier" element={<DossierPage />} />
            <Route path="/analyses" element={<AnalysesPage />} />
            <Route path="/calls" element={<CallsPage />} />
            <Route path="/calls/:id" element={<CallDetailPage />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/workspace/dossiers/:id" element={<SavedDossierPage />} />
            <Route path="/explore" element={<ExplorerPage />} />
            {/* R5B : surface dédiée, grammaire `fy=` propre — hors du
                Reference Engine (§ 19.3/19.4). */}
            <Route path="/nsf-obligations" element={<NsfObligationsPage />} />
            {/* B2 : la chaîne de l'argent public (moteur B1) — hors
                lentille, URL = vue reproductible. */}
            <Route path="/money" element={<MoneyTrailPage />} />
            <Route path="/money/:level/:id" element={<MoneyTrailPage />} />
            <Route path="/explore/countries" element={<ExploreCountriesPage />} />
            <Route path="/explore/regions/:slug" element={<RegionHubPage />} />
            <Route path="/explore/countries/:code" element={<CountryHubPage />} />
            <Route path="/explore/programmes" element={<ExploreProgrammesPage />} />
            <Route path="/explore/themes" element={<ExploreThemesPage />} />
            <Route path="/explore/programmes/:id" element={<ProgrammeHubPage />} />
            <Route path="/about-data" element={<AboutDataPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
