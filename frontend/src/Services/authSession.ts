/**
 * Sessão e chaves guardadas no aparelho (data-model.md §3, Princípio VI). Separado de
 * `authService` para o `apiClient` ler o token sem dependência circular.
 */
import type { AuthSession } from "../types/auth";

/** Sessão: `{ token, expiresAt, user }` (nunca em cookie — Princípio VI). */
export const AUTH_STORAGE_KEY = "pontua:auth";
/** Última empresa usada: `{ userId, companyId }`. */
export const COMPANY_STORAGE_KEY = "pontua:company";
/** Rota a abrir depois do login (sessionStorage). */
export const RETURN_TO_STORAGE_KEY = "pontua:returnTo";
/** Token de convite a aceitar depois do login/cadastro (sessionStorage, research R-12). */
export const PENDING_INVITE_STORAGE_KEY = "pontua:pendingInvite";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isSessionShape = (value: unknown): value is AuthSession =>
  isRecord(value) &&
  typeof value.token === "string" &&
  value.token.length > 0 &&
  typeof value.expiresAt === "string" &&
  isRecord(value.user) &&
  typeof value.user.userId === "number";

/** `true` quando a sessão já venceu (ou a data é inválida). */
export const isSessionExpired = (session: AuthSession, now: number = Date.now()): boolean => {
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= now;
};

const safeGet = (storage: Storage, key: string): string | null => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (storage: Storage, key: string, value: string): void => {
  try {
    storage.setItem(key, value);
  } catch {
    // Armazenamento negado (modo privado, cota): segue só em memória
  }
};

const safeRemove = (storage: Storage, key: string): void => {
  try {
    storage.removeItem(key);
  } catch {
    // no-op
  }
};

/** Remove a sessão. */
export const clearStoredSession = (): void => safeRemove(localStorage, AUTH_STORAGE_KEY);

/** Grava a sessão. */
export const writeStoredSession = (session: AuthSession): void =>
  safeSet(localStorage, AUTH_STORAGE_KEY, JSON.stringify(session));

/** Lê a sessão; vencida, corrompida ou com formato inesperado é removida (`null`). */
export const readStoredSession = (now: number = Date.now()): AuthSession | null => {
  const raw = safeGet(localStorage, AUTH_STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isSessionShape(parsed) || isSessionExpired(parsed, now)) {
      clearStoredSession();
      return null;
    }
    return parsed;
  } catch {
    clearStoredSession();
    return null;
  }
};

/** Token da sessão válida, ou `null`. */
export const getStoredToken = (): string | null => readStoredSession()?.token ?? null;

/** Remove a empresa ativa guardada. */
export const clearStoredCompany = (): void => safeRemove(localStorage, COMPANY_STORAGE_KEY);

/** Rota interna segura (começa com "/" e não é protocolo-relativa). */
export const isSafeInternalPath = (path: string | null | undefined): path is string =>
  typeof path === "string" && path.startsWith("/") && !path.startsWith("//");

/** Guarda a rota a abrir depois do login (ignora rotas públicas de entrada). */
export const saveReturnTo = (path: string): void => {
  if (!isSafeInternalPath(path)) return;
  if (path.startsWith("/entrar") || path.startsWith("/cadastro")) return;
  safeSet(sessionStorage, RETURN_TO_STORAGE_KEY, path);
};

/** Lê e apaga a rota guardada. */
export const consumeReturnTo = (): string | null => {
  const value = safeGet(sessionStorage, RETURN_TO_STORAGE_KEY);
  safeRemove(sessionStorage, RETURN_TO_STORAGE_KEY);
  return isSafeInternalPath(value) ? value : null;
};

/** Guarda o token do convite a aceitar depois de entrar. */
export const savePendingInvite = (token: string): void => safeSet(sessionStorage, PENDING_INVITE_STORAGE_KEY, token);

/** Token do convite pendente, sem apagar. */
export const readPendingInvite = (): string | null => {
  const value = safeGet(sessionStorage, PENDING_INVITE_STORAGE_KEY);
  return value && value.trim().length > 0 ? value.trim() : null;
};

/** Apaga o convite pendente. */
export const clearPendingInvite = (): void => safeRemove(sessionStorage, PENDING_INVITE_STORAGE_KEY);

/**
 * Destino depois de entrar/cadastrar: convite pendente (aceito pela tela do convite) →
 * rota pedida (`from`, vinda do guard) → rota guardada (`pontua:returnTo`, sessão expirada) →
 * tela de ponto (os guards levam a `/bem-vindo` sem empresa).
 */
export const resolvePostLoginPath = (from?: string | null): string => {
  const stored = consumeReturnTo();
  const invite = readPendingInvite();
  if (invite) return `/convite/${encodeURIComponent(invite)}`;
  if (isSafeInternalPath(from) && !from.startsWith("/entrar") && !from.startsWith("/cadastro")) return from;
  return stored ?? "/";
};
