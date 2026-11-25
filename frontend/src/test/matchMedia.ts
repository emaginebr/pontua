import { vi } from "vitest";

/** Decide se uma media query "casa" no teste (padrão: nenhuma casa). */
type MediaQueryMatcher = (query: string) => boolean;

const NO_MATCH: MediaQueryMatcher = () => false;

let currentMatcher: MediaQueryMatcher = NO_MATCH;

const createMediaQueryList = (query: string): MediaQueryList => ({
  matches: currentMatcher(query),
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => false),
});

/** Instala `window.matchMedia` (jsdom não implementa). Chamado pelo setup. */
export const installMatchMedia = (): void => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => createMediaQueryList(query),
  });
};

/**
 * Define quais media queries casam, ex.:
 * `setMatchMedia((q) => q.includes("prefers-reduced-motion"))` ou
 * `setMatchMedia((q) => q === "(display-mode: standalone)")`.
 */
export const setMatchMedia = (matcher: MediaQueryMatcher): void => {
  currentMatcher = matcher;
};

/** Volta ao padrão (nenhuma query casa). Chamado pelo setup após cada teste. */
export const resetMatchMedia = (): void => {
  currentMatcher = NO_MATCH;
};
