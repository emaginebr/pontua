import { screen, within } from "@testing-library/react";
import MembersPage from "../MembersPage";
import { jsonResponse, mockFetch } from "../../test/fetchMock";
import { setMatchMedia } from "../../test/matchMedia";
import {
  axeInAct,
  companyInfo,
  companySummary,
  memberInfo,
  renderRouteReady,
  seedSession,
} from "../../test/renderWithProviders";
import { DESKTOP_QUERY } from "../../hooks/useMediaQuery";

const members = [
  memberInfo(),
  memberInfo({
    memberId: 15,
    userId: 22,
    name: "Bruno Carvalho de Albuquerque Figueiredo",
    email: "bruno@ex.com",
    isOwner: false,
    position: { positionId: 4, name: "Atendente" },
    joinedAt: "2026-11-03T12:00:00Z",
  }),
];

const setup = async () => {
  seedSession();
  mockFetch([
    { method: "GET", url: "/api/companies", response: jsonResponse([companySummary()]) },
    { method: "GET", url: "/api/companies/3", response: jsonResponse(companyInfo()) },
    { method: "GET", url: "/api/companies/3/members/me", response: jsonResponse(memberInfo()) },
    { method: "GET", url: "/api/companies/3/members", response: jsonResponse(members) },
    { method: "GET", url: "/api/companies/3/positions", response: jsonResponse([]) },
  ]);
  const view = await renderRouteReady(<MembersPage />, { path: "/empresa/membros", initialEntry: "/empresa/membros" });
  await screen.findByText("Bruno Carvalho de Albuquerque Figueiredo");
  return view;
};

describe("MembersPage", () => {
  it("celular: nome quebra linha (sem reticências), mostra (você), papel e 'desde' em linha própria (B-03)", async () => {
    const view = await setup();

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const name = screen.getByText("Bruno Carvalho de Albuquerque Figueiredo");
    expect(name).toHaveClass("break-words");
    expect(name).not.toHaveClass("truncate");
    expect(screen.getByText("(você)")).toBeInTheDocument();
    expect(screen.getByText("desde 03/11/2026")).toBeInTheDocument();
    expect(view.container.querySelector(".truncate")).toBeNull();
    expect(screen.getByRole("link", { name: /Bruno Carvalho de Albuquerque Figueiredo/ })).toHaveAttribute(
      "href",
      "/empresa/membros/15",
    );
    expect(await axeInAct(view.container)).toHaveNoViolations();
  });

  it("computador: tabela Nome · Cargo · Papel · Desde · Situação com link para o detalhe (I-17)", async () => {
    setMatchMedia((query) => query === DESKTOP_QUERY);
    const view = await setup();

    const table = screen.getByRole("table", { name: "Membros da empresa" });
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent);
    expect(headers).toEqual(["Nome", "Cargo", "Papel", "Desde", "Situação"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    const bruno = rows.find((row) => within(row).queryByText("Atendente"));
    expect(bruno).toBeDefined();
    const row = within(bruno as HTMLElement);
    expect(row.getByRole("link", { name: "Bruno Carvalho de Albuquerque Figueiredo" })).toHaveAttribute(
      "href",
      "/empresa/membros/15",
    );
    expect(row.getByText("Membro")).toBeInTheDocument();
    expect(row.getByText("03/11/2026")).toBeInTheDocument();
    expect(row.getByText("Ativo")).toBeInTheDocument();
    expect(await axeInAct(view.container)).toHaveNoViolations();
  });
});
