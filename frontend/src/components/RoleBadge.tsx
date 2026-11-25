import { useTranslation } from "react-i18next";
import { Ban, Crown, ShieldCheck, UserRound } from "lucide-react";
import type { MemberInfo } from "../types/member";
import { cn } from "../utils/cn";

const BADGE = "inline-flex h-6 items-center gap-1 rounded-sm px-2 text-caption font-semibold whitespace-nowrap";

/**
 * Papel com texto + ícone, nunca só ícone (components.md §11): Responsável, Gestor, Membro e
 * Inativo.
 */
export const RoleBadges = ({ member, className }: { member: Pick<MemberInfo, "isOwner" | "isManager" | "status">; className?: string }) => {
  const { t } = useTranslation();
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {member.isOwner ? (
        <span className={cn(BADGE, "bg-primary-soft text-primary")}>
          <Crown aria-hidden="true" className="size-3.5" />
          {t("comum:roles.owner")}
        </span>
      ) : member.isManager ? (
        <span className={cn(BADGE, "bg-success-soft text-success")}>
          <ShieldCheck aria-hidden="true" className="size-3.5" />
          {t("comum:roles.manager")}
        </span>
      ) : (
        <span className={cn(BADGE, "bg-neutral-soft text-neutral")}>
          <UserRound aria-hidden="true" className="size-3.5" />
          {t("comum:roles.member")}
        </span>
      )}
      {member.status === "inactive" && (
        <span className={cn(BADGE, "bg-neutral-soft text-neutral")}>
          <Ban aria-hidden="true" className="size-3.5" />
          {t("membros:inactive")}
        </span>
      )}
    </span>
  );
};

export default RoleBadges;
