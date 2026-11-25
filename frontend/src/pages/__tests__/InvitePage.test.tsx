import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import InvitePage from "../InvitePage";
import RegisterPage from "../RegisterPage";
import { PENDING_INVITE_STORAGE_KEY } from "../../Services/authSession";
import { errorResponse, jsonResponse, mockFetch } from "../../test/fetchMock";
import type { MockRoute } from "../../test/fetchMock";
import {
  TEST_USER,
  companyInfo,
  companySummary,
  memberInfo,
  renderRoute,
  seedSession,
} from "../../test/renderWithProviders";
import type { InvitationPublicInfo } from "../../types/invitation";

const TOKEN = "q3Xy_8-abcdefghijklmnopqrstuvwxyz0123456789";

const publicInfo = (overrides: Partial<InvitationPublicInfo> = {}): InvitationPublicInfo => ({
  companyName: "Padaria Sol",
  positionName: "Atendente",
  status: "active",
  expiresAt: "2026-12-02T15:00:00Z",
  ...overrides,
});

const companyRoutes = (list: () => unknown[]): MockRoute[] => [
  { method: "GET", url: "/api/companies", response: () => jsonResponse(list()) },
  { method: "GET", url: "/api/companies/3", response: jsonResponse(companyInfo()) },
  { method: "GET", url: "/api/companies/3/members/me", response: jsonResponse(memberInfo({ isOwner: false })) },
];

const extraRoutes = [
  { path: "/", element: <p>Tela de ponto</p> },
  { path: "/cadastro", element: <p>Tela de cadastro</p> },
  { path: "/entrar", element: <p>Tela de entrada</p> },
];

describe("InvitePage", () => {
  it("sem sessão mostra empresa e cargo, guarda o convite e oferece criar conta ou entrar, sem violações", async () => {
    mockFetch([{ method: "GET", url: `/api/invitations/${TOKEN}`, response: jsonResponse(publicInfo()) }]);
    const view = renderRoute(<InvitePage />, { path: "/convite/:token", initialEntry: `/convite/${TOKEN}`, extraRoutes });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Você foi convidado para Padaria Sol como Atendente" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar conta e aceitar" })).toHaveAttribute("href", "/cadastro");
    expect(screen.getByRole("link", { name: "Entrar e aceitar" })).toHaveAttribute("href", "/entrar");
    await waitFor(() => expect(sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY)).toBe(TOKEN));
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it.each([
    ["expired" as const, "Este convite expirou", /venceu em 02\/12\/2026\. Peça um novo link/],
    ["revoked" as const, "Este convite foi revogado", /não vale mais\. Peça um novo link/],
  ])("convite %s mostra mensagem clara e não fica pendente", async (status, title, text) => {
    sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, TOKEN);
    mockFetch([{ method: "GET", url: `/api/invitations/${TOKEN}`, response: jsonResponse(publicInfo({ status })) }]);
    const view = renderRoute(<InvitePage />, { path: "/convite/:token", initialEntry: `/convite/${TOKEN}`, extraRoutes });

    expect(await screen.findByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Criar conta e aceitar" })).not.toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY)).toBeNull());
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("convite inexistente (404)", async () => {
    mockFetch([{ method: "GET", url: `/api/invitations/${TOKEN}`, response: errorResponse(404, "Convite não encontrado.") }]);
    renderRoute(<InvitePage />, { path: "/convite/:token", initialEntry: `/convite/${TOKEN}`, extraRoutes });

    expect(await screen.findByRole("heading", { level: 1, name: "Convite não encontrado" })).toBeInTheDocument();
  });

  it("depois de criar a conta com convite pendente, aceita sozinho e abre o ponto da empresa", async () => {
    sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, TOKEN);
    let accepted = false;
    const api = mockFetch([
      { method: "GET", url: `/api/invitations/${TOKEN}`, response: jsonResponse(publicInfo()) },
      {
        method: "POST",
        url: "/api/auth/register",
        response: jsonResponse(
          {
            token: "jwt",
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            isNewUser: true,
            user: { ...TEST_USER, name: "João Lima", email: "joao@ex.com" },
          },
          { status: 201 },
        ),
      },
      {
        method: "POST",
        url: `/api/invitations/${TOKEN}/accept`,
        response: () => {
          accepted = true;
          return jsonResponse(companySummary({ isOwner: false, positionName: "Atendente" }));
        },
      },
      ...companyRoutes(() => (accepted ? [companySummary({ isOwner: false })] : [])),
    ]);
    renderRoute(<RegisterPage />, {
      path: "/cadastro",
      extraRoutes: [
        { path: "/convite/:token", element: <InvitePage /> },
        { path: "/", element: <p>Tela de ponto</p> },
      ],
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Nome"), "João Lima");
    await user.type(screen.getByLabelText("E-mail"), "joao@ex.com");
    await user.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(await screen.findByText("Tela de ponto")).toBeInTheDocument();
    expect(api.requestsTo(`/api/invitations/${TOKEN}/accept`, "POST")).toHaveLength(1);
    expect(sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem("pontua:company") ?? "null")).toEqual({ userId: 7, companyId: 3 });
    expect(await screen.findByText("Bem-vindo à Padaria Sol. Você já pode registrar o ponto.")).toBeInTheDocument();
  });

  it("409 (já é membro): informa e abre a empresa do convite", async () => {
    seedSession();
    sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, TOKEN);
    const api = mockFetch([
      { method: "GET", url: `/api/invitations/${TOKEN}`, response: jsonResponse(publicInfo()) },
      {
        method: "POST",
        url: `/api/invitations/${TOKEN}/accept`,
        response: errorResponse(409, "Você já é membro ativo desta empresa."),
      },
      { method: "GET", url: "/api/companies/4", response: jsonResponse(companyInfo({ companyId: 4, name: "Café Lua" })) },
      { method: "GET", url: "/api/companies/4/members/me", response: jsonResponse(memberInfo()) },
      ...companyRoutes(() => [companySummary({ companyId: 4, name: "Café Lua" }), companySummary()]),
    ]);
    localStorage.setItem("pontua:company", JSON.stringify({ userId: 7, companyId: 4 }));
    renderRoute(<InvitePage />, { path: "/convite/:token", initialEntry: `/convite/${TOKEN}`, extraRoutes });

    expect(await screen.findByText("Tela de ponto")).toBeInTheDocument();
    expect(api.requestsTo(`/api/invitations/${TOKEN}/accept`, "POST")).toHaveLength(1);
    expect(await screen.findByText("Você já faz parte de Padaria Sol.")).toBeInTheDocument();
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("pontua:company") ?? "null")).toEqual({ userId: 7, companyId: 3 }),
    );
    expect(sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY)).toBeNull();
  });

  it("com sessão e sem convite pendente, pede confirmação antes de aceitar", async () => {
    seedSession();
    const api = mockFetch([
      { method: "GET", url: `/api/invitations/${TOKEN}`, response: jsonResponse(publicInfo()) },
      {
        method: "POST",
        url: `/api/invitations/${TOKEN}/accept`,
        response: errorResponse(422, "Este convite expirou. Peça um novo link ao responsável pela empresa."),
      },
      ...companyRoutes(() => []),
    ]);
    renderRoute(<InvitePage />, { path: "/convite/:token", initialEntry: `/convite/${TOKEN}`, extraRoutes });

    const button = await screen.findByRole("button", { name: "Aceitar convite" });
    expect(screen.getByText("Você está entrando como ana@ex.com.")).toBeInTheDocument();
    expect(api.requestsTo(`/api/invitations/${TOKEN}/accept`, "POST")).toHaveLength(0);

    // Expirou entre abrir e aceitar: a tela passa a mostrar o estado atual
    api.use({ method: "GET", url: `/api/invitations/${TOKEN}`, response: jsonResponse(publicInfo({ status: "expired" })) });
    await userEvent.setup().click(button);
    expect(await screen.findByRole("heading", { level: 1, name: "Este convite expirou" })).toBeInTheDocument();
  });
});
