import { vi } from "vitest";
import {
  OFFLINE_CACHE_DB_NAME,
  OFFLINE_CACHE_DB_VERSION,
  OFFLINE_CACHE_SCHEMA_VERSION,
  OFFLINE_CACHE_STORE,
  closeOfflineCache,
  offlineCache,
  toCacheKey,
} from "../offlineCache";

/** Grava um registro direto no IndexedDB (simula versão antiga do app). */
const putRaw = (record: Record<string, unknown>): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_CACHE_DB_NAME, OFFLINE_CACHE_DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(OFFLINE_CACHE_STORE, "readwrite");
      tx.objectStore(OFFLINE_CACHE_STORE).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });

describe("offlineCache", () => {
  it("grava e lê por usuário e caminho", async () => {
    await offlineCache.set(1, "/api/companies", [{ companyId: 3 }]);

    const entry = await offlineCache.get(1, "/api/companies");

    expect(entry).toMatchObject({
      key: "1:/api/companies",
      userId: 1,
      data: [{ companyId: 3 }],
      schemaVersion: OFFLINE_CACHE_SCHEMA_VERSION,
    });
    expect(Number.isNaN(Date.parse(entry?.fetchedAt ?? ""))).toBe(false);
  });

  it("isola os dados por usuário e limpa só o usuário pedido", async () => {
    await offlineCache.set(1, "/api/companies", ["de 1"]);
    await offlineCache.set(2, "/api/companies", ["de 2"]);

    expect(await offlineCache.get(2, "/api/companies")).toMatchObject({ data: ["de 2"] });
    expect(await offlineCache.get(3, "/api/companies")).toBeUndefined();

    await offlineCache.clearUser(1);

    expect(await offlineCache.get(1, "/api/companies")).toBeUndefined();
    expect(await offlineCache.get(2, "/api/companies")).toMatchObject({ data: ["de 2"] });

    await offlineCache.clearAll();
    expect(await offlineCache.get(2, "/api/companies")).toBeUndefined();
  });

  it("descarta registro com versão de formato incompatível", async () => {
    await offlineCache.set(1, "/outro", "cria o banco");
    await putRaw({
      key: toCacheKey(1, "/api/companies"),
      userId: 1,
      path: "/api/companies",
      data: ["antigo"],
      fetchedAt: new Date().toISOString(),
      schemaVersion: OFFLINE_CACHE_SCHEMA_VERSION + 1,
    });

    expect(await offlineCache.get(1, "/api/companies")).toBeUndefined();
  });

  it("vira no-op quando o IndexedDB não existe", async () => {
    await closeOfflineCache();
    vi.stubGlobal("indexedDB", undefined);

    await expect(offlineCache.set(1, "/api/companies", [])).resolves.toBeUndefined();
    await expect(offlineCache.get(1, "/api/companies")).resolves.toBeUndefined();
    await expect(offlineCache.clearUser(1)).resolves.toBeUndefined();
    await expect(offlineCache.clearAll()).resolves.toBeUndefined();
  });

  it("vira no-op quando abrir o banco falha", async () => {
    await closeOfflineCache();
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new Error("Navegação privada");
      },
    });

    await expect(offlineCache.set(1, "/api/companies", [])).resolves.toBeUndefined();
    await expect(offlineCache.get(1, "/api/companies")).resolves.toBeUndefined();
  });
});
