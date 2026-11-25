import { createContext, useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import i18n from "../i18n";
import { useCompany } from "../hooks/useCompany";
import { toErrorMessage } from "../Services/apiClient";
import { memberService } from "../Services/memberService";
import type { ManagerInput, MemberInfo, MemberPositionInput, MemberStatusFilter } from "../types/member";
import type { ScheduleInfo, ScheduleInput } from "../types/schedule";

export interface MemberContextType {
  // Estado
  members: MemberInfo[];
  /** Membro aberto no detalhe (com históricos) */
  selected: MemberInfo | null;
  loading: boolean;
  error: string | null;
  stale: boolean;
  fetchedAt: string | null;
  // Métodos
  load: (status?: MemberStatusFilter, positionId?: number | null) => Promise<void>;
  /** Carrega o detalhe e guarda em `selected` */
  get: (memberId: number) => Promise<MemberInfo>;
  changePosition: (memberId: number, data: MemberPositionInput) => Promise<MemberInfo>;
  setSchedule: (memberId: number, data: ScheduleInput) => Promise<ScheduleInfo>;
  clearSchedule: (memberId: number, effectiveFrom?: string | null) => Promise<void>;
  deactivate: (memberId: number) => Promise<void>;
  reactivate: (memberId: number) => Promise<void>;
  setManager: (memberId: number, data: ManagerInput) => Promise<MemberInfo>;
  clearError: () => void;
}

const MemberContext = createContext<MemberContextType | undefined>(undefined);

/** Membros da empresa ativa: lista, detalhe e ações do responsável (US7, FR-020). */
export const MemberProvider = ({ children }: { children: ReactNode }) => {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.companyId ?? null;
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [selected, setSelected] = useState<MemberInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [trackedCompany, setTrackedCompany] = useState<number | null>(companyId);
  const requestId = useRef(0);
  const detailRequestId = useRef(0);

  if (trackedCompany !== companyId) {
    setTrackedCompany(companyId);
    setMembers([]);
    setSelected(null);
    setError(null);
    setStale(false);
    setFetchedAt(null);
  }

  const handleError = useCallback((err: unknown): never => {
    setError(toErrorMessage(err));
    throw err;
  }, []);

  const requireCompany = useCallback((): number => {
    if (companyId === null) throw new Error(i18n.t("erros:semEmpresa"));
    return companyId;
  }, [companyId]);

  /** Atualiza o membro na lista e no detalhe (mantém os históricos do detalhe). */
  const applyMember = useCallback((member: MemberInfo) => {
    setMembers((previous) => previous.map((item) => (item.memberId === member.memberId ? { ...item, ...member } : item)));
    setSelected((previous) => (previous?.memberId === member.memberId ? { ...previous, ...member } : previous));
  }, []);

  const load = useCallback(
    async (status: MemberStatusFilter = "active", positionId?: number | null): Promise<void> => {
      if (companyId === null) return;
      const ticket = ++requestId.current;
      try {
        setLoading(true);
        setError(null);
        const result = await memberService.list(companyId, status, positionId);
        if (ticket !== requestId.current) return;
        setMembers(result.data);
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

  const get = useCallback(
    async (memberId: number): Promise<MemberInfo> => {
      const ticket = ++detailRequestId.current;
      try {
        const id = requireCompany();
        setError(null);
        const result = await memberService.get(id, memberId);
        if (ticket === detailRequestId.current) {
          setSelected(result.data);
          setStale(result.stale);
          setFetchedAt(result.fetchedAt);
        }
        return result.data;
      } catch (err) {
        return handleError(err);
      }
    },
    [requireCompany, handleError],
  );

  /** Recarrega o detalhe depois de uma ação (falha na recarga não desfaz a ação). */
  const refreshDetail = useCallback(
    async (memberId: number): Promise<void> => {
      try {
        await get(memberId);
      } catch {
        // A ação foi feita; o detalhe atualiza na próxima abertura
      }
    },
    [get],
  );

  const changePosition = useCallback(
    async (memberId: number, data: MemberPositionInput): Promise<MemberInfo> => {
      try {
        setError(null);
        const member = await memberService.changePosition(requireCompany(), memberId, data);
        applyMember(member);
        await refreshDetail(memberId);
        return member;
      } catch (err) {
        return handleError(err);
      }
    },
    [requireCompany, applyMember, refreshDetail, handleError],
  );

  const setSchedule = useCallback(
    async (memberId: number, data: ScheduleInput): Promise<ScheduleInfo> => {
      try {
        setError(null);
        const schedule = await memberService.setSchedule(requireCompany(), memberId, data);
        await refreshDetail(memberId);
        return schedule;
      } catch (err) {
        return handleError(err);
      }
    },
    [requireCompany, refreshDetail, handleError],
  );

  const clearSchedule = useCallback(
    async (memberId: number, effectiveFrom?: string | null): Promise<void> => {
      try {
        setError(null);
        await memberService.clearSchedule(requireCompany(), memberId, effectiveFrom);
        await refreshDetail(memberId);
      } catch (err) {
        handleError(err);
      }
    },
    [requireCompany, refreshDetail, handleError],
  );

  const deactivate = useCallback(
    async (memberId: number): Promise<void> => {
      try {
        setError(null);
        await memberService.deactivate(requireCompany(), memberId);
        setMembers((previous) =>
          previous.map((item): MemberInfo => (item.memberId === memberId ? { ...item, status: "inactive" } : item)),
        );
        await refreshDetail(memberId);
      } catch (err) {
        handleError(err);
      }
    },
    [requireCompany, refreshDetail, handleError],
  );

  const reactivate = useCallback(
    async (memberId: number): Promise<void> => {
      try {
        setError(null);
        await memberService.reactivate(requireCompany(), memberId);
        setMembers((previous) =>
          previous.map((item): MemberInfo => (item.memberId === memberId ? { ...item, status: "active" } : item)),
        );
        await refreshDetail(memberId);
      } catch (err) {
        handleError(err);
      }
    },
    [requireCompany, refreshDetail, handleError],
  );

  const setManager = useCallback(
    async (memberId: number, data: ManagerInput): Promise<MemberInfo> => {
      try {
        setError(null);
        const member = await memberService.setManager(requireCompany(), memberId, data);
        applyMember(member);
        return member;
      } catch (err) {
        return handleError(err);
      }
    },
    [requireCompany, applyMember, handleError],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<MemberContextType>(
    () => ({
      members,
      selected,
      loading,
      error,
      stale,
      fetchedAt,
      load,
      get,
      changePosition,
      setSchedule,
      clearSchedule,
      deactivate,
      reactivate,
      setManager,
      clearError,
    }),
    [
      members,
      selected,
      loading,
      error,
      stale,
      fetchedAt,
      load,
      get,
      changePosition,
      setSchedule,
      clearSchedule,
      deactivate,
      reactivate,
      setManager,
      clearError,
    ],
  );

  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>;
};

export default MemberContext;
