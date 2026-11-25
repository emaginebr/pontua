/** Tipos do painel de aprovações (API › Approvals). */
import type { PunchInfo } from "./punch";

/** `missing` = dia útil sem marcação efetiva; `pending` = alguma marcação pendente. */
export type PanelSituation = "missing" | "pending";

/** Filtro de situação do painel. */
export type PanelType = PanelSituation | "all";

/** Membro num dia do painel. */
export interface PendingPanelMember {
  memberId: number;
  name: string;
  /** Nome do cargo vigente no dia */
  position: string | null;
  situation: PanelSituation;
  isWorkDay: boolean;
  /** Todas as marcações do dia */
  punches: PunchInfo[];
}

/** Dia do painel (dias decrescentes; membros por nome). */
export interface PendingPanelDay {
  /** `yyyy-MM-dd` */
  date: string;
  members: PendingPanelMember[];
}

/** `POST .../punches/{id}/approve|reject` */
export interface ReviewInput {
  note?: string | null;
}
