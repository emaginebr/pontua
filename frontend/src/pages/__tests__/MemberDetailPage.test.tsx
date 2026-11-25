import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MemberDetailPage from "../MemberDetailPage";
import { emptyResponse, errorResponse, jsonResponse, mockFetch } from "../../test/fetchMock";
import type { MockRoute } from "../../test/fetchMock";
import { TODAY, dayRecord, hoursSummary, punch } from "../../test/fixtures";
import {
  axeInAct,
  companyInfo,
  companySummary,
  memberInfo,
  renderRouteReady,
  seedSession,
} from "../../test/renderWithProviders";
import type { MemberInfo } from "../../types/member";

const joao = (overrides: Partial<MemberInfo> = {}): MemberInfo =>
  memberInfo({
    memberId: 15,
    userId: 22,
    name: "João Lima",
    email: "joao@ex.com",
    isOwner: false,
    position: { positionId: 4, name: "Atendente" },
    joinedAt: "2026-11-03T12:00:00Z",
    positionHistory: [{ positionId: 4, name: "Atendente", effectiveFrom: "2026-11-03" }],
    scheduleHistory: [],
    ...overrides,
  });

const setup = async (member: MemberInfo = joao(), routes: MockRoute[] = []) => {
  seedSession();
  const api = mockFetch([
    ...routes,
    { method: "GET", url: "/api/companies", response: jsonResponse([companySummary()]) },
    { method: "GET", url: "/api/companies/3", response: jsonResponse(companyInfo()) },
    { method: "GET", url: "/api/companies/3/members/me", response: jsonResponse(memberInfo()) },
    { method: "GET", url: `/api/companies/3/members/${member.memberId}`, response: jsonResponse(member) },
    {
      method: "GET",
      url: `/api/companies/3/members/${member.memberId}/punches`,
      response: jsonResponse([dayRecord({ punches: [punch({ memberId: member.memberId })] })]),
    },
    { method: "GET", url: `/api/companies/3/members/${member.memberId}/summary`, response: jsonResponse(hoursSummary()) },
    {
      method: "GET",
      url: "/api/companies/3/positions",
      response: jsonResponse([
        { positionId: 4, name: "Atendente", activeMembers: 3, currentSchedule: null },
        { positionId: 6, name: "Padeiro", activeMembers: 2, currentSchedule: null },
      ]),
    },
  ]);
  const view = await renderRouteReady(<MemberDetailPage />, {
    path: "/empresa/membros/:memberId",
    initialEntry: `/empresa/membros/${member.memberId}`,
    extraRoutes: [{ path: "/empresa/configuracoes", element: <p>Tela de configurações</p> }],
  });
  await screen.findByRole("heading", { level: 1, name: member.name });
  return { api, view, user: userEvent.setup() };
};

describe("MemberDetailPage", () => {
  it("mostra dados, cargo, jornada, histórico e resumo do período do membro, sem violações", async () => {
    const { api, view, user } = await setup();

    expect(screen.getByText("Membro")).toBeInTheDocument();
    expect(screen.getAllByText("Atendente").length).toBeGreaterThan(0);
    expect(screen.getByText("Do cargo")).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Totais do período" })).toBeInTheDocument();
    expect(api.requestsTo("/api/companies/3/members/15/punches", "GET")[0]?.path).toMatch(/month=/);
    // No celular, dia passado sem pendência começa recolhido (revisão T070, I-09)
    const dayHeader = screen.getByRole("button", { expanded: false, name: /^ter|^qua|^qui|^sex|^sáb|^dom|^seg/ });
    await user.click(dayHeader);
    expect(screen.getByRole("link", { name: /Ver detalhes da marcação Entrada 08:00/ })).toBeInTheDocument();
    expect(await axeInAct(view.container)).toHaveNoViolations();
  });

  it("troca o cargo a partir de uma data", async () => {
    const { api, user } = await setup(joao(), [
      {
        method: "PUT",
        url: "/api/companies/3/members/15/position",
        response: jsonResponse(joao({ position: { positionId: 6, name: "Padeiro" } })),
      },
    ]);

    await user.click(screen.getByRole("button", { name: "Trocar cargo" }));
    const dialog = await screen.findByRole("dialog", { name: "Trocar o cargo de João Lima" });
    await within(dialog).findByRole("option", { name: "Padeiro" });
    await user.selectOptions(within(dialog).getByLabelText("Novo cargo"), "6");
    expect(within(dialog).getByLabelText("A partir de")).toHaveValue(TODAY);
    await user.click(within(dialog).getByRole("button", { name: "Trocar cargo" }));

    expect(await screen.findByText("Cargo de João atualizado")).toBeInTheDocument();
    expect(api.requestsTo("/api/companies/3/members/15/position", "PUT")[0]?.body).toEqual({
      positionId: 6,
      effectiveFrom: TODAY,
    });
  });

  it("gestor exige ao menos um cargo e envia os cargos escolhidos", async () => {
    const { api, user } = await setup(joao(), [
      {
        method: "PUT",
        url: "/api/companies/3/members/15/manager",
        response: jsonResponse(joao({ isManager: true, managedPositionIds: [4] })),
      },
    ]);

    await user.click(screen.getByRole("button", { name: "Tornar gestor" }));
    const dialog = await screen.findByRole("dialog", { name: "Gestor: João Lima" });
    await user.click(within(dialog).getByRole("checkbox", { name: "João é gestor" }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(within(dialog).getByText("Escolha pelo menos um cargo para o gestor supervisionar.")).toBeInTheDocument();
    expect(api.requestsTo("/api/companies/3/members/15/manager")).toHaveLength(0);

    await user.click(within(dialog).getByRole("checkbox", { name: "Atendente" }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("João agora é gestor")).toBeInTheDocument();
    expect(api.requestsTo("/api/companies/3/members/15/manager", "PUT")[0]?.body).toEqual({
      isManager: true,
      positionIds: [4],
    });
  });

  it("desativar o responsável é bloqueado com explicação e atalho para a transferência", async () => {
    const { api, user } = await setup(
      memberInfo({ positionHistory: [], scheduleHistory: [], joinedAt: "2026-11-01T12:00:00Z" }),
    );

    await user.click(screen.getByRole("button", { name: "Desativar Ana" }));
    const dialog = await screen.findByRole("dialog", { name: "Não é possível desativar você" });
    expect(within(dialog).getByText(/Transfira a responsabilidade para outro membro/)).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Transferir responsabilidade" })).toHaveAttribute(
      "href",
      "/empresa/configuracoes",
    );
    expect(api.requestsTo("/api/companies/3/members/12/deactivate")).toHaveLength(0);
    // O responsável não vira "gestor"
    expect(screen.queryByRole("button", { name: "Tornar gestor" })).not.toBeInTheDocument();
  });

  it("desativa um membro com confirmação e mostra o erro da API se houver", async () => {
    const { api, user } = await setup(joao(), [
      { method: "POST", url: "/api/companies/3/members/15/deactivate", response: errorResponse(422, "Não foi possível desativar.") },
    ]);

    await user.click(screen.getByRole("button", { name: "Desativar João" }));
    const dialog = await screen.findByRole("dialog", { name: "Desativar João Lima?" });
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Desativar" }));

    expect(await screen.findAllByText("Não foi possível desativar.")).not.toHaveLength(0);
    expect(api.requestsTo("/api/companies/3/members/15/deactivate", "POST")).toHaveLength(1);

    api.use({ method: "POST", url: "/api/companies/3/members/15/deactivate", response: emptyResponse() });
    api.use({ method: "GET", url: "/api/companies/3/members/15", response: jsonResponse(joao({ status: "inactive" })) });
    await user.click(within(dialog).getByRole("button", { name: "Desativar" }));
    expect(await screen.findByText("João Lima foi desativado")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Reativar João" })).toBeInTheDocument());
  });
});
