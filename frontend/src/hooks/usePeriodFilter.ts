import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useCompany } from "./useCompany";
import type { DateRangeQuery } from "../types/common";
import {
  DEFAULT_TIME_ZONE,
  currentMonthInZone,
  formatMonthLabel,
  formatYmdDayMonth,
  formatYmdNumeric,
  todayInZone,
} from "../utils/dateTime";
import { normalizePeriod, periodToQuery, shiftMonth } from "../utils/period";
import type { Period } from "../utils/period";

export interface UsePeriodFilterOptions {
  /** Permite avançar para meses futuros (padrão: não passa do mês corrente) */
  allowFuture?: boolean;
}

export interface PeriodFilterState {
  /** Período válido (mês ou intervalo) */
  period: Period;
  /** Query a repassar para a API */
  query: DateRangeQuery;
  /** "Novembro de 2026" ou "01/11 – 15/11/2026" */
  label: string;
  /** Hoje no fuso da empresa (`yyyy-MM-dd`) */
  today: string;
  /** Mês corrente no fuso da empresa (`yyyy-MM`) */
  currentMonth: string;
  /** Intervalo personalizado ativo */
  isRange: boolean;
  /** "Próximo mês" disponível */
  canGoNext: boolean;
  previousMonth: () => void;
  nextMonth: () => void;
  setMonth: (month: string) => void;
  setRange: (start: string, end: string) => void;
  /** Volta ao mês corrente */
  clearRange: () => void;
}

const PERIOD_KEYS = ["month", "start", "end"] as const;

/**
 * Filtro de datas sincronizado com a URL (research R-09): `?month=yyyy-MM` ou
 * `?start=…&end=…`; padrão mês corrente no fuso da empresa; valor inválido → mês corrente
 * (a URL é corrigida com `replace`). Outros parâmetros da URL são preservados.
 */
export const usePeriodFilter = ({ allowFuture = false }: UsePeriodFilterOptions = {}): PeriodFilterState => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeCompany } = useCompany();
  const timeZone = activeCompany?.timeZone ?? DEFAULT_TIME_ZONE;
  const rawMonth = searchParams.get("month");
  const rawStart = searchParams.get("start");
  const rawEnd = searchParams.get("end");

  const { period, corrected } = useMemo(
    () => normalizePeriod({ month: rawMonth, start: rawStart, end: rawEnd }, timeZone),
    [rawMonth, rawStart, rawEnd, timeZone],
  );

  const today = todayInZone(timeZone);
  const currentMonth = currentMonthInZone(timeZone);

  /** Troca só os parâmetros do período, preservando os demais. */
  const writePeriod = useCallback(
    (next: Partial<Record<(typeof PERIOD_KEYS)[number], string>>, replace = false) => {
      setSearchParams(
        (previous) => {
          const params = new URLSearchParams(previous);
          PERIOD_KEYS.forEach((key) => params.delete(key));
          PERIOD_KEYS.forEach((key) => {
            const value = next[key];
            if (value) params.set(key, value);
          });
          return params;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  // URL inválida → mês corrente (sem criar entrada nova no histórico)
  useEffect(() => {
    if (corrected) writePeriod({}, true);
  }, [corrected, writePeriod]);

  const anchorMonth = period.kind === "month" ? period.month : period.start.slice(0, 7);
  const canGoNext = allowFuture || anchorMonth < currentMonth;

  const setMonth = useCallback(
    (month: string) => writePeriod(month === currentMonth ? {} : { month }),
    [writePeriod, currentMonth],
  );

  const previousMonth = useCallback(() => setMonth(shiftMonth(anchorMonth, -1)), [setMonth, anchorMonth]);

  const nextMonth = useCallback(() => {
    if (!canGoNext) return;
    setMonth(shiftMonth(anchorMonth, 1));
  }, [setMonth, anchorMonth, canGoNext]);

  const setRange = useCallback((start: string, end: string) => writePeriod({ start, end }), [writePeriod]);

  const clearRange = useCallback(() => writePeriod({}), [writePeriod]);

  const label =
    period.kind === "month"
      ? formatMonthLabel(period.month)
      : `${formatYmdDayMonth(period.start)} – ${formatYmdNumeric(period.end)}`;

  return {
    period,
    query: periodToQuery(period),
    label,
    today,
    currentMonth,
    isRange: period.kind === "range",
    canGoNext,
    previousMonth,
    nextMonth,
    setMonth,
    setRange,
    clearRange,
  };
};

export default usePeriodFilter;
