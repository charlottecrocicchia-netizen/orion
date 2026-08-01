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
    proxy: { "/api": "http://localhost:8000" },
  },
  preview: {
    // The e2e job serves the built bundle through `vite preview`.
    proxy: { "/api": "http://localhost:8000" },
  },
  test: {
    // Scoped to src: the Playwright specs under e2e/ also end in .spec.ts and
    // would otherwise be collected here, where their fixtures cannot run.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
