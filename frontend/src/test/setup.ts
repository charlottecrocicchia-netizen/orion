import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom implements neither matchMedia nor scrollTo. Reduced motion is reported
// as active so animated values (count-up, constellation draw) render instantly.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(window, "scrollTo", { writable: true, value: vi.fn() });
