import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Ban, Ellipsis, Eye, History, PenLine, Plus } from "lucide-react";
import { Button } from "../components/Button";
import { buttonClasses } from "../components/buttonStyles";
import { ConfirmModal } from "../components/ConfirmModal";
import { DayCard, DaysOffCard } from "../components/DayCard";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { ManualPunchModal } from "../components/ManualPunchModal";
import type { ManualOriginal } from "../components/ManualPunchModal";
import { Modal, ModalBody, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { PeriodFilter } from "../components/PeriodFilter";
import { StaleDataNotice } from "../components/StaleDataNotice";
import { SummaryHeader } from "../components/SummaryHeader";
import { useCompany } from "../hooks/useCompany";
import { useConnectivity } from "../hooks/useConnectivity";
import { useHistory } from "../hooks/useHistory";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { usePeriodFilter } from "../hooks/usePeriodFilter";
import { toErrorMessage } from "../Services/apiClient";
import type { DayRecord, ManualPunchInput, PunchInfo } from "../types/punch";
import { DEFAULT_TIME_ZONE, applyServerOffset, formatTimeInZone, formatYmdShort, todayInZone } from "../utils/dateTime";
import { groupDays } from "../utils/dayRows";
import { isInManualWindow, manualWindow } from "../utils/manualWindow";
import { notifyError, notifySuccess } from "../utils/notify";

const NO_DAYS: DayRecord[] = [];

interface ManualState {
  mode: "include" | "correct";
  date: string;
  original: ManualOriginal | null;
  /** Hora "agora" no fuso da empresa quando a folha abriu */
  nowTime: string;
  /** Remonta a folha (formulário limpo) a cada abertura */
  key: number;
}

interface ActionTarget {
  punch: PunchInfo;
  name: string;
}

/**
 * Histórico (`/historico`, mockup history.html; US5, FR-015–FR-017, FR-024): filtro de período,
 * totais e semanas, dias com marcações, "Incluir marcação", corrigir horário, cancelar pedido
 * pendente e detalhe da marcação.
 */
const HistoryPage = () => {
  const { t } = useTranslation();
  const filter = usePeriodFilter();
  const isDesktop = useIsDesktop();
  const { activeCompany, me } = useCompany();
  const { isOnline, serverOffset } = useConnectivity();
  const { days, summary, memberId, loading, error, stale, fetchedAt, load, createManual, cancel } = useHistory();
  const timeZone = activeCompany?.timeZone ?? DEFAULT_TIME_ZONE;
  const today = todayInZone(timeZone, applyServerOffset(serverOffset));
  const manualRange = manualWindow(today, activeCompany?.manualRetroDays ?? 0, me?.joinedAt, timeZone);
  const { month, start, end } = filter.query;
  const offline = !isOnline;

  const [manual, setManual] = useState<ManualState | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ActionTarget | null>(null);

  useEffect(() => {
    void load({ month, start, end });
  }, [load, month, start, end]);

  // Dados de outro membro (detalhe de membro) não aparecem aqui
  const ownDays = memberId === null ? days : NO_DAYS;
  const ownSummary = memberId === null ? summary : null;
  const items = useMemo(() => groupDays(ownDays, today), [ownDays, today]);
  /** Marcações com correção pendente (não se pede outra em cima) */
  const pendingCorrected = useMemo(() => {
    const ids = new Set<number>();
    ownDays.forEach((day) =>
      day.punches.forEach((punch) => {
        if (punch.status === "pending" && punch.replacesPunchId !== null) ids.add(punch.replacesPunchId);
      }),
    );
    return ids;
  }, [ownDays]);

  const canCorrect = (punch: PunchInfo): boolean =>
    (punch.status === "valid" || punch.status === "approved") &&
    !pendingCorrected.has(punch.punchId) &&
    isInManualWindow(punch.workDate, manualRange);
  const canCancel = (punch: PunchInfo): boolean => punch.status === "pending" && punch.kind === "manual";

  const openManual = (mode: ManualState["mode"], date: string, original: ManualOriginal | null = null) => {
    setActionTarget(null);
    setManual({
      mode,
      date,
      original,
      nowTime: formatTimeInZone(applyServerOffset(serverOffset), timeZone),
      key: Date.now(),
    });
    setManualOpen(true);
  };

  const submitManual = async (input: ManualPunchInput) => {
    await createManual(input);
    notifySuccess(t("historico:manual.sent"), t("historico:manual.sentDescription"));
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancel(cancelTarget.punch.punchId);
      notifySuccess(t("historico:cancel.done"));
    } catch (err) {
      notifyError(toErrorMessage(err));
      throw err;
    }
  };

  const punchLabel = (target: ActionTarget) => `${target.name} ${target.punch.localTime}`;

  const renderPunchAction = (punch: PunchInfo, name: string) => (
    <Button
      variant="icon"
      aria-label={t("historico:actions.label", { punch: `${name} ${punch.localTime}` })}
      onClick={() => setActionTarget({ punch, name })}
      icon={<Ellipsis aria-hidden="true" className="size-5" />}
    />
  );

  const includeButton = (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => openManual("include", today)}
      disabled={offline}
      aria-describedby={offline ? "historico-offline" : undefined}
      icon={<Plus aria-hidden="true" className="size-5" />}
    >
      {t("historico:include")}
    </Button>
  );

  const showSkeleton = loading && ownDays.length === 0;
  const showError = Boolean(error) && ownDays.length === 0;

  const summaryCard = ownSummary && (
    <SummaryHeader
      summary={ownSummary}
      today={today}
      title={filter.label}
      weeks={isDesktop ? "open" : "collapsed"}
      className={isDesktop ? "lg:sticky lg:top-6" : undefined}
    />
  );

  return (
    <>
      <PageHeader title={t("historico:title")} subtitle={t("historico:subtitle")} actions={includeButton} />
      {offline && (
        <p id="historico-offline" className="-mt-4 mb-4 text-caption text-muted">
          {t("comum:availableOnline")}
        </p>
      )}

      <PeriodFilter filter={filter} className="mb-4 rounded-control border border-separator bg-surface p-0.5" />
      <StaleDataNotice stale={stale} fetchedAt={fetchedAt} timeZone={timeZone} className="mb-4" />

      {showSkeleton ? (
        <LoadingState lines={6} />
      ) : showError ? (
        <ErrorState message={error} onRetry={() => void load({ month, start, end })} retrying={loading} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
          <div className="flex flex-col gap-3">
            {!isDesktop && summaryCard}
            {items.length === 0 ? (
              <EmptyState
                icon={History}
                title={t("historico:empty")}
                description={t("historico:emptyText")}
                action={
                  <Button variant="secondary" onClick={() => openManual("include", today)} disabled={offline}>
                    {t("historico:include")}
                  </Button>
                }
              />
            ) : (
              <ul aria-label={t("historico:listLabel")} className="flex flex-col gap-3">
                {items.map((item) =>
                  item.kind === "off" ? (
                    <li key={item.days[0]?.date}>
                      <DaysOffCard days={item.days} />
                    </li>
                  ) : (
                    <li key={item.day.date}>
                      <DayCard
                        day={item.day}
                        today={today}
                        timeZone={timeZone}
                        actionsDisabled={offline}
                        onInclude={
                          isInManualWindow(item.day.date, manualRange) ? (date) => openManual("include", date) : undefined
                        }
                        renderPunchAction={renderPunchAction}
                      />
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
          {isDesktop && <aside aria-label={t("historico:summary.label")}>{summaryCard}</aside>}
        </div>
      )}

      {manual && (
        <ManualPunchModal
          key={manual.key}
          open={manualOpen}
          onOpenChange={setManualOpen}
          mode={manual.mode}
          original={manual.original}
          initialDate={manual.date}
          minDate={manualRange.min}
          maxDate={manualRange.max}
          nowTime={manual.nowTime}
          onSubmit={submitManual}
        />
      )}

      <Modal open={actionTarget !== null} onOpenChange={(open) => (open ? undefined : setActionTarget(null))}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{actionTarget ? punchLabel(actionTarget) : ""}</ModalTitle>
            <ModalDescription>{actionTarget ? formatYmdShort(actionTarget.punch.workDate) : ""}</ModalDescription>
          </ModalHeader>
          {actionTarget && (
            <ModalBody>
              {canCorrect(actionTarget.punch) && (
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={offline}
                  onClick={() =>
                    openManual("correct", actionTarget.punch.workDate, {
                      punch: actionTarget.punch,
                      name: actionTarget.name,
                    })
                  }
                  icon={<PenLine aria-hidden="true" className="size-5" />}
                >
                  {t("historico:actions.correct")}
                </Button>
              )}
              {canCancel(actionTarget.punch) && (
                <Button
                  variant="danger-ghost"
                  fullWidth
                  disabled={offline}
                  onClick={() => {
                    setCancelTarget(actionTarget);
                    setActionTarget(null);
                  }}
                  icon={<Ban aria-hidden="true" className="size-5" />}
                >
                  {t("historico:actions.cancel")}
                </Button>
              )}
              <Link
                to={`/historico/marcacao/${actionTarget.punch.punchId}`}
                state={{ from: "/historico" }}
                className={buttonClasses({ variant: "tertiary", fullWidth: true })}
              >
                <Eye aria-hidden="true" className="size-5" />
                {t("historico:actions.details")}
              </Link>
              {offline && <p className="text-caption text-muted">{t("comum:availableOnline")}</p>}
            </ModalBody>
          )}
        </ModalContent>
      </Modal>

      <ConfirmModal
        open={cancelTarget !== null}
        onOpenChange={(open) => (open ? undefined : setCancelTarget(null))}
        onConfirm={handleCancel}
        title={t("historico:cancel.title")}
        description={
          cancelTarget
            ? t("historico:cancel.description", {
                punch: punchLabel(cancelTarget),
                date: formatYmdShort(cancelTarget.punch.workDate),
              })
            : undefined
        }
        confirmLabel={t("historico:cancel.confirm")}
        confirmLoadingLabel={t("historico:cancel.cancelling")}
        cancelLabel={t("historico:cancel.keep")}
        variant="danger"
      />
    </>
  );
};

export default HistoryPage;
