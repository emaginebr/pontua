/** Dados de exemplo para os testes das telas de histórico, aprovações e membros. */
import type { PendingPanelDay, PendingPanelMember } from "../types/approval";
import type { DayRecord, PunchInfo } from "../types/punch";
import type { HoursSummary } from "../types/summary";
import { addDays, todayInZone } from "../utils/dateTime";

export const TIME_ZONE = "America/Sao_Paulo";
/** Hoje e ontem no fuso da empresa de teste */
export const TODAY = todayInZone(TIME_ZONE);
export const YESTERDAY = addDays(TODAY, -1);

let nextPunchId = 5000;

export const punch = (overrides: Partial<PunchInfo> = {}): PunchInfo => ({
  punchId: overrides.punchId ?? ++nextPunchId,
  nsr: 1000,
  memberId: 12,
  kind: "normal",
  punchedAt: "2020-01-01T11:00:00Z",
  workDate: YESTERDAY,
  localTime: "08:00",
  receivedAt: "2020-01-01T11:00:00Z",
  status: "valid",
  pendingReason: null,
  justification: null,
  replacesPunchId: null,
  periodName: "Entrada",
  countsAsWorked: true,
  review: null,
  ...overrides,
});

export const dayRecord = (overrides: Partial<DayRecord> = {}): DayRecord => ({
  date: YESTERDAY,
  isWorkDay: true,
  expectedMinutes: 528,
  workedMinutes: 0,
  balanceMinutes: -528,
  incomplete: true,
  hasPending: false,
  periods: [],
  punches: [],
  ...overrides,
});

export const hoursSummary = (overrides: Partial<HoursSummary> = {}): HoursSummary => ({
  start: addDays(TODAY, -6),
  end: TODAY,
  totals: { workedMinutes: 528, expectedMinutes: 1056, balanceMinutes: -528, pendingPunches: 2 },
  weeks: [],
  days: [],
  ...overrides,
});

export const panelMember = (overrides: Partial<PendingPanelMember> = {}): PendingPanelMember => ({
  memberId: 15,
  name: "Ana Souza",
  position: "Atendente",
  situation: "pending",
  isWorkDay: true,
  punches: [],
  ...overrides,
});

export const panelDay = (members: PendingPanelMember[], date: string = YESTERDAY): PendingPanelDay => ({ date, members });
