import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import AccountPage from "../AccountPage";
import { AUTH_STORAGE_KEY } from "../../Services/authSession";
import { punchQueue } from "../../Services/punchQueue";
import { emptyResponse, errorResponse, jsonResponse, mockFetch } from "../../test/fetchMock";
import type { MockRoute } from "../../test/fetchMock";
import { TEST_USER, renderRouteReady, seedSession } from "../../test/renderWithProviders";
import type { UserInfo } from "../../types/auth";

const renderAccount = async (user: Partial<UserInfo> = {}, routes: MockRoute[] = []) => {
  seedSession(user);
  const api = mockFetch([{ method: "GET", url: "/api/companies", response: jsonResponse([]) }, ...routes]);
  // Espera a fila offline e a lista de empresas (sem atualizações fora do act)
  const view = await renderRouteReady(<AccountPage />, {
    path: "/conta",
    extraRoutes: [{ path: "/entrar", element: <p>Tela de entrada</p> }],
  });
  return { api, view };
};

describe("AccountPage", () => {
  it("mostra os dados da conta sem violações de acessibilidade", async () => {
    const { view } = await renderAccount();

    expect(screen.getByRole("heading", { level: 1, name: "Minha conta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Ana Silva");
    // E-mail somente leitura como texto (quebra em vez de cortar — revisão T070, I-19)
    const emailLabel = screen.getByText("E-mail");
    expect(emailLabel.tagName).toBe("DT");
    expect(emailLabel.closest("dl")?.querySelector("dd")).toHaveClass("break-all");
    expect(screen.getByLabelText("Senha atual")).toBeInTheDocument();
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("atualiza o nome", async () => {
    const { api } = await renderAccount();
    api.use({ method: "PUT", url: "/api/auth/me", response: jsonResponse({ ...TEST_USER, name: "Ana Souza" }) });
    const user = userEvent.setup();

    const name = screen.getByLabelText("Nome");
    await user.clear(name);
    await user.type(name, "Ana Souza");
    await user.click(screen.getByRole("button", { name: "Salvar nome" }));

    expect(await screen.findByText("Nome atualizado")).toBeInTheDocument();
    expect(api.requestsTo("/api/auth/me", "PUT")[0]?.body).toEqual({ name: "Ana Souza" });
    const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "{}") as { user?: UserInfo };
    expect(stored.user?.name).toBe("Ana Souza");
  });

  it("exige a senha atual quando a conta já tem senha e confere a confirmação", async () => {
    const { api, view } = await renderAccount();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Nova senha"), "novasenha1");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "outrasenha");
    await user.click(screen.getByRole("button", { name: "Salvar senha" }));

    expect(screen.getByLabelText("Senha atual")).toHaveAccessibleDescription("Informe sua senha atual.");
    expect(screen.getByLabelText("Confirmar nova senha")).toHaveAccessibleDescription("As senhas não conferem.");
    expect(screen.getByLabelText("Senha atual")).toHaveFocus();
    expect(api.requestsTo("/api/auth/me/password")).toHaveLength(0);
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("liga o erro da API à senha atual", async () => {
    const { api } = await renderAccount();
    api.use({
      method: "PUT",
      url: "/api/auth/me/password",
      response: errorResponse(400, "Senha atual incorreta.", [{ campo: "currentPassword", mensagem: "Senha atual incorreta." }]),
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Senha atual"), "errada123");
    await user.type(screen.getByLabelText("Nova senha"), "novasenha1");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "novasenha1");
    await user.click(screen.getByRole("button", { name: "Salvar senha" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Senha atual")).toHaveAccessibleDescription("Senha atual incorreta."),
    );
  });

  it("conta só-Google define a primeira senha sem a senha atual", async () => {
    const { api } = await renderAccount({ hasPassword: false, hasGoogle: true });
    api.use({ method: "PUT", url: "/api/auth/me/password", response: emptyResponse() });
    const user = userEvent.setup();

    expect(screen.getByRole("heading", { name: "Definir senha" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Senha atual")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Nova senha"), "novasenha1");
    await user.type(screen.getByLabelText("Confirmar nova senha"), "novasenha1");
    await user.click(screen.getByRole("button", { name: "Salvar senha" }));

    expect(await screen.findByText("Senha atualizada")).toBeInTheDocument();
    expect(api.requestsTo("/api/auth/me/password")[0]?.body).toEqual({ currentPassword: null, newPassword: "novasenha1" });
  });

  it("sai da conta só depois de confirmar", async () => {
    await renderAccount();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Sair da conta" }));
    const dialog = await screen.findByRole("dialog", { name: "Sair da conta?" });
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    expect(within(dialog).queryByText(/aguardando envio/)).not.toBeInTheDocument();
    expect(await axe(dialog)).toHaveNoViolations();

    await user.click(within(dialog).getByRole("button", { name: "Sair" }));

    expect(await screen.findByText("Tela de entrada")).toBeInTheDocument();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("com marcações aguardando envio, avisa no sair e mantém a fila no aparelho", async () => {
    await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: "2026-11-25T08:02:41-03:00", clientId: "a" });
    await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: "2026-11-25T12:01:00-03:00", clientId: "b" });
    // Servidor indisponível: as marcações continuam aguardando envio
    await renderAccount({}, [
      { method: "POST", url: "/api/companies/3/punches/offline", response: errorResponse(503, "Indisponível") },
    ]);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Sair da conta" }));
    const dialog = await screen.findByRole("dialog", { name: "Sair da conta?" });
    expect(
      within(dialog).getByText(
        "Você tem 2 marcações aguardando envio. Elas serão enviadas no seu próximo acesso neste aparelho.",
      ),
    ).toBeInTheDocument();
    expect(await axe(dialog)).toHaveNoViolations();

    await user.click(within(dialog).getByRole("button", { name: "Sair" }));

    expect(await screen.findByText("Tela de entrada")).toBeInTheDocument();
    expect((await punchQueue.listByUser(7)).map((item) => item.clientId).sort()).toEqual(["a", "b"]);
  });
});
