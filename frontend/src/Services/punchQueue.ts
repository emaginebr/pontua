/**
 * Fila de marcações feitas sem conexão (research R-06, data-model.md §3).
 * IndexedDB `pontua-queue`, store `punches` (keyPath `clientId`, índice `byUser`).
 *
 * Transições: `waiting` → `sending` (flush) → removida (`created`/`duplicate`) ou `rejected`
 * (`future`/`too_old`); falha de rede devolve a `waiting`; `sending` há mais de 1 min (app
 * fechado no meio do envio) volta a `waiting` na abertura.
 *
 * Sem IndexedDB (navegação privada, cota): leituras devolvem vazio e `enqueue` lança
 * `PunchQueueUnavailableError`, para o app avisar que não é possível guardar offline.
 */
import type { QueueRejectReason, QueueState, QueuedPunch } from "../types/punch";

export const PUNCH_QUEUE_DB_NAME = "pontua-queue";
export const PUNCH_QUEUE_DB_VERSION = 1;
export const PUNCH_QUEUE_STORE = "punches";
export const PUNCH_QUEUE_INDEX_BY_USER = "byUser";
/** Item em `sending` por mais tempo que isto é considerado travado. */
export const STUCK_SENDING_MS = 60_000;
/** Tamanho máximo do lote aceito por `POST .../punches/offline`. */
export const OFFLINE_BATCH_SIZE = 50;
/** Tempo máximo para abrir o banco. */
const OPEN_TIMEOUT_MS = 3_000;

/** O aparelho não permite guardar marcações (IndexedDB indisponível). */
export class PunchQueueUnavailableError extends Error {
  constructor(message = "IndexedDB indisponível") {
    super(message);
    this.name = "PunchQueueUnavailableError";
  }
}

/** Dados para enfileirar uma marcação. */
export interface EnqueueInput {
  userId: number;
  companyId: number;
  /** ISO-8601 com offset do aparelho */
  punchedAt: string;
  /** Opcional (testes); padrão uuid v4 novo */
  clientId?: string;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isQueuedPunch = (value: unknown): value is QueuedPunch =>
  isRecord(value) &&
  typeof value.clientId === "string" &&
  typeof value.userId === "number" &&
  typeof value.companyId === "number" &&
  typeof value.punchedAt === "string" &&
  (value.state === "waiting" || value.state === "sending" || value.state === "rejected");

/** uuid v4 (usa `crypto.randomUUID` quando existe). */
export const createClientId = (): string => {
  const cryptoApi = typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") cryptoApi.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

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
      const request = indexedDB.open(PUNCH_QUEUE_DB_NAME, PUNCH_QUEUE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PUNCH_QUEUE_STORE)) {
          const store = db.createObjectStore(PUNCH_QUEUE_STORE, { keyPath: "clientId" });
          store.createIndex(PUNCH_QUEUE_INDEX_BY_USER, "userId");
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
    if (!db && dbPromise === pending) dbPromise = null;
    return db;
  });
  dbPromise = pending;
  return pending;
};

const byCreatedAt = (a: QueuedPunch, b: QueuedPunch): number =>
  a.createdAt === b.createdAt ? a.punchedAt.localeCompare(b.punchedAt) : a.createdAt.localeCompare(b.createdAt);

/** `true` quando o aparelho consegue guardar marcações. */
const isAvailable = async (): Promise<boolean> => (await openDb()) !== null;

/** Guarda uma marcação como `waiting`. */
const enqueue = async (input: EnqueueInput): Promise<QueuedPunch> => {
  const db = await openDb();
  if (!db) throw new PunchQueueUnavailableError();
  const item: QueuedPunch = {
    clientId: input.clientId ?? createClientId(),
    userId: input.userId,
    companyId: input.companyId,
    punchedAt: input.punchedAt,
    createdAt: new Date().toISOString(),
    state: "waiting",
    rejectReason: null,
    sendingAt: null,
  };
  try {
    const tx = db.transaction(PUNCH_QUEUE_STORE, "readwrite");
    tx.objectStore(PUNCH_QUEUE_STORE).put(item);
    await transactionDone(tx);
  } catch (err) {
    throw new PunchQueueUnavailableError(err instanceof Error ? err.message : undefined);
  }
  return item;
};

/** Marcações do usuário (todas as empresas), da mais antiga para a mais nova. */
const listByUser = async (userId: number): Promise<QueuedPunch[]> => {
  try {
    const db = await openDb();
    if (!db) return [];
    const tx = db.transaction(PUNCH_QUEUE_STORE, "readonly");
    const values: unknown[] = await requestResult(
      tx.objectStore(PUNCH_QUEUE_STORE).index(PUNCH_QUEUE_INDEX_BY_USER).getAll(IDBKeyRange.only(userId)),
    );
    return values.filter(isQueuedPunch).sort(byCreatedAt);
  } catch {
    return [];
  }
};

/** Marcações do usuário num estado. */
const listByState = async (userId: number, state: QueueState): Promise<QueuedPunch[]> =>
  (await listByUser(userId)).filter((item) => item.state === state);

/** Altera itens existentes numa única transação (itens apagados no meio são ignorados). */
const updateItems = async (clientIds: string[], mutate: (item: QueuedPunch) => QueuedPunch): Promise<void> => {
  if (clientIds.length === 0) return;
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(PUNCH_QUEUE_STORE, "readwrite");
  const store = tx.objectStore(PUNCH_QUEUE_STORE);
  clientIds.forEach((clientId) => {
    const request = store.get(clientId);
    request.onsuccess = () => {
      const current: unknown = request.result;
      if (isQueuedPunch(current)) store.put(mutate(current));
    };
  });
  await transactionDone(tx);
};

/** `waiting` → `sending` (início de um lote). */
const markSending = (clientIds: string[], now: Date = new Date()): Promise<void> =>
  updateItems(clientIds, (item) => ({ ...item, state: "sending", sendingAt: now.toISOString() }));

/** Volta para `waiting` (falha de rede ou item sem resposta). */
const markWaiting = (clientIds: string[]): Promise<void> =>
  updateItems(clientIds, (item) => ({ ...item, state: "waiting", sendingAt: null }));

/** Recusada pelo servidor; fica visível até o usuário dispensar. */
const markRejected = (clientId: string, reason: QueueRejectReason): Promise<void> =>
  updateItems([clientId], (item) => ({ ...item, state: "rejected", rejectReason: reason, sendingAt: null }));

/** Remove itens (chegaram ao servidor ou o aviso foi dispensado). */
const remove = async (clientIds: string[]): Promise<void> => {
  if (clientIds.length === 0) return;
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(PUNCH_QUEUE_STORE, "readwrite");
  const store = tx.objectStore(PUNCH_QUEUE_STORE);
  clientIds.forEach((clientId) => store.delete(clientId));
  await transactionDone(tx);
};

/** Itens `sending` há mais de 1 min (app fechado durante o envio) voltam a `waiting`. */
const resetStuckSending = async (now: number = Date.now()): Promise<number> => {
  try {
    const db = await openDb();
    if (!db) return 0;
    const tx = db.transaction(PUNCH_QUEUE_STORE, "readonly");
    const values: unknown[] = await requestResult(tx.objectStore(PUNCH_QUEUE_STORE).getAll());
    const stuck = values.filter(isQueuedPunch).filter((item) => {
      if (item.state !== "sending") return false;
      const since = item.sendingAt ? Date.parse(item.sendingAt) : Number.NaN;
      return Number.isNaN(since) || now - since > STUCK_SENDING_MS;
    });
    await markWaiting(stuck.map((item) => item.clientId));
    return stuck.length;
  } catch {
    return 0;
  }
};

/**
 * Apaga a fila de um usuário. **Não** é chamado no logout nem no 401 (research R-07 ›
 * Atualização: apagar perderia registros de ponto); fica para manutenção e testes.
 */
const clearUser = async (userId: number): Promise<void> => {
  try {
    const db = await openDb();
    if (!db) return;
    const tx = db.transaction(PUNCH_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(PUNCH_QUEUE_STORE);
    const request = store.index(PUNCH_QUEUE_INDEX_BY_USER).getAllKeys(IDBKeyRange.only(userId));
    request.onsuccess = () => {
      request.result.forEach((key) => store.delete(key));
    };
    await transactionDone(tx);
  } catch {
    // no-op
  }
};

/** Fecha a conexão e esquece o estado em memória (testes). */
export const closePunchQueue = async (): Promise<void> => {
  const pending = dbPromise;
  dbPromise = null;
  const db = pending ? await pending : null;
  db?.close();
};

/** API da fila offline. */
export const punchQueue = {
  isAvailable,
  enqueue,
  listByUser,
  listByState,
  markSending,
  markWaiting,
  markRejected,
  remove,
  resetStuckSending,
  clearUser,
};

export default punchQueue;
