import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";

import "./i18n";

import { Layout } from "@/components/layout";
import { AboutDataPage } from "@/pages/about-data";
import { CountryHubPage } from "@/pages/country-hub";
import { ExploreCountriesPage } from "@/pages/explore-countries";
import { ExploreProgrammesPage } from "@/pages/explore-programmes";
import { HomePage } from "@/pages/home";
import { NotFoundPage } from "@/pages/not-found";
import { OrganisationHubPage } from "@/pages/organisation-hub";
import { ProgrammeHubPage } from "@/pages/programme-hub";
import { ExplorerPage } from "@/pages/explorer";
import { ProjectDetailPage } from "@/pages/project-detail";
import { OrganisationsSearchPage, ProjectsSearchPage } from "@/pages/search";

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

export function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects" element={<ProjectsSearchPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/organisations" element={<OrganisationsSearchPage />} />
          <Route path="/organisations/:id" element={<OrganisationHubPage />} />
          <Route path="/explore" element={<ExplorerPage />} />
          <Route path="/explore/countries" element={<ExploreCountriesPage />} />
          <Route path="/explore/countries/:code" element={<CountryHubPage />} />
          <Route path="/explore/programmes" element={<ExploreProgrammesPage />} />
          <Route path="/explore/programmes/:id" element={<ProgrammeHubPage />} />
          <Route path="/about-data" element={<AboutDataPage />} />
          <Route path="*" element={<NotFoundPage />} />
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
