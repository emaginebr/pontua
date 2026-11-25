import { closePunchQueue, PunchQueueUnavailableError, STUCK_SENDING_MS, createClientId, punchQueue } from "../punchQueue";

const ISO = "2026-11-25T08:02:41-03:00";

describe("punchQueue (IndexedDB pontua-queue)", () => {
  it("enfileira como waiting, com clientId uuid, e lista só as do usuário", async () => {
    const item = await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO });
    await punchQueue.enqueue({ userId: 8, companyId: 3, punchedAt: ISO });

    expect(item.state).toBe("waiting");
    expect(item.rejectReason).toBeNull();
    expect(item.clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const mine = await punchQueue.listByUser(7);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ clientId: item.clientId, companyId: 3, punchedAt: ISO });
  });

  it("transições: sending → waiting, rejected com motivo e remoção", async () => {
    const a = await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO, clientId: "a" });
    const b = await punchQueue.enqueue({ userId: 7, companyId: 4, punchedAt: ISO, clientId: "b" });

    await punchQueue.markSending([a.clientId, b.clientId]);
    expect(await punchQueue.listByState(7, "sending")).toHaveLength(2);

    await punchQueue.markWaiting([a.clientId]);
    await punchQueue.markRejected(b.clientId, "too_old");
    expect((await punchQueue.listByState(7, "waiting")).map((item) => item.clientId)).toEqual(["a"]);
    const rejected = await punchQueue.listByState(7, "rejected");
    expect(rejected[0]).toMatchObject({ clientId: "b", rejectReason: "too_old", sendingAt: null });

    await punchQueue.remove(["a", "b"]);
    expect(await punchQueue.listByUser(7)).toEqual([]);
  });

  it("sending travado há mais de 1 minuto volta para waiting; o recente continua", async () => {
    await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO, clientId: "velho" });
    await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO, clientId: "novo" });
    await punchQueue.markSending(["velho"], new Date(Date.now() - STUCK_SENDING_MS - 5_000));
    await punchQueue.markSending(["novo"], new Date());

    expect(await punchQueue.resetStuckSending()).toBe(1);

    const items = await punchQueue.listByUser(7);
    expect(items.find((item) => item.clientId === "velho")?.state).toBe("waiting");
    expect(items.find((item) => item.clientId === "novo")?.state).toBe("sending");
  });

  it("clearUser apaga só a fila do usuário", async () => {
    await punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO });
    await punchQueue.enqueue({ userId: 7, companyId: 4, punchedAt: ISO });
    await punchQueue.enqueue({ userId: 8, companyId: 3, punchedAt: ISO });

    await punchQueue.clearUser(7);

    expect(await punchQueue.listByUser(7)).toEqual([]);
    expect(await punchQueue.listByUser(8)).toHaveLength(1);
  });

  it("sem IndexedDB: enqueue avisa que não dá para guardar e as leituras ficam vazias", async () => {
    await closePunchQueue();
    vi.stubGlobal("indexedDB", undefined);

    expect(await punchQueue.isAvailable()).toBe(false);
    await expect(punchQueue.enqueue({ userId: 7, companyId: 3, punchedAt: ISO })).rejects.toBeInstanceOf(
      PunchQueueUnavailableError,
    );
    expect(await punchQueue.listByUser(7)).toEqual([]);
  });

  it("gera ids diferentes a cada marcação", () => {
    expect(createClientId()).not.toBe(createClientId());
  });
});
