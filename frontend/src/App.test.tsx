import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import App from "./App";
import { jsonResponse, mockFetch } from "./test/fetchMock";
import { AppProviders, companyInfo, companySummary, memberInfo, seedSession } from "./test/renderWithProviders";
import type { HoursSummary } from "./types/summary";

const emptySummary: HoursSummary = {
  start: "2026-11-23",
  end: "2026-11-29",
  totals: { workedMinutes: 0, expectedMinutes: 0, balanceMinutes: 0, pendingPunches: 0 },
  weeks: [],
  days: [],
};

const renderApp = (path: string) => {
  window.history.replaceState({}, "", path);
  return render(
    <AppProviders>
      <App withUpdatePrompt={false} />
    </AppProviders>,
  );
};

describe("App (rotas e guards)", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("sem sessão, leva para /entrar", async () => {
    const { container } = renderApp("/historico");

    expect(await screen.findByRole("heading", { level: 1, name: "Entrar" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/entrar");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("sem empresa, leva para /bem-vindo", async () => {
    seedSession();
    mockFetch([{ url: "/api/companies", response: jsonResponse([]) }]);

    renderApp("/");

    expect(await screen.findByRole("heading", { level: 1, name: "Olá, Ana" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/bem-vindo");
  });

  it("com empresa, mostra a casca com o nome da empresa ativa sempre visível", async () => {
    seedSession();
    mockFetch([
      { url: "/api/companies", response: jsonResponse([companySummary(), companySummary({ companyId: 4, name: "Café Lua", isOwner: false })]) },
      { url: "/api/companies/3", response: jsonResponse(companyInfo()) },
      { url: "/api/companies/3/members/me", response: jsonResponse(memberInfo()) },
      { url: "/api/companies/3/punches/me", response: jsonResponse([]) },
      { url: "/api/companies/3/summary/me", response: jsonResponse(emptySummary) },
      {
        url: "/api/companies/3/approvals",
        response: jsonResponse([
          {
            date: "2026-11-24",
            members: [
              {
                memberId: 15,
                name: "João Lima",
                position: "Atendente",
                situation: "pending",
                isWorkDay: true,
                punches: [{ punchId: 1, status: "pending" }, { punchId: 2, status: "pending" }, { punchId: 3, status: "valid" }],
              },
            ],
          },
        ]),
      },
    ]);

    const { container } = renderApp("/");

    expect(await screen.findByRole("heading", { level: 1, name: "Ponto" })).toBeInTheDocument();
    // Nome acessível = texto visível + complemento no fim, sem `aria-label` (WCAG 2.5.3, I-06)
    const switchers = screen.getAllByRole("button", { name: "Padaria Sol Responsável, trocar de empresa" });
    expect(switchers.length).toBeGreaterThan(0);
    switchers.forEach((element) => expect(element).not.toHaveAttribute("aria-label"));
    // Contador de pendências com texto acessível (últimos 31 dias): rótulo visível primeiro
    const approvals = await screen.findAllByRole("link", { name: "Aprovações, 2 pendências" });
    expect(approvals.length).toBeGreaterThan(0);
    approvals.forEach((element) => expect(element).not.toHaveAttribute("aria-label"));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("membro comum não vê Aprovações e é barrado na rota do responsável", async () => {
    seedSession();
    const api = mockFetch([
      { url: "/api/companies", response: jsonResponse([companySummary({ isOwner: false })]) },
      {
        url: "/api/companies/3",
        response: jsonResponse(companyInfo({ myAccess: { memberId: 12, isOwner: false, isManager: false, managedPositionIds: [] } })),
      },
      { url: "/api/companies/3/members/me", response: jsonResponse(memberInfo({ isOwner: false })) },
      { url: "/api/companies/3/punches/me", response: jsonResponse([]) },
      { url: "/api/companies/3/summary/me", response: jsonResponse(emptySummary) },
    ]);

    renderApp("/empresa/cargos");

    expect(await screen.findByRole("heading", { level: 1, name: "Ponto" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(screen.queryByRole("link", { name: "Aprovações" })).not.toBeInTheDocument();
    expect(await screen.findByText("Você não tem acesso a esta área.")).toBeInTheDocument();
    // Quem não aprova não busca o contador
    expect(api.requestsTo("/api/companies/3/approvals")).toHaveLength(0);
  });

  it("lembra a última empresa usada", async () => {
    seedSession();
    localStorage.setItem("pontua:company", JSON.stringify({ userId: 7, companyId: 4 }));
    mockFetch([
      { url: "/api/companies", response: jsonResponse([companySummary(), companySummary({ companyId: 4, name: "Café Lua" })]) },
      { url: "/api/companies/4", response: jsonResponse(companyInfo({ companyId: 4, name: "Café Lua" })) },
      { url: "/api/companies/4/members/me", response: jsonResponse(memberInfo()) },
      { url: "/api/companies/4/punches/me", response: jsonResponse([]) },
      { url: "/api/companies/4/summary/me", response: jsonResponse(emptySummary) },
      { url: "/api/companies/4/approvals", response: jsonResponse([]) },
    ]);

    renderApp("/");

    expect((await screen.findAllByRole("button", { name: /^Café Lua .*, trocar de empresa$/ })).length).toBeGreaterThan(0);
  });
});
