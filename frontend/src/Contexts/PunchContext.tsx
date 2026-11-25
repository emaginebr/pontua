import { createContext, useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import i18n from "../i18n";
import { useCompany } from "../hooks/useCompany";
import { useConnectivity } from "../hooks/useConnectivity";
import { usePunchQueue } from "../hooks/usePunchQueue";
import { ApiError, isApiError, toErrorMessage } from "../Services/apiClient";
import { punchService } from "../Services/punchService";
import { summaryService } from "../Services/summaryService";
import type { DayRecord, PunchInfo, QueuedPunch } from "../types/punch";
import type { HoursSummary } from "../types/summary";
import {
  DEFAULT_TIME_ZONE,
  addDays,
  applyServerOffset,
  dayOfWeek,
  toIsoWithDeviceOffset,
  todayInZone,
} from "../utils/dateTime";

/** Status do "aguarde 1 minuto" (`POST /punches` < 60 s após a anterior). */
export const PUNCH_TOO_SOON_STATUS = 422;

/** Registro aceito pelo servidor. */
export interface PunchOnlineOutcome {
  kind: "online";
  punch: PunchInfo;
}

/** Registro guardado no aparelho para envio depois. */
export interface PunchQueuedOutcome {
  kind: "queued";
  item: QueuedPunch;
}

export type PunchOutcome = PunchOnlineOutcome | PunchQueuedOutcome;

export interface PunchContextType {
  // Estado
  /** Dia de hoje (fuso da empresa) com períodos e marcações */
  today: DayRecord | null;
  loading: boolean;
  error: string | null;
  /** Dados de hoje vieram do cache local */
  stale: boolean;
  fetchedAt: string | null;
  /** Registro em andamento */
  punching: boolean;
  /** Instante (ms, relógio do servidor) do último registro feito neste aparelho */
  lastPunchAt: number | null;
  /** Resumo da semana corrente (segunda a domingo) — cartão "Esta semana" */
  week: HoursSummary | null;
  // Métodos
  loadToday: () => Promise<void>;
  /** `summary/me` da semana corrente (network-first; falha mantém o último valor) */
  loadWeek: () => Promise<void>;
  /** Registra o ponto: online → `POST /punches`; sem conexão/falha de rede → fila offline */
  punch: () => Promise<PunchOutcome>;
  clearError: () => void;
}

const PunchContext = createContext<PunchContextType | undefined>(undefined);

/**
 * Ponto do dia (research R-06/R-08): `GET punches/me` de hoje (network-first) e registro com
 * fallback para a fila offline. O "hoje" é o do fuso da empresa no relógio do servidor.
 */
export const PunchProvider = ({ children }: { children: ReactNode }) => {
  const { activeCompany } = useCompany();
  const { isOnline, serverOffset } = useConnectivity();
  const { enqueue } = usePunchQueue();
  const companyId = activeCompany?.companyId ?? null;
  const timeZone = activeCompany?.timeZone ?? DEFAULT_TIME_ZONE;
  const [today, setToday] = useState<DayRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [punching, setPunching] = useState(false);
  const [lastPunchAt, setLastPunchAt] = useState<number | null>(null);
  const [week, setWeek] = useState<HoursSummary | null>(null);
  const weekRequestId = useRef(0);
  const [trackedCompany, setTrackedCompany] = useState<number | null>(companyId);
  const requestId = useRef(0);
  const companyIdRef = useRef(companyId);
  companyIdRef.current = companyId;
  const serverOffsetRef = useRef(serverOffset);
  serverOffsetRef.current = serverOffset;

  // Troca de empresa: nada da anterior aparece na nova (ajuste durante a renderização)
  if (trackedCompany !== companyId) {
    setTrackedCompany(companyId);
    setToday(null);
    setError(null);
    setStale(false);
    setFetchedAt(null);
    setLastPunchAt(null);
    setWeek(null);
  }

  const handleError = useCallback((err: unknown): never => {
    setError(toErrorMessage(err));
    throw err;
  }, []);

  const loadToday = useCallback(async (): Promise<void> => {
    if (companyId === null) return;
    const ticket = ++requestId.current;
    const day = todayInZone(timeZone, applyServerOffset(serverOffsetRef.current));
    const isCurrent = () => ticket === requestId.current && companyIdRef.current === companyId;
    try {
      setLoading(true);
      setError(null);
      const result = await punchService.getMyDays(companyId, { start: day, end: day });
      if (!isCurrent()) return;
      setToday(result.data.find((item) => item.date === day) ?? result.data[0] ?? null);
      setStale(result.stale);
      setFetchedAt(result.fetchedAt);
    } catch (err) {
      if (isCurrent()) setError(toErrorMessage(err));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [companyId, timeZone]);

  const loadWeek = useCallback(async (): Promise<void> => {
    if (companyId === null) return;
    const ticket = ++weekRequestId.current;
    const day = todayInZone(timeZone, applyServerOffset(serverOffsetRef.current));
    const monday = addDays(day, -((dayOfWeek(day) + 6) % 7));
    try {
      const result = await summaryService.getMine(companyId, { start: monday, end: addDays(monday, 6) });
      if (ticket === weekRequestId.current && companyIdRef.current === companyId) setWeek(result.data);
    } catch {
      // Cartão secundário: sem dado novo, mantém o último (ou some)
    }
  }, [companyId, timeZone]);

  const punch = useCallback(async (): Promise<PunchOutcome> => {
    if (companyId === null) throw new Error(i18n.t("erros:semEmpresa"));
    // Horário do toque (não o do fim de um timeout) para a cópia offline
    const punchedAt = toIsoWithDeviceOffset(new Date());
    const serverNow = () => Date.now() + serverOffsetRef.current;
    const queue = async (): Promise<PunchOutcome> => {
      const item = await enqueue(companyId, punchedAt);
      setLastPunchAt(serverNow());
      return { kind: "queued", item };
    };
    try {
      setPunching(true);
      setError(null);
      if (!isOnline) return await queue();
      try {
        const result = await punchService.punch(companyId);
        const at = Date.parse(result.punchedAt);
        setLastPunchAt(Number.isNaN(at) ? serverNow() : at);
        void loadToday();
        void loadWeek();
        return { kind: "online", punch: result };
      } catch (err) {
        // Falha de rede/timeout: a marcação vai para a fila (trade-off do research R-06)
        if (isApiError(err) && err.offline) return await queue();
        if (isApiError(err) && err.status === PUNCH_TOO_SOON_STATUS) {
          void loadToday();
          throw new ApiError(err.status, i18n.t("ponto:errors.tooSoon"), err.erros);
        }
        throw err;
      }
    } catch (err) {
      return handleError(err);
    } finally {
      setPunching(false);
    }
  }, [companyId, isOnline, enqueue, loadToday, loadWeek, handleError]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<PunchContextType>(
    () => ({
      today,
      loading,
      error,
      stale,
      fetchedAt,
      punching,
      lastPunchAt,
      week,
      loadToday,
      loadWeek,
      punch,
      clearError,
    }),
    [today, loading, error, stale, fetchedAt, punching, lastPunchAt, week, loadToday, loadWeek, punch, clearError],
  );

  return <PunchContext.Provider value={value}>{children}</PunchContext.Provider>;
};

export default PunchContext;
