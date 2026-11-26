import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import WelcomePage from "../WelcomePage";
import { jsonResponse, mockFetch } from "../../test/fetchMock";
import { renderRoute, seedSession } from "../../test/renderWithProviders";

const TOKEN = "q3Xy_8-abcdefghijklmnopqrstuvwxyz0123456789";

const renderWelcome = (initialEntry = "/bem-vindo") => {
  seedSession({ name: "Mariana Costa" });
  mockFetch([{ method: "GET", url: "/api/companies", response: jsonResponse([]) }]);
  return renderRoute(<WelcomePage />, {
    path: "/bem-vindo",
    initialEntry,
    extraRoutes: [
      { path: "/convite/:token", element: <p>Tela do convite</p> },
      { path: "/empresas/nova", element: <p>Criar empresa</p> },
    ],
  });
};

describe("WelcomePage", () => {
  it("cumprimenta pelo primeiro nome e oferece os dois caminhos, sem violações", async () => {
    const view = renderWelcome();
    // Deixa a carga das empresas (CompanyProvider) terminar dentro do act
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

    expect(screen.getByRole("heading", { level: 1, name: "Olá, Mariana" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Criar empresa/ })).toHaveAttribute("href", "/empresas/nova");
    expect(screen.getByRole("button", { name: /Tenho um convite/ })).toHaveAttribute("aria-expanded", "false");
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("recusa um link que não é convite, com o erro no campo", async () => {
    const view = renderWelcome();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Tenho um convite/ }));
    await user.type(screen.getByLabelText("Link ou código do convite"), "https://pontua.app/convit");
    await user.click(screen.getByRole("button", { name: "Abrir convite" }));

    const field = screen.getByLabelText("Link ou código do convite");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(
      "Este link não é um convite do Pontua. Confira se copiou o link inteiro.",
    );
    expect(field).toHaveFocus();
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it("extrai o token do link colado e abre o convite", async () => {
    renderWelcome();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Tenho um convite/ }));
    await user.type(screen.getByLabelText("Link ou código do convite"), `https://pontua.site/convite/${TOKEN}`);
    await user.click(screen.getByRole("button", { name: "Abrir convite" }));

    expect(await screen.findByText("Tela do convite")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(`/convite/${TOKEN}`);
  });

  it("aceita só o código e abre já expandido com ?convite=1", async () => {
    renderWelcome("/bem-vindo?convite=1");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Link ou código do convite"), TOKEN);
    await user.click(screen.getByRole("button", { name: "Abrir convite" }));

    expect(await screen.findByText("Tela do convite")).toBeInTheDocument();
  });
});
