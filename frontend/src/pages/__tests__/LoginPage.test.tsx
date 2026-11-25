import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import LoginPage from "../LoginPage";
import { AUTH_STORAGE_KEY, PENDING_INVITE_STORAGE_KEY, RETURN_TO_STORAGE_KEY } from "../../Services/authSession";
import { errorResponse, jsonResponse, mockFetch } from "../../test/fetchMock";
import { TEST_USER, renderRoute } from "../../test/renderWithProviders";

const authResult = () => ({
  token: "jwt",
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  isNewUser: false,
  user: TEST_USER,
});

const DESTINATIONS = [
  { path: "/", element: <p>Tela de ponto</p> },
  { path: "/historico", element: <p>Tela de histórico</p> },
  { path: "/convite/:token", element: <p>Tela do convite</p> },
];

const renderLogin = (state?: { from: string }) => {
  // Sem empresas: a carga da empresa após o login não interfere nos testes
  const api = mockFetch([{ method: "GET", url: "/api/companies", response: jsonResponse([]) }]);
  const view = renderRoute(<LoginPage />, {
    path: "/entrar",
    initialEntry: { pathname: "/entrar", state },
    extraRoutes: DESTINATIONS,
  });
  return { api, view };
};

const fillAndSubmit = async (email: string, password: string) => {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText("E-mail"), email);
  if (password) await user.type(screen.getByLabelText("Senha"), password);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
};

describe("LoginPage", () => {
  it("não tem violações de acessibilidade", async () => {
    const { view } = renderLogin();
    expect(screen.getByRole("heading", { level: 1, name: "Entrar" })).toBeInTheDocument();
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("mostra o erro ao lado de cada campo e foca o primeiro", async () => {
    const { api, view } = renderLogin();

    await fillAndSubmit("", "");

    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Informe seu e-mail.");
    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription("Informe sua senha.");
    expect(email).toHaveFocus();
    expect(screen.getByText("Corrija 2 campos para continuar.")).toBeInTheDocument();
    expect(api.requestsTo("/api/auth/login")).toHaveLength(0);
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("valida o formato do e-mail", async () => {
    renderLogin();
    await fillAndSubmit("ana@padariasol", "segredo123");
    expect(screen.getByLabelText("E-mail")).toHaveAccessibleDescription("Informe um e-mail válido.");
  });

  it("liga os erros por campo da API aos campos", async () => {
    const { api } = renderLogin();
    api.use({
      method: "POST",
      url: "/api/auth/login",
      response: errorResponse(400, "Dados inválidos.", [{ campo: "Email", mensagem: "E-mail não aceito." }]),
    });

    await fillAndSubmit("ana@ex.com", "segredo123");

    await waitFor(() => expect(screen.getByLabelText("E-mail")).toHaveAccessibleDescription("E-mail não aceito."));
  });

  it("mostra a mensagem da API quando não há campo (401)", async () => {
    const { api } = renderLogin();
    api.use({ method: "POST", url: "/api/auth/login", response: errorResponse(401, "E-mail ou senha inválidos.") });

    await fillAndSubmit("ana@ex.com", "errada123");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("E-mail ou senha inválidos.");
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("depois de entrar volta para a rota pedida (returnTo)", async () => {
    const { api } = renderLogin({ from: "/historico" });
    api.use({ method: "POST", url: "/api/auth/login", response: jsonResponse(authResult()) });

    await fillAndSubmit("ana@ex.com", "segredo123");

    expect(await screen.findByText("Tela de histórico")).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull();
    expect(api.requestsTo("/api/auth/login")[0]?.body).toEqual({ email: "ana@ex.com", password: "segredo123" });
  });

  it("usa o returnTo guardado quando a sessão expirou", async () => {
    sessionStorage.setItem(RETURN_TO_STORAGE_KEY, "/historico?month=2026-10");
    const { api } = renderLogin();
    api.use({ method: "POST", url: "/api/auth/login", response: jsonResponse(authResult()) });

    await fillAndSubmit("ana@ex.com", "segredo123");

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/historico?month=2026-10"));
    expect(sessionStorage.getItem(RETURN_TO_STORAGE_KEY)).toBeNull();
  });

  it("com convite pendente, abre o convite depois de entrar", async () => {
    sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, "q3abcdefghijklmnopqrstu");
    const { api } = renderLogin({ from: "/historico" });
    api.use({ method: "POST", url: "/api/auth/login", response: jsonResponse(authResult()) });

    await fillAndSubmit("ana@ex.com", "segredo123");

    expect(await screen.findByText("Tela do convite")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/convite/q3abcdefghijklmnopqrstu");
  });

  it("tem link para criar conta", () => {
    renderLogin();
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/cadastro");
  });
});
