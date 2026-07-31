import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import "./i18n";

import { LanguageToggle } from "@/components/language-toggle";
import { Logo } from "@/components/logo";
import { StatusCard } from "@/components/status-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";

const queryClient = new QueryClient();

function Shell() {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 0%, color-mix(in oklab, var(--color-primary) 9%, transparent), transparent)",
        }}
      />
      <header className="relative z-10">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <Logo />
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-6">
        <section className="w-full max-w-2xl py-20 text-center">
          <Badge
            variant="outline"
            className="mb-6 gap-1.5 border-primary/25 py-1 pr-2.5 pl-1.5 text-primary"
          >
            <span className="inline-block size-1.5 rounded-full bg-primary" aria-hidden="true" />
            {t("badge")}
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            {t("tagline")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-pretty text-muted-foreground md:text-lg">
            {t("subtitle")}
          </p>
          <div className="mt-12">
            <StatusCard />
          </div>
        </section>
      </main>
      <footer className="relative z-10 border-t">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6 text-xs text-muted-foreground">
          <span>© 2026 Orion</span>
          <span>{t("footer.phase")}</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
    </QueryClientProvider>
  );
}
