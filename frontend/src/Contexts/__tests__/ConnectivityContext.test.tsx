import { useEffect, useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ConnectivityProvider, OFFLINE_BANNER_DELAY_MS, RECONNECTED_NOTICE_MS } from "../ConnectivityContext";
import { useConnectivity } from "../../hooks/useConnectivity";
import { apiFetch, pingApi } from "../../Services/apiClient";
import { jsonResponse, mockFetch, networkError } from "../../test/fetchMock";

const Probe = () => {
  const { status, showBanner, justReconnected, serverOffset, onReconnected } = useConnectivity();
  const [reconnections, setReconnections] = useState(0);
  useEffect(() => onReconnected(() => setReconnections((value) => value + 1)), [onReconnected]);
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="banner">{showBanner ? "banner" : "sem-banner"}</p>
      <p data-testid="reconnected">{justReconnected ? "voltou" : "-"}</p>
      <p data-testid="count">{reconnections}</p>
      <p data-testid="offset">{serverOffset}</p>
    </div>
  );
};

const renderProbe = () =>
  render(
    <ConnectivityProvider>
      <Probe />
    </ConnectivityProvider>,
  );

describe("ConnectivityContext", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("mostra o aviso só após 2 s offline contínuos", () => {
    renderProbe();

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByTestId("status")).toHaveTextContent("offline");

    act(() => {
      vi.advanceTimersByTime(OFFLINE_BANNER_DELAY_MS - 1);
    });
    expect(screen.getByTestId("banner")).toHaveTextContent("sem-banner");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("banner")).toHaveTextContent(/^banner$/);
  });

  it("não pisca o aviso numa queda curta, mas avisa a reconexão", async () => {
    const api = mockFetch([{ url: "/api/auth/me", response: networkError, once: true }]);
    renderProbe();

    await act(async () => {
      await apiFetch("/api/auth/me", { authenticated: false }).catch(() => undefined);
    });
    expect(screen.getByTestId("status")).toHaveTextContent("offline");

    api.use({ url: "/api/auth/me", response: jsonResponse({}) });
    await act(async () => {
      vi.advanceTimersByTime(500);
      await apiFetch("/api/auth/me", { authenticated: false });
    });

    expect(screen.getByTestId("status")).toHaveTextContent("online");
    expect(screen.getByTestId("banner")).toHaveTextContent("sem-banner");
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("reconnected")).toHaveTextContent("-");
  });

  it("dispara reconnected e mostra 'Conexão restabelecida' por 3 s depois do aviso", async () => {
    mockFetch([{ url: "/health", response: jsonResponse({}) }]);
    renderProbe();

    // Evento e avanço do relógio em `act` separados: o timer do aviso nasce no efeito
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    act(() => {
      vi.advanceTimersByTime(OFFLINE_BANNER_DELAY_MS);
    });
    expect(screen.getByTestId("banner")).toHaveTextContent(/^banner$/);

    // O evento `online` confirma a conexão com um ping (aqui aguardado explicitamente)
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await pingApi();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId("status")).toHaveTextContent("online");
    expect(screen.getByTestId("banner")).toHaveTextContent("sem-banner");
    expect(screen.getByTestId("reconnected")).toHaveTextContent("voltou");
    expect(screen.getByTestId("count")).toHaveTextContent("1");

    act(() => {
      vi.advanceTimersByTime(RECONNECTED_NOTICE_MS);
    });
    expect(screen.getByTestId("reconnected")).toHaveTextContent("-");
  });

  it("guarda o serverOffset do header Date", async () => {
    mockFetch([{ url: "/health", response: jsonResponse({}, { serverDate: new Date(Date.now() + 90_000) }) }]);
    renderProbe();

    await act(async () => {
      await apiFetch("/health", { authenticated: false });
    });

    const offset = Number(screen.getByTestId("offset").textContent);
    expect(offset).toBeGreaterThan(88_000);
    expect(offset).toBeLessThanOrEqual(90_000);
  });
});
