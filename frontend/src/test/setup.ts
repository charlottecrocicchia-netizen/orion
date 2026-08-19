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

// jsdom has no ResizeObserver; charts measure their container with it.
class ResizeObserverStub {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    this.callback(
      [{ contentRect: { width: 960, height: 400 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
    void target;
  }
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

// Le localStorage de jsdom est dégénéré ici (pas de clear/getItem
// fiables) : une vraie implémentation Map, remise à zéro entre les
// tests — la mémoire d'entrée (révision D4) se teste pour de bon.
import { beforeEach } from "vitest";
const storageMap = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => storageMap.get(k) ?? null,
    setItem: (k: string, v: string) => void storageMap.set(k, String(v)),
    removeItem: (k: string) => void storageMap.delete(k),
    clear: () => void storageMap.clear(),
    get length() {
      return storageMap.size;
    },
    key: (i: number) => [...storageMap.keys()][i] ?? null,
  },
});
beforeEach(() => storageMap.clear());
