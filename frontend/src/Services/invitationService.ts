import type { DateRangeQuery } from "../types/common";
import type { CompanySummary } from "../types/company";
import type { InvitationInfo, InvitationInput, InvitationPublicInfo, InvitationStatus } from "../types/invitation";
import { apiFetch, apiRequest } from "./apiClient";
import type { ApiResponse } from "./apiClient";
import { rangeQuery } from "./punchService";

const invitationsPath = (companyId: number): string => `/api/companies/${companyId}/invitations`;

/** Convites (API › Invitations). */
class InvitationService {
  /** Convites do período, opcionalmente filtrados por situação (só o responsável). */
  async list(
    companyId: number,
    range: DateRangeQuery,
    status?: InvitationStatus | null,
  ): Promise<ApiResponse<InvitationInfo[]>> {
    return apiRequest<InvitationInfo[]>(invitationsPath(companyId), {
      query: { ...rangeQuery(range), status: status ?? undefined },
      cache: "network-first",
    });
  }

  /** Gera um convite para um cargo (validade 1–30 dias, padrão 7). */
  async create(companyId: number, data: InvitationInput): Promise<InvitationInfo> {
    return apiFetch<InvitationInfo>(invitationsPath(companyId), { method: "POST", body: data });
  }

  /** Revoga o convite. */
  async revoke(companyId: number, invitationId: number): Promise<void> {
    await apiFetch<undefined>(`${invitationsPath(companyId)}/${invitationId}/revoke`, { method: "POST" });
  }

  /** Dados públicos do convite (sem sessão). */
  async getPublic(token: string): Promise<InvitationPublicInfo> {
    return apiFetch<InvitationPublicInfo>(`/api/invitations/${encodeURIComponent(token)}`, { authenticated: false });
  }

  /** Aceita o convite com a sessão atual (409 = já é membro ativo; 422 = expirado/revogado). */
  async accept(token: string): Promise<CompanySummary> {
    return apiFetch<CompanySummary>(`/api/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" });
  }
}

export const invitationService = new InvitationService();
export default InvitationService;
