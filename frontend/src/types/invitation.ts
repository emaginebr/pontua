/** Tipos de convite (API › Invitations). */
import type { PositionRef } from "./position";

export type InvitationStatus = "active" | "expired" | "revoked";

/** Convite na visão do responsável. */
export interface InvitationInfo {
  invitationId: number;
  position: PositionRef;
  token: string;
  /** Link pronto para compartilhar */
  url: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedCount: number;
  /** Nome de quem gerou */
  createdBy: string;
  createdAt: string;
}

/** Dados públicos do convite (`GET /api/invitations/{token}`). */
export interface InvitationPublicInfo {
  companyName: string;
  positionName: string;
  status: InvitationStatus;
  expiresAt: string;
}

/** `POST .../invitations` */
export interface InvitationInput {
  positionId: number;
  /** 1–30, padrão 7 */
  expiresInDays?: number;
}
