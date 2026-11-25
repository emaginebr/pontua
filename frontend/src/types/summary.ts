/** Tipos do resumo de horas (API › Summary). */

/** Totais do período. */
export interface SummaryTotals {
  workedMinutes: number;
  /** Soma do previsto das semanas do período */
  expectedMinutes: number;
  balanceMinutes: number;
  /** Marcações pendentes no período (não entram no total) */
  pendingPunches: number;
}

/** Semana (segunda a domingo) que cruza o período. */
export interface WeekSummary {
  /** Segunda-feira da semana */
  weekStart: string;
  from: string;
  to: string;
  /** Semana cortada pelo filtro */
  partial: boolean;
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
}

/** Resumo de um dia. */
export interface DaySummary {
  date: string;
  isWorkDay: boolean;
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  incomplete: boolean;
}

/** Resumo de horas do membro no período. */
export interface HoursSummary {
  start: string;
  end: string;
  totals: SummaryTotals;
  weeks: WeekSummary[];
  days: DaySummary[];
}
