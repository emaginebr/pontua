import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useRole } from "../hooks/useRole";
import { cn } from "../utils/cn";
import { visibleNavItems } from "./navItems";
import { PendingCounter } from "./PendingCounter";

export interface BottomNavProps {
  /** Pendências a aprovar (só aparece para quem pode aprovar) */
  pendingCount?: number;
  className?: string;
}

/** Barra inferior (< 1024 px, components.md §1.1): até 4 destinos, 64 px + safe-area. */
export const BottomNav = ({ pendingCount = 0, className }: BottomNavProps) => {
  const { t } = useTranslation();
  const { canSupervise } = useRole();
  const items = visibleNavItems(canSupervise);

  return (
    <nav
      aria-label={t("comum:nav.bottomLabel")}
      className={cn(
        "fixed inset-x-0 bottom-0 z-(--z-nav) bg-surface shadow-nav pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <ul className="flex h-tabbar">
        {items.map((item) => {
          const Icon = item.icon;
          const showCount = item.key === "approvals" && pendingCount > 0;
          return (
            <li key={item.key} className="flex flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-touch flex-1 flex-col items-center justify-center gap-0.5 text-caption",
                    isActive ? "font-bold text-primary" : "font-semibold text-muted",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        "relative grid h-8 w-14 place-items-center rounded-full",
                        isActive && "bg-primary-soft",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-6" strokeWidth={isActive ? 2.25 : 2} />
                      {showCount && <PendingCounter count={pendingCount} className="absolute -right-0.5 -top-1" />}
                    </span>
                    {/* I-06: sem `aria-label` — o nome é o rótulo visível + o total em `sr-only`
                        DEPOIS dele ("Aprovações, 2 pendências"); o número da pílula é `aria-hidden` */}
                    <span>
                      {t(`comum:nav.${item.key}`)}
                      {showCount && (
                        <span className="sr-only">{t("comum:nav.pendingSuffix", { count: pendingCount })}</span>
                      )}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default BottomNav;
