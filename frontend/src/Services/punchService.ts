import type { DateRangeQuery } from "../types/common";
import type {
  DayRecord,
  ManualPunchInput,
  OfflinePunchItem,
  OfflineSyncResult,
  PunchInfo,
} from "../types/punch";
import { apiFetch, apiRequest } from "./apiClient";
import type { ApiResponse, QueryValue } from "./apiClient";

const companyPath = (companyId: number): string => `/api/companies/${companyId}`;

/** `DateRange` da API (`month` ou `start`/`end`). */
export const rangeQuery = (range: DateRangeQuery): Record<string, QueryValue> => ({
  month: range.month,
  start: range.start,
  end: range.end,
});

/** Marcações de ponto (API › Punches). */
class PunchService {
  /**
   * Marcação normal com o horário do servidor. `allowOffline`: a chamada é tentada mesmo com a
   * conectividade marcada offline — falha de rede/timeout vira marcação na fila (research R-06).
   */
  async punch(companyId: number): Promise<PunchInfo> {
    return apiFetch<PunchInfo>(`${companyPath(companyId)}/punches`, { method: "POST", allowOffline: true });
  }

  /** Envia um lote (1–50) de marcações feitas sem conexão; idempotente por `clientId`. */
  async syncOffline(companyId: number, items: OfflinePunchItem[]): Promise<OfflineSyncResult> {
    return apiFetch<OfflineSyncResult>(`${companyPath(companyId)}/punches/offline`, {
      method: "POST",
      body: { items },
      allowOffline: true,
    });
  }

  /** Histórico por dia do chamador (network-first: sem conexão devolve o último dado guardado). */
  async getMyDays(companyId: number, range: DateRangeQuery): Promise<ApiResponse<DayRecord[]>> {
    return apiRequest<DayRecord[]>(`${companyPath(companyId)}/punches/me`, {
      query: rangeQuery(range),
      cache: "network-first",
    });
  }

  /** Histórico por dia de um membro (responsável, gestor do cargo ou o próprio). */
  async getMemberDays(companyId: number, memberId: number, range: DateRangeQuery): Promise<ApiResponse<DayRecord[]>> {
    return apiRequest<DayRecord[]>(`${companyPath(companyId)}/members/${memberId}/punches`, {
      query: rangeQuery(range),
      cache: "network-first",
    });
  }

  /** Detalhe da marcação com o histórico de status. */
  async getPunch(companyId: number, punchId: number): Promise<PunchInfo> {
    return apiFetch<PunchInfo>(`${companyPath(companyId)}/punches/${punchId}`);
  }

  /** Marcação manual (inclusão ou correção), sempre pendente de aprovação. */
  async createManual(companyId: number, data: ManualPunchInput): Promise<PunchInfo> {
    return apiFetch<PunchInfo>(`${companyPath(companyId)}/punches/manual`, { method: "POST", body: data });
  }

  /** Cancela um pedido manual pendente do próprio autor. */
  async cancel(companyId: number, punchId: number): Promise<void> {
    await apiFetch<undefined>(`${companyPath(companyId)}/punches/${punchId}/cancel`, { method: "POST" });
  }
}

export const punchService = new PunchService();
export default PunchService;
