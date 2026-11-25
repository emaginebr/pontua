import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Ban, Check, CircleCheck, Clock, Copy, MailPlus, Share2, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../components/Button";
import { ConfirmModal } from "../components/ConfirmModal";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { PeriodFilter } from "../components/PeriodFilter";
import { Select } from "../components/Select";
import { StaleDataNotice } from "../components/StaleDataNotice";
import { TextField } from "../components/TextField";
import { useCompany } from "../hooks/useCompany";
import { useConnectivity } from "../hooks/useConnectivity";
import { useInvitations } from "../hooks/useInvitations";
import { usePeriodFilter } from "../hooks/usePeriodFilter";
import { usePositions } from "../hooks/usePositions";
import { fieldErrorsOf, toErrorMessage } from "../Services/apiClient";
import type { InvitationInfo, InvitationStatus } from "../types/invitation";
import { cn } from "../utils/cn";
import { DEFAULT_TIME_ZONE, formatDateTimeShortInZone, toYmdInZone, formatYmdNumeric } from "../utils/dateTime";
import { notifyError, notifySuccess } from "../utils/notify";
import { canShare, copyText, shareLink } from "../utils/share";

const STATUS_PARAM = "situacao";
const STATUSES: InvitationStatus[] = ["active", "expired", "revoked"];
const MIN_DAYS = 1;
const MAX_DAYS = 30;
const DEFAULT_DAYS = 7;
/** "Copiado" volta a "Copiar link" depois de 2 s. */
const COPIED_FEEDBACK_MS = 2_000;

const STATUS_STYLE: Record<InvitationStatus, { icon: LucideIcon; className: string }> = {
  active: { icon: CircleCheck, className: "bg-success-soft text-success" },
  expired: { icon: Clock, className: "bg-neutral-soft text-neutral" },
  revoked: { icon: Ban, className: "bg-danger-soft text-danger" },
};

const isStatus = (value: string | null): value is InvitationStatus =>
  value !== null && (STATUSES as string[]).includes(value);

interface NewInviteErrors {
  positionId?: string;
  expiresInDays?: string;
}

/**
 * Convites (`/empresa/convites`, mockup invite.html §3–4; US4, FR-019): filtro por mês e
 * situação, gerar (cargo + validade 1–30 dias), compartilhar (menu nativo, com "Copiar link" como
 * alternativa) e revogar com confirmação.
 */
const InvitationsPage = () => {
  const { t } = useTranslation();
  const filter = usePeriodFilter();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeCompany } = useCompany();
  const { isOnline } = useConnectivity();
  const { invitations, loading, error, stale, fetchedAt, load, create, revoke } = useInvitations();
  const { positions, load: loadPositions, loading: positionsLoading } = usePositions();
  const timeZone = activeCompany?.timeZone ?? DEFAULT_TIME_ZONE;
  const rawStatus = searchParams.get(STATUS_PARAM);
  const status = isStatus(rawStatus) ? rawStatus : null;
  const { month, start, end } = filter.query;

  const [newOpen, setNewOpen] = useState(false);
  const [positionId, setPositionId] = useState("");
  const [days, setDays] = useState(String(DEFAULT_DAYS));
  const [newErrors, setNewErrors] = useState<NewInviteErrors>({});
  const [newFormError, setNewFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<InvitationInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<InvitationInfo | null>(null);
  const positionRef = useRef<HTMLSelectElement>(null);
  const daysRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load({ month, start, end }, status);
  }, [load, month, start, end, status]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const setStatus = (value: string) => {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        if (isStatus(value)) params.set(STATUS_PARAM, value);
        else params.delete(STATUS_PARAM);
        return params;
      },
      { replace: true },
    );
  };

  const shareText = (invitation: InvitationInfo) => ({
    title: t("convites:share.title"),
    text: t("convites:share.text", { company: activeCompany?.name ?? "", position: invitation.position.name }),
    url: invitation.url,
  });

  const handleShare = async (invitation: InvitationInfo) => {
    const result = await shareLink(shareText(invitation));
    if (result === "copied") notifySuccess(t("convites:copied"));
    if (result === "failed") notifyError(t("convites:copyFailed"));
  };

  const handleCopy = async (invitation: InvitationInfo, inModal = false) => {
    if (await copyText(invitation.url)) {
      notifySuccess(t("convites:copied"));
      if (inModal) setCopied(true);
    } else {
      notifyError(t("convites:copyFailed"));
    }
  };

  const openNew = () => {
    setCreated(null);
    setCopied(false);
    setNewErrors({});
    setNewFormError(null);
    setDays(String(DEFAULT_DAYS));
    setPositionId("");
    setNewOpen(true);
    void loadPositions();
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewFormError(null);
    const next: NewInviteErrors = {};
    const parsedDays = Number(days);
    if (!positionId) next.positionId = t("convites:errors.position");
    if (!Number.isInteger(parsedDays) || parsedDays < MIN_DAYS || parsedDays > MAX_DAYS)
      next.expiresInDays = t("convites:errors.days", { min: MIN_DAYS, max: MAX_DAYS });
    setNewErrors(next);
    if (next.positionId) {
      positionRef.current?.focus();
      return;
    }
    if (next.expiresInDays) {
      daysRef.current?.focus();
      return;
    }
    setCreating(true);
    try {
      const invitation = await create({ positionId: Number(positionId), expiresInDays: parsedDays });
      setCreated(invitation);
      notifySuccess(t("convites:created"));
    } catch (err) {
      const fields = fieldErrorsOf(err);
      const apiErrors: NewInviteErrors = { positionId: fields.positionid, expiresInDays: fields.expiresindays };
      setNewErrors(apiErrors);
      if (!apiErrors.positionId && !apiErrors.expiresInDays) setNewFormError(toErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revoke(revokeTarget.invitationId);
      notifySuccess(t("convites:revoked"));
    } catch (err) {
      notifyError(toErrorMessage(err));
      throw err;
    }
  };

  const describe = (invitation: InvitationInfo): string => {
    const expires = formatDateTimeShortInZone(invitation.expiresAt, timeZone).date;
    const createdOn = formatDateTimeShortInZone(invitation.createdAt, timeZone).date;
    const accepted = t("convites:accepted", { count: invitation.acceptedCount });
    if (invitation.status === "active")
      return [t("convites:validUntil", { date: expires }), accepted, t("convites:createdOn", { date: createdOn })].join(" · ");
    if (invitation.status === "expired") return [t("convites:expiredOn", { date: expires }), accepted].join(" · ");
    return [t("convites:createdOn", { date: createdOn }), accepted].join(" · ");
  };

  const offline = !isOnline;
  const shareSupported = canShare();

  const newButton = (
    <Button
      size="sm"
      onClick={openNew}
      disabled={offline}
      aria-describedby={offline ? "convites-offline" : undefined}
      icon={<UserPlus aria-hidden="true" className="size-5" />}
    >
      {t("convites:new")}
    </Button>
  );

  return (
    <>
      <PageHeader title={t("convites:title")} backTo="/empresa" actions={newButton} />
      {offline && (
        <p id="convites-offline" className="-mt-4 mb-4 text-caption text-muted">
          {t("comum:availableOnline")}
        </p>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <PeriodFilter
          filter={filter}
          className="rounded-control border border-separator bg-surface p-0.5 lg:flex-1"
        />
        <Select
          label={t("convites:statusFilter")}
          value={status ?? ""}
          onChange={(event) => setStatus(event.target.value)}
          containerClassName="lg:w-56"
        >
          <option value="">{t("convites:status.all")}</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {t(`convites:status.${item}`)}
            </option>
          ))}
        </Select>
      </div>

      <StaleDataNotice stale={stale} fetchedAt={fetchedAt} timeZone={timeZone} className="mb-4" />

      {loading && invitations.length === 0 ? (
        <LoadingState lines={5} />
      ) : error && invitations.length === 0 ? (
        <ErrorState message={error} onRetry={() => void load({ month, start, end }, status)} retrying={loading} />
      ) : invitations.length === 0 ? (
        <EmptyState
          icon={MailPlus}
          title={t("convites:empty")}
          description={t("convites:emptyText")}
          action={
            <Button variant="secondary" onClick={openNew} disabled={offline}>
              {t("convites:new")}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {invitations.map((invitation) => {
            const style = STATUS_STYLE[invitation.status];
            const StatusIcon = style.icon;
            const active = invitation.status === "active";
            return (
              <li
                key={invitation.invitationId}
                className="overflow-hidden rounded-card border border-separator bg-surface shadow-sm"
              >
                <div className="flex flex-col gap-1 px-4 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-title-sm text-text">{invitation.position.name}</h2>
                    <span
                      className={cn(
                        "inline-flex h-6 items-center gap-1 rounded-sm px-2 text-caption font-semibold",
                        style.className,
                      )}
                    >
                      <StatusIcon aria-hidden="true" className="size-3.5" />
                      {t(`convites:status.${invitation.status}`)}
                    </span>
                  </div>
                  <p className="text-body-sm text-muted">{describe(invitation)}</p>
                </div>
                {active && (
                  <div className="flex flex-wrap gap-1 border-t border-separator px-2 py-1.5">
                    {shareSupported && (
                      <Button
                        variant="tertiary"
                        size="sm"
                        aria-label={t("convites:shareLabel", { position: invitation.position.name })}
                        onClick={() => void handleShare(invitation)}
                        icon={<Share2 aria-hidden="true" className="size-4" />}
                      >
                        {t("convites:shareButton")}
                      </Button>
                    )}
                    <Button
                      variant="tertiary"
                      size="sm"
                      aria-label={t("convites:copyLabel", { position: invitation.position.name })}
                      onClick={() => void handleCopy(invitation)}
                      icon={<Copy aria-hidden="true" className="size-4" />}
                    >
                      {t("convites:copy")}
                    </Button>
                    <Button
                      variant="danger-ghost"
                      size="sm"
                      className="ml-auto"
                      disabled={offline}
                      aria-label={t("convites:revokeLabel", { position: invitation.position.name })}
                      onClick={() => setRevokeTarget(invitation)}
                    >
                      {t("convites:revoke")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={newOpen} onOpenChange={setNewOpen}>
        <ModalContent>
          {created ? (
            <>
              <ModalHeader>
                <ModalTitle>{t("convites:createdTitle")}</ModalTitle>
                <ModalDescription>
                  {t("convites:createdText", {
                    company: activeCompany?.name ?? "",
                    position: created.position.name,
                    date: formatYmdNumeric(toYmdInZone(created.expiresAt, timeZone)),
                  })}
                </ModalDescription>
              </ModalHeader>
              <ModalBody>
                <TextField
                  label={t("convites:link")}
                  readOnly
                  value={created.url}
                  className="font-mono text-[0.8125rem] break-all"
                  onFocus={(event) => event.target.select()}
                />
                <p role="status" className="text-caption text-muted">
                  {copied ? t("convites:copiedStatus") : ""}
                </p>
              </ModalBody>
              <ModalFooter>
                <Button
                  variant="secondary"
                  onClick={() => void handleCopy(created, true)}
                  icon={
                    copied ? (
                      <Check aria-hidden="true" className="size-5" />
                    ) : (
                      <Copy aria-hidden="true" className="size-5" />
                    )
                  }
                >
                  {copied ? t("convites:copiedButton") : t("convites:copy")}
                </Button>
                {shareSupported && (
                  <Button
                    onClick={() => void handleShare(created)}
                    icon={<Share2 aria-hidden="true" className="size-5" />}
                  >
                    {t("convites:shareButton")}
                  </Button>
                )}
              </ModalFooter>
            </>
          ) : (
            <>
              <ModalHeader>
                <ModalTitle>{t("convites:newTitle")}</ModalTitle>
                <ModalDescription>{t("convites:newDescription")}</ModalDescription>
              </ModalHeader>
              <form noValidate onSubmit={(event) => void handleCreate(event)}>
                <ModalBody>
                  {newFormError && (
                    <p role="alert" className="text-body-sm font-[550] text-danger">
                      {newFormError}
                    </p>
                  )}
                  <Select
                    ref={positionRef}
                    label={t("convites:fields.position")}
                    value={positionId}
                    onChange={(event) => setPositionId(event.target.value)}
                    error={newErrors.positionId}
                    help={positionsLoading && positions.length === 0 ? t("comum:loading") : undefined}
                  >
                    <option value="">{t("convites:fields.positionPlaceholder")}</option>
                    {positions.map((position) => (
                      <option key={position.positionId} value={position.positionId}>
                        {position.name}
                      </option>
                    ))}
                  </Select>
                  <TextField
                    ref={daysRef}
                    label={t("convites:fields.days")}
                    type="number"
                    inputMode="numeric"
                    min={MIN_DAYS}
                    max={MAX_DAYS}
                    help={t("convites:fields.daysHelp", { min: MIN_DAYS, max: MAX_DAYS })}
                    value={days}
                    onChange={(event) => setDays(event.target.value)}
                    error={newErrors.expiresInDays}
                  />
                </ModalBody>
                <ModalFooter>
                  <Button variant="secondary" onClick={() => setNewOpen(false)} disabled={creating}>
                    {t("comum:cancel")}
                  </Button>
                  <Button type="submit" loading={creating} loadingText={t("convites:creating")}>
                    {t("convites:create")}
                  </Button>
                </ModalFooter>
              </form>
            </>
          )}
        </ModalContent>
      </Modal>

      <ConfirmModal
        open={revokeTarget !== null}
        onOpenChange={(open) => (open ? undefined : setRevokeTarget(null))}
        onConfirm={handleRevoke}
        title={t("convites:revokeTitle")}
        description={t("convites:revokeDescription", { position: revokeTarget?.position.name ?? "" })}
        confirmLabel={t("convites:revokeConfirm")}
        confirmLoadingLabel={t("convites:revoking")}
        variant="danger"
      />
    </>
  );
};

export default InvitationsPage;
