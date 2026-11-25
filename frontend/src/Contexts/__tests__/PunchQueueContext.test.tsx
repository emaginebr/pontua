import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "../../hooks/useAuth";
import { usePunchQueue } from "../../hooks/usePunchQueue";
import { AUTH_STORAGE_KEY } from "../../Services/authSession";
import { punchQueue, STUCK_SENDING_MS } from "../../Services/punchQueue";
import { errorResponse, jsonResponse, mockFetch, networkError } from "../../test/fetchMock";
import type { MockHandler, MockRoute } from "../../test/fetchMock";
import { renderRoute, seedSession, waitForAppReady } from "../../test/renderWithProviders";
import type { OfflinePunchBatch, OfflineSyncItemResultCode } from "../../types/punch";

const ISO = "2026-11-25T08:02:41-03:00";

const Harness = () => {
  const { waiting, rejected, items, dismissRejected } = usePunchQueue();
  const { logout } = useAuth();
  return (
    <div>
      <p data-testid="waiting">{waiting}</p>
      <p data-testid="rejected">{rejected.map((item) => `${item.clientId}:${item.rejectReason ?? ""}`).join(",")}</p>
      <p data-testid="total">{items.length}</p>
      {rejected.map((item) => (
        <button key={item.clientId} type="button" onClick={() => void dismissRejected(item.clientId)}>
          Dispensar {item.clientId}
        </button>
      ))}
      <button type="button" onClick={logout}>
        Sair
      </button>
    </div>
  );
};

/** Responde cada item do lote com o resultado escolhido (padrão `created`). */
const syncHandler =
  (results: Record<string, OfflineSyncItemResultCode> = {}): MockHandler =>
  (request) => {
    const batch = request.body as OfflinePunchBatch;
    return jsonResponse({
      items: batch.items.map((item) => ({
        clientId: item.clientId,
        result: results[item.clientId] ?? "created",
        punch: null,
      })),
    });
  };

const setup = (routes: MockRoute[] = []) => {
  seedSession();
  const api = mockFetch([{ method: "GET", url: "/api/companies", response: jsonResponse([]) }, ...routes]);
  renderRoute(<Harness />);
  return api;
};

const batchIds = (body: unknown): string[] => (body as OfflinePunchBatch).items.map((item) => item.clientId);

describe("PunchQueueContext", () => {
  it("envia ao abrir em lotes por empresa; created e duplicate saem da fila sem duplicar", async () => {
    await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO, clientId: "a" });
    await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO, clientId: "b" });
    await punchQueue.enqueue({ userId: 7, companyId: 4, punchedAt: ISO, clientId: "c" });
    const api = setup([
      { method: "POST", url: "/api/companies/3/punches/offline", response: syncHandler({ b: "duplicate" }) },
      { method: "POST", url: "/api/companies/4/punches/offline", response: syncHandler() },
    ]);

    // "total" começa em 0 antes de a fila ser lida: espera os envios e só então a fila vazia
    await waitFor(() => expect(api.requestsTo("/api/companies/4/punches/offline", "POST")).toHaveLength(1));
    await waitFor(() => expect(screen.getByTestId("total")).toHaveTextContent("0"));

    const toCompany3 = api.requestsTo("/api/companies/3/punches/offline", "POST");
    const toCompany4 = api.requestsTo("/api/companies/4/punches/offline", "POST");
    expect(toCompany3).toHaveLength(1);
    expect(batchIds(toCompany3[0]?.body).sort()).toEqual(["a", "b"]);
    expect(toCompany3[0]?.body).toEqual({
      items: expect.arrayContaining([{ clientId: "a", punchedAt: ISO }]) as unknown,
    });
    expect(toCompany4).toHaveLength(1);
    expect(batchIds(toCompany4[0]?.body)).toEqual(["c"]);
    expect(await punchQueue.listByUser(7)).toEqual([]);
    expect(await screen.findByText("3 marcações enviadas.")).toBeInTheDocument();
  });

  it("divide em lotes de no máximo 50", async () => {
    for (let index = 0; index < 51; index += 1) {
      await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO, clientId: `id-${index}` });
    }
    const api = setup([{ method: "POST", url: "/api/companies/3/punches/offline", response: syncHandler() }]);

    await waitFor(() => expect(api.requestsTo("/api/companies/3/punches/offline", "POST")).toHaveLength(2));
    await waitFor(() => expect(screen.getByTestId("total")).toHaveTextContent("0"));
    const sizes = api.requestsTo("/api/companies/3/punches/offline", "POST").map((request) => batchIds(request.body).length);
    expect(sizes).toEqual([50, 1]);
  });

  it("future e too_old viram recusadas com aviso e ficam até dispensar", async () => {
    await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO, clientId: "futura" });
    await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO, clientId: "antiga" });
    setup([
      {
        method: "POST",
        url: "/api/companies/3/punches/offline",
        response: syncHandler({ futura: "future", antiga: "too_old" }),
      },
    ]);

    await waitFor(() => expect(screen.getByTestId("rejected")).toHaveTextContent(/futura:future/));
    expect(screen.getByTestId("rejected")).toHaveTextContent(/antiga:too_old/);
    expect(screen.getByTestId("waiting")).toHaveTextContent("0");
    expect(await screen.findByText("2 marcações feitas sem conexão foram recusadas.")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Dispensar futura" }));
    await waitFor(() => expect(screen.getByTestId("total")).toHaveTextContent("1"));
    expect((await punchQueue.listByUser(7)).map((item) => item.clientId)).toEqual(["antiga"]);
  });

  it("falha de rede devolve as marcações para waiting", async () => {
    await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO, clientId: "a" });
    const api = setup([{ method: "POST", url: "/api/companies/3/punches/offline", response: networkError }]);

    await waitFor(() => expect(api.requestsTo("/api/companies/3/punches/offline", "POST")).toHaveLength(1));
    await waitFor(async () => expect((await punchQueue.listByUser(7))[0]?.state).toBe("waiting"));
    await waitFor(() => expect(screen.getByTestId("waiting")).toHaveTextContent("1"));
    const [item] = await punchQueue.listByUser(7);
    expect(item?.state).toBe("waiting");
    expect(item?.sendingAt).toBeNull();
  });

  it("item em sending travado volta para waiting na abertura e é reenviado com o mesmo clientId", async () => {
    await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO, clientId: "travado" });
    await punchQueue.markSending(["travado"], new Date(Date.now() - STUCK_SENDING_MS - 1_000));
    const api = setup([{ method: "POST", url: "/api/companies/3/punches/offline", response: syncHandler() }]);

    await waitFor(() => expect(api.requestsTo("/api/companies/3/punches/offline", "POST")).toHaveLength(1));
    await waitFor(() => expect(screen.getByTestId("total")).toHaveTextContent("0"));
    expect(batchIds(api.requestsTo("/api/companies/3/punches/offline", "POST")[0]?.body)).toEqual(["travado"]);
  });

  it("só envia as marcações do usuário logado; as de outra pessoa ficam guardadas", async () => {
    await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO, clientId: "de-outro" });
    await punchQueue.enqueue({ userId: 8, companyId: 3, punchedAt: ISO, clientId: "minha" });
    seedSession({ userId: 8 });
    const api = mockFetch([
      { method: "GET", url: "/api/companies", response: jsonResponse([]) },
      { method: "POST", url: "/api/companies/3/punches/offline", response: syncHandler() },
    ]);
    renderRoute(<Harness />);
    await waitForAppReady();

    const sent = api.requestsTo("/api/companies/3/punches/offline", "POST").flatMap((request) => batchIds(request.body));
    expect(sent).toEqual(["minha"]);
    expect(await punchQueue.listByUser(8)).toEqual([]);
    expect((await punchQueue.listByUser(7)).map((item) => item.clientId)).toEqual(["de-outro"]);
    expect(screen.getByTestId("total")).toHaveTextContent("0");
  });

  it("sair da conta não apaga a fila: as marcações esperam o próximo acesso", async () => {
    await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO, clientId: "minha" });
    await punchQueue.enqueue({ userId: 8, companyId: 3, punchedAt: ISO, clientId: "de-outro" });
    setup([{ method: "POST", url: "/api/companies/3/punches/offline", response: networkError }]);
    await waitForAppReady();
    expect(screen.getByTestId("total")).toHaveTextContent("1");

    await userEvent.setup().click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() => expect(screen.getByTestId("total")).toHaveTextContent("0"));
    expect((await punchQueue.listByUser(7)).map((item) => item.clientId)).toEqual(["minha"]);
    expect(await punchQueue.listByUser(8)).toHaveLength(1);
  });

  it("401 (sessão recusada) também não apaga a fila", async () => {
    await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO, clientId: "minha" });
    setup([
      { method: "POST", url: "/api/companies/3/punches/offline", response: errorResponse(401, "Sessão expirada.") },
    ]);

    await waitFor(() => expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull());
    await waitFor(async () => expect((await punchQueue.listByUser(7))[0]?.state).toBe("waiting"));
    expect((await punchQueue.listByUser(7)).map((item) => item.clientId)).toEqual(["minha"]);
    expect(screen.getByTestId("total")).toHaveTextContent("0");
  });
});
