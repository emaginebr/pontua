import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClockPage from "../ClockPage";
import { punchQueue } from "../../Services/punchQueue";
import { errorResponse, jsonResponse, mockFetch, networkError } from "../../test/fetchMock";
import type { MockRoute } from "../../test/fetchMock";
import {
  axeInAct,
  companyInfo,
  companySummary,
  memberInfo,
  renderRouteReady,
  seedSession,
} from "../../test/renderWithProviders";
import type { DayRecord, PunchInfo } from "../../types/punch";
import type { HoursSummary } from "../../types/summary";
import { todayInZone } from "../../utils/dateTime";

const TODAY = todayInZone("America/Sao_Paulo");

const punchInfo = (overrides: Partial<PunchInfo> = {}): PunchInfo => ({
  punchId: 881,
  nsr: 1042,
  memberId: 12,
  kind: "normal",
  // Bem no passado: não dispara a espera de 1 minuto
  punchedAt: "2020-01-01T11:02:41Z",
  workDate: TODAY,
  localTime: "08:02",
  receivedAt: "2026-11-25T11:02:41Z",
  status: "valid",
  pendingReason: null,
  justification: null,
  replacesPunchId: null,
  periodName: "Entrada",
  countsAsWorked: true,
  review: null,
  ...overrides,
});

const workDay = (overrides: Partial<DayRecord> = {}): DayRecord => ({
  date: TODAY,
  isWorkDay: true,
  expectedMinutes: 480,
  workedMinutes: 0,
  balanceMinutes: -480,
  incomplete: true,
  hasPending: false,
  periods: [
    { sequence: 1, name: "Entrada", expectedTime: "08:00", punchId: 881 },
    { sequence: 2, name: "Pausa", expectedTime: "12:00", punchId: null },
    { sequence: 3, name: "Retorno", expectedTime: "13:00", punchId: null },
    { sequence: 4, name: "Saída", expectedTime: "17:00", punchId: null },
  ],
  punches: [punchInfo()],
  ...overrides,
});

const weekSummary: HoursSummary = {
  start: "2026-11-23",
  end: "2026-11-29",
  totals: { workedMinutes: 779, expectedMinutes: 1056, balanceMinutes: 7, pendingPunches: 0 },
  weeks: [],
  days: [],
};

const setup = async (day: DayRecord, routes: MockRoute[] = []) => {
  seedSession();
  const api = mockFetch([
    ...routes,
    { method: "GET", url: "/api/companies", response: jsonResponse([companySummary()]) },
    { method: "GET", url: "/api/companies/3", response: jsonResponse(companyInfo()) },
    { method: "GET", url: "/api/companies/3/members/me", response: jsonResponse(memberInfo()) },
    { method: "GET", url: "/api/companies/3/punches/me", response: jsonResponse([day]) },
    { method: "GET", url: "/api/companies/3/summary/me", response: jsonResponse(weekSummary) },
  ]);
  const view = await renderRouteReady(<ClockPage />);
  return { api, view, user: userEvent.setup() };
};

const punchButton = () => screen.getByRole("button", { name: /^Registrar ponto/ });

describe("ClockPage", () => {
  it("mostra jornada e próxima marcação e registra online com confirmação anunciada, sem violações", async () => {
    const { api, view, user } = await setup(workDay(), [
      {
        method: "POST",
        url: "/api/companies/3/punches",
        response: () =>
          jsonResponse(
            punchInfo({ punchId: 882, periodName: "Pausa", localTime: "12:01", punchedAt: new Date().toISOString() }),
            { status: 201 },
          ),
      },
    ]);

    // I-06: nome acessível = texto visível, sem `aria-label` (Lighthouse `label-content-name-mismatch`)
    const button = await screen.findByRole("button", { name: "Registrar ponto Pausa · previsto 12:00" });
    expect(button).not.toHaveAttribute("aria-label");
    expect(screen.getByText("1 de 4 marcações feitas hoje")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Marcações de hoje" })).toBeInTheDocument();
    // Cartão "Esta semana" com o resumo da semana corrente
    const week = await screen.findByRole("region", { name: "Esta semana" });
    expect(within(week).getByText("12:59")).toBeInTheDocument();
    expect(within(week).getByText("+00:07")).toBeInTheDocument();
    expect(await axeInAct(view.container)).toHaveNoViolations();

    await user.click(punchButton());
    const dialog = await screen.findByRole("dialog", { name: "Registrar ponto?" });
    expect(within(dialog).getByText("Pausa")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(api.requestsTo("/api/companies/3/punches", "POST")).toHaveLength(1));
    // Frase neutra e um único anúncio (o toast, numa região aria-live)
    const toast = await screen.findByText("Marcação registrada às 12:01 · Pausa");
    expect(toast.closest("[aria-live]")).not.toBeNull();
    expect(screen.getAllByText("Marcação registrada às 12:01 · Pausa")).toHaveLength(1);
    // Espera de 1 minuto: o botão explica e não registra de novo
    // Nome acessível começa pelo texto visível "Aguarde 60 s" (WCAG 2.5.3)
    const waiting = await screen.findByRole("button", { name: /^Aguarde \d+ s para marcar de novo$/ });
    expect(waiting).toHaveAttribute("aria-disabled", "true");
    await user.click(waiting);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("pendentes não contam como feitas no painel, no anel e em 'N de M' (B-01)", async () => {
    const pending = (punchId: number, periodName: string, localTime: string) =>
      punchInfo({ punchId, periodName, localTime, kind: "manual", status: "pending", pendingReason: "manual", countsAsWorked: false });
    const { view } = await setup(
      workDay({
        hasPending: true,
        periods: [
          { sequence: 1, name: "Entrada", expectedTime: "08:00", punchId: 1 },
          { sequence: 2, name: "Pausa", expectedTime: "12:00", punchId: 2 },
          { sequence: 3, name: "Retorno", expectedTime: "13:00", punchId: 3 },
          { sequence: 4, name: "Saída", expectedTime: "17:00", punchId: 4 },
        ],
        punches: [
          pending(1, "Entrada", "08:01"),
          pending(2, "Pausa", "12:02"),
          punchInfo({ punchId: 3, periodName: "Retorno", localTime: "13:00" }),
          punchInfo({ punchId: 4, periodName: "Saída", localTime: "17:00" }),
        ],
      }),
    );

    expect(await screen.findByText("Jornada de hoje registrada · 2 pendentes")).toBeInTheDocument();
    expect(screen.queryByText("Jornada de hoje completa")).not.toBeInTheDocument();
    expect(screen.getByText("2 de 4 marcações feitas hoje")).toBeInTheDocument();
    const steps = screen.getByRole("list", { name: "Jornada de hoje" });
    const states = within(steps)
      .getAllByRole("listitem")
      .map((item) => item.getAttribute("data-state"));
    expect(states).toEqual(["pending", "pending", "done", "done"]);
    expect(within(steps).getAllByText("pendente de aprovação")).toHaveLength(2);
    expect(await axeInAct(view.container)).toHaveNoViolations();
  });

  it("correção pendente aparece uma vez, como par original/correção na linha do período (N-04)", async () => {
    const { view } = await setup(
      workDay({
        hasPending: true,
        periods: [
          { sequence: 1, name: "Entrada", expectedTime: "08:00", punchId: 881 },
          { sequence: 2, name: "Pausa", expectedTime: "12:00", punchId: 2 },
          { sequence: 3, name: "Retorno", expectedTime: "13:00", punchId: null },
          { sequence: 4, name: "Saída", expectedTime: "17:00", punchId: null },
        ],
        punches: [
          punchInfo(),
          punchInfo({ punchId: 2, periodName: "Pausa", localTime: "19:49" }),
          // Pedido de correção: a API devolve o mesmo nome de período da original
          punchInfo({
            punchId: 3,
            kind: "manual",
            status: "pending",
            pendingReason: "manual",
            periodName: "Pausa",
            localTime: "08:01",
            replacesPunchId: 2,
            countsAsWorked: false,
            justification: "Marquei errado.",
          }),
        ],
      }),
    );

    const today = await screen.findByRole("region", { name: "Marcações de hoje" });
    const rows = within(today).getAllByRole("listitem");
    // 4 períodos, nenhuma linha solta para a correção
    expect(rows).toHaveLength(4);
    expect(within(today).getAllByText("Pausa")).toHaveLength(1);
    const pause = rows[1] as HTMLElement;
    expect(within(pause).getByText("19:49")).toBeInTheDocument();
    expect(within(pause).getByText("Original")).toBeInTheDocument();
    expect(within(pause).getByText("Correção pedida")).toBeInTheDocument();
    expect(within(pause).getByText("08:01")).toBeInTheDocument();
    expect(within(pause).getByText("Pendente")).toBeInTheDocument();
    // A original continua valendo enquanto o pedido está pendente: 2 de 4 feitas
    expect(screen.getByText("2 de 4 marcações feitas hoje")).toBeInTheDocument();
    expect(await axeInAct(view.container)).toHaveNoViolations();
  });

  it("fechar a confirmação com Esc devolve o foco ao botão de ponto (N-03)", async () => {
    const { user } = await setup(workDay());
    const button = await screen.findByRole("button", { name: "Registrar ponto Pausa · previsto 12:00" });

    await user.click(button);
    await screen.findByRole("dialog", { name: "Registrar ponto?" });
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  });

  it("todas válidas: jornada completa", async () => {
    await setup(
      workDay({
        periods: [
          { sequence: 1, name: "Entrada", expectedTime: "08:00", punchId: 1 },
          { sequence: 2, name: "Saída", expectedTime: "17:00", punchId: 2 },
        ],
        punches: [
          punchInfo({ punchId: 1, periodName: "Entrada", localTime: "08:00" }),
          punchInfo({ punchId: 2, periodName: "Saída", localTime: "17:00" }),
        ],
      }),
    );
    expect(await screen.findByText("Jornada de hoje completa")).toBeInTheDocument();
    expect(screen.getByText("2 de 2 marcações feitas hoje")).toBeInTheDocument();
  });

  it("fora do dia útil avisa que a marcação ficará pendente", async () => {
    const { view } = await setup(workDay({ isWorkDay: false, periods: [], punches: [], expectedMinutes: 0 }));

    expect(
      await screen.findByRole("button", { name: "Registrar ponto Marcação extra · pendente de aprovação" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hoje não é dia útil para você.")).toBeInTheDocument();
    expect(screen.getByText("Sem jornada prevista hoje")).toBeInTheDocument();
    expect(await axeInAct(view.container)).toHaveNoViolations();
  });

  it("marcação extra registrada: frase neutra sem período", async () => {
    const { user } = await setup(workDay({ isWorkDay: false, periods: [], punches: [], expectedMinutes: 0 }), [
      {
        method: "POST",
        url: "/api/companies/3/punches",
        response: () =>
          jsonResponse(punchInfo({ punchId: 900, periodName: null, localTime: "19:30", punchedAt: new Date().toISOString() }), {
            status: 201,
          }),
      },
    ]);
    await user.click(await screen.findByRole("button", { name: /^Registrar ponto/ }));
    const dialog = await screen.findByRole("dialog", { name: "Registrar ponto?" });
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("Marcação extra registrada às 19:30")).toBeInTheDocument();
  });

  it("sem conexão (falha de rede no registro) guarda a marcação na fila e mostra o indicador", async () => {
    const { view, user } = await setup(workDay(), [
      { method: "POST", url: "/api/companies/3/punches", response: networkError },
      { method: "POST", url: "/api/companies/3/punches/offline", response: networkError },
    ]);
    await screen.findByRole("button", { name: "Registrar ponto Pausa · previsto 12:00" });

    await user.click(punchButton());
    const dialog = await screen.findByRole("dialog", { name: "Registrar ponto?" });
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("Marcação guardada. Será enviada quando a conexão voltar.")).toBeInTheDocument();
    const queued = await punchQueue.listByUser(7);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ companyId: 3, state: "waiting" });
    await waitFor(() =>
      expect(screen.getAllByRole("status").some((element) => element.textContent === "1 aguardando envio")).toBe(true),
    );
    expect(screen.getAllByText("Aguardando envio").length).toBeGreaterThan(0);
    expect(await axeInAct(view.container)).toHaveNoViolations();
  });

  it("marcação a menos de 1 minuto: explica que é preciso aguardar", async () => {
    const { user } = await setup(workDay(), [
      {
        method: "POST",
        url: "/api/companies/3/punches",
        response: errorResponse(422, "Aguarde pelo menos 1 minuto após a marcação anterior para marcar o ponto novamente."),
      },
    ]);
    await screen.findByRole("button", { name: "Registrar ponto Pausa · previsto 12:00" });

    await user.click(punchButton());
    const dialog = await screen.findByRole("dialog", { name: "Registrar ponto?" });
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect(
      await screen.findByText(/Você marcou há menos de 1 minuto\. Aguarde um pouco para marcar de novo/),
    ).toBeInTheDocument();
    expect(await punchQueue.listByUser(7)).toEqual([]);
  });
});
