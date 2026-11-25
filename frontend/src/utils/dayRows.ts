/**
 * Linhas de um dia do histórico (components.md §3.3): períodos previstos com a marcação de cada
 * um, marcações extras e pedidos de correção ligados à marcação original (lado a lado).
 */
import type { DayRecord, PunchInfo, PunchStatus } from "../types/punch";
import { formatYmdRange, formatYmdShort } from "./dateTime";

/** Linha do dia. */
export interface DayRow {
  key: string;
  /** Nome do período; `null` = "Extra" */
  name: string | null;
  /** Linha de um período previsto (mesmo sem marcação) */
  isPeriod: boolean;
  /** `HH:mm` previsto */
  expectedTime: string | null;
  /** Marcação da linha (a original, quando há correção) */
  punch: PunchInfo | null;
  /** Pedidos de correção desta marcação (pendentes e analisados) */
  corrections: PunchInfo[];
}

/** Status que contam como marcação feita (efetiva ou aguardando análise). */
const LIVE_STATUSES: readonly PunchStatus[] = ["valid", "approved", "pending"];

export const isLivePunch = (punch: PunchInfo): boolean => LIVE_STATUSES.includes(punch.status);

/** Riscado na lista (não vale mais). */
export const isStruckPunch = (punch: PunchInfo): boolean =>
  punch.status === "cancelled" || punch.status === "superseded" || punch.status === "rejected";

/** Dia útil passado sem nenhuma marcação feita ou pedida. */
export const isMissingDay = (day: DayRecord, today: string): boolean =>
  day.isWorkDay && day.date < today && !day.punches.some(isLivePunch);

/** Dia de folga sem marcações (cartão recolhido "Folga"). */
export const isQuietDayOff = (day: DayRecord): boolean => !day.isWorkDay && day.punches.length === 0;

/** Monta as linhas do dia na ordem dos horários (períodos sem marcação pelo horário previsto). */
export const buildDayRows = (day: DayRecord): DayRow[] => {
  const byId = new Map(day.punches.map((punch) => [punch.punchId, punch]));
  const corrections = new Map<number, PunchInfo[]>();
  day.punches.forEach((punch) => {
    if (punch.replacesPunchId !== null && byId.has(punch.replacesPunchId)) {
      const list = corrections.get(punch.replacesPunchId) ?? [];
      list.push(punch);
      corrections.set(punch.replacesPunchId, list);
    }
  });
  const isCorrection = (punch: PunchInfo) => punch.replacesPunchId !== null && byId.has(punch.replacesPunchId);
  /** Correção aprovada vira a marcação do período: a linha mostra a original ao lado dela. */
  const rootOf = (punch: PunchInfo): PunchInfo => {
    let current = punch;
    const seen = new Set<number>();
    while (current.replacesPunchId !== null && !seen.has(current.punchId)) {
      seen.add(current.punchId);
      const original = byId.get(current.replacesPunchId);
      if (!original) break;
      current = original;
    }
    return current;
  };

  /**
   * Cada par original/correção aparece UMA vez, na linha do período da original (revisão T070,
   * B-02). Não se confia em a API apontar um único período para o par: primeiro os períodos que
   * apontam direto para uma original; depois os que apontam para uma correção (correção aprovada
   * que virou a marcação do período) — se a original desse par já tem linha, o período fica vazio.
   */
  const periods = [...day.periods].sort((a, b) => a.sequence - b.sequence);
  const used = new Set<number>();
  const assigned = new Map<number, PunchInfo>();
  const assign = (pass: "original" | "correction") =>
    periods.forEach((period) => {
      if (assigned.has(period.sequence) || period.punchId === null) return;
      const found = byId.get(period.punchId);
      if (!found || isCorrection(found) !== (pass === "correction")) return;
      const root = rootOf(found);
      if (used.has(root.punchId)) return;
      used.add(root.punchId);
      assigned.set(period.sequence, root);
    });
  assign("original");
  assign("correction");

  const periodRows: DayRow[] = periods.map((period) => {
    const punch = assigned.get(period.sequence) ?? null;
    return {
      key: `period-${period.sequence}`,
      name: period.name,
      isPeriod: true,
      expectedTime: period.expectedTime,
      punch,
      corrections: punch ? (corrections.get(punch.punchId) ?? []) : [],
    };
  });

  // Extras: marcações (e pares) que nenhum período recebeu
  const extras: DayRow[] = [];
  day.punches.forEach((punch) => {
    const root = rootOf(punch);
    if (used.has(root.punchId)) return;
    used.add(root.punchId);
    extras.push({
      key: `punch-${root.punchId}`,
      name: root.periodName,
      isPeriod: false,
      expectedTime: null,
      punch: root,
      corrections: corrections.get(root.punchId) ?? [],
    });
  });

  // Períodos na ordem da jornada (`sequence`); extras entram pelo horário entre eles
  const rows = [...periodRows];
  extras
    .map((row, index) => ({ row, index }))
    .sort((a, b) => (rowTime(a.row) ?? "").localeCompare(rowTime(b.row) ?? "") || a.index - b.index)
    .forEach(({ row: extra }) => {
      const time = rowTime(extra) ?? "99:99";
      let insertAt = rows.length;
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        const current = rows[index];
        const currentTime = current ? rowTime(current) : null;
        if (currentTime === null) continue;
        if (currentTime > time) insertAt = index;
        else break;
      }
      rows.splice(insertAt, 0, extra);
    });
  return rows;
};

/** Horário que ordena a linha: correção aprovada (vale no lugar da original), marcação ou previsto. */
const rowTime = (row: DayRow): string | null => effectivePunchOf(row)?.localTime ?? row.expectedTime ?? null;

/**
 * Marcação que vale na linha: a última correção aprovada (substitui a original), senão a própria
 * marcação. Pedidos pendentes, rejeitados ou cancelados não mudam o que vale.
 */
export const effectivePunchOf = (row: DayRow): PunchInfo | null =>
  [...row.corrections].reverse().find((item) => item.status === "approved") ?? row.punch;

/**
 * Marcação usada no menu "Mais ações" da linha (um único `⋯` por linha — I-07): a correção
 * pendente (pode ser cancelada), senão a última correção, senão a própria marcação.
 */
export const actionPunchOf = (row: DayRow): PunchInfo | null => {
  if (!row.punch) return null;
  const pending = row.corrections.find((item) => item.status === "pending");
  return pending ?? row.corrections[row.corrections.length - 1] ?? row.punch;
};

/**
 * Rótulo das folgas seguidas (I-08): 1–2 dias listados ("dom, 22 nov · sáb, 21 nov"); 3 ou mais
 * viram intervalo ("1–17 nov"). `days` vem do mais recente para o mais antigo.
 */
export const daysOffLabel = (days: DayRecord[]): string => {
  if (days.length <= 2) return days.map((day) => formatYmdShort(day.date)).join(" · ");
  const dates = days.map((day) => day.date).sort();
  return formatYmdRange(dates[0] ?? "", dates[dates.length - 1] ?? "");
};

/** Item da lista do histórico: um dia ou uma sequência de folgas recolhidas. */
export type DayListItem = { kind: "day"; day: DayRecord } | { kind: "off"; days: DayRecord[] };

/**
 * Dias do mais recente para o mais antigo, sem datas futuras; folgas seguidas sem marcação viram
 * um único item ("dom, 23 nov · sáb, 22 nov — Folga", mockup history.html).
 */
export const groupDays = (days: DayRecord[], today: string): DayListItem[] => {
  const sorted = days.filter((day) => day.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const items: DayListItem[] = [];
  sorted.forEach((day) => {
    const last = items[items.length - 1];
    if (isQuietDayOff(day) && last?.kind === "off") {
      last.days.push(day);
      return;
    }
    items.push(isQuietDayOff(day) ? { kind: "off", days: [day] } : { kind: "day", day });
  });
  return items;
};
