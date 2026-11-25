/**
 * Cliente HTTP da API do Pontua (research R-03, R-07, R-08).
 * - A API devolve o DTO em sucesso e o envelope `{ sucesso, mensagem, erros }` só em erro:
 *   não-2xx vira `ApiError(status, mensagem, erros)` (ajuste documentado da skill
 *   `react-architecture`: em vez de checar `result.sucesso`, checa-se `response.ok`).
 * - Falha de rede ou 10 s sem resposta → `ApiError(0, …)` e conectividade "offline".
 * - Escrita com a conectividade offline é recusada antes do `fetch` (exceto `allowOffline`).
 * - `cache: "network-first"` (GET autenticado): grava 2xx no `offlineCache` e, sem rede,
 *   devolve o dado guardado com `stale: true` e `fetchedAt`.
 * - Header `Date` de toda resposta alimenta o `serverOffset` (relógio oficial).
 */
import i18n from "../i18n";
import type { ApiFieldError, FreshnessInfo } from "../types/common";
import { getStoredToken, readStoredSession } from "./authSession";
import { offlineCache } from "./offlineCache";

/** URL base da API, sem barra no fim (vazio = mesma origem). */
export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
/** Tempo máximo sem resposta antes de tratar como falha de rede. */
export const REQUEST_TIMEOUT_MS = 10_000;
/** Status usado em falhas de rede/timeout/offline. */
export const NETWORK_ERROR_STATUS = 0;

/** Erro de chamada à API com a mensagem e os erros por campo do envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly mensagem: string;
  readonly erros: ApiFieldError[];
  /** Falha por falta de conexão (rede, timeout ou bloqueio offline) */
  readonly offline: boolean;

  constructor(status: number, mensagem: string, erros: ApiFieldError[] = [], offline = false) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
    this.mensagem = mensagem;
    this.erros = erros;
    this.offline = offline;
  }

  /** Mensagem do erro de um campo (comparação sem diferenciar maiúsculas). */
  fieldError(campo: string): string | undefined {
    const target = campo.toLowerCase();
    return this.erros.find((item) => item.campo.toLowerCase() === target)?.mensagem;
  }
}

export const isApiError = (value: unknown): value is ApiError => value instanceof ApiError;

/** Mensagem amigável de qualquer erro (para `error` dos contexts e toasts). */
export const toErrorMessage = (err: unknown): string => {
  if (isApiError(err)) return err.mensagem;
  if (err instanceof Error && err.message) return err.message;
  return i18n.t("erros:generico");
};

/** Converte `erros[]` da API em mapa `campo → mensagem` (campos em minúsculas). */
export const fieldErrorsOf = (err: unknown): Record<string, string> => {
  if (!isApiError(err)) return {};
  return err.erros.reduce<Record<string, string>>((acc, item) => {
    const key = item.campo.trim().toLowerCase();
    if (key && !(key in acc)) acc[key] = item.mensagem;
    return acc;
  }, {});
};

// ---------------------------------------------------------------------------
// Callbacks globais (AuthContext e ConnectivityContext)
// ---------------------------------------------------------------------------

/** Resultado de rede de uma chamada. */
export interface NetworkResult {
  /** `true` quando houve qualquer resposta HTTP */
  online: boolean;
  /** Diferença servidor − aparelho (ms), quando a resposta trouxe o header `Date` */
  serverOffset?: number;
}

type UnauthorizedHandler = () => void;
type NetworkResultListener = (result: NetworkResult) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;
const networkListeners = new Set<NetworkResultListener>();
/** Último resultado de rede conhecido (bloqueio de escrita offline). */
let lastNetworkOnline = true;

/** Registra (ou remove, com `null`) o handler de 401 em chamadas autenticadas. */
export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null): void => {
  unauthorizedHandler = handler;
};

/** Assina os resultados de rede; devolve a função que cancela. */
export const addNetworkResultListener = (listener: NetworkResultListener): (() => void) => {
  networkListeners.add(listener);
  return () => {
    networkListeners.delete(listener);
  };
};

/** `true` quando o app se considera sem conexão. */
export const isOfflineNow = (): boolean =>
  (typeof navigator !== "undefined" && navigator.onLine === false) || !lastNetworkOnline;

/** Restaura o estado do módulo (testes). */
export const resetApiClientState = (): void => {
  lastNetworkOnline = true;
  unauthorizedHandler = null;
  networkListeners.clear();
};

const emitNetworkResult = (result: NetworkResult): void => {
  lastNetworkOnline = result.online;
  networkListeners.forEach((listener) => listener(result));
};

const readServerOffset = (response: Response): number | undefined => {
  const header = response.headers.get("Date");
  if (!header) return undefined;
  const serverTime = Date.parse(header);
  return Number.isNaN(serverTime) ? undefined : serverTime - Date.now();
};

// ---------------------------------------------------------------------------
// Requisição
// ---------------------------------------------------------------------------

export type QueryValue = string | number | boolean | null | undefined;

/** Opções de `apiFetch`. */
export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Objeto serializado como JSON */
  body?: unknown;
  /** Parâmetros de query (nulos/vazios são ignorados) */
  query?: Record<string, QueryValue>;
  /** Envia o Bearer (padrão `true`); 401 só derruba a sessão em chamada autenticada */
  authenticated?: boolean;
  /** `network-first` só vale para GET autenticado */
  cache?: "network-first" | "none";
  /** Permite escrita mesmo com a conectividade marcada offline (ex.: login) */
  allowOffline?: boolean;
  signal?: AbortSignal;
}

/** Resposta com a procedência do dado. */
export interface ApiResponse<T> extends FreshnessInfo {
  data: T;
}

/** Monta `path?query` (sem a base), usado também como chave do cache. */
export const buildPath = (path: string, query?: Record<string, QueryValue>): string => {
  if (!query) return path;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    params.append(key, String(value));
  });
  const search = params.toString();
  if (!search) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${search}`;
};

const isAbortError = (err: unknown): boolean => err instanceof DOMException && err.name === "AbortError";

/**
 * `fetch` com timeout combinado ao `signal` do chamador (AbortController + setTimeout, que
 * funciona com timers falsos). Abort do chamador é relançado; rede/timeout viram `null`.
 */
const fetchWithTimeout = async (url: string, init: RequestInit, signal?: AbortSignal): Promise<Response | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (signal?.aborted && isAbortError(err)) throw err;
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const toFieldErrors = (value: unknown): ApiFieldError[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      campo: typeof item.campo === "string" ? item.campo : "",
      mensagem: typeof item.mensagem === "string" ? item.mensagem : "",
    }))
    .filter((item) => item.mensagem.length > 0);
};

/** Lê o envelope de erro (ou texto puro de 500) e monta o `ApiError`. */
const buildApiError = (status: number, body: string): ApiError => {
  const generic = status >= 500 ? i18n.t("erros:servidor") : i18n.t("erros:generico");
  if (body.trim().length === 0) return new ApiError(status, generic);
  try {
    const parsed: unknown = JSON.parse(body);
    if (!isRecord(parsed)) return new ApiError(status, generic);
    const erros = toFieldErrors(parsed.erros);
    const mensagem =
      typeof parsed.mensagem === "string" && parsed.mensagem.trim().length > 0
        ? parsed.mensagem
        : (erros[0]?.mensagem ?? generic);
    return new ApiError(status, mensagem, erros);
  } catch {
    // 500 com `ex.Message` em texto puro (Princípio VII) — não expõe detalhe técnico
    return new ApiError(status, generic);
  }
};

const parseSuccessBody = <T>(response: Response, body: string): T => {
  if (response.status === 204 || body.trim().length === 0) return undefined as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    return body as T;
  }
};

/**
 * Chamada à API com a procedência do dado (`stale`/`fetchedAt`). Para a maioria dos usos,
 * prefira `apiFetch`, que devolve só o DTO.
 */
export const apiRequest = async <T>(path: string, options: ApiFetchOptions = {}): Promise<ApiResponse<T>> => {
  const { method = "GET", body, query, authenticated = true, allowOffline = false, signal } = options;
  const fullPath = buildPath(path, query);
  const networkFirst = options.cache === "network-first" && method === "GET" && authenticated;

  if (method !== "GET" && !allowOffline && isOfflineNow()) {
    throw new ApiError(NETWORK_ERROR_STATUS, i18n.t("erros:offlineEscrita"), [], true);
  }

  const userId = networkFirst ? (readStoredSession()?.user.userId ?? null) : null;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (authenticated) {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetchWithTimeout(
    `${API_URL}${fullPath}`,
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    signal,
  );

  if (response === null) {
    emitNetworkResult({ online: false });
    if (networkFirst && userId !== null) {
      const entry = await offlineCache.get(userId, fullPath);
      if (entry) return { data: entry.data as T, stale: true, fetchedAt: entry.fetchedAt };
      throw new ApiError(NETWORK_ERROR_STATUS, i18n.t("erros:offlineSemDados"), [], true);
    }
    throw new ApiError(NETWORK_ERROR_STATUS, i18n.t("erros:rede"), [], true);
  }

  emitNetworkResult({ online: true, serverOffset: readServerOffset(response) });
  const text = await response.text();

  if (!response.ok) {
    if (response.status === 401 && authenticated) unauthorizedHandler?.();
    throw buildApiError(response.status, text);
  }

  const data = parseSuccessBody<T>(response, text);
  const fetchedAt = new Date().toISOString();

  // Só grava se a sessão continua a mesma (logout durante a chamada não deixa dado para trás)
  if (networkFirst && userId !== null && data !== undefined && readStoredSession()?.user.userId === userId) {
    void offlineCache.set(userId, fullPath, data);
  }

  return { data, stale: false, fetchedAt };
};

/** Chamada à API que devolve só o DTO (ou `undefined` em 204). */
export const apiFetch = async <T>(path: string, options: ApiFetchOptions = {}): Promise<T> =>
  (await apiRequest<T>(path, options)).data;

/**
 * Confere a conexão com uma chamada leve (`GET /health`, sem Bearer): qualquer resposta HTTP
 * prova que há rede. Atualiza a conectividade como qualquer outra chamada.
 */
export const pingApi = async (): Promise<boolean> => {
  const response = await fetchWithTimeout(`${API_URL}/health`, { method: "GET" });
  if (response === null) {
    emitNetworkResult({ online: false });
    return false;
  }
  emitNetworkResult({ online: true, serverOffset: readServerOffset(response) });
  return true;
};
