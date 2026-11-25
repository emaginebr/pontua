import { Suspense, lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import type { RouteObject } from "react-router-dom";
import { LoadingState } from "./components/LoadingState";
import { AccountLayout, NoCompanyLayout, RequireAuth, RequireCompany, RequireRole } from "./components/RouteGuards";
// Chunk inicial: tela de ponto (uso diário, precisa abrir na hora) e telas de entrada
import ClockPage from "./pages/ClockPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import WelcomePage from "./pages/WelcomePage";

/** Marca da sessão para recarregar só uma vez quando um chunk sumir (deploy novo). */
const CHUNK_RELOAD_KEY = "pontua:chunk-reload";

/**
 * `React.lazy` com uma recarga única se o chunk não existir mais (versão nova publicada com a
 * aba aberta). Na segunda falha o erro segue para o React.
 */
const lazyPage = (load: () => Promise<{ default: ComponentType }>): LazyExoticComponent<ComponentType> =>
  lazy(async () => {
    try {
      const module = await load();
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return module;
    } catch (error) {
      if (typeof window !== "undefined" && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
        window.location.reload();
        // Mantém o Suspense em espera até a recarga
        return new Promise<never>(() => undefined);
      }
      throw error;
    }
  });

// Demais páginas: um chunk por tela, baixado na primeira visita (e pré-cacheado pelo SW)
const AccountPage = lazyPage(() => import("./pages/AccountPage"));
const ApprovalsPage = lazyPage(() => import("./pages/ApprovalsPage"));
const CompanyPage = lazyPage(() => import("./pages/CompanyPage"));
const CompanySettingsPage = lazyPage(() => import("./pages/CompanySettingsPage"));
const HistoryPage = lazyPage(() => import("./pages/HistoryPage"));
const InvitationsPage = lazyPage(() => import("./pages/InvitationsPage"));
const InvitePage = lazyPage(() => import("./pages/InvitePage"));
const MemberDetailPage = lazyPage(() => import("./pages/MemberDetailPage"));
const MembersPage = lazyPage(() => import("./pages/MembersPage"));
const NewCompanyPage = lazyPage(() => import("./pages/NewCompanyPage"));
const NotFoundPage = lazyPage(() => import("./pages/NotFoundPage"));
const PositionEditorPage = lazyPage(() => import("./pages/PositionEditorPage"));
const PositionsPage = lazyPage(() => import("./pages/PositionsPage"));
const PunchDetailPage = lazyPage(() => import("./pages/PunchDetailPage"));

/** Página carregada sob demanda; a casca (menu, barras) continua visível enquanto baixa. */
const page = (Page: LazyExoticComponent<ComponentType>) => (
  <Suspense fallback={<LoadingState lines={4} />}>
    <Page />
  </Suspense>
);

/** Rotas do app (contracts/ui-routes.md). */
export const routes: RouteObject[] = [
  // Públicas
  { path: "/entrar", element: <LoginPage /> },
  { path: "/cadastro", element: <RegisterPage /> },
  { path: "/convite/:token", element: page(InvitePage) },

  {
    element: <RequireAuth />,
    children: [
      // Autenticadas sem empresa
      {
        element: <NoCompanyLayout />,
        children: [
          { path: "/bem-vindo", element: <WelcomePage /> },
          { path: "/empresas/nova", element: page(NewCompanyPage) },
        ],
      },
      { element: <AccountLayout />, children: [{ path: "/conta", element: page(AccountPage) }] },

      // Autenticadas com empresa ativa
      {
        element: <RequireCompany />,
        children: [
          { path: "/", element: <ClockPage /> },
          { path: "/historico", element: page(HistoryPage) },
          // Autor, gestor do cargo ou responsável (a API devolve 404/403 para os demais)
          { path: "/historico/marcacao/:punchId", element: page(PunchDetailPage) },
          { path: "/empresa", element: page(CompanyPage) },
          {
            element: <RequireRole role="supervisor" />,
            children: [
              { path: "/aprovacoes", element: page(ApprovalsPage) },
              { path: "/empresa/membros", element: page(MembersPage) },
              { path: "/empresa/membros/:memberId", element: page(MemberDetailPage) },
            ],
          },
          {
            element: <RequireRole role="owner" />,
            children: [
              { path: "/empresa/cargos", element: page(PositionsPage) },
              { path: "/empresa/cargos/novo", element: page(PositionEditorPage) },
              { path: "/empresa/cargos/:positionId", element: page(PositionEditorPage) },
              { path: "/empresa/convites", element: page(InvitationsPage) },
              { path: "/empresa/configuracoes", element: page(CompanySettingsPage) },
            ],
          },
        ],
      },
    ],
  },

  { path: "*", element: page(NotFoundPage) },
];

export default routes;
