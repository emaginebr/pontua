/**
 * Filtro de período (research R-09): mês (`?month=yyyy-MM`) ou intervalo
 * (`?start=yyyy-MM-dd&end=yyyy-MM-dd`), repassado como está à API (`DateRange`).
 */
import type { DateRangeQuery } from "../types/common";
import { addMonths, currentMonthInZone, diffDays, isValidYm, isValidYmd, monthBounds } from "./dateTime";

/** Maior intervalo aceito pela API (inclusivo). */
export const MAX_RANGE_DAYS = 366;

/** Período por mês. */
export interface MonthPeriod {
  kind: "month";
  /** `yyyy-MM` */
  month: string;
}

/** Período por intervalo de datas (inclusivo). */
export interface RangePeriod {
  kind: "range";
  start: string;
  end: string;
}

export type Period = MonthPeriod | RangePeriod;

/** Motivo de um intervalo inválido. */
export type RangeError = "invalidStart" | "invalidEnd" | "order" | "tooLong";

/** Valida um intervalo de datas; `null` quando é válido. */
export const validateRange = (start: string, end: string): RangeError | null => {
  if (!isValidYmd(start)) return "invalidStart";
  if (!isValidYmd(end)) return "invalidEnd";
  const days = diffDays(start, end);
  if (days < 0) return "order";
  if (days + 1 > MAX_RANGE_DAYS) return "tooLong";
  return null;
};

/** Parâmetros brutos da URL. */
export interface RawPeriodParams {
  month?: string | null;
  start?: string | null;
  end?: string | null;
}

/** Resultado da normalização: período válido e se a URL precisa ser corrigida. */
export interface NormalizedPeriod {
  period: Period;
  /** A URL tinha valor inválido/combinado e foi trocada pelo mês corrente */
  corrected: boolean;
}

/**
 * Normaliza os parâmetros da URL: mês válido → mês; intervalo válido → intervalo; nada → mês
 * corrente no fuso da empresa; qualquer valor inválido (ou mês + intervalo juntos) → mês corrente.
 */
export const normalizePeriod = (raw: RawPeriodParams, timeZone: string, now: Date = new Date()): NormalizedPeriod => {
  const current: MonthPeriod = { kind: "month", month: currentMonthInZone(timeZone, now) };
  const hasMonth = raw.month !== undefined && raw.month !== null;
  const hasRange =
    (raw.start !== undefined && raw.start !== null) || (raw.end !== undefined && raw.end !== null);

  if (!hasMonth && !hasRange) return { period: current, corrected: false };
  if (hasMonth && hasRange) return { period: current, corrected: true };

  if (hasMonth) {
    return isValidYm(raw.month) ? { period: { kind: "month", month: raw.month }, corrected: false } : { period: current, corrected: true };
  }

  const start = raw.start ?? "";
  const end = raw.end ?? "";
  return validateRange(start, end) === null
    ? { period: { kind: "range", start, end }, corrected: false }
    : { period: current, corrected: true };
};

/** Query da API para o período. */
export const periodToQuery = (period: Period): DateRangeQuery =>
  period.kind === "month" ? { month: period.month } : { start: period.start, end: period.end };

/** Primeiro e último dia do período. */
export const periodBounds = (period: Period): { start: string; end: string } =>
  period.kind === "month" ? monthBounds(period.month) : { start: period.start, end: period.end };

/** Mês vizinho (‹ ›). */
export const shiftMonth = (month: string, delta: number): string => addMonths(month, delta);

/** Serializa uma query de período (`month=…` ou `start=…&end=…`), sem `?`. */
export const toQueryString = (query: DateRangeQuery): string => {
  const params = new URLSearchParams();
  if (query.month) params.set("month", query.month);
  if (query.start) params.set("start", query.start);
  if (query.end) params.set("end", query.end);
  return params.toString();
};
