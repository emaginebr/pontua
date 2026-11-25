import { createContext, useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import i18n from "../i18n";
import { useCompany } from "../hooks/useCompany";
import { isApiError, toErrorMessage } from "../Services/apiClient";
import { clearPendingInvite, readPendingInvite } from "../Services/authSession";
import { companyService } from "../Services/companyService";
import { invitationService } from "../Services/invitationService";
import type { DateRangeQuery } from "../types/common";
import type { InvitationInfo, InvitationInput, InvitationPublicInfo, InvitationStatus } from "../types/invitation";

/** Resultado do aceite: novo membro ou já era membro (409). */
export interface AcceptInviteOutcome {
  kind: "accepted" | "alreadyMember";
  /** Empresa selecionada como ativa (nula se não foi possível identificá-la no 409) */
  companyId: number | null;
  companyName: string | null;
}

export interface InvitationContextType {
  // Estado
  invitations: InvitationInfo[];
  loading: boolean;
  error: string | null;
  stale: boolean;
  fetchedAt: string | null;
  // Métodos
  load: (range: DateRangeQuery, status?: InvitationStatus | null) => Promise<void>;
  create: (data: InvitationInput) => Promise<InvitationInfo>;
  revoke: (invitationId: number) => Promise<void>;
  getPublic: (token: string) => Promise<InvitationPublicInfo>;
  /** Aceita, seleciona a empresa e limpa `pontua:pendingInvite` (research R-12) */
  accept: (token: string) => Promise<AcceptInviteOutcome>;
  clearError: () => void;
}

const InvitationContext = createContext<InvitationContextType | undefined>(undefined);

/** Convites da empresa ativa e aceite de convite (US4, skill `react-architecture`). */
export const InvitationProvider = ({ children }: { children: ReactNode }) => {
  const { activeCompany, selectCompany, refresh } = useCompany();
  const companyId = activeCompany?.companyId ?? null;
  const [invitations, setInvitations] = useState<InvitationInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [trackedCompany, setTrackedCompany] = useState<number | null>(companyId);
  const requestId = useRef(0);

  if (trackedCompany !== companyId) {
    setTrackedCompany(companyId);
    setInvitations([]);
    setError(null);
    setStale(false);
    setFetchedAt(null);
  }

  const handleError = useCallback((err: unknown): never => {
    setError(toErrorMessage(err));
    throw err;
  }, []);

  const load = useCallback(
    async (range: DateRangeQuery, status?: InvitationStatus | null): Promise<void> => {
      if (companyId === null) return;
      const ticket = ++requestId.current;
      try {
        setLoading(true);
        setError(null);
        const result = await invitationService.list(companyId, range, status);
        if (ticket !== requestId.current) return;
        setInvitations(result.data);
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

  const create = useCallback(
    async (data: InvitationInput): Promise<InvitationInfo> => {
      try {
        if (companyId === null) throw new Error(i18n.t("erros:semEmpresa"));
        setError(null);
        const created = await invitationService.create(companyId, data);
        setInvitations((prev) => [created, ...prev.filter((item) => item.invitationId !== created.invitationId)]);
        return created;
      } catch (err) {
        return handleError(err);
      }
    },
    [companyId, handleError],
  );

  const revoke = useCallback(
    async (invitationId: number): Promise<void> => {
      try {
        if (companyId === null) throw new Error(i18n.t("erros:semEmpresa"));
        setError(null);
        await invitationService.revoke(companyId, invitationId);
        setInvitations((prev) =>
          prev.map((item): InvitationInfo => (item.invitationId === invitationId ? { ...item, status: "revoked" } : item)),
        );
      } catch (err) {
        handleError(err);
      }
    },
    [companyId, handleError],
  );

  const getPublic = useCallback(async (token: string): Promise<InvitationPublicInfo> => {
    try {
      setError(null);
      return await invitationService.getPublic(token);
    } catch (err) {
      return handleError(err);
    }
  }, [handleError]);

  /** 409 (já membro): a API não devolve a empresa; ela é achada pelo nome público do convite. */
  const openExistingCompany = useCallback(
    async (token: string): Promise<AcceptInviteOutcome> => {
      let companyName: string | null = null;
      try {
        companyName = (await invitationService.getPublic(token)).companyName;
      } catch {
        companyName = null;
      }
      let targetId: number | null = null;
      try {
        const list = (await companyService.list()).data;
        const matches = companyName ? list.filter((item) => item.name === companyName) : [];
        targetId = matches.length === 1 && matches[0] ? matches[0].companyId : null;
      } catch {
        targetId = null;
      }
      try {
        if (targetId !== null) await selectCompany(targetId);
        else await refresh();
      } catch {
        // A empresa ativa continua a anterior; o aviso do 409 já orienta a pessoa
      }
      return { kind: "alreadyMember", companyId: targetId, companyName };
    },
    [selectCompany, refresh],
  );

  const accept = useCallback(
    async (token: string): Promise<AcceptInviteOutcome> => {
      try {
        setError(null);
        const summary = await invitationService.accept(token);
        try {
          await selectCompany(summary.companyId);
        } catch {
          // Aceite feito; a lista é recarregada na próxima tela
        }
        return { kind: "accepted", companyId: summary.companyId, companyName: summary.name };
      } catch (err) {
        if (isApiError(err) && err.status === 409) return openExistingCompany(token);
        return handleError(err);
      } finally {
        if (readPendingInvite() === token) clearPendingInvite();
      }
    },
    [selectCompany, openExistingCompany, handleError],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<InvitationContextType>(
    () => ({ invitations, loading, error, stale, fetchedAt, load, create, revoke, getPublic, accept, clearError }),
    [invitations, loading, error, stale, fetchedAt, load, create, revoke, getPublic, accept, clearError],
  );

  return <InvitationContext.Provider value={value}>{children}</InvitationContext.Provider>;
};

export default InvitationContext;
