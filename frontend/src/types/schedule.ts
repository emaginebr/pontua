/** Tipos de jornada (API › Positions e jornadas). */

/** `weekly` = igual todos os dias úteis; `daily` = configurada por dia da semana. */
export type ScheduleMode = "weekly" | "daily";

/** Período previsto a gravar. */
export interface SchedulePeriodInput {
  name: string;
  /** `HH:mm` ou `null` (sem horário previsto) */
  expectedTime: string | null;
}

/** Dia útil no modo diário. */
export interface ScheduleDayInput {
  /** 0 = domingo … 6 = sábado */
  dayOfWeek: number;
  dailyMinutes: number;
  periods: SchedulePeriodInput[];
}

/** Jornada a gravar como nova versão. */
export interface ScheduleInput {
  mode: ScheduleMode;
  /** `yyyy-MM-dd`; padrão hoje; não pode ser passado */
  effectiveFrom?: string | null;
  /** Carga semanal em minutos (1–10080) */
  weeklyMinutes: number;
  /** Só semanal: dias úteis (0 = domingo) */
  workDays?: number[] | null;
  /** Só semanal: carga diária em minutos (1–1440) */
  dailyMinutes?: number | null;
  /** Só semanal: períodos comuns a todos os dias úteis */
  periods?: SchedulePeriodInput[] | null;
  /** Só diário: um item por dia útil */
  days?: ScheduleDayInput[] | null;
}

/** Período previsto gravado. */
export interface SchedulePeriodInfo {
  /** Ordem 1..n dentro do dia */
  sequence: number;
  name: string;
  /** `HH:mm` ou `null` */
  expectedTime: string | null;
}

/** Dia útil de uma versão de jornada. */
export interface ScheduleDayInfo {
  /** 0 = domingo … 6 = sábado */
  dayOfWeek: number;
  dailyMinutes: number;
  periods: SchedulePeriodInfo[];
}

/** Versão de jornada; `days` vem sempre expandido por dia útil, nos dois modos. */
export interface ScheduleInfo {
  scheduleId: number;
  mode: ScheduleMode;
  /** `yyyy-MM-dd` */
  effectiveFrom: string;
  weeklyMinutes: number;
  days: ScheduleDayInfo[];
  /** Só em versões de membro que voltam à jornada do cargo */
  inheritsPosition?: boolean;
}
