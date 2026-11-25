import { createContext, useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import i18n from "../i18n";
import { useCompany } from "../hooks/useCompany";
import { toErrorMessage } from "../Services/apiClient";
import { positionService } from "../Services/positionService";
import type { PositionInfo, PositionInput } from "../types/position";
import type { ScheduleInfo, ScheduleInput } from "../types/schedule";

export interface PositionContextType {
  // Estado
  positions: PositionInfo[];
  /** Cargo aberto no editor (com histórico de versões) */
  selected: PositionInfo | null;
  loading: boolean;
  error: string | null;
  stale: boolean;
  fetchedAt: string | null;
  // Métodos
  load: () => Promise<void>;
  get: (positionId: number) => Promise<PositionInfo>;
  create: (data: PositionInput) => Promise<PositionInfo>;
  rename: (positionId: number, name: string) => Promise<PositionInfo>;
  saveSchedule: (positionId: number, schedule: ScheduleInput) => Promise<ScheduleInfo>;
  remove: (positionId: number) => Promise<void>;
  clearError: () => void;
}

const PositionContext = createContext<PositionContextType | undefined>(undefined);

/** Cargos e jornadas da empresa ativa (US3, skill `react-architecture`). */
export const PositionProvider = ({ children }: { children: ReactNode }) => {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.companyId ?? null;
  const [positions, setPositions] = useState<PositionInfo[]>([]);
  const [selected, setSelected] = useState<PositionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [trackedCompany, setTrackedCompany] = useState<number | null>(companyId);
  const companyIdRef = useRef(companyId);
  companyIdRef.current = companyId;

  // Troca de empresa: descarta os cargos da anterior
  if (trackedCompany !== companyId) {
    setTrackedCompany(companyId);
    setPositions([]);
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

  const load = useCallback(async (): Promise<void> => {
    if (companyId === null) return;
    try {
      setLoading(true);
      setError(null);
      const result = await positionService.list(companyId);
      if (companyIdRef.current !== companyId) return;
      setPositions(result.data);
      setStale(result.stale);
      setFetchedAt(result.fetchedAt);
    } catch (err) {
      if (companyIdRef.current === companyId) setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const get = useCallback(
    async (positionId: number): Promise<PositionInfo> => {
      try {
        const id = requireCompany();
        setLoading(true);
        setError(null);
        const result = await positionService.get(id, positionId);
        setSelected(result.data);
        setStale(result.stale);
        setFetchedAt(result.fetchedAt);
        return result.data;
      } catch (err) {
        return handleError(err);
      } finally {
        setLoading(false);
      }
    },
    [requireCompany, handleError],
  );

  const create = useCallback(
    async (data: PositionInput): Promise<PositionInfo> => {
      try {
        const id = requireCompany();
        setError(null);
        const created = await positionService.create(id, data);
        setPositions((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
        return created;
      } catch (err) {
        return handleError(err);
      }
    },
    [requireCompany, handleError],
  );

  const rename = useCallback(
    async (positionId: number, name: string): Promise<PositionInfo> => {
      try {
        const id = requireCompany();
        setError(null);
        const updated = await positionService.rename(id, positionId, { name });
        setPositions((prev) => prev.map((item) => (item.positionId === positionId ? { ...item, ...updated } : item)));
        setSelected((prev) => (prev?.positionId === positionId ? { ...prev, name: updated.name } : prev));
        return updated;
      } catch (err) {
        return handleError(err);
      }
    },
    [requireCompany, handleError],
  );

  const saveSchedule = useCallback(
    async (positionId: number, schedule: ScheduleInput): Promise<ScheduleInfo> => {
      try {
        const id = requireCompany();
        setError(null);
        return await positionService.saveSchedule(id, positionId, schedule);
      } catch (err) {
        return handleError(err);
      }
    },
    [requireCompany, handleError],
  );

  const remove = useCallback(
    async (positionId: number): Promise<void> => {
      try {
        const id = requireCompany();
        setError(null);
        await positionService.remove(id, positionId);
        setPositions((prev) => prev.filter((item) => item.positionId !== positionId));
        setSelected((prev) => (prev?.positionId === positionId ? null : prev));
      } catch (err) {
        handleError(err);
      }
    },
    [requireCompany, handleError],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<PositionContextType>(
    () => ({
      positions,
      selected,
      loading,
      error,
      stale,
      fetchedAt,
      load,
      get,
      create,
      rename,
      saveSchedule,
      remove,
      clearError,
    }),
    [positions, selected, loading, error, stale, fetchedAt, load, get, create, rename, saveSchedule, remove, clearError],
  );

  return <PositionContext.Provider value={value}>{children}</PositionContext.Provider>;
};

export default PositionContext;
