import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import InvitationsPage from "../InvitationsPage";
import { emptyResponse, jsonResponse, mockFetch } from "../../test/fetchMock";
import type { MockRoute } from "../../test/fetchMock";
import { companyInfo, companySummary, memberInfo, renderRouteReady, seedSession } from "../../test/renderWithProviders";
import type { InvitationInfo } from "../../types/invitation";
import type { PositionInfo } from "../../types/position";

const URL_ATENDENTE = "https://pontua.site/convite/q3Xy_8-abcdefghijklmnopqrstuvwxyz0123456789";

const invitation = (overrides: Partial<InvitationInfo> = {}): InvitationInfo => ({
  invitationId: 5,
  position: { positionId: 4, name: "Atendente" },
  token: "q3Xy_8-abcdefghijklmnopqrstuvwxyz0123456789",
  url: URL_ATENDENTE,
  status: "active",
  expiresAt: "2026-12-02T15:00:00Z",
  acceptedCount: 2,
  createdBy: "Ana Silva",
  createdAt: "2026-11-25T15:00:00Z",
  ...overrides,
});

const positions: PositionInfo[] = [
  { positionId: 4, name: "Atendente", activeMembers: 6, currentSchedule: null },
  { positionId: 6, name: "Padeiro", activeMembers: 3, currentSchedule: null },
];

const setup = async (routes: MockRoute[] = [], list: InvitationInfo[] = [invitation()]) => {
  seedSession();
  const api = mockFetch([
    ...routes,
    { method: "GET", url: "/api/companies", response: jsonResponse([companySummary()]) },
    { method: "GET", url: "/api/companies/3", response: jsonResponse(companyInfo()) },
    { method: "GET", url: "/api/companies/3/members/me", response: jsonResponse(memberInfo()) },
    { method: "GET", url: "/api/companies/3/invitations", response: jsonResponse(list) },
    { method: "GET", url: "/api/companies/3/positions", response: jsonResponse(positions) },
  ]);
  const user = userEvent.setup();
  const view = await renderRouteReady(<InvitationsPage />, { path: "/empresa/convites", initialEntry: "/empresa/convites" });
  return { api, user, view };
};

const setShare = (share: ((data: ShareData) => Promise<void>) | undefined) => {
  Object.defineProperty(navigator, "share", { value: share, configurable: true, writable: true });
};

describe("InvitationsPage", () => {
  afterEach(() => {
    setShare(undefined);
  });

  it("lista convites do mês com situação, validade e aceites, sem violações", async () => {
    const { api, view } = await setup([], [invitation(), invitation({ invitationId: 6, status: "revoked", acceptedCount: 0 })]);

    expect(await screen.findAllByRole("heading", { level: 2, name: "Atendente" })).toHaveLength(2);
    const [active, revoked] = screen
      .getAllByRole("heading", { level: 2, name: "Atendente" })
      .map((heading) => heading.closest("li") as HTMLElement);
    expect(within(active as HTMLElement).getByText("Ativo")).toBeInTheDocument();
    expect(within(active as HTMLElement).getByText(/Vale até 02\/12 · 2 pessoas aceitaram/)).toBeInTheDocument();
    expect(within(revoked as HTMLElement).getByText("Revogado")).toBeInTheDocument();
    // Só o convite ativo tem ações
    expect(screen.getAllByRole("button", { name: /^Revogar convite de/ })).toHaveLength(1);
    expect(api.requestsTo("/api/companies/3/invitations", "GET")[0]?.path).toMatch(/month=\d{4}-\d{2}/);
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("filtra por situação repassando o status à API", async () => {
    const { api, user } = await setup();
    await screen.findAllByRole("heading", { level: 2, name: "Atendente" });

    await user.selectOptions(screen.getByLabelText("Situação"), "expired");

    await waitFor(() =>
      expect(api.requestsTo("/api/companies/3/invitations", "GET").some((request) => request.path.includes("status=expired"))).toBe(true),
    );
  });

  it("compartilha pelo menu nativo quando o aparelho oferece", async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>().mockResolvedValue(undefined);
    setShare(share);
    const { user } = await setup();

    await user.click(await screen.findByRole("button", { name: "Compartilhar convite de Atendente" }));

    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: URL_ATENDENTE }));
  });

  it("sem menu nativo, copia o link e avisa", async () => {
    const { user } = await setup();

    await screen.findAllByRole("heading", { level: 2, name: "Atendente" });
    expect(screen.queryByRole("button", { name: /^Compartilhar/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copiar link do convite de Atendente" }));

    expect(await navigator.clipboard.readText()).toBe(URL_ATENDENTE);
    expect(await screen.findByText("Link copiado")).toBeInTheDocument();
  });

  it("revoga com confirmação", async () => {
    const { api, user } = await setup([
      { method: "POST", url: "/api/companies/3/invitations/5/revoke", response: emptyResponse() },
    ]);

    await user.click(await screen.findByRole("button", { name: "Revogar convite de Atendente" }));
    const dialog = await screen.findByRole("dialog", { name: "Revogar convite?" });
    // Ação destrutiva: foco inicial em Cancelar
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Revogar convite" }));

    await waitFor(() => expect(api.requestsTo("/api/companies/3/invitations/5/revoke", "POST")).toHaveLength(1));
    const item = screen.getByRole("heading", { level: 2, name: "Atendente" }).closest("li") as HTMLElement;
    expect(await within(item).findByText("Revogado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revogar convite de Atendente" })).not.toBeInTheDocument();
  });

  it("gera convite com cargo e validade e mostra o link para copiar", async () => {
    const created = invitation({ invitationId: 9, position: { positionId: 6, name: "Padeiro" }, acceptedCount: 0 });
    const { api, user } = await setup([
      { method: "POST", url: "/api/companies/3/invitations", response: jsonResponse(created, { status: 201 }) },
    ]);
    await screen.findAllByRole("heading", { level: 2, name: "Atendente" });

    await user.click(screen.getByRole("button", { name: "Gerar convite" }));
    const dialog = await screen.findByRole("dialog", { name: "Novo convite" });
    await within(dialog).findByRole("option", { name: "Padeiro" });
    await user.click(within(dialog).getByRole("button", { name: "Gerar convite" }));
    expect(within(dialog).getByLabelText("Cargo")).toHaveAccessibleDescription("Escolha o cargo do convite.");

    await user.selectOptions(within(dialog).getByLabelText("Cargo"), "6");
    const days = within(dialog).getByLabelText("Validade (dias)");
    await user.clear(days);
    await user.type(days, "15");
    await user.click(within(dialog).getByRole("button", { name: "Gerar convite" }));

    const done = await screen.findByRole("dialog", { name: "Convite criado" });
    expect(api.requestsTo("/api/companies/3/invitations", "POST")[0]?.body).toEqual({ positionId: 6, expiresInDays: 15 });
    expect(within(done).getByLabelText("Link do convite")).toHaveValue(URL_ATENDENTE);
    await user.click(within(done).getByRole("button", { name: "Copiar link" }));
    expect(await within(done).findByRole("button", { name: "Copiado" })).toBeInTheDocument();
  });
});
