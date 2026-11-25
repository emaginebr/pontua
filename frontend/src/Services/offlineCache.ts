/**
 * Cache local das respostas de consulta (research R-07, data-model.md §3).
 * IndexedDB `pontua-cache`, store `responses` (keyPath `key` = `{userId}:{path?query}`, índice
 * `byUser`). Qualquer falha do IndexedDB (navegação privada, cota, banco bloqueado) vira no-op:
 * `get` resolve `undefined` e `set`/`clearUser`/`clearAll` resolvem sem erro.
 */

export const OFFLINE_CACHE_DB_NAME = "pontua-cache";
export const OFFLINE_CACHE_DB_VERSION = 1;
export const OFFLINE_CACHE_STORE = "responses";
export const OFFLINE_CACHE_INDEX_BY_USER = "byUser";
/** Versão do formato dos registros; registro com outra versão é descartado. */
export const OFFLINE_CACHE_SCHEMA_VERSION = 1;
/** Tempo máximo para abrir o banco (não trava uma consulta). */
const OPEN_TIMEOUT_MS = 3_000;

/** Registro guardado. */
export interface CachedEntry {
  key: string;
  userId: number;
  path: string;
  data: unknown;
  /** Quando o dado veio do servidor (ISO) */
  fetchedAt: string;
  schemaVersion: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
/**
 * Incrementado a cada limpeza: gravação iniciada antes de um logout é descartada em vez de
 * recriar o dado apagado.
 */
let generation = 0;

export const toCacheKey = (userId: number, path: string): string => `${userId}:${path}`;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isCurrentEntry = (value: unknown): value is CachedEntry =>
  isRecord(value) &&
  value.schemaVersion === OFFLINE_CACHE_SCHEMA_VERSION &&
  typeof value.key === "string" &&
  typeof value.userId === "number" &&
  typeof value.fetchedAt === "string";

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const openDb = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;

  const attempt = new Promise<IDBDatabase | null>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (db: IDBDatabase | null) => {
      if (settled) {
        db?.close();
        return;
      }
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      resolve(db);
    };

    try {
      if (typeof indexedDB === "undefined" || indexedDB === null) {
        finish(null);
        return;
      }
      timer = setTimeout(() => finish(null), OPEN_TIMEOUT_MS);
      const request = indexedDB.open(OFFLINE_CACHE_DB_NAME, OFFLINE_CACHE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(OFFLINE_CACHE_STORE)) {
          const store = db.createObjectStore(OFFLINE_CACHE_STORE, { keyPath: "key" });
          store.createIndex(OFFLINE_CACHE_INDEX_BY_USER, "userId");
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        finish(db);
      };
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
    } catch {
      finish(null);
    }
  });

  const pending = attempt.then((db) => {
    // Falha não fica guardada: a próxima operação tenta de novo
    if (!db && dbPromise === pending) dbPromise = null;
    return db;
  });
  dbPromise = pending;
  return pending;
};

const deleteKey = async (db: IDBDatabase, key: string): Promise<void> => {
  const tx = db.transaction(OFFLINE_CACHE_STORE, "readwrite");
  tx.objectStore(OFFLINE_CACHE_STORE).delete(key);
  await transactionDone(tx);
};

/** Lê o dado guardado de `path` para `userId` (registro de versão incompatível é apagado). */
const get = async (userId: number, path: string): Promise<CachedEntry | undefined> => {
  try {
    const db = await openDb();
    if (!db) return undefined;
    const key = toCacheKey(userId, path);
    const tx = db.transaction(OFFLINE_CACHE_STORE, "readonly");
    const value: unknown = await requestResult(tx.objectStore(OFFLINE_CACHE_STORE).get(key));
    if (value === undefined) return undefined;
    if (!isCurrentEntry(value) || value.userId !== userId) {
      await deleteKey(db, key);
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
};

/** Grava a resposta 2xx de `path` para `userId`. */
const set = async (userId: number, path: string, data: unknown): Promise<void> => {
  const startedAt = generation;
  try {
    const db = await openDb();
    if (!db || startedAt !== generation) return;
    const entry: CachedEntry = {
      key: toCacheKey(userId, path),
      userId,
      path,
      data,
      fetchedAt: new Date().toISOString(),
      schemaVersion: OFFLINE_CACHE_SCHEMA_VERSION,
    };
    const tx = db.transaction(OFFLINE_CACHE_STORE, "readwrite");
    tx.objectStore(OFFLINE_CACHE_STORE).put(entry);
    await transactionDone(tx);
  } catch {
    // Cota excedida, banco fechado etc.: o app segue sem cache
  }
};

/** Apaga os dados de um usuário (logout, 401). */
const clearUser = async (userId: number): Promise<void> => {
  generation += 1;
  try {
    const db = await openDb();
    if (!db) return;
    const tx = db.transaction(OFFLINE_CACHE_STORE, "readwrite");
    const store = tx.objectStore(OFFLINE_CACHE_STORE);
    // Exclusões feitas no próprio callback (sem `await` no meio da transação)
    const request = store.index(OFFLINE_CACHE_INDEX_BY_USER).getAllKeys(IDBKeyRange.only(userId));
    request.onsuccess = () => {
      request.result.forEach((key) => store.delete(key));
    };
    await transactionDone(tx);
  } catch {
    // no-op
  }
};

/** Apaga tudo. */
const clearAll = async (): Promise<void> => {
  generation += 1;
  try {
    const db = await openDb();
    if (!db) return;
    const tx = db.transaction(OFFLINE_CACHE_STORE, "readwrite");
    tx.objectStore(OFFLINE_CACHE_STORE).clear();
    await transactionDone(tx);
  } catch {
    // no-op
  }
};

/** Fecha a conexão e esquece o estado em memória (testes). */
export const closeOfflineCache = async (): Promise<void> => {
  const pending = dbPromise;
  dbPromise = null;
  const db = pending ? await pending : null;
  db?.close();
};

/** API do cache offline. */
export const offlineCache = { get, set, clearUser, clearAll };

export default offlineCache;
