import { useMemo } from "react";
import { useCompany } from "./useCompany";

export type RoleKey = "owner" | "manager" | "member";

/** Papel do usuário na empresa ativa (FR-011). */
export interface RoleInfo {
  /** Responsável pela empresa */
  isOwner: boolean;
  /** Gestor de algum cargo */
  isManager: boolean;
  /** Pode ver o painel de aprovações e membros (responsável ou gestor) */
  canSupervise: boolean;
  /** Papel principal para rótulos */
  role: RoleKey;
  /** Cargos supervisionados pelo gestor */
  managedPositionIds: number[];
}

/** Papel do usuário na empresa ativa: `myAccess` da empresa, com a linha da lista como reserva. */
export const useRole = (): RoleInfo => {
  const { activeCompany, activeSummary } = useCompany();
  return useMemo(() => {
    const isOwner = activeCompany?.myAccess.isOwner ?? activeSummary?.isOwner ?? false;
    const isManager = activeCompany?.myAccess.isManager ?? activeSummary?.isManager ?? false;
    const role: RoleKey = isOwner ? "owner" : isManager ? "manager" : "member";
    return {
      isOwner,
      isManager,
      canSupervise: isOwner || isManager,
      role,
      managedPositionIds: activeCompany?.myAccess.managedPositionIds ?? [],
    };
  }, [activeCompany, activeSummary]);
};

export default useRole;
