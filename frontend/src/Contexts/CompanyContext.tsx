import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import i18n from "../i18n";
import { useAuth } from "../hooks/useAuth";
import { isApiError, toErrorMessage } from "../Services/apiClient";
import { COMPANY_STORAGE_KEY, clearStoredCompany } from "../Services/authSession";
import { companyService } from "../Services/companyService";
import type {
  CompanyInfo,
  CompanyInput,
  CompanySummary,
  CompanyUpdateInput,
  StoredActiveCompany,
} from "../types/company";
import type { MemberInfo } from "../types/member";

export interface CompanyContextType {
  // Estado
  companies: CompanySummary[];
  /** Empresa ativa (nula sem empresa → `/bem-vindo`) */
  activeCompany: CompanyInfo | null;
  /** Linha da empresa ativa na lista (papel e cargo) */
  activeSummary: CompanySummary | null;
  /** Membro do usuário na empresa ativa (`members/me`) */
  me: MemberInfo | null;
  loading: boolean;
  error: string | null;
  /** A primeira carga para o usuário atual terminou (com sucesso ou erro) */
  initialized: boolean;
  /** Dados vindos do cache local por falta de conexão */
  stale: boolean;
  /** Quando os dados exibidos vieram do servidor (ISO) */
  fetchedAt: string | null;
  // Métodos
  selectCompany: (companyId: number) => Promise<void>;
  createCompany: (data: CompanyInput) => Promise<CompanyInfo>;
  updateCompany: (data: CompanyUpdateInput) => Promise<CompanyInfo>;
  /** Transfere a responsabilidade; não aplica o novo papel — chame `refresh()` depois de sair da tela */
  transferOwnership: (memberId: number) => Promise<CompanyInfo>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const readStoredCompany = (userId: number): number | null => {
  try {
    const raw = localStorage.getItem(COMPANY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.userId !== userId || typeof parsed.companyId !== "number") return null;
    return parsed.companyId;
  } catch {
    return null;
  }
};

const writeStoredCompany = (value: StoredActiveCompany): void => {
  try {
    localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Armazenamento negado: a escolha vale só nesta sessão
  }
};

const summaryFromInfo = (info: CompanyInfo, me: MemberInfo | null): CompanySummary => ({
  companyId: info.companyId,
  name: info.name,
  isOwner: info.myAccess.isOwner,
  isManager: info.myAccess.isManager,
  memberId: info.myAccess.memberId,
  positionName: me?.position?.name ?? null,
});

/**
 * Empresa ativa e papéis (research R-05): lista `GET /api/companies`, última empresa usada em
 * `pontua:company` (`{ userId, companyId }`) e `CompanyInfo` + `members/me` da ativa.
 */
export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.userId ?? null;
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [activeCompany, setActiveCompany] = useState<CompanyInfo | null>(null);
  const [me, setMe] = useState<MemberInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [stale, setStale] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  /** Descarta respostas de cargas anteriores (troca rápida de usuário/empresa). */
  const requestId = useRef(0);
  const userIdRef = useRef<number | null>(userId);
  userIdRef.current = userId;
  const companiesRef = useRef<CompanySummary[]>(companies);
  companiesRef.current = companies;

  const handleError = useCallback((err: unknown): never => {
    setError(toErrorMessage(err));
    throw err;
  }, []);

  /** Carrega dados e membro da empresa; 404 = o usuário saiu da empresa. */
  const loadActive = useCallback(
    async (companyId: number, list: CompanySummary[], ticket: number): Promise<void> => {
      const owner = userIdRef.current;
      if (owner === null) return;
      let targetId: number | undefined = companyId;
      let remaining = list;
      while (targetId !== undefined) {
        const currentId: number = targetId;
        try {
          const [info, member] = await Promise.all([
            companyService.get(currentId),
            companyService.getMe(currentId),
          ]);
          if (ticket !== requestId.current) return;
          setActiveCompany(info.data);
          setMe(member.data);
          setStale(info.stale || member.stale);
          setFetchedAt(info.stale ? info.fetchedAt : member.fetchedAt);
          writeStoredCompany({ userId: owner, companyId: currentId });
          return;
        } catch (err) {
          if (ticket !== requestId.current) return;
          if (!isApiError(err) || (err.status !== 404 && err.status !== 403)) throw err;
          // Desativado/removido da empresa enquanto usava o app: avisa e passa para a próxima
          const left = remaining.find((item) => item.companyId === currentId);
          toast.warning(i18n.t("comum:companyLeft", { name: left?.name ?? "" }));
          remaining = remaining.filter((item) => item.companyId !== currentId);
          setCompanies(remaining);
          clearStoredCompany();
          targetId = remaining[0]?.companyId;
        }
      }
      setActiveCompany(null);
      setMe(null);
    },
    [],
  );

  /** Carrega a lista e escolhe a empresa ativa (guardada, preferida ou a primeira). */
  const loadAll = useCallback(
    async (preferredId?: number): Promise<void> => {
      const owner = userIdRef.current;
      if (owner === null) return;
      const ticket = ++requestId.current;
      try {
        setLoading(true);
        setError(null);
        const result = await companyService.list();
        if (ticket !== requestId.current) return;
        const list = result.data;
        setCompanies(list);
        setStale(result.stale);
        setFetchedAt(result.fetchedAt);
        const stored = preferredId ?? readStoredCompany(owner);
        const target = list.find((item) => item.companyId === stored) ?? list[0];
        if (!target) {
          setActiveCompany(null);
          setMe(null);
          clearStoredCompany();
          return;
        }
        await loadActive(target.companyId, list, ticket);
      } catch (err) {
        if (ticket === requestId.current) setError(toErrorMessage(err));
      } finally {
        if (ticket === requestId.current) {
          setLoading(false);
          setInitialized(true);
        }
      }
    },
    [loadActive],
  );

  // Troca de usuário: zera e recarrega
  useEffect(() => {
    requestId.current += 1;
    setCompanies([]);
    setActiveCompany(null);
    setMe(null);
    setError(null);
    setStale(false);
    setFetchedAt(null);
    setInitialized(false);
    if (userId !== null) void loadAll();
  }, [userId, loadAll]);

  const selectCompany = useCallback(
    async (companyId: number): Promise<void> => {
      const owner = userIdRef.current;
      if (owner === null) return;
      // Empresa que ainda não está na lista (ex.: convite recém-aceito): recarrega a lista já
      // escolhendo a nova empresa como ativa
      if (!companiesRef.current.some((item) => item.companyId === companyId)) {
        writeStoredCompany({ userId: owner, companyId });
        await loadAll(companyId);
        return;
      }
      const ticket = ++requestId.current;
      try {
        setLoading(true);
        setError(null);
        writeStoredCompany({ userId: owner, companyId });
        await loadActive(companyId, companies, ticket);
      } catch (err) {
        if (ticket === requestId.current) handleError(err);
      } finally {
        if (ticket === requestId.current) setLoading(false);
      }
    },
    [companies, loadActive, loadAll, handleError],
  );

  const createCompany = useCallback(
    async (data: CompanyInput): Promise<CompanyInfo> => {
      try {
        setLoading(true);
        setError(null);
        const info = await companyService.create(data);
        const owner = userIdRef.current;
        if (owner !== null) writeStoredCompany({ userId: owner, companyId: info.companyId });
        await loadAll(info.companyId);
        return info;
      } catch (err) {
        return handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [loadAll, handleError],
  );

  const updateCompany = useCallback(
    async (data: CompanyUpdateInput): Promise<CompanyInfo> => {
      const current = activeCompany;
      if (!current) throw new Error(i18n.t("erros:semEmpresa"));
      try {
        setLoading(true);
        setError(null);
        const info = await companyService.update(current.companyId, data);
        setActiveCompany(info);
        setCompanies((prev) =>
          prev.map((item) => (item.companyId === info.companyId ? { ...item, name: info.name } : item)),
        );
        return info;
      } catch (err) {
        return handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [activeCompany, handleError],
  );

  const transferOwnership = useCallback(
    async (memberId: number): Promise<CompanyInfo> => {
      const current = activeCompany;
      if (!current) throw new Error(i18n.t("erros:semEmpresa"));
      try {
        setLoading(true);
        setError(null);
        // Os papéis mudam: quem chama sai da tela do responsável e depois chama `refresh()`
        // (aplicar o novo papel antes de sair faria o guard da rota avisar "sem acesso")
        return await companyService.transferOwnership(current.companyId, { memberId });
      } catch (err) {
        return handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [activeCompany, handleError],
  );

  const refresh = useCallback(() => loadAll(activeCompany?.companyId), [loadAll, activeCompany]);

  const clearError = useCallback(() => setError(null), []);

  const activeSummary = useMemo<CompanySummary | null>(() => {
    if (!activeCompany) return null;
    return (
      companies.find((item) => item.companyId === activeCompany.companyId) ?? summaryFromInfo(activeCompany, me)
    );
  }, [companies, activeCompany, me]);

  const value = useMemo<CompanyContextType>(
    () => ({
      companies,
      activeCompany,
      activeSummary,
      me,
      loading,
      error,
      initialized,
      stale,
      fetchedAt,
      selectCompany,
      createCompany,
      updateCompany,
      transferOwnership,
      refresh,
      clearError,
    }),
    [
      companies,
      activeCompany,
      activeSummary,
      me,
      loading,
      error,
      initialized,
      stale,
      fetchedAt,
      selectCompany,
      createCompany,
      updateCompany,
      transferOwnership,
      refresh,
      clearError,
    ],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
};

export default CompanyContext;
