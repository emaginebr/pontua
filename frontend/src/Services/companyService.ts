import type {
  CompanyInfo,
  CompanyInput,
  CompanySummary,
  CompanyUpdateInput,
  TransferOwnershipInput,
} from "../types/company";
import type { FreshnessInfo } from "../types/common";
import type { MemberInfo } from "../types/member";
import { apiFetch, apiRequest } from "./apiClient";

const API_BASE = "/api/companies";

/** Resultado de leitura com a procedência do dado (cache network-first). */
export interface CachedRead<T> extends FreshnessInfo {
  data: T;
}

/** Empresas do usuário e dados da empresa ativa (API › Companies, Members/me). */
class CompanyService {
  /** Empresas em que o usuário é membro ativo. */
  async list(): Promise<CachedRead<CompanySummary[]>> {
    return apiRequest<CompanySummary[]>(API_BASE, { cache: "network-first" });
  }

  /** Dados da empresa com o acesso do chamador. */
  async get(companyId: number): Promise<CachedRead<CompanyInfo>> {
    return apiRequest<CompanyInfo>(`${API_BASE}/${companyId}`, { cache: "network-first" });
  }

  /** Membro do chamador na empresa, com jornada vigente. */
  async getMe(companyId: number): Promise<CachedRead<MemberInfo>> {
    return apiRequest<MemberInfo>(`${API_BASE}/${companyId}/members/me`, { cache: "network-first" });
  }

  /** Cria a empresa; o criador vira responsável com o cargo "Responsável". */
  async create(data: CompanyInput): Promise<CompanyInfo> {
    return apiFetch<CompanyInfo>(API_BASE, { method: "POST", body: data });
  }

  /** Atualiza os dados (só o responsável). */
  async update(companyId: number, data: CompanyUpdateInput): Promise<CompanyInfo> {
    return apiFetch<CompanyInfo>(`${API_BASE}/${companyId}`, { method: "PUT", body: data });
  }

  /** Transfere a responsabilidade para outro membro ativo. */
  async transferOwnership(companyId: number, data: TransferOwnershipInput): Promise<CompanyInfo> {
    return apiFetch<CompanyInfo>(`${API_BASE}/${companyId}/transfer-ownership`, { method: "POST", body: data });
  }
}

export const companyService = new CompanyService();
export default CompanyService;
