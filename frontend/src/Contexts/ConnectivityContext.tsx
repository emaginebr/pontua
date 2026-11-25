import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { addNetworkResultListener, pingApi } from "../Services/apiClient";

/** Tempo offline contínuo antes de mostrar o aviso (anti-pisca, research R-08). */
export const OFFLINE_BANNER_DELAY_MS = 2_000;
/** Tempo do aviso "Conexão restabelecida" (components.md §9.1). */
export const RECONNECTED_NOTICE_MS = 3_000;
/** Intervalo dos pings enquanto offline (Wi-Fi sem internet não dispara `online`). */
export const OFFLINE_PING_INTERVAL_MS = 15_000;

export type ConnectivityStatus = "online" | "offline";

type ReconnectedCallback = () => void;

export interface ConnectivityContextType {
  // Estado
  status: ConnectivityStatus;
  isOnline: boolean;
  /** Aviso "Sem conexão" visível (após 2 s offline contínuos) */
  showBanner: boolean;
  /** Acabou de reconectar depois de um aviso visível (mostra "Conexão restabelecida") */
  justReconnected: boolean;
  /** Diferença servidor − aparelho em ms (header `Date`); 0 até a primeira resposta */
  serverOffset: number;
  // Métodos
  /** Marca online (com o offset do servidor, se conhecido) */
  reportSuccess: (serverOffset?: number) => void;
  /** Marca offline */
  reportFailure: () => void;
  /** Assina o evento `reconnected` (offline → online); devolve a função que cancela */
  onReconnected: (callback: ReconnectedCallback) => () => void;
  /** Confere a conexão com um ping na API */
  checkConnection: () => Promise<boolean>;
}

const ConnectivityContext = createContext<ConnectivityContextType | undefined>(undefined);

const initialStatus = (): ConnectivityStatus =>
  typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "online";

/**
 * Conectividade real (research R-08): combina `navigator.onLine`, os eventos `online`/`offline`
 * e o resultado de cada chamada do `apiFetch` (falha/timeout → offline).
 */
export const ConnectivityProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<ConnectivityStatus>(initialStatus);
  const [showBanner, setShowBanner] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);
  const [serverOffset, setServerOffset] = useState(0);
  const callbacks = useRef(new Set<ReconnectedCallback>());
  const wasOffline = useRef(status === "offline");
  const bannerShown = useRef(false);

  const reportSuccess = useCallback((offset?: number) => {
    if (offset !== undefined) setServerOffset(offset);
    setStatus("online");
  }, []);

  const reportFailure = useCallback(() => {
    setStatus("offline");
  }, []);

  const checkConnection = useCallback(() => pingApi(), []);

  // Resultado de cada chamada à API
  useEffect(
    () =>
      addNetworkResultListener((result) => {
        if (result.online) reportSuccess(result.serverOffset);
        else reportFailure();
      }),
    [reportSuccess, reportFailure],
  );

  // Eventos do navegador: `offline` é confiável; `online` é confirmado com um ping
  useEffect(() => {
    const onOffline = () => reportFailure();
    const onOnline = () => {
      void checkConnection();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [reportFailure, checkConnection]);

  // Aviso só após 2 s offline contínuos; na volta dispara `reconnected`
  useEffect(() => {
    if (status === "offline") {
      wasOffline.current = true;
      setJustReconnected(false);
      const timer = setTimeout(() => {
        bannerShown.current = true;
        setShowBanner(true);
      }, OFFLINE_BANNER_DELAY_MS);
      return () => clearTimeout(timer);
    }

    setShowBanner(false);
    if (!wasOffline.current) return undefined;
    wasOffline.current = false;
    callbacks.current.forEach((callback) => callback());
    if (!bannerShown.current) return undefined;
    bannerShown.current = false;
    setJustReconnected(true);
    const timer = setTimeout(() => setJustReconnected(false), RECONNECTED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [status]);

  // Enquanto offline (com a tela visível), confere a conexão de tempos em tempos
  useEffect(() => {
    if (status !== "offline") return undefined;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void checkConnection();
    }, OFFLINE_PING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, checkConnection]);

  const onReconnected = useCallback((callback: ReconnectedCallback) => {
    const set = callbacks.current;
    set.add(callback);
    return () => {
      set.delete(callback);
    };
  }, []);

  const value = useMemo<ConnectivityContextType>(
    () => ({
      status,
      isOnline: status === "online",
      showBanner,
      justReconnected,
      serverOffset,
      reportSuccess,
      reportFailure,
      onReconnected,
      checkConnection,
    }),
    [status, showBanner, justReconnected, serverOffset, reportSuccess, reportFailure, onReconnected, checkConnection],
  );

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
};

export default ConnectivityContext;
