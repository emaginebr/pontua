import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarX, Check, ChevronLeft, CircleCheck, ClipboardCheck, Hourglass, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { ConfirmModal } from "../components/ConfirmModal";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { PeriodFilter } from "../components/PeriodFilter";
import { PunchBadge } from "../components/PunchBadge";
import { SegmentedControl } from "../components/SegmentedControl";
import { Select } from "../components/Select";
import { StaleDataNotice } from "../components/StaleDataNotice";
import { TextArea } from "../components/TextArea";
import { ALREADY_REVIEWED_STATUS, countPending } from "../Contexts/ApprovalContext";
import { useApprovals } from "../hooks/useApprovals";
import { useCompany } from "../hooks/useCompany";
import { useConnectivity } from "../hooks/useConnectivity";
import { usePeriodFilter } from "../hooks/usePeriodFilter";
import { usePositions } from "../hooks/usePositions";
import { useRole } from "../hooks/useRole";
import { isApiError, toErrorMessage } from "../Services/apiClient";
import type { PanelType, PendingPanelMember } from "../types/approval";
import type { PunchInfo } from "../types/punch";
import { cn } from "../utils/cn";
import {
  DEFAULT_TIME_ZONE,
  formatDateTimeShortInZone,
  formatMonthLabel,
  formatTimeInZone,
  formatYmdLong,
  formatYmdShort,
} from "../utils/dateTime";
import { isStruckPunch } from "../utils/dayRows";
import { shiftMonth } from "../utils/period";
import { notifyError, notifySuccess, notifyWarning } from "../utils/notify";
import { JUSTIFICATION_MAX_LENGTH } from "../components/ManualPunchModal";

const TYPE_PARAM = "tipo";
const POSITION_PARAM = "cargo";
const TYPES: PanelType[] = ["all", "pending", "missing"];

const isPanelType = (value: string | null): value is PanelType => value !== null && (TYPES as string[]).includes(value);

interface RejectTarget {
  punch: PunchInfo;
  label: string;
  member: PendingPanelMember;
  date: string;
  /** Horário da marcação original, quando é uma correção */
  correctionOf: string | null;
}

/**
 * Painel de aprovações (`/aprovacoes`, mockup approvals.html; US6, FR-022–FR-024): por dia (mais
 * recente primeiro), membro com cargo, situação e todas as marcações do dia; aprovar/rejeitar por
 * marcação com atualização otimista; gestor não aprova as próprias marcações.
 */
const ApprovalsPage = () => {
  const { t } = useTranslation();
  const filter = usePeriodFilter();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeCompany } = useCompany();
  const { isOwner, managedPositionIds } = useRole();
  const { isOnline } = useConnectivity();
  const { days, loading, error, stale, fetchedAt, reviewing, load, approve, reject } = useApprovals();
  const { positions, load: loadPositions } = usePositions();
  const timeZone = activeCompany?.timeZone ?? DEFAULT_TIME_ZONE;
  const myMemberId = activeCompany?.myAccess.memberId ?? null;
  const offline = !isOnline;

  const rawType = searchParams.get(TYPE_PARAM);
  const type: PanelType = isPanelType(rawType) ? rawType : "all";
  const rawPosition = Number(searchParams.get(POSITION_PARAM));
  const positionId = Number.isInteger(rawPosition) && rawPosition > 0 ? rawPosition : null;
  const { month, start, end } = filter.query;

  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    void load({ range: { month, start, end }, type, positionId });
  }, [load, month, start, end, type, positionId]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  const visiblePositions = useMemo(
    () => (isOwner ? positions : positions.filter((item) => managedPositionIds.includes(item.positionId))),
    [isOwner, positions, managedPositionIds],
  );

  const pendingTotal = countPending(days);
  const missingTotal = days.reduce(
    (total, day) => total + day.members.filter((member) => member.situation === "missing").length,
    0,
  );

  const setParam = (key: string, value: string | null) => {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        if (value) params.set(key, value);
        else params.delete(key);
        return params;
      },
      { replace: true },
    );
  };

  const punchName = (punch: PunchInfo, member: PendingPanelMember): string => {
    if (punch.periodName) return punch.periodName;
    const original = punch.replacesPunchId !== null ? member.punches.find((item) => item.punchId === punch.replacesPunchId) : undefined;
    return original?.periodName ?? t("ponto:extra");
  };

  const punchLabel = (punch: PunchInfo, member: PendingPanelMember): string => {
    const name = punchName(punch, member);
    return name === t("ponto:extra")
      ? t("aprovacoes:extraLabel", { time: punch.localTime })
      : t("aprovacoes:punchLabel", { name, time: punch.localTime });
  };

  const correctionOf = (punch: PunchInfo, member: PendingPanelMember): string | null => {
    if (punch.replacesPunchId === null) return null;
    return member.punches.find((item) => item.punchId === punch.replacesPunchId)?.localTime ?? null;
  };

  const reviewFailed = (err: unknown) => {
    if (isApiError(err) && err.status === ALREADY_REVIEWED_STATUS) {
      notifyWarning(t("aprovacoes:conflict"), t("aprovacoes:conflictText"));
      return;
    }
    notifyError(toErrorMessage(err));
  };

  const handleApprove = async (punch: PunchInfo) => {
    try {
      await approve(punch.punchId);
      notifySuccess(t("aprovacoes:approved"));
    } catch (err) {
      reviewFailed(err);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      await reject(rejectTarget.punch.punchId, rejectNote);
      notifySuccess(t("aprovacoes:rejected"));
    } catch (err) {
      reviewFailed(err);
      // 409: a lista já foi atualizada; o modal fecha. Outros erros mantêm o modal aberto.
      if (!(isApiError(err) && err.status === ALREADY_REVIEWED_STATUS)) throw err;
    }
  };

  const meta = (punch: PunchInfo, member: PendingPanelMember): string | null => {
    const parts: string[] = [];
    const original = correctionOf(punch, member);
    if (original) parts.push(t("aprovacoes:correctionOf", { time: original }));
    if (punch.kind === "offline")
      parts.push(t("aprovacoes:offlineMeta", { time: formatTimeInZone(punch.receivedAt, timeZone) }));
    if (punch.pendingReason === "outsideWorkday") parts.push(t("aprovacoes:outsideWorkday"));
    if (punch.kind === "manual" && !original) {
      const { date, time } = formatDateTimeShortInZone(punch.receivedAt, timeZone);
      parts.push(t("aprovacoes:requestedAt", { date, time }));
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  };

  const reviewLine = (punch: PunchInfo): string | null => {
    if (!punch.review || (punch.status !== "approved" && punch.status !== "rejected")) return null;
    const { date, time } = formatDateTimeShortInZone(punch.review.at, timeZone);
    const base = t("aprovacoes:reviewedBy", { status: t(`historico:status.${punch.status}`), by: punch.review.by, date, time });
    return punch.review.note ? `${base} · ${t("historico:day.reviewNote", { note: punch.review.note })}` : base;
  };

  const situationBadge = (member: PendingPanelMember) => {
    const pending = member.punches.filter((punch) => punch.status === "pending").length;
    if (member.situation === "missing")
      return (
        <span className="inline-flex h-6 items-center gap-1 rounded-sm bg-danger-soft px-2 text-caption font-semibold whitespace-nowrap text-danger">
          <CalendarX aria-hidden="true" className="size-3.5" />
          {t("aprovacoes:situation.missing")}
        </span>
      );
    if (pending === 0)
      return (
        <span className="inline-flex h-6 items-center gap-1 rounded-sm bg-success-soft px-2 text-caption font-semibold whitespace-nowrap text-success">
          <CircleCheck aria-hidden="true" className="size-3.5" />
          {t("aprovacoes:situation.reviewed")}
        </span>
      );
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-sm bg-warning-soft px-2 text-caption font-semibold whitespace-nowrap text-warning">
        <Hourglass aria-hidden="true" className="size-3.5" />
        {t("aprovacoes:situation.pending", { count: pending })}
      </span>
    );
  };

  const subtitle =
    days.length > 0
      ? [
          t("aprovacoes:pendingCount", { count: pendingTotal }),
          t("aprovacoes:missingCount", { count: missingTotal }),
        ].join(" · ")
      : undefined;

  const previousMonth = filter.period.kind === "month" ? shiftMonth(filter.period.month, -1) : null;

  return (
    <>
      <PageHeader title={t("aprovacoes:title")} subtitle={subtitle} />

      <div className="mb-4 flex flex-col gap-3">
        <PeriodFilter filter={filter} className="rounded-control border border-separator bg-surface p-0.5" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <SegmentedControl
            label={t("aprovacoes:situationFilter")}
            value={type}
            onChange={(value) => setParam(TYPE_PARAM, value === "all" ? null : value)}
            options={TYPES.map((value) => ({ value, label: t(`aprovacoes:types.${value}`) }))}
            className="lg:flex-1"
          />
          <Select
            label={t("aprovacoes:positionFilter")}
            value={positionId !== null ? String(positionId) : ""}
            onChange={(event) => setParam(POSITION_PARAM, event.target.value || null)}
            containerClassName="lg:w-64"
          >
            <option value="">{t("aprovacoes:allPositions")}</option>
            {visiblePositions.map((position) => (
              <option key={position.positionId} value={position.positionId}>
                {position.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <StaleDataNotice stale={stale} fetchedAt={fetchedAt} timeZone={timeZone} className="mb-4" />
      {offline && <p className="mb-4 text-caption text-muted">{t("aprovacoes:offline")}</p>}

      {loading && days.length === 0 ? (
        <LoadingState lines={6} />
      ) : error && days.length === 0 ? (
        <ErrorState
          message={error}
          onRetry={() => void load({ range: { month, start, end }, type, positionId })}
          retrying={loading}
        />
      ) : days.length === 0 ? (
        <div className="rounded-card border border-separator bg-surface shadow-sm">
          <EmptyState
            icon={ClipboardCheck}
            title={t("aprovacoes:empty")}
            description={t("aprovacoes:emptyText")}
            action={
              previousMonth ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={filter.previousMonth}
                  icon={<ChevronLeft aria-hidden="true" className="size-4" />}
                >
                  {t("aprovacoes:seeMonth", { month: (formatMonthLabel(previousMonth).split(" ")[0] ?? "").toLocaleLowerCase("pt-BR") })}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => {
            const headingId = `dia-${day.date}`;
            return (
              <section key={day.date} aria-labelledby={headingId} className="flex flex-col gap-3">
                <div className="sticky top-topbar z-(--z-sticky) flex items-baseline justify-between gap-2 bg-bg py-2 lg:top-0">
                  <h2 id={headingId} className="text-body font-[750] text-text">
                    {formatYmdLong(day.date)}
                  </h2>
                  <span className="text-caption text-muted">{t("aprovacoes:people", { count: day.members.length })}</span>
                </div>
                {day.members.map((member) => {
                  const own = member.memberId === myMemberId;
                  const canReview = !own || isOwner;
                  const memberHeading = `membro-${day.date}-${member.memberId}`;
                  return (
                    <article
                      key={member.memberId}
                      aria-labelledby={memberHeading}
                      className={cn(
                        "overflow-hidden rounded-card border border-separator bg-surface shadow-sm",
                        member.situation === "missing" && "shadow-[inset_4px_0_0_var(--pt-danger)]",
                      )}
                    >
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <Avatar name={member.name} />
                        <div className="min-w-0 flex-1">
                          <h3 id={memberHeading} className="text-[1.0625rem] leading-[1.375rem] font-[650] text-text">
                            {member.name}
                            {own && <span className="font-medium text-muted"> ({t("aprovacoes:you")})</span>}
                          </h3>
                          <p className="text-caption text-muted">{member.position ?? t("empresa:hub.noPosition")}</p>
                        </div>
                        {situationBadge(member)}
                      </div>

                      {member.situation === "missing" && member.punches.length === 0 ? (
                        <p className="px-4 pb-3.5 text-body-sm text-muted">{t("aprovacoes:missingText")}</p>
                      ) : (
                        <ol className="border-t border-separator">
                          {member.punches.map((punch) => {
                            const pending = punch.status === "pending";
                            const label = punchLabel(punch, member);
                            const busy = reviewing.includes(punch.punchId);
                            const info = meta(punch, member);
                            const review = reviewLine(punch);
                            return (
                              <li
                                key={punch.punchId}
                                className={cn(
                                  "flex flex-col gap-1.5 border-t border-separator px-4 py-3 first:border-t-0",
                                  pending && "bg-warning-soft",
                                )}
                              >
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <strong className="font-[650]">{punchName(punch, member)}</strong>
                                  <span className={cn("font-bold tabular-nums", isStruckPunch(punch) && "text-muted line-through")}>
                                    {punch.localTime}
                                  </span>
                                  <PunchBadge punch={punch} showExtra={false} />
                                </div>
                                {info && <p className="text-caption text-muted">{info}</p>}
                                {punch.justification && (
                                  <p className="rounded-sm bg-surface px-2.5 py-2 text-body-sm">
                                    <span className="sr-only">{t("historico:day.justification")}: </span>“{punch.justification}”
                                  </p>
                                )}
                                {review && <p className="text-caption text-muted">{review}</p>}
                                {pending &&
                                  (canReview ? (
                                    <div className="mt-1 grid grid-cols-2 gap-2 lg:flex lg:justify-end">
                                      <Button
                                        variant="reject"
                                        size="sm"
                                        disabled={offline || busy}
                                        aria-label={t("aprovacoes:rejectLabel", { punch: label, name: member.name })}
                                        onClick={() => {
                                          setRejectNote("");
                                          setRejectTarget({
                                            punch,
                                            label,
                                            member,
                                            date: day.date,
                                            correctionOf: correctionOf(punch, member),
                                          });
                                        }}
                                        icon={<X aria-hidden="true" className="size-5" />}
                                      >
                                        {t("aprovacoes:reject")}
                                      </Button>
                                      <Button
                                        variant="success"
                                        size="sm"
                                        disabled={offline || busy}
                                        aria-label={t("aprovacoes:approveLabel", { punch: label, name: member.name })}
                                        onClick={() => void handleApprove(punch)}
                                        icon={<Check aria-hidden="true" className="size-5" />}
                                      >
                                        {t("aprovacoes:approve")}
                                      </Button>
                                    </div>
                                  ) : (
                                    <p className="text-caption font-semibold text-muted">{t("aprovacoes:ownPunch")}</p>
                                  ))}
                              </li>
                            );
                          })}
                        </ol>
                      )}
                      <div className="border-t border-separator px-2 py-1">
                        <Link
                          to={`/empresa/membros/${member.memberId}`}
                          className="inline-flex min-h-touch items-center rounded-control px-2 text-body-sm font-semibold text-primary"
                        >
                          {t("aprovacoes:viewMember", { name: member.name })}
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={rejectTarget !== null}
        onOpenChange={(open) => (open ? undefined : setRejectTarget(null))}
        onConfirm={handleReject}
        title={t("aprovacoes:rejectTitle")}
        description={
          rejectTarget
            ? [
                t("aprovacoes:rejectDescription", {
                  name: rejectTarget.member.name,
                  punch: rejectTarget.label,
                  date: formatYmdShort(rejectTarget.date),
                }),
                rejectTarget.correctionOf ? t("aprovacoes:rejectCorrectionNote", { time: rejectTarget.correctionOf }) : "",
              ]
                .filter(Boolean)
                .join(" ")
            : undefined
        }
        confirmLabel={t("aprovacoes:rejectConfirm")}
        confirmLoadingLabel={t("aprovacoes:rejecting")}
        variant="danger"
      >
        <TextArea
          label={t("aprovacoes:rejectReason")}
          optional
          placeholder={t("aprovacoes:rejectReasonPlaceholder")}
          help={rejectTarget ? t("aprovacoes:rejectReasonHelp", { name: rejectTarget.member.name.split(" ")[0] }) : undefined}
          value={rejectNote}
          maxLength={JUSTIFICATION_MAX_LENGTH}
          showCounter
          onChange={(event) => setRejectNote(event.target.value)}
        />
      </ConfirmModal>
    </>
  );
};

export default ApprovalsPage;
