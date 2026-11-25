import { createContext, useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import i18n from "../i18n";
import { useCompany } from "../hooks/useCompany";
import { toErrorMessage } from "../Services/apiClient";
import { punchService } from "../Services/punchService";
import { summaryService } from "../Services/summaryService";
import type { DateRangeQuery } from "../types/common";
import type { DayRecord, ManualPunchInput, PunchInfo } from "../types/punch";
import type { HoursSummary } from "../types/summary";

export interface HistoryContextType {
  // Estado
  /** Dias do período (todos, inclusive sem marcação), na ordem da API */
  days: DayRecord[];
  summary: HoursSummary | null;
  /** Membro cujo histórico está carregado (`null` = o próprio usuário) */
  memberId: number | null;
  loading: boolean;
  error: string | null;
  /** Dados vindos do cache local por falta de conexão */
  stale: boolean;
  fetchedAt: string | null;
  // Métodos
  /** Dias e resumo em paralelo (network-first); `memberId` → histórico de outro membro */
  load: (range: DateRangeQuery, memberId?: number | null) => Promise<void>;
  /** Recarrega o último período pedido */
  reload: () => Promise<void>;
  /** Marcação manual (inclusão ou correção) — sempre pendente; recarrega o período */
  createManual: (data: ManualPunchInput) => Promise<PunchInfo>;
  /** Cancela um pedido manual pendente do próprio usuário; recarrega o período */
  cancel: (punchId: number) => Promise<void>;
  /** Detalhe da marcação com o histórico de status */
  getPunch: (punchId: number) => Promise<PunchInfo>;
  clearError: () => void;
}

interface LastRequest {
  range: DateRangeQuery;
  memberId: number | null;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

/** Histórico por dia, resumo de horas e marcação manual (US5, FR-015–FR-017). */
export const HistoryProvider = ({ children }: { children: ReactNode }) => {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.companyId ?? null;
  const [days, setDays] = useState<DayRecord[]>([]);
  const [summary, setSummary] = useState<HoursSummary | null>(null);
  const [memberId, setMemberId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [trackedCompany, setTrackedCompany] = useState<number | null>(companyId);
  const requestId = useRef(0);
  const lastRequest = useRef<LastRequest | null>(null);

  // Troca de empresa: nada da anterior aparece na nova
  if (trackedCompany !== companyId) {
    setTrackedCompany(companyId);
    setDays([]);
    setSummary(null);
    setMemberId(null);
    setError(null);
    setStale(false);
    setFetchedAt(null);
  }

  const handleError = useCallback((err: unknown): never => {
    setError(toErrorMessage(err));
    throw err;
  }, []);

  const load = useCallback(
    async (range: DateRangeQuery, target: number | null = null): Promise<void> => {
      if (companyId === null) return;
      const ticket = ++requestId.current;
      const previous = lastRequest.current;
      lastRequest.current = { range, memberId: target };
      // Outro membro: não mostra os dias do anterior enquanto carrega
      if (previous && previous.memberId !== target) {
        setDays([]);
        setSummary(null);
      }
      setMemberId(target);
      try {
        setLoading(true);
        setError(null);
        const [dayResult, summaryResult] = await Promise.all([
          target === null
            ? punchService.getMyDays(companyId, range)
            : punchService.getMemberDays(companyId, target, range),
          target === null
            ? summaryService.getMine(companyId, range)
            : summaryService.getMember(companyId, target, range),
        ]);
        if (ticket !== requestId.current) return;
        setDays(dayResult.data);
        setSummary(summaryResult.data);
        setStale(dayResult.stale || summaryResult.stale);
        setFetchedAt(dayResult.stale ? dayResult.fetchedAt : summaryResult.fetchedAt);
      } catch (err) {
        if (ticket === requestId.current) setError(toErrorMessage(err));
      } finally {
        if (ticket === requestId.current) setLoading(false);
      }
    },
    [companyId],
  );

  const reload = useCallback(async (): Promise<void> => {
    const last = lastRequest.current;
    if (last) await load(last.range, last.memberId);
  }, [load]);

  const createManual = useCallback(
    async (data: ManualPunchInput): Promise<PunchInfo> => {
      try {
        if (companyId === null) throw new Error(i18n.t("erros:semEmpresa"));
        setError(null);
        const created = await punchService.createManual(companyId, data);
        void reload();
        return created;
      } catch (err) {
        return handleError(err);
      }
    },
    [companyId, reload, handleError],
  );

  const cancel = useCallback(
    async (punchId: number): Promise<void> => {
      try {
        if (companyId === null) throw new Error(i18n.t("erros:semEmpresa"));
        setError(null);
        await punchService.cancel(companyId, punchId);
        // Reflete na hora (o servidor confirma na recarga)
        setDays((previous) =>
          previous.map((day) => ({
            ...day,
            punches: day.punches.map((punch): PunchInfo =>
              punch.punchId === punchId ? { ...punch, status: "cancelled" } : punch,
            ),
          })),
        );
        void reload();
      } catch (err) {
        handleError(err);
      }
    },
    [companyId, reload, handleError],
  );

  const getPunch = useCallback(
    async (punchId: number): Promise<PunchInfo> => {
      if (companyId === null) throw new Error(i18n.t("erros:semEmpresa"));
      return punchService.getPunch(companyId, punchId);
    },
    [companyId],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<HistoryContextType>(
    () => ({
      days,
      summary,
      memberId,
      loading,
      error,
      stale,
      fetchedAt,
      load,
      reload,
      createManual,
      cancel,
      getPunch,
      clearError,
    }),
    [days, summary, memberId, loading, error, stale, fetchedAt, load, reload, createManual, cancel, getPunch, clearError],
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
};

export default HistoryContext;
