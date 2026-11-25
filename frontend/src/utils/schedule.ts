/**
 * Jornada no editor (US3, FR-018): rascunho editável, validação no próprio campo, conversão
 * para `ScheduleInput`, mapeamento de `erros[]` da API e resumo ("Seg–Sex · 4 marcações ·
 * 44 h/semana"). Regras espelham `ScheduleInputValidator` do backend (só para orientar; a API
 * continua sendo a validação final).
 */
import i18n from "../i18n";
import type { ApiFieldError } from "../types/common";
import type { ScheduleInfo, ScheduleInput, ScheduleMode } from "../types/schedule";
import { isValidYmd } from "./dateTime";
import { hhmmToMinutes, minutesToHhmm } from "./duration";

export const MIN_PERIODS = 1;
export const MAX_PERIODS = 12;
export const PERIOD_NAME_MAX_LENGTH = 40;
export const POSITION_NAME_MAX_LENGTH = 80;
export const MIN_DAILY_MINUTES = 1;
export const MAX_DAILY_MINUTES = 24 * 60;
export const MIN_WEEKLY_MINUTES = 1;
export const MAX_WEEKLY_MINUTES = 7 * 24 * 60;

/** Ordem de exibição dos dias: segunda → domingo (0 = domingo na API). */
export const WEEK_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

/** Período no rascunho (`expectedTime` vazio = sem horário previsto). */
export interface PeriodDraft {
  /** Chave local estável (reordenar mantém foco e estado) */
  id: string;
  name: string;
  expectedTime: string;
}

/** Dia no modo diário. */
export interface DayDraft {
  dayOfWeek: number;
  workDay: boolean;
  /** Carga do dia `hh:mm` */
  dailyLoad: string;
  periods: PeriodDraft[];
}

/** Rascunho da jornada. */
export interface ScheduleDraft {
  mode: ScheduleMode;
  /** Semanal: dias úteis */
  workDays: number[];
  /** Semanal: períodos comuns */
  periods: PeriodDraft[];
  /** Semanal: carga diária `hh:mm` */
  dailyLoad: string;
  /** Carga semanal `hh:mm` */
  weeklyLoad: string;
  /** Diário: os 7 dias, índice = dia da semana */
  days: DayDraft[];
  /** Início da vigência `yyyy-MM-dd` */
  effectiveFrom: string;
}

/** Erros por campo, com chaves do rascunho (`periods.0.name`, `day6.periods.1.expectedTime`…). */
export type ScheduleErrors = Record<string, string>;

let periodSeq = 0;
/** Id local de período. */
export const newPeriodId = (): string => {
  periodSeq += 1;
  return `p${Date.now().toString(36)}${periodSeq}`;
};

export const periodDraft = (name = "", expectedTime = ""): PeriodDraft => ({ id: newPeriodId(), name, expectedTime });

/** Copia períodos com ids novos ("copiar de outro dia"). */
export const clonePeriods = (periods: PeriodDraft[]): PeriodDraft[] =>
  periods.map((period) => periodDraft(period.name, period.expectedTime));

const emptyDays = (): DayDraft[] =>
  Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, workDay: false, dailyLoad: "", periods: [] }));

/** Nomes padrão dos períodos (i18n). */
const defaultPeriodNames = (): string[] => [
  i18n.t("cargos:defaults.entry"),
  i18n.t("cargos:defaults.break"),
  i18n.t("cargos:defaults.return"),
  i18n.t("cargos:defaults.exit"),
];

/** Jornada inicial de um cargo novo: seg–sex, 4 períodos, 8 h/dia, 40 h/semana. */
export const defaultScheduleDraft = (today: string): ScheduleDraft => {
  const [entry = "", pause = "", back = "", exit = ""] = defaultPeriodNames();
  return {
    mode: "weekly",
    workDays: [1, 2, 3, 4, 5],
    periods: [
      periodDraft(entry, "08:00"),
      periodDraft(pause, "12:00"),
      periodDraft(back, "13:00"),
      periodDraft(exit, "17:00"),
    ],
    dailyLoad: "08:00",
    weeklyLoad: "40:00",
    days: emptyDays(),
    effectiveFrom: today,
  };
};

/** Rascunho a partir de uma versão gravada; a nova versão vale de hoje (ou da vigência futura). */
export const draftFromSchedule = (info: ScheduleInfo | null, today: string): ScheduleDraft => {
  if (!info || info.days.length === 0) return defaultScheduleDraft(today);
  const effectiveFrom = info.effectiveFrom > today ? info.effectiveFrom : today;
  const sortedDays = [...info.days].sort((a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek));
  const toPeriods = (periods: ScheduleInfo["days"][number]["periods"]): PeriodDraft[] =>
    [...periods].sort((a, b) => a.sequence - b.sequence).map((period) => periodDraft(period.name, period.expectedTime ?? ""));
  const days = emptyDays();
  sortedDays.forEach((day) => {
    days[day.dayOfWeek] = {
      dayOfWeek: day.dayOfWeek,
      workDay: true,
      dailyLoad: minutesToHhmm(day.dailyMinutes),
      periods: toPeriods(day.periods),
    };
  });
  const first = sortedDays[0];
  return {
    mode: info.mode,
    workDays: sortedDays.map((day) => day.dayOfWeek),
    periods: first ? toPeriods(first.periods) : [],
    dailyLoad: first ? minutesToHhmm(first.dailyMinutes) : "",
    weeklyLoad: minutesToHhmm(info.weeklyMinutes),
    days,
    effectiveFrom,
  };
};

/** Troca o modo levando a configuração atual (semanal → todos os dias úteis; diário → 1º dia útil). */
export const switchMode = (draft: ScheduleDraft, mode: ScheduleMode): ScheduleDraft => {
  if (mode === draft.mode) return draft;
  if (mode === "daily") {
    const days = emptyDays().map((day) =>
      draft.workDays.includes(day.dayOfWeek)
        ? { ...day, workDay: true, dailyLoad: draft.dailyLoad, periods: clonePeriods(draft.periods) }
        : day,
    );
    return { ...draft, mode, days };
  }
  const firstWork = WEEK_ORDER.map((dow) => draft.days[dow]).find((day) => day?.workDay);
  return {
    ...draft,
    mode,
    workDays: draft.days.filter((day) => day.workDay).map((day) => day.dayOfWeek),
    periods: firstWork ? clonePeriods(firstWork.periods) : draft.periods,
    dailyLoad: firstWork?.dailyLoad ?? draft.dailyLoad,
  };
};

/** Dias úteis do modo diário na ordem enviada à API (segunda → domingo). */
export const dailyWorkDays = (draft: ScheduleDraft): DayDraft[] =>
  WEEK_ORDER.map((dow) => draft.days[dow]).filter((day): day is DayDraft => Boolean(day?.workDay));

const toPeriodInputs = (periods: PeriodDraft[]) =>
  periods.map((period) => ({ name: period.name.trim(), expectedTime: period.expectedTime || null }));

/** Converte o rascunho em `ScheduleInput` (cargas inválidas viram 0; valide antes). */
export const toScheduleInput = (draft: ScheduleDraft, includeEffectiveFrom = true): ScheduleInput => {
  const weeklyMinutes = hhmmToMinutes(draft.weeklyLoad) ?? 0;
  const effectiveFrom = includeEffectiveFrom && draft.effectiveFrom ? draft.effectiveFrom : null;
  if (draft.mode === "weekly") {
    return {
      mode: "weekly",
      effectiveFrom,
      weeklyMinutes,
      workDays: WEEK_ORDER.filter((dow) => draft.workDays.includes(dow)),
      dailyMinutes: hhmmToMinutes(draft.dailyLoad) ?? 0,
      periods: toPeriodInputs(draft.periods),
    };
  }
  return {
    mode: "daily",
    effectiveFrom,
    weeklyMinutes,
    days: dailyWorkDays(draft).map((day) => ({
      dayOfWeek: day.dayOfWeek,
      dailyMinutes: hhmmToMinutes(day.dailyLoad) ?? 0,
      periods: toPeriodInputs(day.periods),
    })),
  };
};

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

const validatePeriods = (periods: PeriodDraft[], prefix: string, errors: ScheduleErrors): void => {
  if (periods.length < MIN_PERIODS) errors[`${prefix}periods`] = i18n.t("cargos:errors.periodsMin");
  else if (periods.length > MAX_PERIODS) errors[`${prefix}periods`] = i18n.t("cargos:errors.periodsMax", { max: MAX_PERIODS });
  let previous: { name: string; time: string; minutes: number } | null = null;
  periods.forEach((period, index) => {
    const name = period.name.trim();
    if (!name) errors[`${prefix}periods.${index}.name`] = i18n.t("cargos:errors.periodName");
    else if (name.length > PERIOD_NAME_MAX_LENGTH)
      errors[`${prefix}periods.${index}.name`] = i18n.t("cargos:errors.periodNameLength", { max: PERIOD_NAME_MAX_LENGTH });
    if (!period.expectedTime) return;
    const minutes = hhmmToMinutes(period.expectedTime);
    if (minutes === null) {
      errors[`${prefix}periods.${index}.expectedTime`] = i18n.t("cargos:errors.timeInvalid");
      return;
    }
    if (previous && minutes <= previous.minutes) {
      errors[`${prefix}periods.${index}.expectedTime`] = previous.name
        ? i18n.t("cargos:errors.timeOrder", { previous: previous.name, time: previous.time })
        : i18n.t("cargos:errors.timeOrderUnnamed", { time: previous.time });
    }
    previous = { name, time: period.expectedTime, minutes };
  });
};

const validateLoad = (value: string, min: number, max: number, rangeKey: string): string | null => {
  const minutes = hhmmToMinutes(value);
  if (minutes === null) return i18n.t("cargos:errors.loadFormat");
  if (minutes < min || minutes > max) return i18n.t(rangeKey);
  return null;
};

/** Valida o rascunho; vazio = válido. */
export const validateScheduleDraft = (draft: ScheduleDraft, today: string, checkEffectiveFrom = true): ScheduleErrors => {
  const errors: ScheduleErrors = {};
  if (draft.mode === "weekly") {
    if (draft.workDays.length === 0) errors.workDays = i18n.t("cargos:errors.noWorkDay");
    validatePeriods(draft.periods, "", errors);
    const daily = validateLoad(draft.dailyLoad, MIN_DAILY_MINUTES, MAX_DAILY_MINUTES, "cargos:errors.dailyRange");
    if (daily) errors.dailyMinutes = daily;
  } else {
    const workDays = dailyWorkDays(draft);
    if (workDays.length === 0) errors.workDays = i18n.t("cargos:errors.noWorkDay");
    workDays.forEach((day) => {
      const prefix = `day${day.dayOfWeek}.`;
      validatePeriods(day.periods, prefix, errors);
      const daily = validateLoad(day.dailyLoad, MIN_DAILY_MINUTES, MAX_DAILY_MINUTES, "cargos:errors.dailyRange");
      if (daily) errors[`${prefix}dailyMinutes`] = daily;
    });
  }
  const weekly = validateLoad(draft.weeklyLoad, MIN_WEEKLY_MINUTES, MAX_WEEKLY_MINUTES, "cargos:errors.weeklyRange");
  if (weekly) errors.weeklyMinutes = weekly;
  if (checkEffectiveFrom) {
    if (!isValidYmd(draft.effectiveFrom)) errors.effectiveFrom = i18n.t("cargos:errors.effectiveRequired");
    else if (draft.effectiveFrom < today) errors.effectiveFrom = i18n.t("cargos:errors.effectivePast");
  }
  return errors;
};

/** Chaves de erro na ordem dos campos na tela (para focar o primeiro). */
export const orderedErrorKeys = (draft: ScheduleDraft, errors: ScheduleErrors): string[] => {
  const order: string[] = ["workDays"];
  const pushPeriods = (prefix: string, count: number) => {
    order.push(`${prefix}periods`);
    for (let index = 0; index < count; index += 1) {
      order.push(`${prefix}periods.${index}.name`, `${prefix}periods.${index}.expectedTime`);
    }
  };
  if (draft.mode === "weekly") {
    pushPeriods("", draft.periods.length);
    order.push("dailyMinutes");
  } else {
    WEEK_ORDER.forEach((dow) => {
      pushPeriods(`day${dow}.`, draft.days[dow]?.periods.length ?? 0);
      order.push(`day${dow}.dailyMinutes`);
    });
  }
  order.push("weeklyMinutes", "effectiveFrom");
  const known = order.filter((key) => key in errors);
  const unknown = Object.keys(errors).filter((key) => !order.includes(key));
  return [...known, ...unknown];
};

/** `id` DOM do campo de uma chave de erro. */
export const scheduleFieldId = (prefix: string, key: string): string => `${prefix}-${key.replace(/[^A-Za-z0-9]+/g, "-")}`;

/** Resultado do mapeamento dos erros da API. */
export interface MappedApiErrors {
  /** Erros do rascunho por chave */
  fields: ScheduleErrors;
  /** Erro do nome do cargo */
  name: string | null;
  /** Erros sem campo correspondente (vão para o aviso do topo) */
  general: string[];
}

const PATH_PATTERN = /^(?:schedule\.)?(.+)$/i;

/**
 * Converte `erros[]` da API (`periods[0].name`, `schedule.days[1].periods[0].expectedTime`…)
 * para as chaves do rascunho. No modo diário, o índice de `days[k]` é o k-ésimo dia útil enviado.
 */
export const mapApiScheduleErrors = (erros: ApiFieldError[], draft: ScheduleDraft): MappedApiErrors => {
  const result: MappedApiErrors = { fields: {}, name: null, general: [] };
  const workDays = dailyWorkDays(draft);
  erros.forEach(({ campo, mensagem }) => {
    const raw = (PATH_PATTERN.exec(campo.trim())?.[1] ?? "").replace(/\[(\d+)\]/g, ".$1");
    const path = raw.toLowerCase();
    let key: string | null = null;
    if (path === "name") {
      result.name = result.name ?? mensagem;
      return;
    }
    if (path === "workdays" || path.startsWith("workdays.")) key = "workDays";
    else if (path === "dailyminutes") key = "dailyMinutes";
    else if (path === "weeklyminutes") key = "weeklyMinutes";
    else if (path === "effectivefrom") key = "effectiveFrom";
    else if (path === "periods") key = "periods";
    else if (path === "days") key = "workDays";
    else {
      const period = /^periods\.(\d+)\.(name|expectedtime)$/.exec(path);
      const day = /^days\.(\d+)(?:\.(dailyminutes|periods)(?:\.(\d+)\.(name|expectedtime))?)?$/.exec(path);
      if (period) key = `periods.${period[1]}.${period[2] === "name" ? "name" : "expectedTime"}`;
      else if (day) {
        const dow = workDays[Number(day[1])]?.dayOfWeek;
        if (dow !== undefined) {
          if (day[2] === "dailyminutes") key = `day${dow}.dailyMinutes`;
          else if (day[2] === "periods" && day[3] !== undefined)
            key = `day${dow}.periods.${day[3]}.${day[4] === "name" ? "name" : "expectedTime"}`;
          else if (day[2] === "periods") key = `day${dow}.periods`;
        }
      }
    }
    if (key) result.fields[key] = result.fields[key] ?? mensagem;
    else result.general.push(mensagem);
  });
  return result;
};

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------

/** Dia normalizado para o resumo. */
export interface SummaryDay {
  dayOfWeek: number;
  periods: number;
  dailyMinutes: number;
}

/** Jornada normalizada (vinda da API ou do rascunho). */
export interface ScheduleShape {
  mode: ScheduleMode;
  weeklyMinutes: number;
  days: SummaryDay[];
}

export const shapeFromInfo = (info: ScheduleInfo): ScheduleShape => ({
  mode: info.mode,
  weeklyMinutes: info.weeklyMinutes,
  days: info.days.map((day) => ({ dayOfWeek: day.dayOfWeek, periods: day.periods.length, dailyMinutes: day.dailyMinutes })),
});

export const shapeFromDraft = (draft: ScheduleDraft): ScheduleShape => {
  const weeklyMinutes = hhmmToMinutes(draft.weeklyLoad) ?? 0;
  if (draft.mode === "weekly") {
    const dailyMinutes = hhmmToMinutes(draft.dailyLoad) ?? 0;
    return {
      mode: "weekly",
      weeklyMinutes,
      days: draft.workDays.map((dayOfWeek) => ({ dayOfWeek, periods: draft.periods.length, dailyMinutes })),
    };
  }
  return {
    mode: "daily",
    weeklyMinutes,
    days: dailyWorkDays(draft).map((day) => ({
      dayOfWeek: day.dayOfWeek,
      periods: day.periods.length,
      dailyMinutes: hhmmToMinutes(day.dailyLoad) ?? 0,
    })),
  };
};

const dayShort = (dow: number): string => i18n.t(`comum:weekdaysShort.${dow}`);

/** "Seg–Sex", "Seg–Qua, Sex", "Sáb, Dom". */
export const formatDayRanges = (daysOfWeek: number[]): string => {
  const present = WEEK_ORDER.filter((dow) => daysOfWeek.includes(dow));
  const groups: number[][] = [];
  present.forEach((dow) => {
    const last = groups[groups.length - 1];
    const lastDow = last?.[last.length - 1];
    if (last && lastDow !== undefined && WEEK_ORDER.indexOf(dow) === WEEK_ORDER.indexOf(lastDow) + 1) last.push(dow);
    else groups.push([dow]);
  });
  return groups
    .map((group) => {
      const first = group[0] ?? 0;
      const last = group[group.length - 1] ?? first;
      if (group.length >= 3) return `${dayShort(first)}–${dayShort(last)}`;
      return group.map(dayShort).join(", ");
    })
    .join(", ");
};

/** "44 h" ou "43 h 30 min". */
export const formatHours = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? i18n.t("cargos:summary.hours", { hours }) : i18n.t("cargos:summary.hoursMinutes", { hours, minutes: rest });
};

/** "Seg–Sex · 4 marcações · 44 h/semana" (diário com exceções: "· 4 marcações (Sáb: 2) ·"). */
export const summarizeSchedule = (shape: ScheduleShape): string => {
  if (shape.days.length === 0) return i18n.t("cargos:summary.noWorkDays");
  const counts = new Map<number, number>();
  shape.days.forEach((day) => counts.set(day.periods, (counts.get(day.periods) ?? 0) + 1));
  let common = shape.days[0]?.periods ?? 0;
  counts.forEach((count, periods) => {
    if (count > (counts.get(common) ?? 0)) common = periods;
  });
  const exceptions = shape.days
    .filter((day) => day.periods !== common)
    .sort((a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek))
    .map((day) => `${dayShort(day.dayOfWeek)}: ${day.periods}`);
  const punches = i18n.t("cargos:summary.punches", { count: common });
  const punchesText = exceptions.length > 0 ? `${punches} (${exceptions.join(", ")})` : punches;
  return [
    formatDayRanges(shape.days.map((day) => day.dayOfWeek)),
    punchesText,
    i18n.t("cargos:summary.perWeek", { hours: formatHours(shape.weeklyMinutes) }),
  ].join(" · ");
};
