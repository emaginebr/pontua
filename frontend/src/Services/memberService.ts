import type { ManagerInput, MemberInfo, MemberPositionInput, MemberStatusFilter } from "../types/member";
import type { ScheduleInfo, ScheduleInput } from "../types/schedule";
import { apiFetch, apiRequest } from "./apiClient";
import type { ApiResponse } from "./apiClient";

const membersPath = (companyId: number): string => `/api/companies/${companyId}/members`;

/** Membros da empresa (API › Members, FR-020). */
class MemberService {
  /** Lista (gestor vê só os membros dos seus cargos), network-first. */
  async list(
    companyId: number,
    status: MemberStatusFilter = "active",
    positionId?: number | null,
  ): Promise<ApiResponse<MemberInfo[]>> {
    return apiRequest<MemberInfo[]>(membersPath(companyId), {
      query: { status, positionId: positionId ?? undefined },
      cache: "network-first",
    });
  }

  /** Detalhe com `positionHistory` e `scheduleHistory`, network-first. */
  async get(companyId: number, memberId: number): Promise<ApiResponse<MemberInfo>> {
    return apiRequest<MemberInfo>(`${membersPath(companyId)}/${memberId}`, { cache: "network-first" });
  }

  /** Troca o cargo a partir de uma data (só o responsável). */
  async changePosition(companyId: number, memberId: number, data: MemberPositionInput): Promise<MemberInfo> {
    return apiFetch<MemberInfo>(`${membersPath(companyId)}/${memberId}/position`, { method: "PUT", body: data });
  }

  /** Grava uma jornada própria do membro (nova versão). */
  async setSchedule(companyId: number, memberId: number, data: ScheduleInput): Promise<ScheduleInfo> {
    return apiFetch<ScheduleInfo>(`${membersPath(companyId)}/${memberId}/schedule`, { method: "PUT", body: data });
  }

  /** Volta à jornada do cargo a partir de `effectiveFrom` (padrão hoje no servidor). */
  async clearSchedule(companyId: number, memberId: number, effectiveFrom?: string | null): Promise<void> {
    await apiFetch<undefined>(`${membersPath(companyId)}/${memberId}/schedule`, {
      method: "DELETE",
      query: { effectiveFrom: effectiveFrom ?? undefined },
    });
  }

  /** Desativa (422 se for o responsável). */
  async deactivate(companyId: number, memberId: number): Promise<void> {
    await apiFetch<undefined>(`${membersPath(companyId)}/${memberId}/deactivate`, { method: "POST" });
  }

  /** Reativa um membro inativo. */
  async reactivate(companyId: number, memberId: number): Promise<void> {
    await apiFetch<undefined>(`${membersPath(companyId)}/${memberId}/reactivate`, { method: "POST" });
  }

  /** Designa (com ≥ 1 cargo) ou remove o gestor; 422 para o responsável ou inativo. */
  async setManager(companyId: number, memberId: number, data: ManagerInput): Promise<MemberInfo> {
    return apiFetch<MemberInfo>(`${membersPath(companyId)}/${memberId}/manager`, { method: "PUT", body: data });
  }
}

export const memberService = new MemberService();
export default MemberService;
