import { useEffect } from "react";
import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";
import { useCompany } from "../hooks/useCompany";
import { useRole } from "../hooks/useRole";
import { AppShell } from "./AppShell";
import { BareLayout } from "./BareLayout";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";
import { SkipLink } from "./SkipLink";

/** Sem sessão → `/entrar`, levando a rota pedida em `state.from` (FR-008). */
export const RequireAuth = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/entrar" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
};

/** Tela cheia enquanto a lista de empresas carrega (ou falha sem dados). */
const CompanyGate = ({ children }: { children: ReactNode }) => (
  <div className="min-h-dvh bg-bg">
    <SkipLink />
    <main id="conteudo" tabIndex={-1} className="mx-auto max-w-form px-4 pt-10">
      {children}
    </main>
  </div>
);

/** Primeira carga das empresas: carregando ou erro com "Tentar de novo". */
const useCompanyGate = (): ReactNode | null => {
  const { t } = useTranslation();
  const { initialized, loading, error, activeCompany, refresh } = useCompany();
  if (!initialized) {
    return (
      <CompanyGate>
        <h1 className="sr-only">{t("comum:appName")}</h1>
        <LoadingState />
      </CompanyGate>
    );
  }
  if (error && !activeCompany) {
    return (
      <CompanyGate>
        <h1 className="sr-only">{t("comum:appName")}</h1>
        <ErrorState message={error} onRetry={() => void refresh()} retrying={loading} />
      </CompanyGate>
    );
  }
  return null;
};

/** Sem empresa ativa → `/bem-vindo`; com empresa, renderiza a casca do app. */
export const RequireCompany = () => {
  const { activeCompany } = useCompany();
  const gate = useCompanyGate();
  if (gate) return gate;
  if (!activeCompany) return <Navigate to="/bem-vindo" replace />;
  return <AppShell />;
};

/** `/conta` e telas sem empresa: casca do app quando há empresa, casca simples quando não há. */
export const AccountLayout = () => {
  const { activeCompany } = useCompany();
  const gate = useCompanyGate();
  if (gate) return gate;
  return activeCompany ? <AppShell /> : <BareLayout />;
};

/** Telas sem empresa (`/bem-vindo`, `/empresas/nova`): sempre a casca simples. */
export const NoCompanyLayout = () => {
  const gate = useCompanyGate();
  if (gate) return gate;
  return <BareLayout />;
};

/** Aviso único (id fixo evita duplicar no StrictMode) e volta para o ponto. */
const AccessDenied = () => {
  const { t } = useTranslation();
  useEffect(() => {
    toast.warning(t("comum:noAccess"), { id: "sem-acesso" });
  }, [t]);
  return <Navigate to="/" replace />;
};

export interface RequireRoleProps {
  /** `owner` = só responsável · `supervisor` = responsável ou gestor */
  role: "owner" | "supervisor";
}

/** Rota sem permissão → `/` com toast "Você não tem acesso a esta área." */
export const RequireRole = ({ role }: RequireRoleProps) => {
  const { isOwner, canSupervise } = useRole();
  const allowed = role === "owner" ? isOwner : canSupervise;
  return allowed ? <Outlet /> : <AccessDenied />;
};
