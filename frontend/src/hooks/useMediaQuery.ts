import { useCallback, useSyncExternalStore } from "react";

/** Breakpoint único de navegação (`lg`, docs/design/DESIGN_DIRECTION.md §9). */
export const DESKTOP_QUERY = "(min-width: 1024px)";

const getMatch = (query: string): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;

/** `true` enquanto a media query casa (reage a mudanças). */
export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener?.("change", onChange);
      return () => list.removeEventListener?.("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => getMatch(query),
    () => false,
  );
};

/** `true` a partir de 1024 px. */
export const useIsDesktop = (): boolean => useMediaQuery(DESKTOP_QUERY);

export default useMediaQuery;
