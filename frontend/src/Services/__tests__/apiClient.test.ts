import { vi } from "vitest";
import {
  ApiError,
  REQUEST_TIMEOUT_MS,
  addNetworkResultListener,
  apiFetch,
  apiRequest,
  buildPath,
  fieldErrorsOf,
  setUnauthorizedHandler,
} from "../apiClient";
import { offlineCache } from "../offlineCache";
import { errorResponse, jsonResponse, mockFetch, networkError } from "../../test/fetchMock";
import { seedSession } from "../../test/renderWithProviders";

describe("apiClient", () => {
  it("converte o envelope de erro em ApiError com os erros por campo", async () => {
    mockFetch([
      {
        method: "POST",
        url: "/api/auth/register",
        response: errorResponse(400, "Dados inválidos.", [
          { campo: "email", mensagem: "Informe um e-mail válido." },
          { campo: "password", mensagem: "A senha precisa ter pelo menos 8 caracteres." },
        ]),
      },
    ]);

    const error = await apiFetch("/api/auth/register", { method: "POST", body: {}, authenticated: false }).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.mensagem).toBe("Dados inválidos.");
    expect(apiError.fieldError("email")).toBe("Informe um e-mail válido.");
    expect(fieldErrorsOf(apiError)).toEqual({
      email: "Informe um e-mail válido.",
      password: "A senha precisa ter pelo menos 8 caracteres.",
    });
  });

  it("não expõe o texto puro de um 500", async () => {
    mockFetch([{ url: "/api/companies", response: new Response("NullReferenceException at ...", { status: 500 }) }]);
    seedSession();

    const error = (await apiFetch("/api/companies").catch((err: unknown) => err)) as ApiError;

    expect(error.status).toBe(500);
    expect(error.mensagem).not.toContain("NullReference");
  });

  it("envia o Bearer da sessão e devolve o DTO sem envelope", async () => {
    seedSession();
    const api = mockFetch([{ url: "/api/auth/me", response: jsonResponse({ userId: 7, name: "Ana" }) }]);

    const data = await apiFetch<{ userId: number }>("/api/auth/me");

    expect(data.userId).toBe(7);
    expect(api.requests[0]?.headers.get("Authorization")).toBe("Bearer token-de-teste");
  });

  it("401 em chamada autenticada chama onUnauthorized; em chamada anônima, não", async () => {
    seedSession();
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    mockFetch([
      { url: "/api/auth/me", response: errorResponse(401, "Sessão inválida.") },
      { url: "/api/auth/login", response: errorResponse(401, "E-mail ou senha inválidos.") },
    ]);

    await expect(apiFetch("/api/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    await expect(
      apiFetch("/api/auth/login", { method: "POST", body: {}, authenticated: false, allowOffline: true }),
    ).rejects.toMatchObject({ mensagem: "E-mail ou senha inválidos." });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("desiste após 10 s sem resposta com ApiError(0) e avisa offline", async () => {
    vi.useFakeTimers();
    const results: boolean[] = [];
    addNetworkResultListener((result) => results.push(result.online));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          }),
      ),
    );

    const promise = apiFetch("/api/companies", { authenticated: false });
    const assertion = expect(promise).rejects.toMatchObject({ status: 0, offline: true });

    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(results).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(results).toEqual([false]);
  });

  it("escrita sem conexão é recusada sem chamar fetch", async () => {
    seedSession();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const api = mockFetch([{ method: "PUT", url: "/api/auth/me", response: jsonResponse({}) }]);

    await expect(apiFetch("/api/auth/me", { method: "PUT", body: { name: "Ana" } })).rejects.toMatchObject({
      status: 0,
      offline: true,
    });
    expect(api.fn).not.toHaveBeenCalled();
  });

  it("depois de uma falha de rede, bloqueia escrita até a próxima resposta", async () => {
    seedSession();
    const api = mockFetch([{ method: "GET", url: "/api/auth/me", response: networkError, once: true }]);

    await expect(apiFetch("/api/auth/me")).rejects.toMatchObject({ status: 0 });
    await expect(apiFetch("/api/auth/me", { method: "PUT", body: {} })).rejects.toMatchObject({ offline: true });
    expect(api.requestsTo("/api/auth/me", "PUT")).toHaveLength(0);

    api.use({ method: "GET", url: "/api/auth/me", response: jsonResponse({ userId: 7 }) });
    api.use({ method: "PUT", url: "/api/auth/me", response: jsonResponse({ userId: 7 }) });
    await apiFetch("/api/auth/me");
    await expect(apiFetch("/api/auth/me", { method: "PUT", body: {} })).resolves.toEqual({ userId: 7 });
  });

  it("network-first grava a resposta e, sem rede, devolve o dado guardado com stale e fetchedAt", async () => {
    seedSession();
    const companies = [{ companyId: 3, name: "Padaria Sol" }];
    const api = mockFetch([{ url: "/api/companies", response: jsonResponse(companies) }]);

    const fresh = await apiRequest<typeof companies>("/api/companies", { cache: "network-first" });
    expect(fresh).toMatchObject({ data: companies, stale: false });

    await vi.waitFor(async () => expect(await offlineCache.get(7, "/api/companies")).toBeDefined());
    const entry = await offlineCache.get(7, "/api/companies");

    api.use({ url: "/api/companies", response: networkError });
    const cached = await apiRequest<typeof companies>("/api/companies", { cache: "network-first" });

    expect(cached).toEqual({ data: companies, stale: true, fetchedAt: entry?.fetchedAt });
  });

  it("sem rede e sem dado guardado, network-first falha como offline", async () => {
    seedSession();
    mockFetch([{ url: "/api/companies", response: networkError }]);

    await expect(apiRequest("/api/companies", { cache: "network-first" })).rejects.toMatchObject({
      status: 0,
      offline: true,
    });
  });

  it("resposta não-2xx não é gravada no cache", async () => {
    seedSession();
    mockFetch([{ url: "/api/companies", response: errorResponse(500, "Falhou.") }]);

    await expect(apiRequest("/api/companies", { cache: "network-first" })).rejects.toMatchObject({ status: 500 });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(await offlineCache.get(7, "/api/companies")).toBeUndefined();
  });

  it("usa a query como parte da chave do cache", async () => {
    seedSession();
    mockFetch([{ url: /\/api\/companies\/3\/punches\/me/, response: jsonResponse([]) }]);

    await apiRequest("/api/companies/3/punches/me", { cache: "network-first", query: { month: "2026-11", x: "" } });

    await vi.waitFor(async () =>
      expect(await offlineCache.get(7, "/api/companies/3/punches/me?month=2026-11")).toBeDefined(),
    );
    expect(buildPath("/a", { start: "2026-11-01", end: "2026-11-15", empty: null })).toBe(
      "/a?start=2026-11-01&end=2026-11-15",
    );
  });

  it("calcula o serverOffset a partir do header Date", async () => {
    const offsets: Array<number | undefined> = [];
    addNetworkResultListener((result) => offsets.push(result.serverOffset));
    mockFetch([
      { url: "/health", response: jsonResponse({}, { serverDate: new Date(Date.now() + 120_000) }) },
    ]);

    await apiFetch("/health", { authenticated: false });

    expect(offsets[0]).toBeGreaterThan(118_000);
    expect(offsets[0]).toBeLessThan(121_000);
  });
});
