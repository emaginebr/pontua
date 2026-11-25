import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftRight,
  BriefcaseBusiness,
  CalendarDays,
  Crown,
  Eye,
  History,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { buttonClasses } from "../components/buttonStyles";
import { ConfirmModal } from "../components/ConfirmModal";
import { DayCard, DaysOffCard } from "../components/DayCard";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { Modal, ModalBody, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "../components/Modal";
import { Notice } from "../components/Notice";
import { PageHeader } from "../components/PageHeader";
import { PeriodFilter } from "../components/PeriodFilter";
import { RoleBadges } from "../components/RoleBadge";
import { ScheduleEditor } from "../components/ScheduleEditor";
import { ScheduleSummary } from "../components/ScheduleSummary";
import { Select } from "../components/Select";
import { StaleDataNotice } from "../components/StaleDataNotice";
import { SummaryHeader } from "../components/SummaryHeader";
import { TextField } from "../components/TextField";
import { useCompany } from "../hooks/useCompany";
import { useConnectivity } from "../hooks/useConnectivity";
import { useHistory } from "../hooks/useHistory";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { useMembers } from "../hooks/useMembers";
import { usePeriodFilter } from "../hooks/usePeriodFilter";
import { usePositions } from "../hooks/usePositions";
import { useRole } from "../hooks/useRole";
import { fieldErrorsOf, isApiError, toErrorMessage } from "../Services/apiClient";
import type { MemberInfo } from "../types/member";
import type { DayRecord, PunchInfo } from "../types/punch";
import { DEFAULT_TIME_ZONE, formatYmdNumeric, isValidYmd, toYmdInZone, todayInZone } from "../utils/dateTime";
import { groupDays } from "../utils/dayRows";
import { notifyError, notifySuccess } from "../utils/notify";
import {
  defaultScheduleDraft,
  draftFromSchedule,
  mapApiScheduleErrors,
  orderedErrorKeys,
  scheduleFieldId,
  shapeFromInfo,
  toScheduleInput,
  validateScheduleDraft,
} from "../utils/schedule";
import type { ScheduleDraft, ScheduleErrors } from "../utils/schedule";

const NO_DAYS: DayRecord[] = [];
const SCHEDULE_ID_PREFIX = "jornada-membro";
const SECTION = "rounded-card border border-separator bg-surface p-4 shadow-sm";

type Dialog = "position" | "schedule" | "clearSchedule" | "manager" | "deactivate" | "ownerBlocked" | "reactivate" | null;

/**
 * Detalhe do membro (`/empresa/membros/:memberId`, mockup members.html; US7, FR-020): dados,
 * cargo e histórico, jornada (do cargo ou própria), histórico e resumo do período; ações do
 * responsável: trocar cargo, jornada própria / voltar à do cargo, gestor por cargos, desativar e
 * reativar (desativar o responsável é explicado e leva à transferência).
 */
const MemberDetailPage = () => {
  const { t } = useTranslation();
  const { memberId: rawId } = useParams();
  const location = useLocation();
  const memberId = Number(rawId);
  const validId = Number.isInteger(memberId) && memberId > 0;
  const filter = usePeriodFilter();
  const isDesktop = useIsDesktop();
  const { activeCompany } = useCompany();
  const { isOwner } = useRole();
  const { isOnline } = useConnectivity();
  const { selected, stale: memberStale, fetchedAt: memberFetchedAt, get, changePosition, setSchedule, clearSchedule, deactivate, reactivate, setManager } =
    useMembers();
  const history = useHistory();
  const { positions, load: loadPositions } = usePositions();
  const timeZone = activeCompany?.timeZone ?? DEFAULT_TIME_ZONE;
  const today = todayInZone(timeZone);
  const offline = !isOnline;
  const { month, start, end } = filter.query;

  const [loadingMember, setLoadingMember] = useState(validId);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  // Trocar cargo
  const [positionValue, setPositionValue] = useState("");
  const [positionFrom, setPositionFrom] = useState(today);
  const [positionErrors, setPositionErrors] = useState<{ positionId?: string; effectiveFrom?: string }>({});
  // Jornada própria
  const [draft, setDraft] = useState<ScheduleDraft>(() => defaultScheduleDraft(today));
  const [scheduleErrors, setScheduleErrors] = useState<ScheduleErrors>({});
  const [clearFrom, setClearFrom] = useState(today);
  // Gestor
  const [managerOn, setManagerOn] = useState(false);
  const [managedIds, setManagedIds] = useState<number[]>([]);
  const [managerError, setManagerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const member: MemberInfo | null = selected?.memberId === memberId ? selected : null;

  const loadMember = useCallback(async () => {
    if (!validId) return;
    try {
      setLoadingMember(true);
      setMemberError(null);
      await get(memberId);
    } catch (err) {
      setMemberError(toErrorMessage(err));
    } finally {
      setLoadingMember(false);
    }
  }, [validId, memberId, get]);

  useEffect(() => {
    void loadMember();
  }, [loadMember]);

  const { load: loadHistory } = history;
  useEffect(() => {
    if (validId) void loadHistory({ month, start, end }, memberId);
  }, [validId, loadHistory, month, start, end, memberId]);

  useEffect(() => {
    if (isOwner) void loadPositions();
  }, [isOwner, loadPositions]);

  const days = history.memberId === memberId ? history.days : NO_DAYS;
  const summary = history.memberId === memberId ? history.summary : null;
  const items = useMemo(() => groupDays(days, today), [days, today]);

  const closeDialog = () => {
    if (saving) return;
    setDialog(null);
    setDialogError(null);
  };

  const failed = (err: unknown) => {
    const message = toErrorMessage(err);
    setDialogError(message);
    notifyError(message);
  };

  const backTo = "/empresa/membros";

  if (!validId) {
    return (
      <>
        <PageHeader title={t("membros:detailTitle")} backTo="/empresa/membros" />
        <ErrorState title={t("membros:notFound")} message={t("membros:notFoundText")} />
      </>
    );
  }

  if (!member) {
    return (
      <>
        <PageHeader title={t("membros:detailTitle")} backTo="/empresa/membros" />
        {loadingMember || !memberError ? (
          <LoadingState lines={6} />
        ) : (
          <ErrorState message={memberError} onRetry={() => void loadMember()} retrying={loadingMember} />
        )}
      </>
    );
  }

  const active = member.status === "active";
  const isSelf = member.memberId === activeCompany?.myAccess.memberId;
  const positionHistory = [...(member.positionHistory ?? [])].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const currentPosition = positionHistory.find((item) => item.effectiveFrom <= today) ?? null;
  const ownSchedules = member.scheduleHistory ?? [];
  const managedNames = positions
    .filter((position) => member.managedPositionIds.includes(position.positionId))
    .map((position) => position.name);
  const firstName = member.name.split(" ")[0] ?? member.name;

  // --- Ações -------------------------------------------------------------------------------

  const openPosition = () => {
    setPositionValue(member.position ? String(member.position.positionId) : "");
    setPositionFrom(today);
    setPositionErrors({});
    setDialogError(null);
    setDialog("position");
  };

  const submitPosition = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: { positionId?: string; effectiveFrom?: string } = {};
    if (!positionValue) next.positionId = t("membros:position.errors.position");
    if (!isValidYmd(positionFrom)) next.effectiveFrom = t("membros:position.errors.date");
    setPositionErrors(next);
    if (next.positionId || next.effectiveFrom) return;
    setSaving(true);
    try {
      await changePosition(member.memberId, { positionId: Number(positionValue), effectiveFrom: positionFrom });
      notifySuccess(t("membros:position.saved", { name: firstName }));
      setDialog(null);
    } catch (err) {
      const fields = fieldErrorsOf(err);
      const apiErrors = { positionId: fields.positionid, effectiveFrom: fields.effectivefrom };
      setPositionErrors(apiErrors);
      if (!apiErrors.positionId && !apiErrors.effectiveFrom) failed(err);
    } finally {
      setSaving(false);
    }
  };

  const openSchedule = () => {
    setDraft(draftFromSchedule(member.currentSchedule, today));
    setScheduleErrors({});
    setDialogError(null);
    setDialog("schedule");
  };

  const focusScheduleError = (errors: ScheduleErrors) => {
    const first = orderedErrorKeys(draft, errors)[0];
    if (first) requestAnimationFrame(() => document.getElementById(scheduleFieldId(SCHEDULE_ID_PREFIX, first))?.focus());
  };

  const submitSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDialogError(null);
    const errors = validateScheduleDraft(draft, today, true);
    setScheduleErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusScheduleError(errors);
      return;
    }
    setSaving(true);
    try {
      await setSchedule(member.memberId, toScheduleInput(draft));
      notifySuccess(t("membros:schedule.saved", { name: firstName }));
      setDialog(null);
    } catch (err) {
      const mapped = isApiError(err) ? mapApiScheduleErrors(err.erros, draft) : { fields: {}, name: null, general: [] };
      if (Object.keys(mapped.fields).length > 0) {
        setScheduleErrors(mapped.fields);
        focusScheduleError(mapped.fields);
        if (mapped.general.length > 0) setDialogError(mapped.general.join(" "));
      } else {
        failed(err);
      }
    } finally {
      setSaving(false);
    }
  };

  const openClearSchedule = () => {
    setClearFrom(today);
    setDialogError(null);
    setDialog("clearSchedule");
  };

  const confirmClearSchedule = async () => {
    try {
      await clearSchedule(member.memberId, isValidYmd(clearFrom) ? clearFrom : null);
      notifySuccess(t("membros:schedule.cleared", { name: firstName }));
    } catch (err) {
      failed(err);
      throw err;
    }
  };

  const openManager = () => {
    setManagerOn(member.isManager);
    setManagedIds(member.managedPositionIds);
    setManagerError(null);
    setDialogError(null);
    setDialog("manager");
  };

  const submitManager = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDialogError(null);
    // Backend: `isManager = true` exige ao menos um cargo
    if (managerOn && managedIds.length === 0) {
      setManagerError(t("membros:manager.errors.positions"));
      return;
    }
    setManagerError(null);
    setSaving(true);
    try {
      await setManager(member.memberId, { isManager: managerOn, positionIds: managerOn ? managedIds : [] });
      notifySuccess(managerOn ? t("membros:manager.saved", { name: firstName }) : t("membros:manager.removed", { name: firstName }));
      setDialog(null);
    } catch (err) {
      const fieldError = fieldErrorsOf(err).positionids;
      if (fieldError) setManagerError(fieldError);
      else failed(err);
    } finally {
      setSaving(false);
    }
  };

  const openDeactivate = () => {
    setDialogError(null);
    setDialog(member.isOwner ? "ownerBlocked" : "deactivate");
  };

  const confirmDeactivate = async () => {
    try {
      await deactivate(member.memberId);
      notifySuccess(t("membros:deactivate.done", { name: member.name }));
    } catch (err) {
      failed(err);
      throw err;
    }
  };

  const confirmReactivate = async () => {
    try {
      await reactivate(member.memberId);
      notifySuccess(t("membros:reactivate.done", { name: member.name }));
    } catch (err) {
      failed(err);
      throw err;
    }
  };

  const toggleManaged = (positionId: number) =>
    setManagedIds((previous) =>
      previous.includes(positionId) ? previous.filter((id) => id !== positionId) : [...previous, positionId],
    );

  const renderPunchAction = (punch: PunchInfo, name: string) => (
    <Link
      to={`/historico/marcacao/${punch.punchId}`}
      state={{ from: `/empresa/membros/${member.memberId}${location.search}` }}
      aria-label={t("membros:punchDetails", { punch: `${name} ${punch.localTime}` })}
      className={buttonClasses({ variant: "icon" })}
    >
      <Eye aria-hidden="true" className="size-5" />
    </Link>
  );

  const summaryCard = summary && (
    <SummaryHeader summary={summary} today={today} title={filter.label} weeks={isDesktop ? "open" : "collapsed"} />
  );

  const actionButton = "justify-start";

  return (
    <>
      <PageHeader title={member.name} subtitle={member.email} backTo={backTo} documentTitle={member.name} />
      <StaleDataNotice stale={memberStale} fetchedAt={memberFetchedAt} timeZone={timeZone} className="mb-4" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby="membro-dados" className={SECTION}>
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={member.name} size="lg" inactive={!active} />
              <div className="flex min-w-0 flex-col gap-1">
                <h2 id="membro-dados" className="text-title-sm text-text">
                  {t("membros:dataTitle")}
                </h2>
                <RoleBadges member={member} />
              </div>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.9375rem]">
              <dt className="font-semibold text-muted">{t("membros:joined")}</dt>
              <dd>{formatYmdNumeric(toYmdInZone(member.joinedAt, timeZone))}</dd>
              <dt className="font-semibold text-muted">{t("membros:position.label")}</dt>
              <dd>
                {member.position?.name ?? t("empresa:hub.noPosition")}
                {currentPosition && (
                  <span className="block text-caption text-muted">
                    {t("membros:sinceDate", { date: formatYmdNumeric(currentPosition.effectiveFrom) })}
                  </span>
                )}
              </dd>
              <dt className="font-semibold text-muted">{t("membros:schedule.label")}</dt>
              <dd>
                {member.hasOwnSchedule ? t("membros:schedule.own") : t("membros:schedule.fromPosition")}
                {member.currentSchedule && (
                  <ScheduleSummary schedule={shapeFromInfo(member.currentSchedule)} className="block" />
                )}
              </dd>
              {member.isManager && (
                <>
                  <dt className="font-semibold text-muted">{t("membros:manager.label")}</dt>
                  <dd>{managedNames.length > 0 ? managedNames.join(", ") : t("membros:manager.count", { count: member.managedPositionIds.length })}</dd>
                </>
              )}
            </dl>
          </section>

          <section aria-labelledby="membro-periodo" className="flex flex-col gap-3">
            <h2 id="membro-periodo" className="text-title-sm text-text">
              {t("membros:periodTitle")}
            </h2>
            <PeriodFilter filter={filter} className="rounded-control border border-separator bg-surface p-0.5" />
            <StaleDataNotice stale={history.stale} fetchedAt={history.fetchedAt} timeZone={timeZone} />
            {!isDesktop && summaryCard}
            {history.loading && days.length === 0 ? (
              <LoadingState lines={5} />
            ) : history.error && days.length === 0 ? (
              <ErrorState
                message={history.error}
                onRetry={() => void loadHistory({ month, start, end }, memberId)}
                retrying={history.loading}
              />
            ) : items.length === 0 ? (
              <EmptyState icon={History} title={t("historico:empty")} />
            ) : (
              <ul aria-label={t("historico:listLabel")} className="flex flex-col gap-3">
                {items.map((item) =>
                  item.kind === "off" ? (
                    <li key={item.days[0]?.date}>
                      <DaysOffCard days={item.days} />
                    </li>
                  ) : (
                    <li key={item.day.date}>
                      <DayCard day={item.day} today={today} timeZone={timeZone} renderPunchAction={renderPunchAction} />
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          {isDesktop && summaryCard}

          {isOwner && (
            <section aria-labelledby="membro-acoes" className={SECTION}>
              <h2 id="membro-acoes" className="mb-2 text-title-sm text-text">
                {t("membros:actions")}
              </h2>
              {offline && <p className="mb-2 text-caption text-muted">{t("comum:availableOnline")}</p>}
              <div className="flex flex-col gap-2">
                {active ? (
                  <>
                    <Button variant="secondary" fullWidth className={actionButton} disabled={offline} onClick={openPosition} icon={<BriefcaseBusiness aria-hidden="true" className="size-5" />}>
                      {t("membros:position.action")}
                    </Button>
                    <Button variant="secondary" fullWidth className={actionButton} disabled={offline} onClick={openSchedule} icon={<CalendarDays aria-hidden="true" className="size-5" />}>
                      {member.hasOwnSchedule ? t("membros:schedule.editOwn") : t("membros:schedule.setOwn")}
                    </Button>
                    {member.hasOwnSchedule && (
                      <Button variant="secondary" fullWidth className={actionButton} disabled={offline} onClick={openClearSchedule} icon={<RotateCcw aria-hidden="true" className="size-5" />}>
                        {t("membros:schedule.clear")}
                      </Button>
                    )}
                    {!member.isOwner && (
                      <Button variant="secondary" fullWidth className={actionButton} disabled={offline} onClick={openManager} icon={<ShieldCheck aria-hidden="true" className="size-5" />}>
                        {member.isManager ? t("membros:manager.edit") : t("membros:manager.make")}
                      </Button>
                    )}
                    <Button variant="danger-ghost" fullWidth disabled={offline} onClick={openDeactivate} icon={<UserX aria-hidden="true" className="size-5" />}>
                      {t("membros:deactivate.button", { name: firstName })}
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" fullWidth disabled={offline} onClick={() => setDialog("reactivate")} icon={<UserCheck aria-hidden="true" className="size-5" />}>
                    {t("membros:reactivate.button", { name: firstName })}
                  </Button>
                )}
              </div>
            </section>
          )}

          {(positionHistory.length > 0 || ownSchedules.length > 0) && (
            <section aria-labelledby="membro-historicos" className={SECTION}>
              <h2 id="membro-historicos" className="mb-2 text-title-sm text-text">
                {t("membros:historyTitle")}
              </h2>
              {positionHistory.length > 0 && (
                <>
                  <h3 className="text-label text-muted">{t("membros:position.history")}</h3>
                  <ul className="mb-3 divide-y divide-separator">
                    {positionHistory.map((item) => (
                      <li key={`${item.positionId}-${item.effectiveFrom}`} className="flex justify-between gap-2 py-2 text-body-sm">
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-muted">
                          {item.effectiveFrom > today
                            ? t("cargos:history.future", { date: formatYmdNumeric(item.effectiveFrom) })
                            : t("cargos:history.from", { date: formatYmdNumeric(item.effectiveFrom) })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {ownSchedules.length > 0 && (
                <>
                  <h3 className="text-label text-muted">{t("membros:schedule.history")}</h3>
                  <ul className="divide-y divide-separator">
                    {ownSchedules.map((version) => (
                      <li key={version.scheduleId} className="flex flex-col gap-0.5 py-2 text-body-sm">
                        <span className="font-semibold">
                          {version.effectiveFrom > today
                            ? t("cargos:history.future", { date: formatYmdNumeric(version.effectiveFrom) })
                            : t("cargos:history.from", { date: formatYmdNumeric(version.effectiveFrom) })}
                        </span>
                        {version.inheritsPosition ? (
                          <span className="text-muted">{t("membros:schedule.backToPosition")}</span>
                        ) : (
                          <ScheduleSummary schedule={shapeFromInfo(version)} />
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
          {isSelf && <p className="text-caption text-muted">{t("membros:selfHint")}</p>}
        </aside>
      </div>

      {/* Trocar cargo */}
      <Modal open={dialog === "position"} onOpenChange={(open) => (open ? undefined : closeDialog())}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{t("membros:position.title", { name: member.name })}</ModalTitle>
            <ModalDescription>{t("membros:position.description")}</ModalDescription>
          </ModalHeader>
          <form noValidate onSubmit={(event) => void submitPosition(event)}>
            <ModalBody>
              {dialogError && <Notice variant="danger" role="alert">{dialogError}</Notice>}
              <Select
                label={t("membros:position.new")}
                value={positionValue}
                onChange={(event) => setPositionValue(event.target.value)}
                error={positionErrors.positionId}
              >
                <option value="">{t("convites:fields.positionPlaceholder")}</option>
                {positions.map((position) => (
                  <option key={position.positionId} value={position.positionId}>
                    {position.name}
                  </option>
                ))}
              </Select>
              <TextField
                label={t("membros:position.from")}
                type="date"
                value={positionFrom}
                help={t("membros:position.fromHelp")}
                onChange={(event) => setPositionFrom(event.target.value)}
                error={positionErrors.effectiveFrom}
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="secondary" onClick={closeDialog} disabled={saving}>
                {t("comum:cancel")}
              </Button>
              <Button type="submit" loading={saving} loadingText={t("comum:saving")}>
                {t("membros:position.save")}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Jornada própria */}
      <Modal open={dialog === "schedule"} onOpenChange={(open) => (open ? undefined : closeDialog())}>
        <ModalContent size="lg">
          <ModalHeader>
            <ModalTitle>{t("membros:schedule.title", { name: member.name })}</ModalTitle>
            <ModalDescription>{t("membros:schedule.description")}</ModalDescription>
          </ModalHeader>
          <form noValidate onSubmit={(event) => void submitSchedule(event)}>
            <ModalBody>
              {dialogError && <Notice variant="danger" role="alert">{dialogError}</Notice>}
              <ScheduleEditor
                value={draft}
                onChange={(next) => {
                  setDraft(next);
                  if (Object.keys(scheduleErrors).length > 0) setScheduleErrors(validateScheduleDraft(next, today, true));
                }}
                errors={scheduleErrors}
                today={today}
                idPrefix={SCHEDULE_ID_PREFIX}
                disabled={saving}
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="secondary" onClick={closeDialog} disabled={saving}>
                {t("comum:cancel")}
              </Button>
              <Button type="submit" loading={saving} loadingText={t("comum:saving")}>
                {t("membros:schedule.save")}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Voltar à jornada do cargo */}
      <ConfirmModal
        open={dialog === "clearSchedule"}
        onOpenChange={(open) => (open ? undefined : closeDialog())}
        onConfirm={confirmClearSchedule}
        title={t("membros:schedule.clearTitle")}
        description={t("membros:schedule.clearDescription", { name: firstName, position: member.position?.name ?? "" })}
        confirmLabel={t("membros:schedule.clearConfirm")}
      >
        <TextField
          label={t("membros:position.from")}
          type="date"
          value={clearFrom}
          min={today}
          onChange={(event) => setClearFrom(event.target.value)}
        />
      </ConfirmModal>

      {/* Gestor */}
      <Modal open={dialog === "manager"} onOpenChange={(open) => (open ? undefined : closeDialog())}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{t("membros:manager.title", { name: member.name })}</ModalTitle>
            <ModalDescription>{t("membros:manager.description")}</ModalDescription>
          </ModalHeader>
          <form noValidate onSubmit={(event) => void submitManager(event)}>
            <ModalBody>
              {dialogError && <Notice variant="danger" role="alert">{dialogError}</Notice>}
              <label className="flex min-h-touch items-center gap-3 rounded-control border border-border px-3.5">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={managerOn}
                  onChange={(event) => setManagerOn(event.target.checked)}
                />
                <span className="font-semibold">{t("membros:manager.toggle", { name: firstName })}</span>
              </label>
              {managerOn && (
                <fieldset
                  className="flex flex-col gap-2"
                  aria-describedby={managerError ? "gestor-cargos-erro" : undefined}
                >
                  <legend className="mb-1 text-label text-text">{t("membros:manager.positions")}</legend>
                  {positions.map((position) => (
                    <label key={position.positionId} className="flex min-h-touch items-center gap-3 px-1">
                      <input
                        type="checkbox"
                        className="size-5 accent-primary"
                        checked={managedIds.includes(position.positionId)}
                        onChange={() => toggleManaged(position.positionId)}
                      />
                      <span>{position.name}</span>
                    </label>
                  ))}
                  {managerError && (
                    <p id="gestor-cargos-erro" role="alert" className="text-body-sm font-[550] text-danger">
                      {managerError}
                    </p>
                  )}
                </fieldset>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="secondary" onClick={closeDialog} disabled={saving}>
                {t("comum:cancel")}
              </Button>
              <Button type="submit" loading={saving} loadingText={t("comum:saving")}>
                {t("membros:manager.save")}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Desativar */}
      <ConfirmModal
        open={dialog === "deactivate"}
        onOpenChange={(open) => (open ? undefined : closeDialog())}
        onConfirm={confirmDeactivate}
        title={t("membros:deactivate.title", { name: member.name })}
        description={t("membros:deactivate.description", { name: firstName })}
        confirmLabel={t("membros:deactivate.confirm")}
        variant="danger"
      />

      {/* Responsável não pode ser desativado (US7-4) */}
      <Modal open={dialog === "ownerBlocked"} onOpenChange={(open) => (open ? undefined : closeDialog())}>
        <ModalContent aria-describedby={undefined}>
          <ModalHeader>
            <ModalTitle>{isSelf ? t("membros:ownerBlocked.titleSelf") : t("membros:ownerBlocked.title", { name: member.name })}</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <Notice variant="warning" icon={Crown}>
              {isSelf
                ? t("membros:ownerBlocked.textSelf", { company: activeCompany?.name ?? "" })
                : t("membros:ownerBlocked.text", { name: firstName, company: activeCompany?.name ?? "" })}
            </Notice>
          </ModalBody>
          <ModalFooter>
            <Button variant="tertiary" onClick={closeDialog}>
              {t("comum:close")}
            </Button>
            <Link to="/empresa/configuracoes" className={buttonClasses({ variant: "primary" })}>
              <ArrowLeftRight aria-hidden="true" className="size-5" />
              {t("empresa:transfer.title")}
            </Link>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Reativar */}
      <ConfirmModal
        open={dialog === "reactivate"}
        onOpenChange={(open) => (open ? undefined : closeDialog())}
        onConfirm={confirmReactivate}
        title={t("membros:reactivate.title", { name: member.name })}
        description={t("membros:reactivate.description", { name: firstName })}
        confirmLabel={t("membros:reactivate.confirm")}
      />
    </>
  );
};

export default MemberDetailPage;
