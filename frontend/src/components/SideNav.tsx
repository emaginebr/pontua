import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UserRound } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useRole } from "../hooks/useRole";
import { LOGO_HEIGHT, LOGO_SRC, LOGO_WIDTH } from "../utils/assets";
import { cn } from "../utils/cn";
import { CompanySwitcher } from "./CompanySwitcher";
import { InstallAppButton } from "./InstallAppButton";
import { visibleNavItems } from "./navItems";
import { PendingCounter } from "./PendingCounter";

export interface SideNavProps {
  pendingCount?: number;
  className?: string;
}

/**
 * Menu lateral (≥ 1024 px, components.md §1.1): logo → seletor de empresa → destinos →
 * "Instalar app" → "Minha conta" com nome e e-mail.
 */
export const SideNav = ({ pendingCount = 0, className }: SideNavProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { canSupervise } = useRole();
  const items = visibleNavItems(canSupervise);

  return (
    // Toda a coluna é o landmark de navegação (logo, empresa, destinos e conta)
    <nav
      aria-label={t("comum:nav.sideLabel")}
      className={cn(
        "sticky top-0 h-dvh w-sidebar shrink-0 flex-col gap-2 border-r border-separator bg-surface px-3 pt-5 pb-4",
        className,
      )}
    >
      <Link to="/" className="mx-2 mb-3 self-start rounded-control">
        <img src={LOGO_SRC} alt={t("comum:appName")} width={LOGO_WIDTH} height={LOGO_HEIGHT} className="h-9 w-auto" />
      </Link>
      <CompanySwitcher className="mb-2 border border-separator" />
      <div>
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const showCount = item.key === "approvals" && pendingCount > 0;
            return (
              <li key={item.key}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "relative flex min-h-control items-center gap-3 rounded-control px-3 text-[0.9375rem]",
                      isActive
                        ? "bg-primary-soft font-bold text-primary before:absolute before:-left-3 before:top-2.5 before:bottom-2.5 before:w-[3px] before:rounded-r-sm before:bg-primary"
                        : "font-semibold text-muted hover:bg-surface-2",
                    )
                  }
                >
                  <Icon aria-hidden="true" className="size-5" />
                  {/* I-06: nome = rótulo visível + total em `sr-only` (a pílula é `aria-hidden`) */}
                  <span className="flex-1">
                    {t(`comum:nav.${item.key}`)}
                    {showCount && (
                      <span className="sr-only">{t("comum:nav.pendingSuffix", { count: pendingCount })}</span>
                    )}
                  </span>
                  {showCount && <PendingCounter count={pendingCount} />}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex-1" />
      <InstallAppButton variant="nav" />
      <NavLink
        to="/conta"
        className={({ isActive }) =>
          cn(
            "flex min-h-14 items-center gap-2.5 rounded-control border-t border-separator p-2 text-text",
            isActive ? "bg-primary-soft" : "hover:bg-surface-2",
          )
        }
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <UserRound aria-hidden="true" className="size-5" />
        </span>
        {/* Nome + e-mail inteiro, em até 2 linhas, sem reticências (components.md §1.1, A-19) */}
        <span className="flex min-w-0 flex-col">
          <span className="text-body-sm font-semibold break-words">{user?.name ?? t("comum:nav.account")}</span>
          {user && <span className="line-clamp-2 text-caption break-all text-muted">{user.email}</span>}
        </span>
      </NavLink>
    </nav>
  );
};

export default SideNav;
