/**
 * Linha do tempo do dia na tela de ponto (components.md §2.4): períodos previstos com a
 * marcação de cada um, marcações extras em ordem cronológica e marcações da fila offline.
 * Pedidos de correção ficam na linha da marcação original, como no histórico (N-04): a base é
 * a mesma `buildDayRows` do `DayCard`.
 */
import type { DayRecord, PunchInfo, QueuedPunch } from "../types/punch";
import { formatTimeInZone } from "./dateTime";
import { buildDayRows, effectivePunchOf } from "./dayRows";
import { hhmmToMinutes } from "./duration";

export interface TimelineRow {
  /** Chave estável (`period:1`, `punch:881`, `queue:{clientId}`) */
  key: string;
  /** Nome do período; `null` = "Extra" */
  name: string | null;
  /** Horário previsto `HH:mm` */
  expectedTime: string | null;
  /** Horário que vale na linha `HH:mm` */
  time: string | null;
  /** Marcação que vale na linha (correção aprovada no lugar da original) */
  punch: PunchInfo | null;
  /** Marcação original quando há pedidos de correção (mostrada lado a lado com eles) */
  original: PunchInfo | null;
  /** Pedidos de correção da marcação original (pendentes e analisados) */
  corrections: PunchInfo[];
  queued: QueuedPunch | null;
  /** Linha de um período previsto */
  isPeriod: boolean;
  /** Próxima marcação esperada */
  next: boolean;
}

export interface Timeline {
  rows: TimelineRow[];
  /** Períodos previstos do dia */
  periods: TimelineRow[];
  /** Próximo período sem marcação (nulo = jornada completa ou sem jornada) */
  next: TimelineRow | null;
  /**
   * Períodos com marcação que conta (`valid`/`approved`). Pendentes e fila offline **não** contam
   * (components.md §2.1, revisão T070 B-01) — vale para o anel, "N de M" e "jornada completa".
   */
  done: number;
  /** Períodos cobertos só por marcação pendente ou pela fila offline */
  pending: number;
}

/** Situação de um período no painel do relógio. */
export type PeriodState = "done" | "pending" | "queued" | "next" | "todo";

/** Marcação que conta como feita (`valid`/`approved`). */
export const countsAsDone = (punch: PunchInfo | null): boolean =>
  punch !== null && (punch.status === "valid" || punch.status === "approved");

/** Situação de um período: feita, pendente, na fila, próxima ou prevista. */
export const periodState = (row: TimelineRow): PeriodState => {
  if (row.queued) return "queued";
  if (countsAsDone(row.punch)) return "done";
  if (row.punch?.status === "pending") return "pending";
  return row.next ? "next" : "todo";
};

const minutesOf = (row: TimelineRow): number | null => {
  const value = row.time ?? row.expectedTime;
  return value ? hhmmToMinutes(value) : null;
};

/** Monta a linha do tempo de hoje. `queued` = itens `waiting`/`sending` do dia e da empresa. */
export const buildTimeline = (day: DayRecord | null, queued: QueuedPunch[], timeZone: string): Timeline => {
  const rows: TimelineRow[] = (day ? buildDayRows(day) : []).map((row) => {
    const punch = effectivePunchOf(row);
    const hasCorrections = row.corrections.length > 0;
    return {
      key: row.isPeriod ? row.key.replace("period-", "period:") : row.key.replace("punch-", "punch:"),
      name: row.name,
      expectedTime: row.expectedTime,
      time: punch?.localTime ?? null,
      punch,
      original: hasCorrections ? row.punch : null,
      corrections: row.corrections,
      queued: null,
      isPeriod: row.isPeriod,
      next: false,
    };
  });
  const periodRows = rows.filter((row) => row.isPeriod);

  // Fila offline: ocupa (visualmente) os próximos períodos livres; o resto vira extra
  const queuedExtras: TimelineRow[] = [];
  [...queued]
    .sort((a, b) => a.punchedAt.localeCompare(b.punchedAt))
    .forEach((item) => {
      const time = formatTimeInZone(item.punchedAt, timeZone);
      const free = periodRows.find((row) => !row.punch && !row.queued);
      if (free) {
        free.queued = item;
        free.time = time;
      } else {
        queuedExtras.push({
          key: `queue:${item.clientId}`,
          name: null,
          expectedTime: null,
          time,
          punch: null,
          original: null,
          corrections: [],
          queued: item,
          isPeriod: false,
          next: false,
        });
      }
    });

  // Extras da fila entram na ordem cronológica entre as linhas
  queuedExtras.forEach((extra) => {
    const minutes = minutesOf(extra) ?? 0;
    let insertAt = rows.length;
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index];
      const rowMinutes = row ? minutesOf(row) : null;
      if (rowMinutes !== null && rowMinutes > minutes) insertAt = index;
      else if (rowMinutes !== null) break;
    }
    rows.splice(insertAt, 0, extra);
  });

  const next = periodRows.find((row) => !row.punch && !row.queued) ?? null;
  if (next) next.next = true;
  const done = periodRows.filter((row) => countsAsDone(row.punch)).length;
  const pending = periodRows.filter((row) => !countsAsDone(row.punch) && (row.queued || row.punch?.status === "pending")).length;
  return { rows, periods: periodRows, next, done, pending };
};
