import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import i18n from "../i18n";
import { useAuth } from "../hooks/useAuth";
import { useConnectivity } from "../hooks/useConnectivity";
import { addNetworkResultListener, isApiError, toErrorMessage } from "../Services/apiClient";
import { punchService } from "../Services/punchService";
import { OFFLINE_BATCH_SIZE, PunchQueueUnavailableError, punchQueue } from "../Services/punchQueue";
import type { OfflineSyncResult, QueuedPunch } from "../types/punch";
import { notifySuccess, notifyWarning } from "../utils/notify";

/** Nova tentativa de envio enquanto houver itens aguardando (research R-06). */
export const QUEUE_RETRY_INTERVAL_MS = 30_000;
/** Intervalo mínimo entre envios disparados por "resposta OK da API" (evita laço). */
export const QUEUE_NETWORK_FLUSH_THROTTLE_MS = 15_000;

export interface PunchQueueContextType {
  // Estado
  /** Marcações guardadas do usuário (todas as empresas), mais antigas primeiro */
  items: QueuedPunch[];
  /** Quantas aguardam envio (`waiting` + `sending`) */
  waiting: number;
  /** Recusadas pelo servidor, visíveis até o usuário dispensar */
  rejected: QueuedPunch[];
  /** Envio em andamento */
  sending: boolean;
  /** O aparelho consegue guardar marcações offline (IndexedDB) */
  available: boolean;
  loading: boolean;
  /** A leitura inicial da fila (e a primeira tentativa de envio) terminou para o usuário atual */
  ready: boolean;
  error: string | null;
  /** Muda (timestamp) sempre que marcações da fila chegam ao servidor */
  lastSyncedAt: number | null;
  // Métodos
  /** Guarda uma marcação feita sem conexão, ligada à empresa em que foi feita */
  enqueue: (companyId: number, punchedAt: string) => Promise<QueuedPunch>;
  /** Envia o que estiver aguardando (lotes de até 50 por empresa) */
  flush: () => Promise<void>;
  /** Remove o aviso de uma marcação recusada */
  dismissRejected: (clientId: string) => Promise<void>;
  /** Quantas aguardam envio para uma empresa */
  waitingFor: (companyId: number) => number;
  clearError: () => void;
}

const PunchQueueContext = createContext<PunchQueueContextType | undefined>(undefined);

/** Agrupa por empresa mantendo a ordem de criação. */
const groupByCompany = (items: QueuedPunch[]): Map<number, QueuedPunch[]> => {
  const groups = new Map<number, QueuedPunch[]>();
  items.forEach((item) => {
    const list = groups.get(item.companyId) ?? [];
    list.push(item);
    groups.set(item.companyId, list);
  });
  return groups;
};

/** Mesma lista (ids, estado e motivo) — evita re-renderizar sem mudança. */
const sameItems = (a: QueuedPunch[], b: QueuedPunch[]): boolean =>
  a.length === b.length &&
  a.every((item, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      other.clientId === item.clientId &&
      other.state === item.state &&
      other.rejectReason === item.rejectReason
    );
  });

/**
 * Fila offline (research R-06, data-model.md §3): envia ao abrir, no `reconnected`, a cada 30 s
 * com itens e após respostas OK da API; `created`/`duplicate` removem, `future`/`too_old`
 * viram recusadas com aviso.
 *
 * A fila **nunca** é apagada no logout nem no 401 (research R-07 › Atualização): cada item fica
 * ligado ao `userId` e só o usuário logado vê e envia os seus; itens de outras pessoas ficam
 * guardados no aparelho até elas entrarem de novo.
 */
export const PunchQueueProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { onReconnected } = useConnectivity();
  const userId = user?.userId ?? null;
  const [items, setItems] = useState<QueuedPunch[]>([]);
  const [sending, setSending] = useState(false);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(userId === null);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const userIdRef = useRef<number | null>(userId);
  userIdRef.current = userId;
  const flushing = useRef(false);
  const lastFlushAt = useRef(0);

  const waitingItems = useMemo(() => items.filter((item) => item.state !== "rejected"), [items]);
  const rejected = useMemo(() => items.filter((item) => item.state === "rejected"), [items]);
  const waiting = waitingItems.length;
  const waitingRef = useRef(waiting);
  waitingRef.current = waiting;

  const handleError = useCallback((err: unknown): never => {
    setError(toErrorMessage(err));
    throw err;
  }, []);

  /** Relê a fila do usuário atual. */
  const reload = useCallback(async (): Promise<void> => {
    const owner = userIdRef.current;
    if (owner === null) {
      setItems((previous) => (previous.length === 0 ? previous : []));
      return;
    }
    const list = await punchQueue.listByUser(owner);
    if (userIdRef.current === owner) setItems((previous) => (sameItems(previous, list) ? previous : list));
  }, []);

  const flush = useCallback(async (): Promise<void> => {
    const owner = userIdRef.current;
    if (owner === null || flushing.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    flushing.current = true;
    lastFlushAt.current = Date.now();
    let sent = 0;
    let rejectedNow = 0;
    let started = false;
    try {
      const pending = await punchQueue.listByState(owner, "waiting");
      if (pending.length === 0) return;
      started = true;
      setSending(true);
      let networkDown = false;
      for (const [companyId, list] of groupByCompany(pending)) {
        for (let index = 0; index < list.length; index += OFFLINE_BATCH_SIZE) {
          const batch = list.slice(index, index + OFFLINE_BATCH_SIZE);
          const ids = batch.map((item) => item.clientId);
          await punchQueue.markSending(ids);
          let result: OfflineSyncResult;
          try {
            result = await punchService.syncOffline(
              companyId,
              batch.map(({ clientId, punchedAt }) => ({ clientId, punchedAt })),
            );
          } catch (err) {
            // Sem rede: tudo volta a aguardar. Outro erro (ex.: saiu da empresa): tenta depois.
            await punchQueue.markWaiting(ids);
            if (isApiError(err) && err.offline) networkDown = true;
            break;
          }
          const answered = new Set<string>();
          for (const entry of result.items ?? []) {
            answered.add(entry.clientId);
            if (entry.result === "created" || entry.result === "duplicate") {
              await punchQueue.remove([entry.clientId]);
              sent += 1;
            } else if (entry.result === "future" || entry.result === "too_old") {
              await punchQueue.markRejected(entry.clientId, entry.result);
              rejectedNow += 1;
            }
          }
          await punchQueue.markWaiting(ids.filter((id) => !answered.has(id)));
        }
        if (networkDown) break;
      }
    } catch {
      // IndexedDB falhou no meio: a próxima tentativa recomeça do estado guardado
    } finally {
      flushing.current = false;
      // Nada a enviar: nenhum estado muda (sem re-render à toa)
      if (started) setSending(false);
      if (started && userIdRef.current === owner) {
        await reload();
        if (sent > 0) {
          setLastSyncedAt(Date.now());
          notifySuccess(i18n.t("ponto:queue.sent", { count: sent }), i18n.t("ponto:queue.sentDescription"));
        }
        if (rejectedNow > 0) notifyWarning(i18n.t("ponto:queue.rejectedToast", { count: rejectedNow }));
      }
    }
  }, [reload]);

  // Abertura (e troca de usuário): confere o IndexedDB, destrava `sending` e tenta enviar
  useEffect(() => {
    setItems((previous) => (previous.length === 0 ? previous : []));
    setError(null);
    if (userId === null) {
      setReady(true);
      return undefined;
    }
    setReady(false);
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const ok = await punchQueue.isAvailable();
      if (cancelled) return;
      if (ok) {
        await punchQueue.resetStuckSending();
        await reload();
      }
      if (cancelled) return;
      setAvailable(ok);
      setLoading(false);
      if (ok) await flush();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, reload, flush]);

  // Conexão voltou
  useEffect(() => onReconnected(() => void flush()), [onReconnected, flush]);

  // Qualquer resposta OK da API (com limite de frequência)
  useEffect(
    () =>
      addNetworkResultListener((result) => {
        if (!result.online || waitingRef.current === 0 || flushing.current) return;
        if (Date.now() - lastFlushAt.current < QUEUE_NETWORK_FLUSH_THROTTLE_MS) return;
        void flush();
      }),
    [flush],
  );

  // A cada 30 s enquanto houver itens aguardando
  useEffect(() => {
    if (waiting === 0) return undefined;
    const interval = setInterval(() => void flush(), QUEUE_RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [waiting, flush]);

  const enqueue = useCallback(
    async (companyId: number, punchedAt: string): Promise<QueuedPunch> => {
      const owner = userIdRef.current;
      if (owner === null) throw new Error(i18n.t("erros:generico"));
      try {
        setError(null);
        const item = await punchQueue.enqueue({ userId: owner, companyId, punchedAt });
        setAvailable(true);
        await reload();
        return item;
      } catch (err) {
        if (err instanceof PunchQueueUnavailableError) {
          setAvailable(false);
          return handleError(new Error(i18n.t("ponto:queue.unavailable")));
        }
        return handleError(err);
      }
    },
    [reload, handleError],
  );

  const dismissRejected = useCallback(
    async (clientId: string): Promise<void> => {
      await punchQueue.remove([clientId]);
      await reload();
    },
    [reload],
  );

  const waitingFor = useCallback(
    (companyId: number) => waitingItems.filter((item) => item.companyId === companyId).length,
    [waitingItems],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<PunchQueueContextType>(
    () => ({
      items,
      waiting,
      rejected,
      sending,
      available,
      loading,
      ready,
      error,
      lastSyncedAt,
      enqueue,
      flush,
      dismissRejected,
      waitingFor,
      clearError,
    }),
    [
      items,
      waiting,
      rejected,
      sending,
      available,
      loading,
      ready,
      error,
      lastSyncedAt,
      enqueue,
      flush,
      dismissRejected,
      waitingFor,
      clearError,
    ],
  );

  return <PunchQueueContext.Provider value={value}>{children}</PunchQueueContext.Provider>;
};

export default PunchQueueContext;
