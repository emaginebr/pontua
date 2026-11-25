import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "../AuthContext";
import { useAuth } from "../../hooks/useAuth";
import { apiFetch } from "../../Services/apiClient";
import {
  AUTH_STORAGE_KEY,
  COMPANY_STORAGE_KEY,
  RETURN_TO_STORAGE_KEY,
} from "../../Services/authSession";
import { offlineCache } from "../../Services/offlineCache";
import { errorResponse, jsonResponse, mockFetch } from "../../test/fetchMock";
import { TEST_USER, seedSession } from "../../test/renderWithProviders";

const Probe = () => {
  const { user, isAuthenticated, sessionExpired, login, logout } = useAuth();
  return (
    <div>
      <p data-testid="status">{isAuthenticated ? `logado:${user?.name}` : "anonimo"}</p>
      <p data-testid="expired">{sessionExpired ? "expirou" : "ativa"}</p>
      <button type="button" onClick={() => void login({ email: "ana@ex.com", password: "segredo123" }).catch(() => undefined)}>
        entrar
      </button>
      <button type="button" onClick={logout}>
        sair
      </button>
    </div>
  );
};

const renderAuth = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

describe("AuthContext", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("restaura a sessão válida guardada", () => {
    seedSession();
    renderAuth();
    expect(screen.getByTestId("status")).toHaveTextContent("logado:Ana Silva");
  });

  it("descarta a sessão expirada na abertura", () => {
    seedSession({}, new Date(Date.now() - 1000).toISOString());
    renderAuth();
    expect(screen.getByTestId("status")).toHaveTextContent("anonimo");
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("descarta sessão corrompida", () => {
    localStorage.setItem(AUTH_STORAGE_KEY, "{nao-e-json");
    renderAuth();
    expect(screen.getByTestId("status")).toHaveTextContent("anonimo");
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("entra e grava a sessão em pontua:auth", async () => {
    mockFetch([
      {
        method: "POST",
        url: "/api/auth/login",
        response: jsonResponse({
          token: "novo-token",
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          isNewUser: false,
          user: TEST_USER,
        }),
      },
    ]);
    renderAuth();

    await userEvent.click(screen.getByRole("button", { name: "entrar" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("logado:Ana Silva"));
    const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "{}") as { token?: string };
    expect(stored.token).toBe("novo-token");
  });

  it("401 limpa sessão, empresa e cache do usuário e guarda o returnTo", async () => {
    seedSession();
    localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify({ userId: 7, companyId: 3 }));
    await offlineCache.set(7, "/api/companies", [{ companyId: 3 }]);
    window.history.replaceState({}, "", "/historico?month=2026-10");
    mockFetch([{ url: "/api/auth/me", response: errorResponse(401, "Token expirado.") }]);
    renderAuth();

    await act(async () => {
      await apiFetch("/api/auth/me").catch(() => undefined);
    });

    expect(screen.getByTestId("status")).toHaveTextContent("anonimo");
    expect(screen.getByTestId("expired")).toHaveTextContent("expirou");
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(COMPANY_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(RETURN_TO_STORAGE_KEY)).toBe("/historico?month=2026-10");
    await waitFor(async () => expect(await offlineCache.get(7, "/api/companies")).toBeUndefined());
  });

  it("logout limpa a sessão sem marcar como expirada nem guardar returnTo", async () => {
    seedSession();
    localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify({ userId: 7, companyId: 3 }));
    renderAuth();

    await userEvent.click(screen.getByRole("button", { name: "sair" }));

    expect(screen.getByTestId("status")).toHaveTextContent("anonimo");
    expect(screen.getByTestId("expired")).toHaveTextContent("ativa");
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(COMPANY_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(RETURN_TO_STORAGE_KEY)).toBeNull();
  });
});
