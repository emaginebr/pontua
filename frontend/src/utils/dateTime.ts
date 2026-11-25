/**
 * Datas e horas no fuso da empresa (research R-08). Toda formatação usa
 * `Intl.DateTimeFormat('pt-BR', { timeZone })`; datas "de calendário" (`yyyy-MM-dd`) são
 * manipuladas como strings/UTC para não depender do fuso do aparelho.
 */

export const LOCALE = "pt-BR";
/** Fuso padrão da API quando a empresa ainda não foi carregada */
export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

const DAY_MS = 24 * 60 * 60 * 1000;
const YMD_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const YM_PATTERN = /^(\d{4})-(\d{2})$/;

const pad = (value: number, size = 2): string => String(Math.abs(Math.trunc(value))).padStart(size, "0");

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/** `Intl.DateTimeFormat` reaproveitado (criar um por chamada é caro no relógio por segundo). */
const getFormatter = (timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone });
    formatterCache.set(key, formatter);
  }
  return formatter;
};

/** `true` quando o fuso IANA é aceito pelo navegador. */
export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat(LOCALE, { timeZone });
    return true;
  } catch {
    return false;
  }
};

const safeZone = (timeZone: string | null | undefined): string =>
  timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;

const toDate = (value: Date | string | number): Date => (value instanceof Date ? value : new Date(value));

/** Partes numéricas de um instante no fuso indicado. */
interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const getZonedParts = (instant: Date, timeZone: string): ZonedParts => {
  const parts = getFormatter(safeZone(timeZone), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") % 24,
    minute: read("minute"),
    second: read("second"),
  };
};

/** Data `yyyy-MM-dd` de um instante no fuso indicado ("hoje" da empresa). */
export const toYmdInZone = (instant: Date | string | number, timeZone: string): string => {
  const { year, month, day } = getZonedParts(toDate(instant), timeZone);
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
};

/** "Hoje" (`yyyy-MM-dd`) no fuso da empresa. */
export const todayInZone = (timeZone: string, now: Date = new Date()): string => toYmdInZone(now, timeZone);

/** Mês corrente (`yyyy-MM`) no fuso da empresa. */
export const currentMonthInZone = (timeZone: string, now: Date = new Date()): string =>
  todayInZone(timeZone, now).slice(0, 7);

/** Horário `HH:mm` (24 h) de um instante no fuso indicado. */
export const formatTimeInZone = (instant: Date | string | number, timeZone: string): string => {
  const { hour, minute } = getZonedParts(toDate(instant), timeZone);
  return `${pad(hour)}:${pad(minute)}`;
};

/** Data longa: "terça-feira, 25 de novembro". */
export const formatLongDateInZone = (instant: Date | string | number, timeZone: string): string =>
  getFormatter(safeZone(timeZone), { weekday: "long", day: "numeric", month: "long" }).format(toDate(instant));

/** Data e hora curtas: "25/11 às 07:58" (usado em "dados de …"). */
export const formatDateTimeShortInZone = (
  instant: Date | string | number,
  timeZone: string,
): { date: string; time: string } => {
  const date = getFormatter(safeZone(timeZone), { day: "2-digit", month: "2-digit" }).format(toDate(instant));
  return { date, time: formatTimeInZone(instant, timeZone) };
};

// ---------------------------------------------------------------------------
// Datas de calendário (yyyy-MM-dd) — sem fuso
// ---------------------------------------------------------------------------

/** `true` para `yyyy-MM-dd` existente no calendário. */
export const isValidYmd = (value: string | null | undefined): value is string => {
  if (!value) return false;
  const match = YMD_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return (
    date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d)
  );
};

/** `true` para `yyyy-MM` com mês 01–12. */
export const isValidYm = (value: string | null | undefined): value is string => {
  if (!value) return false;
  const match = YM_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return Number(match[1]) >= 1900 && month >= 1 && month <= 12;
};

/** `yyyy-MM-dd` → instante UTC à meia-noite (só para aritmética de calendário). */
const ymdToUtc = (ymd: string): number => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

const utcToYmd = (time: number): string => {
  const date = new Date(time);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

/** Soma dias a uma data `yyyy-MM-dd`. */
export const addDays = (ymd: string, days: number): string => utcToYmd(ymdToUtc(ymd) + days * DAY_MS);

/** Diferença em dias (`to − from`). */
export const diffDays = (from: string, to: string): number => Math.round((ymdToUtc(to) - ymdToUtc(from)) / DAY_MS);

/** Dia da semana (0 = domingo) de `yyyy-MM-dd`. */
export const dayOfWeek = (ymd: string): number => new Date(ymdToUtc(ymd)).getUTCDay();

/** Primeiro e último dia de `yyyy-MM`. */
export const monthBounds = (month: string): { start: string; end: string } => {
  const [y, m] = month.split("-").map(Number);
  const year = y ?? 1970;
  const monthIndex = (m ?? 1) - 1;
  const start = utcToYmd(Date.UTC(year, monthIndex, 1));
  const end = utcToYmd(Date.UTC(year, monthIndex + 1, 0));
  return { start, end };
};

/** Soma meses a `yyyy-MM`. */
export const addMonths = (month: string, delta: number): string => {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + delta, 1));
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}`;
};

/** "Novembro de 2026". */
export const formatMonthLabel = (month: string): string => {
  const [y, m] = month.split("-").map(Number);
  const label = getFormatter("UTC", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1)),
  );
  return label.charAt(0).toLocaleUpperCase(LOCALE) + label.slice(1);
};

/** "24/11/2026" (campos e textos formais). */
export const formatYmdNumeric = (ymd: string): string => {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
};

/** "24/11" (intervalos curtos). */
export const formatYmdDayMonth = (ymd: string): string => {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
};

/** "seg, 24 nov" (listas — sem "de" nem pontos, DESIGN_DIRECTION §6). */
export const formatYmdShort = (ymd: string): string =>
  getFormatter("UTC", { weekday: "short", day: "numeric", month: "short" })
    .format(new Date(ymdToUtc(ymd)))
    .replace(/\./g, "")
    .replace(/ de /g, " ");

/** Mês abreviado sem ponto: "nov". */
const shortMonth = (ymd: string): string =>
  getFormatter("UTC", { month: "short" }).format(new Date(ymdToUtc(ymd))).replace(/\./g, "");

/** Dia do mês sem zero à esquerda: "3". */
const dayNumber = (ymd: string): string => String(Number(ymd.slice(8, 10)));

/**
 * Intervalo curto de datas (DESIGN_DIRECTION §6): "23–29 nov"; meses diferentes "30 nov – 6 dez";
 * anos diferentes "29 dez 2026 – 4 jan 2027"; um dia só "24 nov".
 */
export const formatYmdRange = (from: string, to: string): string => {
  if (from === to) return `${dayNumber(from)} ${shortMonth(from)}`;
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  if (sameYear && from.slice(5, 7) === to.slice(5, 7)) return `${dayNumber(from)}–${dayNumber(to)} ${shortMonth(to)}`;
  if (sameYear) return `${dayNumber(from)} ${shortMonth(from)} – ${dayNumber(to)} ${shortMonth(to)}`;
  return `${dayNumber(from)} ${shortMonth(from)} ${from.slice(0, 4)} – ${dayNumber(to)} ${shortMonth(to)} ${to.slice(0, 4)}`;
};

/** "Segunda-feira, 24 de novembro" (cabeçalhos de dia). */
export const formatYmdLong = (ymd: string): string => {
  const label = getFormatter("UTC", { weekday: "long", day: "numeric", month: "long" }).format(new Date(ymdToUtc(ymd)));
  return label.charAt(0).toLocaleUpperCase(LOCALE) + label.slice(1);
};

// ---------------------------------------------------------------------------
// Instantes do aparelho e do servidor
// ---------------------------------------------------------------------------

/**
 * Instante em ISO-8601 com o offset do aparelho (ex.: `2026-11-25T08:02:41-03:00`), formato
 * pedido pela marcação offline (`OfflinePunchItem.punchedAt`).
 */
export const toIsoWithDeviceOffset = (date: Date = new Date()): string => {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const local =
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${local}${sign}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}:${pad(Math.abs(offsetMinutes) % 60)}`;
};

/** Hora "oficial": relógio do aparelho corrigido pela diferença para o servidor (ms). */
export const applyServerOffset = (serverOffset: number, now: number = Date.now()): Date => new Date(now + serverOffset);
