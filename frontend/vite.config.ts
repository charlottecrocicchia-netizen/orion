/// <reference types="vitest/config" />
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    // changeOrigin: false — le raccourci chaîne l'active et RÉÉCRIT le
    // Host en localhost:8000 : le garde d'origine de l'API (doctrine
    // CSRF, pivot 2026-08-22) verrait alors une requête « étrangère »
    // sur chaque mutation même-origine. Le proxy préserve l'hôte du
    // client, comme Caddy en prod.
    proxy: { "/api": { target: "http://localhost:8000", changeOrigin: false } },
  },
  preview: {
    // The e2e job serves the built bundle through `vite preview`.
    proxy: { "/api": { target: "http://localhost:8000", changeOrigin: false } },
  },
  test: {
    // Scoped to src: the Playwright specs under e2e/ also end in .spec.ts and
    // would otherwise be collected here, where their fixtures cannot run.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
