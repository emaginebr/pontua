import type { PanelType, PendingPanelDay, ReviewInput } from "../types/approval";
import type { DateRangeQuery } from "../types/common";
import type { PunchInfo } from "../types/punch";
import { apiFetch, apiRequest } from "./apiClient";
import type { ApiResponse } from "./apiClient";
import { rangeQuery } from "./punchService";

const companyPath = (companyId: number): string => `/api/companies/${companyId}`;

/** Filtros do painel de aprovações (`PanelQuery` da API). */
export interface ApprovalFilter {
  range: DateRangeQuery;
  /** `all` (padrão), `missing` ou `pending` */
  type?: PanelType | null;
  /** Cargo vigente do membro no dia */
  positionId?: number | null;
}

/** Painel de aprovações (API › Approvals, FR-022/FR-024). */
class ApprovalService {
  /** Dias (decrescentes) com membros sem marcação ou com pendências (network-first). */
  async list(companyId: number, filter: ApprovalFilter): Promise<ApiResponse<PendingPanelDay[]>> {
    return apiRequest<PendingPanelDay[]>(`${companyPath(companyId)}/approvals`, {
      query: {
        ...rangeQuery(filter.range),
        type: filter.type && filter.type !== "all" ? filter.type : undefined,
        positionId: filter.positionId ?? undefined,
      },
      cache: "network-first",
    });
  }

  /** Só as pendências do intervalo, sem cache (contador da navegação — research R-11). */
  async listPending(companyId: number, range: DateRangeQuery): Promise<PendingPanelDay[]> {
    return apiFetch<PendingPanelDay[]>(`${companyPath(companyId)}/approvals`, {
      query: { ...rangeQuery(range), type: "pending" },
    });
  }

  /** Aprova uma marcação pendente (409 se já analisada; 403 se for a própria de um gestor). */
  async approve(companyId: number, punchId: number, data: ReviewInput = {}): Promise<PunchInfo> {
    return apiFetch<PunchInfo>(`${companyPath(companyId)}/punches/${punchId}/approve`, { method: "POST", body: data });
  }

  /** Rejeita uma marcação pendente com motivo opcional (≤ 500). */
  async reject(companyId: number, punchId: number, data: ReviewInput = {}): Promise<PunchInfo> {
    return apiFetch<PunchInfo>(`${companyPath(companyId)}/punches/${punchId}/reject`, { method: "POST", body: data });
  }
}

export const approvalService = new ApprovalService();
export default ApprovalService;
