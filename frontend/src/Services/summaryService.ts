import type { DateRangeQuery } from "../types/common";
import type { HoursSummary } from "../types/summary";
import { apiRequest } from "./apiClient";
import type { ApiResponse } from "./apiClient";
import { rangeQuery } from "./punchService";

const companyPath = (companyId: number): string => `/api/companies/${companyId}`;

/** Resumo de horas (API › Summary, FR-027). Leituras network-first (aviso "dados de …" offline). */
class SummaryService {
  /** Totais, semanas e dias do chamador no período. */
  async getMine(companyId: number, range: DateRangeQuery): Promise<ApiResponse<HoursSummary>> {
    return apiRequest<HoursSummary>(`${companyPath(companyId)}/summary/me`, {
      query: rangeQuery(range),
      cache: "network-first",
    });
  }

  /** Totais, semanas e dias de um membro (responsável, gestor do cargo ou o próprio). */
  async getMember(companyId: number, memberId: number, range: DateRangeQuery): Promise<ApiResponse<HoursSummary>> {
    return apiRequest<HoursSummary>(`${companyPath(companyId)}/members/${memberId}/summary`, {
      query: rangeQuery(range),
      cache: "network-first",
    });
  }
}

export const summaryService = new SummaryService();
export default SummaryService;
