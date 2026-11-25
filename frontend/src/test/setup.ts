import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { IDBFactory as FakeIDBFactory } from "fake-indexeddb";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import * as axeMatchers from "vitest-axe/matchers";
import "../i18n";
import { resetApiClientState } from "../Services/apiClient";
import { closeOfflineCache } from "../Services/offlineCache";
import { closePunchQueue } from "../Services/punchQueue";
import { installMatchMedia, resetMatchMedia } from "./matchMedia";

// `vitest-axe/extend-expect` (0.1.0) é publicado vazio: o matcher `toHaveNoViolations`
// é registrado aqui; os tipos ficam em `vitest-axe.d.ts`.
expect.extend(axeMatchers);

// jsdom não implementa canvas: o axe tenta `getContext` e o jsdom imprime "Not implemented" a
// cada chamada. Devolver `null` (o mesmo resultado do jsdom) sem o aviso deixa a saída limpa.
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  writable: true,
  value: () => null,
});

// findBy*/waitFor: 3 s — páginas com axe ficam lentas quando a suíte roda em paralelo
configure({ asyncUtilTimeout: 3000 });

beforeEach(() => {
  installMatchMedia();
});

afterEach(async () => {
  cleanup();
  // Estado de módulo do cliente HTTP (conectividade, handlers) e conexão do cache
  resetApiClientState();
  await closeOfflineCache();
  await closePunchQueue();
  localStorage.clear();
  sessionStorage.clear();
  // Remove `fetch` simulado (vi.stubGlobal) e espiões (vi.spyOn)
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  resetMatchMedia();
  // IndexedDB novo a cada teste: fila offline e cache não vazam entre testes
  globalThis.indexedDB = new FakeIDBFactory() as unknown as IDBFactory;
});
