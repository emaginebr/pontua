import { useEffect } from "react";
import { useApprovals } from "./useApprovals";
import { useCompany } from "./useCompany";
import { useRole } from "./useRole";

/** Atualização periódica do contador com a aba visível (research R-11). */
export const PENDING_COUNT_INTERVAL_MS = 2 * 60_000;

/**
 * Contador de pendências da navegação (FR-023): busca ao entrar, ao trocar de empresa e a cada
 * 2 min enquanto a aba está visível (e logo que ela volta a ficar visível). As análises do painel
 * atualizam o contador pelo próprio `ApprovalContext`. Quem não aprova recebe 0 e nada é buscado.
 */
export const usePendingCount = (): number => {
  const { pendingCount, refreshCount } = useApprovals();
  const { activeCompany } = useCompany();
  const { canSupervise } = useRole();
  const companyId = activeCompany?.companyId ?? null;

  useEffect(() => {
    if (companyId === null || !canSupervise) return undefined;
    void refreshCount();
    const visible = () => typeof document === "undefined" || document.visibilityState === "visible";
    const interval = setInterval(() => {
      if (visible()) void refreshCount();
    }, PENDING_COUNT_INTERVAL_MS);
    const onVisibility = () => {
      if (visible()) void refreshCount();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [companyId, canSupervise, refreshCount]);

  return canSupervise ? pendingCount : 0;
};

export default usePendingCount;
