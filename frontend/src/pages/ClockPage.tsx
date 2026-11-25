import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { CalendarX, Check, CircleCheck, CloudUpload, Hourglass } from "lucide-react";
import { buttonClasses } from "../components/buttonStyles";
import { ClockFace } from "../components/ClockFace";
import { ConfirmModal } from "../components/ConfirmModal";
import { CorrectionPair } from "../components/CorrectionPair";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { Notice } from "../components/Notice";
import { PageHeader } from "../components/PageHeader";
import { PunchBadge } from "../components/PunchBadge";
import { PunchButton } from "../components/PunchButton";
import { QueueIndicator } from "../components/QueueIndicator";
import { StaleDataNotice } from "../components/StaleDataNotice";
import { useCompany } from "../hooks/useCompany";
import { useConnectivity } from "../hooks/useConnectivity";
import { usePunch } from "../hooks/usePunch";
import { usePunchQueue } from "../hooks/usePunchQueue";
import { useServerNow } from "../hooks/useServerNow";
import { isApiError, toErrorMessage } from "../Services/apiClient";
import { cn } from "../utils/cn";
import { TotalsGrid } from "../components/SummaryHeader";
import {
  DEFAULT_TIME_ZONE,
  formatLongDateInZone,
  formatTimeInZone,
  formatYmdRange,
  toYmdInZone,
  todayInZone,
} from "../utils/dateTime";
import { hhmmToMinutes } from "../utils/duration";
import { notifyError, notifyOffline, notifySuccess, notifyWarning } from "../utils/notify";
import { buildTimeline, periodState } from "../utils/timeline";
import type { TimelineRow } from "../utils/timeline";
import { findBrazilTimeZone } from "../utils/timeZones";

/** Intervalo mínimo entre marcações (regra do servidor). */
const MIN_INTERVAL_MS = 60_000;
/** Janela do halo "hora prevista" (±10 min). */
const PULSE_WINDOW_MINUTES = 10;
/** Destaque da linha nova. */
const HIGHLIGHT_MS = 2_000;

const ACTION_PARAM = "acao";
const ACTION_REGISTER = "registrar";

/** Hora prevista (`HH:mm`) em minutos do dia. */
const minutesOfDay = (value: string | null): number | null => (value ? hhmmToMinutes(value) : null);

/** Hora oficial "agora" no confirmar (atualiza a cada segundo enquanto o modal está aberto). */
const ConfirmClock = ({ timeZone }: { timeZone: string }) => {
  const now = useServerNow(1_000);
  return (
    <time
      dateTime={now.toISOString()}
      className="block text-center text-[2.5rem] leading-none font-[750] tracking-tight tabular-nums"
    >
      {formatTimeInZone(now, timeZone)}
    </time>
  );
};

/**
 * Tela de ponto (`/`, mockup clock.html; US2, FR-012–FR-014): relógio oficial, jornada do dia,
 * próxima marcação, marcações de hoje, botão com confirmação e fila offline.
 */
const ClockPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeCompany, companies } = useCompany();
  const { isOnline, serverOffset, onReconnected } = useConnectivity();
  const { today, loading, error, stale, fetchedAt, punching, lastPunchAt, week, loadToday, loadWeek, punch } = usePunch();
  const queue = usePunchQueue();
  const timeZone = activeCompany?.timeZone ?? DEFAULT_TIME_ZONE;
  const companyId = activeCompany?.companyId ?? null;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  // Última marcação (servidor ou deste aparelho) para a espera de 1 minuto
  const lastServerPunch = useMemo(() => {
    let latest = 0;
    for (const item of today?.punches ?? []) {
      if (item.kind === "manual") continue;
      const at = Date.parse(item.punchedAt);
      if (!Number.isNaN(at) && at > latest) latest = at;
    }
    return latest > 0 ? latest : null;
  }, [today]);
  const lastAt = Math.max(lastServerPunch ?? 0, lastPunchAt ?? 0) || null;
  const recentlyPunched = lastAt !== null && Date.now() + serverOffset - lastAt < MIN_INTERVAL_MS;
  const now = useServerNow(recentlyPunched ? 1_000 : 30_000);
  const remainingMs = lastAt !== null ? MIN_INTERVAL_MS - (now.getTime() - lastAt) : 0;
  // Texto do "Aguarde" muda a cada 5 s (não a cada segundo)
  const waitSeconds = remainingMs > 0 ? Math.min(60, Math.ceil(remainingMs / 5_000) * 5) : null;
  const todayYmd = todayInZone(timeZone, now);

  // Carrega hoje (e de novo na virada do dia, após o envio da fila e ao reconectar)
  useEffect(() => {
    void loadToday();
    void loadWeek();
  }, [loadToday, loadWeek, todayYmd]);

  useEffect(() => {
    if (queue.lastSyncedAt === null) return;
    void loadToday();
    void loadWeek();
  }, [queue.lastSyncedAt, loadToday, loadWeek]);

  useEffect(
    () =>
      onReconnected(() => {
        void loadToday();
        void loadWeek();
      }),
    [onReconnected, loadToday, loadWeek],
  );

  // Atalho do PWA: `?acao=registrar` abre a confirmação direto
  useEffect(() => {
    if (searchParams.get(ACTION_PARAM) !== ACTION_REGISTER) return;
    setConfirmOpen(true);
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        params.delete(ACTION_PARAM);
        return params;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!highlightKey) return undefined;
    const timer = setTimeout(() => setHighlightKey(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightKey]);

  const queuedToday = useMemo(
    () =>
      queue.items.filter(
        (item) =>
          item.state !== "rejected" &&
          item.companyId === companyId &&
          toYmdInZone(item.punchedAt, timeZone) === todayYmd,
      ),
    [queue.items, companyId, timeZone, todayYmd],
  );
  const timeline = useMemo(() => buildTimeline(today, queuedToday, timeZone), [today, queuedToday, timeZone]);
  const next = timeline.next;
  const total = timeline.periods.length;
  const outsideWorkday = today !== null && (!today.isWorkDay || total === 0);
  const complete = today !== null && !outsideWorkday && next === null;
  const offline = !isOnline;

  const nowMinutes = minutesOfDay(formatTimeInZone(now, timeZone));
  const nextMinutes = minutesOfDay(next?.expectedTime ?? null);
  const pulse =
    nowMinutes !== null && nextMinutes !== null && Math.abs(nowMinutes - nextMinutes) <= PULSE_WINDOW_MINUTES;

  const periodName = outsideWorkday || !next ? null : next.name;
  const periodLabel = periodName ?? t("ponto:extra");
  const nextExpected = !outsideWorkday && next?.expectedTime ? next.expectedTime : null;

  const periodLine = outsideWorkday
    ? t("ponto:button.lineOutside")
    : offline
      ? t("ponto:button.lineOffline", { period: periodLabel })
      : nextExpected
        ? t("ponto:button.lineExpected", { period: periodLabel, time: nextExpected })
        : periodLabel;

  // Nome acessível = texto visível do botão (I-06); sem conexão, um complemento no fim
  const punchHint = offline ? t("ponto:button.offlineHint") : null;

  const companyNameOf = useCallback(
    (id: number): string | null =>
      id === companyId ? null : (companies.find((item) => item.companyId === id)?.name ?? null),
    [companies, companyId],
  );

  const openConfirm = () => setConfirmOpen(true);

  // A confirmação é anunciada uma única vez, pelo toast (região `aria-live` do sonner,
  // components.md §8.3); o texto sob o botão mostra só o progresso do dia e não é "live".
  const handleConfirm = async () => {
    try {
      const outcome = await punch();
      if (outcome.kind === "online") {
        const { periodName: name, localTime, punchId } = outcome.punch;
        setHighlightKey(`punch:${punchId}`);
        notifySuccess(
          name ? t("ponto:registered", { period: name, time: localTime }) : t("ponto:registeredExtra", { time: localTime }),
        );
      } else {
        setHighlightKey(`queue:${outcome.item.clientId}`);
        notifyOffline(t("ponto:queued"));
      }
    } catch (err) {
      const message = toErrorMessage(err);
      if (isApiError(err) && err.status === 422) notifyWarning(message);
      else notifyError(message);
    }
  };

  const zone = findBrazilTimeZone(timeZone);
  const city = zone ? t(`empresa:timeZones.${zone.key}.city`) : timeZone;

  const clockStatus = (() => {
    // Carregando: reserva a linha de status e a faixa de períodos (evita o CLS 0,105 — I-05)
    if (!today) {
      return (
        <div aria-hidden="true" data-testid="clock-status-placeholder">
          <span className="mt-2 block h-6 w-3/5 rounded-sm bg-white/10" />
          <span className="mt-3.5 block h-[47px] border-t border-white/15 pt-3">
            <span className="block h-full rounded-sm bg-white/10" />
          </span>
        </div>
      );
    }
    if (outsideWorkday) {
      return (
        <p className="mt-3.5 flex items-center gap-2 border-t border-white/15 pt-3 text-body-sm text-on-dark-muted">
          <CalendarX aria-hidden="true" className="size-4" />
          {t("ponto:clock.noSchedule")}
        </p>
      );
    }
    // Todos os períodos cobertos: "completa" só se nenhum estiver pendente (components.md §2.1, B-01)
    if (complete && timeline.pending > 0) {
      return (
        <p className="mt-2 flex items-center gap-2 font-semibold">
          <Hourglass aria-hidden="true" className="size-5 text-warning-solid" />
          {t("ponto:clock.registered", { count: timeline.pending })}
        </p>
      );
    }
    if (complete) {
      return (
        <p className="mt-2 flex items-center gap-2 font-semibold">
          <CircleCheck aria-hidden="true" className="size-5 text-brand-leaf" />
          {t("ponto:clock.complete")}
        </p>
      );
    }
    if (!next) return null;
    return (
      <p className="mt-2 font-semibold">
        <Trans
          i18nKey={next.expectedTime ? "ponto:clock.nextExpected" : "ponto:clock.next"}
          values={{ period: next.name ?? "", time: next.expectedTime ?? "" }}
          components={{ strong: <strong className="font-bold" /> }}
        />
      </p>
    );
  })();

  const rowHighlightKey = (row: TimelineRow): string | null =>
    row.punch ? `punch:${row.punch.punchId}` : row.queued ? `queue:${row.queued.clientId}` : null;

  const rowMeta = (row: TimelineRow): string | null => {
    if (row.next) {
      return row.expectedTime ? t("ponto:today.nextExpected", { time: row.expectedTime }) : t("ponto:today.next");
    }
    if (row.punch?.pendingReason === "outsideWorkday") return t("ponto:today.outsideWorkday");
    return row.expectedTime ? t("ponto:today.expected", { time: row.expectedTime }) : null;
  };

  const dotClass = (row: TimelineRow): string => {
    if (row.queued) return "border-offline bg-offline";
    const status = row.punch?.status;
    if (status === "valid" || status === "approved") return "border-success bg-success";
    if (status === "pending") return "border-warning bg-warning-solid";
    if (status === "rejected") return "border-danger bg-danger";
    return "border-border bg-surface";
  };

  return (
    <>
      <PageHeader title={t("ponto:title")} hideTitle className="mb-0" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <section aria-label={t("ponto:registerSection")} className="flex flex-col gap-4">
          <ClockFace timeZone={timeZone} offline={offline} status={clockStatus}>
            {!outsideWorkday && total > 0 && (
              <ol
                aria-label={t("ponto:clock.stepsLabel")}
                className="mt-3.5 grid gap-1 border-t border-white/15 pt-3"
                style={{ gridTemplateColumns: `repeat(${Math.min(total, 4)}, minmax(0, 1fr))` }}
              >
                {timeline.periods.map((row) => {
                  // Pendente não é "feita": ampulheta âmbar no lugar do check (components.md §2.1, B-01)
                  const state = periodState(row);
                  return (
                    <li
                      key={row.key}
                      data-state={state}
                      className="flex min-w-0 flex-col gap-0.5 text-[0.8125rem] leading-4"
                    >
                      <span className={cn("font-semibold", row.next ? "text-white" : "text-on-dark-muted")}>
                        {row.name}
                      </span>
                      <span
                        className={cn(
                          "flex items-center gap-1 text-[0.9375rem] tabular-nums",
                          row.next ? "font-[750] text-brand-leaf" : row.time ? "font-[750]" : "font-semibold text-on-dark-muted",
                        )}
                      >
                        {state === "queued" ? (
                          <CloudUpload aria-hidden="true" className="size-3.5 text-brand-leaf" />
                        ) : state === "pending" ? (
                          <Hourglass aria-hidden="true" className="size-3.5 text-warning-solid" strokeWidth={2.5} />
                        ) : state === "done" ? (
                          <Check aria-hidden="true" className="size-3.5 text-brand-leaf" strokeWidth={2.5} />
                        ) : null}
                        {row.time ?? row.expectedTime ?? "—"}
                      </span>
                      <span className="sr-only">
                        {state === "queued"
                          ? t("ponto:clock.stepQueued")
                          : state === "pending"
                            ? t("ponto:clock.stepPending")
                            : state === "done"
                              ? t("ponto:clock.stepDone")
                              : state === "next"
                                ? t("ponto:clock.stepNext")
                                : t("ponto:clock.stepTodo")}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </ClockFace>

          {outsideWorkday && (
            <Notice variant="warning">
              <strong className="font-bold">{t("ponto:outsideWorkday.strong")}</strong> {t("ponto:outsideWorkday.text")}
            </Notice>
          )}

          {offline && !queue.available && (
            <Notice variant="warning">{t("ponto:queue.unavailable")}</Notice>
          )}

          <div className="flex flex-col items-center gap-3 pt-5 pb-2">
            <PunchButton
              periodLine={periodLine}
              srHint={punchHint}
              onPress={openConfirm}
              loading={punching}
              waitSeconds={waitSeconds}
              offline={offline}
              pulse={pulse}
              progress={total > 0 && !outsideWorkday ? { done: timeline.done, total } : null}
            />
            {/* A linha fica reservada enquanto carrega (CLS — I-05) */}
            {!outsideWorkday && (
              <p className="min-h-5 max-w-[34ch] text-center text-body-sm text-muted">
                {total > 0 && t("ponto:progress", { done: timeline.done, total })}
              </p>
            )}
            <QueueIndicator
              waiting={queue.waitingFor(companyId ?? -1)}
              sending={queue.sending}
              rejected={queue.rejected}
              onDismiss={(clientId) => void queue.dismissRejected(clientId)}
              timeZone={timeZone}
              companyNameOf={companyNameOf}
            />
          </div>
        </section>

        <div className="flex flex-col gap-4">
        <section aria-labelledby="hoje-titulo" className="overflow-hidden rounded-card border border-separator bg-surface shadow-sm">
          <div className="flex min-h-14 items-center justify-between gap-2 border-b border-separator px-4 py-2">
            <h2 id="hoje-titulo" className="text-title-sm text-text">
              {t("ponto:today.title")}
            </h2>
            <Link to="/historico" className={buttonClasses({ variant: "tertiary", size: "sm" })}>
              {t("ponto:today.history")}
            </Link>
          </div>
          {/* Sem conexão depois de carregar: os dados da lista também ficam "parados" (A-05, §9.2) */}
          <StaleDataNotice stale={stale || offline} fetchedAt={fetchedAt} timeZone={timeZone} className="mx-4 mt-3" />
          {loading && !today ? (
            <div className="px-4">
              <LoadingState lines={4} />
            </div>
          ) : error && !today ? (
            <ErrorState message={error} onRetry={() => void loadToday()} retrying={loading} />
          ) : timeline.rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-body-sm text-muted">{t("ponto:today.empty")}</p>
          ) : (
            <ol className="divide-y divide-separator">
              {timeline.rows.map((row) => {
                const meta = rowMeta(row);
                const struck = row.punch?.status === "cancelled" || row.punch?.status === "superseded";
                // N-04: com pedido de correção, o par original → correção aparece uma vez, na
                // linha da original (como no histórico); o horário sai da coluna da direita
                const pair = row.original && row.corrections.length > 0 ? row.original : null;
                const validNormal = !pair && row.punch?.status === "valid" && row.punch.kind === "normal";
                return (
                  <li
                    key={row.key}
                    className={cn(
                      "flex min-h-14 items-center gap-3 px-4 py-2 transition-[background-color] duration-(--pt-duration-base)",
                      row.next && "bg-primary-soft",
                      highlightKey !== null && rowHighlightKey(row) === highlightKey && "bg-success-soft",
                    )}
                  >
                    <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-full border-2", dotClass(row))} />
                    <div className="min-w-0 flex-1">
                      <span className="font-[650] text-text">{row.name ?? t("ponto:extra")}</span>
                      {meta && (
                        <span className={cn("block text-caption", row.next ? "font-[650] text-primary" : "font-medium text-muted")}>
                          {meta}
                        </span>
                      )}
                      {pair ? (
                        <CorrectionPair className="mt-1.5" original={pair} corrections={row.corrections} />
                      ) : (
                        <PunchBadge
                          punch={row.punch}
                          queueState={row.queued?.state ?? null}
                          showExtra={!row.isPeriod}
                          className="mt-1"
                        />
                      )}
                    </div>
                    {validNormal && (
                      <>
                        <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-success" />
                        <span className="sr-only">{t("ponto:today.valid")}</span>
                      </>
                    )}
                    {pair ? null : row.time ? (
                      <span className={cn("text-right text-[1.0625rem] font-bold tabular-nums", struck && "text-muted line-through")}>
                        {row.time}
                      </span>
                    ) : (
                      <span className="text-right text-[1.0625rem] font-bold text-subtle">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">{t("ponto:today.notYet")}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {queuedToday.length > 0 && (
            <p className="px-4 pt-1 pb-3.5 text-caption text-muted">{t("ponto:today.queuedHint")}</p>
          )}
        </section>

        {week && (
          <section aria-labelledby="semana-titulo" className="overflow-hidden rounded-card border border-separator bg-surface shadow-sm">
            <div className="flex min-h-14 items-center justify-between gap-2 border-b border-separator px-4 py-2">
              <h2 id="semana-titulo" className="text-title-sm text-text">
                {t("ponto:week.title")}
              </h2>
              <span className="text-caption text-muted">
                {formatYmdRange(week.start, week.end)}
              </span>
            </div>
            <TotalsGrid totals={week.totals} />
          </section>
        )}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirm}
        title={t("ponto:confirm.title")}
        confirmLabel={t("comum:confirm")}
        confirmLoadingLabel={t("ponto:button.registering")}
        confirmIcon={<Check aria-hidden="true" className="size-5" />}
        largeConfirm
      >
        <div className="flex flex-col items-center gap-1.5 text-center">
          <ConfirmClock timeZone={timeZone} />
          <p>
            {periodName ? (
              <Trans
                i18nKey={nextExpected ? "ponto:confirm.periodExpected" : "ponto:confirm.period"}
                values={{ period: periodName, time: nextExpected ?? "" }}
                components={{ strong: <strong className="font-bold" /> }}
              />
            ) : (
              t("ponto:confirm.extra")
            )}
          </p>
          <p className="text-caption text-muted">
            {t("ponto:confirm.dateZone", { date: formatLongDateInZone(now, timeZone), city })}
          </p>
        </div>
        {outsideWorkday && <Notice variant="warning">{t("ponto:confirm.outsideWarning")}</Notice>}
        {offline && <Notice variant="offline">{t("ponto:confirm.offlineWarning")}</Notice>}
      </ConfirmModal>
    </>
  );
};

export default ClockPage;
