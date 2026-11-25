import { vi, type Mock } from "vitest";

/** Envelope de erro da API (feature 001) — só vem em respostas ≠ 2xx (research R-03). */
export interface MockApiErrorBody {
  sucesso: false;
  mensagem: string;
  erros: MockFieldError[];
}

export interface MockFieldError {
  campo: string;
  mensagem: string;
}

export interface MockResponseOptions {
  status?: number;
  headers?: Record<string, string>;
  /** Valor do header `Date` (relógio do servidor). Padrão: `new Date()` (respeita fake timers). */
  serverDate?: Date | string;
}

/** Requisição recebida pelo fetch simulado, já normalizada para asserções. */
export interface RecordedRequest {
  method: string;
  /** URL como chamada pelo app */
  url: string;
  /** `pathname + search`, independente de `VITE_API_URL` */
  path: string;
  headers: Headers;
  /** Corpo já convertido de JSON quando possível */
  body: unknown;
}

export type MockHandler = (request: RecordedRequest) => Response | Promise<Response>;

export interface MockRoute {
  /** Padrão: qualquer método */
  method?: string;
  /** String = `path` exato (com ou sem query); RegExp = testada contra a URL completa */
  url: string | RegExp;
  /** Resposta fixa ou função; respostas são clonadas, então a rota pode responder várias vezes */
  response: Response | MockHandler;
  /** Responde só uma vez; depois a rota é ignorada (útil para sequências 503 → 200) */
  once?: boolean;
}

const toHttpDate = (value: Date | string | undefined): string => {
  if (typeof value === "string") return value;
  return (value ?? new Date()).toUTCString();
};

const buildHeaders = (options: MockResponseOptions, contentType?: string): Headers => {
  const headers = new Headers(options.headers);
  if (contentType && !headers.has("Content-Type")) headers.set("Content-Type", contentType);
  if (!headers.has("Date")) headers.set("Date", toHttpDate(options.serverDate));
  return headers;
};

/** Resposta de sucesso com o DTO no corpo (a API não usa envelope em sucesso). */
export const jsonResponse = (body: unknown, options: MockResponseOptions = {}): Response =>
  new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: buildHeaders(options, "application/json; charset=utf-8"),
  });

/** Resposta sem corpo (ex.: 204 de DELETE). */
export const emptyResponse = (options: MockResponseOptions = {}): Response =>
  new Response(null, { status: options.status ?? 204, headers: buildHeaders(options) });

/** Resposta de erro com o envelope `{ sucesso: false, mensagem, erros }`. */
export const errorResponse = (
  status: number,
  mensagem: string,
  erros: MockFieldError[] = [],
  options: Omit<MockResponseOptions, "status"> = {},
): Response => {
  const body: MockApiErrorBody = { sucesso: false, mensagem, erros };
  return jsonResponse(body, { ...options, status });
};

/** Falha de rede como o `fetch` real lança (offline, DNS, CORS). Use como `response`. */
export const networkError: MockHandler = () => {
  throw new TypeError("Failed to fetch");
};

/** Atraso artificial para testar estados de loading/timeout. */
export const delayed =
  (ms: number, handler: MockHandler): MockHandler =>
  async (request) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return handler(request);
  };

const parseBody = (raw: BodyInit | null | undefined): unknown => {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
};

const toRecordedRequest = (input: RequestInfo | URL, init?: RequestInit): RecordedRequest => {
  const url = input instanceof Request ? input.url : input.toString();
  const parsed = new URL(url, "http://localhost");
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  return { method, url, path: parsed.pathname + parsed.search, headers, body: parseBody(init?.body) };
};

const routeMatches = (route: MockRoute, request: RecordedRequest): boolean => {
  if (route.method && route.method.toUpperCase() !== request.method) return false;
  if (route.url instanceof RegExp) return route.url.test(request.url);
  const pathname = request.path.split("?")[0];
  return route.url === request.path || route.url === pathname || route.url === request.url;
};

export interface FetchMock {
  /** O `vi.fn` instalado em `globalThis.fetch` */
  fn: Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>;
  /** Todas as requisições recebidas, em ordem */
  requests: RecordedRequest[];
  /** Requisições para um path (e método, opcional) */
  requestsTo: (path: string, method?: string) => RecordedRequest[];
  /** Adiciona rotas depois da instalação; rotas novas têm prioridade */
  use: (...routes: MockRoute[]) => void;
}

/**
 * Substitui `globalThis.fetch` por um simulador com rotas. Rotas sem correspondência
 * falham o teste com uma mensagem explícita. O `setup.ts` desfaz o stub após cada teste.
 *
 * @example
 * const api = mockFetch([
 *   { method: "GET", url: "/api/punches/today", response: jsonResponse(today, { serverDate: "Tue, 25 Nov 2026 11:02:00 GMT" }) },
 *   { method: "POST", url: "/api/punches", response: errorResponse(400, "Dados inválidos", [{ campo: "tipo", mensagem: "Obrigatório" }]) },
 *   { url: /\/api\/approvals/, response: networkError },
 * ]);
 * expect(api.requestsTo("/api/punches", "POST")[0]?.body).toEqual({ ... });
 */
export const mockFetch = (initialRoutes: MockRoute[] = []): FetchMock => {
  let routes = [...initialRoutes];
  const requests: RecordedRequest[] = [];

  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = toRecordedRequest(input, init);
    requests.push(request);

    const route = routes.find((candidate) => routeMatches(candidate, request));
    if (!route) {
      throw new Error(`fetchMock: nenhuma rota para ${request.method} ${request.url}`);
    }
    if (route.once) routes = routes.filter((candidate) => candidate !== route);

    return typeof route.response === "function"
      ? route.response(request)
      : route.response.clone();
  });

  vi.stubGlobal("fetch", fn);

  return {
    fn,
    requests,
    requestsTo: (path, method) =>
      requests.filter(
        (request) =>
          request.path.split("?")[0] === path &&
          (method === undefined || request.method === method.toUpperCase()),
      ),
    use: (...newRoutes) => {
      routes = [...newRoutes, ...routes];
    },
  };
};
