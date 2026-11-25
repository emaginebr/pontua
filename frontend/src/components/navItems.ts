import { Building2, ClipboardCheck, Clock, History } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Destino da navegação principal (research R-10, contracts/ui-routes.md). */
export interface NavItem {
  key: "clock" | "history" | "approvals" | "company";
  to: string;
  icon: LucideIcon;
  /** Só para responsável/gestor */
  supervisorsOnly: boolean;
  /** Ativo só na rota exata */
  end: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "clock", to: "/", icon: Clock, supervisorsOnly: false, end: true },
  { key: "history", to: "/historico", icon: History, supervisorsOnly: false, end: false },
  { key: "approvals", to: "/aprovacoes", icon: ClipboardCheck, supervisorsOnly: true, end: false },
  { key: "company", to: "/empresa", icon: Building2, supervisorsOnly: false, end: false },
];

/** Destinos visíveis para o papel (membro comum vê 3). */
export const visibleNavItems = (canSupervise: boolean): NavItem[] =>
  NAV_ITEMS.filter((item) => !item.supervisorsOnly || canSupervise);

/** Texto do contador (99+ acima de 99). */
export const formatCounter = (count: number): string => (count > 99 ? "99+" : String(count));
