import type { ReactNode } from "react";
import { Link, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UserRound } from "lucide-react";
import { usePendingCount } from "../hooks/usePendingCount";
import { LOGO_SYMBOL_SRC } from "../utils/assets";
import { BottomNav } from "./BottomNav";
import { buttonClasses } from "./buttonStyles";
import { CompanySwitcher } from "./CompanySwitcher";
import { OfflineBanner } from "./OfflineBanner";
import { SideNav } from "./SideNav";
import { SkipLink } from "./SkipLink";

export interface AppShellProps {
  /** Pendências a aprovar; padrão: contador do `ApprovalContext` (últimos 31 dias) */
  pendingCount?: number;
  /** Faixas extras no topo do conteúdo (ex.: indicador da fila offline) */
  banners?: ReactNode;
  /** Conteúdo; sem ele renderiza a rota filha (`<Outlet />`) */
  children?: ReactNode;
}

/**
 * Casca das rotas com empresa ativa (components.md §1.1, research R-10): barra superior +
 * barra inferior abaixo de 1024 px; menu lateral fixo a partir de 1024 px. O aviso de nova
 * versão (`UpdatePrompt`) é global, em `App.tsx`.
 */
export const AppShell = ({ pendingCount: pendingOverride, banners, children }: AppShellProps) => {
  const { t } = useTranslation();
  // Contador de pendências (US6, FR-023): só para quem pode aprovar
  const livePending = usePendingCount();
  const pendingCount = pendingOverride ?? livePending;

  return (
    <div className="min-h-dvh bg-bg lg:flex">
      <SkipLink />
      <SideNav pendingCount={pendingCount} className="hidden lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-(--z-nav) flex h-topbar items-center gap-1 border-b border-separator bg-surface pr-2 pl-1.5 lg:hidden">
          {/* Alvo de 44 px com o símbolo em 28 px (A-04) */}
          <Link to="/" className="grid min-h-touch min-w-touch shrink-0 place-items-center rounded-control">
            <img src={LOGO_SYMBOL_SRC} alt={t("comum:appName")} width={28} height={28} className="size-7 object-contain" />
          </Link>
          <CompanySwitcher className="flex-1" />
          <Link
            to="/conta"
            aria-label={t("comum:nav.account")}
            className={buttonClasses({ variant: "icon" })}
          >
            <UserRound aria-hidden="true" className="size-6" />
          </Link>
        </header>
        <OfflineBanner />
        {banners}
        <main
          id="conteudo"
          tabIndex={-1}
          className="flex-1 px-4 pt-4 pb-[calc(var(--pt-tabbar-h)+env(safe-area-inset-bottom)+24px)] lg:px-6 lg:pt-6 lg:pb-10"
        >
          <div className="mx-auto w-full max-w-content">{children ?? <Outlet />}</div>
        </main>
        <BottomNav pendingCount={pendingCount} className="lg:hidden" />
      </div>
    </div>
  );
};

export default AppShell;
