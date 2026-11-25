import { createContext, useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import i18n from "../i18n";
import { useCompany } from "../hooks/useCompany";
import { useRole } from "../hooks/useRole";
import { isApiError, toErrorMessage } from "../Services/apiClient";
import { approvalService } from "../Services/approvalService";
import { punchService } from "../Services/punchService";
import type { ApprovalFilter } from "../Services/approvalService";
import type { PendingPanelDay } from "../types/approval";
import type { PunchInfo, PunchStatus } from "../types/punch";
import { DEFAULT_TIME_ZONE, addDays, todayInZone } from "../utils/dateTime";

/** Janela do contador de pendências: hoje e os 30 dias anteriores (research R-11). */
export const PENDING_COUNT_DAYS = 31;
/** Status da API quando outra pessoa já analisou a marcação. */
export const ALREADY_REVIEWED_STATUS = 409;

export type ReviewDecision = "approve" | "reject";

export interface ApprovalContextType {
  // Estado
  days: PendingPanelDay[];
  /** Marcações pendentes nos últimos 31 dias (navegação; 0 para quem não pode aprovar) */
  pendingCount: number;
  loading: boolean;
  error: string | null;
  stale: boolean;
  fetchedAt: string | null;
  /** Marcações com análise em andamento */
  reviewing: number[];
  // Métodos
  load: (filter: ApprovalFilter) => Promise<void>;
  /** Recarrega o último filtro pedido */
  reload: () => Promise<void>;
  /** Aprova com atualização otimista (reverte em erro; 409 recarrega a lista) */
  approve: (punchId: number, note?: string | null) => Promise<PunchInfo>;
  /** Rejeita com motivo opcional, otimista como `approve` */
  reject: (punchId: number, note?: string | null) => Promise<PunchInfo>;
  /** Atualiza o contador da navegação */
  refreshCount: () => Promise<void>;
  clearError: () => void;
}

const ApprovalContext = createContext<ApprovalContextType | undefined>(undefined);

/** Soma as marcações pendentes de um painel. */
export const countPending = (days: PendingPanelDay[]): number =>
  days.reduce(
    (total, day) =>
      total +
      day.members.reduce(
        (sum, member) => sum + member.punches.filter((punch) => punch.status === "pending").length,
        0,
      ),
    0,
  );

/** Troca uma marcação (e, se pedido, a original que ela corrige) em todos os dias. */
const replacePunch = (
  days: PendingPanelDay[],
  punchId: number,
  update: (punch: PunchInfo) => PunchInfo,
  originalStatus?: PunchStatus,
): PendingPanelDay[] =>
  days.map((day) => ({
    ...day,
    members: day.members.map((member) => {
      const target = member.punches.find((punch) => punch.punchId === punchId);
      if (!target) return member;
      return {
        ...member,
        punches: member.punches.map((punch) => {
          if (punch.punchId === punchId) return update(punch);
          if (originalStatus && target.replacesPunchId === punch.punchId) return { ...punch, status: originalStatus };
          return punch;
        }),
      };
    }),
  }));

/** Dia e membro de uma marcação no painel. */
const locatePunch = (days: PendingPanelDay[], punchId: number): { date: string; memberId: number } | null => {
  for (const day of days) {
    const member = day.members.find((item) => item.punches.some((punch) => punch.punchId === punchId));
    if (member) return { date: day.date, memberId: member.memberId };
  }
  return null;
};

/** Troca as marcações de um membro num dia (resto do painel intacto). */
const replaceMemberPunches = (
  days: PendingPanelDay[],
  date: string,
  memberId: number,
  punches: PunchInfo[],
): PendingPanelDay[] =>
  days.map((day) =>
    day.date !== date
      ? day
      : { ...day, members: day.members.map((member) => (member.memberId === memberId ? { ...member, punches } : member)) },
  );

/**
 * Painel de aprovações e contador de pendências (US6, FR-022/FR-023, research R-11). O contador é
 * atualizado por `refreshCount` (chamado pela casca ao entrar, ao trocar de empresa, a cada 2 min
 * com a aba visível) e após cada análise.
 */
export const ApprovalProvider = ({ children }: { children: ReactNode }) => {
  const { activeCompany, me } = useCompany();
  const { canSupervise } = useRole();
  const companyId = activeCompany?.companyId ?? null;
  const timeZone = activeCompany?.timeZone ?? DEFAULT_TIME_ZONE;
  const [days, setDays] = useState<PendingPanelDay[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<number[]>([]);
  const [trackedCompany, setTrackedCompany] = useState<number | null>(companyId);
  const requestId = useRef(0);
  const countRequestId = useRef(0);
  const lastFilter = useRef<ApprovalFilter | null>(null);
  const daysRef = useRef(days);
  daysRef.current = days;
  /** Análises em andamento (síncrono, para a recarga do dia não atropelar outra análise) */
  const reviewingRef = useRef<Set<number>>(new Set());
  /** Última recarga pedida por membro/dia (respostas antigas são descartadas) */
  const dayRefreshTickets = useRef<Map<string, number>>(new Map());

  if (trackedCompany !== companyId) {
    setTrackedCompany(companyId);
    setDays([]);
    setPendingCount(0);
    setError(null);
    setStale(false);
    setFetchedAt(null);
    setReviewing([]);
  }

  const handleError = useCallback((err: unknown): never => {
    setError(toErrorMessage(err));
    throw err;
  }, []);

  const load = useCallback(
    async (filter: ApprovalFilter): Promise<void> => {
      if (companyId === null) return;
      const ticket = ++requestId.current;
      lastFilter.current = filter;
      try {
        setLoading(true);
        setError(null);
        const result = await approvalService.list(companyId, filter);
        if (ticket !== requestId.current) return;
        setDays(result.data);
        setStale(result.stale);
        setFetchedAt(result.fetchedAt);
      } catch (err) {
        if (ticket === requestId.current) setError(toErrorMessage(err));
      } finally {
        if (ticket === requestId.current) setLoading(false);
      }
    },
    [companyId],
  );

  const reload = useCallback(async (): Promise<void> => {
    if (lastFilter.current) await load(lastFilter.current);
  }, [load]);

  const refreshCount = useCallback(async (): Promise<void> => {
    if (companyId === null || !canSupervise) {
      setPendingCount(0);
      return;
    }
    const ticket = ++countRequestId.current;
    const end = todayInZone(timeZone);
    const start = addDays(end, -(PENDING_COUNT_DAYS - 1));
    try {
      const list = await approvalService.listPending(companyId, { start, end });
      if (ticket === countRequestId.current) setPendingCount(countPending(list));
    } catch {
      // Sem conexão ou erro: mantém o último valor conhecido
    }
  }, [companyId, canSupervise, timeZone]);

  /**
   * N-02: aprovar ou rejeitar muda os períodos calculados pelo servidor para as OUTRAS marcações do
   * dia (ex.: a inclusão rejeitada deixa de "empurrar" Entrada/Pausa/Saída). Depois de cada análise,
   * recarrega o dia do membro e troca só as marcações dele no painel.
   */
  const refreshMemberDay = useCallback(
    async (date: string, memberId: number): Promise<void> => {
      if (companyId === null) return;
      const key = `${date}:${memberId}`;
      const ticket = (dayRefreshTickets.current.get(key) ?? 0) + 1;
      dayRefreshTickets.current.set(key, ticket);
      try {
        const result = await punchService.getMemberDays(companyId, memberId, { start: date, end: date });
        if (result.stale || dayRefreshTickets.current.get(key) !== ticket) return;
        const record = result.data.find((item) => item.date === date);
        if (!record) return;
        // Outra análise deste membro ainda em andamento: ela mesma recarrega o dia ao terminar
        const current = daysRef.current
          .find((day) => day.date === date)
          ?.members.find((member) => member.memberId === memberId);
        if (current?.punches.some((punch) => reviewingRef.current.has(punch.punchId))) return;
        setDays((previous) => replaceMemberPunches(previous, date, memberId, record.punches));
      } catch {
        // Sem conexão ou erro: mantém a linha atualizada pela resposta da análise
      }
    },
    [companyId],
  );

  const review = useCallback(
    async (decision: ReviewDecision, punchId: number, note?: string | null): Promise<PunchInfo> => {
      if (companyId === null) throw new Error(i18n.t("erros:semEmpresa"));
      const snapshot = daysRef.current;
      const location = locatePunch(snapshot, punchId);
      reviewingRef.current.add(punchId);
      const nextStatus: PunchStatus = decision === "approve" ? "approved" : "rejected";
      const trimmedNote = note?.trim() ? note.trim() : null;
      setError(null);
      setReviewing((previous) => [...previous, punchId]);
      setPendingCount((count) => Math.max(0, count - 1));
      // Otimista: a linha muda na hora (aprovar uma correção substitui a original)
      setDays((previous) =>
        replacePunch(
          previous,
          punchId,
          (punch) => ({
            ...punch,
            status: nextStatus,
            countsAsWorked: decision === "approve",
            review: { by: me?.name ?? "", at: new Date().toISOString(), note: trimmedNote },
          }),
          decision === "approve" ? "superseded" : undefined,
        ),
      );
      try {
        const body = { note: trimmedNote };
        const result =
          decision === "approve"
            ? await approvalService.approve(companyId, punchId, body)
            : await approvalService.reject(companyId, punchId, body);
        setDays((previous) =>
          replacePunch(previous, punchId, () => result, result.status === "approved" ? "superseded" : undefined),
        );
        reviewingRef.current.delete(punchId);
        if (location) void refreshMemberDay(location.date, location.memberId);
        void refreshCount();
        return result;
      } catch (err) {
        // Reverte e, se outra pessoa já analisou, traz a situação atual
        setDays(snapshot);
        setPendingCount((count) => count + 1);
        if (isApiError(err) && err.status === ALREADY_REVIEWED_STATUS) void reload();
        void refreshCount();
        return handleError(err);
      } finally {
        reviewingRef.current.delete(punchId);
        setReviewing((previous) => previous.filter((id) => id !== punchId));
      }
    },
    [companyId, me, refreshCount, refreshMemberDay, reload, handleError],
  );

  const approve = useCallback(
    (punchId: number, note?: string | null) => review("approve", punchId, note),
    [review],
  );

  const reject = useCallback(
    (punchId: number, note?: string | null) => review("reject", punchId, note),
    [review],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<ApprovalContextType>(
    () => ({
      days,
      pendingCount: canSupervise ? pendingCount : 0,
      loading,
      error,
      stale,
      fetchedAt,
      reviewing,
      load,
      reload,
      approve,
      reject,
      refreshCount,
      clearError,
    }),
    [days, canSupervise, pendingCount, loading, error, stale, fetchedAt, reviewing, load, reload, approve, reject, refreshCount, clearError],
  );

  return <ApprovalContext.Provider value={value}>{children}</ApprovalContext.Provider>;
};

export default ApprovalContext;
