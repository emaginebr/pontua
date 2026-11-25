import type { PositionInfo, PositionInput, PositionRenameInput } from "../types/position";
import type { ScheduleInfo, ScheduleInput } from "../types/schedule";
import { apiFetch, apiRequest } from "./apiClient";
import type { ApiResponse } from "./apiClient";

const positionsPath = (companyId: number): string => `/api/companies/${companyId}/positions`;

/** Cargos e jornadas (API › Positions). */
class PositionService {
  /** Cargos da empresa com a jornada vigente hoje e o nº de membros ativos (network-first). */
  async list(companyId: number): Promise<ApiResponse<PositionInfo[]>> {
    return apiRequest<PositionInfo[]>(positionsPath(companyId), { cache: "network-first" });
  }

  /** Cargo com o histórico de versões da jornada (network-first). */
  async get(companyId: number, positionId: number): Promise<ApiResponse<PositionInfo>> {
    return apiRequest<PositionInfo>(`${positionsPath(companyId)}/${positionId}`, { cache: "network-first" });
  }

  /** Cria o cargo com a jornada inicial (vigente a partir de hoje). */
  async create(companyId: number, data: PositionInput): Promise<PositionInfo> {
    return apiFetch<PositionInfo>(positionsPath(companyId), { method: "POST", body: data });
  }

  /** Renomeia o cargo. */
  async rename(companyId: number, positionId: number, data: PositionRenameInput): Promise<PositionInfo> {
    return apiFetch<PositionInfo>(`${positionsPath(companyId)}/${positionId}`, { method: "PUT", body: data });
  }

  /** Grava uma nova versão da jornada (a partir de `effectiveFrom`). */
  async saveSchedule(companyId: number, positionId: number, data: ScheduleInput): Promise<ScheduleInfo> {
    return apiFetch<ScheduleInfo>(`${positionsPath(companyId)}/${positionId}/schedule`, { method: "PUT", body: data });
  }

  /** Exclui o cargo (422 com membros ativos; 409 com histórico). */
  async remove(companyId: number, positionId: number): Promise<void> {
    await apiFetch<undefined>(`${positionsPath(companyId)}/${positionId}`, { method: "DELETE" });
  }
}

export const positionService = new PositionService();
export default PositionService;
