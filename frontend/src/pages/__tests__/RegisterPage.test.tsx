import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import RegisterPage from "../RegisterPage";
import { AUTH_STORAGE_KEY } from "../../Services/authSession";
import { errorResponse, jsonResponse, mockFetch } from "../../test/fetchMock";
import { TEST_USER, renderRoute } from "../../test/renderWithProviders";

const renderRegister = () => {
  const api = mockFetch([{ method: "GET", url: "/api/companies", response: jsonResponse([]) }]);
  const view = renderRoute(<RegisterPage />, {
    path: "/cadastro",
    extraRoutes: [{ path: "/", element: <p>Tela de ponto</p> }],
  });
  return { api, view };
};

const fill = async (name: string, email: string, password: string) => {
  const user = userEvent.setup();
  if (name) await user.type(screen.getByLabelText("Nome"), name);
  if (email) await user.type(screen.getByLabelText("E-mail"), email);
  if (password) await user.type(screen.getByLabelText("Senha"), password);
  await user.click(screen.getByRole("button", { name: "Criar conta" }));
};

describe("RegisterPage", () => {
  it("não tem violações de acessibilidade e mostra o requisito de senha", async () => {
    const { view } = renderRegister();
    expect(screen.getByRole("heading", { level: 1, name: "Criar conta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription("Mínimo de 8 caracteres.");
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("aponta a senha curta no próprio campo", async () => {
    const { api, view } = renderRegister();

    await fill("Ana Souza", "ana@ex.com", "abc12");

    const password = screen.getByLabelText("Senha");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAccessibleDescription(
      "Mínimo de 8 caracteres. A senha precisa ter pelo menos 8 caracteres.",
    );
    expect(password).toHaveFocus();
    expect(api.requestsTo("/api/auth/register")).toHaveLength(0);
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("e-mail já em uso (409) aparece no campo de e-mail", async () => {
    const { api } = renderRegister();
    api.use({ method: "POST", url: "/api/auth/register", response: errorResponse(409, "Este e-mail já está em uso.") });

    await fill("Ana Souza", "ana@ex.com", "segredo123");

    expect(await screen.findByText("Este e-mail já está em uso.")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveAccessibleDescription("Este e-mail já está em uso.");
  });

  it("cria a conta e já entra no app", async () => {
    const { api } = renderRegister();
    api.use({
      method: "POST",
      url: "/api/auth/register",
      response: jsonResponse(
        { token: "jwt", expiresAt: new Date(Date.now() + 3_600_000).toISOString(), isNewUser: true, user: TEST_USER },
        { status: 201 },
      ),
    });

    await fill("Ana Silva", "ana@ex.com", "segredo123");

    expect(await screen.findByText("Tela de ponto")).toBeInTheDocument();
    expect(await screen.findByText("Conta criada. Bem-vindo ao Pontua.")).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull();
    expect(api.requestsTo("/api/auth/register")[0]?.body).toEqual({
      name: "Ana Silva",
      email: "ana@ex.com",
      password: "segredo123",
    });
  });

  it("tem link para entrar", () => {
    renderRegister();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/entrar");
  });
});
