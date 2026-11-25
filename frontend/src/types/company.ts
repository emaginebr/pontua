/** Tipos de empresa (API › Companies). */

/** Empresa na lista do usuário e resultado do aceite de convite. */
export interface CompanySummary {
  companyId: number;
  name: string;
  isOwner: boolean;
  isManager: boolean;
  memberId: number;
  /** Cargo vigente hoje (nulo se não houver) */
  positionName: string | null;
}

/** Responsável pela empresa. */
export interface CompanyOwnerInfo {
  memberId: number;
  userId: number;
  name: string;
}

/** Acesso do usuário chamador na empresa. */
export interface MyAccessInfo {
  memberId: number;
  isOwner: boolean;
  isManager: boolean;
  managedPositionIds: number[];
}

/** Dados da empresa com o responsável e o acesso do chamador. */
export interface CompanyInfo {
  companyId: number;
  name: string;
  /** CNPJ/CPF só dígitos */
  document: string | null;
  /** ID IANA do fuso (ex.: `America/Sao_Paulo`) */
  timeZone: string;
  /** Limite retroativo das marcações manuais, em dias */
  manualRetroDays: number;
  owner: CompanyOwnerInfo;
  myAccess: MyAccessInfo;
  createdAt: string;
}

/** `POST /api/companies` */
export interface CompanyInput {
  name: string;
  document?: string | null;
  timeZone?: string | null;
}

/** `PUT /api/companies/{id}` (só o responsável) */
export interface CompanyUpdateInput {
  name: string;
  document?: string | null;
  timeZone: string;
  /** 1–365 */
  manualRetroDays: number;
}

/** `POST /api/companies/{id}/transfer-ownership` */
export interface TransferOwnershipInput {
  memberId: number;
}

/** Empresa ativa guardada em `localStorage` (`pontua:company`, research R-05). */
export interface StoredActiveCompany {
  userId: number;
  companyId: number;
}
