import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { setUnauthorizedHandler, toErrorMessage } from "../Services/apiClient";
import {
  AUTH_STORAGE_KEY,
  clearStoredCompany,
  clearStoredSession,
  readStoredSession,
  saveReturnTo,
  writeStoredSession,
} from "../Services/authSession";
import { authService } from "../Services/authService";
import { offlineCache } from "../Services/offlineCache";
import type {
  AuthResult,
  AuthSession,
  GoogleLoginInput,
  LoginInput,
  PasswordUpdateInput,
  RegisterInput,
  UserInfo,
} from "../types/auth";

/** Maior atraso aceito por `setTimeout` (~24,8 dias). */
const MAX_TIMEOUT_MS = 2_147_483_647;

type LogoutListener = (userId: number) => void;

export interface AuthContextType {
  // Estado
  user: UserInfo | null;
  token: string | null;
  expiresAt: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  /** A sessão terminou sozinha (expiração/401): a tela de entrada mostra o aviso */
  sessionExpired: boolean;
  // Métodos
  register: (data: RegisterInput) => Promise<AuthResult>;
  login: (data: LoginInput) => Promise<AuthResult>;
  loginWithGoogle: (idToken: string) => Promise<AuthResult>;
  logout: () => void;
  updateName: (name: string) => Promise<UserInfo>;
  updatePassword: (data: PasswordUpdateInput) => Promise<void>;
  refreshMe: () => Promise<UserInfo>;
  /**
   * Avisa quando a sessão de um usuário termina (caches de leitura). A fila de marcações offline
   * não escuta este evento: ela nunca é apagada no logout/401 (research R-07 › Atualização).
   */
  onLogout: (listener: LogoutListener) => () => void;
  clearError: () => void;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toSession = (result: AuthResult): AuthSession => ({
  token: result.token,
  expiresAt: result.expiresAt,
  user: result.user,
});

/** Rota atual relativa ao `basename` do roteador (para `returnTo`). */
const currentInternalPath = (): string => {
  const basename = (import.meta.env.VITE_SITE_BASENAME ?? "").replace(/\/+$/, "");
  const { pathname, search } = window.location;
  const path = basename && pathname.startsWith(basename) ? pathname.slice(basename.length) || "/" : pathname;
  return `${path}${search}`;
};

/**
 * Sessão JWT (research R-04, Princípio VI): `localStorage` `pontua:auth`, restaurada na abertura
 * (descarta a vencida), derrubada no 401 ou na expiração com `pontua:returnTo` guardado.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const sessionRef = useRef<AuthSession | null>(session);
  const logoutListeners = useRef(new Set<LogoutListener>());

  const applySession = useCallback((next: AuthSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const handleError = useCallback((err: unknown): never => {
    setError(toErrorMessage(err));
    throw err;
  }, []);

  /**
   * Limpa a sessão do usuário que saiu (sessão, empresa, cache de leitura, ouvintes). A fila de
   * marcações offline fica guardada para o próximo acesso dele (research R-07 › Atualização).
   */
  const endSession = useCallback(() => {
    const previous = sessionRef.current;
    clearStoredSession();
    clearStoredCompany();
    if (previous) {
      void offlineCache.clearUser(previous.user.userId);
      logoutListeners.current.forEach((listener) => listener(previous.user.userId));
    }
    applySession(null);
  }, [applySession]);

  /** Sessão recusada (401) ou vencida: guarda onde estava e volta para a entrada. */
  const expireSession = useCallback(() => {
    if (!sessionRef.current) return;
    saveReturnTo(currentInternalPath());
    endSession();
    setSessionExpired(true);
  }, [endSession]);

  // Qualquer 401 em chamada autenticada derruba a sessão
  useEffect(() => {
    setUnauthorizedHandler(expireSession);
    return () => setUnauthorizedHandler(null);
  }, [expireSession]);

  // Expira com o app aberto
  useEffect(() => {
    if (!session) return undefined;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    if (Number.isNaN(remaining) || remaining <= 0) {
      expireSession();
      return undefined;
    }
    if (remaining > MAX_TIMEOUT_MS) return undefined;
    const timer = window.setTimeout(expireSession, remaining);
    return () => window.clearTimeout(timer);
  }, [session, expireSession]);

  // Outras abas: entrar/sair em uma reflete nas demais
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== AUTH_STORAGE_KEY) return;
      applySession(readStoredSession());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [applySession]);

  const startSession = useCallback(
    (result: AuthResult) => {
      const previous = sessionRef.current;
      // Outra pessoa entrando no mesmo aparelho não herda a empresa ativa
      if (previous && previous.user.userId !== result.user.userId) clearStoredCompany();
      const next = toSession(result);
      writeStoredSession(next);
      setSessionExpired(false);
      applySession(next);
    },
    [applySession],
  );

  const runAuth = useCallback(
    async (action: () => Promise<AuthResult>): Promise<AuthResult> => {
      try {
        setLoading(true);
        setError(null);
        const result = await action();
        startSession(result);
        return result;
      } catch (err) {
        return handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [startSession, handleError],
  );

  const register = useCallback((data: RegisterInput) => runAuth(() => authService.register(data)), [runAuth]);

  const login = useCallback((data: LoginInput) => runAuth(() => authService.login(data)), [runAuth]);

  const loginWithGoogle = useCallback(
    (idToken: string) => {
      const data: GoogleLoginInput = { idToken };
      return runAuth(() => authService.loginWithGoogle(data));
    },
    [runAuth],
  );

  const logout = useCallback(() => {
    endSession();
    setError(null);
    setSessionExpired(false);
  }, [endSession]);

  /** Atualiza o usuário da sessão guardada. */
  const replaceUser = useCallback(
    (user: UserInfo) => {
      const current = sessionRef.current;
      if (!current) return;
      const next: AuthSession = { ...current, user };
      writeStoredSession(next);
      applySession(next);
    },
    [applySession],
  );

  const updateName = useCallback(
    async (name: string): Promise<UserInfo> => {
      try {
        setLoading(true);
        setError(null);
        const user = await authService.updateName({ name });
        replaceUser(user);
        return user;
      } catch (err) {
        return handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [replaceUser, handleError],
  );

  const updatePassword = useCallback(
    async (data: PasswordUpdateInput): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await authService.updatePassword(data);
        const current = sessionRef.current;
        if (current && !current.user.hasPassword) replaceUser({ ...current.user, hasPassword: true });
      } catch (err) {
        handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [replaceUser, handleError],
  );

  const refreshMe = useCallback(async (): Promise<UserInfo> => {
    try {
      setError(null);
      const user = await authService.me();
      replaceUser(user);
      return user;
    } catch (err) {
      return handleError(err);
    }
  }, [replaceUser, handleError]);

  const onLogout = useCallback((listener: LogoutListener) => {
    const listeners = logoutListeners.current;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const clearSessionExpired = useCallback(() => setSessionExpired(false), []);

  const value = useMemo<AuthContextType>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      expiresAt: session?.expiresAt ?? null,
      isAuthenticated: session !== null,
      loading,
      error,
      sessionExpired,
      register,
      login,
      loginWithGoogle,
      logout,
      updateName,
      updatePassword,
      refreshMe,
      onLogout,
      clearError,
      clearSessionExpired,
    }),
    [
      session,
      loading,
      error,
      sessionExpired,
      register,
      login,
      loginWithGoogle,
      logout,
      updateName,
      updatePassword,
      refreshMe,
      onLogout,
      clearError,
      clearSessionExpired,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
