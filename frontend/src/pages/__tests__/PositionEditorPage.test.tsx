import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import PositionEditorPage from "../PositionEditorPage";
import { emptyResponse, errorResponse, jsonResponse, mockFetch } from "../../test/fetchMock";
import type { MockRoute } from "../../test/fetchMock";
import { companyInfo, companySummary, memberInfo, renderRoute, seedSession } from "../../test/renderWithProviders";
import type { PositionInfo } from "../../types/position";

const position: PositionInfo = {
  positionId: 4,
  name: "Atendente",
  activeMembers: 6,
  currentSchedule: {
    scheduleId: 9,
    mode: "weekly",
    effectiveFrom: "2026-01-01",
    weeklyMinutes: 2640,
    days: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
      dayOfWeek,
      dailyMinutes: 528,
      periods: [
        { sequence: 1, name: "Entrada", expectedTime: "08:00" },
        { sequence: 2, name: "Saída", expectedTime: "17:48" },
      ],
    })),
  },
  scheduleHistory: [],
};

const companyRoutes: MockRoute[] = [
  { method: "GET", url: "/api/companies", response: jsonResponse([companySummary()]) },
  { method: "GET", url: "/api/companies/3", response: jsonResponse(companyInfo()) },
  { method: "GET", url: "/api/companies/3/members/me", response: jsonResponse(memberInfo()) },
];

const waitForCompany = async (api: ReturnType<typeof mockFetch>) => {
  await waitFor(() => expect(api.requestsTo("/api/companies/3/members/me")).toHaveLength(1));
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
};

const renderNew = (routes: MockRoute[] = []) => {
  seedSession();
  const api = mockFetch([...routes, ...companyRoutes]);
  const view = renderRoute(<PositionEditorPage />, {
    path: "/empresa/cargos/novo",
    extraRoutes: [{ path: "/empresa/cargos", element: <p>Lista de cargos</p> }],
  });
  return { api, view, user: userEvent.setup() };
};

const renderEdit = (routes: MockRoute[] = []) => {
  seedSession();
  const api = mockFetch([
    ...routes,
    { method: "GET", url: "/api/companies/3/positions/4", response: jsonResponse(position) },
    ...companyRoutes,
  ]);
  const view = renderRoute(<PositionEditorPage />, {
    path: "/empresa/cargos/:positionId",
    initialEntry: "/empresa/cargos/4",
    extraRoutes: [{ path: "/empresa/cargos", element: <p>Lista de cargos</p> }],
  });
  return { api, view, user: userEvent.setup() };
};

describe("PositionEditorPage", () => {
  it("cria o cargo semanal enviando ScheduleInput e volta para a lista, sem violações", async () => {
    const { api, view, user } = renderNew([
      {
        method: "POST",
        url: "/api/companies/3/positions",
        response: jsonResponse({ ...position, positionId: 5 }, { status: 201 }),
      },
    ]);
    await waitForCompany(api);
    expect(await axe(view.container)).toHaveNoViolations();

    await user.type(screen.getByLabelText("Nome do cargo"), "Atendente");
    await user.click(screen.getByRole("button", { name: "Salvar cargo" }));

    expect(await screen.findByText("Lista de cargos")).toBeInTheDocument();
    expect(api.requestsTo("/api/companies/3/positions", "POST")[0]?.body).toEqual({
      name: "Atendente",
      schedule: {
        mode: "weekly",
        effectiveFrom: null,
        weeklyMinutes: 2400,
        workDays: [1, 2, 3, 4, 5],
        dailyMinutes: 480,
        periods: [
          { name: "Entrada", expectedTime: "08:00" },
          { name: "Pausa", expectedTime: "12:00" },
          { name: "Retorno", expectedTime: "13:00" },
          { name: "Saída", expectedTime: "17:00" },
        ],
      },
    });
  });

  it("valida o nome antes de enviar e liga os erros da API aos campos", async () => {
    const { api, user } = renderNew([
      {
        method: "POST",
        url: "/api/companies/3/positions",
        response: errorResponse(400, "Dados inválidos.", [
          { campo: "schedule.periods[1].name", mensagem: "O nome do período é obrigatório." },
        ]),
      },
    ]);
    await waitForCompany(api);

    await user.click(screen.getByRole("button", { name: "Salvar cargo" }));
    const name = screen.getByLabelText("Nome do cargo");
    expect(name).toHaveAccessibleDescription("Informe o nome do cargo.");
    expect(name).toHaveFocus();
    expect(api.requestsTo("/api/companies/3/positions", "POST")).toHaveLength(0);

    await user.type(name, "Atendente");
    await user.click(screen.getByRole("button", { name: "Salvar cargo" }));

    const periodName = screen.getAllByLabelText("Nome do período")[1];
    await waitFor(() => expect(periodName).toHaveAccessibleDescription("O nome do período é obrigatório."));
    expect(periodName).toHaveAttribute("aria-invalid", "true");
  });

  it.each([
    [422, "Não é possível excluir um cargo com membros ativos."],
    [409, "Este cargo tem histórico de marcações e não pode ser excluído."],
  ])("exclusão recusada (%i) explica o motivo e sugere renomear", async (status, message) => {
    const { api, view, user } = renderEdit([
      { method: "DELETE", url: "/api/companies/3/positions/4", response: errorResponse(status, message) },
    ]);
    expect(await screen.findByRole("heading", { level: 1, name: "Atendente" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do cargo")).toHaveValue("Atendente");
    expect(screen.getByText("Seg–Sex · 2 marcações · 44 h/semana")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Excluir cargo" }));
    const dialog = await screen.findByRole("dialog", { name: "Excluir o cargo Atendente?" });
    await user.click(within(dialog).getByRole("button", { name: "Excluir cargo" }));

    const alert = await screen.findByText(new RegExp(`${message} Se quiser reaproveitá-lo, renomeie o cargo`));
    expect(alert.closest("[role='alert']")).not.toBeNull();
    expect(api.requestsTo("/api/companies/3/positions/4", "DELETE")).toHaveLength(1);
    expect(screen.queryByText("Lista de cargos")).not.toBeInTheDocument();
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("renomeia sem gravar nova jornada quando só o nome muda", async () => {
    const { api, user } = renderEdit([
      {
        method: "PUT",
        url: "/api/companies/3/positions/4",
        response: jsonResponse({ ...position, name: "Atendente sênior" }),
      },
      { method: "PUT", url: "/api/companies/3/positions/4/schedule", response: emptyResponse() },
    ]);
    const name = await screen.findByLabelText("Nome do cargo");
    await waitFor(() => expect(name).toHaveValue("Atendente"));

    await user.clear(name);
    await user.type(name, "Atendente sênior");
    await user.click(screen.getByRole("button", { name: "Salvar cargo" }));

    expect(await screen.findByText("Lista de cargos")).toBeInTheDocument();
    expect(api.requestsTo("/api/companies/3/positions/4", "PUT")[0]?.body).toEqual({ name: "Atendente sênior" });
    expect(api.requestsTo("/api/companies/3/positions/4/schedule", "PUT")).toHaveLength(0);
  });
});
