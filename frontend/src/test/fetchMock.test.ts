import { emptyResponse, errorResponse, jsonResponse, mockFetch, networkError } from "./fetchMock";

describe("fetchMock", () => {
  it("responde a rota pelo path, com header Date e registro da requisição", async () => {
    const api = mockFetch([
      {
        method: "POST",
        url: "/api/punches",
        response: jsonResponse({ id: 1 }, { status: 201, serverDate: "Wed, 25 Nov 2026 11:02:00 GMT" }),
      },
    ]);

    const response = await fetch("http://localhost:5080/api/punches", {
      method: "POST",
      body: JSON.stringify({ tipo: "entrada" }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("Date")).toBe("Wed, 25 Nov 2026 11:02:00 GMT");
    expect(await response.json()).toEqual({ id: 1 });
    expect(api.requestsTo("/api/punches", "POST")[0]?.body).toEqual({ tipo: "entrada" });
  });

  it("devolve o envelope de erro da API", async () => {
    mockFetch([
      { url: "/api/companies", response: errorResponse(400, "Dados inválidos", [{ campo: "nome", mensagem: "Obrigatório" }]) },
    ]);

    const response = await fetch("/api/companies");

    expect(response.ok).toBe(false);
    expect(await response.json()).toEqual({
      sucesso: false,
      mensagem: "Dados inválidos",
      erros: [{ campo: "nome", mensagem: "Obrigatório" }],
    });
  });

  it("simula falha de rede, respostas únicas e rotas sem correspondência", async () => {
    const api = mockFetch([{ url: "/api/punches/offline", response: networkError, once: true }]);
    api.use({ url: "/api/items", response: emptyResponse() });

    await expect(fetch("/api/punches/offline")).rejects.toThrow(TypeError);
    await expect(fetch("/api/punches/offline")).rejects.toThrow(/nenhuma rota/);
    expect((await fetch("/api/items?x=1")).status).toBe(204);
  });
});
