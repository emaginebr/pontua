/**
 * Datas permitidas na marcação manual (research R-13, FR-016): de
 * `max(hoje − manualRetroDays, data de entrada do membro)` até hoje, no fuso da empresa.
 */
import { addDays, toYmdInZone } from "./dateTime";

export interface ManualWindow {
  /** Primeira data permitida (`yyyy-MM-dd`) */
  min: string;
  /** Hoje (`yyyy-MM-dd`) */
  max: string;
}

export const manualWindow = (
  today: string,
  manualRetroDays: number,
  joinedAt: string | null | undefined,
  timeZone: string,
): ManualWindow => {
  const retroLimit = addDays(today, -Math.max(0, manualRetroDays));
  const joined = joinedAt ? toYmdInZone(joinedAt, timeZone) : null;
  const min = joined && joined > retroLimit ? joined : retroLimit;
  return { min: min > today ? today : min, max: today };
};

/** `true` quando a data cabe na janela. */
export const isInManualWindow = (date: string, window: ManualWindow): boolean =>
  date >= window.min && date <= window.max;
