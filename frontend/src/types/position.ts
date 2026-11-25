/** Tipos de cargo (API › Positions). */
import type { ScheduleInfo, ScheduleInput } from "./schedule";

/** Referência curta a um cargo. */
export interface PositionRef {
  positionId: number;
  name: string;
}

/** Cargo com a jornada vigente hoje e o número de membros ativos. */
export interface PositionInfo {
  positionId: number;
  name: string;
  activeMembers: number;
  /** Versão vigente hoje (nula só se todas começarem no futuro) */
  currentSchedule: ScheduleInfo | null;
  /** Todas as versões, mais recente primeiro — só no detalhe */
  scheduleHistory?: ScheduleInfo[];
}

/** `POST .../positions` */
export interface PositionInput {
  name: string;
  schedule: ScheduleInput;
}

/** `PUT .../positions/{id}` */
export interface PositionRenameInput {
  name: string;
}
