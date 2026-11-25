import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ApprovalsPage from "../ApprovalsPage";
import { AppShell } from "../../components/AppShell";
import { RequireRole } from "../../components/RouteGuards";
import { Toaster } from "../../components/Toaster";
import { errorResponse, jsonResponse, mockFetch } from "../../test/fetchMock";
import type { MockRoute, RecordedRequest } from "../../test/fetchMock";
import { TODAY, YESTERDAY, dayRecord, panelDay, panelMember, punch } from "../../test/fixtures";
import {
  AppProviders,
  axeInAct,
  companyInfo,
  companySummary,
  memberInfo,
  renderRouteReady,
  seedSession,
  waitForAppReady,
} from "../../test/renderWithProviders";
import type { PendingPanelDay } from "../../types/approval";
import type { PunchInfo } from "../../types/punch";
import { addDays } from "../../utils/dateTime";

const original = punch({ punchId: 881, memberId: 15, localTime: "17:04", periodName: "Saída" });
const correction = punch({
  punchId: 990,
  memberId: 15,
  kind: "manual",
  status: "pending",
  pendingReason: "manual",
  localTime: "18:00",
  periodName: null,
  replacesPunchId: 881,
  countsAsWorked: false,
  justification: "Fiquei até as 18h fechando o caixa.",
});

const panel = (pending: PunchInfo = correction): PendingPanelDay[] => [
  panelDay([
    panelMember({ punches: [punch({ punchId: 880, memberId: 15 }), original, pending] }),
    panelMember({ memberId: 16, name: "João Lima", position: "Padeiro", situation: "missing", punches: [] }),
  ]),
];

const isCountRequest = (request: RecordedRequest) => request.path.includes("type=pending");

interface SetupOptions {
  routes?: MockRoute[];
  list?: () => PendingPanelDay[];
  manager?: boolean;
}

const setup = async ({ routes = [], list = () => panel(), manager = false }: SetupOptions = {}) => {
  seedSession();
  const access = manager
    ? { memberId: 15, isOwner: false, isManager: true, managedPositionIds: [4] }
    : { memberId: 12, isOwner: true, isManager: false, managedPositionIds: [] };
  const api = mockFetch([
    ...routes,
    {
      method: "GET",
      url: "/api/companies",
      response: jsonResponse([companySummary({ isOwner: !manager, isManager: manager, memberId: access.memberId })]),
    },
    { method: "GET", url: "/api/companies/3", response: jsonResponse(companyInfo({ myAccess: access })) },
    { method: "GET", url: "/api/companies/3/members/me", response: jsonResponse(memberInfo({ memberId: access.memberId })) },
    {
      method: "GET",
      url: "/api/companies/3/positions",
      response: jsonResponse([
        { positionId: 4, name: "Atendente", activeMembers: 3, currentSchedule: null },
        { positionId: 6, name: "Padeiro", activeMembers: 2, currentSchedule: null },
      ]),
    },
    { method: "GET", url: "/api/companies/3/approvals", response: () => jsonResponse(list()) },
    // N-02: depois de cada análise o painel recarrega o dia do membro (mesmos dados do painel)
    {
      method: "GET",
      url: "/api/companies/3/members/15/punches",
      response: () => {
        const day = list()[0];
        const member = day?.members.find((item) => item.memberId === 15);
        return jsonResponse([dayRecord({ date: day?.date ?? YESTERDAY, punches: member?.punches ?? [] })]);
      },
    },
  ]);
  // Casca + painel: o contador da navegação aparece junto
  const view = await renderRouteReady(
    <AppShell>
      <ApprovalsPage />
    </AppShell>,
    { path: "/aprovacoes", initialEntry: "/aprovacoes" },
  );
  await screen.findByText("Ana Souza");
  return { api, view, user: userEvent.setup() };
};

/** Barra inferior e menu lateral estão no DOM (o CSS escolhe qual aparece): usa o primeiro. */
const approvalsLink = () => screen.getAllByRole("link", { name: /^Aprovações/ })[0] as HTMLElement;

describe("ApprovalsPage", () => {
  it("mostra o painel por dia com pendências e sem marcação, e o contador acessível, sem violações", async () => {
    const { api, view } = await setup();

    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("João Lima")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma marcação neste dia útil.")).toBeInTheDocument();
    expect(screen.getByText("Correção de 17:04")).toBeInTheDocument();
    expect(screen.getByText(/Fiquei até as 18h/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprovar Saída 18:00 de Ana Souza" })).toBeInTheDocument();
    await waitFor(() => expect(approvalsLink()).toHaveAccessibleName("Aprovações, 1 pendência"));
    // Contador: só pendências, dos últimos 31 dias
    const count = api.requestsTo("/api/companies/3/approvals", "GET").find(isCountRequest);
    expect(count?.path).toContain(`start=${addDays(TODAY, -30)}`);
    expect(count?.path).toContain(`end=${TODAY}`);
    expect(await axeInAct(view.container)).toHaveNoViolations();
  });

  it("aprovar atualiza a linha na hora e o contador", async () => {
    let pendingLeft = true;
    const { api, user } = await setup({
      list: () => (pendingLeft ? panel() : panel({ ...correction, status: "approved" })),
      routes: [
        {
          method: "POST",
          url: "/api/companies/3/punches/990/approve",
          response: () => {
            pendingLeft = false;
            return jsonResponse({ ...correction, status: "approved", review: { by: "Ana Silva", at: new Date().toISOString(), note: null } });
          },
        },
      ],
    });
    await waitFor(() => expect(approvalsLink()).toHaveAccessibleName("Aprovações, 1 pendência"));

    await user.click(screen.getByRole("button", { name: "Aprovar Saída 18:00 de Ana Souza" }));

    expect(await screen.findByText("Marcação aprovada")).toBeInTheDocument();
    expect(screen.getByText("Aprovada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprovar Saída 18:00 de Ana Souza" })).not.toBeInTheDocument();
    expect(api.requestsTo("/api/companies/3/punches/990/approve", "POST")[0]?.body).toEqual({ note: null });
    await waitFor(() => expect(approvalsLink()).toHaveAccessibleName("Aprovações"));
  });

  it("rejeitar abre o modal com motivo opcional", async () => {
    let rejected = false;
    const { api, user } = await setup({
      list: () => (rejected ? panel({ ...correction, status: "rejected" }) : panel()),
      routes: [
        {
          method: "POST",
          url: "/api/companies/3/punches/990/reject",
          response: () => {
            rejected = true;
            return jsonResponse({ ...correction, status: "rejected" });
          },
        },
      ],
    });

    const trigger = screen.getByRole("button", { name: "Rejeitar Saída 18:00 de Ana Souza" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Rejeitar marcação?" });
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    // N-03: "Cancelar" fecha e devolve o foco ao botão que abriu o modal
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    const reopened = await screen.findByRole("dialog", { name: "Rejeitar marcação?" });
    expect(within(reopened).getByText(/A marcação original \(17:04\) continua valendo/)).toBeInTheDocument();
    await user.type(within(reopened).getByLabelText(/Motivo/), "O caixa fechou às 17:00.");
    await user.click(within(reopened).getByRole("button", { name: "Rejeitar marcação" }));

    expect(await screen.findByText("Marcação rejeitada")).toBeInTheDocument();
    expect(api.requestsTo("/api/companies/3/punches/990/reject", "POST")[0]?.body).toEqual({ note: "O caixa fechou às 17:00." });
    expect(screen.getByText("Rejeitada")).toBeInTheDocument();
  });

  it("depois de analisar, recarrega o dia do membro com os períodos recalculados pelo servidor (N-02)", async () => {
    // Inclusão pendente 07:30 "empurrava" as válidas: 20:00 aparecia como Pausa e 20:03 como Extra
    const inclusion = punch({
      punchId: 700,
      memberId: 15,
      kind: "manual",
      status: "pending",
      pendingReason: "manual",
      localTime: "07:30",
      periodName: "Entrada",
      countsAsWorked: false,
      justification: "Esqueci de marcar a entrada.",
    });
    const before = [inclusion, punch({ punchId: 701, memberId: 15, localTime: "20:00", periodName: "Pausa" })];
    const after = [
      { ...inclusion, status: "rejected" as const, periodName: null },
      punch({ punchId: 701, memberId: 15, localTime: "20:00", periodName: "Entrada" }),
    ];
    let rejected = false;
    const { api, user } = await setup({
      list: () => [panelDay([panelMember({ punches: rejected ? after : before })])],
      routes: [
        {
          method: "POST",
          url: "/api/companies/3/punches/700/reject",
          response: () => {
            rejected = true;
            return jsonResponse({ ...inclusion, status: "rejected", periodName: null });
          },
        },
      ],
    });
    const rowOf = (time: string) => screen.getByText(time).closest("li") as HTMLElement;
    expect(rowOf("20:00")).toHaveTextContent(/^Pausa/);

    await user.click(screen.getByRole("button", { name: "Rejeitar Entrada 07:30 de Ana Souza" }));
    const dialog = await screen.findByRole("dialog", { name: "Rejeitar marcação?" });
    await user.click(within(dialog).getByRole("button", { name: "Rejeitar marcação" }));

    // O estado do sonner é global: o toast do teste anterior pode ainda estar na lista
    expect((await screen.findAllByText("Marcação rejeitada")).length).toBeGreaterThan(0);
    await waitFor(() => expect(api.requestsTo("/api/companies/3/members/15/punches", "GET")).toHaveLength(1));
    expect(api.requestsTo("/api/companies/3/members/15/punches", "GET")[0]?.path).toContain(`start=${YESTERDAY}&end=${YESTERDAY}`);
    // Sem recarregar a página: a válida 20:00 passa a ser "Entrada"
    await waitFor(() => expect(rowOf("20:00")).toHaveTextContent(/^Entrada/));
  });

  it("409 (já analisada por outra pessoa): avisa, reverte e recarrega a lista", async () => {
    let reviewedElsewhere = false;
    const { api, user } = await setup({
      list: () =>
        reviewedElsewhere
          ? panel({ ...correction, status: "approved", review: { by: "Carlos", at: new Date().toISOString(), note: null } })
          : panel(),
      routes: [
        {
          method: "POST",
          url: "/api/companies/3/punches/990/approve",
          response: () => {
            reviewedElsewhere = true;
            return errorResponse(409, "A marcação não está pendente.");
          },
        },
      ],
    });
    const panelLoads = () => api.requestsTo("/api/companies/3/approvals", "GET").filter((request) => !isCountRequest(request)).length;
    const before = panelLoads();

    await user.click(screen.getByRole("button", { name: "Aprovar Saída 18:00 de Ana Souza" }));

    expect(await screen.findByText("Esta marcação já foi analisada")).toBeInTheDocument();
    await waitFor(() => expect(panelLoads()).toBe(before + 1));
    expect(await screen.findByText(/Aprovada por Carlos/)).toBeInTheDocument();
  });

  it("gestor não vê botões nas próprias marcações", async () => {
    await setup({ manager: true });

    expect(screen.getByText("Você não pode aprovar a própria marcação.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Aprovar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Rejeitar/ })).not.toBeInTheDocument();
  });

  it("membro comum não acessa o painel nem busca pendências", async () => {
    seedSession();
    const api = mockFetch([
      { method: "GET", url: "/api/companies", response: jsonResponse([companySummary({ isOwner: false })]) },
      {
        method: "GET",
        url: "/api/companies/3",
        response: jsonResponse(companyInfo({ myAccess: { memberId: 12, isOwner: false, isManager: false, managedPositionIds: [] } })),
      },
      { method: "GET", url: "/api/companies/3/members/me", response: jsonResponse(memberInfo({ isOwner: false })) },
    ]);
    render(
      <AppProviders>
        <MemoryRouter initialEntries={["/aprovacoes"]}>
          <Routes>
            <Route element={<RequireRole role="supervisor" />}>
              <Route path="/aprovacoes" element={<ApprovalsPage />} />
            </Route>
            <Route path="/" element={<p>Tela de ponto</p>} />
          </Routes>
          <Toaster />
        </MemoryRouter>
      </AppProviders>,
    );
    await waitForAppReady();

    expect(await screen.findByText("Tela de ponto")).toBeInTheDocument();
    expect(await screen.findByText("Você não tem acesso a esta área.")).toBeInTheDocument();
    expect(api.requestsTo("/api/companies/3/approvals")).toHaveLength(0);
  });
});
