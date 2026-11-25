/** Tipos de marcação de ponto (API › Punches). */

export type PunchKind = "normal" | "manual" | "offline";

export type PunchStatus = "valid" | "pending" | "approved" | "rejected" | "cancelled" | "superseded";

export type PendingReason = "manual" | "outsideWorkday" | "offline";

/** Quem analisou a marcação, quando e com qual observação. */
export interface ReviewInfo {
  by: string;
  at: string;
  note: string | null;
}

/** Linha do histórico de status. */
export interface PunchStatusChangeInfo {
  /** Nulo na criação */
  fromStatus: PunchStatus | null;
  toStatus: PunchStatus;
  changedBy: string;
  changedAt: string;
  note: string | null;
}

/** Marcação de ponto. */
export interface PunchInfo {
  punchId: number;
  /** Número sequencial do registro */
  nsr: number;
  memberId: number;
  kind: PunchKind;
  /** Instante (ISO UTC) */
  punchedAt: string;
  /** Dia local na empresa `yyyy-MM-dd` */
  workDate: string;
  /** Horário local na empresa `HH:mm` */
  localTime: string;
  receivedAt: string;
  status: PunchStatus;
  pendingReason: PendingReason | null;
  justification: string | null;
  replacesPunchId: number | null;
  /** Período calculado; nulo = extra ou não efetiva */
  periodName: string | null;
  countsAsWorked: boolean;
  review: ReviewInfo | null;
  /** Só no detalhe */
  statusHistory?: PunchStatusChangeInfo[];
}

/** Período previsto do dia com a marcação efetiva associada. */
export interface DayPeriodInfo {
  sequence: number;
  name: string;
  /** `HH:mm` ou `null` */
  expectedTime: string | null;
  punchId: number | null;
}

/** Histórico de um dia (dias sem marcação também aparecem). */
export interface DayRecord {
  /** `yyyy-MM-dd` */
  date: string;
  isWorkDay: boolean;
  expectedMinutes: number;
  workedMinutes: number;
  balanceMinutes: number;
  incomplete: boolean;
  hasPending: boolean;
  periods: DayPeriodInfo[];
  /** Todas as marcações do dia, ordenadas por horário */
  punches: PunchInfo[];
}

/** `POST .../punches/manual` */
export interface ManualPunchInput {
  /** `yyyy-MM-dd` */
  workDate: string;
  /** `HH:mm` */
  time: string;
  /** 5–500 caracteres */
  justification: string;
  replacesPunchId?: number | null;
}

/** Marcação feita sem conexão. */
export interface OfflinePunchItem {
  /** uuid gerado no aparelho */
  clientId: string;
  /** ISO-8601 com offset do aparelho */
  punchedAt: string;
}

/** `POST .../punches/offline` (1–50 itens) */
export interface OfflinePunchBatch {
  items: OfflinePunchItem[];
}

export type OfflineSyncItemResultCode = "created" | "duplicate" | "future" | "too_old";

/** Resultado de um item do lote offline. */
export interface OfflineSyncItemResult {
  clientId: string;
  result: OfflineSyncItemResultCode;
  /** Nula nas recusas */
  punch: PunchInfo | null;
}

/** Resultado da sincronização offline, na ordem do lote. */
export interface OfflineSyncResult {
  items: OfflineSyncItemResult[];
}

// ---------------------------------------------------------------------------
// Fila local de marcações offline (data-model.md §3 — IndexedDB `pontua-queue`)
// ---------------------------------------------------------------------------

/** Estado de envio de uma marcação guardada no aparelho. */
export type QueueState = "waiting" | "sending" | "rejected";

/** Motivo da recusa pelo servidor. */
export type QueueRejectReason = "future" | "too_old";

/** Marcação feita sem conexão, guardada até chegar ao servidor. */
export interface QueuedPunch {
  /** uuid v4 gerado no aparelho; reenvios usam o mesmo (idempotência no servidor) */
  clientId: string;
  /** Dono da marcação */
  userId: number;
  /** Empresa em que a marcação foi feita (troca de empresa não muda o destino) */
  companyId: number;
  /** Relógio do aparelho, ISO-8601 com offset */
  punchedAt: string;
  /** Quando entrou na fila (ISO), para ordenação */
  createdAt: string;
  state: QueueState;
  /** Preenchido quando recusada */
  rejectReason: QueueRejectReason | null;
  /** Quando passou a `sending` (ISO); itens travados há mais de 1 min voltam a `waiting` */
  sendingAt: string | null;
}
