import type { ReactNode } from "react";
import { Link, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UserRound } from "lucide-react";
import { LOGO_HEIGHT, LOGO_SRC, LOGO_WIDTH } from "../utils/assets";
import { buttonClasses } from "./buttonStyles";
import { OfflineBanner } from "./OfflineBanner";
import { SkipLink } from "./SkipLink";

export interface BareLayoutProps {
  children?: ReactNode;
}

/**
 * Casca do usuário autenticado sem empresa (mockup welcome.html): só a barra superior com a
 * logo e "Minha conta" — a navegação depende da empresa ativa.
 */
export const BareLayout = ({ children }: BareLayoutProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <SkipLink />
      <header className="sticky top-0 z-(--z-nav) flex h-topbar items-center gap-2 border-b border-separator bg-surface pr-2 pl-4 lg:pl-6">
        <Link to="/" className="rounded-control">
          <img src={LOGO_SRC} alt={t("comum:appName")} width={LOGO_WIDTH} height={LOGO_HEIGHT} className="h-7 w-auto" />
        </Link>
        <div className="flex-1" />
        <Link to="/conta" aria-label={t("comum:nav.account")} className={buttonClasses({ variant: "icon" })}>
          <UserRound aria-hidden="true" className="size-6" />
        </Link>
      </header>
      <OfflineBanner />
      <main id="conteudo" tabIndex={-1} className="flex-1 px-4 pt-4 pb-10 lg:px-6 lg:pt-8">
        <div className="mx-auto w-full max-w-form">{children ?? <Outlet />}</div>
      </main>
    </div>
  );
};

export default BareLayout;
