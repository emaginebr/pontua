import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanyPage from "../CompanyPage";
import CompanySettingsPage from "../CompanySettingsPage";
import { jsonResponse, mockFetch } from "../../test/fetchMock";
import type { MockRoute } from "../../test/fetchMock";
import {
  axeInAct,
  companyInfo,
  companySummary,
  memberInfo,
  renderRouteReady,
  seedSession,
} from "../../test/renderWithProviders";

const carla = memberInfo({
  memberId: 20,
  userId: 30,
  name: "Carla Mendes",
  email: "carla@ex.com",
  isOwner: false,
  position: { positionId: 4, name: "Atendente" },
});

const setup = async (routes: MockRoute[] = []) => {
  seedSession();
  let transferred = false;
  const api = mockFetch([
    ...routes,
    {
      method: "POST",
      url: "/api/companies/3/transfer-ownership",
      response: () => {
        transferred = true;
        return jsonResponse(
          companyInfo({
            owner: { memberId: 20, userId: 30, name: "Carla Mendes" },
            myAccess: { memberId: 12, isOwner: false, isManager: false, managedPositionIds: [] },
          }),
        );
      },
    },
    {
      method: "GET",
      url: "/api/companies",
      response: () => jsonResponse([companySummary({ isOwner: !transferred })]),
    },
    {
      method: "GET",
      url: "/api/companies/3",
      response: () =>
        jsonResponse(
          transferred
            ? companyInfo({
                owner: { memberId: 20, userId: 30, name: "Carla Mendes" },
                myAccess: { memberId: 12, isOwner: false, isManager: false, managedPositionIds: [] },
              })
            : companyInfo(),
        ),
    },
    { method: "GET", url: "/api/companies/3/members/me", response: () => jsonResponse(memberInfo({ isOwner: !transferred })) },
    { method: "GET", url: "/api/companies/3/members", response: jsonResponse([memberInfo(), carla]) },
  ]);
  const view = await renderRouteReady(<CompanySettingsPage />, {
    path: "/empresa/configuracoes",
    initialEntry: "/empresa/configuracoes",
    extraRoutes: [{ path: "/empresa", element: <CompanyPage /> }],
  });
  await screen.findByRole("option", { name: "Carla Mendes — Atendente" });
  return { api, view, user: userEvent.setup() };
};

describe("CompanySettingsPage", () => {
  it("edita os dados e o limite de dias da marcação manual, sem violações", async () => {
    const { api, view, user } = await setup([
      {
        method: "PUT",
        url: "/api/companies/3",
        response: jsonResponse(companyInfo({ name: "Padaria Sol Nascente", manualRetroDays: 15 })),
      },
    ]);
    expect(await axeInAct(view.container)).toHaveNoViolations();

    const retro = screen.getByLabelText("Limite para marcação manual (dias)");
    await user.clear(retro);
    await user.type(retro, "0");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(retro).toHaveAccessibleDescription(expect.stringContaining("Informe um número de 1 a 365 dias.") as string);
    expect(api.requestsTo("/api/companies/3", "PUT")).toHaveLength(0);

    await user.clear(retro);
    await user.type(retro, "15");
    const name = screen.getByLabelText("Nome da empresa");
    await user.clear(name);
    await user.type(name, "Padaria Sol Nascente");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Configurações salvas")).toBeInTheDocument();
    expect(api.requestsTo("/api/companies/3", "PUT")[0]?.body).toEqual({
      name: "Padaria Sol Nascente",
      document: null,
      timeZone: "America/Sao_Paulo",
      manualRetroDays: 15,
    });
  });

  it("transferência pede o nome do novo responsável e remove o acesso às configurações", async () => {
    const { api, user } = await setup();

    // Sem escolher o membro, explica no campo
    await user.click(screen.getByRole("button", { name: "Transferir responsabilidade" }));
    expect(screen.getByLabelText("Novo responsável")).toHaveAccessibleDescription("Escolha quem vai receber a responsabilidade.");

    // O próprio responsável não aparece como opção
    expect(screen.queryByRole("option", { name: /Ana Silva/ })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Novo responsável"), "20");
    await user.click(screen.getByRole("button", { name: "Transferir responsabilidade" }));

    const dialog = await screen.findByRole("dialog", { name: "Transferir a responsabilidade para Carla Mendes?" });
    expect(within(dialog).getByText(/Você perde o acesso a cargos, convites, membros e configurações/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    const confirm = within(dialog).getByRole("button", { name: "Transferir" });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Digite Carla Mendes para confirmar"), "carla mendes");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(/^\/empresa$/));
    expect(api.requestsTo("/api/companies/3/transfer-ownership", "POST")[0]?.body).toEqual({ memberId: 20 });
    expect(await screen.findByText("Responsabilidade transferida para Carla Mendes")).toBeInTheDocument();
    // Depois do refresh, o antigo responsável não vê mais os atalhos de configuração
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Configurar" })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Membro")).toBeInTheDocument());
    expect(api.requestsTo("/api/companies", "GET").length).toBeGreaterThan(1);
  });
});
