/** Tipos de membro (API › Members). */
import type { PositionRef } from "./position";
import type { ScheduleInfo } from "./schedule";

export type MemberStatus = "active" | "inactive";

/** Filtro de situação na lista de membros. */
export type MemberStatusFilter = MemberStatus | "all";

/** Vigência de cargo do membro. */
export interface MemberPositionInfo {
  positionId: number;
  name: string;
  /** `yyyy-MM-dd` */
  effectiveFrom: string;
}

/** Membro com cargo e jornada vigentes hoje. */
export interface MemberInfo {
  memberId: number;
  userId: number;
  name: string;
  email: string;
  status: MemberStatus;
  isOwner: boolean;
  isManager: boolean;
  managedPositionIds: number[];
  /** Cargo vigente hoje (nulo se não houver) */
  position: PositionRef | null;
  /** A jornada vigente é a própria do membro */
  hasOwnSchedule: boolean;
  /** Entrada na empresa (ISO UTC) */
  joinedAt: string;
  /** Jornada vigente hoje; nula se não houver */
  currentSchedule: ScheduleInfo | null;
  /** Só no detalhe */
  positionHistory?: MemberPositionInfo[];
  /** Só no detalhe */
  scheduleHistory?: ScheduleInfo[];
}

/** `PUT .../members/{id}/position` */
export interface MemberPositionInput {
  positionId: number;
  /** `yyyy-MM-dd` */
  effectiveFrom?: string | null;
}

/** `PUT .../members/{id}/manager` */
export interface ManagerInput {
  isManager: boolean;
  positionIds: number[];
}
