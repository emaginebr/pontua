import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HistoryPage from "../HistoryPage";
import { emptyResponse, jsonResponse, mockFetch } from "../../test/fetchMock";
import type { MockRoute } from "../../test/fetchMock";
import { TODAY, YESTERDAY, dayRecord, hoursSummary, punch } from "../../test/fixtures";
import {
  axeInAct,
  companyInfo,
  companySummary,
  memberInfo,
  renderRouteReady,
  seedSession,
} from "../../test/renderWithProviders";
import type { DayRecord, PunchInfo } from "../../types/punch";
import { addDays, formatYmdShort } from "../../utils/dateTime";
import { shiftMonth } from "../../utils/period";

const exit = punch({ punchId: 881, localTime: "17:04", periodName: "Saída" });
const correction = punch({
  punchId: 990,
  kind: "manual",
  status: "pending",
  pendingReason: "manual",
  localTime: "18:00",
  periodName: null,
  replacesPunchId: 881,
  countsAsWorked: false,
  justification: "Fiquei até as 18h fechando o caixa.",
});
const extra = punch({
  punchId: 991,
  kind: "manual",
  status: "pending",
  pendingReason: "manual",
  localTime: "19:30",
  periodName: null,
  countsAsWorked: false,
  justification: "Inventário de fim de mês.",
});

const yesterday = (punches: PunchInfo[] = [punch({ punchId: 880 }), exit, correction, extra]): DayRecord =>
  dayRecord({
    date: YESTERDAY,
    workedMinutes: 544,
    balanceMinutes: 16,
    incomplete: false,
    hasPending: true,
    periods: [
      { sequence: 1, name: "Entrada", expectedTime: "08:00", punchId: 880 },
      { sequence: 2, name: "Saída", expectedTime: "17:00", punchId: 881 },
    ],
    punches,
  });

const missingDay = dayRecord({ date: addDays(TODAY, -2), workedMinutes: 0, balanceMinutes: -528 });

interface SetupOptions {
  routes?: MockRoute[];
  days?: () => DayRecord[];
}

const setup = async ({ routes = [], days = () => [missingDay, yesterday()] }: SetupOptions = {}) => {
  seedSession();
  const api = mockFetch([
    ...routes,
    { method: "GET", url: "/api/companies", response: jsonResponse([companySummary()]) },
    { method: "GET", url: "/api/companies/3", response: jsonResponse(companyInfo({ manualRetroDays: 30 })) },
    {
      method: "GET",
      url: "/api/companies/3/members/me",
      response: jsonResponse(memberInfo({ joinedAt: `${addDays(TODAY, -90)}T12:00:00Z` })),
    },
    { method: "GET", url: "/api/companies/3/punches/me", response: () => jsonResponse(days()) },
    { method: "GET", url: "/api/companies/3/summary/me", response: jsonResponse(hoursSummary()) },
  ]);
  const view = await renderRouteReady(<HistoryPage />, { path: "/historico", initialEntry: "/historico" });
  await screen.findByRole("article", { name: formatYmdShort(YESTERDAY) });
  return { api, view, user: userEvent.setup() };
};

describe("HistoryPage", () => {
  it("mostra totais, dias e a correção pendente lado a lado com a original, sem violações", async () => {
    const { api, view } = await setup();

    expect(api.requestsTo("/api/companies/3/punches/me", "GET")[0]?.path).toMatch(/month=\d{4}-\d{2}/);
    const totals = screen.getByRole("region", { name: "Totais do período" });
    expect(within(totals).getByText("08:48")).toBeInTheDocument();
    expect(within(totals).getByText("17:36")).toBeInTheDocument();
    expect(within(totals).getByText("−08:48")).toBeInTheDocument();
    expect(within(totals).getByText(/2 marcações pendentes no período/)).toBeInTheDocument();

    const day = screen.getByRole("article", { name: formatYmdShort(YESTERDAY) });
    expect(within(day).getByText("Correção pedida")).toBeInTheDocument();
    expect(within(day).getByText("17:04")).toBeInTheDocument();
    expect(within(day).getByText("18:00")).toBeInTheDocument();
    expect(within(day).getAllByText("Manual").length).toBeGreaterThan(0);
    expect(within(day).getAllByText("Pendente").length).toBe(2);
    expect(within(day).getByText(/Fiquei até as 18h/)).toBeInTheDocument();

    const missing = screen.getByRole("article", { name: formatYmdShort(missingDay.date) });
    expect(within(missing).getByText("Sem marcação")).toBeInTheDocument();
    expect(within(missing).getByText("Nenhuma marcação neste dia útil.")).toBeInTheDocument();
    expect(await axeInAct(view.container)).toHaveNoViolations();
  });

  it("inclui marcação esquecida: fica Manual · Pendente e o saldo exibido não muda", async () => {
    let current = [missingDay, yesterday()];
    const created = punch({
      punchId: 995,
      workDate: missingDay.date,
      kind: "manual",
      status: "pending",
      pendingReason: "manual",
      localTime: "17:30",
      periodName: null,
      countsAsWorked: false,
      justification: "Esqueci de marcar a saída.",
    });
    const { api, user } = await setup({
      days: () => current,
      routes: [
        {
          method: "POST",
          url: "/api/companies/3/punches/manual",
          response: () => {
            current = [{ ...missingDay, hasPending: true, punches: [created] }, yesterday()];
            return jsonResponse(created, { status: 201 });
          },
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: `Incluir marcação em ${formatYmdShort(missingDay.date)}` }));
    const dialog = await screen.findByRole("dialog", { name: "Incluir marcação" });
    expect(within(dialog).getByLabelText("Data")).toHaveValue(missingDay.date);
    await user.type(within(dialog).getByLabelText("Horário"), "17:30");
    await user.type(within(dialog).getByLabelText("Justificativa"), "Esqueci de marcar a saída.");
    await user.click(within(dialog).getByRole("button", { name: "Enviar pedido" }));

    expect(await screen.findByText("Pedido enviado")).toBeInTheDocument();
    expect(api.requestsTo("/api/companies/3/punches/manual", "POST")[0]?.body).toEqual({
      workDate: missingDay.date,
      time: "17:30",
      justification: "Esqueci de marcar a saída.",
      replacesPunchId: null,
    });
    const day = screen.getByRole("article", { name: formatYmdShort(missingDay.date) });
    await waitFor(() => expect(within(day).getByText("Pendente")).toBeInTheDocument());
    expect(within(day).getByText("Manual")).toBeInTheDocument();
    // O pedido pendente não entra no total
    const totals = screen.getByRole("region", { name: "Totais do período" });
    expect(within(totals).getByText("−08:48")).toBeInTheDocument();
    expect(within(day).getByText("−08:48")).toBeInTheDocument();
  });

  it("cancela um pedido pendente com confirmação", async () => {
    let current = [missingDay, yesterday()];
    const { api, user } = await setup({
      days: () => current,
      routes: [
        {
          method: "POST",
          url: "/api/companies/3/punches/991/cancel",
          response: () => {
            current = [missingDay, yesterday([punch({ punchId: 880 }), exit, correction, { ...extra, status: "cancelled" }])];
            return emptyResponse();
          },
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Ações da marcação Extra 19:30" }));
    const actions = await screen.findByRole("dialog", { name: "Extra 19:30" });
    expect(within(actions).queryByRole("button", { name: "Corrigir horário" })).not.toBeInTheDocument();
    await user.click(within(actions).getByRole("button", { name: "Cancelar pedido" }));

    const confirm = await screen.findByRole("dialog", { name: "Cancelar o pedido?" });
    expect(within(confirm).getByRole("button", { name: "Voltar" })).toHaveFocus();
    await user.click(within(confirm).getByRole("button", { name: "Cancelar pedido" }));

    await waitFor(() => expect(api.requestsTo("/api/companies/3/punches/991/cancel", "POST")).toHaveLength(1));
    expect(await screen.findByText("Pedido cancelado")).toBeInTheDocument();
    const day = screen.getByRole("article", { name: formatYmdShort(YESTERDAY) });
    expect(await within(day).findByText("Cancelada")).toBeInTheDocument();
  });

  it("corrigir horário de uma marcação válida abre a folha com a original", async () => {
    const { user } = await setup();

    await user.click(screen.getByRole("button", { name: "Ações da marcação Entrada 08:00" }));
    const actions = await screen.findByRole("dialog", { name: "Entrada 08:00" });
    expect(within(actions).queryByRole("button", { name: "Cancelar pedido" })).not.toBeInTheDocument();
    await user.click(within(actions).getByRole("button", { name: "Corrigir horário" }));

    const dialog = await screen.findByRole("dialog", { name: "Corrigir horário" });
    expect(within(dialog).getByText("Entrada · 08:00")).toBeInTheDocument();
  });

  it("troca de mês e aplica um intervalo no filtro avançado", async () => {
    const { api, user } = await setup();
    const previous = shiftMonth(TODAY.slice(0, 7), -1);

    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    await waitFor(() =>
      expect(api.requestsTo("/api/companies/3/summary/me", "GET").some((request) => request.path.includes(`month=${previous}`))).toBe(true),
    );

    await user.click(screen.getByRole("button", { name: "Filtro avançado" }));
    const dialog = await screen.findByRole("dialog", { name: "Filtro avançado" });
    await user.click(within(dialog).getByRole("button", { name: "Últimos 30 dias" }));
    await user.click(within(dialog).getByRole("button", { name: "Aplicar" }));

    const start = addDays(TODAY, -29);
    await waitFor(() =>
      expect(
        api
          .requestsTo("/api/companies/3/punches/me", "GET")
          .some((request) => request.path.includes(`start=${start}`) && request.path.includes(`end=${TODAY}`)),
      ).toBe(true),
    );
    expect(screen.getByRole("button", { name: "Limpar filtro avançado" })).toBeInTheDocument();
  });
});
