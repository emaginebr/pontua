import type { ReactElement, ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { axe } from "vitest-axe";
import { Toaster } from "../components/Toaster";
import { ApprovalProvider } from "../Contexts/ApprovalContext";
import { AuthProvider } from "../Contexts/AuthContext";
import { CompanyProvider } from "../Contexts/CompanyContext";
import { ConnectivityProvider } from "../Contexts/ConnectivityContext";
import { HistoryProvider } from "../Contexts/HistoryContext";
import { InvitationProvider } from "../Contexts/InvitationContext";
import { MemberProvider } from "../Contexts/MemberContext";
import { PositionProvider } from "../Contexts/PositionContext";
import { PunchProvider } from "../Contexts/PunchContext";
import { PunchQueueProvider } from "../Contexts/PunchQueueContext";
import { useAuth } from "../hooks/useAuth";
import { useCompany } from "../hooks/useCompany";
import { usePunchQueue } from "../hooks/usePunchQueue";
import { AUTH_STORAGE_KEY } from "../Services/authSession";
import type { AuthSession, UserInfo } from "../types/auth";
import type { CompanyInfo, CompanySummary } from "../types/company";
import type { MemberInfo } from "../types/member";

type AxeResults = Awaited<ReturnType<typeof axe>>;

/** Usuário padrão dos testes. */
export const TEST_USER: UserInfo = {
  userId: 7,
  name: "Ana Silva",
  email: "ana@ex.com",
  hasPassword: true,
  hasGoogle: false,
};

/** Grava uma sessão válida (ou com a validade informada) em `pontua:auth`. */
export const seedSession = (user: Partial<UserInfo> = {}, expiresAt?: string): AuthSession => {
  const session: AuthSession = {
    token: "token-de-teste",
    expiresAt: expiresAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: { ...TEST_USER, ...user },
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  return session;
};

export const companySummary = (overrides: Partial<CompanySummary> = {}): CompanySummary => ({
  companyId: 3,
  name: "Padaria Sol",
  isOwner: true,
  isManager: false,
  memberId: 12,
  positionName: "Responsável",
  ...overrides,
});

export const companyInfo = (overrides: Partial<CompanyInfo> = {}): CompanyInfo => ({
  companyId: 3,
  name: "Padaria Sol",
  document: null,
  timeZone: "America/Sao_Paulo",
  manualRetroDays: 30,
  owner: { memberId: 12, userId: 7, name: "Ana Silva" },
  myAccess: { memberId: 12, isOwner: true, isManager: false, managedPositionIds: [] },
  createdAt: "2026-11-01T12:00:00Z",
  ...overrides,
});

export const memberInfo = (overrides: Partial<MemberInfo> = {}): MemberInfo => ({
  memberId: 12,
  userId: 7,
  name: "Ana Silva",
  email: "ana@ex.com",
  status: "active",
  isOwner: true,
  isManager: false,
  managedPositionIds: [],
  position: { positionId: 1, name: "Responsável" },
  hasOwnSchedule: false,
  joinedAt: "2026-11-01T12:00:00Z",
  currentSchedule: null,
  ...overrides,
});

/**
 * Marca no DOM quando as cargas iniciais assíncronas terminaram (fila offline lida e primeira
 * tentativa de envio; lista de empresas). Os testes esperam por ela antes de interagir, para que
 * nenhuma atualização de estado aconteça fora do `act` (avisos "not wrapped in act").
 */
const ReadyProbe = () => {
  const { isAuthenticated } = useAuth();
  const { ready } = usePunchQueue();
  const { initialized } = useCompany();
  const done = ready && (!isAuthenticated || initialized);
  return <span hidden data-testid="app-ready" data-ready={done ? "true" : "false"} />;
};

/** Provedores globais do app (mesma ordem de `main.tsx`). */
export const AppProviders = ({ children }: { children: ReactNode }) => (
  <ConnectivityProvider>
    <AuthProvider>
      <CompanyProvider>
        <PunchQueueProvider>
          <PunchProvider>
            <PositionProvider>
              <InvitationProvider>
                <HistoryProvider>
                  <ApprovalProvider>
                    <MemberProvider>
                      {children}
                      <ReadyProbe />
                    </MemberProvider>
                  </ApprovalProvider>
                </HistoryProvider>
              </InvitationProvider>
            </PositionProvider>
          </PunchProvider>
        </PunchQueueProvider>
      </CompanyProvider>
    </AuthProvider>
  </ConnectivityProvider>
);

/** Espera as cargas iniciais dos provedores (ver `ReadyProbe`). */
export const waitForAppReady = async (): Promise<void> => {
  await waitFor(() => expect(screen.getByTestId("app-ready")).toHaveAttribute("data-ready", "true"));
};

/**
 * `axe` dentro do `act`: relógios e toasts que mudam durante a análise (que é lenta) não geram
 * avisos "not wrapped in act".
 */
export const axeInAct = async (container: Element): Promise<AxeResults> => {
  let results: AxeResults | undefined;
  await act(async () => {
    results = await axe(container);
  });
  if (!results) throw new Error("axe não retornou resultados");
  return results;
};

/** Mostra a rota atual (para conferir redirecionamentos). */
export const LocationDisplay = () => {
  const location = useLocation();
  return (
    <span hidden data-testid="location">
      {`${location.pathname}${location.search}`}
    </span>
  );
};

export interface RenderRouteOptions {
  /** Caminho da rota da tela (padrão "/") */
  path?: string;
  /** Entrada inicial do MemoryRouter (caminho ou `{ pathname, search, state }`) */
  initialEntry?: string | { pathname: string; search?: string; state?: unknown };
  /** Rotas extras (destinos de redirecionamento) */
  extraRoutes?: Array<{ path: string; element: ReactElement }>;
}

/** Renderiza uma tela dentro dos provedores, de um `MemoryRouter` e do `Toaster`. */
export const renderRoute = (ui: ReactElement, options: RenderRouteOptions = {}): RenderResult => {
  const path = options.path ?? "/";
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[options.initialEntry ?? path]}>
        <Routes>
          <Route path={path} element={ui} />
          {(options.extraRoutes ?? []).map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
        <LocationDisplay />
        <Toaster />
      </MemoryRouter>
    </AppProviders>,
  );
};

/** `renderRoute` + espera as cargas iniciais dos provedores (sem avisos de `act`). */
export const renderRouteReady = async (ui: ReactElement, options: RenderRouteOptions = {}): Promise<RenderResult> => {
  const view = renderRoute(ui, options);
  await waitForAppReady();
  return view;
};
